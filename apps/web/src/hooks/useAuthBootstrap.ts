'use client';

import { useEffect } from 'react';
import { useStore } from 'react-redux';
import { registerAuthIntegration } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setAccessToken,
  setUser,
  setAuthStatus,
  logout as logoutAction,
} from '@/store/slices/authSlice';
import { authApi } from '@/features/auth/api';
import { postLoginCartSync } from '@/features/cart/postLoginSync';
import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from '@/lib/authStorage';
import type { RootState } from '@/store';

/**
 * Mount-time auth bootstrap:
 *  1. Register the transport-layer auth integration (token getter, refresh hook, logout hook)
 *  2. JWT is restored from localStorage in `makeStore` via `restoreAccessToken` before first paint
 *  3. Call /auth/me → if 401, the api client auto-refreshes once; if that fails, we land in `unauthenticated`
 *  4. When a session is valid, merge the local cart into the server cart (or load server cart)
 */
export function useAuthBootstrap(): void {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const status = useAppSelector((s) => s.auth.status);

  // Register integration with the transport layer (once).
  useEffect(() => {
    registerAuthIntegration({
      getAccessToken: () => {
        if (typeof window !== 'undefined') {
          const stored = getStoredAccessToken();
          if (stored) return stored;
        }
        return accessToken;
      },
      onTokenRefreshed: (newToken) => {
        setStoredAccessToken(newToken);
        dispatch(setAccessToken(newToken));
      },
      onAuthLost: () => {
        dispatch(logoutAction());
        clearStoredAccessToken();
      },
    });
  }, [dispatch, accessToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status !== 'idle') return;

    const stored = getStoredAccessToken();
    if (!stored) {
      dispatch(setAuthStatus('unauthenticated'));
      return;
    }

    dispatch(setAuthStatus('authenticating'));

    authApi
      .me()
      .then(async (user) => {
        dispatch(setUser(user));
        await postLoginCartSync(dispatch, () => store.getState());
        dispatch(setAuthStatus('authenticated'));
      })
      .catch(() => {
        dispatch(logoutAction());
        clearStoredAccessToken();
      });
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
