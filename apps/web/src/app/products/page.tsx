import { ProductGrid, ProductGridSkeleton } from '@/components/product/ProductGrid';
import { PageTransition } from '@/components/motion/PageTransition';
import { fetchProductsForList, plpTitle } from '@/lib/server-products';
import { Suspense } from 'react';

/** Next.js `searchParams` */
interface SearchParams {
  category?: string;
  anime?: string;
  size?: string;
  color?: string;
  sort?: string;
  page?: string;
  search?: string;
}

type Sp = Record<string, string | string[] | undefined>;

export default function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = searchParams as Sp;
  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-8 text-center sm:text-left">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">Shop</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-fg-primary sm:text-4xl">
            {plpTitle(sp)}
          </h1>
        </header>

        <Suspense fallback={<ProductGridSkeleton count={12} />}>
          <ProductListing searchParams={sp} />
        </Suspense>
      </div>
    </PageTransition>
  );
}

async function ProductListing({ searchParams }: { searchParams: Sp }) {
  const { products, hadError } = await fetchProductsForList(searchParams);

  if (hadError && products.length === 0) {
    return (
      <p className="rounded-xl border border-bg-border bg-bg-elevated p-6 text-center text-fg-secondary">
        Could not load products. Is the API running and <code className="text-fg-primary">NEXT_PUBLIC_API_BASE_URL</code>{' '}
        set?
      </p>
    );
  }

  if (!hadError && products.length === 0) {
    return (
      <p className="rounded-xl border border-bg-border bg-bg-elevated p-6 text-center text-fg-secondary">
        No products match this view. Try a different search or category.
      </p>
    );
  }

  return <ProductGrid products={products} />;
}
