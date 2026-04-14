'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { PageTransition } from '@/components/motion/PageTransition';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppDispatch } from '@/store/hooks';
import { pushToast } from '@/store/slices/uiSlice';
import { authApi } from '@/features/auth/api';

function PasswordResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  // Two modes based on URL: no token → request; with token → confirm
  if (token) return <ConfirmStep token={token} onDone={() => router.replace('/login')} />;
  return <RequestStep onBack={() => router.back()} />;
}

function RequestStep({ onBack }: { onBack: () => void }) {
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authApi.requestPasswordReset({ email: email.trim().toLowerCase() });
      setSent(true);
      dispatch(pushToast({ kind: 'info', message: 'Check your inbox', duration: 3000 }));
    } catch {
      // Server always returns 200 anyway; nothing to surface
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 md:py-16 text-center">
        <h1 className="font-display text-3xl tracking-tight text-fg-primary">Check your email</h1>
        <p className="mt-4 text-fg-secondary">
          If an account exists for <strong className="text-fg-primary">{email}</strong>, you'll get a
          reset link within a minute.
        </p>
        <p className="mt-2 text-xs text-fg-muted">The link expires in 30 minutes.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 text-sm text-accent hover:underline"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 md:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Recover</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight text-fg-primary">
        Forgot password?
      </h1>
      <p className="mt-2 text-sm text-fg-secondary">
        Enter your email and we'll send a reset link.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm hover:bg-accent-hover hover:shadow-glow disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-fg-secondary">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}

function ConfirmStep({ token, onDone }: { token: string; onDone: () => void }) {
  const dispatch = useAppDispatch();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.confirmPasswordReset({ token, newPassword: password });
      dispatch(pushToast({
        kind: 'success',
        message: 'Password reset. Please log in again.',
        duration: 3000,
      }));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 md:py-16">
      <h1 className="font-display text-4xl tracking-tight text-fg-primary">Set a new password</h1>
      <p className="mt-2 text-sm text-fg-secondary">
        You'll be logged out from all devices after resetting.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Minimum 8 characters"
          required
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={error}
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm hover:bg-accent-hover hover:shadow-glow disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}

export default function PasswordResetPage() {
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
        <PasswordResetInner />
      </Suspense>
    </PageTransition>
  );
}
