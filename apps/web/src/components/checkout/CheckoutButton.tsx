'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ApiClientError } from '@/types/api';
import type { CreatePaymentResponse, VerifyPaymentResponse } from '@/types/api';
import type { RazorpayFailure, RazorpayHandlerResponse } from '@/types/razorpay';
import { useRazorpayScript } from '@/hooks/useRazorpayScript';
import { useAppDispatch } from '@/store/hooks';
import { clearCart } from '@/store/slices/cartSlice';
import { clearServerCart } from '@/features/cart/api';
import { pushToast } from '@/store/slices/uiSlice';

export interface CheckoutButtonProps {
  orderId: string;
  accessToken: string;
  onBeforePay?: () => void;
  onSuccess?: (orderNumber: string) => void;
}

/**
 * Initiates prepaid checkout:
 *   - POST /payments/create (Razorpay)
 *   - Opens Razorpay modal
 *   - POST /payments/verify on handler callback
 * Webhook is the source of truth — if verify fails, we route to /pending.
 */
export function CheckoutButton({ orderId, accessToken, onBeforePay, onSuccess }: CheckoutButtonProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const scriptState = useRazorpayScript();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setError(null);
    setSubmitting(true);
    onBeforePay?.();

    try {
      const create = await api<CreatePaymentResponse>('/payments/create', {
        method: 'POST',
        token: accessToken,
        body: { orderId, method: 'RAZORPAY' },
      });

      if (scriptState !== 'ready') {
        throw new Error('Payment script still loading. Try again in a moment.');
      }
      if (!window.Razorpay) {
        throw new Error('Razorpay unavailable. Please refresh.');
      }

      const rz = new window.Razorpay({
        key: create.keyId,
        amount: create.amount,
        currency: 'INR',
        name: 'Zojo Fashion',
        description: `Order ${create.orderNumber}`,
        order_id: create.razorpayOrderId,
        image: '/logo.png',
        prefill: create.prefill,
        theme: { color: '#FF4500' },
        notes: { orderNumber: create.orderNumber },
        retry: { enabled: true, max_count: 1 },
        handler: async (resp: RazorpayHandlerResponse) => {
          try {
            await api<VerifyPaymentResponse>('/payments/verify', {
              method: 'POST',
              token: accessToken,
              body: resp,
            });
            dispatch(clearCart());
            void clearServerCart().catch(() => {});
            dispatch(pushToast({ kind: 'success', message: 'Payment successful', duration: 2500 }));
            onSuccess?.(create.orderNumber);
            router.push(`/orders/${create.orderNumber}/success`);
          } catch (err) {
            const msg = err instanceof ApiClientError ? err.message : 'Verification failed';
            setError(
              `Payment captured. Confirmation is pending (${msg}). We'll email you once confirmed.`,
            );
            dispatch(
              pushToast({ kind: 'warning', message: 'Payment captured, confirming…', duration: 5000 }),
            );
            router.push(`/orders/${create.orderNumber}/pending`);
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            setError('Payment cancelled. You can try again.');
          },
          confirm_close: true,
          escape: true,
        },
      });

      rz.on('payment.failed', (fail: RazorpayFailure) => {
        setSubmitting(false);
        setError(`Payment failed: ${fail.error.description} (${fail.error.reason || fail.error.code}).`);
        dispatch(pushToast({ kind: 'error', message: 'Payment failed', duration: 4000 }));
      });

      rz.open();
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.code === 'VALIDATION_ERROR'
            ? err.message
            : `Could not start payment: ${err.message}`
          : err instanceof Error
            ? err.message
            : 'Something went wrong';
      setError(msg);
      dispatch(pushToast({ kind: 'error', message: msg, duration: 4000 }));
      setSubmitting(false);
    }
  }

  const scriptLoading = scriptState === 'loading';
  const scriptError = scriptState === 'error';

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-bg-border bg-bg-elevated/80 p-3 text-sm text-fg-secondary">
        Prepaid only. Pay with UPI, card, net banking, or wallet through Razorpay.
      </p>

      <button
        type="button"
        onClick={pay}
        disabled={submitting || (scriptState !== 'ready' && !scriptLoading)}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Processing…' : scriptLoading ? 'Loading payment…' : scriptError ? 'Refresh — payment unavailable' : 'Pay now'}
      </button>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </div>
      )}
    </div>
  );
}
