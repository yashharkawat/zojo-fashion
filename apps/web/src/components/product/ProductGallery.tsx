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
}

/**
 * For each colorway the PDP passes exactly two images (front + back, `sortOrder`).
 * Front / back toggles only between those two; no mixing with other colorways.
 */
export function ProductGallery({ images, title }: ProductGalleryProps) {
  const frontBack = images.length >= 2 ? ([images[0]!, images[1]!] as const) : null;
  const [face, setFace] = useState(0);

  useEffect(() => {
    setFace(0);
  }, [images[0]?.id, images[1]?.id]);

  const reduce = useReducedMotion();
  const [zoom, setZoom] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });
  const frameRef = useRef<HTMLDivElement>(null);

  const stepFace = useCallback(
    (delta: number) => {
      if (!frontBack) return;
      setFace((f) => (f + delta + 2) % 2);
    },
    [frontBack],
  );

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ x, y, active: true });
  };

  const dragStartX = useRef<number | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragStartX.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(dx) < 50 || !frontBack) return;
    if (dx < 0) stepFace(1);
    else stepFace(-1);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!frameRef.current?.contains(document.activeElement as Node) || !frontBack) return;
      if (e.key === 'ArrowRight') stepFace(1);
      if (e.key === 'ArrowLeft') stepFace(-1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [stepFace, frontBack]);

  if (images.length === 0) {
    return (
      <div className="aspect-square w-full rounded-xl bg-bg-elevated" aria-label="No image" />
    );
  }

  const current = frontBack ? frontBack[face]! : images[0]!;
  const idx = frontBack ? face : 0;
  const total = frontBack ? 2 : images.length;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frameRef}
        className="relative aspect-square w-full overflow-hidden rounded-xl bg-bg-elevated"
        tabIndex={0}
        role="region"
        aria-roledescription="image carousel"
        aria-label={`${title}, image ${idx + 1} of ${total}`}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setZoom((z) => ({ ...z, active: false }))}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {frontBack ? (
          // Mount both layers so front + back fetch in parallel (previously only `current` was
          // mounted, so "Back" waited on a cold network request after toggle).
          frontBack.map((img, i) => {
            const active = face === i;
            return (
              <motion.div
                key={img.id}
                initial={reduce ? false : { opacity: i === 0 ? 1 : 0 }}
                animate={{ opacity: active ? 1 : 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
                style={{ zIndex: active ? 2 : 1, pointerEvents: active ? 'auto' : 'none' }}
                aria-hidden={!active}
              >
                <Image
                  src={img.url}
                  alt={img.alt ?? `${title} — image ${i + 1}`}
                  fill
                  priority={i === 0}
                  loading={i === 0 ? undefined : 'eager'}
                  fetchPriority={i === 0 ? 'high' : 'low'}
                  unoptimized={isDataUrl(img.url)}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className={cn(
                    'object-cover transition-transform duration-300 ease-out',
                    active && zoom.active ? 'scale-150' : 'scale-100',
                  )}
                  style={{
                    transformOrigin: active && zoom.active ? `${zoom.x}% ${zoom.y}%` : 'center',
                  }}
                  draggable={false}
                />
              </motion.div>
            );
          })
        ) : (
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
              fetchPriority="high"
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
        )}

        {frontBack && (
          <>
            <button
              type="button"
              onClick={() => stepFace(-1)}
              aria-label="Previous view"
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-black/70 md:block"
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              type="button"
              onClick={() => stepFace(1)}
              aria-label="Next view"
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-black/70 md:block"
            >
              <ChevronIcon direction="right" />
            </button>
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
                  aria-selected={face === i}
                  onClick={() => setFace(i)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition-all',
                    face === i ? 'bg-accent text-white' : 'text-fg-secondary hover:text-fg-primary',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span
              aria-hidden
              className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 font-mono text-[10px] text-white backdrop-blur-sm md:hidden"
            >
              {face + 1} / 2
            </span>
          </>
        )}

        {!frontBack && images.length > 1 && (
          <span
            aria-hidden
            className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 font-mono text-[10px] text-white backdrop-blur-sm"
          >
            1 / {images.length}
          </span>
        )}
      </div>

      {frontBack && (
        <div
          role="tablist"
          aria-label="Front and back thumbnails"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {frontBack.map((img, i) => (
            <button
              key={img.id}
              type="button"
              role="tab"
              aria-selected={face === i}
              aria-label={i === 0 ? 'Front' : 'Back'}
              onClick={() => setFace(i)}
              className={cn(
                'relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all md:h-20 md:w-20',
                i === face
                  ? 'border-accent shadow-glow-sm'
                  : 'border-bg-border hover:border-fg-muted',
              )}
            >
              <Image
                src={img.url}
                alt={img.alt ?? `${title} — ${i === 0 ? 'front' : 'back'}`}
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
