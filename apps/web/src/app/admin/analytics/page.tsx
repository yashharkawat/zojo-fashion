'use client';

import { useState } from 'react';
import { useAdminAnalytics } from '@/features/admin/hooks';
import { StatCard } from '@/components/admin/StatCard';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { TopProductsChart } from '@/components/admin/TopProductsChart';
import { CategoryPieChart } from '@/components/admin/CategoryPieChart';
import { inr } from '@/lib/format';
import { cn } from '@/lib/cn';

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

function isoNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const filter = { from: isoNDaysAgo(days), to: new Date().toISOString().slice(0, 10) };
  const analytics = useAdminAnalytics(filter);
  const a = analytics.data;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-fg-primary">Analytics</h1>
          <p className="text-sm text-fg-secondary">
            {filter.from} → {filter.to}
          </p>
        </div>
        <div role="tablist" aria-label="Range" className="inline-flex rounded-md border border-bg-border bg-bg-elevated p-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              role="tab"
              aria-selected={days === r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors',
                days === r.days ? 'bg-accent text-white' : 'text-fg-secondary hover:text-fg-primary',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Gross revenue"
          value={a ? inr(a.revenue.gross) : ''}
          loading={analytics.isLoading}
        />
        <StatCard
          label="Net revenue"
          value={a ? inr(a.revenue.net) : ''}
          loading={analytics.isLoading}
          helpText={a ? `${inr(a.revenue.refunds)} refunded` : undefined}
        />
        <StatCard
          label="Orders"
          value={a ? a.orders.paid : ''}
          loading={analytics.isLoading}
          helpText={a ? `${a.orders.cancelled} cancelled` : undefined}
        />
        <StatCard label="AOV" value={a ? inr(a.aov) : ''} loading={analytics.isLoading} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl tracking-wide text-fg-primary">Sales over time</h2>
        {analytics.isLoading ? (
          <div className="skeleton h-72 w-full rounded-xl" aria-hidden />
        ) : (
          <RevenueChart data={a?.daily ?? []} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wide text-fg-primary">Top selling products</h2>
          {analytics.isLoading ? (
            <div className="skeleton h-80 w-full rounded-xl" aria-hidden />
          ) : (
            <TopProductsChart data={a?.topProducts ?? []} />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wide text-fg-primary">Revenue by series</h2>
          {analytics.isLoading ? (
            <div className="skeleton h-72 w-full rounded-xl" aria-hidden />
          ) : (
            <CategoryPieChart
              data={(a?.topAnimeSeries ?? []).map((s) => ({ label: s.series, revenue: s.revenue }))}
            />
          )}
        </section>
      </div>
    </div>
  );
}
