import { z } from 'zod';

export const productSlugParamSchema = z.object({
  slug: z.string().min(1),
});

export const reviewIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const createReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
});
