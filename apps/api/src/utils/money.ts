/** Money helpers — all values integer paise. 1 INR = 100 paise. */

export const toPaise = (rupees: number): number => Math.round(rupees * 100);
export const toRupees = (paise: number): number => paise / 100;

/** GST on apparel in India: 5% if MRP per unit < ₹1000, 12% otherwise. */
export function computeGst(subtotalPaise: number, unitMaxPricePaise: number): number {
  const rate = unitMaxPricePaise < 100_000 ? 0.05 : 0.12;
  return Math.round(subtotalPaise * rate);
}

/** Flat shipping: ₹79 free above ₹999 */
export function computeShipping(subtotalPaise: number): number {
  return subtotalPaise >= 99_900 ? 0 : 7_900;
}
