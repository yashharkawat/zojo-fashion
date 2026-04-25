'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuickCreateProduct } from '@/features/admin/hooks';
import { cn } from '@/lib/cn';

interface FilePreview {
  name: string;
  url: string;
  file: File;
}

export default function QuickCreateProductPage() {
  const router = useRouter();
  const { mutateAsync, isPending } = useQuickCreateProduct();

  // ── form state ────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [animeSeries, setAnimeSeries] = useState('');
  const [categorySlug, setCategorySlug] = useState('oversized');
  const [basePrice, setBasePrice] = useState('79900');
  const [compareAtPrice, setCompareAtPrice] = useState('99900');
  const [tags, setTags] = useState('anime, oversized');
  const [material, setMaterial] = useState('100% cotton, 240 GSM');

  // ── file state ────────────────────────────────────────────
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── feedback ──────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ slug: string; title: string } | null>(null);

  // ── file handling ─────────────────────────────────────────

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const webps = Array.from(incoming).filter(
      (f) => f.type === 'image/webp' || f.name.endsWith('.webp'),
    );
    if (webps.length === 0) {
      setError('Only .webp files are accepted.');
      return;
    }
    setError(null);
    const newPreviews = webps.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
      file: f,
    }));
    setPreviews((prev) => {
      const allNames = new Set(prev.map((p) => p.name));
      return [...prev, ...newPreviews.filter((p) => !allNames.has(p.name))];
    });
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  function removeFile(name: string) {
    setPreviews((prev) => prev.filter((p) => p.name !== name));
  }

  // ── sort previews numerically so the order is clear ───────
  const sorted = [...previews].sort((a, b) => {
    const na = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });

  const half = Math.floor(sorted.length / 2);

  // ── submit ────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (sorted.length < 2 || sorted.length % 2 !== 0) {
      setError('Upload an even number of webp files (one back + one front per color).');
      return;
    }

    const formData = new FormData();
    formData.set('title', title);
    formData.set('description', description);
    formData.set('animeSeries', animeSeries);
    formData.set('categorySlug', categorySlug);
    formData.set('basePrice', basePrice);
    formData.set('compareAtPrice', compareAtPrice);
    formData.set('tags', tags);
    formData.set('material', material);
    for (const p of sorted) {
      formData.append('files', p.file, p.name);
    }

    try {
      const product = await mutateAsync(formData);
      setResult({ slug: product.slug, title: product.title });
      setPreviews([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-fg-primary">
            Quick Create Product
          </h1>
          <p className="mt-1 text-sm text-fg-secondary">
            Drop webp mockup files and fill in details. Colors are auto-detected.
          </p>
        </div>
        <Link
          href="/admin/products"
          className="text-sm text-fg-secondary hover:text-fg-primary"
        >
          ← Back to products
        </Link>
      </div>

      {result && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4">
          <p className="font-semibold text-green-400">Product created successfully!</p>
          <p className="mt-1 text-sm text-fg-secondary">
            <strong className="text-fg-primary">{result.title}</strong> is now live in the catalog.
          </p>
          <div className="mt-3 flex gap-3">
            <Link
              href={`/products/${result.slug}`}
              target="_blank"
              className="text-sm font-semibold text-accent hover:underline"
            >
              View on storefront →
            </Link>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setTitle('');
                setDescription('');
                setAnimeSeries('');
              }}
              className="text-sm font-semibold text-fg-secondary hover:text-fg-primary"
            >
              Create another
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/products')}
              className="text-sm font-semibold text-fg-secondary hover:text-fg-primary"
            >
              Go to products list
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-2">
        {/* ── Left column: metadata ──────────────────────────── */}
        <div className="space-y-5">
          <h2 className="font-display text-lg tracking-wide text-fg-primary">Product Details</h2>

          <Field label="Title *">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sage Mode Oversized Tee"
              className={inputCls}
            />
          </Field>

          <Field label="Description *">
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Naruto in Sage Mode on the front. Premium DTG print at 1440 DPI. Oversized fit, soft to touch."
              className={cn(inputCls, 'resize-none')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Anime Series">
              <input
                value={animeSeries}
                onChange={(e) => setAnimeSeries(e.target.value)}
                placeholder="Naruto"
                className={inputCls}
              />
            </Field>

            <Field label="Category">
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className={inputCls}
              >
                <option value="oversized">Oversized</option>
                <option value="regular">Regular</option>
                <option value="limited-edition">Limited Edition</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Base Price (paise) *">
              <input
                required
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="79900"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-fg-muted">
                ₹{Math.round(Number(basePrice) / 100)} · 79900 = ₹799
              </p>
            </Field>

            <Field label="Compare-at Price (paise)">
              <input
                type="number"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                placeholder="99900"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-fg-muted">
                MRP ₹{Math.round(Number(compareAtPrice) / 100)}
              </p>
            </Field>
          </div>

          <Field label="Tags (comma separated)">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="anime, oversized, naruto"
              className={inputCls}
            />
          </Field>

          <Field label="Material">
            <input
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="100% cotton, 240 GSM"
              className={inputCls}
            />
          </Field>

          <button
            type="submit"
            disabled={isPending || sorted.length === 0}
            className={cn(
              'w-full rounded-lg py-3 text-sm font-semibold uppercase tracking-widest transition-colors',
              isPending || sorted.length === 0
                ? 'cursor-not-allowed bg-bg-elevated text-fg-muted'
                : 'bg-accent text-white hover:bg-accent-hover',
            )}
          >
            {isPending
              ? 'Uploading & detecting colors…'
              : `Create Product (${sorted.length / 2 || 0} colorways)`}
          </button>
        </div>

        {/* ── Right column: file drop zone ─────────────────── */}
        <div className="space-y-5">
          <h2 className="font-display text-lg tracking-wide text-fg-primary">
            Mockup Files
            {sorted.length > 0 && (
              <span className="ml-2 text-sm font-normal text-fg-muted">
                ({sorted.length} files · {half} backs + {sorted.length - half} fronts)
              </span>
            )}
          </h2>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors',
              dragging
                ? 'border-accent bg-accent/5'
                : 'border-bg-border bg-bg-elevated hover:border-accent/50',
            )}
          >
            <svg className="h-8 w-8 text-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-fg-primary">Drop .webp files here</p>
              <p className="mt-1 text-xs text-fg-muted">
                First half = backs, second half = fronts (sorted numerically)
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".webp,image/webp"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* Preview grid */}
          {sorted.length > 0 && (
            <div className="space-y-3">
              {/* Back images */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-fg-muted">
                  Backs ({half})
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {sorted.slice(0, half).map((p) => (
                    <PreviewThumb key={p.name} preview={p} onRemove={() => removeFile(p.name)} />
                  ))}
                </div>
              </div>
              {/* Front images */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-fg-muted">
                  Fronts ({sorted.length - half})
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {sorted.slice(half).map((p) => (
                    <PreviewThumb key={p.name} preview={p} onRemove={() => removeFile(p.name)} />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviews([])}
                className="text-xs text-fg-muted hover:text-danger"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Small components ──────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-bg-border bg-bg-overlay px-3 py-2 text-sm text-fg-primary placeholder:text-fg-muted focus:border-accent focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{label}</label>
      {children}
    </div>
  );
}

function PreviewThumb({
  preview,
  onRemove,
}: {
  preview: FilePreview;
  onRemove: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-bg-border">
      <Image
        src={preview.url}
        alt={preview.name}
        width={80}
        height={100}
        className="h-24 w-full object-cover"
        unoptimized
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex"
      >
        ×
      </button>
      <p className="truncate px-1 pb-1 text-[10px] text-fg-muted">{preview.name}</p>
    </div>
  );
}
