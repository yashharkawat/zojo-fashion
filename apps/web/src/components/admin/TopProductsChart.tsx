'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { inrCompact } from '@/lib/format';

export interface TopProduct {
  title: string;
  revenue: number;
  unitsSold: number;
}

export function TopProductsChart({ data }: { data: TopProduct[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-bg-border bg-bg-elevated text-sm text-fg-secondary">
        No sales yet.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  return (
    <div className="h-80 w-full rounded-xl border border-bg-border bg-bg-elevated p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--bg-border))" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            stroke="rgb(var(--fg-muted))"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => inrCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="title"
            stroke="rgb(var(--fg-secondary))"
            tick={{ fontSize: 11 }}
            width={160}
          />
          <Tooltip
            contentStyle={{
              background: 'rgb(var(--bg-overlay))',
              border: '1px solid rgb(var(--bg-border))',
              borderRadius: 8,
              fontSize: 12,
              color: 'rgb(var(--fg-primary))',
            }}
            formatter={(value: number, name: string) =>
              name === 'revenue' ? [inrCompact(value), 'Revenue'] : [value, 'Units']
            }
          />
          <Bar dataKey="revenue" fill="#FF4500" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
