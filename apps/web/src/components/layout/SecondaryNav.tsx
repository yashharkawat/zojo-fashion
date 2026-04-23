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
            <details className="group relative">
              <summary
                className={cn(
                  'inline-flex h-11 cursor-pointer list-none items-center gap-1 px-3 md:px-4',
                  'font-display text-sm tracking-[0.18em] uppercase sm:text-base',
                  'text-fg-secondary transition-colors marker:content-none [&::-webkit-details-marker]:hidden',
                  'select-none hover:text-accent',
                )}
              >
                Profile
                <Chevron className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <ul
                className={cn(
                  'absolute left-0 right-0 z-50 mt-0 min-w-[10rem] rounded-b-lg border border-t-0 border-bg-border',
                  'bg-bg-elevated py-1 text-left shadow-lg sm:left-auto sm:right-auto sm:mt-1 sm:rounded-lg sm:border-t',
                )}
              >
                <li>
                  <Link
                    href="/about"
                    className="block px-4 py-2.5 text-sm font-medium tracking-widest text-fg-primary hover:bg-bg-base hover:text-accent"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    href="/orders"
                    className="block px-4 py-2.5 text-sm font-medium tracking-widest text-fg-primary hover:bg-bg-base hover:text-accent"
                  >
                    Track order
                  </Link>
                </li>
              </ul>
            </details>
          </li>
        </ul>
      </div>
    </nav>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 011.04 1.08l-4.25 3.65a.75.75 0 01-1.01 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}
