import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, ConflictError, NotFoundError } from '../lib/errors';
import { logger } from '../config/logger';
import type { ApiErrorBody } from '../types/api';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.requestId ?? 'unknown';

  // Known application errors
  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      data: null,
      error: { code: err.code, message: err.message, details: err.details },
      meta: { requestId },
    };
    return res.status(err.statusCode).json(body);
  }

  // Prisma known errors → normalize
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const conflict = new ConflictError('Duplicate value', { target: err.meta?.target });
      return res.status(409).json({
        data: null,
        error: { code: conflict.code, message: conflict.message, details: conflict.details },
        meta: { requestId },
      } satisfies ApiErrorBody);
    }
    if (err.code === 'P2025') {
      const notFound = new NotFoundError('Resource not found');
      return res.status(404).json({
        data: null,
        error: { code: notFound.code, message: notFound.message },
        meta: { requestId },
      } satisfies ApiErrorBody);
    }
  }

  logger.error({ err, requestId, path: req.path }, 'Unhandled error');

  const body: ApiErrorBody = {
    data: null,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    meta: { requestId },
  };
  return res.status(500).json(body);
};
