'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

const TABS = [
  { id: 'store',    label: 'Store' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'coupons',  label: 'Coupons' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<TabId>('store');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl tracking-tight text-fg-primary">Settings</h1>
        <p className="text-sm text-fg-secondary">Store-wide configuration.</p>
      </header>

      <div role="tablist" className="flex gap-1 rounded-md border border-bg-border bg-bg-elevated p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors',
              tab === t.id ? 'bg-accent text-white' : 'text-fg-secondary hover:text-fg-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'store' && <StoreSettings />}
      {tab === 'shipping' && <ShippingSettings />}
      {tab === 'coupons' && <CouponsManager />}
    </div>
  );
}

// ─── Store ───────────────────────────────────────────────

function StoreSettings() {
  return (
    <section className="max-w-2xl space-y-4 rounded-xl border border-bg-border bg-bg-elevated p-5">
      <h2 className="font-display text-lg tracking-wide text-fg-primary">Store details</h2>
      <Input label="Store name" defaultValue="Zojo Fashion" />
      <Input label="Support email" type="email" defaultValue="support@zojofashion.com" />
      <Input label="GSTIN" defaultValue="" hint="15-character GSTIN" />
      <button
        type="button"
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-white hover:bg-accent-hover"
      >
        Save
      </button>
      <p className="text-xs text-fg-muted">
        TODO: wire to <code>PUT /admin/settings</code>.
      </p>
    </section>
  );
}

// ─── Shipping ────────────────────────────────────────────

function ShippingSettings() {
  return (
    <section className="max-w-2xl space-y-4 rounded-xl border border-bg-border bg-bg-elevated p-5">
      <h2 className="font-display text-lg tracking-wide text-fg-primary">Shipping rates</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Flat rate (paise)" type="number" defaultValue={7900} hint="₹79 default" />
        <Input label="Free shipping above (paise)" type="number" defaultValue={99900} hint="₹999 default" />
      </div>
      <Input label="COD (legacy)" type="number" defaultValue={500000} disabled hint="Store is prepaid-only; unused." />
      <button
        type="button"
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-white hover:bg-accent-hover"
      >
        Save
      </button>
      <p className="text-xs text-fg-muted">
        TODO: wire to <code>PUT /admin/settings/shipping</code>.
      </p>
    </section>
  );
}

// ─── Coupons ─────────────────────────────────────────────

interface CouponRow {
  code: string;
  type: 'PERCENTAGE' | 'FLAT' | 'FREE_SHIPPING';
  value: number;
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED';
  uses: number;
}

const DEMO_COUPONS: CouponRow[] = [
  { code: 'OTAKU10',    type: 'PERCENTAGE',   value: 10,     status: 'ACTIVE', uses: 234 },
  { code: 'NARUTO200',  type: 'FLAT',         value: 20_000, status: 'ACTIVE', uses: 56 },
  { code: 'FREESHIP',   type: 'FREE_SHIPPING', value: 0,     status: 'ACTIVE', uses: 412 },
  { code: 'WELCOME100', type: 'FLAT',         value: 10_000, status: 'PAUSED', uses: 89 },
];

function CouponsManager() {
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-lg tracking-wide text-fg-primary">Coupons</h2>
        <button
          type="button"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white hover:bg-accent-hover"
        >
          + New coupon
        </button>
      </header>
      <div className="overflow-x-auto rounded-xl border border-bg-border bg-bg-elevated">
        <table className="w-full text-sm">
          <thead className="bg-bg-overlay text-left text-xs uppercase tracking-wider text-fg-secondary">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Uses</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-border">
            {DEMO_COUPONS.map((c) => (
              <tr key={c.code}>
                <td className="px-4 py-3 font-mono font-semibold text-fg-primary">{c.code}</td>
                <td className="px-4 py-3 text-fg-secondary">{c.type}</td>
                <td className="px-4 py-3 font-mono text-fg-primary">
                  {c.type === 'PERCENTAGE'
                    ? `${c.value}%`
                    : c.type === 'FLAT'
                    ? `₹${c.value / 100}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-semibold',
                      c.status === 'ACTIVE' && 'text-success',
                      c.status === 'PAUSED' && 'text-warn',
                      c.status === 'EXPIRED' && 'text-fg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        c.status === 'ACTIVE' && 'bg-success',
                        c.status === 'PAUSED' && 'bg-warn',
                        c.status === 'EXPIRED' && 'bg-fg-muted',
                      )}
                    />
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono">{c.uses}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-fg-muted">
        Demo data shown — wire to <code>GET/PUT /admin/coupons</code> when the coupons API ships.
      </p>
    </section>
  );
}
