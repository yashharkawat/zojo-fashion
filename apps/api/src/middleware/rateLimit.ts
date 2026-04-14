import rateLimit from 'express-rate-limit';

const makeLimiter = (windowMs: number, max: number) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      data: null,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Slow down.' },
      meta: {},
    },
  });

export const globalLimiter = makeLimiter(60 * 1000, 100);
export const authLimiter = makeLimiter(60 * 1000, 10);
export const paymentLimiter = makeLimiter(60 * 1000, 5);
export const adminLimiter = makeLimiter(60 * 1000, 300);
