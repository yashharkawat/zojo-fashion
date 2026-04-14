import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  });

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !decoded.sub) {
      throw new UnauthorizedError('Invalid token payload');
    }
    return decoded as AccessTokenPayload;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired token');
  }
};

/** Opaque refresh token: random 64 bytes. Store only the hash. */
export const generateRefreshToken = (): { raw: string; hash: string } => {
  const raw = crypto.randomBytes(64).toString('base64url');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
};

export const hashRefreshToken = (raw: string): string =>
  crypto.createHash('sha256').update(raw).digest('hex');
