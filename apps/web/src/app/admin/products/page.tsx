'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { useAdminProducts, useSetDefaultColor } from '@/features/admin/hooks';
import { DataTable, type ColumnDef } from '@/components/admin/DataTable';
import { Input } from '@/components/ui/Input';
import { inr, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AdminProduct } from '@/features/admin/types';

const isDataUrl = (s: string) => s.startsWith('data:');

function ColorSwatches({ product }: { product: AdminProduct }) {
  const { mutate, isPending, variables } = useSetDefaultColor();
  const uniqueColors = product.variants.filter(
    (v, i, arr) => arr.findIndex((x) => x.color === v.color) === i,
  );
  if (uniqueColors.length === 0) return <span className="text-fg-muted text-xs">—</span>;

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {uniqueColors.map((v) => {
        const isDefault = product.defaultColor === v.color;
        const isLoading = isPending && variables?.color === v.color && variables?.id === product.id;
        return (
          <button
            key={v.color}
            type="button"
            title={`Set "${v.color}" as default${isDefault ? ' (current)' : ''}`}
            disabled={isPending}
            onClick={() => mutate({ id: product.id, color: v.color })}
            className={cn(
              'relative h-6 w-6 rounded-full border-2 transition-all hover:scale-110',
              isDefault
                ? 'border-accent shadow-glow-sm scale-110'
                : 'border-bg-border hover:border-fg-muted',
              isLoading && 'opacity-50 cursor-wait',
            )}
            style={{ backgroundColor: v.colorHex ?? '#333' }}
          >
            {isDefault && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-white shadow" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminProductsPage() {
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const query = useAdminProducts({
    search: search || undefined,
    isActive,
    page,
    pageSize: PAGE_SIZE,
  });

  const columns: ColumnDef<AdminProduct>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-bg-overlay">
            {p.images[0] && (
              <Image
                src={p.images[0].url}
                alt={p.images[0].alt ?? p.title}
                fill
                unoptimized={isDataUrl(p.images[0].url)}
                sizes="48px"
                className="object-cover"
              />
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={`/admin/products/${p.id}/edit`}
              className="block truncate text-sm font-medium text-fg-primary hover:text-accent"
            >
              {p.title}
            </Link>
            <p className="truncate text-xs text-fg-muted">{p.slug}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      cell: (p) => <span className="text-sm text-fg-secondary font-mono">{p.categorySlug}</span>,
    },
    {
      id: 'anime',
      header: 'Series',
      cell: (p) =>
        p.animeSeries ? (
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
            {p.animeSeries}
          </span>
        ) : (
          <span className="text-fg-muted">—</span>
        ),
    },
    {
      id: 'default-color',
      header: 'Default Color',
      cell: (p) => <ColorSwatches product={p} />,
    },
    {
      id: 'variants',
      header: 'Variants',
      align: 'center',
      cell: (p) => <span className="font-mono text-sm">{p._count.variants}</span>,
    },
    {
      id: 'sold',
      header: 'Sold',
      align: 'right',
      cell: (p) => <span className="font-mono text-sm">{p.soldCount}</span>,
    },
    {
      id: 'price',
      header: 'Price',
      align: 'right',
      cell: (p) => <span className="font-mono text-sm">{inr(p.basePrice)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (p) => (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold',
            p.isActive ? 'text-success' : 'text-fg-muted',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', p.isActive ? 'bg-success' : 'bg-fg-muted')} />
          {p.isActive ? 'Active' : 'Hidden'}
        </span>
      ),
    },
    {
      id: 'created',
      header: 'Added',
      cell: (p) => <span className="text-xs text-fg-muted">{formatDate(p.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-fg-primary">Products</h1>
          <p className="text-sm text-fg-secondary">
            {query.data ? `${query.data.pagination.total} total` : '—'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/products/upload"
            className="rounded-lg border border-accent bg-transparent px-4 py-2 text-sm font-semibold uppercase tracking-widest text-accent hover:bg-accent hover:text-white"
          >
            Quick Create
          </Link>
          <Link
            href="/admin/products/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white shadow-glow-sm hover:bg-accent-hover hover:shadow-glow"
          >
            + New product
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="w-full md:w-80">
          <Input
            aria-label="Search products"
            placeholder="Search title or slug…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex gap-2">
          {(
            [
              { label: 'All', value: undefined },
              { label: 'Active', value: true },
              { label: 'Hidden', value: false },
            ] as const
          ).map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => {
                setIsActive(f.value);
                setPage(1);
              }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition-colors',
                isActive === f.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-bg-border bg-bg-elevated text-fg-secondary hover:text-fg-primary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.data ?? []}
        getRowId={(p) => p.id}
        isLoading={query.isLoading || query.isPlaceholderData}
        emptyState="No products match your filters."
      />

      {query.data && query.data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-fg-secondary">
            Page {query.data.pagination.page} of {query.data.pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-bg-border bg-bg-elevated px-3 py-1.5 hover:border-accent disabled:opacity-50"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(query.data!.pagination.totalPages, p + 1))}
              disabled={page >= query.data.pagination.totalPages}
              className="rounded-md border border-bg-border bg-bg-elevated px-3 py-1.5 hover:border-accent disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
