import { Suspense } from 'react';
import { ProductGridSkeleton } from '@/components/product/ProductGrid';
import { PageTransition } from '@/components/motion/PageTransition';

interface SearchParams {
  category?: string;
  anime?: string;
  size?: string;
  color?: string;
  sort?: string;
  page?: string;
}

export default function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">Shop</p>
          <h1 className="font-display text-4xl tracking-tight text-fg-primary">
            {searchParams.anime ?? searchParams.category ?? 'All Products'}
          </h1>
        </header>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* Filter rail — hidden on mobile; replaced by drawer in full impl */}
          <aside className="hidden lg:block">
            <div className="rounded-xl border border-bg-border bg-bg-elevated p-4 text-sm text-fg-secondary">
              Filters (coming soon — component stub)
            </div>
          </aside>

          <Suspense fallback={<ProductGridSkeleton count={12} />}>
            {/* Server-fetch products here. Stub until /apps/api has seeded data. */}
            <ProductGridSkeleton count={12} />
          </Suspense>
        </div>
      </div>
    </PageTransition>
  );
}
