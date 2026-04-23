import { z } from 'zod';

export const cartLineInputSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
});

export const putCartBodySchema = z.object({
  items: z.array(cartLineInputSchema).max(20),
  couponCode: z.string().trim().max(30).nullable().optional(),
});

export const mergeCartBodySchema = z.object({
  items: z.array(cartLineInputSchema).min(1).max(20),
});

export type PutCartBody = z.infer<typeof putCartBodySchema>;
export type MergeCartBody = z.infer<typeof mergeCartBodySchema>;
