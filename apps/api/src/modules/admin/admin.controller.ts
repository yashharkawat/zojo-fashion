import type { Request, Response } from 'express';
import { ok, paginated } from '../../lib/response';
import { UnauthorizedError, ValidationError } from '../../lib/errors';
import * as service from './admin.service';
import type {
  AdminListOrdersQuery,
  AdminUpdateOrderStatusBody,
  AdminAnalyticsQuery,
  AdminListProductsQuery,
  MarkManualReviewBody,
  SetDefaultColorBody,
  QuickCreateProductInput,
} from './admin.schema';
import { quickCreateProductBodySchema } from './admin.schema';

export async function listOrdersHandler(
  req: Request<unknown, unknown, unknown, AdminListOrdersQuery>,
  res: Response,
) {
  const { data, pagination } = await service.listOrders(req.query);
  return paginated(res, data, pagination);
}

export async function updateOrderStatusHandler(
  req: Request<{ id: string }, unknown, AdminUpdateOrderStatusBody>,
  res: Response,
) {
  if (!req.auth) throw new UnauthorizedError();
  const order = await service.updateOrderStatus(req.auth.userId, req.params.id, req.body);
  return ok(res, order);
}

export async function analyticsHandler(
  req: Request<unknown, unknown, unknown, AdminAnalyticsQuery>,
  res: Response,
) {
  const data = await service.analytics(req.query);
  return ok(res, data);
}

export async function listProductsHandler(
  req: Request<unknown, unknown, unknown, AdminListProductsQuery>,
  res: Response,
) {
  const { data, pagination } = await service.listProducts(req.query);
  return paginated(res, data, pagination);
}

export async function setDefaultColorHandler(
  req: Request<{ id: string }, unknown, SetDefaultColorBody>,
  res: Response,
) {
  const result = await service.setDefaultColor(req.params.id, req.body.color);
  return ok(res, result);
}

export async function markManualReviewHandler(
  req: Request<{ id: string }, unknown, MarkManualReviewBody>,
  res: Response,
) {
  if (!req.auth) throw new UnauthorizedError();
  const result = await service.markManualReview(req.auth.userId, req.params.id, req.body.note);
  return ok(res, result);
}

export async function quickCreateProductHandler(req: Request, res: Response) {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    throw new ValidationError('No files uploaded');
  }

  const parsed = quickCreateProductBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const product = await service.quickCreateProduct(
    parsed.data as QuickCreateProductInput,
    files.map((f) => ({ buffer: f.buffer, originalname: f.originalname })),
  );
  return ok(res, product);
}
