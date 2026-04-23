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

// Storefront mockups: served by Next as `/catalog/...` (symlink `apps/web/public/catalog` → `design-mockups-hd`).
function catalogPath(folder: string, file: string): string {
  return `/catalog/${folder}/${file}`;
}

// ─── Placeholder (hero/banners) ─────────────────────────

function heroImage(text: string): string {
  return `https://placehold.co/1920x800/0A0A0A/FF4500?text=${encodeURIComponent(text)}&font=montserrat`;
}

// ─── Data ───────────────────────────────────────────────

const STORE_BASE = 79900;
const MRP = 99900;
/** 7 colorways: each has front + back (images.length / 2 = color count). */
const SHIRT_COLORS: { name: string; hex: string }[] = [
  { name: 'Ice Blue', hex: '#7eb6d9' },
  { name: 'Off White', hex: '#e8e4dc' },
  { name: 'Black', hex: '#0a0a0a' },
  { name: 'Charcoal', hex: '#3d3d3d' },
  { name: 'Navy', hex: '#1a2744' },
  { name: 'Forest', hex: '#2d4a3e' },
  { name: 'Dusty Rose', hex: '#c4a4a4' },
];
const SIX = SHIRT_COLORS.slice(0, 6);

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
  /** e.g. `100` → pairs 100+101, 102+103 … in `mockFolder` */
  mockFolder: string;
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
    colors: SHIRT_COLORS,
    defaultColor: 'Ice Blue',
  },
  {
    slug: 'scout-regiment-hoodie',
    title: 'Scout Regiment Hoodie',
    description: 'Wings of Freedom embroidered on the back. Heavy 350 GSM French terry. Kangaroo pocket. Built for scouts who venture beyond.',
    categorySlug: 'oversized',
    animeSeries: 'AOT',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['hoodie', 'anime', 'aot', 'premium', 'winter'],
    material: '80% cotton, 20% polyester, 350 GSM French terry.',
    isFeatured: true,
    mockFolder: 'eren-mockups',
    imageStart: 100,
    colors: SHIRT_COLORS,
    defaultColor: 'Navy',
  },
  {
    slug: 'straw-hat-crew-tee',
    title: 'Straw Hat Crew Tee',
    description: 'The whole crew in minimalist line art. Regular fit, soft hand feel. For the captain in every friend group.',
    categorySlug: 'regular',
    animeSeries: 'One Piece',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['regular', 'anime', 'one-piece'],
    material: '100% combed cotton, 200 GSM.',
    isFeatured: true,
    mockFolder: 'zoro-king-of-hell-mockups',
    imageStart: 100,
    colors: SIX,
    defaultColor: 'Off White',
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
    mockFolder: 'gojo-mockups',
    imageStart: 100,
    colors: SHIRT_COLORS,
    defaultColor: 'Dusty Rose',
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
    colors: SHIRT_COLORS,
    defaultColor: 'Forest',
  },
  {
    slug: 'saiyan-beyond-limits-tee',
    title: 'Saiyan Beyond Limits Tee',
    description: 'Ultra Instinct Goku on the front. Premium DTG print at 1440 DPI. Regular fit, soft to touch.',
    categorySlug: 'regular',
    animeSeries: 'Dragon Ball',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['regular', 'anime', 'dragon-ball'],
    material: '100% combed cotton, 200 GSM.',
    isFeatured: true,
    mockFolder: 'buddha-designs',
    imageStart: 110,
    colors: SHIRT_COLORS,
    defaultColor: 'Navy',
  },
  {
    slug: 'uchiha-clan-limited-tee',
    title: 'Uchiha Clan Limited Tee',
    description: 'Sharingan eye on the front, Uchiha crest on the back. Limited to 100 pieces per size. Once gone, gone.',
    categorySlug: 'limited-edition',
    animeSeries: 'Naruto',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['limited', 'anime', 'naruto', 'collector'],
    material: '100% combed cotton, 260 GSM heavyweight.',
    isFeatured: false,
    mockFolder: 'madara-itachi-mockup',
    imageStart: 100,
    colors: SHIRT_COLORS,
    defaultColor: 'Charcoal',
  },
  {
    slug: 'titan-shifter-oversized-tee',
    title: 'Titan Shifter Oversized Tee',
    description: 'Eren\'s titan form in monochrome ink wash style. Oversized, raw hem. For those who keep moving forward.',
    categorySlug: 'oversized',
    animeSeries: 'AOT',
    basePrice: STORE_BASE,
    compareAtPrice: MRP,
    tags: ['oversized', 'anime', 'aot'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: false,
    mockFolder: 'eren-mockups',
    imageStart: 100,
    colors: SHIRT_COLORS,
    defaultColor: 'Black',
  },
];

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

const BANNERS = [
  { title: 'New Drop — Naruto Shippuden', subtitle: 'Sage Mode Collection is here.', ctaText: 'Shop Now', ctaUrl: '/products?anime=Naruto', position: 'HERO' },
  { title: 'Pan-India delivery', subtitle: 'Flat ₹50 on every order.', ctaText: 'Browse', ctaUrl: '/products', position: 'STRIP' },
  { title: 'Limited Edition', subtitle: 'Once sold out, gone forever.', ctaText: 'View Drops', ctaUrl: '/products?category=limited-edition', position: 'SECONDARY' },
];

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
 * On disk / catalog: **first N files are all backs (one per color)**, then **N files are all fronts**.
 * sortOrder: backs use `0 … N-1`, fronts use `N … 2N-1`. For color `ci`, back = index `ci`, front = `N + ci`
 * (same “distance” in each half, as you described: back at `ci+1` in 1-based first half, front in second half).
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
    out.push({
      url: catalogPath(p.mockFolder, `${p.imageStart + ci}.jpg`),
      publicId: `local/${p.slug}-c${ci}-back`,
      alt: `${p.title} — ${c.name}, back`,
      sortOrder: ci,
      isPrimary: false,
      variantColor: c.name,
    });
  }
  for (let ci = 0; ci < half; ci++) {
    const c = colors[ci]!;
    out.push({
      url: catalogPath(p.mockFolder, `${p.imageStart + half + ci}.jpg`),
      publicId: `local/${p.slug}-c${ci}-front`,
      alt: `${p.title} — ${c.name}, front`,
      sortOrder: half + ci,
      isPrimary: c.name === p.defaultColor,
      variantColor: c.name,
    });
  }
  return out;
}

async function createProductRecord(p: ProductSeed): Promise<void> {
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
      images: { create: imageRows },
      variants: { create: variantRows },
    },
  });

  console.log(`  Product: ${p.title} (${colorList.length} colorways × ${SIZES.length} sizes)`);
}

/** Re-create demo products (by slug) without touching users. Fails if orders reference a variant. */
async function seedCatalogOnly() {
  console.log('[catalog] Recreating products...\n');
  for (const p of PRODUCTS) {
    const removed = await prisma.product.deleteMany({ where: { slug: p.slug } });
    if (removed.count > 0) {
      console.log(`  Replaced: ${p.slug}`);
    }
    await createProductRecord(p);
  }
  console.log('\n✅ Catalog refresh complete. Users and other data were not changed.\n');
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  const onlyCatalog = process.argv.includes('--catalog');
  console.log('Seeding Zojo Fashion database...\n');

  await upsertSiteSettings();
  console.log('[0/4] Site settings (Instagram / YouTube) updated.\n');

  if (onlyCatalog) {
    await seedCatalogOnly();
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
    await createProductRecord(p);
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
