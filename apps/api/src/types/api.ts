import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

export interface ResponseMeta {
  requestId: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  data: T;
  error: null;
  meta: ResponseMeta;
}

export interface ApiErrorBody {
  data: null;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  meta: ResponseMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface AuthContext {
  userId: string;
  role: UserRole;
  email: string;
}

export type AuthedRequest<
  Body = unknown,
  Query = unknown,
  Params = unknown,
> = Request<Params extends object ? Params : never, unknown, Body, Query extends object ? Query : never> & {
  auth: AuthContext;
  requestId: string;
};
