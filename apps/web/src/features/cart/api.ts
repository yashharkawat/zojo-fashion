import { api } from '@/lib/api';
import type { CartState, CartLine } from '@/store/slices/cartSlice';

export type ServerCartItem = {
  id: string;
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPricePaise: number;
  quantity: number;
  addedAt: number;
};

export type ServerCart = {
  items: ServerCartItem[];
  couponCode: string | null;
};

export function getCart() {
  return api<ServerCart>('/cart', { method: 'GET' });
}

export function putCart(body: { items: { variantId: string; quantity: number }[]; couponCode?: string | null }) {
  return api<ServerCart>('/cart', { method: 'PUT', body });
}

export function mergeCart(body: { items: { variantId: string; quantity: number }[] }) {
  return api<ServerCart>('/cart/merge', { method: 'POST', body });
}

export function clearServerCart() {
  return api<{ ok: boolean }>('/cart', { method: 'DELETE' });
}

export function serverCartToState(data: ServerCart): CartState {
  const items: CartLine[] = data.items.map((row) => ({
    variantId: row.variantId,
    productId: row.productId,
    productTitle: row.productTitle,
    productSlug: row.productSlug,
    variantLabel: row.variantLabel,
    imageUrl: row.imageUrl,
    unitPricePaise: row.unitPricePaise,
    quantity: row.quantity,
    addedAt: row.addedAt,
  }));
  return {
    items,
    couponCode: data.couponCode,
    lastModified: Date.now(),
  };
}
