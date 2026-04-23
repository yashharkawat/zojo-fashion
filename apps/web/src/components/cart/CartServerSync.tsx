'use client';

import { useEffect, useRef } from 'react';
import { useAppSelector } from '@/store/hooks';
import { useAuth } from '@/hooks/useAuth';
import { putCart } from '@/features/cart/api';

const DEBOUNCE_MS = 450;

/**
 * Persists the Redux cart to the API when the user is logged in (debounced).
 * The first effect after auth is skipped (bootstrap has merged or loaded from server).
 */
export function CartServerSync() {
  const { isAuthenticated } = useAuth();
  const cart = useAppSelector((s) => s.cart);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipOnePut = useRef(true);

  useEffect(() => {
    if (!isAuthenticated) {
      skipOnePut.current = true;
      return;
    }
    if (skipOnePut.current) {
      skipOnePut.current = false;
      return;
    }
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => {
      void putCart({
        items: cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        couponCode: cart.couponCode,
      }).catch(() => {
        /* keep local */
      });
    }, DEBOUNCE_MS);
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, [isAuthenticated, cart]);
  return null;
}
