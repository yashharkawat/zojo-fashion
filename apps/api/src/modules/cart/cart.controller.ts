import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { UnauthorizedError } from '../../lib/errors';
import * as cartService from './cart.service';
import type { MergeCartBody, PutCartBody } from './cart.schema';

export async function getHandler(req: Request, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const data = await cartService.getCartAsJson(req.auth.userId);
  return ok(res, data);
}

export async function putHandler(req: Request<unknown, unknown, PutCartBody>, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const data = await cartService.putCart(req.auth.userId, req.body);
  return ok(res, data);
}

export async function mergeHandler(req: Request<unknown, unknown, MergeCartBody>, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const data = await cartService.mergeCart(req.auth.userId, req.body);
  return ok(res, data);
}

export async function clearHandler(req: Request, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  await cartService.clearCart(req.auth.userId);
  return ok(res, { ok: true });
}
