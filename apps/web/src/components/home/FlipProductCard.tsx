'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useSyncExternalStore, useEffect } from 'react';
import { motion } from 'framer-motion';
import { inr } from '@/lib/format';
import { useCart } from '@/hooks/useCart';

export interface FlipProductCardData {
  id: string;
  slug: string;
  title: string;
  basePrice: number;
  compareAtPrice: number | null;
  animeSeries: string | null;
  frontImage: { url: string; alt: string | null };
  backImage: { url: string; alt: string | null } | null;
  /** When null (e.g. API without variants), Quick Add is hidden. */
  defaultVariantId: string | null;
  defaultVariantLabel: string | null;
}

/** next/image can't optimize data: URLs; bypass when detected. */
const isDataUrl = (src: string): boolean => src.startsWith('data:');

/** Desktop hover flip only — back mockup is ~1MB; load it on first pointer/hover, not for every card up front. */
function useMediaMd() {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined') return () => undefined;
      const m = window.matchMedia('(min-width: 768px)');
      m.addEventListener('change', notify);
      return () => m.removeEventListener('change', notify);
    },
    () => (typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false),
    () => false,
  );
}

/**
 * Featured product card with front/back hover flip (desktop) and a
 * Quick-Add button. Card structure:
 *
 *   <article>
 *     <Link>  ← wraps only the visual + title/price
 *     <button>← sibling, overlaid via absolute; NEVER nested inside <a>
 *   </article>
 *
 * This keeps HTML valid (no <button> inside <a>) and preserves native
 * keyboard order: Tab lands on card link, then Quick Add button.
 */
export function FlipProductCard({
  product,
  priority = false,
}: {
  product: FlipProductCardData;
  priority?: boolean;
}) {
  const { add } = useCart();
  const isMd = useMediaMd();
  const [loadBack, setLoadBack] = useState(false);
  const [backReady, setBackReady] = useState(false);
  const canFlip = isMd && !!product.backImage;
  const shouldRenderBack = canFlip && loadBack;

  useEffect(() => {
    setLoadBack(false);
    setBackReady(false);
  }, [product.slug]);

  const discount =
    product.compareAtPrice && product.compareAtPrice > product.basePrice
      ? Math.round(
          ((product.compareAtPrice - product.basePrice) / product.compareAtPrice) * 100,
        )
      : null;

  const onQuickAdd = () => {
    if (!product.defaultVariantId) return;
    add({
      variantId: product.defaultVariantId,
      productId: product.id,
      productTitle: product.title,
      productSlug: product.slug,
      variantLabel: product.defaultVariantLabel ?? '',
      imageUrl: product.frontImage.url,
      unitPricePaise: product.basePrice,
      quantity: 1,
    });
  };

  const frontUnopt = isDataUrl(product.frontImage.url);
  const backUnopt = product.backImage ? isDataUrl(product.backImage.url) : false;

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="group relative"
      onPointerEnter={() => {
        if (canFlip) setLoadBack(true);
      }}
      onPointerDown={() => {
        if (canFlip) setLoadBack(true);
      }}
    >
      {/* Visual — the clickable card. NO interactive children inside this Link. */}
      <Link
        href={`/products/${product.slug}`}
        aria-label={product.title}
        className="block"
        onFocus={() => {
          if (canFlip) setLoadBack(true);
        }}
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-bg-elevated">
          <Image
            src={product.frontImage.url}
            alt={product.frontImage.alt ?? product.title}
            fill
            priority={priority}
            unoptimized={frontUnopt}
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`
              object-cover transition-opacity duration-500 ease-out
              ${product.backImage && canFlip && backReady ? 'md:group-hover:opacity-0' : ''}
            `}
          />

          {shouldRenderBack && product.backImage && (
            <Image
              src={product.backImage.url}
              alt={product.backImage.alt ?? `${product.title} (back)`}
              fill
              loading="lazy"
              unoptimized={backUnopt}
              onLoad={() => setBackReady(true)}
              onError={() => setBackReady(true)}
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="absolute inset-0 object-cover opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
            />
          )}

          {/* Bottom gradient for legibility of overlaid button */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
          />

          {discount && (
            <span className="absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 font-mono text-[11px] font-bold text-white shadow-glow-sm">
              −{discount}%
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1.5 px-0.5">
          <h3 className="line-clamp-2 text-sm font-semibold text-fg-primary transition-colors group-hover:text-accent">
            {product.title}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-fg-primary">{inr(product.basePrice)}</span>
            {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
              <span className="text-xs text-fg-muted line-through">
                {inr(product.compareAtPrice)}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Quick Add — absolute sibling of Link, overlays the image area.
          NOT inside the <a> (would be invalid HTML + keyboard trap). */}
      {product.defaultVariantId && (
        <button
          type="button"
          onClick={onQuickAdd}
          aria-label={`Quick add ${product.title} to cart`}
          className="
            absolute inset-x-3 bottom-[88px] flex items-center justify-center gap-2
            rounded-lg bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white
            shadow-glow-sm transition-all
            translate-y-2 opacity-100 md:translate-y-4 md:opacity-0
            md:group-hover:translate-y-0 md:group-hover:opacity-100
            hover:bg-accent-hover hover:shadow-glow
            focus-visible:opacity-100 focus-visible:translate-y-0
          "
        >
          <BagPlusIcon className="h-4 w-4" />
          Quick Add
        </button>
      )}
    </motion.article>
  );
}

function BagPlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M12 11v6M9 14h6" />
    </svg>
  );
}
