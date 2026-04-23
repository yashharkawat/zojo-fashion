/** Money helpers — all values integer paise. 1 INR = 100 paise. */

export const toPaise = (rupees: number): number => Math.round(rupees * 100);
export const toRupees = (paise: number): number => paise / 100;

/** No separate tax line on orders (prices treated as inclusive). */
export function computeGst(_subtotalPaise: number, _unitMaxPricePaise: number): number {
  return 0;
}

/** Flat delivery ₹50; waived when there is nothing to ship (e.g. 100% discount). */
export function computeShipping(subtotalAfterDiscountPaise: number): number {
  if (subtotalAfterDiscountPaise <= 0) return 0;
  return 5_000; // ₹50
}
