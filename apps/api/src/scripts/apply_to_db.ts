/**
 * Apply suggestions.json (or labeler apply.json) to disk + DB.
 *
 * Accepts TWO input formats — pass either file:
 *
 *   1. suggestions.json  (written by clip_suggest.py)
 *      Edit face/color there, then run:
 *        cd apps/api && npm run update:images -- ../../images-mockups-webp/buddha-mockups/suggestions.json
 *
 *   2. apply.json  (written by labeler "Save to repo" button)
 *        cd apps/api && npm run update:images -- ../../images-mockups-webp/buddha-mockups/apply.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

// ─── Paths ──────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, '../../../../');
const MOCKUP_ROOT = path.join(REPO_ROOT, 'images-mockups-webp');
const CATALOG_LINK = path.join(REPO_ROOT, 'apps', 'web', 'public', 'catalog');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools', 'mockup-classify', 'catalog-manifest.json');

function colorNameToSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'color'
  );
}

// ─── Types ──────────────────────────────────────────────

interface Assignment {
  face: 'front' | 'back';
  slug: string;
  name: string;
}

interface ApplyJSON {
  product: string;
  productSlug: string;
  assignments: Record<string, Assignment>;
}

// suggestions.json shape from clip_suggest.py
interface SuggestionsJSON {
  folder: string;
  items: Array<{
    file: string;
    face: string;
    color: string;
    color_slug: string;
  }>;
}

// ─── Format detection + normalisation ───────────────────

function loadManifest(): Record<string, { productSlug: string | null }> {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  return m.productFolders ?? {};
}

function isSuggestionsFormat(data: unknown): data is SuggestionsJSON {
  return (
    typeof data === 'object' &&
    data !== null &&
    'items' in data &&
    Array.isArray((data as SuggestionsJSON).items)
  );
}

function normaliseSuggestions(data: SuggestionsJSON): ApplyJSON {
  const folders = loadManifest();
  const folderMeta = folders[data.folder];
  const productSlug = folderMeta?.productSlug ?? null;
  if (!productSlug) {
    console.error(
      `No productSlug for folder "${data.folder}" in catalog-manifest.json.\n` +
      `Add it under productFolders and re-run.`,
    );
    process.exit(1);
  }
  const assignments: Record<string, Assignment> = {};
  for (const item of data.items) {
    const face = item.face === 'back' ? 'back' : 'front';
    assignments[item.file] = {
      face,
      slug: item.color_slug || colorNameToSlug(item.color),
      name: item.color,
    };
  }
  return { product: data.folder, productSlug, assignments };
}

// ─── File copy ──────────────────────────────────────────

function copyToColorFolder(
  productDir: string,
  fileName: string,
  colorSlug: string,
  face: 'front' | 'back',
): void {
  const src = path.join(productDir, fileName);
  if (!fs.existsSync(src)) {
    console.warn(`  [skip] Source missing: ${src}`);
    return;
  }
  const destDir = path.join(productDir, colorSlug);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, `${face}.webp`);
  if (src === dest) return;
  fs.copyFileSync(src, dest);
  console.log(`  copied → ${colorSlug}/${face}.webp`);
}

// ─── DB rows builder ────────────────────────────────────

interface ImageRow {
  url: string;
  publicId: string;
  alt: string;
  width: null;
  height: null;
  sortOrder: number;
  isPrimary: boolean;
  variantColor: string;
}

function buildRows(
  mockFolder: string,
  productSlug: string,
  productTitle: string,
  defaultColor: string | null,
  assignments: Record<string, Assignment>,
): ImageRow[] {
  // Group by color slug: find back + front files for each slug.
  const bySlug = new Map<string, { name: string; back?: string; front?: string }>();
  for (const [, a] of Object.entries(assignments)) {
    const entry = bySlug.get(a.slug) ?? { name: a.name };
    if (a.face === 'front') entry.front = a.slug;
    else entry.back = a.slug;
    bySlug.set(a.slug, entry);
  }

  // Stable ordering: slugs in the order they appear in assignments (first-seen).
  const seenOrder: string[] = [];
  for (const [, a] of Object.entries(assignments)) {
    if (!seenOrder.includes(a.slug)) seenOrder.push(a.slug);
  }

  const backs: ImageRow[] = [];
  const fronts: ImageRow[] = [];

  seenOrder.forEach((slug, ci) => {
    const entry = bySlug.get(slug)!;
    const colorName = entry.name;
    const isDefault =
      defaultColor !== null &&
      colorNameToSlug(defaultColor) === slug;

    backs.push({
      url: `/catalog/${mockFolder}/${slug}/back.webp`,
      publicId: `local/${productSlug}-c${ci}-back`,
      alt: `${productTitle} — ${colorName}, back`,
      width: null,
      height: null,
      sortOrder: ci,
      isPrimary: false,
      variantColor: colorName,
    });

    fronts.push({
      url: `/catalog/${mockFolder}/${slug}/front.webp`,
      publicId: `local/${productSlug}-c${ci}-front`,
      alt: `${productTitle} — ${colorName}, front`,
      width: null,
      height: null,
      sortOrder: seenOrder.length + ci,
      isPrimary: isDefault,
      variantColor: colorName,
    });
  });

  return [...backs, ...fronts];
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('Usage: npm run update:images -- path/to/apply.json');
    process.exit(1);
  }

  const absJson = path.resolve(jsonPath);
  if (!fs.existsSync(absJson)) {
    console.error(`Not found: ${absJson}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(absJson, 'utf-8'));
  const data: ApplyJSON = isSuggestionsFormat(raw) ? normaliseSuggestions(raw) : (raw as ApplyJSON);
  const { product: mockFolder, productSlug, assignments } = data;

  if (!mockFolder || !productSlug || !assignments || typeof assignments !== 'object') {
    console.error(
      'Invalid JSON. Pass either:\n' +
      '  suggestions.json  (from clip_suggest.py)\n' +
      '  apply.json        (from labeler "Save to repo")',
    );
    process.exit(1);
  }

  const inputFormat = isSuggestionsFormat(raw) ? 'suggestions.json' : 'apply.json';
  console.log(`\napply_to_db [${inputFormat}]: folder=${mockFolder}  slug=${productSlug}`);
  console.log(`  assignments: ${Object.keys(assignments).length} files\n`);

  // ── Symlink reminder ──
  if (!fs.existsSync(CATALOG_LINK)) {
    console.log(
      `[reminder] apps/web/public/catalog does not exist yet. Run once:\n` +
      `  ln -sf "$(pwd)/images-mockups-webp" apps/web/public/catalog\n`,
    );
  }

  // ── Copy files ──
  const productDir = path.join(MOCKUP_ROOT, mockFolder);
  if (!fs.existsSync(productDir)) {
    console.error(`Product folder missing: ${productDir}`);
    process.exit(1);
  }
  console.log('Copying files into color subfolders…');
  for (const [fileName, a] of Object.entries(assignments)) {
    copyToColorFolder(productDir, fileName, a.slug, a.face);
  }

  // ── DB update ──
  const product = await prisma.product.findUnique({
    where: { slug: productSlug },
    select: { id: true, title: true, defaultColor: true },
  });
  if (!product) {
    console.error(`Product not found in DB: slug="${productSlug}". Run seed first.`);
    process.exit(1);
  }

  const rows = buildRows(
    mockFolder,
    productSlug,
    product.title,
    product.defaultColor,
    assignments,
  );

  console.log(`\nUpdating DB: ${rows.length} image rows for "${product.title}"…`);
  await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: product.id } });
    await tx.productImage.createMany({
      data: rows.map((r) => ({ ...r, productId: product.id })),
    });
  });

  // ── Audit log ──
  const logPath = path.join(productDir, 'applied.log');
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        appliedFrom: absJson,
        productSlug,
        mockFolder,
        rowsWritten: rows.length,
        at: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );

  console.log(`\n✅  Done. ${rows.length} ProductImage rows updated.`);
  console.log(`   Audit: ${logPath}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
