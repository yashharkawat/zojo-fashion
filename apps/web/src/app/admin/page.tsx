'use client';

import Link from 'next/link';
import { useAdminAnalytics, useAdminOrders } from '@/features/admin/hooks';
import { StatCard } from '@/components/admin/StatCard';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { DataTable, type ColumnDef } from '@/components/admin/DataTable';
import { OrderStatusBadge } from '@/components/admin/StatusBadge';
import { inr } from '@/lib/format';
import type { AdminOrder } from '@/features/admin/types';

export default function AdminOverviewPage() {
  const analytics = useAdminAnalytics();
  const pendingOrders = useAdminOrders({ status: 'PENDING', pageSize: 5 });
  const failedOrders = useAdminOrders({ printroveSyncStatus: 'FAILED', pageSize: 5 });

  const a = analytics.data;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-fg-primary">Overview</h1>
          <p className="text-sm text-fg-secondary">Last 30 days</p>
        </div>
        <Link
          href="/admin/analytics"
          className="hidden rounded-md border border-bg-border bg-bg-elevated px-3 py-2 text-xs font-semibold uppercase tracking-widest text-fg-secondary hover:border-accent hover:text-accent md:inline-flex"
        >
          Full analytics →
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={a ? inr(a.revenue.net) : ''}
          loading={analytics.isLoading}
          helpText="Net of refunds"
        />
        <StatCard
          label="Orders paid"
          value={a ? a.orders.paid : ''}
          loading={analytics.isLoading}
          helpText={`${a?.orders.total ?? 0} placed`}
        />
        <StatCard label="AOV" value={a ? inr(a.aov) : ''} loading={analytics.isLoading} />
        <StatCard
          label="Pending payment"
          value={pendingOrders.data?.pagination.total ?? 0}
          loading={pendingOrders.isLoading}
          helpText="Awaiting payment"
        />
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl tracking-wide text-fg-primary">Revenue trend</h2>
        {analytics.isLoading ? (
          <div className="skeleton h-72 w-full rounded-xl" aria-hidden />
        ) : (
          <RevenueChart data={a?.daily ?? []} />
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <AttentionLane
          title="Pending payment"
          rows={pendingOrders.data?.data ?? []}
          isLoading={pendingOrders.isLoading}
        />
        <AttentionLane
          title="Printrove sync failed"
          rows={failedOrders.data?.data ?? []}
          isLoading={failedOrders.isLoading}
          emphasis
        />
      </section>
    </div>
  );
}

function AttentionLane({
  title,
  rows,
  isLoading,
  emphasis,
}: {
  title: string;
  rows: AdminOrder[];
  isLoading: boolean;
  emphasis?: boolean;
}) {
  const columns: ColumnDef<AdminOrder>[] = [
    {
      id: 'order',
      header: 'Order',
      cell: (r) => (
        <Link href={`/admin/orders/${r.id}`} className="font-mono text-accent hover:underline">
          {r.orderNumber}
        </Link>
      ),
    },
    { id: 'status', header: 'Status', cell: (r) => <OrderStatusBadge status={r.status} /> },
    {
      id: 'total',
      header: 'Total',
      align: 'right',
      cell: (r) => <span className="font-mono">{inr(r.total)}</span>,
    },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`font-display text-xl tracking-wide ${emphasis ? 'text-warn' : 'text-fg-primary'}`}>
          {title}
        </h2>
        {rows.length > 0 && (
          <span className="font-mono text-xs text-fg-muted">{rows.length} waiting</span>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyState={`No ${title.toLowerCase()}.`}
        skeletonRows={3}
      />
    </div>
  );
}
