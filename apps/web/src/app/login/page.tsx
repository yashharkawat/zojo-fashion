'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { PageTransition } from '@/components/motion/PageTransition';
import { EmailPasswordForm } from '@/components/auth/EmailPasswordForm';
import { PhoneOtpForm } from '@/components/auth/PhoneOtpForm';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';

type Tab = 'otp' | 'email';

function LoginInner() {
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [tab, setTab] = useState<Tab>('otp');

  return (
    <div className="mx-auto max-w-md px-4 py-10 md:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Access</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-fg-primary">Welcome back</h1>
      <p className="mt-2 text-sm text-fg-secondary">Log in to pick up where you left off.</p>

      <div
        role="tablist"
        aria-label="Login method"
        className="my-6 grid grid-cols-2 gap-1 rounded-lg border border-bg-border bg-bg-overlay p-1"
      >
        {(['otp', 'email'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-all',
              tab === t
                ? 'bg-accent text-white shadow-glow-sm'
                : 'text-fg-secondary hover:text-fg-primary',
            )}
          >
            {t === 'otp' ? 'Phone OTP' : 'Email'}
          </button>
        ))}
      </div>

      {tab === 'otp' ? <PhoneOtpForm defaultNext={next} /> : <EmailPasswordForm defaultNext={next} />}

      <p className="mt-6 text-center text-sm text-fg-secondary">
        New to Zojo?{' '}
        <Link
          href={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-semibold text-accent hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PageTransition>
      <Suspense
        fallback={
          <div className="mx-auto max-w-md space-y-3 px-4 py-10">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-80 w-full" />
          </div>
        }
      >
        <LoginInner />
      </Suspense>
    </PageTransition>
  );
}
