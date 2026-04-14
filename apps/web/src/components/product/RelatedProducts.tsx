'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { FlipProductCard, type FlipProductCardData } from '@/components/home/FlipProductCard';

export interface RelatedProductsProps {
  title?: string;
  products: FlipProductCardData[];
}

export function RelatedProducts({ title = 'You may also like', products }: RelatedProductsProps) {
  const reduce = useReducedMotion();
  if (products.length === 0) return null;

  return (
    <section aria-label={title} className="mx-auto max-w-7xl px-4 py-12 md:py-16">
      <motion.h2
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="mb-8 font-display text-3xl tracking-tight text-fg-primary md:text-4xl"
      >
        {title}
      </motion.h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {products.slice(0, 4).map((p, i) => (
          <motion.div
            key={p.id}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
          >
            <FlipProductCard product={p} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
