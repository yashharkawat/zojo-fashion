'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

interface TrackingData {
  orderNumber: string;
  status: string;
  placedAt: string;
  shipment: {
    courier: string | null;
    awbNumber: string | null;
    status: string;
    shippedAt: string | null;
    estimatedDeliveryAt: string | null;
    deliveredAt: string | null;
  } | null;
}

const TIMELINE = ['CONFIRMED', 'PRINTING', 'SHIPPED', 'DELIVERED'] as const;

function timelineIndex(status: string): number {
  return TIMELINE.indexOf(status as (typeof TIMELINE)[number]);
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    PENDING: 'Awaiting payment',
    CONFIRMED: 'Confirmed',
    PRINTING: 'Printing',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    REFUNDED: 'Refunded',
  };
  return map[s] ?? s;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TrackOrderPage({ params }: { params: { orderNumber: string } }) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const orderNumber = decodeURIComponent(params.orderNumber);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

  useEffect(() => {
    fetch(`${apiBase}/track/${encodeURIComponent(orderNumber)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Order not found');
        return r.json() as Promise<{ data: TrackingData }>;
      })
      .then(({ data: d }) => setData(d))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load tracking info'),
      )
      .finally(() => setLoading(false));
  }, [apiBase, orderNumber]);

  const isTerminal = data && (data.status === 'CANCELLED' || data.status === 'REFUNDED');
  const activeIdx = data ? timelineIndex(data.status) : -1;
  const hasTrackingLink = !!data?.shipment?.awbNumber;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-fg-muted transition-colors hover:text-accent">
        ← Home
      </Link>

      <div className="mt-6">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Track Order</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-fg-primary">
          {orderNumber}
        </h1>
      </div>

      {loading && (
        <div className="mt-8 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-bg-elevated" />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-danger/40 bg-danger/10 px-5 py-4 text-sm text-danger">
          {error} — double-check your order number and try again, or{' '}
          <a href="mailto:zojo.fashion.tee@gmail.com" className="underline">
            contact support
          </a>
          .
        </div>
      )}

      {data && (
        <div className="mt-8 space-y-6">
          {/* Status badge */}
          <div className="rounded-xl border border-bg-border bg-bg-elevated px-5 py-4">
            <p className="text-xs text-fg-muted">Status</p>
            <p
              className={cn(
                'mt-1 font-display text-2xl',
                isTerminal ? 'text-fg-muted' : 'text-fg-primary',
              )}
            >
              {statusLabel(data.status)}
            </p>
            <p className="mt-0.5 text-xs text-fg-muted">Placed {formatDate(data.placedAt)}</p>
          </div>

          {/* Timeline */}
          {!isTerminal && data.status !== 'PENDING' && (
            <ol className="flex">
              {TIMELINE.map((label, i) => {
                const done = activeIdx >= i;
                return (
                  <li key={label} className="flex-1">
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className={cn(
                          'h-3 w-3 rounded-full',
                          done ? 'bg-accent shadow-glow-sm' : 'bg-bg-border',
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'text-center text-[10px] uppercase leading-tight',
                          done ? 'text-fg-primary' : 'text-fg-muted',
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {i < TIMELINE.length - 1 && (
                      <div
                        className={cn('-mt-4 mx-auto h-px w-full', done ? 'bg-accent' : 'bg-bg-border')}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {/* Shipment info */}
          {data.shipment && (
            <div className="rounded-xl border border-bg-border bg-bg-elevated px-5 py-4 text-sm">
              <h2 className="mb-3 font-display text-base tracking-wide text-fg-primary">
                Shipment
              </h2>
              <dl className="space-y-1.5 text-fg-secondary">
                {data.shipment.courier && (
                  <div className="flex justify-between">
                    <dt>Courier</dt>
                    <dd className="font-medium text-fg-primary">{data.shipment.courier}</dd>
                  </div>
                )}
                {data.shipment.awbNumber && (
                  <div className="flex justify-between">
                    <dt>AWB</dt>
                    <dd className="font-mono text-fg-primary">{data.shipment.awbNumber}</dd>
                  </div>
                )}
                {data.shipment.shippedAt && (
                  <div className="flex justify-between">
                    <dt>Shipped</dt>
                    <dd className="text-fg-primary">{formatDate(data.shipment.shippedAt)}</dd>
                  </div>
                )}
                {data.shipment.deliveredAt && (
                  <div className="flex justify-between">
                    <dt>Delivered</dt>
                    <dd className="text-fg-primary">{formatDate(data.shipment.deliveredAt)}</dd>
                  </div>
                )}
                {data.shipment.estimatedDeliveryAt && !data.shipment.deliveredAt && (
                  <div className="flex justify-between">
                    <dt>Est. delivery</dt>
                    <dd className="text-fg-primary">
                      {formatDate(data.shipment.estimatedDeliveryAt)}
                    </dd>
                  </div>
                )}
              </dl>

              {hasTrackingLink && (
                <a
                  href={`${apiBase}/track/${encodeURIComponent(orderNumber)}/redirect`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow"
                >
                  Track with courier →
                </a>
              )}
            </div>
          )}

          {!data.shipment && data.status !== 'CANCELLED' && data.status !== 'REFUNDED' && (
            <div className="rounded-xl border border-bg-border bg-bg-elevated px-5 py-4 text-sm text-fg-secondary">
              Your order is being prepared. You'll receive an email with live tracking once it ships.
            </div>
          )}

          <p className="text-center text-xs text-fg-muted">
            Questions?{' '}
            <a
              href="mailto:zojo.fashion.tee@gmail.com"
              className="text-accent underline underline-offset-2"
            >
              zojo.fashion.tee@gmail.com
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
