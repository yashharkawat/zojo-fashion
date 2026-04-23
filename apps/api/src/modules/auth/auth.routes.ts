import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../lib/asyncHandler';
import { authMiddleware } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimit';
import {
  registerBodySchema,
  loginBodySchema,
  googleSignInBodySchema,
  otpSendBodySchema,
  otpVerifyBodySchema,
  emailVerifyBodySchema,
  passwordResetRequestBodySchema,
  passwordResetConfirmBodySchema,
} from './auth.schema';
import * as controller from './auth.controller';

export const authRouter = Router();

// ─── Stricter per-route limits ────────────────────────────

const otpSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3, // 3 OTP sends per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many OTP requests. Slow down.' }, meta: {} },
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { code: 'RATE_LIMITED', message: 'Too many reset requests.' }, meta: {} },
});

// ─── Email + password ────────────────────────────────────

authRouter.post(
  '/register',
  authLimiter,
  validate({ body: registerBodySchema }),
  asyncHandler(controller.registerHandler),
);

authRouter.post(
  '/login',
  authLimiter,
  validate({ body: loginBodySchema }),
  asyncHandler(controller.loginHandler),
);

authRouter.post(
  '/google',
  authLimiter,
  validate({ body: googleSignInBodySchema }),
  asyncHandler(controller.googleSignInHandler),
);

authRouter.post('/refresh', authLimiter, asyncHandler(controller.refreshHandler));
authRouter.post('/logout', asyncHandler(controller.logoutHandler));
authRouter.get('/me', authMiddleware, asyncHandler(controller.meHandler));

// ─── OTP ─────────────────────────────────────────────────

authRouter.post(
  '/otp/send',
  otpSendLimiter,
  validate({ body: otpSendBodySchema }),
  asyncHandler(controller.otpSendHandler),
);

authRouter.post(
  '/otp/verify',
  authLimiter,
  validate({ body: otpVerifyBodySchema }),
  asyncHandler(controller.otpVerifyHandler),
);

// ─── Email verification ───────────────────────────────────

authRouter.post(
  '/email/send-verification',
  authMiddleware,
  authLimiter,
  asyncHandler(controller.emailSendVerificationHandler),
);

authRouter.post(
  '/email/verify',
  authLimiter,
  validate({ body: emailVerifyBodySchema }),
  asyncHandler(controller.emailVerifyHandler),
);

// ─── Password reset ───────────────────────────────────────

authRouter.post(
  '/password/reset-request',
  passwordResetLimiter,
  validate({ body: passwordResetRequestBodySchema }),
  asyncHandler(controller.passwordResetRequestHandler),
);

authRouter.post(
  '/password/reset-confirm',
  authLimiter,
  validate({ body: passwordResetConfirmBodySchema }),
  asyncHandler(controller.passwordResetConfirmHandler),
);
