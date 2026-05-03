/** Admin-facing types. Mirror the backend admin service response shapes. */

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PRINTING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface AdminOrderUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  subtotal: number;
  total: number;
  user: AdminOrderUser;
  items: Array<{ productTitle: string; variantLabel: string; quantity: number; lineTotal?: number }>;
  payment: { status: string; method: string | null; razorpayPaymentId: string | null } | null;
  shipment: { status: string; awbNumber: string | null; courier: string | null; trackingUrl: string | null } | null;
  // Present on GET /admin/orders/:id (detail view only)
  shippingAddressSnapshot?: Record<string, string> | null;
}

export interface AdminAnalytics {
  range: { from: string; to: string };
  revenue: { gross: number; net: number; refunds: number };
  orders: { total: number; paid: number; cancelled: number; refunded: number };
  aov: number;
  topProducts: Array<{ title: string; unitsSold: number; revenue: number }>;
  topAnimeSeries: Array<{ series: string; orders: number; revenue: number }>;
  /** Added client-side or by an extended endpoint — daily revenue for the chart */
  daily?: Array<{ date: string; revenue: number; orders: number }>;
}

export interface AdminProduct {
  id: string;
  slug: string;
  title: string;
  basePrice: number;
  compareAtPrice: number | null;
  isActive: boolean;
  soldCount: number;
  avgRating: number | null;
  reviewCount: number;
  animeSeries: string | null;
  categorySlug: string;
  defaultColor: string | null;
  images: Array<{ url: string; alt: string | null }>;
  variants: Array<{ color: string; colorHex: string | null }>;
  createdAt: string;
  _count: { variants: number };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
