/**
 * Pixel-based shirt color detection using Sharp.
 * Mirrors the logic in tools/mockup-classify/pixel_suggest.py.
 *
 * Strategy:
 *  1. Sample three non-central zones (left sleeve, right sleeve, hem) to
 *     avoid the printed graphic, which dominates the shirt centre.
 *  2. Filter out flat near-white pixels (white studio background).
 *  3. Average the remaining pixels → representative shirt RGB.
 *  4. Match against the supplier palette via HSV-aware distance.
 */

import sharp from 'sharp';
import { ALL_COLORS, hexToRgb } from './colorPalette';

// ── Helpers ───────────────────────────────────────────────

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h = ((h * 60) + 360) % 360;
  }
  const s = max === 0 ? 0 : delta / max;
  return [h, s, max];
}

function hueDiff(a: number, b: number): number {
  const d = Math.abs(a - b);
  return d > 180 ? 360 - d : d;
}

function colorDistance(r: number, g: number, b: number, refHex: string): number {
  const [rr, gr, br] = hexToRgb(refHex);
  const [hs, ss] = rgbToHsv(r, g, b);
  const [hr, sr] = rgbToHsv(rr, gr, br);

  if (ss < 0.12 || sr < 0.12) {
    return Math.sqrt((r - rr) ** 2 + (g - gr) ** 2 + (b - br) ** 2);
  }
  const hd = hueDiff(hs, hr);
  const sd = Math.abs(ss - sr) * 100;
  const vd = Math.abs(r / 255 - rr / 255) * 100;
  return hd * 2.5 + sd * 0.4 + vd * 0.3;
}

/** Returns true for flat near-white pixels (studio background). */
function isFlatGrey(r: number, g: number, b: number): boolean {
  const avg = (r + g + b) / 3;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return avg > 230 && spread < 20;
}

// ── Zone sampling ─────────────────────────────────────────

type Zone = [number, number, number, number]; // x1r, x2r, y1r, y2r (fractions)

const SAMPLE_ZONES: Zone[] = [
  [0.10, 0.28, 0.35, 0.65], // left sleeve/side
  [0.72, 0.90, 0.35, 0.65], // right sleeve/side
  [0.25, 0.75, 0.80, 0.90], // hem
];

async function sampleZone(
  buffer: Buffer,
  width: number,
  height: number,
  zone: Zone,
): Promise<[number, number, number] | null> {
  const [x1r, x2r, y1r, y2r] = zone;
  const left = Math.floor(width * x1r);
  const top = Math.floor(height * y1r);
  const w = Math.max(1, Math.floor(width * (x2r - x1r)));
  const h = Math.max(1, Math.floor(height * (y2r - y1r)));

  const { data, info } = await sharp(buffer)
    .extract({ left, top, width: w, height: h })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels; // 4 (RGBA)
  let rs = 0, gs = 0, bs = 0, count = 0;

  for (let i = 0; i < data.length; i += channels) {
    const alpha = data[i + 3] ?? 255;
    if (alpha < 128) continue; // transparent
    const pr = data[i]!;
    const pg = data[i + 1]!;
    const pb = data[i + 2]!;
    if (!isFlatGrey(pr, pg, pb)) {
      rs += pr; gs += pg; bs += pb; count++;
    }
  }

  if (count === 0) return null;
  return [rs / count, gs / count, bs / count];
}

async function sampleShirtColor(buffer: Buffer): Promise<[number, number, number]> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 1000;

  const samples: Array<[number, number, number]> = [];
  for (const zone of SAMPLE_ZONES) {
    const s = await sampleZone(buffer, w, h, zone);
    if (s) samples.push(s);
  }

  if (samples.length === 0) return [128, 128, 128]; // fallback grey

  const avgR = samples.reduce((s, [r]) => s + r, 0) / samples.length;
  const avgG = samples.reduce((s, [, g]) => s + g, 0) / samples.length;
  const avgB = samples.reduce((s, [, , b]) => s + b, 0) / samples.length;
  return [avgR, avgG, avgB];
}

// ── Public API ────────────────────────────────────────────

export interface DetectedColor {
  name: string;
  hex: string;
}

/**
 * Detect shirt color from a single webp buffer.
 * Returns the closest supplier palette color.
 */
export async function detectColor(buffer: Buffer): Promise<DetectedColor> {
  const [r, g, b] = await sampleShirtColor(buffer);
  let bestName = ALL_COLORS[0]!.name;
  let bestHex = ALL_COLORS[0]!.hex;
  let bestDist = Infinity;

  for (const { name, hex } of ALL_COLORS) {
    const d = colorDistance(r, g, b, hex);
    if (d < bestDist) {
      bestDist = d;
      bestName = name;
      bestHex = hex;
    }
  }

  return { name: bestName, hex: bestHex };
}

export interface FilePair {
  backBuffer: Buffer;
  frontBuffer: Buffer;
  originalBackName: string;
  originalFrontName: string;
}

/**
 * Given an array of sorted buffers + names, split into front/back pairs.
 * Convention: first half = backs, second half = fronts (same as pixel_suggest.py).
 * Returns pairs with a detected color for each.
 */
export async function detectPairs(
  files: Array<{ buffer: Buffer; name: string }>,
): Promise<
  Array<{
    color: DetectedColor;
    backBuffer: Buffer;
    frontBuffer: Buffer;
    backName: string;
    frontName: string;
  }>
> {
  // Sort numerically by filename stem (strip extension)
  const sorted = [...files].sort((a, b) => {
    const na = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });

  const half = Math.floor(sorted.length / 2);
  const backs = sorted.slice(0, half);
  const fronts = sorted.slice(half);
  const pairs: Awaited<ReturnType<typeof detectPairs>> = [];

  // Track used colors to avoid duplicates
  const usedColors = new Set<string>();

  for (let i = 0; i < Math.min(backs.length, fronts.length); i++) {
    const back = backs[i]!;
    const front = fronts[i]!;

    // Average both images' samples for more stable color
    const [rb, gb, bb] = await sampleShirtColor(back.buffer);
    const [rf, gf, bf] = await sampleShirtColor(front.buffer);
    const avgR = (rb + rf) / 2;
    const avgG = (gb + gf) / 2;
    const avgB = (bb + bf) / 2;

    // Find best unused color
    const ranked = ALL_COLORS
      .map((c) => ({ ...c, dist: colorDistance(avgR, avgG, avgB, c.hex) }))
      .sort((a, b) => a.dist - b.dist);

    const picked = ranked.find((c) => !usedColors.has(c.name)) ?? ranked[0]!;
    usedColors.add(picked.name);

    pairs.push({
      color: { name: picked.name, hex: picked.hex },
      backBuffer: back.buffer,
      frontBuffer: front.buffer,
      backName: back.name,
      frontName: front.name,
    });
  }

  return pairs;
}
