import type { ReactNode } from 'react';
import Link from 'next/link';

type Props = {
  title: string;
  children: ReactNode;
  backHref?: string;
};

export function StaticInfoPage({ title, children, backHref = '/' }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href={backHref} className="text-sm text-fg-muted transition-colors hover:text-accent">
        ← Home
      </Link>
      <h1 className="mt-4 font-display text-3xl tracking-tight text-fg-primary">{title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-fg-secondary [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </div>
  );
}
