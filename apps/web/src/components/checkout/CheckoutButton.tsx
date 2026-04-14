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
import { pushToast } from '@/store/slices/uiSlice';

type Method = 'RAZORPAY' | 'COD';

export interface CheckoutButtonProps {
  orderId: string;
  accessToken: string;
  /** Disable COD if order is ineligible (amount > cap, unsupported pincode, etc.) */
  codAvailable?: boolean;
  onBeforePay?: () => void;
  onSuccess?: (orderNumber: string) => void;
}

/**
 * Payment initiator:
 *   - POST /payments/create (Razorpay or COD)
 *   - Opens Razorpay modal for online methods
 *   - POST /payments/verify on handler callback
 *   - Clears cart + toast + routes to success/pending
 * Webhook is the source of truth — if verify fails, we route to /pending.
 */
export function CheckoutButton({
  orderId,
  accessToken,
  codAvailable = true,
  onBeforePay,
  onSuccess,
}: CheckoutButtonProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const scriptState = useRazorpayScript();

  const [method, setMethod] = useState<Method>('RAZORPAY');
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
        body: { orderId, method },
      });

      // ─── COD ─────────────────────────────────────────
      if (create.method === 'COD') {
        dispatch(clearCart());
        dispatch(pushToast({ kind: 'success', message: 'Order placed (COD)', duration: 2500 }));
        onSuccess?.(create.orderNumber);
        router.push(`/orders/${create.orderNumber}/success?method=cod`);
        return;
      }

      // ─── Razorpay ────────────────────────────────────
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
        theme: { color: '#FF4500' }, // brand ember
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
            dispatch(pushToast({ kind: 'success', message: 'Payment successful', duration: 2500 }));
            onSuccess?.(create.orderNumber);
            router.push(`/orders/${create.orderNumber}/success`);
          } catch (err) {
            // Capture likely succeeded but our verify failed → webhook will reconcile.
            const msg = err instanceof ApiClientError ? err.message : 'Verification failed';
            setError(
              `Payment captured. Confirmation is pending (${msg}). We'll email you once confirmed.`,
            );
            dispatch(pushToast({
              kind: 'warning',
              message: 'Payment captured, confirming…',
              duration: 5000,
            }));
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
  const scriptError = scriptState === 'error' && method === 'RAZORPAY';

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2" disabled={submitting}>
        <legend className="mb-2 text-sm font-medium text-fg-primary">Payment method</legend>

        <MethodOption
          active={method === 'RAZORPAY'}
          onChoose={() => setMethod('RAZORPAY')}
          label="UPI / Card / NetBanking / Wallet"
          help="Pay securely via Razorpay. Supports all major Indian banks."
        />

        <MethodOption
          active={method === 'COD'}
          onChoose={() => setMethod('COD')}
          label="Cash on Delivery"
          help={codAvailable ? 'Pay in cash when your order arrives.' : 'Not available for this order.'}
          disabled={!codAvailable}
        />
      </fieldset>

      <button
        type="button"
        onClick={pay}
        disabled={
          submitting ||
          scriptError ||
          (method === 'RAZORPAY' && scriptState !== 'ready' && !scriptLoading)
        }
        className="flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? 'Processing…'
          : method === 'COD'
          ? 'Place Order (COD)'
          : scriptLoading
          ? 'Loading payment…'
          : scriptError
          ? 'Refresh — payment unavailable'
          : 'Pay now'}
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

function MethodOption({
  active,
  onChoose,
  label,
  help,
  disabled,
}: {
  active: boolean;
  onChoose: () => void;
  label: string;
  help: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        disabled
          ? 'border-bg-border bg-bg-elevated/40 opacity-50 cursor-not-allowed'
          : active
          ? 'border-accent bg-accent/10 cursor-pointer'
          : 'border-bg-border bg-bg-elevated hover:border-fg-muted cursor-pointer'
      }`}
    >
      <input
        type="radio"
        name="method"
        checked={active}
        disabled={disabled}
        onChange={onChoose}
        className="mt-1 h-4 w-4 text-accent focus:ring-accent"
      />
      <div>
        <div className="font-medium text-fg-primary">{label}</div>
        <div className="mt-0.5 text-xs text-fg-secondary">{help}</div>
      </div>
    </label>
  );
}
