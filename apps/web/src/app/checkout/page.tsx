'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useHasMounted } from '@/hooks/useHasMounted';
import { pushToast } from '@/store/slices/uiSlice';
import { api } from '@/lib/api';
import { e164ToLocal10 } from '@/lib/phone';
import { computeCartPricing } from '@/lib/pricing';
import { createAddress, listAddresses, type SavedAddressRow } from '@/features/addresses/api';
import { ApiClientError } from '@/types/api';

import { PageTransition } from '@/components/motion/PageTransition';
import { Stepper } from '@/components/ui/Stepper';
import { Skeleton } from '@/components/ui/Skeleton';
import { AddressForm } from '@/components/checkout/AddressForm';
import { OrderReview } from '@/components/checkout/OrderReview';
import { PaymentStep } from '@/components/checkout/PaymentStep';

import type { AddressInput } from '@/types/address';
import type { CreatedOrder } from '@/types/checkout';

const STEPS = [
  { id: 'address', label: 'Address' },
  { id: 'review',  label: 'Review' },
  { id: 'payment', label: 'Payment' },
] as const;

function formatDeliveryWindow(minDays = 3, maxDays = 6): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() + minDays);
  const to = new Date(now); to.setDate(to.getDate() + maxDays);
  return `${fmt(from)} — ${fmt(to)}`;
}

function persistFingerprint(
  a: Pick<
    AddressInput,
    'fullName' | 'phone' | 'line1' | 'line2' | 'landmark' | 'city' | 'state' | 'pincode'
  >,
) {
  return JSON.stringify({
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? '',
    landmark: a.landmark ?? '',
    city: a.city,
    state: a.state,
    pincode: a.pincode,
  });
}

function fingerprintFromSavedRow(row: SavedAddressRow) {
  return JSON.stringify({
    fullName: row.fullName,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2 ?? '',
    landmark: row.landmark ?? '',
    city: row.city,
    state: row.state,
    pincode: row.pincode,
  });
}

function rowToFormDefaults(
  row: SavedAddressRow,
  email: string,
): Partial<AddressInput> {
  return {
    fullName: row.fullName,
    phone: e164ToLocal10(row.phone),
    email,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    landmark: row.landmark ?? undefined,
    city: row.city,
    state: row.state as AddressInput['state'],
    pincode: row.pincode,
    saveForLater: true,
  };
}

function CheckoutInner() {
  const dispatch = useAppDispatch();
  const mounted = useHasMounted();
  const { accessToken, isAuthenticated, user } = useAuth();
  const { items, count } = useCart();
  const couponCode = useAppSelector((s) => s.cart.couponCode);

  const [stepIdx, setStepIdx] = useState(0);
  const [reachedIdx, setReachedIdx] = useState(0);
  const [address, setAddress] = useState<AddressInput | null>(null);
  const [bootstrappedDefaults, setBootstrappedDefaults] = useState<Partial<AddressInput> | null>(null);
  const [addressFormKey, setAddressFormKey] = useState(0);
  const lastSavedFpRef = useRef<string | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const [addrBookReady, setAddrBookReady] = useState(false);
  const [savedAddressId, setSavedAddressId] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!mounted || !isAuthenticated || !accessToken || addrBookReady) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listAddresses();
        if (cancelled) return;
        if (list.length) {
          const row = list.find((x) => x.isDefault) ?? list[0]!;
          const email = userRef.current?.email ?? '';
          setBootstrappedDefaults(rowToFormDefaults(row, email));
          setSavedAddressId(row.id);
          lastSavedFpRef.current = fingerprintFromSavedRow(row);
          setAddressFormKey((k) => k + 1);
        }
      } catch {
        /* no saved address yet */
      } finally {
        if (!cancelled) setAddrBookReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, isAuthenticated, accessToken, addrBookReady]);

  const pricing = useMemo(
    () =>
      computeCartPricing({
        items: items.map((i) => ({ unitPricePaise: i.unitPricePaise, quantity: i.quantity })),
        coupon: null, // server authoritative — we show cart-level preview only
      }),
    [items],
  );

  // ── Guards ─────────────────────────────────────────────
  if (!mounted) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!isAuthenticated || !accessToken) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-3xl text-fg-primary">Sign in to continue</h1>
        <p className="mt-2 text-fg-secondary">You need an account to place an order.</p>
        <Link
          href="/login?next=/checkout"
          className="mt-6 rounded-lg bg-accent px-6 py-3 font-semibold uppercase tracking-widest text-white hover:bg-accent-hover"
        >
          Login
        </Link>
      </div>
    );
  }
  if (count === 0 && !createdOrder) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-3xl text-fg-primary">Cart is empty.</h1>
        <Link
          href="/products"
          className="mt-6 rounded-lg bg-accent px-6 py-3 font-semibold uppercase tracking-widest text-white hover:bg-accent-hover"
        >
          Browse
        </Link>
      </div>
    );
  }

  // ── Step handlers ───────────────────────────────────────
  async function onAddressSubmit(values: AddressInput) {
    if (values.saveForLater) {
      const fp = persistFingerprint(values);
      if (savedAddressId && lastSavedFpRef.current === fp) {
        /* already stored for this exact payload (e.g. pre-filled default) */
      } else {
        try {
          const created = await createAddress(values);
          setSavedAddressId(created.id);
          lastSavedFpRef.current = fp;
        } catch (err) {
          const msg = err instanceof ApiClientError ? err.message : 'Could not save address';
          dispatch(pushToast({ kind: 'error', message: msg, duration: 4000 }));
          return;
        }
      }
    } else {
      setSavedAddressId(null);
      lastSavedFpRef.current = null;
    }
    setAddress(values);
    setStepIdx(1);
    setReachedIdx((r) => Math.max(r, 1));
  }

  async function onCreateOrder() {
    if (!address) {
      dispatch(pushToast({ kind: 'warning', message: 'Address is missing', duration: 2500 }));
      setStepIdx(0);
      return;
    }
    setIsSubmitting(true);
    try {
      let shippingAddressId = savedAddressId;
      if (!shippingAddressId) {
        const created = await createAddress(address);
        shippingAddressId = created.id;
        setSavedAddressId(created.id);
      }

      const order = await api<CreatedOrder>('/orders', {
        method: 'POST',
        token: accessToken,
        body: {
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          shippingAddressId,
          couponCode: couponCode ?? undefined,
        },
      });

      setCreatedOrder(order);
      setStepIdx(2);
      setReachedIdx((r) => Math.max(r, 2));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create order';
      dispatch(pushToast({ kind: 'error', message: msg, duration: 4000 }));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 md:pt-10">
      <header className="mb-8 space-y-6">
        <h1 className="font-display text-4xl tracking-tight text-fg-primary">Checkout</h1>
        <Stepper
          steps={[...STEPS]}
          activeIndex={stepIdx}
          reachedIndex={reachedIdx}
          onStepClick={createdOrder ? undefined : setStepIdx}
        />
      </header>

      {stepIdx === 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <AddressForm
              key={addressFormKey}
              defaultValues={{
                ...(bootstrappedDefaults ?? {}),
                ...(address ?? {}),
                email: address?.email ?? bootstrappedDefaults?.email ?? user?.email ?? '',
                phone: address?.phone ?? bootstrappedDefaults?.phone ?? user?.phone ?? '',
                fullName:
                  address?.fullName ??
                  bootstrappedDefaults?.fullName ??
                  [user?.firstName, user?.lastName].filter(Boolean).join(' '),
              }}
              onSubmit={onAddressSubmit}
            />
          </div>
          <aside className="h-fit rounded-xl border border-bg-border bg-bg-elevated p-5">
            <p className="text-xs uppercase tracking-wider text-fg-secondary">Cart ({count})</p>
            <ul className="mt-3 space-y-2 text-sm">
              {items.slice(0, 3).map((line) => (
                <li key={line.variantId} className="flex justify-between gap-2">
                  <span className="truncate text-fg-primary">
                    {line.productTitle}{' '}
                    <span className="text-fg-muted">× {line.quantity}</span>
                  </span>
                </li>
              ))}
              {items.length > 3 && (
                <li className="text-fg-muted">+ {items.length - 3} more</li>
              )}
            </ul>
          </aside>
        </div>
      )}

      {stepIdx === 1 && address && (
        <OrderReview
          items={items}
          address={address}
          pricing={pricing}
          couponCode={couponCode}
          deliveryEstimate={formatDeliveryWindow()}
          onEditAddress={() => setStepIdx(0)}
          onConfirm={onCreateOrder}
          isSubmitting={isSubmitting}
        />
      )}

      {stepIdx === 2 && createdOrder && (
        <PaymentStep
          orderId={createdOrder.id}
          orderNumber={createdOrder.orderNumber}
          totalPaise={createdOrder.total}
          accessToken={accessToken}
          customerEmail={address?.email ?? user?.email ?? undefined}
        />
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <PageTransition>
      <Suspense
        fallback={
          <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <CheckoutInner />
      </Suspense>
    </PageTransition>
  );
}
