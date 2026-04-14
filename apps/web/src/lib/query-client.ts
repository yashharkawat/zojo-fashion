import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@/types/api';

/** Factory so server and client can have isolated instances. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 min
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (count, err) => {
          // Don't retry 4xx
          if (err instanceof ApiClientError && err.status >= 400 && err.status < 500) {
            return false;
          }
          return count < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
