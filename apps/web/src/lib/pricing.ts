/**
 * Client-side pricing helpers. Mirrors the server rules in
 * `apps/api/src/utils/money.ts`.
 *
 * THE SERVER IS ALWAYS AUTHORITATIVE — these functions exist only so the
 * cart/checkout UI can show realistic totals before the order is created.
 * On `POST /checkout/validate`, the backend recomputes and any mismatch
 * means the UI was out of date; render the server numbers.
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

/** GST: 5% if per-unit MRP < ₹1000, else 12%. Apparel bracket. */
function gstRate(maxUnitPricePaise: number): number {
  return maxUnitPricePaise < 100_000 ? 0.05 : 0.12;
}

/** Flat ₹79 shipping; free above ₹999. */
function shippingFor(subtotalAfterDiscount: number, freeShippingCoupon: boolean): number {
  if (freeShippingCoupon) return 0;
  return subtotalAfterDiscount >= 99_900 ? 0 : 7_900;
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
  const maxUnit = params.items.reduce((m, i) => Math.max(m, i.unitPricePaise), 0);
  const taxPaise = Math.round(afterDiscount * gstRate(maxUnit));
  const totalPaise = afterDiscount + shippingPaise + taxPaise;

  return { subtotalPaise, discountPaise, shippingPaise, taxPaise, totalPaise };
}
