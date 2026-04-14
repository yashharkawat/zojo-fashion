import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authMiddleware } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { addToWishlistBodySchema, removeFromWishlistParamSchema } from './wishlist.schema';
import * as controller from './wishlist.controller';

export const wishlistRouter = Router();

wishlistRouter.use(authMiddleware);

wishlistRouter.get('/', asyncHandler(controller.getHandler));

wishlistRouter.post(
  '/',
  validate({ body: addToWishlistBodySchema }),
  asyncHandler(controller.addHandler),
);

wishlistRouter.delete(
  '/:productId',
  validate({ params: removeFromWishlistParamSchema }),
  asyncHandler(controller.removeHandler),
);
