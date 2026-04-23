'use client';

import { useState, type FormEvent } from 'react';
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

const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Your name is required').max(50),
  email: z.string().email('Enter a valid email'),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Must be +91 + 10 digits'),
  password: z.string().min(8, 'Minimum 8 characters'),
  marketingOptIn: z.boolean().default(true),
});
type RegisterInput = z.infer<typeof registerSchema>;

export function RegisterForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();

  const [values, setValues] = useState<Partial<RegisterInput>>({
    marketingOptIn: true,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  async function finishSession(result: AuthResult, toastMessage: string) {
    dispatch(setAuth({ accessToken: result.accessToken, user: result.user }));
    await postLoginCartSync(dispatch, () => store.getState());
    dispatch(
      pushToast({
        kind: 'success',
        message: toastMessage,
        duration: 3500,
      }),
    );
    onSuccess?.();
    const next = searchParams.get('next') || '/';
    router.replace(decodeURIComponent(next));
  }

  const set = <K extends keyof RegisterInput>(k: K, v: RegisterInput[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      const flat: Partial<Record<keyof RegisterInput, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof RegisterInput | undefined;
        if (k) flat[k] = issue.message;
      }
      setErrors(flat);
      return;
    }

    setSubmitting(true);
    try {
      const { user, accessToken } = await authApi.register(parsed.data);
      await finishSession(
        { user, accessToken },
        'Welcome to Zojo! Check your email to verify.',
      );
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.code === 'CONFLICT'
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Registration failed';
      // Guess which field — phone duplicate or email duplicate
      if (msg.toLowerCase().includes('email')) setErrors({ email: msg });
      else if (msg.toLowerCase().includes('phone')) setErrors({ phone: msg });
      else setErrors({ password: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <GoogleAuthBlock
        mode="register"
        marketingOptIn={values.marketingOptIn ?? true}
        onAuthed={async (r) =>
          finishSession(r, "Welcome to Zojo! You're signed in with Google.")
        }
        onFailure={(m) =>
          dispatch(
            pushToast({ kind: 'error', message: m, duration: 5000 }),
          )
        }
      />

      {googleAuthEnabled() && (
        <div className="relative py-1" role="separator" aria-label="Or register with email">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-bg-border" />
          </div>
          <div className="relative flex justify-center text-[10px] font-mono uppercase tracking-[0.25em] text-fg-muted">
            <span className="bg-bg-base px-2">Or register with email</span>
          </div>
        </div>
      )}

    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input
        label="First name"
        autoComplete="given-name"
        value={values.firstName ?? ''}
        onChange={(e) => set('firstName', e.target.value)}
        error={errors.firstName}
        required
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={values.email ?? ''}
        onChange={(e) => set('email', e.target.value)}
        error={errors.email}
        required
      />
      <Input
        label="Phone"
        type="tel"
        autoComplete="tel"
        placeholder="+919876543210"
        value={values.phone ?? ''}
        onChange={(e) => set('phone', e.target.value.replace(/\s/g, ''))}
        error={errors.phone}
        hint="Format: +91 + 10 digits"
        required
      />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        value={values.password ?? ''}
        onChange={(e) => set('password', e.target.value)}
        error={errors.password}
        hint="Minimum 8 characters"
        required
      />
      <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-secondary">
        <input
          type="checkbox"
          checked={values.marketingOptIn ?? true}
          onChange={(e) => set('marketingOptIn', e.target.checked)}
          className="h-4 w-4 rounded border-bg-border bg-bg-elevated text-accent focus:ring-accent"
        />
        Send me early access to drops and friend-only discounts
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow disabled:opacity-60"
      >
        {submitting ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-center text-xs text-fg-muted">
        By continuing you agree to the Terms & Privacy policy.
      </p>
    </form>
    </div>
  );
}
