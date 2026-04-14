'use client';

import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { inrCompact } from '@/lib/format';

export interface RevenueChartDatum {
  date: string;       // '2026-04-01'
  revenue: number;    // paise
  orders: number;
}

export function RevenueChart({ data }: { data: RevenueChartDatum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-bg-border bg-bg-elevated text-sm text-fg-secondary">
        Not enough data yet.
      </div>
    );
  }

  return (
    <div className="h-72 w-full rounded-xl border border-bg-border bg-bg-elevated p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF4500" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#FF4500" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgb(var(--bg-border))" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="rgb(var(--fg-muted))"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            stroke="rgb(var(--fg-muted))"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => inrCompact(v)}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: 'rgb(var(--bg-overlay))',
              border: '1px solid rgb(var(--bg-border))',
              borderRadius: 8,
              fontSize: 12,
              color: 'rgb(var(--fg-primary))',
            }}
            labelStyle={{ color: 'rgb(var(--fg-secondary))' }}
            formatter={(value: number, name: string) =>
              name === 'revenue' ? [inrCompact(value), 'Revenue'] : [value, 'Orders']
            }
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#FF4500"
            strokeWidth={2}
            fill="url(#rev)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
