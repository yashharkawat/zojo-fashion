import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers to forward rejections to Express error handler.
 * Uses `any` for the handler signature so typed controllers don't conflict
 * with Express's loose `ParsedQs` query type. Type safety lives in the
 * controller + Zod validation layer, not the route wiring.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asyncHandler = (fn: (req: any, res: any, next: any) => Promise<any>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
