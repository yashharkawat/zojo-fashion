import { api } from '@/lib/api';
import type { PublicUser } from '@/store/slices/authSlice';

// ─── DTOs ────────────────────────────────────────────────

export interface LoginInput { email: string; password: string; }
export interface RegisterInput {
  email: string; password: string; firstName: string; lastName?: string;
  phone: string; marketingOptIn?: boolean;
}
export interface OtpSendInput { phone: string; }
export interface OtpVerifyInput { phone: string; code: string; firstName?: string; }
export interface PasswordResetRequestInput { email: string; }
export interface PasswordResetConfirmInput { token: string; newPassword: string; }

export interface AuthResult { user: PublicUser; accessToken: string; }
export interface OtpSendResult { ok: true; resendInSeconds: number; }
export interface OtpVerifyResult { user: PublicUser; accessToken: string; created: boolean; }

// ─── Calls ───────────────────────────────────────────────

export const authApi = {
  register: (input: RegisterInput) =>
    api<AuthResult>('/auth/register', { method: 'POST', body: input }),

  login: (input: LoginInput) =>
    api<AuthResult>('/auth/login', { method: 'POST', body: input }),

  /** Sign in or sign up with a Google ID token (from the Google One Tap / Sign In button) */
  google: (input: { idToken: string; marketingOptIn?: boolean }) =>
    api<AuthResult>('/auth/google', { method: 'POST', body: input }),

  logout: () =>
    api<null>('/auth/logout', { method: 'POST' }),

  me: () =>
    api<PublicUser>('/auth/me'),

  otpSend: (input: OtpSendInput) =>
    api<OtpSendResult>('/auth/otp/send', { method: 'POST', body: input }),

  otpVerify: (input: OtpVerifyInput) =>
    api<OtpVerifyResult>('/auth/otp/verify', { method: 'POST', body: input }),

  requestPasswordReset: (input: PasswordResetRequestInput) =>
    api<{ ok: true }>('/auth/password/reset-request', { method: 'POST', body: input }),

  confirmPasswordReset: (input: PasswordResetConfirmInput) =>
    api<{ ok: true }>('/auth/password/reset-confirm', { method: 'POST', body: input }),

  verifyEmail: (token: string) =>
    api<{ ok: true }>('/auth/email/verify', { method: 'POST', body: { token } }),
};
