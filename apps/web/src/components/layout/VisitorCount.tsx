'use client';

import { useEffect, useState } from 'react';

export function VisitorCount() {
  const [count, setCount] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/visitors')
      .then((r) => r.json() as Promise<{ count?: string }>)
      .then(({ count }) => {
        if (count && count !== '0') setCount(count);
      })
      .catch(() => {});
  }, []);

  if (!count) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
      {count} visits
    </span>
  );
}
