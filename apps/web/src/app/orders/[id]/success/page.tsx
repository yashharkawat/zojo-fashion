'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';

import { PageTransition } from '@/components/motion/PageTransition';
import { useAppDispatch } from '@/store/hooks';
import { pushToast } from '@/store/slices/uiSlice';

export default function OrderSuccessPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const method = searchParams.get('method');
  const dispatch = useAppDispatch();
  const reduce = useReducedMotion();

  useEffect(() => {
    // Email confirmation is triggered server-side on /payments/verify or webhook —
    // no client trigger needed. Surface a friendly toast to confirm receipt.
    dispatch(
      pushToast({
        kind: 'success',
        message: `Order ${params.id} confirmed. Check your email.`,
        duration: 3500,
      }),
    );
  }, [params.id, dispatch]);

  return (
    <PageTransition>
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 18 }}
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/15 text-accent shadow-glow"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5 9-11" />
          </svg>
        </motion.div>

        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Order confirmed</p>
        <h1 className="mt-2 font-display text-5xl tracking-tight text-fg-primary">
          Thank you!
        </h1>
        <p className="mt-4 max-w-md text-fg-secondary">
          Your order <strong className="font-mono text-fg-primary">{params.id}</strong> is in the
          queue.
          {method === 'cod'
            ? ' We\'ll reach out to confirm delivery. Please keep cash ready.'
            : ' Payment received — we\'ll start production right away.'}
        </p>

        <p className="mt-6 text-sm text-fg-muted">
          A confirmation email is on its way. Track progress anytime from your orders page.
        </p>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row">
          <Link
            href={`/orders/${params.id}`}
            className="flex h-12 items-center justify-center rounded-lg bg-accent px-6 font-semibold uppercase tracking-widest text-white shadow-glow-sm hover:bg-accent-hover hover:shadow-glow"
          >
            Track order
          </Link>
          <Link
            href="/products"
            className="flex h-12 items-center justify-center rounded-lg border border-bg-border bg-bg-elevated px-6 font-semibold uppercase tracking-widest text-fg-primary hover:border-accent hover:text-accent"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}
