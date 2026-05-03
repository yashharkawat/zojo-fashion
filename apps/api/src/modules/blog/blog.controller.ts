import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { NotFoundError, ConflictError } from '../../lib/errors';

const POST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImageUrl: true,
  tags: true,
  isPublished: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---- Public ----------------------------------------------------------------

export async function listPublishedHandler(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query['page'] ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query['pageSize'] ?? 12)));

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: POST_SELECT,
    }),
    prisma.blogPost.count({ where: { isPublished: true } }),
  ]);

  res.json({ data: posts, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

export async function getPublishedBySlugHandler(req: Request, res: Response) {
  const { slug } = req.params as { slug: string };
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    select: { ...POST_SELECT, content: true },
  });
  if (!post || !post.isPublished) throw new NotFoundError('Post not found');
  res.json({ data: post });
}

// ---- Admin -----------------------------------------------------------------

export async function adminListHandler(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query['page'] ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query['pageSize'] ?? 20)));

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: POST_SELECT,
    }),
    prisma.blogPost.count(),
  ]);

  res.json({ data: posts, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

export async function adminCreateHandler(req: Request, res: Response) {
  const { slug, title, excerpt, content, coverImageUrl, tags, isPublished, publishedAt } = req.body as {
    slug: string;
    title: string;
    excerpt?: string;
    content: string;
    coverImageUrl?: string;
    tags: string[];
    isPublished: boolean;
    publishedAt?: string;
  };

  const existing = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
  if (existing) throw new ConflictError('A post with this slug already exists');

  const post = await prisma.blogPost.create({
    data: {
      slug,
      title,
      excerpt,
      content,
      coverImageUrl,
      tags,
      isPublished,
      publishedAt: isPublished ? (publishedAt ? new Date(publishedAt) : new Date()) : null,
    },
    select: { ...POST_SELECT, content: true },
  });

  res.status(201).json({ data: post });
}

export async function adminUpdateHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const existing = await prisma.blogPost.findUnique({ where: { id }, select: { id: true, isPublished: true, publishedAt: true } });
  if (!existing) throw new NotFoundError('Post not found');

  const body = req.body as {
    slug?: string;
    title?: string;
    excerpt?: string;
    content?: string;
    coverImageUrl?: string;
    tags?: string[];
    isPublished?: boolean;
    publishedAt?: string;
  };

  // Set publishedAt when first publishing
  const publishedAt =
    body.isPublished && !existing.isPublished && !existing.publishedAt
      ? new Date()
      : body.publishedAt
        ? new Date(body.publishedAt)
        : undefined;

  const post = await prisma.blogPost.update({
    where: { id },
    data: { ...body, publishedAt },
    select: { ...POST_SELECT, content: true },
  });

  res.json({ data: post });
}

export async function adminDeleteHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const existing = await prisma.blogPost.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError('Post not found');
  await prisma.blogPost.delete({ where: { id } });
  res.status(204).send();
}
