import type { Request, Response } from 'express';
import { ok, paginated } from '../../lib/response';
import * as productsService from './products.service';
import type {
  ListProductsQuery,
  CreateProductBody,
  UpdateProductBody,
} from './products.schema';

export async function listHandler(req: Request<unknown, unknown, unknown, ListProductsQuery>, res: Response) {
  const { data, pagination } = await productsService.list(req.query);
  return paginated(res, data, pagination);
}

export async function getByIdHandler(req: Request<{ id: string }>, res: Response) {
  const product = await productsService.getByIdOrSlug(req.params.id);
  return ok(res, product);
}

export async function getByCategoryHandler(
  req: Request<{ slug: string }, unknown, unknown, ListProductsQuery>,
  res: Response,
) {
  const { data, pagination } = await productsService.listByCategory(req.params.slug, req.query);
  return paginated(res, data, pagination);
}

export async function createHandler(req: Request<unknown, unknown, CreateProductBody>, res: Response) {
  const product = await productsService.create(req.body);
  return ok(res, product, 201);
}

export async function updateHandler(req: Request<{ id: string }, unknown, UpdateProductBody>, res: Response) {
  const product = await productsService.update(req.params.id, req.body);
  return ok(res, product);
}
