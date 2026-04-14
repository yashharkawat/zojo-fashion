'use client';

import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';

/**
 * Null-render component — exists purely so `useAuthBootstrap` runs inside
 * the Redux + React Query provider tree.
 */
export function AuthBootstrap(): null {
  useAuthBootstrap();
  return null;
}
