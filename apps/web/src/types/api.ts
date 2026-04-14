/** Mirror of backend ApiResponse envelope. */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN';

export interface ApiSuccess<T> {
  data: T;
  error: null;
  meta: { requestId: string };
}

export interface ApiError {
  data: null;
  error: { code: ErrorCode; message: string; details?: unknown };
  meta: { requestId: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Error thrown by the `api()` client. Preserves server code for UI branching. */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// Payment-specific response types (must match backend CreatePaymentResult)
export type CreatePaymentResponse =
  | {
      method: 'RAZORPAY';
      razorpayOrderId: string;
      amount: number;
      currency: 'INR';
      keyId: string;
      orderNumber: string;
      prefill: { name: string; email: string; contact: string };
    }
  | {
      method: 'COD';
      orderNumber: string;
      status: 'CONFIRMED';
    };

export interface VerifyPaymentResponse {
  orderNumber: string;
  status: string;
  alreadyCaptured: boolean;
}
