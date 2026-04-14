import type { Response } from 'express';
import type { ApiSuccess, PaginationMeta } from '../types/api';

export function ok<T>(res: Response, data: T, status = 200): Response<ApiSuccess<T>> {
  return res.status(status).json({
    data,
    error: null,
    meta: { requestId: res.req.requestId },
  });
}

export function paginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
): Response<ApiSuccess<T[]>> {
  return res.status(200).json({
    data,
    error: null,
    meta: { requestId: res.req.requestId, pagination },
  });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}
