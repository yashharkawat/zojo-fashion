'use client';

import { useState } from 'react';
import Link from 'next/link';

import { useAdminOrders } from '@/features/admin/hooks';
import type { AdminOrder, OrderStatus } from '@/features/admin/types';
import { DataTable, type ColumnDef } from '@/components/admin/DataTable';
import { OrderStatusBadge, SyncStatusBadge } from '@/components/admin/StatusBadge';
import { inr, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

const STATUS_FILTERS: Array<{ label: string; value: OrderStatus | null }> = [
  { label: 'All',       value: null },
  { label: 'Pending',   value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Printing',  value: 'PRINTING' },
  { label: 'Shipped',   value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Refunded',  value: 'REFUNDED' },
];

export default function AdminOrdersPage() {
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const query = useAdminOrders({
    status: status ?? undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const columns: ColumnDef<AdminOrder>[] = [
    {
      id: 'order',
      header: 'Order',
      cell: (r) => (
        <div className="flex flex-col">
          <Link href={`/admin/orders/${r.id}`} className="font-mono text-sm text-accent hover:underline">
            {r.orderNumber}
          </Link>
          <span className="text-xs text-fg-muted">{formatDate(r.placedAt)}</span>
        </div>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: (r) => (
        <div className="flex flex-col">
          <span className="truncate">
            {r.user.firstName ?? r.user.email.split('@')[0]}
          </span>
          <span className="truncate text-xs text-fg-muted">{r.user.email}</span>
        </div>
      ),
    },
    {
      id: 'items',
      header: 'Items',
      cell: (r) => (
        <span className="text-sm text-fg-secondary">
          {r.items.reduce((s, i) => s + i.quantity, 0)} × items
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => <OrderStatusBadge status={r.status} />,
    },
    {
      id: 'sync',
      header: 'Printrove',
      cell: (r) => <SyncStatusBadge status={r.printroveSyncStatus} />,
    },
    {
      id: 'payment',
      header: 'Payment',
      cell: (r) => (
        <span className="text-xs text-fg-secondary">
          {r.payment?.method ?? (r.payment?.status === 'CREATED' ? 'Pending' : '—')}
        </span>
      ),
    },
    {
      id: 'total',
      header: 'Total',
      align: 'right',
      cell: (r) => <span className="font-mono">{inr(r.total)}</span>,
    },
  ];

  const pagination = query.data?.pagination;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl tracking-tight text-fg-primary">Orders</h1>
        <p className="text-sm text-fg-secondary">
          {pagination
            ? `${pagination.total} ${pagination.total === 1 ? 'order' : 'orders'}${
                status ? ` in ${status.toLowerCase()}` : ''
              }`
            : 'Loading…'}
        </p>
      </header>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 overflow-x-auto">
        {STATUS_FILTERS.map((f) => {
          const active = status === f.value;
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-all',
                active
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-bg-border bg-bg-elevated text-fg-secondary hover:border-fg-muted hover:text-fg-primary',
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.data ?? []}
        getRowId={(r) => r.id}
        isLoading={query.isLoading || query.isPlaceholderData}
        emptyState="No orders match these filters."
      />

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-fg-secondary">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-bg-border bg-bg-elevated px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="rounded-md border border-bg-border bg-bg-elevated px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
