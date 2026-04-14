import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env';
import { UpstreamError } from './errors';

export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a Razorpay order. Amount must be in paise.
 */
export async function createRazorpayOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string }> {
  try {
    const order = await razorpay.orders.create({
      amount: params.amountPaise,
      currency: 'INR',
      receipt: params.receipt,
      notes: params.notes,
    });
    return {
      id: order.id,
      amount: typeof order.amount === 'string' ? parseInt(order.amount, 10) : order.amount,
      currency: order.currency,
    };
  } catch (err) {
    throw new UpstreamError('Razorpay order creation failed', { cause: String(err) });
  }
}

/**
 * Verify the checkout signature returned by Razorpay Checkout.js.
 * Formula: HMAC_SHA256(razorpay_order_id + '|' + razorpay_payment_id, key_secret)
 * Timing-safe compare.
 */
export function verifyCheckoutSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  const payload = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(payload)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(params.signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Verify webhook signature. Uses WEBHOOK_SECRET (distinct from key_secret).
 * Razorpay signs the raw request body.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export async function refundPayment(params: {
  razorpayPaymentId: string;
  amountPaise: number;
  notes?: Record<string, string>;
}): Promise<{ id: string; status: string }> {
  try {
    const refund = await razorpay.payments.refund(params.razorpayPaymentId, {
      amount: params.amountPaise,
      notes: params.notes,
    });
    return { id: refund.id, status: refund.status };
  } catch (err) {
    throw new UpstreamError('Razorpay refund failed', { cause: String(err) });
  }
}
