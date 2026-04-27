import { api, apiWithMeta } from '@/lib/api';
import type {
  AdminOrder,
  AdminAnalytics,
  AdminProduct,
  OrderStatus,
  Pagination,
} from './types';
import { getStoredAccessToken } from '@/lib/authStorage';

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function paginated<T>(path: string): Promise<{ data: T[]; pagination: Pagination }> {
  const { data, meta } = await apiWithMeta<T[]>(path);
  const pagination = (meta as { pagination?: Pagination }).pagination;
  if (!pagination) {
    throw new Error(`Expected pagination meta on ${path}`);
  }
  return { data, pagination };
}

export interface AdminOrdersFilter {
  status?: OrderStatus;
  userId?: string;
  orderNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminProductsFilter {
  isActive?: boolean;
  categorySlug?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const adminApi = {
  // ─── Orders ─────────────────────────────────────────────
  listOrders: (filter: AdminOrdersFilter = {}) =>
    paginated<AdminOrder>(`/admin/orders${qs(filter as Record<string, string | number | boolean | undefined | null>)}`),

  updateOrderStatus: (
    id: string,
    body: {
      status: OrderStatus;
      reason?: string;
      trackingInfo?: { courier: string; awb: string; trackingUrl?: string };
    },
  ) => api<AdminOrder>(`/admin/orders/${id}/status`, { method: 'PUT', body }),

  markManualReview: (id: string, note?: string) =>
    api<{ ok: true }>(`/admin/orders/${id}/mark-manual-review`, {
      method: 'POST',
      body: { note },
    }),

  // ─── Analytics ──────────────────────────────────────────
  analytics: (filter: { from?: string; to?: string } = {}) =>
    api<AdminAnalytics>(`/admin/analytics${qs(filter)}`),

  // ─── Products ───────────────────────────────────────────
  listProducts: (filter: AdminProductsFilter = {}) =>
    paginated<AdminProduct>(`/admin/products${qs(filter as Record<string, string | number | boolean | undefined | null>)}`),

  updateProduct: (id: string, body: unknown) =>
    api<AdminProduct>(`/products/${id}`, { method: 'PUT', body }),

  createProduct: (body: unknown) =>
    api<AdminProduct>(`/products`, { method: 'POST', body }),

  setDefaultColor: (id: string, color: string) =>
    api<{ ok: boolean; defaultColor: string }>(`/admin/products/${id}/default-color`, {
      method: 'PATCH',
      body: { color },
    }),

  quickCreateProduct: async (formData: FormData): Promise<AdminProduct> => {
    const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    const token = getStoredAccessToken();

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE}/admin/products/quick-create`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });
    const json = (await res.json()) as { data?: AdminProduct; error?: { message: string } };
    if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Upload failed');
    return json.data!;
  },
};
