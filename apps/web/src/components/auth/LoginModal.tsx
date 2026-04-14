'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { EmailPasswordForm } from './EmailPasswordForm';
import { PhoneOtpForm } from './PhoneOtpForm';
import { RegisterForm } from './RegisterForm';
import { cn } from '@/lib/cn';

type Tab = 'email' | 'otp';
type Mode = 'login' | 'register';

export interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: Tab;
}

export function LoginModal({ open, onClose, defaultTab = 'otp' }: LoginModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [tab, setTab] = useState<Tab>(defaultTab);

  return (
    <Modal
      open={open}
      onClose={onClose}
      widthClass="max-w-md"
      title={
        <span className="font-display text-3xl tracking-wide text-fg-primary">
          {mode === 'login' ? 'Welcome back' : 'Join ZOJO'}
        </span>
      }
    >
      {mode === 'login' ? (
        <>
          <div
            role="tablist"
            aria-label="Login method"
            className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-bg-border bg-bg-overlay p-1"
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

          {tab === 'otp' ? (
            <PhoneOtpForm onSuccess={onClose} />
          ) : (
            <EmailPasswordForm onSuccess={onClose} />
          )}

          <p className="mt-5 text-center text-sm text-fg-secondary">
            New to Zojo?{' '}
            <button
              type="button"
              onClick={() => setMode('register')}
              className="font-semibold text-accent hover:underline"
            >
              Create an account
            </button>
          </p>
        </>
      ) : (
        <>
          <RegisterForm onSuccess={onClose} />
          <p className="mt-5 text-center text-sm text-fg-secondary">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setMode('login')}
              className="font-semibold text-accent hover:underline"
            >
              Log in
            </button>
          </p>
        </>
      )}
    </Modal>
  );
}
