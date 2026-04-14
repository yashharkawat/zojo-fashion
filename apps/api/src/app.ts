import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import { env } from './config/env';
import { logger } from './config/logger';
import { requestIdMiddleware } from './middleware/requestId';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './lib/errors';

import { authRouter } from './modules/auth/auth.routes';
import { productsRouter } from './modules/products/products.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { wishlistRouter } from './modules/wishlist/wishlist.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { printroveWebhookRouter } from './modules/printrove/printrove.webhook.routes';

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
  app.use('/api/v1/printrove/webhook', printroveWebhookRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use(globalLimiter);

  // Health
  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // v1 routers
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/products', productsRouter);
  app.use('/api/v1/orders', ordersRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/wishlist', wishlistRouter);
  app.use('/api/v1/admin', adminRouter);

  // 404
  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.path} not found`)));

  // Error handler — last
  app.use(errorHandler);

  return app;
}
