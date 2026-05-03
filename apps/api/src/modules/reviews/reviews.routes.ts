import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authMiddleware } from '../../middleware/auth';
import { requireFullAdmin } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import * as controller from './reviews.controller';
import { createReviewBodySchema, productSlugParamSchema, reviewIdParamSchema } from './reviews.schema';

export const reviewsRouter = Router({ mergeParams: true });

// GET /api/v1/products/:slug/reviews — public
reviewsRouter.get(
  '/',
  validate({ params: productSlugParamSchema }),
  asyncHandler(controller.listReviewsHandler),
);

// POST /api/v1/products/:slug/reviews — authenticated customers
reviewsRouter.post(
  '/',
  authMiddleware,
  validate({ params: productSlugParamSchema, body: createReviewBodySchema }),
  asyncHandler(controller.createReviewHandler),
);

// DELETE /api/v1/reviews/:id — admin only (mounted separately in app.ts)
export const reviewAdminRouter = Router();
reviewAdminRouter.delete(
  '/:id',
  authMiddleware,
  requireFullAdmin,
  validate({ params: reviewIdParamSchema }),
  asyncHandler(controller.deleteReviewHandler),
);
