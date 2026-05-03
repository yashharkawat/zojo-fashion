'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { PageTransition } from '@/components/motion/PageTransition';

export default function TrackOrderPage() {
  const { isAuthenticated, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/orders');
    }
  }, [isAuthenticated, router]);

  if (status === 'idle' || status === 'authenticating') {
    return null;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-mono text-sm uppercase tracking-widest text-accent">Track Order</p>
        <h1 className="mt-3 font-display text-3xl tracking-tight text-fg-primary">
          Where&apos;s my order?
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-secondary">
          Order tracking is available in your account. Log in with the email you used at checkout
          to see live status, tracking numbers, and delivery updates.
        </p>
        <p className="mt-3 text-sm text-fg-secondary">
          You also receive tracking details by <strong className="text-fg-primary">email and SMS</strong>{' '}
          once your order is dispatched — check your inbox or messages app.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/login?next=/orders"
            className="flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow"
          >
            Log in to track
          </Link>
          <Link
            href="/register"
            className="flex h-12 w-full items-center justify-center rounded-lg border border-bg-border bg-bg-elevated text-sm font-semibold text-fg-primary transition-colors hover:border-accent hover:text-accent"
          >
            Create an account
          </Link>
        </div>

        <p className="mt-8 text-xs text-fg-muted">
          Need help?{' '}
          <a href="mailto:zojo.fashion.tee@gmail.com" className="text-accent underline underline-offset-2">
            zojo.fashion.tee@gmail.com
          </a>
        </p>
      </div>
    </PageTransition>
  );
}
