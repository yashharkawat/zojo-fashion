'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeCartDrawer } from '@/store/slices/uiSlice';
import { useCart } from '@/hooks/useCart';
import { useHasMounted } from '@/hooks/useHasMounted';
import { computeCartPricing } from '@/lib/pricing';
import { inr } from '@/lib/format';
import { CartLineItem } from './CartLineItem';

export function CartDrawer() {
  const mounted = useHasMounted();
  const open = useAppSelector((s) => s.ui.cartDrawerOpen);
  const couponCode = useAppSelector((s) => s.cart.couponCode);
  const dispatch = useAppDispatch();
  const { items, count, update, remove } = useCart();
  const reduce = useReducedMotion();

  // Escape + scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dispatch(closeCartDrawer());
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, dispatch]);

  if (!mounted) return null;

  const pricing = computeCartPricing({
    items: items.map((i) => ({ unitPricePaise: i.unitPricePaise, quantity: i.quantity })),
    coupon: null, // drawer shows subtotal only; full coupon preview on cart page
  });

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
          onClick={() => dispatch(closeCartDrawer())}
          aria-hidden
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-bg-border bg-bg-base shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-bg-border px-5 py-4">
              <h2 className="font-display text-2xl tracking-wide text-fg-primary">
                Cart <span className="text-fg-muted">({count})</span>
              </h2>
              <button
                type="button"
                aria-label="Close cart"
                onClick={() => dispatch(closeCartDrawer())}
                className="rounded-md p-2.5 text-fg-secondary hover:bg-bg-elevated hover:text-fg-primary"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </header>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="font-display text-xl text-fg-primary">Your cart is quiet.</p>
                <p className="text-sm text-fg-secondary">Let's change that.</p>
                <Link
                  href="/products"
                  onClick={() => dispatch(closeCartDrawer())}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-white hover:bg-accent-hover"
                >
                  Browse
                </Link>
              </div>
            ) : (
              <>
                <ul className="flex-1 space-y-2 overflow-y-auto p-3">
                  {items.map((line) => (
                    <CartLineItem
                      key={line.variantId}
                      line={line}
                      onUpdateQty={update}
                      onRemove={remove}
                      compact
                    />
                  ))}
                </ul>

                <footer className="border-t border-bg-border p-5">
                  {couponCode && (
                    <p className="mb-2 text-xs text-accent">Coupon {couponCode} will apply at checkout.</p>
                  )}
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm text-fg-secondary">Subtotal</span>
                    <span className="font-mono text-lg font-bold text-fg-primary">
                      {inr(pricing.subtotalPaise)}
                    </span>
                  </div>
                  <Link
                    href="/checkout"
                    onClick={() => dispatch(closeCartDrawer())}
                    className="flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow"
                  >
                    Checkout
                  </Link>
                  <Link
                    href="/cart"
                    onClick={() => dispatch(closeCartDrawer())}
                    className="mt-2 block text-center text-xs text-fg-secondary hover:text-fg-primary"
                  >
                    View full cart
                  </Link>
                </footer>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
