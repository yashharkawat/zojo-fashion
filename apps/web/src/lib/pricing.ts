/**
 * Client-side pricing helpers. Mirrors the server rules in
 * `apps/api/src/utils/money.ts`.
 *
 * THE SERVER IS ALWAYS AUTHORITATIVE — these functions exist only so the
 * cart/checkout UI can show realistic totals before the order is created.
 * No separate GST line; delivery is flat ₹50 (see `apps/api/src/utils/money.ts`).
 */

export interface PricingBreakdown {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
}

export interface CouponPreview {
  code: string;
  type: 'PERCENTAGE' | 'FLAT' | 'FREE_SHIPPING';
  value: number;     // % or paise
  minOrderPaise?: number;
  maxDiscountPaise?: number;
}

/** Flat ₹50 delivery; waived with free-shipping coupon or when subtotal after discount is 0. */
function shippingFor(subtotalAfterDiscount: number, freeShippingCoupon: boolean): number {
  if (freeShippingCoupon) return 0;
  if (subtotalAfterDiscount <= 0) return 0;
  return 5_000; // ₹50
}

export function computeCartPricing(params: {
  items: Array<{ unitPricePaise: number; quantity: number }>;
  coupon: CouponPreview | null;
}): PricingBreakdown {
  const subtotalPaise = params.items.reduce(
    (s, i) => s + i.unitPricePaise * i.quantity,
    0,
  );

  let discountPaise = 0;
  let freeShipping = false;
  if (params.coupon && subtotalPaise > 0) {
    if (
      params.coupon.minOrderPaise !== undefined &&
      subtotalPaise < params.coupon.minOrderPaise
    ) {
      // ineligible — ignored
    } else if (params.coupon.type === 'PERCENTAGE') {
      const raw = Math.round((subtotalPaise * params.coupon.value) / 100);
      discountPaise =
        params.coupon.maxDiscountPaise !== undefined
          ? Math.min(raw, params.coupon.maxDiscountPaise)
          : raw;
    } else if (params.coupon.type === 'FLAT') {
      discountPaise = Math.min(params.coupon.value, subtotalPaise);
    } else if (params.coupon.type === 'FREE_SHIPPING') {
      freeShipping = true;
    }
  }

  const afterDiscount = subtotalPaise - discountPaise;
  const shippingPaise = shippingFor(afterDiscount, freeShipping);
  const taxPaise = 0;
  const totalPaise = afterDiscount + shippingPaise + taxPaise;

  return { subtotalPaise, discountPaise, shippingPaise, taxPaise, totalPaise };
}
