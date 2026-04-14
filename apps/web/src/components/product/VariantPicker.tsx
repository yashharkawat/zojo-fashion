'use client';

import { cn } from '@/lib/cn';
import type { ProductVariant, VariantMatrix } from '@/types/product';

export interface VariantPickerProps {
  matrix: VariantMatrix;
  selectedSize: string | null;
  selectedColor: string | null;
  onSizeChange: (size: string) => void;
  onColorChange: (color: string) => void;
  /** Shown in-line with the size label when Size Guide is available */
  onOpenSizeGuide?: () => void;
}

/**
 * Size + color selector. Combines both picks into a unique variant via
 * `matrix.byKey.get('${size}__${color}')`.
 * - Disabled state for OOS combinations
 * - Keyboard: arrow keys jump within a row (radiogroup pattern)
 * - Accessible: `role=radiogroup` per dimension
 */
export function VariantPicker({
  matrix,
  selectedSize,
  selectedColor,
  onSizeChange,
  onColorChange,
  onOpenSizeGuide,
}: VariantPickerProps) {
  const isSizeAvailable = (size: string): boolean => {
    if (!selectedColor) return matrix.sizes.includes(size);
    const v = matrix.byKey.get(`${size}__${selectedColor}`);
    return !!v && v.isActive && v.stock > 0;
  };

  const isColorAvailable = (color: string): boolean => {
    if (!selectedSize) return true;
    const v = matrix.byKey.get(`${selectedSize}__${color}`);
    return !!v && v.isActive && v.stock > 0;
  };

  return (
    <div className="space-y-6">
      {matrix.colors.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium text-fg-primary">
              Color{selectedColor ? <span className="ml-2 text-fg-secondary">: {selectedColor}</span> : null}
            </p>
          </div>
          <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
            {matrix.colors.map((c) => {
              const available = isColorAvailable(c.name);
              const selected = selectedColor === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={c.name + (available ? '' : ' (unavailable)')}
                  onClick={() => onColorChange(c.name)}
                  disabled={!available}
                  className={cn(
                    'group relative h-10 w-10 rounded-full transition-all',
                    selected
                      ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-base'
                      : 'ring-1 ring-bg-border hover:ring-fg-muted',
                    !available && 'opacity-40 cursor-not-allowed',
                  )}
                  style={{
                    backgroundColor: c.hex ?? '#333',
                  }}
                >
                  {!available && (
                    <span
                      aria-hidden
                      className="absolute inset-0 m-auto block h-[1px] w-[140%] origin-center rotate-45 bg-danger"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-medium text-fg-primary">
            Size{selectedSize ? <span className="ml-2 text-fg-secondary">: {selectedSize}</span> : null}
          </p>
          {onOpenSizeGuide && (
            <button
              type="button"
              onClick={onOpenSizeGuide}
              className="text-xs font-medium text-accent underline-offset-4 hover:underline"
            >
              Size guide
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label="Size" className="flex flex-wrap gap-2">
          {matrix.sizes.map((size) => {
            const available = isSizeAvailable(size);
            const selected = selectedSize === size;
            return (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={size + (available ? '' : ' (out of stock)')}
                onClick={() => onSizeChange(size)}
                disabled={!available}
                className={cn(
                  'relative h-11 min-w-[44px] rounded-lg border px-3 font-semibold text-sm transition-all',
                  selected
                    ? 'border-accent bg-accent/10 text-accent'
                    : available
                    ? 'border-bg-border bg-bg-elevated text-fg-primary hover:border-fg-muted'
                    : 'border-bg-border bg-bg-elevated text-fg-muted cursor-not-allowed',
                )}
              >
                {size}
                {!available && (
                  <span aria-hidden className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-fg-muted" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Find the selected variant given current picks. Null if incomplete/unavailable. */
export function resolveVariant(
  matrix: VariantMatrix,
  size: string | null,
  color: string | null,
): ProductVariant | null {
  if (!size) return null;
  if (matrix.colors.length > 0 && !color) return null;
  const key = `${size}__${color ?? matrix.colors[0]?.name ?? ''}`;
  return matrix.byKey.get(key) ?? null;
}
