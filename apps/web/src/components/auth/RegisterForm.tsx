'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';

import { Input } from '@/components/ui/Input';
import { useAppDispatch } from '@/store/hooks';
import { pushToast } from '@/store/slices/uiSlice';
import { setAuth } from '@/store/slices/authSlice';
import { authApi } from '@/features/auth/api';
import { ApiClientError } from '@/types/api';

const TOKEN_KEY = 'zojo.auth.accessToken';

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

  const [values, setValues] = useState<Partial<RegisterInput>>({
    marketingOptIn: true,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);

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
      dispatch(setAuth({ accessToken, user }));
      try {
        window.localStorage.setItem(TOKEN_KEY, accessToken);
      } catch { /* ignore */ }
      dispatch(pushToast({
        kind: 'success',
        message: 'Welcome to Zojo! Check your email to verify.',
        duration: 3500,
      }));
      onSuccess?.();
      const next = searchParams.get('next') || '/';
      router.replace(decodeURIComponent(next));
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
  );
}
