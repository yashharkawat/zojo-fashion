'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageTransition } from '@/components/motion/PageTransition';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/features/auth/api';
import { listAddresses, type SavedAddressRow } from '@/features/addresses/api';
import { listMyOrders } from '@/features/orders/api';
import { inr, formatDate } from '@/lib/format';
import { ApiClientError } from '@/types/api';
import { cn } from '@/lib/cn';

// ── helpers ──────────────────────────────────────────────

const isDataUrl = (s: string | null | undefined): boolean => !!s && s.startsWith('data:');

function statusLabel(s: string): string {
  return s
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

// ── Address card ─────────────────────────────────────────

function AddressCard({ a }: { a: SavedAddressRow }) {
  return (
    <li className="rounded-xl border border-bg-border bg-bg-elevated p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-fg-primary">{a.fullName}</p>
          <p className="text-sm text-fg-secondary">{a.phone}</p>
        </div>
        {a.isDefault && (
          <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            Default
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-fg-secondary">
        {a.line1}
        {a.line2 ? <>, {a.line2}</> : null}
        {a.landmark ? <>, {a.landmark}</> : null}
        <br />
        {a.city}, {a.state} {a.pincode}
      </p>
    </li>
  );
}

// ── Orders tab ───────────────────────────────────────────

function OrdersTab() {
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
    <div className="space-y-4">
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
          <button type="button" onClick={() => void refetch()} className="ml-2 font-semibold underline">
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

// ── About (account info) tab ─────────────────────────────

function AboutTab() {
  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
  });
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => listAddresses(),
  });

  const meErr = me.isError
    ? me.error instanceof ApiClientError
      ? me.error.message
      : 'Could not load profile'
    : null;
  const addrErr = addresses.isError
    ? addresses.error instanceof ApiClientError
      ? addresses.error.message
      : 'Could not load addresses'
    : null;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-lg tracking-wide text-fg-primary">Account</h2>
        {me.isLoading && <Skeleton className="h-28 w-full rounded-xl" />}
        {meErr && (
          <p className="text-sm text-danger" role="alert">
            {meErr}
          </p>
        )}
        {me.data && (
          <div className="rounded-xl border border-bg-border bg-bg-elevated p-5 text-sm">
            <dl className="space-y-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-fg-muted">Name</dt>
                <dd className="text-fg-primary">
                  {[me.data.firstName, me.data.lastName].filter(Boolean).join(' ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-fg-muted">Email</dt>
                <dd className="text-fg-primary">{me.data.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-fg-muted">Phone</dt>
                <dd className="text-fg-primary">{me.data.phone ?? '—'}</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-bg-border pt-4 text-xs text-fg-muted">
              To change your password, use{' '}
              <Link href="/password-reset" className="text-accent hover:underline">
                email reset
              </Link>{' '}
              with the address above.
            </p>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-lg tracking-wide text-fg-primary">Addresses</h2>
          <Link href="/checkout" className="text-sm font-semibold text-accent hover:underline">
            Use checkout to add
          </Link>
        </div>
        {addresses.isLoading && <Skeleton className="h-32 w-full rounded-xl" />}
        {addrErr && (
          <p className="text-sm text-danger" role="alert">
            {addrErr}
          </p>
        )}
        {addresses.data && addresses.data.length === 0 && (
          <p className="rounded-xl border border-dashed border-bg-border bg-bg-elevated/50 px-4 py-6 text-sm text-fg-secondary">
            No saved addresses yet. Add one during{' '}
            <Link href="/checkout" className="text-accent hover:underline">
              checkout
            </Link>
            .
          </p>
        )}
        {addresses.data && addresses.data.length > 0 && (
          <ul className="space-y-3">
            {addresses.data.map((a) => (
              <AddressCard key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Tabbed profile ───────────────────────────────────────

type Tab = 'orders' | 'about';

function ProfileContent() {
  const [activeTab, setActiveTab] = useState<Tab>('orders');

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl tracking-tight text-fg-primary">Profile</h1>
      </header>

      {/* Tab strip */}
      <div className="mb-8 flex border-b border-bg-border">
        {(['orders', 'about'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'relative px-5 pb-3 pt-1 font-display text-sm tracking-[0.18em] uppercase transition-colors',
              activeTab === tab
                ? 'text-fg-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent'
                : 'text-fg-secondary hover:text-fg-primary',
            )}
          >
            {tab === 'orders' ? 'Orders' : 'About'}
          </button>
        ))}
      </div>

      {activeTab === 'orders' ? <OrdersTab /> : <AboutTab />}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <PageTransition>
      <RequireAuth>
        <ProfileContent />
      </RequireAuth>
    </PageTransition>
  );
}
