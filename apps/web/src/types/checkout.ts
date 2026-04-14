import type { AddressInput } from './address';

/** Client-side checkout session — lives in component state, not Redux. */
export interface CheckoutSession {
  address: AddressInput | null;
  savedAddressId: string | null;
  couponCode: string | null;
  orderId: string | null;       // populated after POST /orders
  orderNumber: string | null;   // human-friendly id
}

export const initialCheckoutSession: CheckoutSession = {
  address: null,
  savedAddressId: null,
  couponCode: null,
  orderId: null,
  orderNumber: null,
};

/** Server response for POST /orders */
export interface CreatedOrder {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'CONFIRMED' | 'PRINTING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}
