import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authMiddleware } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createAddressBodySchema } from './addresses.schema';
import * as controller from './addresses.controller';

export const addressesRouter = Router();

addressesRouter.use(authMiddleware);

addressesRouter.get('/', asyncHandler(controller.listHandler));
addressesRouter.post(
  '/',
  validate({ body: createAddressBodySchema }),
  asyncHandler(controller.createHandler),
);
