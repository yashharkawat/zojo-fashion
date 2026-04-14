import { Router, raw } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authMiddleware } from '../../middleware/auth';
import { requireFullAdmin } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { paymentLimiter } from '../../middleware/rateLimit';
import {
  createPaymentBodySchema,
  verifyPaymentBodySchema,
  refundPaymentBodySchema,
} from './payments.schema';
import * as controller from './payments.controller';

export const paymentsRouter = Router();

// ─── Customer routes ────────────────────────────────────────────
paymentsRouter.post(
  '/create',
  authMiddleware,
  paymentLimiter,
  validate({ body: createPaymentBodySchema }),
  asyncHandler(controller.createHandler),
);

paymentsRouter.post(
  '/verify',
  authMiddleware,
  paymentLimiter,
  validate({ body: verifyPaymentBodySchema }),
  asyncHandler(controller.verifyHandler),
);

// ─── Admin routes ───────────────────────────────────────────────
paymentsRouter.post(
  '/refund',
  authMiddleware,
  requireFullAdmin,
  validate({ body: refundPaymentBodySchema }),
  asyncHandler(controller.refundHandler),
);

// ─── Webhook ────────────────────────────────────────────────────
// MUST use raw body for HMAC verification. No JSON parser on this path.
paymentsRouter.post(
  '/webhook',
  raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(controller.webhookHandler),
);
