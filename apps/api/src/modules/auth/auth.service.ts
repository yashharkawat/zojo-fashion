import { VerificationTokenType, type Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { hashPassword, verifyPassword } from '../../lib/password';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  type AccessTokenPayload,
} from '../../lib/jwt';
import {
  generateOtpCode,
  generateUrlToken,
  hashCode,
  OTP_TTL_SECONDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  EMAIL_VERIFY_TTL_SECONDS,
  PASSWORD_RESET_TTL_SECONDS,
} from '../../lib/otp';
import { sendEmail, sendSms } from '../../lib/notifications';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '../../lib/errors';
import type {
  RegisterBody,
  LoginBody,
  OtpSendBody,
  OtpVerifyBody,
  EmailVerifyBody,
  PasswordResetRequestBody,
  PasswordResetConfirmBody,
} from './auth.schema';

export interface AuthTokens {
  accessToken: string;
  refreshTokenRaw: string;
  refreshExpiresAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: 'CUSTOMER' | 'ADMIN' | 'SUPPORT' | 'SUPER_ADMIN';
  gstin: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
}

type UserForPublic = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: PublicUser['role'];
  gstin: string | null;
  emailVerified: Date | null;
  phoneVerified: Date | null;
};

function toPublicUser(u: UserForPublic): PublicUser {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    role: u.role,
    gstin: u.gstin,
    emailVerified: !!u.emailVerified,
    phoneVerified: !!u.phoneVerified,
  };
}

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  gstin: true,
  emailVerified: true,
  phoneVerified: true,
} as const;

async function issueTokens(
  payload: AccessTokenPayload,
  userAgent: string | undefined,
  ip: string | undefined,
): Promise<AuthTokens> {
  const accessToken = signAccessToken(payload);
  const { raw, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: payload.sub,
      tokenHash: hash,
      expiresAt,
      userAgent: userAgent?.slice(0, 255) ?? null,
      ipAddress: ip ?? null,
    },
  });

  return { accessToken, refreshTokenRaw: raw, refreshExpiresAt: expiresAt };
}

// ============================================================
// REGISTER / LOGIN — email + password
// ============================================================

export async function register(
  input: RegisterBody,
  meta: { userAgent?: string; ip?: string },
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const [emailExists, phoneExists] = await Promise.all([
    prisma.user.findUnique({ where: { email: input.email } }),
    prisma.user.findUnique({ where: { phone: input.phone } }),
  ]);
  if (emailExists) throw new ConflictError('Email already registered');
  if (phoneExists) throw new ConflictError('Phone number already registered');

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      referredByCode: input.referredByCode ?? null,
      marketingOptIn: input.marketingOptIn,
    },
    select: USER_SELECT,
  });

  // Fire verification email async (no await — user shouldn't block)
  sendEmailVerification(user.id).catch((err) =>
    logger.warn({ err, userId: user.id }, 'Email verification dispatch failed'),
  );

  const tokens = await issueTokens(
    { sub: user.id, role: user.role, email: user.email },
    meta.userAgent,
    meta.ip,
  );

  return { user: toPublicUser(user), tokens };
}

export async function login(
  input: LoginBody,
  meta: { userAgent?: string; ip?: string },
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive || user.deletedAt) {
    throw new UnauthorizedError('Invalid email or password'); // generic, no enumeration
  }

  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new UnauthorizedError('Invalid email or password');

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const tokens = await issueTokens(
    { sub: user.id, role: user.role, email: user.email },
    meta.userAgent,
    meta.ip,
  );

  return { user: toPublicUser(user), tokens };
}

// ============================================================
// REFRESH / LOGOUT / ME
// ============================================================

export async function refresh(
  rawRefreshToken: string,
  meta: { userAgent?: string; ip?: string },
): Promise<AuthTokens> {
  const tokenHash = hashRefreshToken(rawRefreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, role: true, email: true, isActive: true, deletedAt: true } } },
  });

  if (!stored) throw new UnauthorizedError('Invalid refresh token');

  if (stored.revokedAt) {
    // Reuse detection — nuke all sessions for this user
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Refresh token reused — all sessions revoked');
  }

  if (stored.expiresAt < new Date()) throw new UnauthorizedError('Refresh token expired');
  if (!stored.user.isActive || stored.user.deletedAt) throw new UnauthorizedError('Account disabled');

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(
    { sub: stored.user.id, role: stored.user.role, email: stored.user.email },
    meta.userAgent,
    meta.ip,
  );
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...USER_SELECT, isActive: true, deletedAt: true },
  });
  if (!user || !user.isActive || user.deletedAt) throw new NotFoundError('User not found');
  return toPublicUser(user);
}

// ============================================================
// OTP — send / verify
// ============================================================

export async function sendOtp(
  input: OtpSendBody,
  meta: { ip?: string },
): Promise<{ ok: true; resendInSeconds: number }> {
  // Cooldown check — reject if we sent one < 60s ago for this phone
  const recent = await prisma.verificationToken.findFirst({
    where: {
      type: VerificationTokenType.OTP_LOGIN,
      identifier: input.phone,
      consumedAt: null,
      createdAt: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    const msLeft =
      OTP_RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - recent.createdAt.getTime());
    throw new ValidationError(`Please wait ${Math.ceil(msLeft / 1000)}s before requesting another OTP`);
  }

  // Daily cap — 10 OTPs per phone per 24h (anti-spam)
  const last24h = await prisma.verificationToken.count({
    where: {
      type: VerificationTokenType.OTP_LOGIN,
      identifier: input.phone,
      createdAt: { gt: new Date(Date.now() - 24 * 3600 * 1000) },
    },
  });
  if (last24h >= 10) {
    throw new ValidationError('Too many OTPs requested today. Please try again tomorrow.');
  }

  const code = generateOtpCode();
  const codeHash = hashCode(code);

  // Invalidate any outstanding unconsumed OTPs for this phone
  await prisma.verificationToken.updateMany({
    where: {
      type: VerificationTokenType.OTP_LOGIN,
      identifier: input.phone,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });

  await prisma.verificationToken.create({
    data: {
      type: VerificationTokenType.OTP_LOGIN,
      identifier: input.phone,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      ipAddress: meta.ip ?? null,
    },
  });

  // Fire SMS — non-blocking, but we still await here so the endpoint's success
  // reflects dispatch. Production: enqueue via BullMQ, 202 immediately.
  await sendSms({
    to: input.phone,
    body: `Your Zojo Fashion code: ${code}. Expires in 5 minutes. Do not share.`,
  });

  // In dev mode, log the OTP for testing convenience.
  if (env.NODE_ENV !== 'production') {
    logger.info({ phone: input.phone, code }, '[DEV] OTP issued');
  }

  return { ok: true, resendInSeconds: OTP_RESEND_COOLDOWN_SECONDS };
}

export async function verifyOtp(
  input: OtpVerifyBody,
  meta: { userAgent?: string; ip?: string },
): Promise<{ user: PublicUser; tokens: AuthTokens; created: boolean }> {
  const active = await prisma.verificationToken.findFirst({
    where: {
      type: VerificationTokenType.OTP_LOGIN,
      identifier: input.phone,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!active) throw new UnauthorizedError('OTP expired or not found — request a new one');
  if (active.attemptsRemaining <= 0) {
    await prisma.verificationToken.update({
      where: { id: active.id },
      data: { consumedAt: new Date() }, // burn it
    });
    throw new UnauthorizedError('Too many attempts — request a new OTP');
  }

  const isValid = active.codeHash === hashCode(input.code);

  if (!isValid) {
    await prisma.verificationToken.update({
      where: { id: active.id },
      data: { attemptsRemaining: { decrement: 1 } },
    });
    throw new UnauthorizedError('Incorrect OTP');
  }

  // Consume the OTP
  await prisma.verificationToken.update({
    where: { id: active.id },
    data: { consumedAt: new Date() },
  });

  // Find or auto-register
  let user = await prisma.user.findUnique({
    where: { phone: input.phone },
    select: USER_SELECT,
  });
  let created = false;

  if (!user) {
    // Auto-register — no password set; user must do "Set password" later
    const randomPwdHash = await hashPassword(
      `unset-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    user = await prisma.user.create({
      data: {
        email: `${input.phone.replace('+', '')}@phone.zojofashion.local`, // placeholder unique
        phone: input.phone,
        passwordHash: randomPwdHash,
        firstName: input.firstName ?? 'Friend',
        phoneVerified: new Date(),
      },
      select: USER_SELECT,
    });
    created = true;
  } else if (!user.phoneVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: new Date(), lastLoginAt: new Date() },
      select: USER_SELECT,
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  }

  const tokens = await issueTokens(
    { sub: user.id, role: user.role, email: user.email },
    meta.userAgent,
    meta.ip,
  );

  return { user: toPublicUser(user), tokens, created };
}

// ============================================================
// EMAIL VERIFICATION
// ============================================================

export async function sendEmailVerification(userId: string): Promise<{ ok: true }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, emailVerified: true },
  });
  if (!user) throw new NotFoundError('User not found');
  if (user.emailVerified) return { ok: true };

  const { raw, hash } = generateUrlToken();

  // Invalidate prior tokens of same type for this email
  await prisma.verificationToken.updateMany({
    where: {
      type: VerificationTokenType.EMAIL_VERIFICATION,
      identifier: user.email,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });

  await prisma.verificationToken.create({
    data: {
      type: VerificationTokenType.EMAIL_VERIFICATION,
      userId: user.id,
      identifier: user.email,
      codeHash: hash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_SECONDS * 1000),
    },
  });

  const link = `${env.API_BASE_URL.replace(/\/api.*$/, '')}/verify-email?token=${raw}`;
  // Frontend URL would be preferable; reading from a separate env var is cleaner at scale.
  await sendEmail({
    to: user.email,
    subject: 'Verify your Zojo Fashion email',
    html: `
      <p>Hey ${user.firstName ?? 'there'},</p>
      <p>Confirm your email to get access to order tracking and drop alerts.</p>
      <p><a href="${link}" style="background:#FF4500;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Verify email</a></p>
      <p style="color:#666;font-size:12px">Link expires in 24 hours.</p>
    `,
    tags: { type: 'email_verification' },
  });

  return { ok: true };
}

export async function confirmEmailVerification(input: EmailVerifyBody): Promise<{ ok: true }> {
  const hash = hashCode(input.token);
  const row = await prisma.verificationToken.findFirst({
    where: {
      type: VerificationTokenType.EMAIL_VERIFICATION,
      codeHash: hash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!row || !row.userId) throw new UnauthorizedError('Invalid or expired verification link');

  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerified: new Date() },
    }),
  ]);

  return { ok: true };
}

// ============================================================
// PASSWORD RESET
// ============================================================

export async function requestPasswordReset(
  input: PasswordResetRequestBody,
  meta: { ip?: string },
): Promise<{ ok: true }> {
  // Always return 200 — don't leak whether the email exists
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, firstName: true, isActive: true, deletedAt: true },
  });

  if (user && user.isActive && !user.deletedAt) {
    // Anti-spam: max 10 reset requests per email per 24h
    const last24h = await prisma.verificationToken.count({
      where: {
        type: VerificationTokenType.PASSWORD_RESET,
        identifier: user.email,
        createdAt: { gt: new Date(Date.now() - 24 * 3600 * 1000) },
      },
    });
    if (last24h >= 10) {
      logger.warn({ email: user.email }, 'Password reset rate limited (daily cap)');
      return { ok: true }; // silent
    }

    const { raw, hash } = generateUrlToken();
    await prisma.verificationToken.updateMany({
      where: {
        type: VerificationTokenType.PASSWORD_RESET,
        identifier: user.email,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    await prisma.verificationToken.create({
      data: {
        type: VerificationTokenType.PASSWORD_RESET,
        userId: user.id,
        identifier: user.email,
        codeHash: hash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000),
        ipAddress: meta.ip ?? null,
      },
    });

    const link = `${env.API_BASE_URL.replace(/\/api.*$/, '')}/password-reset?token=${raw}`;
    await sendEmail({
      to: user.email,
      subject: 'Reset your Zojo Fashion password',
      html: `
        <p>Hi ${user.firstName ?? 'there'},</p>
        <p>Click below to reset your password. This link expires in 30 minutes.</p>
        <p><a href="${link}" style="background:#FF4500;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Reset password</a></p>
        <p style="color:#666;font-size:12px">Didn't request this? Ignore this email — your password stays the same.</p>
      `,
      tags: { type: 'password_reset' },
    });
  }

  return { ok: true };
}

export async function confirmPasswordReset(input: PasswordResetConfirmBody): Promise<{ ok: true }> {
  const hash = hashCode(input.token);
  const row = await prisma.verificationToken.findFirst({
    where: {
      type: VerificationTokenType.PASSWORD_RESET,
      codeHash: hash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!row || !row.userId) throw new UnauthorizedError('Invalid or expired reset link');

  const newHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: newHash },
    }),
    // Force re-login on all devices after a password reset
    prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

// ============================================================
// Utility — typed Prisma input narrowing (exported for tests)
// ============================================================

export type { Prisma };
