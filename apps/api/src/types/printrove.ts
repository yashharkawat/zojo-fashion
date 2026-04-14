/**
 * Printrove API type definitions.
 *
 * NOTE: These reflect a reasonable model based on standard POD API conventions.
 * Cross-check against the current Printrove docs before go-live and adjust
 * the adapter in `lib/printrove.ts` (NOT the consumers) if shapes differ.
 */

// ============================================================
// Common
// ============================================================

export interface PrintroveAddress {
  name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string; // ISO-2, e.g., "IN"
}

/** Discriminated result envelope used by every client method. */
export type PrintroveApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: PrintroveApiErrorDetail };

export interface PrintroveApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
  httpStatus: number;
}

// ============================================================
// Orders
// ============================================================

export interface PrintroveCreateOrderRequest {
  external_order_id: string; // our orderNumber, idempotent on their side
  items: PrintroveOrderLineInput[];
  shipping_address: PrintroveAddress;
  customer: { name: string; email: string; phone: string };
  cod?: { enabled: boolean; amount_paise?: number };
  notes?: string;
}

export interface PrintroveOrderLineInput {
  variant_id: string; // Printrove's variant id (mapped in our ProductVariant.printroveVariantId)
  quantity: number;
}

export type PrintroveOrderStatus =
  | 'pending'
  | 'in_production'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rto';

export interface PrintroveOrder {
  order_id: string;
  external_order_id: string;
  status: PrintroveOrderStatus;
  created_at: string;
  updated_at: string;
  items: PrintroveOrderLine[];
  shipment?: PrintroveShipmentInfo;
}

export interface PrintroveOrderLine {
  line_id: string;
  variant_id: string;
  quantity: number;
  printed_at?: string;
}

export interface PrintroveShipmentInfo {
  awb_number: string;
  courier: string;
  courier_service_code?: string;
  tracking_url: string;
  shipped_at?: string;
  delivered_at?: string;
  estimated_delivery_at?: string;
}

// ============================================================
// Webhook events — discriminated union by `event`
// ============================================================

interface WebhookBase {
  order_id: string;      // Printrove's id
  external_order_id: string;
  at: string;            // ISO timestamp
}

export type PrintroveWebhookEvent =
  | ({ event: 'order.in_production' } & WebhookBase)
  | ({ event: 'order.shipped'; shipment: PrintroveShipmentInfo } & WebhookBase)
  | ({ event: 'order.out_for_delivery' } & WebhookBase)
  | ({ event: 'order.delivered' } & WebhookBase)
  | ({ event: 'order.cancelled'; reason?: string } & WebhookBase)
  | ({ event: 'order.rto'; reason?: string } & WebhookBase);

export type PrintroveWebhookEventType = PrintroveWebhookEvent['event'];

// ============================================================
// Products (for admin catalog sync — not used in MVP customer flow)
// ============================================================

export interface PrintroveProduct {
  product_id: string;
  title: string;
  variants: PrintroveProductVariant[];
}

export interface PrintroveProductVariant {
  variant_id: string;
  sku: string;
  size: string;
  color: string;
  price_paise: number;
}
