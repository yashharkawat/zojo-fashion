import { z } from 'zod';

const phoneRegex = /^\+91[6-9]\d{9}$/;

// ─── Email + password ────────────────────────────────────

export const registerBodySchema = z.object({
  email: z.string().email().toLowerCase().max(120),
  password: z.string().min(8).max(100),
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().max(50).optional(),
  phone: z.string().regex(phoneRegex, 'Must be E.164 Indian format +91XXXXXXXXXX'),
  referredByCode: z.string().trim().max(20).optional(),
  marketingOptIn: z.boolean().default(false),
});

export const loginBodySchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(100),
});

// ─── OTP ─────────────────────────────────────────────────

export const otpSendBodySchema = z.object({
  phone: z.string().regex(phoneRegex, 'Must be +91 followed by a 10-digit number'),
});

export const otpVerifyBodySchema = z.object({
  phone: z.string().regex(phoneRegex),
  code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  firstName: z.string().trim().min(1).max(50).optional(),
});

// ─── Email verification ───────────────────────────────────

export const emailVerifyBodySchema = z.object({
  token: z.string().min(16).max(200),
});

// ─── Password reset ───────────────────────────────────────

export const passwordResetRequestBodySchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const passwordResetConfirmBodySchema = z.object({
  token: z.string().min(16).max(200),
  newPassword: z.string().min(8).max(100),
});

export const googleSignInBodySchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
  /** Applied only when a new account is created */
  marketingOptIn: z.boolean().optional(),
});

// ─── Types ────────────────────────────────────────────────

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type OtpSendBody = z.infer<typeof otpSendBodySchema>;
export type OtpVerifyBody = z.infer<typeof otpVerifyBodySchema>;
export type EmailVerifyBody = z.infer<typeof emailVerifyBodySchema>;
export type PasswordResetRequestBody = z.infer<typeof passwordResetRequestBodySchema>;
export type PasswordResetConfirmBody = z.infer<typeof passwordResetConfirmBodySchema>;
export type GoogleSignInBody = z.infer<typeof googleSignInBodySchema>;
