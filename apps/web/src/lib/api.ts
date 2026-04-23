import { ApiClientError, type ApiResponse, type ErrorCode } from '@/types/api';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!BASE) throw new Error('NEXT_PUBLIC_API_BASE_URL not set');

interface ApiInit extends Omit<RequestInit, 'body'> {
  token?: string | null;
  body?: unknown;
  /** Skip auto-refresh on 401 (used by /auth/refresh itself to avoid recursion). */
  skipAuthRefresh?: boolean;
}

/**
 * Auth integration hooks — set by the Providers component on mount.
 * Kept as a module-level registry rather than prop-drilled so that the
 * transport layer can refresh tokens without knowing anything about React.
 */
interface AuthIntegration {
  getAccessToken: () => string | null;
  onTokenRefreshed: (accessToken: string) => void;
  onAuthLost: () => void;
}

let authIntegration: AuthIntegration | null = null;
export function registerAuthIntegration(integration: AuthIntegration): void {
  authIntegration = integration;
}

// ─── Refresh queue ────────────────────────────────────────

/**
 * When a 401 is encountered:
 *  1. If a refresh is already in flight, await it (same promise returned to
 *     every caller — no thundering herd of /refresh calls).
 *  2. Otherwise start one, hand its promise to subsequent 401s.
 *  3. On success, retry the original request with the new token.
 *  4. On failure, notify auth to log out and surface the error.
 */
let inflightRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as ApiResponse<{ accessToken: string }>;
      if (body.error || !body.data?.accessToken) return null;
      const newToken = body.data.accessToken;
      authIntegration?.onTokenRefreshed(newToken);
      return newToken;
    } catch {
      return null;
    } finally {
      // clear so next 401 can trigger a fresh attempt
      setTimeout(() => { inflightRefresh = null; }, 0);
    }
  })();

  return inflightRefresh;
}

// ─── Main `api()` ─────────────────────────────────────────

async function performRequest<T>(
  path: string,
  init: ApiInit,
  explicitToken: string | null,
): Promise<{ data: T; meta: ApiResponse<T>['meta'] }> {
  const { body, headers, skipAuthRefresh: _skip, token: _ignored, ...rest } = init;
  void _skip;
  void _ignored;

  const url = `${BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(explicitToken ? { Authorization: `Bearer ${explicitToken}` } : {}),
        ...(headers ?? {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Browser shows this as "Failed to fetch" — almost always: API not running, wrong URL, or CORS.
    const isNet = e instanceof TypeError;
    const hint = isNet
      ? `Cannot reach the API at ${BASE}. Start the backend (cd apps/api && npm run dev) and ensure NEXT_PUBLIC_API_BASE_URL matches.`
      : e instanceof Error
        ? e.message
        : 'Network request failed';
    throw new ApiClientError(hint, 'UNKNOWN', 0);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError('Invalid server response', 'UNKNOWN', res.status);
  }

  if (!res.ok || payload.error) {
    const err = payload.error ?? {
      code: 'UNKNOWN' as ErrorCode,
      message: 'Request failed',
      details: undefined,
    };
    throw new ApiClientError(err.message, err.code, res.status, err.details);
  }

  return { data: payload.data as T, meta: payload.meta };
}

async function withAutoRefresh<T>(
  path: string,
  init: ApiInit,
): Promise<{ data: T; meta: ApiResponse<T>['meta'] }> {
  const initialToken = init.token ?? authIntegration?.getAccessToken() ?? null;
  try {
    return await performRequest<T>(path, init, initialToken);
  } catch (err) {
    if (
      err instanceof ApiClientError &&
      err.status === 401 &&
      !init.skipAuthRefresh &&
      path !== '/auth/refresh' &&
      path !== '/auth/login' &&
      path !== '/auth/google' &&
      path !== '/auth/register'
    ) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        authIntegration?.onAuthLost();
        throw err;
      }
      return performRequest<T>(path, { ...init, skipAuthRefresh: true }, newToken);
    }
    throw err;
  }
}

/** Returns just `data`. Most call sites want this. */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const result = await withAutoRefresh<T>(path, init);
  return result.data;
}

/** Returns `data + meta` (incl. pagination). Same auth/refresh semantics. */
export async function apiWithMeta<T>(
  path: string,
  init: ApiInit = {},
): Promise<{ data: T; meta: ApiResponse<T>['meta'] }> {
  return withAutoRefresh<T>(path, init);
}
