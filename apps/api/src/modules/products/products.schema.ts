import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().trim().optional(),
  anime: z.string().trim().optional(),
  size: z.string().trim().optional(),
  color: z.string().trim().optional(),
  priceMin: z.coerce.number().int().nonnegative().optional(),
  priceMax: z.coerce.number().int().nonnegative().optional(),
  sort: z
    .enum(['-createdAt', 'createdAt', 'price', '-price', '-soldCount', '-avgRating'])
    .default('-createdAt'),
  search: z.string().trim().max(100).optional(),
});

export const productIdParamSchema = z.object({
  id: z.string().min(1),
});

export const categorySlugParamSchema = z.object({
  slug: z.string().min(1).max(100),
});

export const variantInputSchema = z.object({
  sku: z.string().min(1).max(64),
  size: z.string().min(1).max(10),
  color: z.string().min(1).max(30),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  price: z.number().int().positive(),
  weightGrams: z.number().int().positive().optional(),
});

export const imageInputSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1),
  alt: z.string().max(200).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  isPrimary: z.boolean().default(false),
});

export const createProductBodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'lowercase alphanumeric with hyphens'),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  shortDescription: z.string().max(300).optional(),
  categorySlug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'lowercase alphanumeric with hyphens')
    .min(1)
    .max(64),
  basePrice: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().optional(),
  gender: z.enum(['MEN', 'WOMEN', 'UNISEX']).default('MEN'),
  animeSeries: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(20).default([]),
  material: z.string().max(200).optional(),
  careInstructions: z.string().max(500).optional(),
  sizeGuideUrl: z.string().url().optional(),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  variants: z.array(variantInputSchema).min(1),
  images: z.array(imageInputSchema).min(1),
});

export const updateProductBodySchema = createProductBodySchema;

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateProductBody = z.infer<typeof createProductBodySchema>;
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
