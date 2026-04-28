import type { FlipProductCardData } from '@/components/home/FlipProductCard';
import type { ProductCardData } from '@/components/product/ProductCard';
import type { ProductDetail, ProductImage, ProductVariant } from '@/types/product';

/** Aligned with `list()` in `apps/api/src/modules/products/products.service.ts` */
export type ApiListProduct = {
  id: string;
  slug: string;
  title: string;
  basePrice: number;
  compareAtPrice: number | null;
  animeSeries: string | null;
  primaryImage: { url: string; alt: string | null } | null;
  secondImage: { url: string; alt: string | null } | null;
  avgRating: number | null;
  reviewCount: number;
  defaultVariantId: string | null;
  defaultVariantLabel: string | null;
};

type ApiListEnvelope = {
  data: ApiListProduct[] | null;
  error: unknown;
};

type ApiOneEnvelope = {
  data: unknown;
  error: unknown;
};

function toProductDetail(raw: Record<string, unknown>): ProductDetail | null {
  if (typeof raw.id !== 'string' || typeof raw.slug !== 'string' || typeof raw.title !== 'string') return null;
  if (typeof raw.categorySlug !== 'string') return null;
  const imgs = raw.images;
  if (!Array.isArray(imgs)) return null;
  const images: ProductImage[] = imgs
    .map((i) => {
      const o = i as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.url !== 'string') return null;
      return {
        id: o.id,
        url: o.url,
        alt: o.alt == null || typeof o.alt === 'string' ? (o.alt as string | null) : null,
        width: o.width == null || typeof o.width === 'number' ? (o.width as number | null) : null,
        height: o.height == null || typeof o.height === 'number' ? (o.height as number | null) : null,
        sortOrder: typeof o.sortOrder === 'number' ? o.sortOrder : 0,
        isPrimary: o.isPrimary === true || o.isPrimary === false ? o.isPrimary : false,
        variantColor:
          o.variantColor == null || typeof o.variantColor === 'string' ? (o.variantColor as string | null) : null,
      };
    })
    .filter((x): x is ProductImage => x != null);
  const vars = raw.variants;
  if (!Array.isArray(vars)) return null;
  const variants: ProductVariant[] = vars
    .map((v) => {
      const o = v as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.sku !== 'string' || typeof o.size !== 'string' || typeof o.color !== 'string') return null;
      const price = o.price;
      if (typeof price !== 'number') return null;
      if (typeof o.stock !== 'number' || typeof o.isActive !== 'boolean') return null;
      return {
        id: o.id,
        sku: o.sku,
        size: o.size,
        color: o.color,
        colorHex: o.colorHex == null || typeof o.colorHex === 'string' ? (o.colorHex as string | null) : null,
        price,
        stock: o.stock,
        isActive: o.isActive,
      };
    })
    .filter((x): x is ProductVariant => x != null);
  const g = raw.gender;
  if (g !== 'MEN' && g !== 'WOMEN' && g !== 'UNISEX') return null;

  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    description: typeof raw.description === 'string' ? raw.description : '',
    shortDescription: raw.shortDescription == null || typeof raw.shortDescription === 'string' ? (raw.shortDescription as string | null) : null,
    categorySlug: raw.categorySlug,
    basePrice: typeof raw.basePrice === 'number' ? raw.basePrice : 0,
    compareAtPrice: raw.compareAtPrice == null || typeof raw.compareAtPrice === 'number' ? (raw.compareAtPrice as number | null) : null,
    gender: g,
    animeSeries: raw.animeSeries == null || typeof raw.animeSeries === 'string' ? (raw.animeSeries as string | null) : null,
    defaultColor:
      raw.defaultColor == null || typeof raw.defaultColor === 'string' ? (raw.defaultColor as string | null) : null,
    tags: Array.isArray(raw.tags) && raw.tags.every((t) => typeof t === 'string') ? (raw.tags as string[]) : [],
    material: raw.material == null || typeof raw.material === 'string' ? (raw.material as string | null) : null,
    careInstructions: raw.careInstructions == null || typeof raw.careInstructions === 'string' ? (raw.careInstructions as string | null) : null,
    sizeGuideUrl: raw.sizeGuideUrl == null || typeof raw.sizeGuideUrl === 'string' ? (raw.sizeGuideUrl as string | null) : null,
    sizeChart: (() => {
      const sc = raw.sizeChart as Record<string, unknown> | null | undefined;
      if (!sc || typeof sc !== 'object') return null;
      const rows = Array.isArray(sc.rows)
        ? (sc.rows as Record<string, unknown>[]).map((r) => ({
            id: String(r.id ?? ''),
            size: String(r.size ?? ''),
            chest: String(r.chest ?? ''),
            length: String(r.length ?? ''),
            sleeve: String(r.sleeve ?? ''),
            sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
          }))
        : [];
      return { id: String(sc.id ?? ''), name: String(sc.name ?? ''), rows };
    })(),
    images,
    variants,
    avgRating: raw.avgRating == null || typeof raw.avgRating === 'number' ? (raw.avgRating as number | null) : null,
    reviewCount: typeof raw.reviewCount === 'number' ? raw.reviewCount : 0,
  };
}

export async function fetchProductDetailBySlug(slug: string): Promise<ProductDetail | null> {
  const base = getApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/products/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const body = (await res.json()) as ApiOneEnvelope;
    if (body.error || body.data == null) return null;
    return toProductDetail(body.data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function fetchRelatedForSlug(
  excludeSlug: string,
  animeSeries: string | null,
): Promise<FlipProductCardData[]> {
  if (!animeSeries) return [];
  const base = getApiBase();
  if (!base) return [];
  const p = new URLSearchParams();
  p.set('page', '1');
  p.set('pageSize', '6');
  p.set('anime', animeSeries);
  p.set('sort', '-soldCount');
  try {
    const res = await fetch(`${base}/products?${p.toString()}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const body = (await res.json()) as ApiListEnvelope;
    if (body.error || !body.data) return [];
    return body.data
      .filter((x) => x.slug !== excludeSlug && x.primaryImage)
      .slice(0, 4)
      .map((x) => toFlipProductData(x));
  } catch {
    return [];
  }
}

function getApiBase(): string | null {
  const b = process.env.NEXT_PUBLIC_API_BASE_URL;
  return b && b.length > 0 ? b : null;
}

function mapToProductCard(p: ApiListProduct): ProductCardData {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    basePrice: p.basePrice,
    compareAtPrice: p.compareAtPrice,
    animeSeries: p.animeSeries,
    primaryImage: p.primaryImage,
    avgRating: p.avgRating,
    reviewCount: p.reviewCount,
  };
}

export function toFlipProductData(p: ApiListProduct): FlipProductCardData {
  const front = p.primaryImage!;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    basePrice: p.basePrice,
    compareAtPrice: p.compareAtPrice,
    animeSeries: p.animeSeries,
    frontImage: { url: front.url, alt: front.alt },
    backImage: p.secondImage ? { url: p.secondImage.url, alt: p.secondImage.alt } : null,
    defaultVariantId: p.defaultVariantId,
    defaultVariantLabel: p.defaultVariantLabel,
  };
}

export async function fetchProductsForList(searchParams: Record<string, string | string[] | undefined>) {
  const base = getApiBase();
  if (!base) return { products: [] as ProductCardData[], hadError: true as const };

  const p = new URLSearchParams();
  p.set('page', typeof searchParams.page === 'string' ? searchParams.page : '1');
  p.set('pageSize', '24');
  if (typeof searchParams.sort === 'string' && searchParams.sort) p.set('sort', searchParams.sort);
  if (typeof searchParams.category === 'string' && searchParams.category) p.set('category', searchParams.category);
  if (typeof searchParams.anime === 'string' && searchParams.anime) p.set('anime', searchParams.anime);
  if (typeof searchParams.size === 'string' && searchParams.size) p.set('size', searchParams.size);
  if (typeof searchParams.color === 'string' && searchParams.color) p.set('color', searchParams.color);
  if (typeof searchParams.search === 'string' && searchParams.search) p.set('search', searchParams.search);

  try {
    const res = await fetch(`${base}/products?${p.toString()}`, { next: { revalidate: 60 } });
    if (!res.ok) return { products: [] as ProductCardData[], hadError: true as const };
    const body = (await res.json()) as ApiListEnvelope;
    if (body.error || !body.data) return { products: [] as ProductCardData[], hadError: true as const };
    return { products: body.data.map(mapToProductCard), hadError: false as const };
  } catch {
    return { products: [] as ProductCardData[], hadError: true as const };
  }
}

export async function fetchFeaturedDropsForHome() {
  const base = getApiBase();
  if (!base) return { products: [] as FlipProductCardData[], hadError: true as const };
  const p = new URLSearchParams();
  p.set('page', '1');
  p.set('pageSize', '8');
  p.set('sort', '-soldCount');
  try {
    const res = await fetch(`${base}/products?${p.toString()}`, { next: { revalidate: 60 } });
    if (!res.ok) return { products: [] as FlipProductCardData[], hadError: true as const };
    const body = (await res.json()) as ApiListEnvelope;
    if (body.error || !body.data) return { products: [] as FlipProductCardData[], hadError: true as const };
    const withImages = body.data.filter((x) => x.primaryImage);
    return {
      products: withImages.map((x) => toFlipProductData(x)),
      hadError: false as const,
    };
  } catch {
    return { products: [] as FlipProductCardData[], hadError: true as const };
  }
}

export function plpTitle(searchParams: Record<string, string | string[] | undefined>): string {
  const s = (k: string) => (typeof searchParams[k] === 'string' ? (searchParams[k] as string) : undefined);
  const search = s('search')?.trim();
  if (search) return `Search: ${search}`;
  const anime = s('anime');
  if (anime) return anime;
  const category = s('category');
  if (category) {
    return category
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return 'All products';
}
