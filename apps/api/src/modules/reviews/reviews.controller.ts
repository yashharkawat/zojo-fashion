import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { NotFoundError, ConflictError, ForbiddenError } from '../../lib/errors';

export async function listReviewsHandler(req: Request, res: Response) {
  const { slug } = req.params as { slug: string };
  const page = Math.max(1, Number(req.query['page'] ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query['pageSize'] ?? 20)));

  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (!product) throw new NotFoundError('Product not found');

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.review.count({ where: { productId: product.id } }),
  ]);

  res.json({ data: reviews, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

export async function createReviewHandler(req: Request, res: Response) {
  const { slug } = req.params as { slug: string };
  const userId = req.auth!.userId;
  const { rating, title, body } = req.body as { rating: number; title?: string; body?: string };

  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (!product) throw new NotFoundError('Product not found');

  // Verify the user has actually bought this product (any non-pending order)
  const hasPurchased = await prisma.orderItem.findFirst({
    where: {
      variant: { productId: product.id },
      order: {
        userId,
        status: { in: ['CONFIRMED', 'PRINTING', 'SHIPPED', 'DELIVERED'] },
      },
    },
    select: { id: true },
  });
  if (!hasPurchased) throw new ForbiddenError('You can only review products you have purchased');

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId: product.id, userId } },
  });
  if (existing) throw new ConflictError('You have already reviewed this product');

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: { productId: product.id, userId, rating, title, body },
      select: { id: true, rating: true, title: true, body: true, createdAt: true },
    });

    // Recalculate avgRating and reviewCount
    const agg = await tx.review.aggregate({
      where: { productId: product.id },
      _avg: { rating: true },
      _count: true,
    });
    await tx.product.update({
      where: { id: product.id },
      data: {
        avgRating: agg._avg.rating ?? 0,
        reviewCount: agg._count,
      },
    });

    return created;
  });

  res.status(201).json({ data: review });
}

export async function deleteReviewHandler(req: Request, res: Response) {
  const { id } = req.params as { id: string };

  const review = await prisma.review.findUnique({ where: { id }, select: { id: true, productId: true } });
  if (!review) throw new NotFoundError('Review not found');

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id } });

    const agg = await tx.review.aggregate({
      where: { productId: review.productId },
      _avg: { rating: true },
      _count: true,
    });
    await tx.product.update({
      where: { id: review.productId },
      data: {
        avgRating: agg._count > 0 ? (agg._avg.rating ?? 0) : null,
        reviewCount: agg._count,
      },
    });
  });

  res.status(204).send();
}
