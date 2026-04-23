import type { Request, Response } from 'express';
import { ok, paginated } from '../../lib/response';
import { UnauthorizedError } from '../../lib/errors';
import * as service from './admin.service';
import type {
  AdminListOrdersQuery,
  AdminUpdateOrderStatusBody,
  AdminAnalyticsQuery,
  AdminListProductsQuery,
  MarkManualReviewBody,
} from './admin.schema';

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

export async function markManualReviewHandler(
  req: Request<{ id: string }, unknown, MarkManualReviewBody>,
  res: Response,
) {
  if (!req.auth) throw new UnauthorizedError();
  const result = await service.markManualReview(req.auth.userId, req.params.id, req.body.note);
  return ok(res, result);
}
