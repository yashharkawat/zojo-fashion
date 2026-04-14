# Zojo Fashion — Authentication System

> Email+password, phone OTP, email verification, password reset, JWT + refresh token rotation, secure httpOnly cookies, rate limits, auto-refresh on the client.

---

## 1. Token & session model

```
Access token            Refresh token           Verification tokens
─────────────          ─────────────            ───────────────────
HS256 JWT              Opaque 64-byte random    OTP: 6-digit numeric
15 min TTL             7 days                   Email verify: 32-byte URL
In Authorization       DB-stored SHA-256 hash   Pwd reset: 32-byte URL
  Bearer header        httpOnly cookie on       All hashed in DB
                       /api/v1/auth, SameSite=  All single-use
                       Lax, Secure in prod
```

**Rotation** — every `/auth/refresh` revokes the presented token and issues a new one. Re-use of a revoked refresh token → revoke all tokens for that user (reuse detection).

**Password hashing** — argon2id (already in `lib/password.ts`, OWASP 2024 params).

---

## 2. Data model additions

One unified `VerificationToken` covers OTP, email-verify, and password-reset. Each row is hashed, scoped, expirable, single-use.

```prisma
enum VerificationTokenType {
  OTP_LOGIN          // phone OTP
  EMAIL_VERIFICATION
  PASSWORD_RESET
}

model VerificationToken {
  id                 String                @id @default(cuid())
  type               VerificationTokenType
  userId             String?                // null for OTP_LOGIN on new signup
  user               User?                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  identifier         String                 // phone (E.164) for OTP, email for others
  codeHash           String                 // SHA-256 of raw code/token
  expiresAt          DateTime
  attemptsRemaining  Int                    @default(5)
  consumedAt         DateTime?
  ipAddress          String?
  createdAt          DateTime               @default(now())

  @@index([type, identifier, consumedAt])
  @@index([expiresAt])
  @@unique([type, identifier, codeHash]) // prevents dupes of same code
}
```

And one field on User:
```prisma
model User {
  // ...existing
  emailVerified   DateTime?   // becomes non-null after verification
  phoneVerified   DateTime?   // becomes non-null after first OTP success
}
```

---

## 3. Endpoints

All `/api/v1/auth/*`. Protected routes: require Bearer JWT. Webhook-free.

| Method | Path | Purpose | Rate limit (per IP) |
|---|---|---|---|
| POST | `/register` | Email+password signup | 10/min |
| POST | `/login` | Email+password login | 10/min |
| POST | `/refresh` | Rotate refresh token | 10/min |
| POST | `/logout` | Revoke refresh token | — |
| GET  | `/me` | Current user (Bearer) | — |
| POST | `/otp/send` | Send OTP to phone | **3/min + 10/day per phone** |
| POST | `/otp/verify` | Verify OTP → login/register | 10/min + 5 attempts/OTP |
| POST | `/email/send-verification` | Email verify link (Bearer) | 3/min per user |
| POST | `/email/verify` | Confirm email by token | 20/min |
| POST | `/password/reset-request` | Send reset email | 3/min + 10/day per email |
| POST | `/password/reset-confirm` | Consume token + set pwd | 10/min |

### OTP rules

- 6-digit numeric, random via `crypto.randomInt`
- TTL: 5 minutes
- 5 attempts per issued OTP (decremented on bad-verify)
- Previous unconsumed OTPs for the same phone are invalidated when a new one is issued
- Resend cooldown: 60 seconds (enforced on `otp/send`)

### Email verify / password reset rules

- 32-byte URL-safe random token
- TTL: email-verify 24h, password-reset 30m
- Single-use (`consumedAt` set on success)
- Token embedded in a URL: `https://zojofashion.com/verify?token=...`

---

## 4. Flows

### 4.1 Phone OTP login/signup
```
Client → POST /auth/otp/send { phone }
   server: rate-limit + resend cooldown → generate OTP → store hash → SMS via MSG91
   response: { ok: true, resendInSeconds: 60 }

Client → POST /auth/otp/verify { phone, code }
   server:
     - fetch active OTP row for phone (not consumed, not expired)
     - compare sha256(code) to codeHash
     - on miss: decrement attemptsRemaining, 422
     - on hit: mark consumed
     - find/create user by phone (autoregister on first login)
     - issue access + refresh, same shape as /login
   response: { user, accessToken } + Set-Cookie: rt=...
```

### 4.2 Email verification
```
On register: create User → async POST /auth/email/send-verification (or inline)
  server: generate token → store hash → send email with link
  response: 202

User clicks link → /verify?token=... → client POST /auth/email/verify { token }
  server: validate + consume → set user.emailVerified = now()
```

### 4.3 Password reset
```
POST /auth/password/reset-request { email }
  server: generate token → store hash → email link (even if email doesn't exist — don't leak)
  response: 202 regardless

User clicks → /password-reset?token=... → POST /auth/password/reset-confirm { token, newPassword }
  server: validate + consume → update passwordHash → revoke ALL refresh tokens for user
  response: { ok: true }
```

---

## 5. Security checklist

- [x] argon2id for passwords
- [x] SHA-256 hash of refresh tokens in DB; raw never stored
- [x] SHA-256 hash of OTPs / URL tokens in DB
- [x] httpOnly + SameSite=Lax + Secure (prod) refresh cookie
- [x] JWT 15-min TTL keeps blast radius small
- [x] Refresh-token reuse detection → nuke all sessions
- [x] Rate limits per-IP + per-identifier (OTP send / pwd reset)
- [x] Generic messages for login / reset-request (no user enumeration)
- [x] Password-reset confirm **revokes all refresh tokens** — forces re-login on all devices
- [x] OTP: 6 digits, 5-attempt cap, 5-min TTL, resend cooldown
- [x] Pino redaction already masks `Authorization`, `cookie`, `password`, `razorpay_signature`

---

## 6. Frontend

### State (Redux Toolkit)
- `auth.accessToken` — in-memory + mirrored to localStorage for bootstrap on reload
- `auth.user` — the `PublicUser`; rehydrated from `/auth/me` on app mount
- `auth.status`: `'idle' | 'authenticating' | 'authenticated' | 'unauthenticated'`
- `ui.loginModalOpen` — drives the LoginModal

### Bootstrap on load (`useAuthBootstrap`)
1. If no token in localStorage → set status `unauthenticated`
2. Else → set token in store + call `/auth/me`
3. On 200 → set user, status `authenticated`
4. On 401 → try `/auth/refresh` (cookie-based)
5. If refresh succeeds → set new token → retry `/auth/me`
6. If refresh fails → clear token + status `unauthenticated`

### Auto-refresh (API client)
- Single queue: if a request returns 401, queue subsequent requests, fire ONE `/auth/refresh`, then replay queued requests with the new token.
- On refresh failure → dispatch `logout()`, route to `/login?next=<current>`.

### Protected routes
- `<RequireAuth>` component wraps pages. On `status !== 'authenticated'` it redirects to `/login?next=<current>`.
- Alternative (used for public pages): `LoginModal` gated by `ui.loginModalOpen` so "Login" button in header opens it without leaving the page.

### Login modal
Tabs: **Email** | **Phone (OTP)**. Toggle at bottom to switch to Register. Link to "Forgot password?".

---

## 7. Files

### Backend
- `prisma/schema.prisma` — +`VerificationToken`, +`emailVerified`/`phoneVerified` on User
- `apps/api/src/lib/otp.ts` — generate/hash/verify OTP
- `apps/api/src/lib/verification-tokens.ts` — unified helpers for URL tokens
- `apps/api/src/modules/auth/auth.service.ts` — +OTP, +email verify, +password reset
- `apps/api/src/modules/auth/auth.schema.ts` — +Zod
- `apps/api/src/modules/auth/auth.controller.ts` — +handlers
- `apps/api/src/modules/auth/auth.routes.ts` — +endpoints + per-route limits

### Frontend
- `apps/web/src/lib/api.ts` — auto-refresh queue
- `apps/web/src/features/auth/api.ts` — typed calls
- `apps/web/src/features/auth/useLogin.ts`, `useRegister.ts`, `useOtp.ts`
- `apps/web/src/hooks/useAuthBootstrap.ts`
- `apps/web/src/components/auth/LoginModal.tsx`
- `apps/web/src/components/auth/EmailPasswordForm.tsx`
- `apps/web/src/components/auth/PhoneOtpForm.tsx`
- `apps/web/src/components/auth/RegisterForm.tsx`
- `apps/web/src/components/auth/RequireAuth.tsx`
- `apps/web/src/app/login/page.tsx`, `register/page.tsx`, `password-reset/page.tsx`
- `apps/web/src/store/slices/uiSlice.ts` — `loginModalOpen`
- `apps/web/src/app/providers.tsx` — run bootstrap on mount
