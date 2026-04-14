'use client';

import Image from 'next/image';
import Link from 'next/link';
import { inr } from '@/lib/format';
import type { CartLine } from '@/store/slices/cartSlice';

const isDataUrl = (s: string | null): boolean => !!s && s.startsWith('data:');

export interface CartLineItemProps {
  line: CartLine;
  onUpdateQty: (variantId: string, quantity: number) => void;
  onRemove: (variantId: string) => void;
  /** Compact layout used inside the drawer */
  compact?: boolean;
}

export function CartLineItem({ line, onUpdateQty, onRemove, compact = false }: CartLineItemProps) {
  return (
    <li
      className={`flex gap-3 rounded-lg ${compact ? 'p-2' : 'border border-bg-border bg-bg-elevated p-4'}`}
    >
      <Link
        href={`/products/${line.productSlug}`}
        className={`relative flex-shrink-0 overflow-hidden rounded-md bg-bg-overlay ${
          compact ? 'h-20 w-20' : 'h-24 w-24'
        }`}
        aria-label={line.productTitle}
      >
        {line.imageUrl ? (
          <Image
            src={line.imageUrl}
            alt={line.productTitle}
            fill
            unoptimized={isDataUrl(line.imageUrl)}
            sizes="96px"
            className="object-cover"
          />
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col justify-between gap-1">
        <div>
          <Link
            href={`/products/${line.productSlug}`}
            className="line-clamp-2 text-sm font-medium text-fg-primary hover:text-accent"
          >
            {line.productTitle}
          </Link>
          <p className="text-xs text-fg-secondary">{line.variantLabel}</p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <QuantityStepper
            value={line.quantity}
            onChange={(q) => onUpdateQty(line.variantId, q)}
          />
          <div className="flex flex-col items-end">
            <span className="font-mono text-sm font-bold text-fg-primary">
              {inr(line.unitPricePaise * line.quantity)}
            </span>
            <button
              type="button"
              onClick={() => onRemove(line.variantId)}
              className="text-xs text-fg-muted hover:text-danger focus-visible:text-danger"
              aria-label={`Remove ${line.productTitle}`}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function QuantityStepper({
  value,
  onChange,
  max = 10,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div
      className="inline-flex h-8 items-center rounded-md border border-bg-border bg-bg-overlay"
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        className="h-full w-8 text-fg-primary transition-colors hover:bg-bg-elevated disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span
        className="w-8 text-center font-mono text-sm text-fg-primary"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className="h-full w-8 text-fg-primary transition-colors hover:bg-bg-elevated disabled:opacity-40"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
