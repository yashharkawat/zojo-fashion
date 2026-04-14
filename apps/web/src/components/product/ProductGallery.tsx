'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import type { ProductImage } from '@/types/product';

const isDataUrl = (src: string): boolean => src.startsWith('data:');

export interface ProductGalleryProps {
  images: ProductImage[];
  title: string;
  /** Optional: external control if parent wants to sync variant-specific image */
  activeIndex?: number;
  onIndexChange?: (i: number) => void;
}

/**
 * Product gallery.
 * - Main image with hover-zoom on desktop (cursor-tracked transform)
 * - Swipe to change on mobile (framer-motion drag with velocity threshold)
 * - Thumbnail strip below
 * - Arrow-key navigation
 * - Accessible: announces image position, keyboard-focusable controls
 *
 * If the product has front+back images as the first two entries, the UI
 * renders a front/back toggle affordance in addition to the thumbnails.
 */
export function ProductGallery({
  images,
  title,
  activeIndex,
  onIndexChange,
}: ProductGalleryProps) {
  const [internalIdx, setInternalIdx] = useState(0);
  const idx = activeIndex ?? internalIdx;
  const setIdx = useCallback(
    (i: number) => {
      const clamped = (i + images.length) % images.length;
      setInternalIdx(clamped);
      onIndexChange?.(clamped);
    },
    [images.length, onIndexChange],
  );

  const reduce = useReducedMotion();
  const [zoom, setZoom] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });
  const frameRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!frameRef.current?.contains(document.activeElement as Node)) return;
      if (e.key === 'ArrowRight') setIdx(idx + 1);
      if (e.key === 'ArrowLeft')  setIdx(idx - 1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [idx, setIdx]);

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ x, y, active: true });
  };

  // Swipe (pointer events — works across touch/mouse/pen)
  const dragStartX = useRef<number | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragStartX.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) setIdx(idx + 1);
    else setIdx(idx - 1);
  };

  if (images.length === 0) {
    return (
      <div className="aspect-square w-full rounded-xl bg-bg-elevated" aria-label="No image" />
    );
  }

  const current = images[idx]!;

  return (
    <div className="flex flex-col gap-3">
      {/* Main frame */}
      <div
        ref={frameRef}
        className="relative aspect-square w-full overflow-hidden rounded-xl bg-bg-elevated"
        // Allow focus so arrow keys work
        tabIndex={0}
        role="region"
        aria-roledescription="image carousel"
        aria-label={`${title}, image ${idx + 1} of ${images.length}`}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setZoom((z) => ({ ...z, active: false }))}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <motion.div
          key={current.id}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
        >
          <Image
            src={current.url}
            alt={current.alt ?? `${title} — image ${idx + 1}`}
            fill
            priority={idx === 0}
            unoptimized={isDataUrl(current.url)}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className={cn(
              'object-cover transition-transform duration-300 ease-out',
              zoom.active ? 'scale-150' : 'scale-100',
            )}
            style={{
              transformOrigin: zoom.active ? `${zoom.x}% ${zoom.y}%` : 'center',
            }}
            draggable={false}
          />
        </motion.div>

        {/* Prev/next arrows — desktop visible, mobile relies on swipe */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIdx(idx - 1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-black/70 md:block"
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={() => setIdx(idx + 1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-black/70 md:block"
            >
              <ChevronIcon direction="right" />
            </button>
          </>
        )}

        {/* Front/Back toggle — shown when images[0] / images[1] exist */}
        {images.length >= 2 && idx < 2 && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-bg-border bg-black/70 p-1 backdrop-blur"
            role="tablist"
            aria-label="Front and back views"
          >
            {(['Front', 'Back'] as const).map((label, i) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={idx === i}
                onClick={() => setIdx(i)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition-all',
                  idx === i ? 'bg-accent text-white' : 'text-fg-secondary hover:text-fg-primary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Index pill — mobile helper */}
        <span
          aria-hidden
          className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 font-mono text-[10px] text-white backdrop-blur-sm md:hidden"
        >
          {idx + 1} / {images.length}
        </span>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div
          role="tablist"
          aria-label="Product images"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              role="tab"
              type="button"
              aria-selected={i === idx}
              aria-label={`Show image ${i + 1}`}
              onClick={() => setIdx(i)}
              className={cn(
                'relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all md:h-20 md:w-20',
                i === idx
                  ? 'border-accent shadow-glow-sm'
                  : 'border-bg-border hover:border-fg-muted',
              )}
            >
              <Image
                src={img.url}
                alt={img.alt ?? `${title} thumbnail ${i + 1}`}
                fill
                unoptimized={isDataUrl(img.url)}
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
      />
    </svg>
  );
}
