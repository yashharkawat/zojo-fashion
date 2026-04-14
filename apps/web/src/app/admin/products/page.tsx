'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { useAdminProducts } from '@/features/admin/hooks';
import { DataTable, type ColumnDef } from '@/components/admin/DataTable';
import { SyncStatusBadge } from '@/components/admin/StatusBadge';
import { Input } from '@/components/ui/Input';
import { inr, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AdminProduct } from '@/features/admin/types';

const isDataUrl = (s: string) => s.startsWith('data:');

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
      cell: (p) => <span className="text-sm text-fg-secondary">{p.category?.name ?? '—'}</span>,
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
      id: 'sync',
      header: 'Printrove',
      cell: (p) => <SyncStatusBadge status={p.printroveSyncStatus} />,
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
        <Link
          href="/admin/products/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white shadow-glow-sm hover:bg-accent-hover hover:shadow-glow"
        >
          + New product
        </Link>
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
