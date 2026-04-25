'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectCartCount } from '@/store/slices/cartSlice';
import { openCartDrawer } from '@/store/slices/uiSlice';
import { useAuth } from '@/hooks/useAuth';
import { useHasMounted } from '@/hooks/useHasMounted';
import { cn } from '@/lib/cn';

export function Header() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const cartCount = useAppSelector(selectCartCount);
  const { isAuthenticated, user, status: authStatus, isAdmin } = useAuth();
  const mounted = useHasMounted(); // gate hydration-unsafe renders (cart count, auth state)
  const [query, setQuery] = useState('');

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/products?search=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-bg-border bg-bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:gap-6">
        {/* Logo */}
        <Link
          href="/"
          className="font-display text-3xl tracking-[0.15em] text-accent transition-colors hover:text-accent-hover"
          aria-label="ZOJO home"
        >
          ZOJO
        </Link>

        {/* Search — desktop */}
        <form
          onSubmit={onSearch}
          className="relative hidden max-w-lg flex-1 md:block"
          role="search"
        >
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anime series, drops…"
            aria-label="Search products"
            className={cn(
              'h-10 w-full rounded-full bg-bg-elevated pl-10 pr-4 text-sm',
              'border border-bg-border placeholder:text-fg-muted',
              'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
            )}
          />
        </form>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          {/* Mobile search icon */}
          <button
            type="button"
            aria-label="Search"
            onClick={() => router.push('/products')}
            className="rounded-lg p-2.5 text-fg-secondary hover:bg-bg-elevated hover:text-fg-primary md:hidden"
          >
            <SearchIcon className="h-5 w-5" />
          </button>

          {/* Real auth only after mount; never show Login while session is being restored. */}
          {!mounted || authStatus === 'idle' || authStatus === 'authenticating' ? (
            <span
              className="inline-block h-9 w-[5.5rem] rounded-lg bg-bg-elevated/60 md:w-28"
              aria-hidden
            />
          ) : isAuthenticated ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent hover:bg-accent hover:text-white md:inline-flex"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-fg-secondary hover:bg-bg-elevated hover:text-fg-primary md:px-3"
                aria-label={`Account — ${user?.firstName ?? 'profile'}`}
              >
                <UserIcon className="h-5 w-5 md:hidden" />
                <span className="hidden md:inline">Hi, {user?.firstName ?? 'You'}</span>
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-sm font-semibold text-fg-primary transition-all hover:text-accent md:border-bg-border md:bg-bg-elevated md:px-4 md:hover:border-accent"
              aria-label="Login"
            >
              <UserIcon className="h-5 w-5 md:hidden" />
              <span className="hidden md:inline">Login</span>
            </Link>
          )}

          {/* Cart */}
          <button
            type="button"
            onClick={() => dispatch(openCartDrawer())}
            className="relative rounded-lg p-2.5 text-fg-secondary hover:bg-bg-elevated hover:text-fg-primary"
            aria-label={mounted ? `Open cart, ${cartCount} items` : 'Open cart'}
          >
            <BagIcon className="h-5 w-5" />
            {mounted && cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold text-white shadow-glow-sm">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" d="m21 21-4.35-4.35" />
    </svg>
  );
}

function BagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M16 10a4 4 0 01-8 0" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2M12 12a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}
