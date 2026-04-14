'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAppSelector } from '@/store/hooks';
import { useCart } from '@/hooks/useCart';
import { useHasMounted } from '@/hooks/useHasMounted';
import { computeCartPricing, type CouponPreview } from '@/lib/pricing';
import { PageTransition } from '@/components/motion/PageTransition';
import { CartLineItem } from '@/components/cart/CartLineItem';
import { CartSummary } from '@/components/cart/CartSummary';
import { CouponInput } from '@/components/cart/CouponInput';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Local coupon lookup for UI preview only.
 * Server re-validates and recomputes during POST /orders.
 */
function previewCoupon(code: string | null): CouponPreview | null {
  if (!code) return null;
  switch (code) {
    case 'OTAKU10':
      return { code, type: 'PERCENTAGE', value: 10, maxDiscountPaise: 20_000 };
    case 'NARUTO200':
      return { code, type: 'FLAT', value: 20_000, minOrderPaise: 99_900 };
    case 'FREESHIP':
      return { code, type: 'FREE_SHIPPING', value: 0 };
    case 'WELCOME100':
      return { code, type: 'FLAT', value: 10_000 };
    default:
      return null;
  }
}

export default function CartPage() {
  const mounted = useHasMounted();
  const { items, count, update, remove } = useCart();
  const couponCode = useAppSelector((s) => s.cart.couponCode);

  const pricing = useMemo(
    () =>
      computeCartPricing({
        items: items.map((i) => ({ unitPricePaise: i.unitPricePaise, quantity: i.quantity })),
        coupon: previewCoupon(couponCode),
      }),
    [items, couponCode],
  );

  if (!mounted) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageTransition>
    );
  }

  if (count === 0) {
    return (
      <PageTransition>
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Empty</p>
          <h1 className="mt-2 font-display text-4xl text-fg-primary">Your cart is quiet.</h1>
          <p className="mt-2 text-fg-secondary">Let's fix that.</p>
          <Link
            href="/products"
            className="mt-6 rounded-lg bg-accent px-6 py-3 font-semibold uppercase tracking-widest text-white hover:bg-accent-hover"
          >
            Browse the drop
          </Link>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-8 font-display text-4xl tracking-tight text-fg-primary">
          Cart <span className="text-fg-muted">({count})</span>
        </h1>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <ul className="space-y-3">
            {items.map((line) => (
              <CartLineItem
                key={line.variantId}
                line={line}
                onUpdateQty={update}
                onRemove={remove}
              />
            ))}
          </ul>

          <aside className="h-fit rounded-xl border border-bg-border bg-bg-elevated p-6 lg:sticky lg:top-32">
            <h2 className="mb-4 font-display text-xl tracking-wide text-fg-primary">
              Order summary
            </h2>

            <div className="mb-4">
              <CouponInput />
            </div>

            <CartSummary pricing={pricing} couponCode={couponCode} />

            <Link
              href="/checkout"
              className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow"
            >
              Checkout
            </Link>
            <Link
              href="/products"
              className="mt-2 block text-center text-xs text-fg-secondary hover:text-fg-primary"
            >
              Continue shopping
            </Link>
          </aside>
        </div>
      </div>
    </PageTransition>
  );
}
