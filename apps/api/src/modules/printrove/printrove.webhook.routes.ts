import { Router, raw } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { webhookHandler } from './printrove.webhook.controller';

export const printroveWebhookRouter = Router();

// Raw body required for HMAC verification. Mount BEFORE express.json() at app level.
printroveWebhookRouter.post(
  '/',
  raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(webhookHandler),
);
