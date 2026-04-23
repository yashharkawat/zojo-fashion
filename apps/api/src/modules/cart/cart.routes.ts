import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authMiddleware } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { mergeCartBodySchema, putCartBodySchema } from './cart.schema';
import * as controller from './cart.controller';

export const cartRouter = Router();
cartRouter.use(authMiddleware);
cartRouter.get('/', asyncHandler(controller.getHandler));
cartRouter.put(
  '/',
  validate({ body: putCartBodySchema }),
  asyncHandler(controller.putHandler),
);
cartRouter.post(
  '/merge',
  validate({ body: mergeCartBodySchema }),
  asyncHandler(controller.mergeHandler),
);
cartRouter.delete('/', asyncHandler(controller.clearHandler));
