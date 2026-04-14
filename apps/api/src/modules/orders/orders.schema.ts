import { z } from 'zod';

export const createOrderBodySchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(20),
  shippingAddressId: z.string().min(1),
  couponCode: z.string().trim().max(30).optional(),
  notes: z.string().max(500).optional(),
});

export const listMyOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const orderIdParamSchema = z.object({ id: z.string().min(1) });

export const cancelOrderBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type ListMyOrdersQuery = z.infer<typeof listMyOrdersQuerySchema>;
export type CancelOrderBody = z.infer<typeof cancelOrderBodySchema>;
