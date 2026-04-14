/**
 * Seed script — populates the database with demo data.
 * Run: cd apps/api && npx tsx src/scripts/seed.ts
 *
 * Creates:
 *  - 1 admin user (admin@zojofashion.com / admin123456)
 *  - 1 customer user (test@zojofashion.com / test123456)
 *  - 3 categories
 *  - 6 anime collections with hero images
 *  - 8 products with variants (5 sizes × 2 colors each)
 *  - 3 homepage banners
 *
 * Idempotent: skips if admin user already exists.
 */

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const ARGON_OPTS: argon2.Options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// ─── Placeholder image generator ────────────────────────

function placeholderImage(text: string, accent = 'FF4500', bg = '141414'): string {
  return `https://placehold.co/800x1000/${bg}/${accent}?text=${encodeURIComponent(text)}&font=montserrat`;
}

function heroImage(text: string): string {
  return `https://placehold.co/1920x800/0A0A0A/FF4500?text=${encodeURIComponent(text)}&font=montserrat`;
}

// ─── Data ───────────────────────────────────────────────

const CATEGORIES = [
  { slug: 'oversized', name: 'Oversized', description: 'Oversized fit — shoulder seam sits lower for a relaxed drape.' },
  { slug: 'regular', name: 'Regular', description: 'Classic fit — true to size, comfortable all day.' },
  { slug: 'limited-edition', name: 'Limited Edition', description: 'Small batch drops — once sold out, gone forever.' },
];

const COLLECTIONS = [
  { slug: 'naruto', title: 'Naruto Shippuden', animeSeries: 'Naruto', subtitle: 'Believe it.' },
  { slug: 'aot', title: 'Attack on Titan', animeSeries: 'AOT', subtitle: 'Beyond the walls.' },
  { slug: 'one-piece', title: 'One Piece', animeSeries: 'One Piece', subtitle: 'Set sail.' },
  { slug: 'demon-slayer', title: 'Demon Slayer', animeSeries: 'Demon Slayer', subtitle: 'Breathe.' },
  { slug: 'jujutsu-kaisen', title: 'Jujutsu Kaisen', animeSeries: 'Jujutsu Kaisen', subtitle: 'Cursed energy.' },
  { slug: 'dragon-ball', title: 'Dragon Ball', animeSeries: 'Dragon Ball', subtitle: 'Power up.' },
];

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
}

const PRODUCTS: ProductSeed[] = [
  {
    slug: 'sage-mode-oversized-tee',
    title: 'Sage Mode Oversized Tee',
    description: 'Channel the power of nature with this Sage Mode graphic tee. Printed on premium 240 GSM combed cotton. Oversized fit for maximum street cred.',
    categorySlug: 'oversized',
    animeSeries: 'Naruto',
    basePrice: 89900,
    compareAtPrice: 119900,
    tags: ['oversized', 'anime', 'naruto', 'premium'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: true,
  },
  {
    slug: 'scout-regiment-hoodie',
    title: 'Scout Regiment Hoodie',
    description: 'Wings of Freedom embroidered on the back. Heavy 350 GSM French terry. Kangaroo pocket. Built for scouts who venture beyond.',
    categorySlug: 'oversized',
    animeSeries: 'AOT',
    basePrice: 149900,
    compareAtPrice: 199900,
    tags: ['hoodie', 'anime', 'aot', 'premium', 'winter'],
    material: '80% cotton, 20% polyester, 350 GSM French terry.',
    isFeatured: true,
  },
  {
    slug: 'straw-hat-crew-tee',
    title: 'Straw Hat Crew Tee',
    description: 'The whole crew in minimalist line art. Regular fit, soft hand feel. For the captain in every friend group.',
    categorySlug: 'regular',
    animeSeries: 'One Piece',
    basePrice: 79900,
    compareAtPrice: null,
    tags: ['regular', 'anime', 'one-piece'],
    material: '100% combed cotton, 200 GSM.',
    isFeatured: true,
  },
  {
    slug: 'sukuna-king-of-curses-tee',
    title: 'Sukuna King of Curses Tee',
    description: 'Sukuna\'s domain expansion on the back. Bold graphic, oversized cut. Not for the faint of cursed energy.',
    categorySlug: 'oversized',
    animeSeries: 'Jujutsu Kaisen',
    basePrice: 89900,
    compareAtPrice: 109900,
    tags: ['oversized', 'anime', 'jujutsu-kaisen'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: true,
  },
  {
    slug: 'demon-slayer-corps-tee',
    title: 'Demon Slayer Corps Tee',
    description: 'Water breathing technique illustration across the chest. Oversized drop shoulder. The kind of tee Tanjiro would wear on his day off.',
    categorySlug: 'oversized',
    animeSeries: 'Demon Slayer',
    basePrice: 89900,
    compareAtPrice: null,
    tags: ['oversized', 'anime', 'demon-slayer'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: true,
  },
  {
    slug: 'saiyan-beyond-limits-tee',
    title: 'Saiyan Beyond Limits Tee',
    description: 'Ultra Instinct Goku on the front. Premium DTG print at 1440 DPI. Regular fit, soft to touch.',
    categorySlug: 'regular',
    animeSeries: 'Dragon Ball',
    basePrice: 79900,
    compareAtPrice: 99900,
    tags: ['regular', 'anime', 'dragon-ball'],
    material: '100% combed cotton, 200 GSM.',
    isFeatured: true,
  },
  {
    slug: 'uchiha-clan-limited-tee',
    title: 'Uchiha Clan Limited Tee',
    description: 'Sharingan eye on the front, Uchiha crest on the back. Limited to 100 pieces per size. Once gone, gone.',
    categorySlug: 'limited-edition',
    animeSeries: 'Naruto',
    basePrice: 129900,
    compareAtPrice: 159900,
    tags: ['limited', 'anime', 'naruto', 'collector'],
    material: '100% combed cotton, 260 GSM heavyweight.',
    isFeatured: false,
  },
  {
    slug: 'titan-shifter-oversized-tee',
    title: 'Titan Shifter Oversized Tee',
    description: 'Eren\'s titan form in monochrome ink wash style. Oversized, raw hem. For those who keep moving forward.',
    categorySlug: 'oversized',
    animeSeries: 'AOT',
    basePrice: 89900,
    compareAtPrice: 119900,
    tags: ['oversized', 'anime', 'aot'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    isFeatured: false,
  },
];

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'Charcoal', hex: '#333333' },
];

const BANNERS = [
  { title: 'New Drop — Naruto Shippuden', subtitle: 'Sage Mode Collection is here.', ctaText: 'Shop Now', ctaUrl: '/products?anime=Naruto', position: 'HERO' },
  { title: 'Free Shipping', subtitle: 'On all orders above ₹999.', ctaText: 'Browse', ctaUrl: '/products', position: 'STRIP' },
  { title: 'Limited Edition', subtitle: 'Once sold out, gone forever.', ctaText: 'View Drops', ctaUrl: '/products?category=limited-edition', position: 'SECONDARY' },
];

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log('Seeding Zojo Fashion database...\n');

  // Check idempotency
  const existing = await prisma.user.findUnique({ where: { email: 'admin@zojofashion.com' } });
  if (existing) {
    console.log('Seed data already exists (admin user found). Skipping.\n');
    console.log('To re-seed, delete the admin user first:');
    console.log('  DELETE FROM "User" WHERE email = \'admin@zojofashion.com\';');
    return;
  }

  // 1. Users
  console.log('[1/6] Creating users...');
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

  // 2. Categories
  console.log('[2/6] Creating categories...');
  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const created = await prisma.category.create({
      data: { slug: cat.slug, name: cat.name, description: cat.description, isActive: true },
    });
    categoryMap.set(cat.slug, created.id);
    console.log(`  Category: ${cat.name}`);
  }

  // 3. Collections
  console.log('[3/6] Creating collections...');
  const collectionMap = new Map<string, string>();
  for (const col of COLLECTIONS) {
    const created = await prisma.collection.create({
      data: {
        slug: col.slug,
        title: col.title,
        subtitle: col.subtitle,
        animeSeries: col.animeSeries,
        heroImage: heroImage(col.title),
        isFeatured: true,
        isActive: true,
      },
    });
    collectionMap.set(col.animeSeries, created.id);
    console.log(`  Collection: ${col.title}`);
  }

  // 4. Products + variants + images
  console.log('[4/6] Creating products...');
  for (const p of PRODUCTS) {
    const categoryId = categoryMap.get(p.categorySlug);
    if (!categoryId) throw new Error(`Category ${p.categorySlug} not found`);

    const product = await prisma.product.create({
      data: {
        slug: p.slug,
        title: p.title,
        description: p.description,
        shortDescription: p.description.slice(0, 100) + '...',
        categoryId,
        basePrice: p.basePrice,
        compareAtPrice: p.compareAtPrice,
        gender: 'MEN',
        animeSeries: p.animeSeries,
        tags: p.tags,
        material: p.material,
        isActive: true,
        isFeatured: p.isFeatured,
        metaTitle: p.title,
        metaDescription: p.description.slice(0, 155),
        images: {
          create: [
            {
              url: placeholderImage(`${p.animeSeries}+FRONT`),
              publicId: `zojo/${p.slug}-front`,
              alt: `${p.title} — front`,
              sortOrder: 0,
              isPrimary: true,
            },
            {
              url: placeholderImage(`${p.animeSeries}+BACK`, 'F5F5F5', '0A0A0A'),
              publicId: `zojo/${p.slug}-back`,
              alt: `${p.title} — back`,
              sortOrder: 1,
              isPrimary: false,
            },
          ],
        },
        variants: {
          create: SIZES.flatMap((size, si) =>
            COLORS.map((color, ci) => ({
              sku: `ZJ-${p.slug.toUpperCase().slice(0, 6)}-${color.name.toUpperCase().slice(0, 3)}-${size}`,
              size,
              color: color.name,
              colorHex: color.hex,
              price: p.basePrice,
              stock: si === 0 && ci === 1 ? 0 : si === 4 ? 3 : 50, // S/Charcoal OOS, XXL low stock
              printroveVariantId: `pv_${p.slug}_${size}_${color.name}`.toLowerCase(),
              isActive: true,
            })),
          ),
        },
      },
    });

    // Link to collection
    const colId = collectionMap.get(p.animeSeries);
    if (colId) {
      await prisma.collectionProduct.create({
        data: { collectionId: colId, productId: product.id, sortOrder: 0 },
      });
    }

    console.log(`  Product: ${p.title} (${SIZES.length * COLORS.length} variants)`);
  }

  // 5. Homepage banners
  console.log('[5/6] Creating banners...');
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

  // 6. Create address for test user
  console.log('[6/6] Creating test address...');
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
