'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { FlipProductCard, type FlipProductCardData } from './FlipProductCard';

/**
 * Featured product grid. Pass `products` from a server fetch or React Query.
 * Demo placeholder data lives in the home page file.
 */
export function FeaturedCollection({
  title,
  subtitle,
  products,
  viewAllHref = '/products',
}: {
  title: string;
  subtitle?: string;
  products: FlipProductCardData[];
  viewAllHref?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <section aria-label={title} className="mx-auto max-w-7xl px-4 py-12 md:py-16">
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.4 }}
        className="mb-8 flex items-end justify-between gap-4 md:mb-10"
      >
        <div>
          {subtitle && (
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-accent">
              {subtitle}
            </p>
          )}
          <h2 className="font-display text-4xl tracking-tight text-fg-primary md:text-5xl">
            {title}
          </h2>
        </div>
        <Link
          href={viewAllHref}
          className="group hidden items-center gap-2 text-sm uppercase tracking-widest text-fg-secondary transition-colors hover:text-accent md:inline-flex"
        >
          View all
          <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </motion.header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {products.map((p, i) => (
          <motion.div
            key={p.id}
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: Math.min(i, 4) * 0.05 }}
          >
            <FlipProductCard product={p} priority={i < 2} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
