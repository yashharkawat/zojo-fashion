import crypto from 'node:crypto';

/** 6-digit numeric OTP. Uses crypto.randomInt for uniform distribution. */
export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/** Generic URL-safe random token — email verify / password reset. */
export function generateUrlToken(bytes = 32): { raw: string; hash: string } {
  const raw = crypto.randomBytes(bytes).toString('base64url');
  const hash = hashCode(raw);
  return { raw, hash };
}

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

export const EMAIL_VERIFY_TTL_SECONDS = 24 * 60 * 60;
export const PASSWORD_RESET_TTL_SECONDS = 30 * 60;
