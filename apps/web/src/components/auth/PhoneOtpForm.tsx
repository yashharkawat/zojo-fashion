'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Input } from '@/components/ui/Input';
import { useAppDispatch } from '@/store/hooks';
import { pushToast } from '@/store/slices/uiSlice';
import { setAuth } from '@/store/slices/authSlice';
import { authApi } from '@/features/auth/api';
import { ApiClientError } from '@/types/api';

const TOKEN_KEY = 'zojo.auth.accessToken';
const PHONE_RE = /^\+91[6-9]\d{9}$/;

export interface PhoneOtpFormProps {
  onSuccess?: () => void;
  defaultNext?: string;
}

type Stage = 'enter-phone' | 'enter-code';

export function PhoneOtpForm({ onSuccess, defaultNext = '/' }: PhoneOtpFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  const [stage, setStage] = useState<Stage>('enter-phone');
  const [phone, setPhone] = useState('+91');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const codeInputRef = useRef<HTMLInputElement>(null);

  // Countdown for resend
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // Auto-focus code input on stage switch
  useEffect(() => {
    if (stage === 'enter-code') {
      setTimeout(() => codeInputRef.current?.focus(), 50);
    }
  }, [stage]);

  async function onSendOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!PHONE_RE.test(phone)) {
      setError('Enter phone as +91 followed by 10 digits');
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.otpSend({ phone });
      setResendIn(res.resendInSeconds);
      setStage('enter-code');
      dispatch(pushToast({ kind: 'info', message: `OTP sent to ${phone}`, duration: 2500 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('OTP must be 6 digits');
      return;
    }
    setSubmitting(true);
    try {
      const { user, accessToken, created } = await authApi.otpVerify({
        phone,
        code,
        firstName: firstName.trim() || undefined,
      });
      dispatch(setAuth({ accessToken, user }));
      try {
        window.localStorage.setItem(TOKEN_KEY, accessToken);
      } catch { /* ignore */ }
      dispatch(pushToast({
        kind: 'success',
        message: created ? `Welcome to Zojo, ${user.firstName ?? 'friend'}` : `Welcome back`,
        duration: 2500,
      }));
      onSuccess?.();
      const next = searchParams.get('next') || defaultNext;
      router.replace(decodeURIComponent(next));
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.status === 401
            ? err.message // surface "Incorrect OTP" / "OTP expired"
            : err.message
          : 'OTP verification failed';
      setError(msg);
      // If server says "Too many attempts", bounce back to phone entry
      if (msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('expired')) {
        setTimeout(() => {
          setStage('enter-phone');
          setCode('');
        }, 2500);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (resendIn > 0) return;
    setError(null);
    try {
      const res = await authApi.otpSend({ phone });
      setResendIn(res.resendInSeconds);
      dispatch(pushToast({ kind: 'info', message: 'OTP resent', duration: 2000 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resend failed');
    }
  }

  if (stage === 'enter-phone') {
    return (
      <form onSubmit={onSendOtp} noValidate className="space-y-4">
        <Input
          label="Phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+919876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\s/g, ''))}
          hint="We'll send a 6-digit OTP. Format: +91XXXXXXXXXX"
          error={error}
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send OTP'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onVerifyOtp} noValidate className="space-y-4">
      <p className="text-sm text-fg-secondary">
        OTP sent to <strong className="text-fg-primary">{phone}</strong>.{' '}
        <button
          type="button"
          onClick={() => setStage('enter-phone')}
          className="text-accent hover:underline"
        >
          Change
        </button>
      </p>
      <Input
        ref={codeInputRef}
        label="OTP"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        error={error}
        required
      />
      <Input
        label="Your name (new here? optional)"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="Rahul"
      />
      <button
        type="submit"
        disabled={submitting}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow disabled:opacity-60"
      >
        {submitting ? 'Verifying…' : 'Verify & continue'}
      </button>
      <div className="text-center text-xs text-fg-muted">
        {resendIn > 0 ? (
          <>Resend in {resendIn}s</>
        ) : (
          <button type="button" onClick={onResend} className="text-accent hover:underline">
            Resend OTP
          </button>
        )}
      </div>
    </form>
  );
}
