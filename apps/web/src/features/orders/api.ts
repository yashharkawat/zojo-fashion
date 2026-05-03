import { api, apiWithMeta } from '@/lib/api';

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

/** Full order for track page — shape from GET /orders/:id */
export type MyOrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  couponCode: string | null;
  placedAt: string;
  shippingAddressSnapshot: Record<string, unknown>;
  items: Array<{
    id: string;
    productTitle: string;
    variantLabel: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    variant?: { product?: { slug?: string } };
  }>;
  payment: {
    status: string;
    method: string | null;
    razorpayPaymentId: string | null;
  } | null;
  shipment: {
    status: string;
    awbNumber: string | null;
    trackingUrl: string | null;
    courier: string | null;
    shippedAt: string | null;
    estimatedDeliveryAt: string | null;
    deliveredAt: string | null;
  } | null;
};

export type MyOrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  placedAt: string;
  items: Array<{
    id: string;
    productTitle: string;
    variantLabel: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
  }>;
  shipment: { status: string; awbNumber: string | null; trackingUrl: string | null } | null;
};

export async function listMyOrders(params?: { page?: number; pageSize?: number }) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.pageSize) sp.set('pageSize', String(params.pageSize));
  const q = sp.toString();
  const { data, meta } = await apiWithMeta<MyOrderListItem[]>(`/orders/my${q ? `?${q}` : ''}`, {
    method: 'GET',
  });
  const pagination = (meta as { pagination?: Pagination }).pagination;
  if (!pagination) throw new Error('Expected pagination meta from /orders/my');
  return { data, pagination };
}

export async function getMyOrder(idOrOrderNumber: string) {
  return api<MyOrderDetail>(`/orders/${encodeURIComponent(idOrOrderNumber)}`, { method: 'GET' });
}
