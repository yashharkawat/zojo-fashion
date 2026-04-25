'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { PageTransition } from '@/components/motion/PageTransition';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { listMyOrders } from '@/features/orders/api';
import { inr, formatDate } from '@/lib/format';
import { ApiClientError } from '@/types/api';

const isDataUrl = (s: string | null | undefined): boolean => !!s && s.startsWith('data:');

function statusLabel(s: string): string {
  return s
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function OrdersContent() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['orders', 'my'],
    queryFn: () => listMyOrders({ page: 1, pageSize: 30 }),
    enabled: isAuthenticated,
  });

  const errMsg = isError
    ? error instanceof ApiClientError
      ? error.message
      : 'Could not load orders'
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl tracking-tight text-fg-primary">My Orders</h1>

      {isLoading && (
        <div className="space-y-3" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {errMsg && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {errMsg}
          <button
            type="button"
            onClick={() => void refetch()}
            className="ml-2 inline-flex min-h-[44px] items-center font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !errMsg && data && data.data.length === 0 && (
        <div className="rounded-xl border border-bg-border bg-bg-elevated px-6 py-12 text-center">
          <p className="text-fg-secondary">You haven&apos;t placed an order yet.</p>
          <Link
            href="/products"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold uppercase tracking-widest text-white hover:bg-accent-hover"
          >
            Browse products
          </Link>
        </div>
      )}

      {!isLoading && !errMsg && data && data.data.length > 0 && (
        <ul className="space-y-3">
          {isFetching && !isLoading && (
            <li className="text-xs text-fg-muted">Refreshing…</li>
          )}
          {data.data.map((order) => {
            const first = order.items[0];
            return (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-bg-border bg-bg-elevated p-4 transition-colors hover:border-accent/50 sm:flex-row sm:items-center"
                >
                  {first?.imageUrl && (
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-bg-border">
                      <Image
                        src={first.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="64px"
                        unoptimized={isDataUrl(first.imageUrl)}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-accent">{order.orderNumber}</p>
                    <p className="mt-0.5 truncate text-fg-primary">
                      {order.items.length === 1
                        ? first?.productTitle
                        : `${order.items.length} items — ${first?.productTitle}…`}
                    </p>
                    <p className="mt-1 text-xs text-fg-muted">
                      {formatDate(order.placedAt)} · {statusLabel(order.status)}
                      {order.shipment?.awbNumber && ` · ${order.shipment.awbNumber}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <p className="font-mono text-lg font-semibold text-fg-primary">
                      {inr(order.total)}
                    </p>
                    <span className="text-xs font-semibold uppercase tracking-widest text-accent">
                      View
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <PageTransition>
      <RequireAuth>
        <OrdersContent />
      </RequireAuth>
    </PageTransition>
  );
}
