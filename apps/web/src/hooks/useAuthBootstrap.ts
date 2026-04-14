'use client';

import { useEffect } from 'react';
import { registerAuthIntegration } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setAccessToken,
  setUser,
  setAuthStatus,
  logout as logoutAction,
} from '@/store/slices/authSlice';
import { authApi } from '@/features/auth/api';

const TOKEN_KEY = 'zojo.auth.accessToken';

/**
 * Mount-time auth bootstrap:
 *  1. Register the transport-layer auth integration (token getter, refresh hook, logout hook)
 *  2. Rehydrate access token from localStorage
 *  3. Call /auth/me → if 401, the api client auto-refreshes once; if that fails, we land in `unauthenticated`
 *
 * Should be mounted once at the app root (inside <Providers>).
 */
export function useAuthBootstrap(): void {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const status = useAppSelector((s) => s.auth.status);

  // Register integration with the transport layer (once).
  useEffect(() => {
    registerAuthIntegration({
      getAccessToken: () => {
        // Read directly from window to avoid closure staleness; fallback to store value.
        if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem(TOKEN_KEY);
          if (stored) return stored;
        }
        return accessToken;
      },
      onTokenRefreshed: (newToken) => {
        dispatch(setAccessToken(newToken));
      },
      onAuthLost: () => {
        dispatch(logoutAction());
        try {
          window.localStorage.removeItem(TOKEN_KEY);
        } catch {
          /* private mode */
        }
      },
    });
  }, [dispatch, accessToken]);

  // Rehydrate from localStorage + fetch /me
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status !== 'idle') return;

    dispatch(setAuthStatus('authenticating'));
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored) {
      dispatch(setAccessToken(stored));
    }

    authApi
      .me()
      .then((user) => {
        dispatch(setUser(user));
        dispatch(setAuthStatus('authenticated'));
      })
      .catch(() => {
        // api.ts already tried /refresh once via integration; give up cleanly.
        dispatch(logoutAction());
        try {
          window.localStorage.removeItem(TOKEN_KEY);
        } catch { /* ignore */ }
      });
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
