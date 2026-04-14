'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Max-width class (Tailwind). Default 'max-w-lg' */
  widthClass?: string;
  labelId?: string;
}

/**
 * Accessible modal dialog.
 * - Portaled to body
 * - Focus trap (basic — first/last focusable cycling)
 * - Escape to close
 * - Scroll lock while open
 * - Respects reduced-motion
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  widthClass = 'max-w-lg',
  labelId = 'modal-title',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Scroll lock + focus management + escape
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const prevActive = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      // Simple focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      prevActive?.focus();
    };
  }, [open, onClose]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.15 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? labelId : undefined}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className={`
              w-full ${widthClass} max-h-[90vh] overflow-hidden
              rounded-t-2xl md:rounded-2xl
              border border-bg-border bg-bg-elevated shadow-2xl
              flex flex-col
            `}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-bg-border px-5 py-4">
                <h2 id={labelId} className="font-display text-2xl tracking-wide text-fg-primary">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-md p-1.5 text-fg-secondary transition-colors hover:bg-bg-overlay hover:text-fg-primary"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
              </div>
            )}
            <div className="overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
