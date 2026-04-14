'use client';

import { inr } from '@/lib/format';
import { CheckoutButton } from './CheckoutButton';

export interface PaymentStepProps {
  orderId: string;
  orderNumber: string;
  totalPaise: number;
  accessToken: string;
  codAvailable?: boolean;
  customerEmail?: string;
}

/**
 * Wraps CheckoutButton with an order-aware header. CheckoutButton handles:
 *   - /payments/create (Razorpay or COD)
 *   - /payments/verify (HMAC)
 *   - Success + pending routing
 */
export function PaymentStep({
  orderId,
  orderNumber,
  totalPaise,
  accessToken,
  codAvailable = true,
  customerEmail,
}: PaymentStepProps) {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-xl border border-bg-border bg-bg-elevated p-6 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Order</p>
        <p className="mt-1 font-display text-3xl tracking-tight text-fg-primary">
          {orderNumber}
        </p>
        <p className="mt-4 text-sm text-fg-secondary">Amount due</p>
        <p className="font-mono text-4xl font-bold text-fg-primary">{inr(totalPaise)}</p>
        {customerEmail && (
          <p className="mt-3 text-xs text-fg-muted">
            Receipt will be emailed to <strong className="text-fg-secondary">{customerEmail}</strong>
          </p>
        )}
      </div>

      <CheckoutButton
        orderId={orderId}
        accessToken={accessToken}
        codAvailable={codAvailable && totalPaise <= 500_000}
      />

      <p className="flex items-center justify-center gap-2 text-xs text-fg-muted">
        <LockIcon className="h-3.5 w-3.5" />
        Secured by Razorpay · 256-bit encryption
      </p>
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path strokeLinecap="round" d="M8 11V7a4 4 0 118 0v4" />
    </svg>
  );
}
