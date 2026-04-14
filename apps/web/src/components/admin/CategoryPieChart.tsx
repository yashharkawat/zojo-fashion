'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { inrCompact } from '@/lib/format';

export interface CategoryDatum {
  label: string;
  revenue: number;
}

const COLORS = ['#FF4500', '#FF6B35', '#FFB88C', '#EC4899', '#22D3EE', '#A855F7', '#10B981'];

export function CategoryPieChart({ data }: { data: CategoryDatum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-bg-border bg-bg-elevated text-sm text-fg-secondary">
        No category revenue yet.
      </div>
    );
  }

  return (
    <div className="h-72 w-full rounded-xl border border-bg-border bg-bg-elevated p-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="revenue"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={40}
            stroke="rgb(var(--bg-base))"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'rgb(var(--bg-overlay))',
              border: '1px solid rgb(var(--bg-border))',
              borderRadius: 8,
              fontSize: 12,
              color: 'rgb(var(--fg-primary))',
            }}
            formatter={(value: number) => inrCompact(value)}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
