'use client';

import Link from 'next/link';

export default function EditProductPage({ params }: { params: { id: string } }) {
  // TODO: prefill via GET /products/:id, then reuse the New form's body shape on PUT.
  return (
    <div className="space-y-4">
      <Link href="/admin/products" className="text-xs text-fg-secondary hover:text-accent">
        ← All products
      </Link>
      <h1 className="font-display text-4xl tracking-tight text-fg-primary">Edit product</h1>
      <p className="font-mono text-xs text-fg-muted">{params.id}</p>
      <div className="rounded-xl border border-bg-border bg-bg-elevated p-8 text-center text-fg-secondary">
        Edit form — wire to <code className="text-fg-primary">PUT /api/v1/products/:id</code> reusing the
        same shape as the New product form. Skipped for MVP scaffolding.
      </div>
    </div>
  );
}
