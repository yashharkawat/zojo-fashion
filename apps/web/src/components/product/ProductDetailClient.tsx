'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';

import { inr } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useCart } from '@/hooks/useCart';
import { useAppDispatch } from '@/store/hooks';
import { pushToast } from '@/store/slices/uiSlice';

import { ProductGallery } from './ProductGallery';
import { VariantPicker, resolveVariant } from './VariantPicker';
import { StockStatus } from './StockStatus';
import { SizeGuide } from './SizeGuide';
import { ProductDetailsAccordion } from './ProductDetailsAccordion';

import { buildVariantMatrixForPdp, type ProductDetail } from '@/types/product';
import { productImagesForColor } from '@/lib/product-images';

export interface ProductDetailClientProps {
  product: ProductDetail;
}

/**
 * The interactive shell of the PDP. The page-level wrapper (server
 * component) handles metadata and data fetching; this component owns
 * selection state and cart actions.
 */
export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { add } = useCart();
  const reduce = useReducedMotion();

  const matrix = useMemo(
    () => buildVariantMatrixForPdp(product.variants, product.images),
    [product.variants, product.images],
  );

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  useEffect(() => {
    const m = buildVariantMatrixForPdp(product.variants, product.images);
    if (m.sizes.length === 1) setSelectedSize(m.sizes[0]!);
    else setSelectedSize(null);
    const d = product.defaultColor?.trim();
    if (d && m.colors.some((c) => c.name === d)) setSelectedColor(d);
    else if (m.colors.length === 1) setSelectedColor(m.colors[0]!.name);
    else setSelectedColor(null);
  }, [product.id, product.variants, product.images, product.defaultColor]);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const galleryColor = selectedColor ?? matrix.colors[0]?.name ?? null;
  const displayImages = useMemo(
    () => productImagesForColor(product.images, galleryColor),
    [product.images, galleryColor],
  );
  const previewForVariant = (color: string) =>
    productImagesForColor(product.images, color)[0]?.url ?? product.images[0]?.url ?? null;

  const variant = resolveVariant(matrix, selectedSize, selectedColor);
  const effectivePrice = variant?.price && variant.price > 0 ? variant.price : product.basePrice;
  const inStock = !!variant && variant.stock > 0;

  const discount =
    product.compareAtPrice && product.compareAtPrice > product.basePrice
      ? Math.round(
          ((product.compareAtPrice - product.basePrice) / product.compareAtPrice) * 100,
        )
      : null;

  const requireSelection = (): boolean => {
    if (!selectedSize) {
      dispatch(pushToast({ kind: 'warning', message: 'Pick a size first', duration: 2500 }));
      return false;
    }
    if (matrix.colors.length > 0 && !selectedColor) {
      dispatch(pushToast({ kind: 'warning', message: 'Pick a color first', duration: 2500 }));
      return false;
    }
    if (!variant) {
      dispatch(pushToast({ kind: 'error', message: 'That combination is unavailable', duration: 2500 }));
      return false;
    }
    return true;
  };

  async function onAddToCart() {
    if (!requireSelection() || !variant) return;
    setAddingToCart(true);
    add({
      variantId: variant.id,
      productId: product.id,
      productTitle: product.title,
      productSlug: product.slug,
      variantLabel: `${variant.size} / ${variant.color}`,
      imageUrl: previewForVariant(variant.color),
      unitPricePaise: effectivePrice,
      quantity: 1,
    });
    dispatch(pushToast({ kind: 'success', message: `Added ${product.title} to cart`, duration: 2500 }));
    // Small UX breath before resetting
    setTimeout(() => setAddingToCart(false), 300);
  }

  async function onBuyNow() {
    if (!requireSelection() || !variant) return;
    add(
      {
        variantId: variant.id,
        productId: product.id,
        productTitle: product.title,
        productSlug: product.slug,
        variantLabel: `${variant.size} / ${variant.color}`,
        imageUrl: previewForVariant(variant.color),
        unitPricePaise: effectivePrice,
        quantity: 1,
      },
      /* openDrawer */ false,
    );
    router.push('/checkout');
  }

  const deliveryEstimate = formatDeliveryAboutOneWeek();

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Gallery */}
        <div key={galleryColor ?? 'default'}>
          <ProductGallery images={displayImages} title={product.title} />
        </div>

        {/* Info column */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex flex-col gap-6"
        >
          <header className="space-y-3">
            {product.animeSeries && (
              <Link
                href={`/products?anime=${encodeURIComponent(product.animeSeries)}`}
                className="inline-block text-xs font-semibold uppercase tracking-[0.25em] text-accent hover:underline"
              >
                {product.animeSeries}
              </Link>
            )}
            <h1 className="font-display text-4xl tracking-tight text-fg-primary md:text-5xl">
              {product.title}
            </h1>
          </header>

          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold text-fg-primary">
              {inr(effectivePrice)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > effectivePrice && (
              <>
                <span className="font-mono text-lg text-fg-muted line-through">
                  {inr(product.compareAtPrice)}
                </span>
                {discount && (
                  <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs font-bold text-white">
                    −{discount}%
                  </span>
                )}
              </>
            )}
          </div>
          <p className="-mt-4 text-xs text-fg-muted">Prices include applicable taxes. ₹50 delivery per order.</p>

          <VariantPicker
            matrix={matrix}
            selectedSize={selectedSize}
            selectedColor={selectedColor}
            onSizeChange={setSelectedSize}
            onColorChange={setSelectedColor}
            onOpenSizeGuide={() => setSizeGuideOpen(true)}
          />

          {variant && <StockStatus stock={variant.stock} />}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={onAddToCart}
              disabled={addingToCart || !inStock}
              aria-busy={addingToCart}
              className={cn(
                'flex h-12 flex-1 items-center justify-center gap-2 rounded-lg',
                'border border-bg-border bg-bg-elevated font-semibold uppercase tracking-widest',
                'text-fg-primary transition-all',
                'hover:border-accent hover:text-accent',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {addingToCart ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <BagPlusIcon className="h-5 w-5" />
              )}
              Add to cart
            </button>
            <button
              type="button"
              onClick={onBuyNow}
              disabled={!inStock}
              className={cn(
                'flex h-12 flex-1 items-center justify-center gap-2 rounded-lg',
                'bg-accent font-semibold uppercase tracking-widest text-white',
                'shadow-glow-sm transition-all',
                'hover:bg-accent-hover hover:shadow-glow',
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
              )}
            >
              <FlashIcon className="h-5 w-5" />
              Buy now
            </button>
          </div>

          {/* Delivery hint */}
          <div className="rounded-lg border border-bg-border bg-bg-elevated p-4 text-sm">
            <p className="flex items-center gap-2 text-fg-primary">
              <TruckIcon className="h-4 w-4 text-accent" />
              <strong>Delivers {deliveryEstimate}</strong> to your pincode.
            </p>
            <p className="mt-1 text-xs text-fg-secondary">
              Printed & shipped from India. Easy returns on defective items within 7 days.
            </p>
          </div>

          {/* Product details accordion */}
          <ProductDetailsAccordion
            defaultOpenId="description"
            sections={[
              {
                id: 'description',
                title: 'Description',
                content: (
                  <div className="space-y-2 whitespace-pre-line">
                    {product.description}
                  </div>
                ),
              },
              {
                id: 'material-fit',
                title: 'Material & Fit',
                content: (
                  <ul className="space-y-1.5 list-disc pl-5">
                    {product.material && <li>{product.material}</li>}
                    <li>Oversized fit — shoulder seam sits lower for a relaxed drape.</li>
                    <li>Bio-washed for softness; minimal shrinkage after cold wash.</li>
                  </ul>
                ),
              },
              {
                id: 'print',
                title: 'Print Quality',
                content: (
                  <ul className="space-y-1.5 list-disc pl-5">
                    <li>DTG / DTF print, high-definition at 1440 DPI.</li>
                    <li>Fade-resistant — holds color through 40+ washes with care.</li>
                    <li>Do not iron directly over the print.</li>
                  </ul>
                ),
              },
              {
                id: 'care',
                title: 'Care',
                content: (
                  <div>
                    {product.careInstructions ? (
                      <p>{product.careInstructions}</p>
                    ) : (
                      <ul className="space-y-1.5 list-disc pl-5">
                        <li>Machine wash cold with like colors.</li>
                        <li>Turn inside-out to protect the print.</li>
                        <li>Do not bleach. Tumble dry low or hang dry.</li>
                      </ul>
                    )}
                  </div>
                ),
              },
              {
                id: 'delivery',
                title: 'Delivery & Returns',
                content: (
                  <div className="space-y-2">
                    <p>Shipped within 2 business days. Delivery in about one week—typically {deliveryEstimate} to most pincodes.</p>
                    <p>Prepaid orders only. ₹50 delivery on all orders.</p>
                    <p>Returns/exchanges on defective items only — raise within 7 days of delivery.</p>
                  </div>
                ),
              },
            ]}
          />
        </motion.div>
      </div>

      <SizeGuide
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        rows={product.sizeChart?.rows}
      />
    </>
  );
}

/** ~1 week from today (used for display only). */
function formatDeliveryAboutOneWeek(): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() + 5);
  const to = new Date(now);
  to.setDate(to.getDate() + 9);
  return `${fmt(from)} — ${fmt(to)}`;
}

function BagPlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M12 11v6M9 14h6" />
    </svg>
  );
}

function FlashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13 2L4.09 12.97a.99.99 0 00.76 1.65H11l-1 7 9-11.5a.99.99 0 00-.78-1.62H13l1-6.5z" />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h12v10H3zM15 10h4l2 3v4h-6M7 20a2 2 0 100-4 2 2 0 000 4zM17 20a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
  );
}
