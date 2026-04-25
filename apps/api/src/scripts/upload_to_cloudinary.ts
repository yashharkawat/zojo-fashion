/**
 * Upload all front.webp / back.webp catalog images to Cloudinary and
 * update ProductImage URLs in the database to use the CDN URLs.
 *
 * Prerequisites:
 *   npm install cloudinary          (in apps/api)
 *   Set in apps/api/.env:
 *     CLOUDINARY_CLOUD_NAME=your_cloud_name
 *     CLOUDINARY_API_KEY=your_api_key
 *     CLOUDINARY_API_SECRET=your_api_secret
 *
 * Run (dry-run first):
 *   cd apps/api && npm run upload:cloudinary -- --dry-run
 *   cd apps/api && npm run upload:cloudinary
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

loadEnv({ path: resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

const MOCKUP_ROOT = resolve(__dirname, '../../../../images-mockups-webp');
const DRY_RUN = process.argv.includes('--dry-run');

// The Cloudinary SDK reads CLOUDINARY_URL automatically when passed `true`.
// Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
// Falls back to individual CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET vars.
if (process.env.CLOUDINARY_URL) {
  cloudinary.config(true); // reads CLOUDINARY_URL natively
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// ─── Upload one file, return CDN URL ─────────────────────────────────────────

async function uploadFile(localPath: string, publicId: string): Promise<string> {
  if (DRY_RUN) {
    console.log(`  [dry-run] would upload: ${localPath} → ${publicId}`);
    return `https://res.cloudinary.com/${cloudinary.config().cloud_name}/image/upload/zojo-catalog/${publicId}.webp`;
  }

  const result = await cloudinary.uploader.upload(localPath, {
    public_id: `zojo-catalog/${publicId}`,
    folder: '',
    overwrite: false,
    resource_type: 'image',
    format: 'webp',
    quality: 'auto:good',
    // Serve from Cloudinary CDN; Next.js <Image> can use this directly.
  });

  return result.secure_url;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('[dry-run mode — no uploads, no DB writes]\n');

  const cfg = cloudinary.config();
  if (!cfg.cloud_name) {
    console.error(
      'Missing Cloudinary credentials in apps/api/.env.\n\n' +
      'Option A — paste the combined URL from your Cloudinary dashboard:\n' +
      '  CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME\n\n' +
      'Option B — set individually:\n' +
      '  CLOUDINARY_CLOUD_NAME=...\n' +
      '  CLOUDINARY_API_KEY=...\n' +
      '  CLOUDINARY_API_SECRET=...\n\n' +
      'Find these at: https://cloudinary.com/console/credentials\n',
    );
    process.exit(1);
  }
  console.log(`Using cloud: ${cfg.cloud_name}`);

  // Collect all (folder, color, face) combos by scanning disk
  const productFolders = fs
    .readdirSync(MOCKUP_ROOT)
    .filter((f) => fs.statSync(path.join(MOCKUP_ROOT, f)).isDirectory());

  let totalUploaded = 0;
  let totalSkipped = 0;
  const urlMap = new Map<string, string>(); // localUrl → cdnUrl

  for (const folder of productFolders) {
    const folderPath = path.join(MOCKUP_ROOT, folder);
    const colorDirs = fs
      .readdirSync(folderPath)
      .filter((d) => fs.statSync(path.join(folderPath, d)).isDirectory());

    for (const colorSlug of colorDirs) {
      for (const face of ['front', 'back'] as const) {
        const filePath = path.join(folderPath, colorSlug, `${face}.webp`);
        if (!fs.existsSync(filePath)) continue;

        const publicId = `${folder}/${colorSlug}/${face}`;
        const localUrl = `/catalog/${folder}/${colorSlug}/${face}.webp`;

        try {
          const cdnUrl = await uploadFile(filePath, publicId);
          urlMap.set(localUrl, cdnUrl);
          totalUploaded++;
          if (!DRY_RUN) console.log(`  ✓ ${folder}/${colorSlug}/${face}.webp`);
        } catch (err: unknown) {
          // Cloudinary returns 420 if the asset already exists with overwrite:false
          const alreadyExists =
            err instanceof Error && (
              err.message.includes('already exists') ||
              err.message.includes('420')
            );
          if (alreadyExists) {
            // Build the expected URL without re-uploading
            const expectedUrl = `https://res.cloudinary.com/${cloudinary.config().cloud_name}/image/upload/zojo-catalog/${publicId}.webp`;
            urlMap.set(localUrl, expectedUrl);
            totalSkipped++;
            console.log(`  – already exists: ${publicId}`);
          } else {
            console.error(`  ✗ ${publicId}:`, err);
          }
        }
      }
    }
  }

  console.log(`\n${totalUploaded} uploaded, ${totalSkipped} already existed.\n`);

  if (urlMap.size === 0) {
    console.log('Nothing to update in DB.');
    return;
  }

  // ── Bulk-update ProductImage URLs in DB ──
  console.log('Updating DB image URLs…');
  let dbUpdated = 0;

  if (!DRY_RUN) {
    // Fetch all images with local /catalog/ URLs
    const images = await prisma.productImage.findMany({
      where: { url: { startsWith: '/catalog/' } },
      select: { id: true, url: true },
    });

    for (const img of images) {
      const cdnUrl = urlMap.get(img.url);
      if (!cdnUrl) {
        console.warn(`  [warn] No CDN URL found for DB entry: ${img.url}`);
        continue;
      }
      await prisma.productImage.update({ where: { id: img.id }, data: { url: cdnUrl } });
      dbUpdated++;
    }
    console.log(`  Updated ${dbUpdated} ProductImage rows.`);
  } else {
    console.log(`  [dry-run] Would update ${urlMap.size} ProductImage rows.`);
  }

  console.log('\n✅ Done!');

  if (!DRY_RUN) {
    console.log('\nNext steps:');
    console.log('1. Add to apps/web/next.config.mjs (images.remotePatterns):');
    console.log(`   { hostname: 'res.cloudinary.com' }`);
    console.log('2. Remove the apps/web/public/catalog symlink (no longer needed in prod).');
    console.log('3. Deploy — images now load from Cloudinary CDN globally.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
