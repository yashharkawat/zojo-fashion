'use client';

import Link from 'next/link';
import { PageTransition } from '@/components/motion/PageTransition';

export default function WishlistPage() {
  // TODO: useQuery(['wishlist']) once auth is wired
  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl tracking-tight text-fg-primary">Wishlist</h1>
        <div className="rounded-xl border border-bg-border bg-bg-elevated p-8 text-center text-fg-secondary">
          Nothing saved yet. <Link href="/products" className="text-accent hover:underline">Browse products</Link>.
        </div>
      </div>
    </PageTransition>
  );
}
