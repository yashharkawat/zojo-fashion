import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  delta?: { value: number; direction: 'up' | 'down' | 'flat' };
  icon?: ReactNode;
  helpText?: string;
  loading?: boolean;
}

export function StatCard({ label, value, delta, icon, helpText, loading }: StatCardProps) {
  return (
    <div className="rounded-xl border border-bg-border bg-bg-elevated p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-fg-secondary">
          {label}
        </p>
        {icon && <span className="text-fg-muted">{icon}</span>}
      </div>
      <p
        className={cn(
          'mt-3 font-mono text-3xl font-bold text-fg-primary tabular-nums',
          loading && 'skeleton h-8 w-24 text-transparent',
        )}
      >
        {loading ? '' : value}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        {delta && !loading && (
          <span
            className={cn(
              'text-xs font-semibold',
              delta.direction === 'up' && 'text-success',
              delta.direction === 'down' && 'text-danger',
              delta.direction === 'flat' && 'text-fg-muted',
            )}
          >
            {delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '—'} {Math.abs(delta.value)}%
          </span>
        )}
        {helpText && <span className="text-xs text-fg-muted">{helpText}</span>}
      </div>
    </div>
  );
}
