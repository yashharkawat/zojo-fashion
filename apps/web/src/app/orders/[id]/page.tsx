'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageTransition } from '@/components/motion/PageTransition';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Skeleton } from '@/components/ui/Skeleton';
import { getMyOrder } from '@/features/orders/api';
import { inr, formatDate } from '@/lib/format';
import { ApiClientError } from '@/types/api';
import { cn } from '@/lib/cn';

const FULFILLMENT = ['CONFIRMED', 'PRINTING', 'SHIPPED', 'DELIVERED'] as const;

function timelineActiveIndex(status: string): number {
  if (status === 'PENDING') return -1;
  const i = FULFILLMENT.indexOf(status as (typeof FULFILLMENT)[number]);
  if (i >= 0) return i;
  return -1;
}

function addressLines(snapshot: Record<string, unknown>): string[] {
  const line1 = typeof snapshot.line1 === 'string' ? snapshot.line1 : '';
  const line2 = typeof snapshot.line2 === 'string' && snapshot.line2 ? snapshot.line2 : null;
  const city = typeof snapshot.city === 'string' ? snapshot.city : '';
  const state = typeof snapshot.state === 'string' ? snapshot.state : '';
  const pincode = typeof snapshot.pincode === 'string' ? snapshot.pincode : '';
  const name = typeof snapshot.fullName === 'string' ? snapshot.fullName : '';
  const block = [name, line1, line2, [city, state, pincode].filter(Boolean).join(', ')].filter(
    (x) => x && String(x).trim().length > 0,
  ) as string[];
  return block;
}

interface Shipment {
  courier: string | null;
  awbNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
}

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameError, setFrameError] = useState(false);

  return (
    <div className="mt-6 rounded-xl border border-bg-border bg-bg-elevated p-5">
      <h2 className="font-display text-lg tracking-wide text-fg-primary">Shipment</h2>
      <dl className="mt-3 space-y-1.5 text-sm text-fg-secondary">
        {shipment.courier && (
          <div className="flex justify-between">
            <dt>Courier</dt>
            <dd className="font-medium text-fg-primary">{shipment.courier}</dd>
          </div>
        )}
        {shipment.awbNumber && (
          <div className="flex justify-between">
            <dt>AWB</dt>
            <dd className="font-mono text-fg-primary">{shipment.awbNumber}</dd>
          </div>
        )}
        {shipment.estimatedDeliveryAt && !shipment.deliveredAt && (
          <div className="flex justify-between">
            <dt>Est. delivery</dt>
            <dd className="text-fg-primary">{formatDate(shipment.estimatedDeliveryAt)}</dd>
          </div>
        )}
      </dl>

      {shipment.trackingUrl && (
        <div className="mt-4">
          {!frameError ? (
            <div className="relative overflow-hidden rounded-lg border border-bg-border">
              {!frameLoaded && (
                <div className="flex h-64 items-center justify-center bg-bg-base">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-bg-border border-t-accent" />
                </div>
              )}
              <iframe
                src={shipment.trackingUrl}
                title="Live tracking"
                className={cn('w-full transition-opacity duration-300', frameLoaded ? 'opacity-100' : 'opacity-0')}
                style={{ height: frameLoaded ? '600px' : '0px' }}
                onLoad={() => setFrameLoaded(true)}
                onError={() => setFrameError(true)}
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          ) : (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow"
            >
              Track with courier →
            </a>
          )}
          {!frameError && frameLoaded && (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-center text-xs text-fg-muted hover:text-accent"
            >
              Open in new tab ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function OrderTrackBody({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getMyOrder(id),
  });

  const errMsg = isError
    ? error instanceof ApiClientError
      ? error.message
      : 'Could not load order'
    : null;

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-full max-w-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {errMsg}
        <button type="button" onClick={() => void refetch()} className="ml-2 font-semibold underline">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { status } = data;
  const isTerminal = status === 'CANCELLED' || status === 'REFUNDED';
  const activeIdx = timelineActiveIndex(status);

  const itemTitle = data.items.length === 1
    ? data.items[0].productTitle
    : data.items.map((i) => i.productTitle).join(', ');

  const STATUS_LABEL: Record<string, string> = {
    PENDING: 'Awaiting payment',
    CONFIRMED: 'Confirmed',
    PRINTING: 'Printing',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    REFUNDED: 'Refunded',
  };

  const STATUS_COLOR: Record<string, string> = {
    PENDING: 'bg-amber-500/15 text-amber-400',
    CONFIRMED: 'bg-accent/15 text-accent',
    PRINTING: 'bg-accent/15 text-accent',
    SHIPPED: 'bg-blue-500/15 text-blue-400',
    DELIVERED: 'bg-green-500/15 text-green-400',
    CANCELLED: 'bg-fg-muted/15 text-fg-muted',
    REFUNDED: 'bg-fg-muted/15 text-fg-muted',
  };

  return (
    <>
      <div className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-fg-muted">{data.orderNumber}</p>
            <h1 className="mt-1 font-display text-2xl tracking-tight text-fg-primary md:text-3xl">
              {itemTitle}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">Placed {formatDate(data.placedAt)}</p>
          </div>
          <span className={cn('mt-1 rounded-full px-3 py-1 text-sm font-semibold', STATUS_COLOR[status] ?? 'bg-accent/15 text-accent')}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
      </div>

      {isTerminal && (
        <div className={cn('mb-4 rounded-lg border px-4 py-3 text-sm', status === 'CANCELLED' ? 'border-fg-muted/30 text-fg-secondary' : 'border-accent/40 text-accent')}>
          {status === 'CANCELLED' ? 'This order was cancelled.' : 'This order was refunded.'}
        </div>
      )}

      {status === 'PENDING' && (
        <p className="mb-4 text-sm text-amber-400/90">
          Awaiting payment. Complete checkout — if you already paid, status updates in a few seconds.{' '}
          <Link href="/orders" className="underline">My orders</Link>
        </p>
      )}

      {/* Timeline — post-confirmation flow */}
      {!isTerminal && status !== 'PENDING' && (
        <ol className="mt-4 flex">
          {FULFILLMENT.map((label, i) => {
            const done = activeIdx >= i;
            return (
              <li key={label} className="flex-1">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={cn('h-3 w-3 rounded-full', done ? 'bg-accent shadow-glow-sm' : 'bg-bg-border')}
                    aria-hidden
                  />
                  <span className={cn('text-center text-[10px] uppercase leading-tight', done ? 'text-fg-primary' : 'text-fg-muted')}>
                    {label.replace('_', ' ')}
                  </span>
                </div>
                {i < FULFILLMENT.length - 1 && (
                  <div className={cn('-mt-4 mx-auto h-px w-full', done ? 'bg-accent' : 'bg-bg-border')} />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {data.shipment && data.shipment.awbNumber && (
        <ShipmentCard shipment={data.shipment} />
      )}

      <div className="mt-8 rounded-xl border border-bg-border bg-bg-elevated p-5">
        <h2 className="font-display text-lg tracking-wide text-fg-primary">Items</h2>
        <ul className="mt-4 divide-y divide-bg-border">
          {data.items.map((line) => (
            <li key={line.id} className="flex gap-4 py-4 first:pt-0">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-bg-border">
                {line.imageUrl ? (
                  <Image src={line.imageUrl} alt="" fill className="object-cover" unoptimized={line.imageUrl.startsWith('data:')} />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-fg-muted">No img</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg-primary">{line.productTitle}</p>
                <p className="text-sm text-fg-secondary">{line.variantLabel}</p>
                <p className="mt-1 font-mono text-sm text-fg-muted">
                  {line.quantity} × {inr(line.unitPrice)} = {inr(line.lineTotal)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 space-y-1 border-t border-bg-border pt-4 text-sm">
          <div className="flex justify-between text-fg-secondary">
            <span>Subtotal</span>
            <span className="font-mono">{inr(data.subtotal)}</span>
          </div>
          {data.discountAmount > 0 && (
            <div className="flex justify-between text-fg-secondary">
              <span>Discount{data.couponCode ? ` (${data.couponCode})` : ''}</span>
              <span className="font-mono">−{inr(data.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-fg-secondary">
            <span>Delivery</span>
            <span className="font-mono">{data.shippingFee === 0 ? '—' : inr(data.shippingFee)}</span>
          </div>
          <div className="flex justify-between border-t border-bg-border pt-2 font-semibold text-fg-primary">
            <span>Total</span>
            <span className="font-mono">{inr(data.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-bg-border bg-bg-elevated p-5">
        <h2 className="font-display text-lg tracking-wide text-fg-primary">Ship to</h2>
        <address className="mt-2 not-italic text-sm leading-relaxed text-fg-secondary">
          {addressLines(data.shippingAddressSnapshot).map((l, i) => (
            <span key={i} className="block">
              {l}
            </span>
          ))}
        </address>
      </div>

      {data.payment && (
        <p className="mt-4 text-xs text-fg-muted">
          Payment: {data.payment.status}
          {data.payment.razorpayPaymentId ? ` · ${data.payment.razorpayPaymentId}` : ''}
        </p>
      )}

      <div className="mt-6">
        <Link href="/orders" className="text-sm text-accent hover:underline">
          ← All orders
        </Link>
      </div>
    </>
  );
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  return (
    <PageTransition>
      <RequireAuth>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <OrderTrackBody id={params.id} />
        </div>
      </RequireAuth>
    </PageTransition>
  );
}
