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

/**
 * Returns true for flat near-white background pixels to skip in zone sampling.
 * Non-background samples (shirt fabric) are accumulated separately anyway, so
 * this only needs to remove the most obvious studio-white pixels.
 */
function isFlatGrey(r: number, g: number, b: number): boolean {
  const avg = (r + g + b) / 3;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return avg > 235 && spread < 15;
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
  // Accumulate ALL opaque pixels as a fallback (for white/off-white shirts)
  let allRs = 0, allGs = 0, allBs = 0, allCount = 0;

  for (let i = 0; i < data.length; i += channels) {
    const alpha = data[i + 3] ?? 255;
    if (alpha < 128) continue; // transparent
    const pr = data[i]!;
    const pg = data[i + 1]!;
    const pb = data[i + 2]!;
    allRs += pr; allGs += pg; allBs += pb; allCount++;
    if (!isFlatGrey(pr, pg, pb)) {
      rs += pr; gs += pg; bs += pb; count++;
    }
  }

  if (count > 0) return [rs / count, gs / count, bs / count];
  // All pixels were filtered (zone IS near-white) — the shirt itself is white/light.
  // Return the zone average so the color detector can match it against the palette.
  if (allCount > 0) return [allRs / allCount, allGs / allCount, allBs / allCount];
  return null;
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

/**
 * Parse the side and color-id from a filename following the convention:
 *   Front_{n}_c_{colorId}.webp  or  Back_{n}_c_{colorId}.webp
 */
function parseFileParts(name: string): { side: 'front' | 'back'; colorId: string } | null {
  const m = /^(front|back)_\d+_c_(\w+)/i.exec(name);
  if (!m) return null;
  return { side: m[1]!.toLowerCase() as 'front' | 'back', colorId: m[2]! };
}

/**
 * Group uploaded files into front/back pairs using the filename convention
 * Front_{n}_c_{colorId}.webp / Back_{n}_c_{colorId}.webp.
 * Files with the same colorId are the same shirt color.
 * Color name is still assigned via pixel sampling against the supplier palette.
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
  type Side = { buffer: Buffer; name: string };
  const groups = new Map<string, { front?: Side; back?: Side }>();

  console.log('[detectPairs] received files:', files.map((f) => f.name));

  for (const file of files) {
    const parts = parseFileParts(file.name);
    if (!parts) {
      console.warn('[detectPairs] SKIPPED (no match):', file.name);
      continue;
    }
    console.log(`[detectPairs] parsed: ${file.name}  →  side=${parts.side}  colorId=${parts.colorId}`);
    const group = groups.get(parts.colorId) ?? {};
    group[parts.side] = file;
    groups.set(parts.colorId, group);
  }

  console.log('[detectPairs] groups:', [...groups.entries()].map(([id, g]) => ({
    colorId: id,
    front: g.front?.name ?? 'MISSING',
    back: g.back?.name ?? 'MISSING',
  })));

  const pairs: Awaited<ReturnType<typeof detectPairs>> = [];
  const usedColors = new Set<string>();

  for (const [colorId, group] of groups) {
    if (!group.front || !group.back) {
      console.warn(`[detectPairs] skipping incomplete pair for colorId=${colorId}`);
      continue;
    }

    const [rb, gb, bb] = await sampleShirtColor(group.back.buffer);
    const [rf, gf, bf] = await sampleShirtColor(group.front.buffer);
    const avgR = (rb + rf) / 2;
    const avgG = (gb + gf) / 2;
    const avgB = (bb + bf) / 2;

    const ranked = ALL_COLORS
      .map((c) => ({ ...c, dist: colorDistance(avgR, avgG, avgB, c.hex) }))
      .sort((a, b) => a.dist - b.dist);

    const picked = ranked.find((c) => !usedColors.has(c.name)) ?? ranked[0]!;
    usedColors.add(picked.name);

    console.log(`[detectPairs] colorId=${colorId}  front=${group.front.name}  back=${group.back.name}  avgRGB=(${avgR.toFixed(0)},${avgG.toFixed(0)},${avgB.toFixed(0)})  → detected="${picked.name}"`);

    pairs.push({
      color: { name: picked.name, hex: picked.hex },
      backBuffer: group.back.buffer,
      frontBuffer: group.front.buffer,
      backName: group.back.name,
      frontName: group.front.name,
    });
  }

  return pairs;
}
