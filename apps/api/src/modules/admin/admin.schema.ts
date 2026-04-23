import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

export const adminListOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
  userId: z.string().optional(),
  orderNumber: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const adminUpdateOrderStatusBodySchema = z.object({
  status: z.nativeEnum(OrderStatus),
  reason: z.string().max(500).optional(),
  trackingInfo: z
    .object({
      courier: z.string().max(50),
      awb: z.string().max(50),
      trackingUrl: z.string().url().optional(),
    })
    .optional(),
});

export const adminAnalyticsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const markManualReviewBodySchema = z.object({
  note: z.string().max(500).optional(),
});

export type MarkManualReviewBody = z.infer<typeof markManualReviewBodySchema>;

export const adminListProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  categorySlug: z.string().optional(),
  search: z.string().max(100).optional(),
});

export type AdminListOrdersQuery = z.infer<typeof adminListOrdersQuerySchema>;
export type AdminUpdateOrderStatusBody = z.infer<typeof adminUpdateOrderStatusBodySchema>;
export type AdminAnalyticsQuery = z.infer<typeof adminAnalyticsQuerySchema>;
export type AdminListProductsQuery = z.infer<typeof adminListProductsQuerySchema>;
