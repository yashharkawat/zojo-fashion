import crypto from 'node:crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { UpstreamError, ValidationError } from './errors';
import type {
  PrintroveCreateOrderRequest,
  PrintroveOrder,
  PrintroveTokenResponse,
  PrintroveCustomer,
} from '../types/printrove';

// ============================================================
// Printrove API Client
// Auth: email/password → JWT token (auto-refreshed on expiry)
// Base: https://api.printrove.com/api/external
// ============================================================

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; httpStatus: number; details?: unknown };
}

export class PrintroveClient {
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly password: string;
  private readonly webhookSecret: string;
  private readonly timeoutMs: number;

  private token: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(opts: {
    baseUrl: string;
    email: string;
    password: string;
    webhookSecret: string;
    timeoutMs?: number;
  }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.email = opts.email;
    this.password = opts.password;
    this.webhookSecret = opts.webhookSecret;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  // ──────────────── Auth ────────────────

  private async getToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.token && this.tokenExpiresAt && this.tokenExpiresAt.getTime() > Date.now() + 60_000) {
      return this.token;
    }

    logger.info('Printrove: refreshing auth token');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: this.email, password: this.password }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new UpstreamError(`Printrove auth failed: ${res.status} ${body}`);
      }

      const data = (await res.json()) as PrintroveTokenResponse;
      this.token = data.access_token;
      this.tokenExpiresAt = new Date(data.expires_at);
      logger.info({ expiresAt: data.expires_at }, 'Printrove: token acquired');
      return this.token;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ──────────────── Orders ────────────────

  async createOrder(req: PrintroveCreateOrderRequest): Promise<PrintroveOrder> {
    return this.authedRequest<PrintroveOrder>('POST', '/orders', req);
  }

  async getOrder(orderId: string | number): Promise<PrintroveOrder> {
    return this.authedRequest<PrintroveOrder>('GET', `/orders/${orderId}`);
  }

  async listOrders(params?: { page?: number; per_page?: number; reference_number?: string }): Promise<{ data: PrintroveOrder[] }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    if (params?.reference_number) qs.set('reference_number', params.reference_number);
    const q = qs.toString();
    return this.authedRequest<{ data: PrintroveOrder[] }>('GET', `/orders${q ? `?${q}` : ''}`);
  }

  // ──────────────── Serviceability ────────────────

  async checkServiceability(params: {
    country: string;
    pincode: string;
    weight: string;
    cod?: boolean;
  }): Promise<unknown> {
    const qs = new URLSearchParams({
      country: params.country,
      pincode: params.pincode,
      weight: params.weight,
      ...(params.cod !== undefined ? { cod: String(params.cod) } : {}),
    });
    return this.authedRequest<unknown>('GET', `/serviceability?${qs}`);
  }

  async getPincodeDetails(pincode: string): Promise<unknown> {
    return this.authedRequest<unknown>('GET', `/pincode/${pincode}`);
  }

  // ──────────────── Products / Catalog ────────────────

  async listProducts(params?: { page?: number; per_page?: number; name?: string; sku?: string }): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    if (params?.name) qs.set('name', params.name);
    if (params?.sku) qs.set('sku', params.sku);
    const q = qs.toString();
    return this.authedRequest<unknown>('GET', `/products${q ? `?${q}` : ''}`);
  }

  async getProduct(productId: string | number): Promise<unknown> {
    return this.authedRequest<unknown>('GET', `/products/${productId}`);
  }

  // ──────────────── Designs ────────────────

  async listDesigns(params?: { page?: number; name?: string }): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.name) qs.set('name', params.name);
    const q = qs.toString();
    return this.authedRequest<unknown>('GET', `/designs${q ? `?${q}` : ''}`);
  }

  // ──────────────── Webhook signature ────────────────

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) return true; // no secret configured = skip verification
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // ──────────────── Core request method ────────────────

  private async authedRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    const maxRetries = 3;
    let lastError: ApiResult<T> | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.doRequest<T>(method, path, body, attempt);

      if (result.success && result.data !== undefined) return result.data;

      // 401 = token expired, refresh and retry once
      if (result.error?.httpStatus === 401 && attempt === 1) {
        this.token = null;
        this.tokenExpiresAt = null;
        logger.info('Printrove: token expired, refreshing');
        continue;
      }

      // 4xx (except 401/429) = don't retry
      if (
        result.error &&
        result.error.httpStatus >= 400 &&
        result.error.httpStatus < 500 &&
        result.error.httpStatus !== 429
      ) {
        throw new ValidationError(
          `Printrove ${method} ${path} rejected: ${result.error.message}`,
          result.error,
        );
      }

      lastError = result;
      if (attempt < maxRetries) {
        const backoff = 500 * 2 ** (attempt - 1);
        logger.warn({ attempt, backoff, path, status: result.error?.httpStatus }, 'Printrove retrying');
        await sleep(backoff);
      }
    }

    throw new UpstreamError(
      `Printrove ${method} ${path} failed after ${maxRetries} attempts`,
      lastError?.error,
    );
  }

  private async doRequest<T>(method: string, path: string, body: unknown, attempt: number): Promise<ApiResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const token = await this.getToken();
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Zojo-Fashion/1.0',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      let responseBody: unknown = null;
      try {
        responseBody = await res.json();
      } catch {
        // non-JSON response
      }

      if (res.ok) {
        return { success: true, data: responseBody as T };
      }

      const errBody = responseBody as { message?: string; error?: string } | null;
      return {
        success: false,
        error: {
          code: `HTTP_${res.status}`,
          message: errBody?.message ?? errBody?.error ?? (res.statusText || 'Unknown error'),
          httpStatus: res.status,
          details: errBody,
        },
      };
    } catch (err) {
      if (err instanceof ValidationError || err instanceof UpstreamError) throw err;
      logger.warn({ err, attempt, path }, 'Printrove network error');
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
// Singleton
// ============================================================

export const printrove = new PrintroveClient({
  baseUrl: env.PRINTROVE_API_URL,
  email: env.PRINTROVE_EMAIL,
  password: env.PRINTROVE_PASSWORD,
  webhookSecret: env.PRINTROVE_WEBHOOK_SECRET,
});

// ============================================================
// Adapter — pushOrder() used by payments.service.ts
// Converts our internal shape → Printrove's actual API format
// ============================================================

export interface PushOrderInput {
  externalOrderId: string;    // our orderNumber
  totalRupees: number;        // retail_price for Printrove
  items: Array<{
    printroveVariantId: string;  // maps to variant_id (int) or product_id
    quantity: number;
    designFrontId?: number;
    designBackId?: number;
  }>;
  shippingAddress: {
    fullName: string;
    phone: string;          // E.164 format (+91XXXXXXXXXX)
    line1: string;
    line2?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  customer?: { name: string; email: string; phone: string };
  isCod?: boolean;
}

export interface PushOrderResponse {
  printroveOrderId: string;
  status: string;
}

/** Strip +91 prefix → 10-digit number for Printrove */
function toIndianPhone(phone: string): number {
  const cleaned = phone.replace(/\D/g, '');
  const digits = cleaned.startsWith('91') && cleaned.length === 12
    ? cleaned.slice(2)
    : cleaned;
  return parseInt(digits, 10);
}

export async function pushOrder(input: PushOrderInput): Promise<PushOrderResponse> {
  const addr = input.shippingAddress;
  const cust = input.customer;

  const customer: PrintroveCustomer = {
    name: cust?.name ?? addr.fullName,
    email: cust?.email,
    number: toIndianPhone(cust?.phone ?? addr.phone),
    address1: addr.line1,
    address2: addr.line2 ?? '-',
    address3: addr.landmark,
    pincode: parseInt(addr.pincode, 10),
    state: addr.state,
    city: addr.city,
    country: addr.country === 'IN' ? 'India' : addr.country,
  };

  const order = await printrove.createOrder({
    reference_number: input.externalOrderId,
    retail_price: input.totalRupees,
    customer,
    order_products: input.items.map((i) => ({
      variant_id: parseInt(i.printroveVariantId, 10) || undefined,
      quantity: i.quantity,
      // If design IDs are provided, include placement (default full-print dimensions)
      ...(i.designFrontId || i.designBackId
        ? {
            design: {
              ...(i.designFrontId
                ? { front: { id: i.designFrontId, dimensions: { width: 3000, height: 3000, top: 10, left: 50 } } }
                : {}),
              ...(i.designBackId
                ? { back: { id: i.designBackId, dimensions: { width: 3000, height: 3000, top: 10, left: 50 } } }
                : {}),
            },
          }
        : {}),
    })),
    cod: input.isCod ?? false,
  });

  return {
    printroveOrderId: String(order.id ?? order.reference_number),
    status: order.status ?? 'pending',
  };
}

export const verifyPrintroveWebhook = (rawBody: string, signature: string): boolean =>
  printrove.verifyWebhookSignature(rawBody, signature);
