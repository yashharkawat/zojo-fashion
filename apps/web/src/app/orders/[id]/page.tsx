'use client';

import { PageTransition } from '@/components/motion/PageTransition';

const STATUSES = ['CONFIRMED', 'PRINTING', 'SHIPPED', 'DELIVERED'] as const;

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  // TODO: useQuery(['order', params.id]) with refetchInterval 30s if SHIPPED
  const currentIdx = 1; // stub

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Order</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-fg-primary">
          {params.id}
        </h1>

        {/* Timeline */}
        <ol className="mt-8 flex">
          {STATUSES.map((status, i) => {
            const done = i <= currentIdx;
            return (
              <li key={status} className="flex-1">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${done ? 'bg-accent shadow-glow-sm' : 'bg-bg-border'}`}
                    aria-hidden
                  />
                  <span className={`text-xs ${done ? 'text-fg-primary' : 'text-fg-muted'}`}>
                    {status}
                  </span>
                </div>
                {i < STATUSES.length - 1 && (
                  <div className={`-mt-4 mx-auto h-px w-full ${done ? 'bg-accent' : 'bg-bg-border'}`} />
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-10 rounded-xl border border-bg-border bg-bg-elevated p-6 text-fg-secondary">
          Tracking details & items table — wire to <code className="text-fg-primary">/orders/{params.id}</code> once auth is in place.
        </div>
      </div>
    </PageTransition>
  );
}
