'use client';

import { useRef, type ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { makeStore, type AppStore } from '@/store';
import { makeQueryClient } from '@/lib/query-client';
import { AuthBootstrap } from '@/components/auth/AuthBootstrap';

export function Providers({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore>();
  if (!storeRef.current) storeRef.current = makeStore();

  const qcRef = useRef<ReturnType<typeof makeQueryClient>>();
  if (!qcRef.current) qcRef.current = makeQueryClient();

  return (
    <ReduxProvider store={storeRef.current}>
      <QueryClientProvider client={qcRef.current}>
        <AuthBootstrap />
        {children}
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ReduxProvider>
  );
}
