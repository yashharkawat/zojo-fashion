import Link from 'next/link';
import { cn } from '@/lib/cn';

const linkClass = cn(
  'inline-flex h-11 items-center whitespace-nowrap px-3 md:px-4',
  'font-display text-sm tracking-[0.18em] uppercase sm:text-base',
  'text-fg-secondary transition-colors hover:text-accent',
);

export function SecondaryNav() {
  return (
    <nav
      aria-label="Primary"
      className="sticky top-16 z-40 border-b border-bg-border bg-bg-base/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-stretch gap-0 px-4 sm:flex-row sm:items-center sm:justify-center sm:gap-6 sm:py-0">
        <ul className="flex items-center justify-center gap-1 sm:gap-2">
          <li>
            <Link href="/products" className={linkClass}>
              Collections
            </Link>
          </li>
          <li>
            <Link href="/orders" className={linkClass}>
              Orders
            </Link>
          </li>
          <li>
            <Link href="/about" className={linkClass}>
              About
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
