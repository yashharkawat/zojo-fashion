'use client';

import { useRef, type ReactNode } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { makeStore, type AppStore } from '@/store';
import { makeQueryClient } from '@/lib/query-client';
import { AuthBootstrap } from '@/components/auth/AuthBootstrap';
import { CartServerSync } from '@/components/cart/CartServerSync';

const GOOGLE_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function QueryShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthBootstrap />
      <CartServerSync />
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore>();
  if (!storeRef.current) storeRef.current = makeStore();

  const qcRef = useRef<ReturnType<typeof makeQueryClient>>();
  if (!qcRef.current) qcRef.current = makeQueryClient();

  return (
    <ReduxProvider store={storeRef.current}>
      <QueryClientProvider client={qcRef.current}>
        {GOOGLE_ID ? (
          <GoogleOAuthProvider clientId={GOOGLE_ID}>
            <QueryShell>{children}</QueryShell>
          </GoogleOAuthProvider>
        ) : (
          <QueryShell>{children}</QueryShell>
        )}
      </QueryClientProvider>
    </ReduxProvider>
  );
}
