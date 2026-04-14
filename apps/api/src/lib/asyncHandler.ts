import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers to forward rejections to Express error handler.
 * Without this, thrown async errors become unhandledRejection.
 */
export const asyncHandler =
  <R extends Request = Request>(
    fn: (req: R, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as R, res, next)).catch(next);
  };
