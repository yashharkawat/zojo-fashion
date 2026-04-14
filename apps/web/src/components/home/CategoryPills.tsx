'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';

const CATEGORIES = [
  { slug: 'oversized',       label: 'Oversized',       accent: false },
  { slug: 'regular',         label: 'Regular',         accent: false },
  { slug: 'limited-edition', label: 'Limited Edition', accent: true  },
] as const;

export function CategoryPills() {
  const reduce = useReducedMotion();

  return (
    <section
      aria-label="Categories"
      className="mx-auto max-w-7xl px-4 py-10 md:py-14"
    >
      <div className="flex flex-wrap justify-center gap-3 md:gap-4">
        {CATEGORIES.map((c, i) => (
          <motion.div
            key={c.slug}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
          >
            <Link
              href={`/products?category=${c.slug}`}
              className={`
                group inline-flex items-center gap-2 rounded-full border px-5 py-2.5
                font-display text-lg tracking-[0.2em] uppercase transition-all
                ${
                  c.accent
                    ? 'border-accent bg-accent/10 text-accent hover:bg-accent hover:text-white hover:shadow-glow'
                    : 'border-bg-border bg-bg-elevated text-fg-primary hover:border-accent hover:text-accent'
                }
              `}
            >
              {c.accent && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
              {c.label}
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
