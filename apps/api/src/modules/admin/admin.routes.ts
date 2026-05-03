import { Router } from 'express';
import multer from 'multer';
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
  productIdParamSchema,
  setDefaultColorBodySchema,
} from './admin.schema';
import { orderIdParamSchema } from '../orders/orders.schema';
import * as controller from './admin.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 40 }, // 20 MB per file, max 40 files
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === 'image/webp' || file.originalname.endsWith('.webp'));
  },
});

export const adminRouter = Router();

adminRouter.use(authMiddleware, adminLimiter);

adminRouter.get(
  '/orders',
  requireAdmin,
  validate({ query: adminListOrdersQuerySchema }),
  asyncHandler(controller.listOrdersHandler),
);

adminRouter.get(
  '/orders/:id',
  requireAdmin,
  validate({ params: orderIdParamSchema }),
  asyncHandler(controller.getOrderDetailHandler),
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

adminRouter.patch(
  '/products/:id/default-color',
  requireFullAdmin,
  validate({ params: productIdParamSchema, body: setDefaultColorBodySchema }),
  asyncHandler(controller.setDefaultColorHandler),
);

adminRouter.post(
  '/orders/:id/mark-manual-review',
  requireFullAdmin,
  validate({ params: orderIdParamSchema, body: markManualReviewBodySchema }),
  asyncHandler(controller.markManualReviewHandler),
);

adminRouter.post(
  '/products/quick-create',
  requireFullAdmin,
  upload.array('files'),
  asyncHandler(controller.quickCreateProductHandler),
);
