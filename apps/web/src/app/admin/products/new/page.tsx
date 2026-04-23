'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Input } from '@/components/ui/Input';
import { adminApi } from '@/features/admin/api';
import { useAppDispatch } from '@/store/hooks';
import { pushToast } from '@/store/slices/uiSlice';

interface VariantDraft {
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  price: number;
}

const DEFAULT_VARIANTS: VariantDraft[] = [
  { sku: '', size: 'S', color: 'Black', colorHex: '#000000', price: 89900 },
  { sku: '', size: 'M', color: 'Black', colorHex: '#000000', price: 89900 },
  { sku: '', size: 'L', color: 'Black', colorHex: '#000000', price: 89900 },
  { sku: '', size: 'XL', color: 'Black', colorHex: '#000000', price: 89900 },
];

export default function NewProductPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categorySlug, setCategorySlug] = useState('oversized');
  const [basePrice, setBasePrice] = useState(89900);
  const [animeSeries, setAnimeSeries] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePublicId, setImagePublicId] = useState('');
  const [variants, setVariants] = useState<VariantDraft[]>(DEFAULT_VARIANTS);
  const [isActive, setIsActive] = useState(true);

  function updateVariant(i: number, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const missing = variants.find((v) => !v.sku);
    if (missing) {
      setError('Every variant needs a unique SKU.');
      setSubmitting(false);
      return;
    }

    try {
      const product = await adminApi.createProduct({
        slug,
        title,
        description,
        categorySlug,
        basePrice,
        gender: 'MEN',
        animeSeries: animeSeries || undefined,
        tags: [],
        isActive,
        isFeatured: false,
        variants: variants.map((v) => ({
          sku: v.sku,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex,
          price: v.price,
        })),
        images: [
          {
            url: imageUrl,
            publicId: imagePublicId,
            alt: title,
            sortOrder: 0,
            isPrimary: true,
          },
        ],
      });
      dispatch(pushToast({ kind: 'success', message: `Created ${product.title}`, duration: 2500 }));
      router.replace('/admin/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl tracking-tight text-fg-primary">New product</h1>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="rounded-xl border border-bg-border bg-bg-elevated p-5 space-y-4">
          <h2 className="font-display text-lg tracking-wide text-fg-primary">Basics</h2>
          <Input label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            label="Slug"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
            hint="lowercase, alphanumeric, hyphens"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Category slug"
              required
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
              hint="e.g. oversized, regular, limited-edition"
            />
            <Input label="Anime series" value={animeSeries} onChange={(e) => setAnimeSeries(e.target.value)} />
          </div>
          <Input
            label="Base price (paise)"
            type="number"
            min={100}
            value={basePrice}
            onChange={(e) => setBasePrice(parseInt(e.target.value, 10) || 0)}
            hint={`Display: ₹${(basePrice / 100).toFixed(0)}`}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
              Description
            </label>
            <textarea
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-bg-border bg-bg-elevated p-3 text-sm text-fg-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-secondary">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-bg-border bg-bg-elevated text-accent focus:ring-accent"
            />
            Active (visible in storefront)
          </label>
        </section>

        <section className="rounded-xl border border-bg-border bg-bg-elevated p-5 space-y-4">
          <h2 className="font-display text-lg tracking-wide text-fg-primary">Primary image</h2>
          <p className="text-xs text-fg-secondary">
            Upload to Cloudinary first, then paste the secure URL + public ID below.{' '}
            <a
              href="https://cloudinary.com/documentation/upload_widget"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Cloudinary docs ↗
            </a>
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Image URL" required value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            <Input label="Cloudinary public_id" required value={imagePublicId} onChange={(e) => setImagePublicId(e.target.value)} />
          </div>
        </section>

        <section className="rounded-xl border border-bg-border bg-bg-elevated p-5 space-y-3">
          <h2 className="font-display text-lg tracking-wide text-fg-primary">Variants</h2>
          <p className="text-xs text-fg-secondary">Each sellable size/color combination needs a unique SKU and price.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-fg-secondary">
                <tr>
                  <th className="px-2 py-2">Size</th>
                  <th className="px-2 py-2">Color</th>
                  <th className="px-2 py-2">Hex</th>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Price (paise)</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={i} className="border-t border-bg-border">
                    <td className="px-2 py-2">
                      <input
                        value={v.size}
                        onChange={(e) => updateVariant(i, { size: e.target.value.toUpperCase() })}
                        className="h-9 w-16 rounded-md border border-bg-border bg-bg-overlay px-2 text-sm text-fg-primary"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={v.color}
                        onChange={(e) => updateVariant(i, { color: e.target.value })}
                        className="h-9 w-28 rounded-md border border-bg-border bg-bg-overlay px-2 text-sm text-fg-primary"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="color"
                        value={v.colorHex}
                        onChange={(e) => updateVariant(i, { colorHex: e.target.value })}
                        className="h-9 w-12 rounded-md border border-bg-border bg-bg-overlay"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={v.sku}
                        onChange={(e) => updateVariant(i, { sku: e.target.value.toUpperCase() })}
                        className="h-9 w-40 rounded-md border border-bg-border bg-bg-overlay px-2 font-mono text-sm text-fg-primary"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={v.price}
                        onChange={(e) => updateVariant(i, { price: parseInt(e.target.value, 10) || 0 })}
                        className="h-9 w-28 rounded-md border border-bg-border bg-bg-overlay px-2 font-mono text-sm text-fg-primary"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() =>
              setVariants((prev) => [
                ...prev,
                { sku: '', size: 'XXL', color: 'Black', colorHex: '#000000', price: basePrice },
              ])
            }
            className="rounded-md border border-bg-border bg-bg-overlay px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-fg-primary hover:border-accent hover:text-accent"
          >
            + Add variant
          </button>
        </section>

        {error && (
          <div role="alert" className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-bg-border bg-bg-elevated px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-fg-primary hover:border-fg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-widest text-white shadow-glow-sm hover:bg-accent-hover hover:shadow-glow disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  );
}
