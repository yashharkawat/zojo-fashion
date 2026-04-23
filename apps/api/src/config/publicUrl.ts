import { env } from './env';

/**
 * Base URL of the Next.js storefront (for links in transactional emails).
 */
export function publicWebBaseUrl(): string {
  if (env.FRONTEND_URL) {
    return env.FRONTEND_URL.replace(/\/$/, '');
  }
  const raw = env.API_BASE_URL.replace(/\/$/, '');
  try {
    const u = new URL(raw);
    if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.port === '4000') {
      return `${u.protocol}//${u.hostname}:3000`;
    }
    if (u.hostname.startsWith('api.')) {
      u.hostname = u.hostname.slice(4);
      return u.origin;
    }
  } catch {
    // fall through
  }
  return raw.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');
}
