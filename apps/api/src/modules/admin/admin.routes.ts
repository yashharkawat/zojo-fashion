import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authMiddleware } from '../../middleware/auth';
import { requireAdmin, requireFullAdmin } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { adminLimiter } from '../../middleware/rateLimit';
import {
  adminListOrdersQuerySchema,
  adminUpdateOrderStatusBodySchema,
  adminAnalyticsQuerySchema,
  adminListProductsQuerySchema,
  markManualReviewBodySchema,
} from './admin.schema';
import { orderIdParamSchema } from '../orders/orders.schema';
import * as controller from './admin.controller';

export const adminRouter = Router();

adminRouter.use(authMiddleware, adminLimiter);

adminRouter.get(
  '/orders',
  requireAdmin,
  validate({ query: adminListOrdersQuerySchema }),
  asyncHandler(controller.listOrdersHandler),
);

adminRouter.put(
  '/orders/:id/status',
  requireFullAdmin,
  validate({ params: orderIdParamSchema, body: adminUpdateOrderStatusBodySchema }),
  asyncHandler(controller.updateOrderStatusHandler),
);

adminRouter.get(
  '/analytics',
  requireAdmin,
  validate({ query: adminAnalyticsQuerySchema }),
  asyncHandler(controller.analyticsHandler),
);

adminRouter.get(
  '/products',
  requireAdmin,
  validate({ query: adminListProductsQuerySchema }),
  asyncHandler(controller.listProductsHandler),
);

adminRouter.post(
  '/orders/:id/mark-manual-review',
  requireFullAdmin,
  validate({ params: orderIdParamSchema, body: markManualReviewBodySchema }),
  asyncHandler(controller.markManualReviewHandler),
);
