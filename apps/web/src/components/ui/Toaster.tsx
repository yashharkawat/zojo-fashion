'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { dismissToast, type Toast } from '@/store/slices/uiSlice';
import { useHasMounted } from '@/hooks/useHasMounted';
import { cn } from '@/lib/cn';

const KIND_STYLE: Record<Toast['kind'], string> = {
  info:    'border-cyan/30 bg-bg-elevated',
  success: 'border-success/40 bg-bg-elevated',
  warning: 'border-warn/40 bg-bg-elevated',
  error:   'border-danger/50 bg-bg-elevated',
};

const KIND_ACCENT: Record<Toast['kind'], string> = {
  info:    'bg-cyan',
  success: 'bg-success',
  warning: 'bg-warn',
  error:   'bg-danger',
};

export function Toaster() {
  const mounted = useHasMounted();
  const toasts = useAppSelector((s) => s.ui.toasts);
  const dispatch = useAppDispatch();
  const reduce = useReducedMotion();

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    for (const t of toasts) {
      if (t.duration > 0) {
        timers.push(setTimeout(() => dispatch(dismissToast(t.id)), t.duration));
      }
    }
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts, dispatch]);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            role="status"
            layout
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-lg border shadow-lg',
              KIND_STYLE[t.kind],
            )}
          >
            <span aria-hidden className={cn('w-1 self-stretch', KIND_ACCENT[t.kind])} />
            <p className="flex-1 py-3 pr-2 text-sm text-fg-primary">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dispatch(dismissToast(t.id))}
              className="px-3 py-3 text-fg-muted hover:text-fg-primary"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
