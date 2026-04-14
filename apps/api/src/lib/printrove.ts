import crypto from 'node:crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { UpstreamError, ValidationError } from './errors';
import type {
  PrintroveApiResult,
  PrintroveCreateOrderRequest,
  PrintroveOrder,
  PrintroveAddress,
} from '../types/printrove';

// ============================================================
// Client class — single point of contact with Printrove
// ============================================================

interface ClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** Idempotency key for POST. Printrove may honor it or not — safe to send. */
  idempotencyKey?: string;
  /** Max retry attempts on 5xx/network errors. Default 3. */
  maxRetries?: number;
}

export class PrintroveClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  // ──────────────── Public methods ────────────────

  async createOrder(req: PrintroveCreateOrderRequest): Promise<PrintroveOrder> {
    const res = await this.request<PrintroveOrder>({
      method: 'POST',
      path: '/orders',
      body: req,
      idempotencyKey: req.external_order_id,
    });
    return this.unwrap(res, 'createOrder');
  }

  async getOrder(printroveOrderId: string): Promise<PrintroveOrder> {
    const res = await this.request<PrintroveOrder>({
      method: 'GET',
      path: `/orders/${encodeURIComponent(printroveOrderId)}`,
    });
    return this.unwrap(res, 'getOrder');
  }

  async cancelOrder(printroveOrderId: string, reason?: string): Promise<void> {
    const res = await this.request<{ ok: true }>({
      method: 'POST',
      path: `/orders/${encodeURIComponent(printroveOrderId)}/cancel`,
      body: { reason },
      maxRetries: 1,
    });
    this.unwrap(res, 'cancelOrder');
  }

  // ──────────────── Webhook signature ────────────────

  /**
   * Verify Printrove webhook signature. HMAC-SHA256 over the raw body.
   * Returns true if signature matches (timing-safe).
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', env.PRINTROVE_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // ──────────────── Internals ────────────────

  private unwrap<T>(result: PrintroveApiResult<T>, op: string): T {
    if (result.success) return result.data;
    // 4xx → client-side: surface as ValidationError, don't retry
    if (result.error.httpStatus >= 400 && result.error.httpStatus < 500) {
      throw new ValidationError(`Printrove ${op} rejected: ${result.error.message}`, result.error);
    }
    throw new UpstreamError(`Printrove ${op} failed: ${result.error.message}`, result.error);
  }

  private async request<T>(opts: RequestOptions): Promise<PrintroveApiResult<T>> {
    const maxRetries = opts.maxRetries ?? 3;
    let lastError: PrintroveApiResult<T> | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.attempt<T>(opts, attempt);

      // Success
      if (result.success) return result;

      // Non-retriable: 4xx (except 429)
      if (
        result.error.httpStatus >= 400 &&
        result.error.httpStatus < 500 &&
        result.error.httpStatus !== 429
      ) {
        return result;
      }

      // Retriable
      lastError = result;
      if (attempt < maxRetries) {
        const backoff = 500 * 2 ** (attempt - 1); // 500, 1000, 2000
        logger.warn(
          { attempt, maxRetries, backoff, op: opts.path, status: result.error.httpStatus },
          'Printrove retryable error — backing off',
        );
        await sleep(backoff);
      }
    }
    return lastError!;
  }

  private async attempt<T>(opts: RequestOptions, attempt: number): Promise<PrintroveApiResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${opts.path}`, {
        method: opts.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': 'Zojo-Fashion/1.0',
          ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });

      // Parse body (even on error to surface message)
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // ignore — non-JSON response
      }

      if (res.ok) {
        return { success: true, data: body as T };
      }

      const errBody = body as { code?: string; message?: string; details?: unknown } | null;
      return {
        success: false,
        error: {
          code: errBody?.code ?? `HTTP_${res.status}`,
          message: errBody?.message ?? (res.statusText || 'Unknown error'),
          details: errBody?.details,
          httpStatus: res.status,
        },
      };
    } catch (err) {
      logger.warn({ err, attempt, path: opts.path }, 'Printrove network error');
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network failure',
          httpStatus: 0,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ============================================================
// Singleton + back-compat helpers for existing callers
// ============================================================

export const printrove = new PrintroveClient({
  baseUrl: env.PRINTROVE_API_URL,
  apiKey: env.PRINTROVE_API_KEY,
});

/**
 * Back-compat: existing `payments.service.ts` calls `pushOrder(...)`.
 * Thin adapter that converts our internal shape to Printrove's request.
 */
export interface PushOrderInput {
  externalOrderId: string;
  items: Array<{ printroveVariantId: string; quantity: number }>;
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  customer?: { name: string; email: string; phone: string };
  codAmountPaise?: number;
}

export interface PushOrderResponse {
  printroveOrderId: string;
  status: string;
}

export async function pushOrder(input: PushOrderInput): Promise<PushOrderResponse> {
  const address: PrintroveAddress = {
    name: input.shippingAddress.fullName,
    phone: input.shippingAddress.phone,
    address_line_1: input.shippingAddress.line1,
    address_line_2: input.shippingAddress.line2,
    city: input.shippingAddress.city,
    state: input.shippingAddress.state,
    pincode: input.shippingAddress.pincode,
    country: input.shippingAddress.country,
  };

  const order = await printrove.createOrder({
    external_order_id: input.externalOrderId,
    items: input.items.map((i) => ({
      variant_id: i.printroveVariantId,
      quantity: i.quantity,
    })),
    shipping_address: address,
    customer: input.customer ?? {
      name: input.shippingAddress.fullName,
      email: '',
      phone: input.shippingAddress.phone,
    },
    cod:
      input.codAmountPaise !== undefined
        ? { enabled: true, amount_paise: input.codAmountPaise }
        : undefined,
  });

  return {
    printroveOrderId: order.order_id,
    status: order.status,
  };
}

/** Back-compat export for any remaining callers. */
export const verifyPrintroveWebhook = (rawBody: string, signature: string): boolean =>
  printrove.verifyWebhookSignature(rawBody, signature);
