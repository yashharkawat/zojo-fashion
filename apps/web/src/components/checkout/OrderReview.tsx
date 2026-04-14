'use client';

import Image from 'next/image';
import type { CartLine } from '@/store/slices/cartSlice';
import type { AddressInput } from '@/types/address';
import { inr } from '@/lib/format';
import { CartSummary } from '@/components/cart/CartSummary';
import type { PricingBreakdown } from '@/lib/pricing';

const isDataUrl = (s: string | null): boolean => !!s && s.startsWith('data:');

export interface OrderReviewProps {
  items: CartLine[];
  address: AddressInput;
  pricing: PricingBreakdown;
  couponCode: string | null;
  deliveryEstimate: string;
  onEditAddress: () => void;
  onConfirm: () => void | Promise<void>;
  isSubmitting?: boolean;
}

export function OrderReview({
  items,
  address,
  pricing,
  couponCode,
  deliveryEstimate,
  onEditAddress,
  onConfirm,
  isSubmitting,
}: OrderReviewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="rounded-xl border border-bg-border bg-bg-elevated">
          <header className="flex items-center justify-between border-b border-bg-border px-5 py-4">
            <h3 className="font-display text-lg tracking-wide text-fg-primary">Shipping to</h3>
            <button
              type="button"
              onClick={onEditAddress}
              className="text-xs font-semibold uppercase tracking-widest text-accent hover:underline"
            >
              Edit
            </button>
          </header>
          <dl className="p-5 text-sm leading-relaxed">
            <dt className="sr-only">Name</dt>
            <dd className="font-medium text-fg-primary">{address.fullName}</dd>
            <dt className="sr-only">Address</dt>
            <dd className="mt-1 text-fg-secondary">
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}
              <br />
              {address.city}, {address.state} {address.pincode}
              <br />
              {address.phone} · {address.email}
            </dd>
          </dl>
        </section>

        <section className="rounded-xl border border-bg-border bg-bg-elevated">
          <header className="border-b border-bg-border px-5 py-4">
            <h3 className="font-display text-lg tracking-wide text-fg-primary">
              Items ({items.reduce((s, i) => s + i.quantity, 0)})
            </h3>
          </header>
          <ul className="divide-y divide-bg-border">
            {items.map((line) => (
              <li key={line.variantId} className="flex gap-3 p-4">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-bg-overlay">
                  {line.imageUrl && (
                    <Image
                      src={line.imageUrl}
                      alt={line.productTitle}
                      fill
                      unoptimized={isDataUrl(line.imageUrl)}
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-1 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg-primary">{line.productTitle}</p>
                    <p className="text-xs text-fg-secondary">
                      {line.variantLabel} · Qty {line.quantity}
                    </p>
                  </div>
                  <p className="font-mono text-sm text-fg-primary">
                    {inr(line.unitPricePaise * line.quantity)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
          <p className="flex items-center gap-2 text-fg-primary">
            <TruckIcon className="h-4 w-4 text-accent" />
            Estimated delivery: <strong>{deliveryEstimate}</strong>
          </p>
        </section>
      </div>

      <aside className="h-fit rounded-xl border border-bg-border bg-bg-elevated p-6 lg:sticky lg:top-32">
        <h2 className="mb-4 font-display text-xl tracking-wide text-fg-primary">Summary</h2>
        <CartSummary pricing={pricing} couponCode={couponCode} />
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow disabled:opacity-60"
        >
          {isSubmitting ? 'Creating order…' : 'Continue to Payment'}
        </button>
        <p className="mt-3 text-center text-xs text-fg-muted">
          You won't be charged yet.
        </p>
      </aside>
    </div>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h12v10H3zM15 10h4l2 3v4h-6M7 20a2 2 0 100-4 2 2 0 000 4zM17 20a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
  );
}
