import Link from 'next/link';
import { PageTransition } from '@/components/motion/PageTransition';
import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import type { ProductDetail } from '@/types/product';
import type { FlipProductCardData } from '@/components/home/FlipProductCard';

// ──────────────────────────────────────────────────────────────
// TODO: replace with real server fetch once products are seeded
//
// import { notFound } from 'next/navigation';
// async function fetchProduct(slug: string): Promise<ProductDetail | null> {
//   const res = await fetch(`${API}/products/${slug}`, {
//     next: { revalidate: 60 },
//   });
//   if (res.status === 404) return null;
//   if (!res.ok) throw new Error('Product fetch failed');
//   const { data } = await res.json();
//   return data;
// }
//
// export async function generateMetadata({ params }): Promise<Metadata> {
//   const product = await fetchProduct(params.slug);
//   if (!product) return {};
//   return {
//     title: product.title,
//     description: product.shortDescription ?? product.description.slice(0, 150),
//     openGraph: { images: product.images.slice(0, 1).map(i => i.url) },
//   };
// }
// ──────────────────────────────────────────────────────────────

function demoProduct(slug: string): ProductDetail {
  const placeholder = (label: string, sort: number, isPrimary = false): ProductDetail['images'][number] => ({
    id: `img-${sort}`,
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800'><defs><radialGradient id='g' cx='50%' cy='30%'><stop offset='0%' stop-color='%23FF4500' stop-opacity='0.25'/><stop offset='100%' stop-color='%23141414'/></radialGradient></defs><rect width='100%' height='100%' fill='url(%23g)'/><text x='50%' y='50%' fill='%23FF4500' font-family='Impact,sans-serif' font-size='48' text-anchor='middle' dy='.35em' letter-spacing='4'>${label}</text></svg>`,
    )}`,
    alt: `Demo ${label}`,
    width: 800,
    height: 800,
    sortOrder: sort,
    isPrimary,
  });

  return {
    id: `demo-${slug}`,
    slug,
    title: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description:
      'Officially-inspired anime graphic tee. Printed on premium 240 GSM combed cotton for an all-day-soft wear. Drops from the Zojo vault — cut oversized, built to outlast the hype.',
    shortDescription: 'Premium 240 GSM anime graphic tee. Oversized fit.',
    category: { id: 'cat-tee', slug: 'oversized', name: 'Oversized' },
    basePrice: 89900,
    compareAtPrice: 119900,
    gender: 'MEN',
    animeSeries: 'Naruto',
    tags: ['oversized', 'anime', 'premium'],
    material: '100% combed cotton, 240 GSM bio-washed.',
    careInstructions: null,
    sizeGuideUrl: null,
    images: [
      placeholder('FRONT', 0, true),
      placeholder('BACK', 1),
      placeholder('DETAIL', 2),
      placeholder('MODEL', 3),
    ],
    variants: ['S', 'M', 'L', 'XL', 'XXL'].flatMap((size, si) =>
      [
        { color: 'Black', colorHex: '#000000' },
        { color: 'Ember', colorHex: '#FF4500' },
      ].map((c, ci) => ({
        id: `v-${size}-${c.color}`,
        sku: `ZJ-${slug.toUpperCase().slice(0, 3)}-${c.color.toUpperCase().slice(0, 3)}-${size}`,
        size,
        color: c.color,
        colorHex: c.colorHex,
        price: 0,
        // Vary stock to demo OOS badge
        stock: si === 0 && ci === 1 ? 0 : si === 4 ? 3 : 20,
        isActive: true,
      })),
    ),
    reviews: [],
    avgRating: 4.6,
    reviewCount: 42,
  };
}

function demoRelated(): FlipProductCardData[] {
  const mk = (title: string, series: string): FlipProductCardData => ({
    id: `rel-${title}`,
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    title,
    basePrice: 89900,
    compareAtPrice: 119900,
    animeSeries: series,
    frontImage: {
      url: `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800'><defs><radialGradient id='g' cx='50%' cy='30%'><stop offset='0%' stop-color='%23FF4500' stop-opacity='0.25'/><stop offset='100%' stop-color='%23141414'/></radialGradient></defs><rect width='100%' height='100%' fill='url(%23g)'/><text x='50%' y='50%' fill='%23FF4500' font-family='Impact,sans-serif' font-size='42' text-anchor='middle' dy='.35em' letter-spacing='4'>${series.toUpperCase()}</text></svg>`,
      )}`,
      alt: title,
    },
    backImage: null,
    defaultVariantId: `rel-v-${title}`,
    defaultVariantLabel: 'M / Black',
  });
  return [
    mk('Sage Mode Oversized', 'Naruto'),
    mk('Scout Regiment Hoodie', 'AOT'),
    mk('Straw Hat Crew Tee', 'One Piece'),
    mk('Demon Slayer Corps', 'Demon Slayer'),
  ];
}

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  // TODO: const product = await fetchProduct(params.slug);
  //       if (!product) notFound();
  const product = demoProduct(params.slug);
  const related = demoRelated();

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 pb-6 pt-4 md:pt-8">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-fg-secondary">
          <Link href="/" className="hover:text-fg-primary">Home</Link>
          <span className="text-fg-muted">/</span>
          <Link href="/products" className="hover:text-fg-primary">Shop</Link>
          <span className="text-fg-muted">/</span>
          <Link
            href={`/products?category=${product.category.slug}`}
            className="hover:text-fg-primary"
          >
            {product.category.name}
          </Link>
          <span className="text-fg-muted">/</span>
          <span className="truncate text-fg-primary">{product.title}</span>
        </nav>

        <ProductDetailClient product={product} />
      </div>

      <RelatedProducts products={related} />
    </PageTransition>
  );
}
