import { z } from 'zod';

export const blogSlugParamSchema = z.object({
  slug: z.string().min(1),
});

export const blogIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const createBlogPostBodySchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  title: z.string().min(1).max(300),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  isPublished: z.boolean().default(false),
  publishedAt: z.string().datetime().optional(),
});

export const updateBlogPostBodySchema = createBlogPostBodySchema.partial();

export const listBlogPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
