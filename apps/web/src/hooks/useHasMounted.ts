'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `true` after the component has mounted on the client.
 * Use to gate any render that depends on persisted client state
 * (localStorage, media queries, random values) to avoid SSR hydration
 * mismatches.
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
