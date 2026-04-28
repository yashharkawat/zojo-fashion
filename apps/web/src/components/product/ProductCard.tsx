'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { inr } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  basePrice: number;          // paise
  compareAtPrice: number | null;
  animeSeries: string | null;
  primaryImage: { url: string; alt: string | null } | null;
  avgRating: number | null;
  reviewCount: number;
}

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.basePrice
      ? Math.round(((product.compareAtPrice - product.basePrice) / product.compareAtPrice) * 100)
      : null;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="group"
    >
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-bg-elevated">
          {product.primaryImage ? (
            <Image
              src={product.primaryImage.url}
              alt={product.primaryImage.alt ?? product.title}
              fill
              priority={priority}
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-fg-muted">No image</div>
          )}

          {discount && (
            <span className="absolute right-3 top-3 rounded-full bg-pink px-2 py-1 text-xs font-bold text-white">
              −{discount}%
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1">
          <h3 className="line-clamp-2 text-sm font-medium text-fg-primary group-hover:text-accent transition-colors">
            {product.title}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-base font-bold text-fg-primary">{inr(product.basePrice)}</span>
            {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
              <span className={cn('font-mono text-xs text-fg-muted line-through')}>
                {inr(product.compareAtPrice)}
              </span>
            )}
          </div>
          {product.avgRating !== null && product.reviewCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-fg-secondary">
              <span className="text-warn">★</span>
              <span>{product.avgRating.toFixed(1)}</span>
              <span className="text-fg-muted">({product.reviewCount})</span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
