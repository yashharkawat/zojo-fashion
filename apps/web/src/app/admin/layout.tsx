'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { RequireAuth } from '@/components/auth/RequireAuth';
import { cn } from '@/lib/cn';

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', exact: true as boolean },
  { href: '/admin/orders', label: 'Orders', exact: false },
  { href: '/admin/products', label: 'Products', exact: false },
  { href: '/admin/analytics', label: 'Analytics', exact: false },
  { href: '/admin/settings', label: 'Settings', exact: false },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth adminOnly>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
          <AdminSidebar />
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}

function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="lg:sticky lg:top-32 lg:h-fit">
      <div className="rounded-xl border border-bg-border bg-bg-elevated p-2">
        <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-muted">
          Admin
        </p>
        <nav className="space-y-0.5" aria-label="Admin sections">
          {ADMIN_NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-fg-secondary hover:bg-bg-overlay hover:text-fg-primary',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
