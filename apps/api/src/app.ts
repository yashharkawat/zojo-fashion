import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { requestIdMiddleware } from './middleware/requestId';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './lib/errors';

import { authRouter } from './modules/auth/auth.routes';
import { productsRouter } from './modules/products/products.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { addressesRouter } from './modules/addresses/addresses.routes';
import { cartRouter } from './modules/cart/cart.routes';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1); // Railway / Vercel proxies
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );

  app.use(requestIdMiddleware);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as express.Request).requestId }));
  app.use(cookieParser());

  // IMPORTANT: webhook routes need raw body — mount them BEFORE json parser
  app.use('/api/v1/payments/webhook', paymentsRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use(globalLimiter);

  // Health (no DB). `commit` is set on Render (RENDER_GIT_COMMIT) to verify a fresh deploy.
  app.get('/health', (_req, res) =>
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
    }),
  );

  // Keep-alive (hits DB — use in Uptime Kuma to prevent Railway sleep + keep Neon warm)
  app.get('/ping', async (_req, res) => {
    try {
      const result = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW() as now`;
      res.json({ status: 'ok', db: 'connected', time: result[0]?.now, uptime: process.uptime() });
    } catch (err) {
      res.status(503).json({ status: 'error', db: 'disconnected', error: String(err) });
    }
  });

  // v1 routers
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/products', productsRouter);
  app.use('/api/v1/addresses', addressesRouter);
  app.use('/api/v1/cart', cartRouter);
  app.use('/api/v1/orders', ordersRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/settings', settingsRouter);

  // 404
  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.path} not found`)));

  // Error handler — last
  app.use(errorHandler);

  return app;
}
