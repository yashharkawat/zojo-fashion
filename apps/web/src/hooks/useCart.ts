'use client';

import { useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  addItem,
  removeItem,
  updateQuantity,
  clearCart,
  selectCartItems,
  selectCartCount,
  selectCartSubtotalPaise,
  type CartLine,
} from '@/store/slices/cartSlice';
import { openCartDrawer } from '@/store/slices/uiSlice';

export function useCart() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectCartItems);
  const count = useAppSelector(selectCartCount);
  const subtotalPaise = useAppSelector(selectCartSubtotalPaise);

  return useMemo(
    () => ({
      items,
      count,
      subtotalPaise,
      add: (line: Omit<CartLine, 'addedAt'>, openDrawer = true) => {
        dispatch(addItem(line));
        if (openDrawer) dispatch(openCartDrawer());
      },
      update: (variantId: string, quantity: number) =>
        dispatch(updateQuantity({ variantId, quantity })),
      remove: (variantId: string) => dispatch(removeItem(variantId)),
      clear: () => dispatch(clearCart()),
    }),
    [dispatch, items, count, subtotalPaise],
  );
}
