'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useUpdateOrderStatus, useRetryPrintrove, useSyncPrintrove } from '@/features/admin/hooks';
import { OrderStatusBadge, SyncStatusBadge } from '@/components/admin/StatusBadge';
import { inr, formatDate } from '@/lib/format';
import { useAppDispatch } from '@/store/hooks';
import { pushToast } from '@/store/slices/uiSlice';
import type { AdminOrder, OrderStatus } from '@/features/admin/types';

// Allowed admin transitions — mirrors server-side rules.
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PRINTING', 'CANCELLED', 'REFUNDED'],
  PRINTING:  ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED:   ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED:  [],
};

export default function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const dispatch = useAppDispatch();
  const orderQuery = useQuery({
    queryKey: ['admin', 'order', params.id],
    queryFn: () => api<AdminOrder>(`/admin/orders/${params.id}`),
  });

  const updateStatus = useUpdateOrderStatus();
  const retryPrintrove = useRetryPrintrove();
  const syncPrintrove = useSyncPrintrove();

  const [trackingCourier, setTrackingCourier] = useState('');
  const [trackingAwb, setTrackingAwb] = useState('');

  if (orderQuery.isLoading) {
    return <div className="skeleton h-96 w-full rounded-xl" aria-hidden />;
  }
  if (!orderQuery.data) {
    return <p className="text-danger">Order not found.</p>;
  }

  const order = orderQuery.data;
  const nextStatuses = ALLOWED[order.status];

  async function onStatusChange(next: OrderStatus) {
    if (next === 'SHIPPED' && (!trackingCourier.trim() || !trackingAwb.trim())) {
      dispatch(pushToast({ kind: 'warning', message: 'Add courier + AWB before marking shipped', duration: 3000 }));
      return;
    }
    try {
      await updateStatus.mutateAsync({
        id: order.id,
        status: next,
        trackingInfo:
          next === 'SHIPPED'
            ? { courier: trackingCourier.trim(), awb: trackingAwb.trim() }
            : undefined,
      });
      dispatch(pushToast({ kind: 'success', message: `Order → ${next}`, duration: 2500 }));
    } catch (err) {
      dispatch(pushToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed',
        duration: 4000,
      }));
    }
  }

  async function onRetry() {
    try {
      await retryPrintrove.mutateAsync(order.id);
      dispatch(pushToast({ kind: 'success', message: 'Printrove push queued', duration: 2500 }));
    } catch (err) {
      dispatch(pushToast({ kind: 'error', message: err instanceof Error ? err.message : 'Retry failed', duration: 4000 }));
    }
  }

  async function onSync() {
    try {
      const res = await syncPrintrove.mutateAsync(order.id);
      dispatch(pushToast({
        kind: 'info',
        message: res.changed ? `Updated: ${res.before} → ${res.after}` : 'Already in sync',
        duration: 3000,
      }));
    } catch (err) {
      dispatch(pushToast({ kind: 'error', message: err instanceof Error ? err.message : 'Sync failed', duration: 4000 }));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/orders" className="text-xs text-fg-secondary hover:text-accent">
            ← All orders
          </Link>
          <h1 className="font-display text-4xl tracking-tight text-fg-primary">
            {order.orderNumber}
          </h1>
          <p className="text-xs text-fg-muted">{formatDate(order.placedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status={order.status} />
          <SyncStatusBadge status={order.printroveSyncStatus} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div className="space-y-6">
          {/* Items */}
          <section className="rounded-xl border border-bg-border bg-bg-elevated">
            <header className="border-b border-bg-border px-5 py-4">
              <h2 className="font-display text-lg tracking-wide text-fg-primary">Items</h2>
            </header>
            <ul className="divide-y divide-bg-border">
              {order.items.map((item, idx) => (
                <li key={idx} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-fg-primary">{item.productTitle}</p>
                    <p className="text-xs text-fg-secondary">
                      {item.variantLabel} × {item.quantity}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Status controls */}
          <section className="rounded-xl border border-bg-border bg-bg-elevated p-5">
            <h2 className="mb-4 font-display text-lg tracking-wide text-fg-primary">
              Advance status
            </h2>
            {order.status === 'PRINTING' && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="Courier (Delhivery)"
                  value={trackingCourier}
                  onChange={(e) => setTrackingCourier(e.target.value)}
                  className="h-10 rounded-md border border-bg-border bg-bg-overlay px-3 text-sm text-fg-primary"
                />
                <input
                  placeholder="AWB number"
                  value={trackingAwb}
                  onChange={(e) => setTrackingAwb(e.target.value)}
                  className="h-10 rounded-md border border-bg-border bg-bg-overlay px-3 text-sm font-mono text-fg-primary"
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {nextStatuses.length === 0 ? (
                <p className="text-sm text-fg-muted">Terminal state — no further transitions.</p>
              ) : (
                nextStatuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onStatusChange(s)}
                    disabled={updateStatus.isPending}
                    className="rounded-md border border-bg-border bg-bg-overlay px-3 py-2 text-xs font-semibold uppercase tracking-widest text-fg-primary transition-all hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    → {s}
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Printrove controls */}
          <section className="rounded-xl border border-bg-border bg-bg-elevated p-5">
            <h2 className="mb-4 font-display text-lg tracking-wide text-fg-primary">
              Printrove fulfillment
            </h2>
            <div className="space-y-2 text-sm">
              <p>
                Retries: <strong className="font-mono text-fg-primary">{order.printroveRetryCount}</strong>
              </p>
              {order.shipment?.awbNumber && (
                <p>
                  AWB: <strong className="font-mono text-fg-primary">{order.shipment.awbNumber}</strong>{' '}
                  ({order.shipment.courier})
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRetry}
                disabled={retryPrintrove.isPending || order.printroveSyncStatus === 'SYNCED'}
                className="rounded-md border border-bg-border bg-bg-overlay px-3 py-2 text-xs font-semibold uppercase tracking-widest text-fg-primary hover:border-accent hover:text-accent disabled:opacity-50"
              >
                Retry push
              </button>
              <button
                type="button"
                onClick={onSync}
                disabled={syncPrintrove.isPending}
                className="rounded-md border border-bg-border bg-bg-overlay px-3 py-2 text-xs font-semibold uppercase tracking-widest text-fg-primary hover:border-accent hover:text-accent disabled:opacity-50"
              >
                Sync from Printrove
              </button>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-bg-border bg-bg-elevated p-5 text-sm">
            <h3 className="mb-3 font-display text-base tracking-wide text-fg-primary">Customer</h3>
            <p className="text-fg-primary">{order.user.firstName} {order.user.lastName}</p>
            <p className="text-fg-secondary">{order.user.email}</p>
            {order.user.phone && <p className="text-fg-secondary">{order.user.phone}</p>}
          </div>

          <div className="rounded-xl border border-bg-border bg-bg-elevated p-5 text-sm">
            <h3 className="mb-3 font-display text-base tracking-wide text-fg-primary">Summary</h3>
            <dl className="space-y-1.5">
              <Row label="Subtotal" value={inr(order.subtotal)} />
              <Row label="Total" value={inr(order.total)} strong />
            </dl>
            {order.payment?.razorpayPaymentId && (
              <p className="mt-3 text-[10px] font-mono text-fg-muted">
                {order.payment.razorpayPaymentId}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-fg-secondary">{label}</dt>
      <dd className={`font-mono ${strong ? 'font-bold text-fg-primary' : 'text-fg-primary'}`}>{value}</dd>
    </div>
  );
}
