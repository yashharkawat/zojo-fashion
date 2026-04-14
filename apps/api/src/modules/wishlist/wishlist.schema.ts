import { z } from 'zod';

export const addToWishlistBodySchema = z.object({
  productId: z.string().min(1),
});

export const removeFromWishlistParamSchema = z.object({
  productId: z.string().min(1),
});

export type AddToWishlistBody = z.infer<typeof addToWishlistBodySchema>;
