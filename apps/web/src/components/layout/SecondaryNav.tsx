import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/products?collection=all',        label: 'Collections' },
  { href: '/products?sort=-createdAt',       label: 'New Drops' },
  { href: '/about',                          label: 'About' },
  { href: '/orders',                         label: 'Track Order' },
] as const;

export function SecondaryNav() {
  return (
    <nav
      aria-label="Primary"
      className="sticky top-16 z-40 border-b border-bg-border bg-bg-base/85 backdrop-blur-md"
    >
      <div className="mx-auto max-w-7xl overflow-x-auto px-4">
        <ul className="flex items-center gap-1 md:gap-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="
                  inline-flex h-11 items-center whitespace-nowrap px-3 md:px-4
                  font-display text-base tracking-[0.18em] uppercase
                  text-fg-secondary transition-colors
                  hover:text-accent
                "
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
