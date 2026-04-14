'use client';

import Link from 'next/link';
import { PageTransition } from '@/components/motion/PageTransition';

export default function OrderPendingPage({ params }: { params: { id: string } }) {
  return (
    <PageTransition>
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <div
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-warn/40 bg-warn/10 text-warn"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="h-10 w-10 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" d="M12 3a9 9 0 11-6.36 2.64" />
          </svg>
        </div>

        <p className="font-mono text-xs uppercase tracking-[0.3em] text-warn">Confirming</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-fg-primary">
          Your payment is being confirmed
        </h1>
        <p className="mt-4 max-w-md text-fg-secondary">
          We captured your payment but our final check hasn't come through yet. This usually
          resolves in under a minute. You'll receive an email once it's confirmed.
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          Order <strong className="font-mono text-fg-primary">{params.id}</strong>
        </p>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row">
          <Link
            href={`/orders/${params.id}`}
            className="flex h-12 items-center justify-center rounded-lg border border-bg-border bg-bg-elevated px-6 font-semibold uppercase tracking-widest text-fg-primary hover:border-accent hover:text-accent"
          >
            View order
          </Link>
          <a
            href="mailto:support@zojofashion.com"
            className="flex h-12 items-center justify-center rounded-lg bg-accent px-6 font-semibold uppercase tracking-widest text-white hover:bg-accent-hover"
          >
            Contact support
          </a>
        </div>
      </div>
    </PageTransition>
  );
}
