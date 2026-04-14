import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { UnauthorizedError } from '../lib/errors';

export const authMiddleware: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing bearer token'));
  }
  const token = header.slice(7).trim();
  if (!token) return next(new UnauthorizedError('Empty bearer token'));

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      email: payload.email,
    };
    next();
  } catch (err) {
    next(err);
  }
};
