import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { UnauthorizedError, ValidationError } from '../../lib/errors';
import * as paymentsService from './payments.service';
import type {
  CreatePaymentBody,
  VerifyPaymentBody,
  RefundPaymentBody,
} from './payments.schema';

export async function createHandler(
  req: Request<unknown, unknown, CreatePaymentBody>,
  res: Response,
) {
  if (!req.auth) throw new UnauthorizedError();
  const result = await paymentsService.createPayment(req.auth.userId, req.body);
  return ok(res, result, 201);
}

export async function verifyHandler(
  req: Request<unknown, unknown, VerifyPaymentBody>,
  res: Response,
) {
  if (!req.auth) throw new UnauthorizedError();
  const result = await paymentsService.verifyPayment(req.auth.userId, req.body);
  return ok(res, result);
}

export async function refundHandler(
  req: Request<unknown, unknown, RefundPaymentBody>,
  res: Response,
) {
  if (!req.auth) throw new UnauthorizedError();
  const refund = await paymentsService.refund(req.auth.userId, req.body);
  return ok(res, refund, 201);
}

/**
 * Webhook: raw body required. Route must mount express.raw() for this path.
 * Always respond 2xx quickly; processing is idempotent and safe to retry.
 */
export async function webhookHandler(req: Request, res: Response) {
  const signature = req.header('x-razorpay-signature');
  if (!signature) throw new ValidationError('Missing signature header');
  const eventId = req.header('x-razorpay-event-id') ?? undefined;

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf-8')
    : typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body);

  const result = await paymentsService.handleRazorpayWebhook({
    rawBody,
    signature,
    eventId,
  });

  // Always 200 — Razorpay retries on non-2xx
  return res.status(200).json({ ok: true, applied: result.applied, reason: result.reason ?? null });
}
