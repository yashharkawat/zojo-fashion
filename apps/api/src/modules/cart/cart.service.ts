import { prisma } from '../../config/prisma';
import { ValidationError } from '../../lib/errors';
import type { MergeCartBody, PutCartBody } from './cart.schema';

const MAX_LINES = 20;

type VariantForCart = Awaited<ReturnType<typeof loadVariantsForCart>>[number];

async function loadVariantsForCart(variantIds: string[]) {
  if (variantIds.length === 0) return [];
  return prisma.productVariant.findMany({
    where: {
      id: { in: variantIds },
      isActive: true,
      deletedAt: null,
      product: { isActive: true, deletedAt: null },
    },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          basePrice: true,
          images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        },
      },
    },
  });
}

function unitPricePaise(v: VariantForCart): number {
  return v.price > 0 ? v.price : v.product.basePrice;
}

function snapshots(v: VariantForCart) {
  const price = unitPricePaise(v);
  const imageUrl = v.product.images[0]?.url ?? null;
  return {
    priceSnapshot: price,
    titleSnapshot: v.product.title,
    imageSnapshot: imageUrl,
  };
}

function mapLine(row: {
  id: string;
  quantity: number;
  priceSnapshot: number;
  imageSnapshot: string | null;
  createdAt: Date;
  variant: {
    id: string;
    size: string;
    color: string;
    product: { id: string; slug: string; title: string };
  };
}) {
  return {
    id: row.id,
    variantId: row.variant.id,
    productId: row.variant.product.id,
    productTitle: row.variant.product.title,
    productSlug: row.variant.product.slug,
    variantLabel: `${row.variant.size} / ${row.variant.color}`,
    imageUrl: row.imageSnapshot,
    unitPricePaise: row.priceSnapshot,
    quantity: row.quantity,
    addedAt: row.createdAt.getTime(),
  };
}

export async function getCartAsJson(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, slug: true, title: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!cart) {
    return { items: [] as ReturnType<typeof mapLine>[], couponCode: null as string | null };
  }
  return {
    couponCode: cart.couponCode,
    items: cart.items.map(mapLine),
  };
}

function aggregateItems(items: PutCartBody['items']): { variantId: string; quantity: number }[] {
  const m = new Map<string, number>();
  for (const { variantId, quantity } of items) {
    m.set(variantId, Math.min(10, (m.get(variantId) ?? 0) + quantity));
  }
  return [...m.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
}

export async function putCart(userId: string, body: PutCartBody) {
  const lines = aggregateItems(body.items);
  if (lines.length > MAX_LINES) throw new ValidationError('Cart is limited to 20 line items');
  const variantIds = lines.map((l) => l.variantId);
  const variants = await loadVariantsForCart(variantIds);
  if (variants.length !== variantIds.length) {
    throw new ValidationError('One or more products are no longer available');
  }
  const byId = new Map(variants.map((v) => [v.id, v]));

  await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({
      where: { userId },
      create: { userId, couponCode: body.couponCode ?? null },
      update: { couponCode: body.couponCode ?? null },
    });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    for (const line of lines) {
      const v = byId.get(line.variantId);
      if (!v) throw new ValidationError('Invalid variant');
      const snap = snapshots(v);
      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: v.id,
          quantity: line.quantity,
          priceSnapshot: snap.priceSnapshot,
          titleSnapshot: snap.titleSnapshot,
          imageSnapshot: snap.imageSnapshot,
        },
      });
    }
  });
  return getCartAsJson(userId);
}

export async function mergeCart(userId: string, body: MergeCartBody) {
  const lines = aggregateItems(body.items);
  if (lines.length > MAX_LINES) throw new ValidationError('Cart is limited to 20 line items');
  const variantIds = lines.map((l) => l.variantId);
  const variants = await loadVariantsForCart(variantIds);
  if (variants.length !== variantIds.length) {
    throw new ValidationError('One or more products are no longer available');
  }
  const byId = new Map(variants.map((v) => [v.id, v]));

  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  for (const line of lines) {
    const v = byId.get(line.variantId);
    if (!v) continue;
    const snap = snapshots(v);
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: v.id } },
    });
    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: Math.min(10, existing.quantity + line.quantity),
          priceSnapshot: snap.priceSnapshot,
          titleSnapshot: snap.titleSnapshot,
          imageSnapshot: snap.imageSnapshot,
        },
      });
    } else {
      const count = await prisma.cartItem.count({ where: { cartId: cart.id } });
      if (count >= MAX_LINES) {
        throw new ValidationError('Cart is full (20 items max). Remove something to add more.');
      }
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: v.id,
          quantity: line.quantity,
          priceSnapshot: snap.priceSnapshot,
          titleSnapshot: snap.titleSnapshot,
          imageSnapshot: snap.imageSnapshot,
        },
      });
    }
  }
  return getCartAsJson(userId);
}

export async function clearCart(userId: string) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return;
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
    prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } }),
  ]);
}
