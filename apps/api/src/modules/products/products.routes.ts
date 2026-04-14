import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authMiddleware } from '../../middleware/auth';
import { requireFullAdmin } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  listProductsQuerySchema,
  productIdParamSchema,
  categorySlugParamSchema,
  createProductBodySchema,
  updateProductBodySchema,
} from './products.schema';
import * as controller from './products.controller';

export const productsRouter = Router();

productsRouter.get(
  '/',
  validate({ query: listProductsQuerySchema }),
  asyncHandler(controller.listHandler),
);

productsRouter.get(
  '/category/:slug',
  validate({ params: categorySlugParamSchema, query: listProductsQuerySchema }),
  asyncHandler(controller.getByCategoryHandler),
);

productsRouter.get(
  '/:id',
  validate({ params: productIdParamSchema }),
  asyncHandler(controller.getByIdHandler),
);

productsRouter.post(
  '/',
  authMiddleware,
  requireFullAdmin,
  validate({ body: createProductBodySchema }),
  asyncHandler(controller.createHandler),
);

productsRouter.put(
  '/:id',
  authMiddleware,
  requireFullAdmin,
  validate({ params: productIdParamSchema, body: updateProductBodySchema }),
  asyncHandler(controller.updateHandler),
);
