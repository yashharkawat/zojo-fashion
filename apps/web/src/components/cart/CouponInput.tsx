'use client';

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { applyCoupon, clearCoupon } from '@/store/slices/cartSlice';
import { pushToast } from '@/store/slices/uiSlice';
import { Input } from '@/components/ui/Input';

// Demo local coupon list; replace with POST /coupons/validate call.
const KNOWN_COUPONS = new Set(['OTAKU10', 'NARUTO200', 'FREESHIP', 'WELCOME100']);

export function CouponInput() {
  const dispatch = useAppDispatch();
  const applied = useAppSelector((s) => s.cart.couponCode);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onApply(e: React.FormEvent) {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    if (!KNOWN_COUPONS.has(normalized)) {
      setError('Invalid coupon code');
      return;
    }
    setError(null);
    dispatch(applyCoupon(normalized));
    dispatch(pushToast({ kind: 'success', message: `Coupon "${normalized}" applied`, duration: 2500 }));
    setCode('');
  }

  function onClear() {
    dispatch(clearCoupon());
    dispatch(pushToast({ kind: 'info', message: 'Coupon removed', duration: 1800 }));
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5">
        <div>
          <p className="font-mono text-sm font-semibold text-accent">{applied}</p>
          <p className="text-xs text-fg-secondary">Coupon applied</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-fg-secondary hover:text-danger"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onApply} className="flex gap-2">
      <div className="flex-1">
        <Input
          aria-label="Coupon code"
          placeholder="Have a code?"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          error={error}
        />
      </div>
      <button
        type="submit"
        disabled={!code.trim()}
        className="h-11 self-start rounded-lg border border-bg-border bg-bg-elevated px-4 text-sm font-semibold uppercase tracking-widest text-fg-primary transition-all hover:border-accent hover:text-accent disabled:opacity-50"
      >
        Apply
      </button>
    </form>
  );
}
