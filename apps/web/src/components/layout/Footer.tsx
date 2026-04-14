'use client';

import Link from 'next/link';
import { useState } from 'react';

export function Footer() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'err'>('idle');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('submitting');
    try {
      // TODO: POST /api/v1/newsletter
      await new Promise((r) => setTimeout(r, 400));
      setStatus('ok');
      setEmail('');
    } catch {
      setStatus('err');
    }
  }

  return (
    <footer className="mt-20 border-t border-bg-border bg-bg-elevated">
      {/* Newsletter band */}
      <div className="border-b border-bg-border bg-[radial-gradient(ellipse_at_center,rgba(255,69,0,0.15),transparent_60%)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-10 md:flex-row md:justify-between md:py-14">
          <div>
            <h3 className="font-display text-3xl tracking-tight text-fg-primary md:text-4xl">
              Join the <span className="text-accent">clan</span>.
            </h3>
            <p className="mt-1 text-sm text-fg-secondary">
              Early access to drops, series reveals, and friends-only discounts.
            </p>
          </div>
          <form
            onSubmit={onSubmit}
            className="flex w-full max-w-md items-center gap-2"
            aria-label="Newsletter signup"
          >
            <label className="sr-only" htmlFor="nl-email">Email</label>
            <input
              id="nl-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              disabled={status === 'submitting'}
              className="h-12 flex-1 rounded-lg border border-bg-border bg-bg-base px-4 text-sm placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="h-12 rounded-lg bg-accent px-6 font-semibold uppercase tracking-widest text-white shadow-glow-sm transition-all hover:bg-accent-hover hover:shadow-glow disabled:opacity-60"
            >
              {status === 'submitting' ? '...' : 'Join'}
            </button>
          </form>
        </div>
        {status === 'ok' && (
          <p className="pb-4 text-center text-sm text-accent">You're in. Check your inbox.</p>
        )}
        {status === 'err' && (
          <p className="pb-4 text-center text-sm text-danger">Something broke. Try again.</p>
        )}
      </div>

      {/* Link columns */}
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <Column title="Shop">
            <Link href="/products">All Products</Link>
            <Link href="/products?sort=-createdAt">New Drops</Link>
            <Link href="/products?category=oversized">Oversized</Link>
            <Link href="/products?category=limited-edition">Limited Edition</Link>
          </Column>
          <Column title="Help">
            <Link href="/help/shipping">Shipping</Link>
            <Link href="/help/returns">Returns</Link>
            <Link href="/help/size-guide">Size Guide</Link>
            <Link href="/help/contact">Contact</Link>
          </Column>
          <Column title="Company">
            <Link href="/about">About</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/careers">Careers</Link>
          </Column>
          <Column title="Follow">
            <a href="https://instagram.com/zojo.fashion" target="_blank" rel="noopener noreferrer">Instagram</a>
            <a href="https://twitter.com/zojofashion" target="_blank" rel="noopener noreferrer">X / Twitter</a>
            <a href="https://youtube.com/@zojofashion" target="_blank" rel="noopener noreferrer">YouTube</a>
          </Column>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-bg-border pt-6 md:flex-row md:items-center">
          <p className="font-display text-2xl tracking-[0.2em] text-accent">ZOJO FASHION</p>
          <p className="text-xs text-fg-muted">
            © {new Date().getFullYear()} Zojo Fashion. Crafted in India for the bold.
          </p>
        </div>
      </div>
    </footer>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-4 font-display text-sm tracking-[0.25em] uppercase text-fg-primary">
        {title}
      </h4>
      <nav className="flex flex-col gap-2.5 text-sm text-fg-secondary [&_a:hover]:text-accent [&_a]:transition-colors" aria-label={title}>
        {children}
      </nav>
    </div>
  );
}
