'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';

import { GoogleAuthBlock, googleAuthEnabled } from '@/components/auth/GoogleAuthBlock';
import { Input } from '@/components/ui/Input';
import { useStore } from 'react-redux';
import { useAppDispatch } from '@/store/hooks';
import { pushToast } from '@/store/slices/uiSlice';
import { setAuth } from '@/store/slices/authSlice';
import { postLoginCartSync } from '@/features/cart/postLoginSync';
import { authApi, type AuthResult } from '@/features/auth/api';
import type { RootState } from '@/store';
import { ApiClientError } from '@/types/api';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginInput = z.infer<typeof loginSchema>;

export interface EmailPasswordFormProps {
  onSuccess?: () => void;
  /** Where to route after login if no `next=` query param */
  defaultNext?: string;
}

export function EmailPasswordForm({ onSuccess, defaultNext = '/' }: EmailPasswordFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();

  const [values, setValues] = useState<Partial<LoginInput>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  async function afterGoogle(r: AuthResult) {
    dispatch(setAuth({ accessToken: r.accessToken, user: r.user }));
    await postLoginCartSync(dispatch, () => store.getState());
    dispatch(
      pushToast({
        kind: 'success',
        message: `Welcome back, ${r.user.firstName ?? 'friend'}`,
        duration: 2500,
      }),
    );
    onSuccess?.();
    const next = searchParams.get('next') || defaultNext;
    router.replace(decodeURIComponent(next));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      const flat: Partial<Record<keyof LoginInput, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof LoginInput | undefined;
        if (k) flat[k] = issue.message;
      }
      setErrors(flat);
      return;
    }

    setSubmitting(true);
    try {
      const { user, accessToken } = await authApi.login(parsed.data);
      dispatch(setAuth({ accessToken, user }));
      await postLoginCartSync(dispatch, () => store.getState());
      dispatch(pushToast({ kind: 'success', message: `Welcome back, ${user.firstName ?? 'friend'}`, duration: 2500 }));
      onSuccess?.();

      const next = searchParams.get('next') || defaultNext;
      router.replace(decodeURIComponent(next));
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.status === 401
          ? 'Invalid email or password'
          : err instanceof Error
          ? err.message
          : 'Login failed';
      setErrors({ password: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <GoogleAuthBlock
        mode="login"
        onAuthed={afterGoogle}
        onFailure={(m) =>
          dispatch(pushToast({ kind: 'error', message: m, duration: 5000 }))
        }
      />
      {googleAuthEnabled() && (
        <div className="relative py-1" role="separator" aria-label="Or sign in with email">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-bg-border" />
          </div>
          <div className="relative flex justify-center text-[10px] font-mono uppercase tracking-[0.25em] text-fg-muted">
            <span className="bg-bg-base px-2">Or with email</span>
          </div>
        </div>
      )}

    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={values.email ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
        error={errors.email}
        required
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        value={values.password ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
        error={errors.password}
        required
      />

      <div className="flex justify-end">
        <Link href="/password-reset" className="text-xs font-medium text-accent hover:underline">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow disabled:opacity-60"
      >
        {submitting ? 'Logging in…' : 'Log in'}
      </button>
    </form>
    </div>
  );
}
