import type { ProductImage } from '@/types/product';

/**
 * Picks gallery images for the active shirt color. If images are not scoped
 * (no `variantColor` set), the full set is used for every color.
 *
 * Catalog order (seeded): all **back** images first, then all **front**s — so
 * for one color, back has a lower `sortOrder` and front a higher. The PDP
 * gallery wants **[front, back]**, so we return that order per color when we
 * have a pair.
 */
export function productImagesForColor(
  images: ProductImage[],
  color: string | null,
): ProductImage[] {
  if (images.length === 0) return [];
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  if (!color) return sorted;
  const anyScoped = images.some((i) => i.variantColor);
  if (!anyScoped) return sorted;
  const forColor = sorted.filter((i) => i.variantColor == null || i.variantColor === color);
  if (forColor.length) {
    if (forColor.length === 2) {
      const a = forColor[0]!;
      const b = forColor[1]!;
      // Higher sortOrder = front (second half in catalog layout)
      if (b.sortOrder > a.sortOrder) return [b, a];
      if (a.sortOrder > b.sortOrder) return [a, b];
    }
    return forColor;
  }
  return sorted;
}
