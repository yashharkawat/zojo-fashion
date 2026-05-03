'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { RequireAuth } from '@/components/auth/RequireAuth';
import { cn } from '@/lib/cn';

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', exact: true as boolean, icon: HomeIcon },
  { href: '/admin/orders', label: 'Orders', exact: false, icon: BoxIcon },
  { href: '/admin/products', label: 'Products', exact: true, icon: ShirtIcon },
  { href: '/admin/analytics', label: 'Analytics', exact: false, icon: ChartIcon },
  { href: '/admin/settings', label: 'Settings', exact: false, icon: GearIcon },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth adminOnly>
      {/* Extra bottom padding on mobile so sticky tab bar doesn't overlap content */}
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 lg:pb-8 lg:pt-8">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
          <AdminSidebar />
          <main className="min-w-0">{children}</main>
        </div>
      </div>
      <MobileTabBar />
    </RequireAuth>
  );
}

function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block lg:sticky lg:top-32 lg:h-fit">
      <div className="rounded-xl border border-bg-border bg-bg-elevated p-2">
        <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-muted">
          Admin
        </p>
        <nav className="space-y-0.5" aria-label="Admin sections">
          {ADMIN_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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

          <div className="pt-2">
            <Link
              href="/admin/products/upload"
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                pathname === '/admin/products/upload'
                  ? 'bg-accent text-white'
                  : 'border border-accent/40 text-accent hover:bg-accent hover:text-white',
              )}
            >
              <span className="text-base leading-none">+</span>
              Add Product
            </Link>
          </div>
        </nav>
      </div>
    </aside>
  );
}

function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin navigation"
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-bg-border bg-bg-base/95 backdrop-blur-md lg:hidden"
    >
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-colors',
              active ? 'text-accent' : 'text-fg-muted',
            )}
          >
            <Icon className="h-5 w-5" active={active} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ---- Icon components --------------------------------------------------------

function HomeIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
    </svg>
  );
}
function BoxIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
    </svg>
  );
}
function ShirtIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z" />
    </svg>
  );
}
function ChartIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function GearIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
