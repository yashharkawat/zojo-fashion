'use client';

import { useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';

import { authApi, type AuthResult } from '@/features/auth/api';
import { ApiClientError } from '@/types/api';

export function googleAuthEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
}

type Props = {
  mode: 'register' | 'login';
  /** New accounts only — forwarded to the API (defaults true server-side) */
  marketingOptIn?: boolean;
  onAuthed: (result: AuthResult) => void;
  onFailure?: (message: string) => void;
};

/**
 * "Sign in with Google" (opens Google’s popup; uses the same backend session as email/password).
 * Hidden when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is unset.
 */
export function GoogleAuthBlock({ mode, marketingOptIn, onAuthed, onFailure }: Props) {
  const [working, setWorking] = useState(false);

  if (!googleAuthEnabled()) return null;

  async function handleSuccess(res: CredentialResponse) {
    if (!res.credential) {
      onFailure?.('Google did not return a sign-in token.');
      return;
    }
    setWorking(true);
    try {
      const out = await authApi.google({
        idToken: res.credential,
        marketingOptIn: mode === 'register' ? marketingOptIn : undefined,
      });
      await onAuthed(out);
    } catch (err) {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Google sign-in failed';
      onFailure?.(msg);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className={working ? 'pointer-events-none opacity-60' : ''}>
      <div className="flex w-full justify-center [&>div]:!w-full [&>div>button]:!w-full">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => onFailure?.('Google sign-in was cancelled or failed.')}
          useOneTap={false}
          text={mode === 'register' ? 'signup_with' : 'signin_with'}
          size="large"
          width={384}
          theme="filled_black"
          shape="rectangular"
        />
      </div>
    </div>
  );
}
