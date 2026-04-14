/**
 * Razorpay Checkout.js types.
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */

export interface RazorpayOptions {
  key: string;
  amount: number; // paise
  currency: 'INR';
  name: string;
  description?: string;
  order_id: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
    method?: 'card' | 'netbanking' | 'wallet' | 'emi' | 'upi';
  };
  notes?: Record<string, string>;
  theme?: { color?: string; hide_topbar?: boolean };
  method?: {
    upi?: boolean;
    card?: boolean;
    netbanking?: boolean;
    wallet?: boolean;
    emi?: boolean;
    paylater?: boolean;
  };
  retry?: { enabled?: boolean; max_count?: number };
  timeout?: number; // seconds
  handler: (response: RazorpayHandlerResponse) => void | Promise<void>;
  modal?: {
    ondismiss?: () => void;
    confirm_close?: boolean;
    escape?: boolean;
    backdropclose?: boolean;
  };
}

export interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailure {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id?: string;
      payment_id?: string;
    };
  };
}

export interface RazorpayInstance {
  open(): void;
  close(): void;
  on(event: 'payment.failed', handler: (resp: RazorpayFailure) => void): void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export {};
