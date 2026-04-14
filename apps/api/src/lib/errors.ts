import type { ErrorCode } from '../types/api';

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: ErrorCode;

  constructor(message = 'An error occurred', public readonly details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 422;
  readonly code = 'VALIDATION_ERROR' as const;
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED' as const;
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN' as const;
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND' as const;
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT' as const;
}

export class UpstreamError extends AppError {
  readonly statusCode = 503;
  readonly code = 'UPSTREAM_ERROR' as const;
}
