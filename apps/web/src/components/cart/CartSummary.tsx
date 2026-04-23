import { inr } from '@/lib/format';
import type { PricingBreakdown } from '@/lib/pricing';

export interface CartSummaryProps {
  pricing: PricingBreakdown;
  couponCode?: string | null;
  className?: string;
}

export function CartSummary({ pricing, couponCode, className }: CartSummaryProps) {
  const afterDiscount = pricing.subtotalPaise - pricing.discountPaise;
  return (
    <dl className={`space-y-2 text-sm ${className ?? ''}`}>
      <Row label="Subtotal" value={inr(pricing.subtotalPaise)} />
      {pricing.discountPaise > 0 && (
        <Row
          label={couponCode ? `Discount (${couponCode})` : 'Discount'}
          value={`− ${inr(pricing.discountPaise)}`}
          accent
        />
      )}
      <Row
        label="Delivery"
        value={
          pricing.shippingPaise === 0
            ? afterDiscount <= 0
              ? '—'
              : 'Free'
            : inr(pricing.shippingPaise)
        }
      />
      <div className="my-3 border-t border-bg-border" />
      <Row label="Total" value={inr(pricing.totalPaise)} large />
      <p className="pt-1 text-xs text-fg-muted">₹50 delivery on all orders. Prices include applicable taxes.</p>
    </dl>
  );
}

function Row({
  label,
  value,
  accent,
  large,
}: {
  label: string;
  value: string;
  accent?: boolean;
  large?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={large ? 'text-fg-primary font-semibold' : 'text-fg-secondary'}>{label}</dt>
      <dd
        className={`font-mono ${
          large ? 'text-lg font-bold text-fg-primary' : accent ? 'text-accent' : 'text-fg-primary'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
