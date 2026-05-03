import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { authMiddleware } from '../../middleware/auth';
import { requireFullAdmin } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  blogSlugParamSchema,
  blogIdParamSchema,
  createBlogPostBodySchema,
  updateBlogPostBodySchema,
  listBlogPostsQuerySchema,
} from './blog.schema';
import * as controller from './blog.controller';

// Public routes
export const blogPublicRouter = Router();

blogPublicRouter.get(
  '/',
  validate({ query: listBlogPostsQuerySchema }),
  asyncHandler(controller.listPublishedHandler),
);

blogPublicRouter.get(
  '/:slug',
  validate({ params: blogSlugParamSchema }),
  asyncHandler(controller.getPublishedBySlugHandler),
);

// Admin routes (mounted under /api/v1/admin/blog)
export const blogAdminRouter = Router();

blogAdminRouter.use(authMiddleware, requireFullAdmin);

blogAdminRouter.get(
  '/',
  validate({ query: listBlogPostsQuerySchema }),
  asyncHandler(controller.adminListHandler),
);

blogAdminRouter.post(
  '/',
  validate({ body: createBlogPostBodySchema }),
  asyncHandler(controller.adminCreateHandler),
);

blogAdminRouter.patch(
  '/:id',
  validate({ params: blogIdParamSchema, body: updateBlogPostBodySchema }),
  asyncHandler(controller.adminUpdateHandler),
);

blogAdminRouter.delete(
  '/:id',
  validate({ params: blogIdParamSchema }),
  asyncHandler(controller.adminDeleteHandler),
);
