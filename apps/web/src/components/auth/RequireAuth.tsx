'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/Skeleton';

export interface RequireAuthProps {
  children: ReactNode;
  /** If true, require role IN (ADMIN, SUPPORT, SUPER_ADMIN) */
  adminOnly?: boolean;
  /** Where to send unauthenticated users. Defaults to /login. */
  fallbackPath?: string;
}

/**
 * Wraps a client page/section; redirects to login if not authenticated.
 * Shows a skeleton during the auth bootstrap window so there's no flash.
 */
export function RequireAuth({ children, adminOnly = false, fallbackPath = '/login' }: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    if (status === 'authenticating' || status === 'idle') return;
    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`${fallbackPath}?next=${next}`);
      return;
    }
    if (adminOnly && !isAdmin) {
      router.replace('/');
    }
  }, [status, isAuthenticated, isAdmin, adminOnly, fallbackPath, pathname, router]);

  if (status === 'idle' || status === 'authenticating') {
    return (
      <div className="mx-auto max-w-md space-y-3 p-8" aria-live="polite" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!isAuthenticated || (adminOnly && !isAdmin)) {
    return null; // redirect in flight
  }
  return <>{children}</>;
}
