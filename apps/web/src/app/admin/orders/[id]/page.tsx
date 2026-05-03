'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useUpdateOrderStatus } from '@/features/admin/hooks';
import { OrderStatusBadge } from '@/components/admin/StatusBadge';
import { inr, formatDate } from '@/lib/format';
import { useAppDispatch } from '@/store/hooks';
import { pushToast } from '@/store/slices/uiSlice';
import { cn } from '@/lib/cn';
import type { AdminOrder, OrderStatus } from '@/features/admin/types';

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PRINTING', 'CANCELLED', 'REFUNDED'],
  PRINTING:  ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED:   ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED:  [],
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  CONFIRMED: 'bg-accent',
  PRINTING:  'bg-accent',
  SHIPPED:   'bg-accent',
  DELIVERED: 'bg-[#22c55e]',
  CANCELLED: 'bg-danger',
  REFUNDED:  'bg-fg-muted',
  PENDING:   'bg-warn',
};

export default function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const dispatch = useAppDispatch();
  const orderQuery = useQuery({
    queryKey: ['admin', 'order', params.id],
    queryFn: () => api<AdminOrder>(`/admin/orders/${params.id}`),
  });

  const updateStatus = useUpdateOrderStatus();

  const [trackingCourier, setTrackingCourier] = useState('');
  const [trackingAwb, setTrackingAwb] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [showTracking, setShowTracking] = useState(false);

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-bg-elevated" />)}
      </div>
    );
  }
  if (!orderQuery.data) return <p className="text-danger">Order not found.</p>;

  const order = orderQuery.data;
  const nextStatuses = ALLOWED[order.status];
  const needsTracking = order.status === 'PRINTING';

  async function onStatusChange(next: OrderStatus) {
    if (next === 'SHIPPED' && (!trackingCourier.trim() || !trackingAwb.trim())) {
      dispatch(pushToast({ kind: 'warning', message: 'Add courier + AWB before marking shipped', duration: 3000 }));
      setShowTracking(true);
      return;
    }
    try {
      await updateStatus.mutateAsync({
        id: order.id,
        status: next,
        trackingInfo:
          next === 'SHIPPED'
            ? { courier: trackingCourier.trim(), awb: trackingAwb.trim(), trackingUrl: trackingUrl.trim() || undefined }
            : undefined,
      });
      dispatch(pushToast({ kind: 'success', message: `Order → ${next}`, duration: 2500 }));
    } catch (err) {
      dispatch(pushToast({ kind: 'error', message: err instanceof Error ? err.message : 'Failed', duration: 4000 }));
    }
  }

  const addr = order.shippingAddressSnapshot as Record<string, string> | null;

  return (
    <>
      {/* ── Page content ── */}
      <div className="space-y-4 pb-4">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin/orders" className="text-xs text-fg-muted hover:text-accent">
              ← Orders
            </Link>
            <h1 className="font-display text-3xl tracking-tight text-fg-primary sm:text-4xl">
              {order.orderNumber}
            </h1>
            <p className="text-xs text-fg-muted">{formatDate(order.placedAt)}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </header>

        {/* Customer + summary — single row on mobile */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-bg-border bg-bg-elevated p-4 text-sm">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-fg-muted">Customer</p>
            <p className="font-medium text-fg-primary">{order.user.firstName} {order.user.lastName}</p>
            <p className="text-fg-secondary">{order.user.email}</p>
            {order.user.phone && (
              <a href={`tel:${order.user.phone}`} className="text-accent">
                {order.user.phone}
              </a>
            )}
          </div>
          <div className="rounded-xl border border-bg-border bg-bg-elevated p-4 text-sm">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-fg-muted">Order total</p>
            <p className="font-display text-2xl text-fg-primary">{inr(order.total)}</p>
            {order.payment?.razorpayPaymentId && (
              <p className="mt-1 font-mono text-[10px] text-fg-muted">{order.payment.razorpayPaymentId}</p>
            )}
          </div>
        </div>

        {/* Delivery address */}
        {addr && (
          <div className="rounded-xl border border-bg-border bg-bg-elevated p-4 text-sm">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-fg-muted">Ship to</p>
            <p className="text-fg-primary">{addr['fullName']}</p>
            <p className="text-fg-secondary">
              {[addr['line1'], addr['line2'], addr['landmark']].filter(Boolean).join(', ')}
            </p>
            <p className="text-fg-secondary">
              {[addr['city'], addr['state'], addr['pincode']].filter(Boolean).join(' — ')}
            </p>
            {addr['phone'] && (
              <a href={`tel:${addr['phone']}`} className="mt-0.5 block text-accent">
                {addr['phone']}
              </a>
            )}
          </div>
        )}

        {/* Items */}
        <div className="rounded-xl border border-bg-border bg-bg-elevated">
          <p className="border-b border-bg-border px-4 py-3 text-[10px] uppercase tracking-wider text-fg-muted">
            Items
          </p>
          <ul className="divide-y divide-bg-border">
            {order.items.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-fg-primary">{item.productTitle}</p>
                  <p className="text-xs text-fg-secondary">{item.variantLabel} × {item.quantity}</p>
                </div>
                {item.lineTotal != null && (
                  <span className="font-mono text-sm text-fg-primary">{inr(item.lineTotal)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Tracking fields (shown on PRINTING when user taps "Mark shipped") */}
        {needsTracking && (
          <div className={cn('rounded-xl border bg-bg-elevated p-4', showTracking ? 'border-accent' : 'border-bg-border')}>
            <p className="mb-3 text-[10px] uppercase tracking-wider text-fg-muted">
              Tracking info — required before marking shipped
            </p>
            <div className="space-y-2">
              <input
                placeholder="Courier (e.g. Quikink, Delhivery)"
                value={trackingCourier}
                onChange={(e) => setTrackingCourier(e.target.value)}
                className="h-11 w-full rounded-lg border border-bg-border bg-bg-base px-3 text-sm text-fg-primary focus:border-accent focus:outline-none"
              />
              <input
                placeholder="AWB / tracking number"
                value={trackingAwb}
                onChange={(e) => setTrackingAwb(e.target.value)}
                className="h-11 w-full rounded-lg border border-bg-border bg-bg-base px-3 font-mono text-sm text-fg-primary focus:border-accent focus:outline-none"
              />
              <input
                placeholder="Tracking URL (Quikink link)"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                className="h-11 w-full rounded-lg border border-bg-border bg-bg-base px-3 text-sm text-fg-primary focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Existing shipment info */}
        {order.shipment?.awbNumber && (
          <div className="rounded-xl border border-bg-border bg-bg-elevated p-4 text-sm">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-fg-muted">Shipment</p>
            <p className="font-medium text-fg-primary">
              {order.shipment.courier} — <span className="font-mono">{order.shipment.awbNumber}</span>
            </p>
            {order.shipment.trackingUrl && (
              <a
                href={order.shipment.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block break-all text-xs text-accent underline underline-offset-2"
              >
                {order.shipment.trackingUrl}
              </a>
            )}
          </div>
        )}

        {/* Desktop-only action buttons */}
        {nextStatuses.length > 0 && (
          <div className="hidden items-center gap-2 sm:flex">
            {nextStatuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { if (s === 'SHIPPED') setShowTracking(true); onStatusChange(s); }}
                disabled={updateStatus.isPending}
                className={cn(
                  'h-10 rounded-lg border px-5 text-sm font-semibold uppercase tracking-widest transition-all disabled:opacity-50',
                  s === 'CANCELLED' || s === 'REFUNDED'
                    ? 'border-danger/40 text-danger hover:bg-danger/10'
                    : 'border-accent/40 text-accent hover:bg-accent hover:text-white',
                )}
              >
                → {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile sticky action bar ── */}
      {nextStatuses.length > 0 && (
        <div className="fixed bottom-[57px] left-0 right-0 z-40 border-t border-bg-border bg-bg-base/95 p-3 backdrop-blur-md sm:hidden">
          <div className="flex gap-2">
            {nextStatuses.map((s) => {
              const isDestructive = s === 'CANCELLED' || s === 'REFUNDED';
              const color = STATUS_COLORS[s] ?? 'bg-accent';
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => { if (s === 'SHIPPED') setShowTracking(true); onStatusChange(s); }}
                  disabled={updateStatus.isPending}
                  className={cn(
                    'flex-1 rounded-xl py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-all disabled:opacity-50',
                    isDestructive ? 'bg-danger' : color,
                  )}
                >
                  {updateStatus.isPending ? '…' : `→ ${s}`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
