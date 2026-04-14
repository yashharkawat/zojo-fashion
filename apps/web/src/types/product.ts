/**
 * Product types — mirror of the backend API response shape.
 * Keep aligned with `apps/api/src/modules/products/products.service.ts`.
 */

export type Gender = 'MEN' | 'WOMEN' | 'UNISEX';

export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  price: number;          // paise
  stock: number;
  isActive: boolean;
}

export interface ProductReviewSummary {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  isVerifiedPurchase: boolean;
  user: { firstName: string | null };
}

export interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string | null;
  category: { id: string; slug: string; name: string };
  basePrice: number;
  compareAtPrice: number | null;
  gender: Gender;
  animeSeries: string | null;
  tags: string[];
  material: string | null;
  careInstructions: string | null;
  sizeGuideUrl: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  reviews: ProductReviewSummary[];
  avgRating: number | null;
  reviewCount: number;
}

/** Unique sizes across all active variants, preserving canonical order. */
export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a as (typeof SIZE_ORDER)[number]);
    const ib = SIZE_ORDER.indexOf(b as (typeof SIZE_ORDER)[number]);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** Derive available sizes + colors from variants. */
export interface VariantMatrix {
  sizes: string[];
  colors: Array<{ name: string; hex: string | null }>;
  /** Quick lookup: key = `${size}__${color}` → variant */
  byKey: Map<string, ProductVariant>;
}

export function buildVariantMatrix(variants: ProductVariant[]): VariantMatrix {
  const active = variants.filter((v) => v.isActive);
  const sizes = sortSizes(Array.from(new Set(active.map((v) => v.size))));
  const colorMap = new Map<string, { name: string; hex: string | null }>();
  for (const v of active) {
    if (!colorMap.has(v.color)) colorMap.set(v.color, { name: v.color, hex: v.colorHex });
  }
  const byKey = new Map<string, ProductVariant>();
  for (const v of active) byKey.set(`${v.size}__${v.color}`, v);

  return { sizes, colors: Array.from(colorMap.values()), byKey };
}
