import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { prisma } from '../../config/prisma';

/**
 * Public storefront config (footer socials, etc.).
 */
export async function getPublicHandler(_req: Request, res: Response) {
  const row = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
  if (!row) {
    return ok(res, {
      instagramUrl: 'https://www.instagram.com/100days.fashion',
      youtubeUrl: 'https://www.youtube.com/@yashharkawat6147',
      whatsappNumber: '918824362279',
    });
  }
  return ok(res, {
    instagramUrl: row.instagramUrl,
    youtubeUrl: row.youtubeUrl,
    whatsappNumber: row.whatsappNumber ?? '918824362279',
  });
}
