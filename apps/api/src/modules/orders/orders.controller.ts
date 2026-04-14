import type { Request, Response } from 'express';
import { ok, paginated } from '../../lib/response';
import { UnauthorizedError } from '../../lib/errors';
import * as ordersService from './orders.service';
import type { CreateOrderBody, ListMyOrdersQuery, CancelOrderBody } from './orders.schema';

export async function createHandler(req: Request<unknown, unknown, CreateOrderBody>, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const order = await ordersService.createOrder(req.auth.userId, req.body);
  return ok(res, order, 201);
}

export async function listMyHandler(
  req: Request<unknown, unknown, unknown, ListMyOrdersQuery>,
  res: Response,
) {
  if (!req.auth) throw new UnauthorizedError();
  const { data, pagination } = await ordersService.listMy(req.auth.userId, req.query);
  return paginated(res, data, pagination);
}

export async function getOneHandler(req: Request<{ id: string }>, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const isAdmin = ['ADMIN', 'SUPPORT', 'SUPER_ADMIN'].includes(req.auth.role);
  const order = await ordersService.getOne(req.auth.userId, isAdmin, req.params.id);
  return ok(res, order);
}

export async function cancelHandler(
  req: Request<{ id: string }, unknown, CancelOrderBody>,
  res: Response,
) {
  if (!req.auth) throw new UnauthorizedError();
  const order = await ordersService.cancel(req.auth.userId, req.params.id, req.body.reason);
  return ok(res, order);
}
