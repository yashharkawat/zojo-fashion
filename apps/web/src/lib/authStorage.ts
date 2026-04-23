/**
 * Access token persistence — keeps users signed in across tabs and full page reloads.
 * Refresh token remains httpOnly on the API; the short-lived JWT is stored here.
 */
export const AUTH_ACCESS_TOKEN_KEY = 'zojo.auth.accessToken';

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTH_ACCESS_TOKEN_KEY, token);
  } catch {
    /* quota / private mode */
  }
}

export function clearStoredAccessToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
