import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageTransition } from '@/components/motion/PageTransition';
import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { fetchProductDetailBySlug, fetchRelatedForSlug } from '@/lib/server-products';

function categoryLabelFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = await fetchProductDetailBySlug(params.slug);
  if (!product) notFound();
  const related = await fetchRelatedForSlug(params.slug, product.animeSeries);

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 pb-6 pt-4 md:pt-8">
        <nav aria-label="Breadcrumb" className="mb-6 flex min-w-0 flex-wrap items-center gap-1 text-xs text-fg-secondary">
          <Link href="/" className="shrink-0 hover:text-fg-primary">Home</Link>
          <span className="shrink-0 text-fg-muted">/</span>
          <Link href="/products" className="shrink-0 hover:text-fg-primary">Shop</Link>
          <span className="shrink-0 text-fg-muted">/</span>
          <Link
            href={`/products?category=${encodeURIComponent(product.categorySlug)}`}
            className="shrink-0 hover:text-fg-primary"
          >
            {categoryLabelFromSlug(product.categorySlug)}
          </Link>
          <span className="shrink-0 text-fg-muted">/</span>
          <span className="min-w-0 truncate text-fg-primary">{product.title}</span>
        </nav>

        <ProductDetailClient product={product} />
      </div>

      <RelatedProducts products={related} />
    </PageTransition>
  );
}
