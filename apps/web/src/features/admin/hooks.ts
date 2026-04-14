'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminOrdersFilter, type AdminProductsFilter } from './api';
import type { OrderStatus } from './types';

export const adminKeys = {
  all: ['admin'] as const,
  orders: (filter: AdminOrdersFilter) => ['admin', 'orders', filter] as const,
  analytics: (filter: { from?: string; to?: string }) => ['admin', 'analytics', filter] as const,
  products: (filter: AdminProductsFilter) => ['admin', 'products', filter] as const,
};

export function useAdminOrders(filter: AdminOrdersFilter = {}) {
  return useQuery({
    queryKey: adminKeys.orders(filter),
    queryFn: () => adminApi.listOrders(filter),
    placeholderData: (prev) => prev,
  });
}

export function useAdminAnalytics(filter: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: adminKeys.analytics(filter),
    queryFn: () => adminApi.analytics(filter),
    staleTime: 5 * 60 * 1000, // analytics change slowly
  });
}

export function useAdminProducts(filter: AdminProductsFilter = {}) {
  return useQuery({
    queryKey: adminKeys.products(filter),
    queryFn: () => adminApi.listProducts(filter),
    placeholderData: (prev) => prev,
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
      trackingInfo,
    }: {
      id: string;
      status: OrderStatus;
      reason?: string;
      trackingInfo?: { courier: string; awb: string; trackingUrl?: string };
    }) => adminApi.updateOrderStatus(id, { status, reason, trackingInfo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      qc.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    },
  });
}

export function useRetryPrintrove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.retryPrintrove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'orders'] }),
  });
}

export function useSyncPrintrove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.syncPrintrove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'orders'] }),
  });
}
