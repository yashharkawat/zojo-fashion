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
  /** If set, this photo is for that colorway (matches `ProductVariant.color`). */
  variantColor: string | null;
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

export interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string | null;
  /** PLP filter slug (e.g. oversized, limited-edition) */
  categorySlug: string;
  basePrice: number;
  compareAtPrice: number | null;
  gender: Gender;
  animeSeries: string | null;
  /** When set, PLP and initial PDP color — must match variant + image `variantColor` */
  defaultColor: string | null;
  tags: string[];
  material: string | null;
  careInstructions: string | null;
  sizeGuideUrl: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
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
  return buildVariantMatrixForPdp(variants, null);
}

/** Swatch when a colorway exists only in images. */
const FALLBACK_HEX: Record<string, string> = {
  'Ice Blue': '#7eb6d9',
  'Off White': '#e8e4dc',
  Black: '#0a0a0a',
  Charcoal: '#3d3d3d',
  Navy: '#1a2744',
  Forest: '#2d4a3e',
  'Dusty Rose': '#c4a4a4',
};

/**
 * Merges colors from variants and from `ProductImage.variantColor` (so
 * `colors.length ≈ images/2` when every row is a front/back pair).
 */
export function buildVariantMatrixForPdp(
  variants: ProductVariant[],
  images: ProductImage[] | null,
): VariantMatrix {
  const active = variants.filter((v) => v.isActive);
  const sizes = sortSizes(Array.from(new Set(active.map((v) => v.size))));
  const colorMap = new Map<string, { name: string; hex: string | null }>();
  for (const v of active) {
    if (!colorMap.has(v.color)) colorMap.set(v.color, { name: v.color, hex: v.colorHex });
  }
  if (images) {
    for (const im of images) {
      const c = im.variantColor?.trim();
      if (!c || colorMap.has(c)) continue;
      colorMap.set(c, { name: c, hex: FALLBACK_HEX[c] ?? null });
    }
  }
  const byKey = new Map<string, ProductVariant>();
  for (const v of active) byKey.set(`${v.size}__${v.color}`, v);
  // Preserve catalog order: first seen in image `sortOrder` (so swatches follow mockups)
  const orderedNames: string[] = [];
  if (images) {
    for (const im of [...images].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const c = im.variantColor?.trim();
      if (c && !orderedNames.includes(c) && colorMap.has(c)) orderedNames.push(c);
    }
  }
  for (const c of colorMap.keys()) {
    if (!orderedNames.includes(c)) orderedNames.push(c);
  }
  const colors = orderedNames.map((n) => colorMap.get(n)!).filter(Boolean);
  return { sizes, colors, byKey };
}
