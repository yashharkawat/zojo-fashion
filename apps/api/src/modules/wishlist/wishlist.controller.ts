import type { Request, Response } from 'express';
import { ok, noContent } from '../../lib/response';
import { UnauthorizedError } from '../../lib/errors';
import * as service from './wishlist.service';
import type { AddToWishlistBody } from './wishlist.schema';

export async function getHandler(req: Request, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const wl = await service.getWishlist(req.auth.userId);
  return ok(res, wl);
}

export async function addHandler(req: Request<unknown, unknown, AddToWishlistBody>, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const item = await service.addItem(req.auth.userId, req.body.productId);
  return ok(res, item, 201);
}

export async function removeHandler(req: Request<{ productId: string }>, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  await service.removeItem(req.auth.userId, req.params.productId);
  return noContent(res);
}
