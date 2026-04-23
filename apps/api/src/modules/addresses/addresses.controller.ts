import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { UnauthorizedError } from '../../lib/errors';
import * as addressesService from './addresses.service';
import type { CreateAddressBody } from './addresses.schema';

export async function listHandler(req: Request, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const rows = await addressesService.listForUser(req.auth.userId);
  return ok(res, rows);
}

export async function createHandler(req: Request<unknown, unknown, CreateAddressBody>, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const row = await addressesService.createForUser(req.auth.userId, req.body);
  return ok(res, row, 201);
}
