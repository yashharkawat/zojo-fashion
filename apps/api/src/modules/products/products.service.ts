import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { NotFoundError } from '../../lib/errors';
import type { ListProductsQuery, CreateProductBody, UpdateProductBody } from './products.schema';

const CUID_RE = /^c[a-z0-9]{20,30}$/;

function buildWhere(q: ListProductsQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    deletedAt: null,
  };

  if (q.category) where.categorySlug = q.category;
  if (q.anime) where.animeSeries = q.anime;

  if (q.priceMin !== undefined || q.priceMax !== undefined) {
    where.basePrice = {};
    if (q.priceMin !== undefined) (where.basePrice as Prisma.IntFilter).gte = q.priceMin;
    if (q.priceMax !== undefined) (where.basePrice as Prisma.IntFilter).lte = q.priceMax;
  }

  if (q.size || q.color) {
    where.variants = {
      some: {
        isActive: true,
        deletedAt: null,
        ...(q.size ? { size: q.size } : {}),
        ...(q.color ? { color: q.color } : {}),
      },
    };
  }

  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { description: { contains: q.search, mode: 'insensitive' } },
      { tags: { has: q.search } },
    ];
  }

  return where;
}

function buildOrderBy(sort: ListProductsQuery['sort']): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case 'price': return { basePrice: 'asc' };
    case '-price': return { basePrice: 'desc' };
    case 'createdAt': return { createdAt: 'asc' };
    case '-soldCount': return { soldCount: 'desc' };
    case '-avgRating': return { avgRating: 'desc' };
    case '-createdAt':
    default: return { createdAt: 'desc' };
  }
}

export async function list(q: ListProductsQuery) {
  const where = buildWhere(q);
  const [total, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: buildOrderBy(q.sort),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          where: { isActive: true, deletedAt: null },
          orderBy: [{ size: 'asc' }, { color: 'asc' }],
          select: { id: true, size: true, color: true, colorHex: true, price: true },
        },
      },
    }),
  ]);

  const data = items.map((p) => {
    const firstV = p.variants[0];
    const displayColor = p.defaultColor?.trim() || firstV?.color;
    const anyScoped = p.images.some((i) => i.variantColor);
    const forCard = (() => {
      if (!anyScoped) {
        return [...p.images].sort((a, b) => a.sortOrder - b.sortOrder);
      }
      const m = p.images
        .filter(
          (img) =>
            img.variantColor == null ||
            (displayColor != null && img.variantColor === displayColor),
        )
        .sort((a, b) => a.sortOrder - b.sortOrder);
      if (m.length) return m;
      return [...p.images].sort((a, b) => a.sortOrder - b.sortOrder);
    })();
    /** Backs (first half) then fronts (second half) per product — for one color, front = higher `sortOrder`. */
    const p0 =
      forCard.length === 0
        ? undefined
        : forCard.length === 1
          ? forCard[0]
          : forCard.reduce((prev, im) => (im.sortOrder > prev.sortOrder ? im : prev), forCard[0]!);
    const p1 =
      forCard.length < 2
        ? forCard[1]
        : forCard.reduce((prev, im) => (im.sortOrder < prev.sortOrder ? im : prev), forCard[0]!);
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      basePrice: p.basePrice,
      compareAtPrice: p.compareAtPrice,
      animeSeries: p.animeSeries,
      gender: p.gender,
      primaryImage: p0 ? { url: p0.url, alt: p0.alt } : null,
      secondImage: p1 ? { url: p1.url, alt: p1.alt } : null,
      avgRating: p.avgRating,
      reviewCount: p.reviewCount,
      defaultVariantId: firstV?.id ?? null,
      defaultVariantLabel: firstV ? `${firstV.size} / ${firstV.color}` : null,
      availableSizes: Array.from(new Set(p.variants.map((v) => v.size))),
      availableColors: Array.from(
        new Map(p.variants.map((v) => [v.color, { name: v.color, hex: v.colorHex }])).values(),
      ),
    };
  });

  return {
    data,
    pagination: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    },
  };
}

export async function getByIdOrSlug(idOrSlug: string) {
  const where: Prisma.ProductWhereUniqueInput = CUID_RE.test(idOrSlug)
    ? { id: idOrSlug }
    : { slug: idOrSlug };

  const product = await prisma.product.findUnique({
    where,
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      variants: {
        where: { isActive: true, deletedAt: null },
        orderBy: [{ size: 'asc' }, { color: 'asc' }],
      },
    },
  });

  if (!product || !product.isActive || product.deletedAt) {
    throw new NotFoundError('Product not found');
  }
  return product;
}

export async function listByCategory(slug: string, q: ListProductsQuery) {
  return list({ ...q, category: slug });
}

export async function create(input: CreateProductBody) {
  return prisma.product.create({
    data: {
      slug: input.slug,
      title: input.title,
      description: input.description,
      shortDescription: input.shortDescription ?? null,
      categorySlug: input.categorySlug,
      basePrice: input.basePrice,
      compareAtPrice: input.compareAtPrice ?? null,
      gender: input.gender,
      animeSeries: input.animeSeries ?? null,
      tags: input.tags,
      material: input.material ?? null,
      careInstructions: input.careInstructions ?? null,
      sizeGuideUrl: input.sizeGuideUrl ?? null,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      isActive: input.isActive,
      isFeatured: input.isFeatured,
      variants: {
        create: input.variants.map((v) => ({
          sku: v.sku,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex ?? null,
          price: v.price,
          weightGrams: v.weightGrams ?? null,
        })),
      },
      images: {
        create: input.images.map((img) => ({
          url: img.url,
          publicId: img.publicId,
          alt: img.alt ?? null,
          width: img.width ?? null,
          height: img.height ?? null,
          sortOrder: img.sortOrder,
          isPrimary: img.isPrimary,
        })),
      },
    },
    include: { variants: true, images: true },
  });
}

/**
 * Full replace (PUT). Variants and images are replaced transactionally.
 * Variants are soft-disabled (isActive=false) rather than hard-deleted because
 * orders reference them.
 */
export async function update(id: string, input: UpdateProductBody) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Product not found');

    await tx.product.update({
      where: { id },
      data: {
        slug: input.slug,
        title: input.title,
        description: input.description,
        shortDescription: input.shortDescription ?? null,
        categorySlug: input.categorySlug,
        basePrice: input.basePrice,
        compareAtPrice: input.compareAtPrice ?? null,
        gender: input.gender,
        animeSeries: input.animeSeries ?? null,
        tags: input.tags,
        material: input.material ?? null,
        careInstructions: input.careInstructions ?? null,
        sizeGuideUrl: input.sizeGuideUrl ?? null,
        metaTitle: input.metaTitle ?? null,
        metaDescription: input.metaDescription ?? null,
        isActive: input.isActive,
        isFeatured: input.isFeatured,
      },
    });

    // Replace variants — deactivate existing SKUs not in new input; upsert by SKU.
    const incomingSkus = new Set(input.variants.map((v) => v.sku));
    await tx.productVariant.updateMany({
      where: { productId: id, sku: { notIn: Array.from(incomingSkus) } },
      data: { isActive: false },
    });
    for (const v of input.variants) {
      await tx.productVariant.upsert({
        where: { sku: v.sku },
        create: {
          productId: id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex ?? null,
          price: v.price,
          weightGrams: v.weightGrams ?? null,
        },
        update: {
          size: v.size,
          color: v.color,
          colorHex: v.colorHex ?? null,
          price: v.price,
          weightGrams: v.weightGrams ?? null,
          isActive: true,
          deletedAt: null,
        },
      });
    }

    // Replace images (hard-delete + create — no FK constraints from orders)
    await tx.productImage.deleteMany({ where: { productId: id } });
    await tx.productImage.createMany({
      data: input.images.map((img) => ({
        productId: id,
        url: img.url,
        publicId: img.publicId,
        alt: img.alt ?? null,
        width: img.width ?? null,
        height: img.height ?? null,
        sortOrder: img.sortOrder,
        isPrimary: img.isPrimary,
      })),
    });

    return tx.product.findUnique({
      where: { id },
      include: { variants: true, images: true },
    });
  });
}
