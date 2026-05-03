import Link from 'next/link';
import { fetchSiteSettings } from '@/lib/server-settings';

export async function Footer() {
  const social = await fetchSiteSettings();

  return (
    <footer className="mt-20 border-t border-bg-border bg-bg-elevated">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <Column title="Shop">
            <Link href="/products">All Products</Link>
            <Link href="/wishlist">Wishlist</Link>
            <Link href="/track-order">Track Order</Link>
          </Column>
          <Column title="Help">
            <Link href="/size-guide">Size Guide</Link>
            <Link href="/help/shipping">Shipping</Link>
            <Link href="/help/returns">Returns</Link>
            <Link href="/help/contact">Contact</Link>
          </Column>
          <Column title="Legal">
            <Link href="/privacy-policy">Privacy Policy</Link>
            <Link href="/terms">Terms & Conditions</Link>
            <Link href="/refund-policy">Refund Policy</Link>
          </Column>
          <Column title="Company">
            <Link href="/about">About</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/careers">Careers</Link>
          </Column>
          <Column title="Follow">
            <a href={social.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram</a>
            <a href={social.youtubeUrl} target="_blank" rel="noopener noreferrer">YouTube</a>
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
      <nav
        className="flex flex-col gap-2.5 text-sm text-fg-secondary [&_a:hover]:text-accent [&_a]:transition-colors"
        aria-label={title}
      >
        {children}
      </nav>
    </div>
  );
}
