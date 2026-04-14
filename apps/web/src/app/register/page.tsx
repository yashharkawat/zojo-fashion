'use client';

import { Suspense } from 'react';
import Link from 'next/link';

import { PageTransition } from '@/components/motion/PageTransition';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Skeleton } from '@/components/ui/Skeleton';

function RegisterInner() {
  return (
    <div className="mx-auto max-w-md px-4 py-10 md:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Join ZOJO</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-fg-primary">Create account</h1>
      <p className="mt-2 text-sm text-fg-secondary">
        Early access to drops, order tracking, friend-only discounts.
      </p>

      <div className="mt-6">
        <RegisterForm />
      </div>

      <p className="mt-6 text-center text-sm text-fg-secondary">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
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
        <RegisterInner />
      </Suspense>
    </PageTransition>
  );
}
