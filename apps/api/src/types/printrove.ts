/**
 * Printrove API types — based on https://api.printrove.com/docs/
 * Base URL: https://api.printrove.com/api/external
 * Auth: JWT via POST /api/external/token (email + password)
 */

// ─── Auth ───────────────────────────────────────────────

export interface PrintroveTokenRequest {
  email: string;
  password: string;
}

export interface PrintroveTokenResponse {
  access_token: string;
  expires_at: string; // ISO datetime e.g. "2022-02-03T09:54:34.000000"
}

// ─── Orders ─────────────────────────────────────────────

export interface PrintroveCustomer {
  name: string;           // 3-50 chars
  email?: string;
  number: number;         // 10-digit Indian phone (no +91 prefix)
  address1: string;       // 3-50 chars
  address2: string;       // 3-50 chars
  address3?: string;      // landmark
  pincode: number;        // 6-digit
  state?: string;
  city?: string;
  country: string;        // "India" or 2-letter code
}

export interface PrintroveDesignDimensions {
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface PrintroveDesignPlacement {
  id: number;             // design ID from Design Library
  dimensions: PrintroveDesignDimensions;
}

export interface PrintroveOrderProduct {
  product_id?: number;
  variant_id?: number;
  design?: {
    front?: PrintroveDesignPlacement;
    back?: PrintroveDesignPlacement;
  };
  quantity: number;
  is_plain?: boolean;
}

export interface PrintroveCreateOrderRequest {
  reference_number: string;   // our orderNumber — unique
  retail_price: number;       // INR, must be > 0
  customer: PrintroveCustomer;
  order_products: PrintroveOrderProduct[];
  courier_id?: number;        // auto-selected if omitted
  cod: boolean;
  invoice_url?: string;
}

export interface PrintroveOrder {
  id: number;
  reference_number: string;
  status: string;
  tracking_number?: string;
  courier?: string;
  created_at: string;
  updated_at: string;
}

// ─── Products / Catalog ─────────────────────────────────

export interface PrintroveProduct {
  id: number;
  name: string;
  sku?: string;
  variants?: PrintroveProductVariant[];
}

export interface PrintroveProductVariant {
  id: number;
  sku: string;
  size: string;
  color: string;
  price: number;
}

// ─── Serviceability ─────────────────────────────────────

export interface PrintroveServiceabilityParams {
  country: string;
  pincode: string;
  weight: string;       // grams
  cod?: string;         // "true" / "false"
}

// ─── Paginated response ─────────────────────────────────

export interface PrintrovePaginatedResponse<T> {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

// ─── Webhook events (Printrove sends status updates) ────

export type PrintroveWebhookEvent =
  | { event: 'order.in_production'; order_id: string; external_order_id: string; at: string }
  | { event: 'order.shipped'; order_id: string; external_order_id: string; at: string; shipment: { awb_number: string; courier: string; courier_service_code?: string; tracking_url: string; shipped_at?: string; delivered_at?: string; estimated_delivery_at?: string } }
  | { event: 'order.out_for_delivery'; order_id: string; external_order_id: string; at: string }
  | { event: 'order.delivered'; order_id: string; external_order_id: string; at: string }
  | { event: 'order.cancelled'; order_id: string; external_order_id: string; at: string; reason?: string }
  | { event: 'order.rto'; order_id: string; external_order_id: string; at: string; reason?: string };

export type PrintroveWebhookEventType = PrintroveWebhookEvent['event'];
