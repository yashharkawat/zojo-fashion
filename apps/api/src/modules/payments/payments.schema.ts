import { z } from 'zod';

export const createPaymentBodySchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(['RAZORPAY', 'COD']).default('RAZORPAY'),
});

export const verifyPaymentBodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i, 'hex-64 signature'),
});

export const refundPaymentBodySchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().int().positive().optional(), // paise; omit = full refund of remaining
  reason: z.string().max(500).optional(),
});

export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;
export type VerifyPaymentBody = z.infer<typeof verifyPaymentBodySchema>;
export type RefundPaymentBody = z.infer<typeof refundPaymentBodySchema>;

/** Server → client discriminated union for /payments/create response */
export type CreatePaymentResult =
  | {
      method: 'RAZORPAY';
      razorpayOrderId: string;
      amount: number;
      currency: 'INR';
      keyId: string;
      orderNumber: string;
      prefill: { name: string; email: string; contact: string };
    }
  | {
      method: 'COD';
      orderNumber: string;
      status: 'CONFIRMED';
    };
