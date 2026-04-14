'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';

export interface ProductDetailsSection {
  id: string;
  title: string;
  content: ReactNode;
}

export interface ProductDetailsAccordionProps {
  sections: ProductDetailsSection[];
  defaultOpenId?: string;
}

/**
 * Single-open accordion for PDP info sections.
 * Keyboard: Enter/Space toggle; Tab moves between triggers.
 */
export function ProductDetailsAccordion({
  sections,
  defaultOpenId,
}: ProductDetailsAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? sections[0]?.id ?? null);
  const reduce = useReducedMotion();

  return (
    <div className="divide-y divide-bg-border border-y border-bg-border">
      {sections.map((s) => {
        const isOpen = openId === s.id;
        return (
          <div key={s.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`panel-${s.id}`}
              id={`trigger-${s.id}`}
              onClick={() => setOpenId(isOpen ? null : s.id)}
              className={cn(
                'flex w-full items-center justify-between gap-3 py-4 text-left transition-colors',
                'hover:text-accent',
              )}
            >
              <span className="font-display text-lg tracking-wide text-fg-primary">
                {s.title}
              </span>
              <ChevronIcon open={isOpen} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.section
                  key="panel"
                  id={`panel-${s.id}`}
                  role="region"
                  aria-labelledby={`trigger-${s.id}`}
                  initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="pb-5 pr-4 text-sm leading-relaxed text-fg-secondary">
                    {s.content}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('h-5 w-5 transition-transform duration-200', open && 'rotate-180')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}
