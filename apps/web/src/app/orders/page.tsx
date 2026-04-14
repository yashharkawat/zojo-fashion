'use client';

import { PageTransition } from '@/components/motion/PageTransition';
import { Skeleton } from '@/components/ui/Skeleton';

export default function OrdersPage() {
  // TODO: useQuery(['orders','my']) — requires auth
  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl tracking-tight text-fg-primary">My Orders</h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
