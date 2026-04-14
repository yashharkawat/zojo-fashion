import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';

export const requireRole =
  (...allowed: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(new UnauthorizedError('Authentication required'));
    if (!allowed.includes(req.auth.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };

/** Any admin role (ADMIN, SUPPORT, SUPER_ADMIN). */
export const requireAdmin = requireRole('ADMIN', 'SUPPORT', 'SUPER_ADMIN');

/** Full admin (not SUPPORT). */
export const requireFullAdmin = requireRole('ADMIN', 'SUPER_ADMIN');
