import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { ok, noContent } from '../../lib/response';
import { UnauthorizedError } from '../../lib/errors';
import * as authService from './auth.service';
import type {
  RegisterBody,
  LoginBody,
  OtpSendBody,
  OtpVerifyBody,
  EmailVerifyBody,
  PasswordResetRequestBody,
  PasswordResetConfirmBody,
  GoogleSignInBody,
} from './auth.schema';

const REFRESH_COOKIE_NAME = 'rt';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function setRefreshCookie(res: Response, raw: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, raw, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    path: REFRESH_COOKIE_PATH,
  });
}

// ─── Email + password ────────────────────────────────────

export async function registerHandler(req: Request<unknown, unknown, RegisterBody>, res: Response) {
  const { user, tokens } = await authService.register(req.body, {
    userAgent: req.header('user-agent'),
    ip: req.ip,
  });
  setRefreshCookie(res, tokens.refreshTokenRaw, tokens.refreshExpiresAt);
  return ok(res, { user, accessToken: tokens.accessToken }, 201);
}

export async function loginHandler(req: Request<unknown, unknown, LoginBody>, res: Response) {
  const { user, tokens } = await authService.login(req.body, {
    userAgent: req.header('user-agent'),
    ip: req.ip,
  });
  setRefreshCookie(res, tokens.refreshTokenRaw, tokens.refreshExpiresAt);
  return ok(res, { user, accessToken: tokens.accessToken });
}

export async function googleSignInHandler(req: Request<unknown, unknown, GoogleSignInBody>, res: Response) {
  const { user, tokens } = await authService.signInWithGoogle(req.body, {
    userAgent: req.header('user-agent'),
    ip: req.ip,
  });
  setRefreshCookie(res, tokens.refreshTokenRaw, tokens.refreshExpiresAt);
  return ok(res, { user, accessToken: tokens.accessToken });
}

export async function refreshHandler(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!raw) throw new UnauthorizedError('Missing refresh token');
  const tokens = await authService.refresh(raw, {
    userAgent: req.header('user-agent'),
    ip: req.ip,
  });
  setRefreshCookie(res, tokens.refreshTokenRaw, tokens.refreshExpiresAt);
  return ok(res, { accessToken: tokens.accessToken });
}

export async function logoutHandler(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (raw) await authService.logout(raw);
  clearRefreshCookie(res);
  return noContent(res);
}

export async function meHandler(req: Request, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const user = await authService.getMe(req.auth.userId);
  return ok(res, user);
}

// ─── OTP ─────────────────────────────────────────────────

export async function otpSendHandler(req: Request<unknown, unknown, OtpSendBody>, res: Response) {
  const result = await authService.sendOtp(req.body, { ip: req.ip });
  return ok(res, result);
}

export async function otpVerifyHandler(req: Request<unknown, unknown, OtpVerifyBody>, res: Response) {
  const { user, tokens, created } = await authService.verifyOtp(req.body, {
    userAgent: req.header('user-agent'),
    ip: req.ip,
  });
  setRefreshCookie(res, tokens.refreshTokenRaw, tokens.refreshExpiresAt);
  return ok(res, { user, accessToken: tokens.accessToken, created });
}

// ─── Email verification ───────────────────────────────────

export async function emailSendVerificationHandler(req: Request, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const result = await authService.sendEmailVerification(req.auth.userId);
  return ok(res, result);
}

export async function emailVerifyHandler(req: Request<unknown, unknown, EmailVerifyBody>, res: Response) {
  const result = await authService.confirmEmailVerification(req.body);
  return ok(res, result);
}

// ─── Password reset ───────────────────────────────────────

export async function passwordResetRequestHandler(
  req: Request<unknown, unknown, PasswordResetRequestBody>,
  res: Response,
) {
  const result = await authService.requestPasswordReset(req.body, { ip: req.ip });
  return ok(res, result);
}

export async function passwordResetConfirmHandler(
  req: Request<unknown, unknown, PasswordResetConfirmBody>,
  res: Response,
) {
  const result = await authService.confirmPasswordReset(req.body);
  return ok(res, result);
}
