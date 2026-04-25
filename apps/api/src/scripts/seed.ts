/**
 * Seed script — populates the database with demo data.
 * Run: cd apps/api && npm run seed
 *      cd apps/api && npm run seed:catalog   # refresh products only (keeps users)
 *
 * Creates:
 *  - 1 admin user (admin@zojofashion.com / admin123456)
 *  - 1 customer user (test@zojofashion.com / test123456)
 *  - 8 products (5 sizes × 6–7 colorways; 2 images per color = front + back)
 *  - 3 homepage banners
 *
 * Idempotent: skips if admin user already exists.
 */

import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

// Load `apps/api/.env` even when the shell cwd is not `apps/api`
loadEnv({ path: resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

const ARGON_OPTS: argon2.Options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// Storefront mockups: served by Next as `/catalog/{mockFolder}/{color-slug}/front.webp` (symlink `public/catalog` → repo `images-mockups-webp`).
function catalogPath(folder: string, file: string): string {
  return `/catalog/${folder}/${file}`;
}

function colorNameToSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'color'
  );
}

// ─── Placeholder (hero/banners) ─────────────────────────

function heroImage(text: string): string {
  return `https://placehold.co/1920x800/0A0A0A/FF4500?text=${encodeURIComponent(text)}&font=montserrat`;
}

// ─── Data ───────────────────────────────────────────────

const STORE_BASE = 79900;
const MRP = 99900;

/**
 * Supplier color palette — names and hex values must exactly match what is
 * written into ProductImage.variantColor by clip_suggest.py + update:images.
 * Update `colors` per product after finishing the labeling pass.
 */
const ALL_COLORS: { name: string; hex: string }[] = [
  { name: 'White',           hex: '#ffffff' },
  { name: 'Black',           hex: '#151515' },
  { name: 'Navy Blue',       hex: '#000b17' },
  { name: 'Grey Melange',    hex: '#C3C3C3' },
  { name: 'Bottle Green',    hex: '#083717' },
  { name: 'Royal Blue',      hex: '#141c4f' },
  { name: 'Red',             hex: '#900001' },
  { name: 'Maroon',          hex: '#290005' },
  { name: 'Purple',          hex: '#271033' },
  { name: 'Golden Yellow',   hex: '#ffa200' },
  { name: 'Petrol Blue',     hex: '#0a2b30' },
  { name: 'Olive Green',     hex: '#26260a' },
  { name: 'Mustard Yellow',  hex: '#B6840D' },
  { name: 'Light Baby Pink', hex: '#ffd4e9' },
  { name: 'Lavender',        hex: '#e0d2fc' },
  { name: 'Coral',           hex: '#b34946' },
  { name: 'Mint',            hex: '#adfff0' },
  { name: 'Baby Blue',       hex: '#abebff' },
  { name: 'Off White',       hex: '#fffae7' },
];

const colorByName = (name: string) => ALL_COLORS.find((c) => c.name === name)!;

/**
 * Per-product color subsets — set these to match the colors in each product's
 * suggestions.json after the labeling pass, then run `npm run seed:catalog`.
 */
// Per-product colors — derived from pixel_suggest.py classification output.
// Order must match the suggestions.json pair order so update:images stays in sync.
const COLORS = {
  naruto:    ['Bottle Green','Petrol Blue','Mustard Yellow','Light Baby Pink','Lavender','Coral','Mint','Baby Blue','Off White'],
  eren:      ['Petrol Blue','Light Baby Pink','Lavender','Coral','Mint','Baby Blue','Off White'],
  zoro:      ['Bottle Green','Royal Blue','Purple','Petrol Blue','Olive Green','Coral'],
  gojo:      ['Purple','Grey Melange','Light Baby Pink','Lavender','Coral','Mint','Baby Blue','Off White'],
  inosuke:   ['Grey Melange','Bottle Green','Petrol Blue','Lavender','Coral','Mint','Baby Blue'],
  buddha:    ['Royal Blue','Purple','Petrol Blue','Light Baby Pink','Lavender','Coral','Mint','Baby Blue'],
  itachi:    ['Olive Green','Off White','Purple','Black','Bottle Green','Royal Blue','Maroon','Petrol Blue'],
  thirdeye:  ['Black','Grey Melange','Purple','Petrol Blue','Olive Green','Coral','Mint','Baby Blue'],
} satisfies Record<string, string[]>;

const colors = (key: keyof typeof COLORS) => COLORS[key].map(colorByName);

interface ProductSeed {
  slug: string;
  title: string;
  description: string;
  categorySlug: string;
  animeSeries: string;
  basePrice: number;
  compareAtPrice: number | null;
  tags: string[];
  material: string;
  isFeatured: boolean;
  /** Catalog images live at `/catalog/{mockFolder}/{colorSlug}/front|back.webp` (see `buildImageRows`). */
  mockFolder: string;
  /** Legacy: unused; numeric filenames replaced by per-color subfolders. */
  imageStart: number;
  colors: { name: string; hex: string }[];
  defaultColor: string;
}

const PRODUCTS: ProductSeed[] = [
  {
    slug: 'sage-mode-oversized-tee',
    title: 'Sage Mode Oversized Tee',
    description: 'Channel the power of nature with this Sage Mode graphic tee. Printed on premium 240 GSM combed cotton. Oversized fit for maximum street cred.',
    categorySlug: 'oversized',
    animeSeries: 'Naruto',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['oversized', 'anime', 'naruto', 'premium'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: true,
    mockFolder: 'naruto-mockups',
    imageStart: 100,
    colors: colors('naruto'),
    defaultColor: 'Bottle Green',
  },
  {
    slug: 'scout-regiment-oversized-tee',
    title: 'Scout Regiment Oversized Tee',
    description: 'Wings of Freedom on the back. Premium 240 GSM combed cotton, oversized drop-shoulder cut. Built for scouts who venture beyond.',
    categorySlug: 'oversized',
    animeSeries: 'AOT',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['oversized', 'anime', 'aot', 'premium'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: true,
    mockFolder: 'eren-mockups',
    imageStart: 100,
    colors: colors('eren'),
    defaultColor: 'Petrol Blue',
  },
  {
    slug: 'straw-hat-crew-tee',
    title: 'Straw Hat Crew Tee',
    description: 'The whole crew in minimalist line art. Oversized fit, soft hand feel. For the captain in every friend group.',
    categorySlug: 'oversized',
    animeSeries: 'One Piece',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['oversized', 'anime', 'one-piece'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: true,
    mockFolder: 'zoro-mockups',
    imageStart: 100,
    colors: colors('zoro'),
    defaultColor: 'Bottle Green',
  },
  {
    slug: 'sukuna-king-of-curses-tee',
    title: 'Sukuna King of Curses Tee',
    description: 'Sukuna\'s domain expansion on the back. Bold graphic, oversized cut. Not for the faint of cursed energy.',
    categorySlug: 'oversized',
    animeSeries: 'Jujutsu Kaisen',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['oversized', 'anime', 'jujutsu-kaisen'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: true,
    mockFolder: 'gojo-mockup',
    imageStart: 100,
    colors: colors('gojo'),
    defaultColor: 'Purple',
  },
  {
    slug: 'demon-slayer-corps-tee',
    title: 'Demon Slayer Corps Tee',
    description: 'Water breathing technique illustration across the chest. Oversized drop shoulder. The kind of tee Tanjiro would wear on his day off.',
    categorySlug: 'oversized',
    animeSeries: 'Demon Slayer',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['oversized', 'anime', 'demon-slayer'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: true,
    mockFolder: 'inosuke-mockups',
    imageStart: 100,
    colors: colors('inosuke'),
    defaultColor: 'Bottle Green',
  },
  {
    slug: 'saiyan-beyond-limits-tee',
    title: 'Saiyan Beyond Limits Tee',
    description: 'Ultra Instinct Goku on the front. Premium DTG print at 1440 DPI. Oversized fit, soft to touch.',
    categorySlug: 'oversized',
    animeSeries: 'Dragon Ball',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['oversized', 'anime', 'dragon-ball'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: true,
    mockFolder: 'buddha-mockups',
    imageStart: 110,
    colors: colors('buddha'),
    defaultColor: 'Royal Blue',
  },
  {
    slug: 'uchiha-clan-limited-tee',
    title: 'Uchiha Clan Limited Tee',
    description: 'Sharingan eye on the front, Uchiha crest on the back. Limited to 100 pieces per size. Once gone, gone.',
    categorySlug: 'oversized',
    animeSeries: 'Naruto',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['oversized', 'anime', 'naruto', 'collector'],
    material: '100% combed cotton, 260 GSM heavyweight.',
    isFeatured: true,
    mockFolder: 'itachi-mockups',
    imageStart: 100,
    colors: colors('itachi'),
    defaultColor: 'Olive Green',
  },
  {
    slug: 'third-eye-oversized-tee',
    title: 'Third Eye Oversized Tee',
    description: 'Ancient symbolism meets modern streetwear. The all-seeing eye graphic, front and back. Premium 240 GSM oversized fit.',
    categorySlug: 'oversized',
    animeSeries: 'Original',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['oversized', 'anime', 'original', 'spiritual'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: true,
    mockFolder: 'third-eye-mockups',
    imageStart: 126,
    colors: colors('thirdeye'),
    defaultColor: 'Black',
  },
];

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const BANNERS = [
  { title: 'New Drop — Naruto Shippuden', subtitle: 'Sage Mode Collection is here.', ctaText: 'Shop Now', ctaUrl: '/products?anime=Naruto', position: 'HERO' },
  { title: 'Pan-India delivery', subtitle: 'Flat ₹50 on every order.', ctaText: 'Browse', ctaUrl: '/products', position: 'STRIP' },
  { title: 'Limited Edition', subtitle: 'Once sold out, gone forever.', ctaText: 'View Drops', ctaUrl: '/products?category=limited-edition', position: 'SECONDARY' },
];

const OVERSIZED_SIZE_CHART = [
  { size: 'S',   chest: '42', length: '27', sleeve: '9.0',  sortOrder: 0 },
  { size: 'M',   chest: '44', length: '28', sleeve: '9.5',  sortOrder: 1 },
  { size: 'L',   chest: '46', length: '29', sleeve: '10.0', sortOrder: 2 },
  { size: 'XL',  chest: '48', length: '30', sleeve: '10.5', sortOrder: 3 },
  { size: 'XXL', chest: '50', length: '31', sleeve: '11.0', sortOrder: 4 },
];

async function upsertSizeCharts(): Promise<{ oversized: string }> {
  const chart = await prisma.sizeChart.upsert({
    where: { name: 'oversized' },
    create: {
      name: 'oversized',
      rows: { create: OVERSIZED_SIZE_CHART },
    },
    update: {},
    select: { id: true },
  });
  return { oversized: chart.id };
}

async function upsertSiteSettings() {
  await prisma.siteSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      instagramUrl: 'https://www.instagram.com/100days.fashion',
      youtubeUrl: 'https://www.youtube.com/@yashharkawat6147',
    },
    update: {
      instagramUrl: 'https://www.instagram.com/100days.fashion',
      youtubeUrl: 'https://www.youtube.com/@yashharkawat6147',
    },
  });
}

/**
 * On disk / catalog: under each `mockFolder`, **one subfolder per color** with `back.webp` and `front.webp`.
 * DB order unchanged: first N rows = all backs (one per color in order), next N = all fronts.
 * sortOrder: backs `0 … N-1`, fronts `N … 2N-1`.
 */
function buildImageRows(p: ProductSeed) {
  const colors = p.colors;
  const half = colors.length;
  const out: {
    url: string;
    publicId: string;
    alt: string;
    sortOrder: number;
    isPrimary: boolean;
    variantColor: string;
  }[] = [];
  for (let ci = 0; ci < half; ci++) {
    const c = colors[ci]!;
    const slug = colorNameToSlug(c.name);
    out.push({
      url: catalogPath(p.mockFolder, `${slug}/back.webp`),
      publicId: `local/${p.slug}-c${ci}-back`,
      alt: `${p.title} — ${c.name}, back`,
      sortOrder: ci,
      isPrimary: false,
      variantColor: c.name,
    });
  }
  for (let ci = 0; ci < half; ci++) {
    const c = colors[ci]!;
    const slug = colorNameToSlug(c.name);
    out.push({
      url: catalogPath(p.mockFolder, `${slug}/front.webp`),
      publicId: `local/${p.slug}-c${ci}-front`,
      alt: `${p.title} — ${c.name}, front`,
      sortOrder: half + ci,
      isPrimary: c.name === p.defaultColor,
      variantColor: c.name,
    });
  }
  return out;
}

async function createProductRecord(p: ProductSeed, sizeChartId?: string): Promise<void> {
  const imageRows = buildImageRows(p);
  const colorList = p.colors;
  const variantRows = SIZES.flatMap((size, si) =>
    colorList.map((color, ci) => ({
      sku: `ZJ-${p.slug.replace(/-/g, '').slice(0, 10).toUpperCase()}-C${ci}-${size}`,
      size,
      color: color.name,
      colorHex: color.hex,
      price: p.basePrice,
      stock: si === 0 && ci === 1 ? 0 : si === 4 ? 3 : 50,
      isActive: true,
    })),
  );

  await prisma.product.create({
    data: {
      slug: p.slug,
      title: p.title,
      description: p.description,
      shortDescription: p.description.slice(0, 100) + '...',
      categorySlug: p.categorySlug,
      basePrice: p.basePrice,
      compareAtPrice: p.compareAtPrice,
      defaultColor: p.defaultColor,
      gender: 'MEN',
      animeSeries: p.animeSeries,
      tags: p.tags,
      material: p.material,
      isActive: true,
      isFeatured: p.isFeatured,
      metaTitle: p.title,
      metaDescription: p.description.slice(0, 155),
      ...(sizeChartId ? { sizeChartId } : {}),
      images: { create: imageRows },
      variants: { create: variantRows },
    },
  });

  console.log(`  Product: ${p.title} (${colorList.length} colorways × ${SIZES.length} sizes)`);
}

async function deleteProductBySlug(slug: string) {
  const existing = await prisma.product.findUnique({
    where: { slug },
    select: { id: true, variants: { select: { id: true } } },
  });
  if (!existing) return;
  const variantIds = existing.variants.map((v) => v.id);
  if (variantIds.length > 0) {
    const deleted = await prisma.orderItem.deleteMany({ where: { variantId: { in: variantIds } } });
    if (deleted.count > 0) {
      console.log(`  [warn] Deleted ${deleted.count} order item(s) for ${slug}.`);
      await prisma.order.deleteMany({ where: { items: { none: {} } } });
    }
  }
  await prisma.product.deleteMany({ where: { id: existing.id } });
}

/** Re-create demo products (by slug). Clears dependent OrderItems first so FK constraints don't block. */
async function seedCatalogOnly(sizeChartIds: { oversized: string }) {
  console.log('[catalog] Recreating products...\n');

  // Remove any stale products not in the current PRODUCTS list
  const currentSlugs = new Set(PRODUCTS.map((p) => p.slug));
  const allSlugs = await prisma.product.findMany({ select: { slug: true } });
  for (const { slug } of allSlugs) {
    if (!currentSlugs.has(slug)) {
      await deleteProductBySlug(slug);
      console.log(`  Removed stale product: ${slug}`);
    }
  }

  for (const p of PRODUCTS) {
    const exists = await prisma.product.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (exists) {
      await deleteProductBySlug(p.slug);
      console.log(`  Replaced: ${p.slug}`);
    }
    const chartId = p.categorySlug === 'oversized' ? sizeChartIds.oversized : undefined;
    await createProductRecord(p, chartId);
  }
  console.log('\n✅ Catalog refresh complete. Users and other data were not changed.\n');
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  const onlyCatalog = process.argv.includes('--catalog');
  console.log('Seeding Zojo Fashion database...\n');

  await upsertSiteSettings();
  console.log('[0/4] Site settings (Instagram / YouTube) updated.\n');

  const sizeChartIds = await upsertSizeCharts();
  console.log('[0/4] Size charts upserted.\n');

  if (onlyCatalog) {
    await seedCatalogOnly(sizeChartIds);
    return;
  }

  // Check idempotency (first-time full seed only)
  const existing = await prisma.user.findUnique({ where: { email: 'admin@zojofashion.com' } });
  if (existing) {
    console.log('Seed data already exists (admin user found). Skipping full seed.\n');
    console.log('  • To refresh only products:  npm run seed:catalog\n');
    console.log('  • To wipe and run full seed:  DELETE the admin user in SQL, then npm run seed again.\n');
    return;
  }

  // 1. Users
  console.log('[1/4] Creating users...');
  const adminPwd = await argon2.hash('admin123456', ARGON_OPTS);
  const testPwd = await argon2.hash('test123456', ARGON_OPTS);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@zojofashion.com',
      phone: '+919999900000',
      passwordHash: adminPwd,
      firstName: 'Zojo',
      lastName: 'Admin',
      role: 'ADMIN',
      emailVerified: new Date(),
      phoneVerified: new Date(),
    },
  });
  console.log(`  Admin: ${adminUser.email} (password: admin123456)`);

  const testUser = await prisma.user.create({
    data: {
      email: 'test@zojofashion.com',
      phone: '+919999900001',
      passwordHash: testPwd,
      firstName: 'Test',
      lastName: 'User',
      role: 'CUSTOMER',
      emailVerified: new Date(),
      phoneVerified: new Date(),
    },
  });
  console.log(`  Customer: ${testUser.email} (password: test123456)`);

  // 2. Products + variants + images
  console.log('[2/4] Creating products...');
  for (const p of PRODUCTS) {
    const chartId = p.categorySlug === 'oversized' ? sizeChartIds.oversized : undefined;
    await createProductRecord(p, chartId);
  }

  // 3. Homepage banners
  console.log('[3/4] Creating banners...');
  for (let i = 0; i < BANNERS.length; i++) {
    const b = BANNERS[i]!;
    await prisma.homepageBanner.create({
      data: {
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: heroImage(b.title),
        ctaText: b.ctaText,
        ctaUrl: b.ctaUrl,
        position: b.position,
        sortOrder: i,
        isActive: true,
      },
    });
    console.log(`  Banner: ${b.title}`);
  }

  // 4. Create address for test user
  console.log('[4/4] Creating test address...');
  await prisma.address.create({
    data: {
      userId: testUser.id,
      type: 'HOME',
      fullName: 'Test User',
      phone: '+919999900001',
      line1: '123 Anime Street',
      line2: 'Otaku Colony',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      isDefault: true,
    },
  });
  console.log('  Address: 123 Anime Street, Mumbai');

  console.log('\n✅ Seed complete!');
  console.log('\nTest credentials:');
  console.log('  Admin:    admin@zojofashion.com / admin123456');
  console.log('  Customer: test@zojofashion.com  / test123456');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
