import { ValidationError } from '../lib/errors';

/**
 * Server-side coupon rules. Must stay aligned with the cart UI in
 * `apps/web/src/app/cart/page.tsx` (`previewCoupon`).
 */
export interface AppliedOrderCoupon {
  discountAmount: number;
  couponCode: string | null;
  freeShipping: boolean;
}

export function applyOrderCoupon(rawCode: string | null | undefined, subtotal: number): AppliedOrderCoupon {
  if (!rawCode?.trim()) {
    return { discountAmount: 0, couponCode: null, freeShipping: false };
  }
  const code = rawCode.trim().toUpperCase();
  switch (code) {
    case 'OTAKU10': {
      const raw = Math.round((subtotal * 10) / 100);
      return {
        discountAmount: Math.min(raw, 20_000),
        couponCode: code,
        freeShipping: false,
      };
    }
    case 'NARUTO200': {
      if (subtotal < 99_900) {
        throw new ValidationError('Order total below coupon minimum');
      }
      return {
        discountAmount: Math.min(20_000, subtotal),
        couponCode: code,
        freeShipping: false,
      };
    }
    case 'FREESHIP':
      return { discountAmount: 0, couponCode: code, freeShipping: true };
    case 'WELCOME100':
      return {
        discountAmount: Math.min(10_000, subtotal),
        couponCode: code,
        freeShipping: false,
      };
    default:
      throw new ValidationError('Invalid coupon');
  }
}
