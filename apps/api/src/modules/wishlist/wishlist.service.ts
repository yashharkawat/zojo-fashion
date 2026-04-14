import { prisma } from '../../config/prisma';
import { NotFoundError } from '../../lib/errors';

export async function getWishlist(userId: string) {
  const wl = await prisma.wishlist.findUnique({
    where: { userId },
    include: {
      items: {
        orderBy: { addedAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              title: true,
              basePrice: true,
              compareAtPrice: true,
              animeSeries: true,
              isActive: true,
              deletedAt: true,
              images: { where: { isPrimary: true }, take: 1, select: { url: true, alt: true } },
            },
          },
        },
      },
    },
  });
  if (!wl) return { items: [] };

  return {
    items: wl.items
      .filter((i) => i.product.isActive && !i.product.deletedAt)
      .map((i) => ({
        id: i.id,
        addedAt: i.addedAt,
        product: {
          id: i.product.id,
          slug: i.product.slug,
          title: i.product.title,
          basePrice: i.product.basePrice,
          compareAtPrice: i.product.compareAtPrice,
          animeSeries: i.product.animeSeries,
          primaryImage: i.product.images[0] ?? null,
        },
      })),
  };
}

export async function addItem(userId: string, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true, deletedAt: true },
  });
  if (!product || !product.isActive || product.deletedAt) {
    throw new NotFoundError('Product not found');
  }

  const wl = await prisma.wishlist.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  // Idempotent via unique [wishlistId, productId]
  const item = await prisma.wishlistItem.upsert({
    where: { wishlistId_productId: { wishlistId: wl.id, productId } },
    create: { wishlistId: wl.id, productId },
    update: {},
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          basePrice: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
      },
    },
  });

  return item;
}

export async function removeItem(userId: string, productId: string): Promise<void> {
  const wl = await prisma.wishlist.findUnique({ where: { userId }, select: { id: true } });
  if (!wl) throw new NotFoundError('Wishlist empty');
  const deleted = await prisma.wishlistItem.deleteMany({
    where: { wishlistId: wl.id, productId },
  });
  if (deleted.count === 0) throw new NotFoundError('Item not in wishlist');
}
