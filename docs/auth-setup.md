# Authentication Setup and Status

## Implemented flows

- NextAuth JWT sessions.
- Central page-route protection in `middleware.ts` for account, dashboard, notification, personal P2P, submission, and administration surfaces.
- Signed-out visits to protected pages are redirected to `/redirect`; a validated internal `next` path carries the intended destination through sign-in, registration, and Google OAuth.
- Optional Google OAuth.
- Email/password registration with bcrypt hashing.
- Email verification through signed tokens and Resend.
- Ticket-backed credentials sign-in.
- TOTP 2FA with hashed single-use backup codes.
- Anti-phishing code settings.
- Admin roles and granular permissions stored on users/session tokens.

These flows still require security, recovery, rate-limit, session, and abuse testing before production approval.

## Required environment

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-secret
NEXT_PUBLIC_SITE_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
ADMIN_EMAILS=you@example.com

DATABASE_URL=your-neon-connection-string
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM="Kwizerana Collab <onboarding@resend.dev>"
```

Google OAuth redirect for local development:

```text
http://localhost:3000/api/auth/callback/google
```

Use the production origin for both `NEXTAUTH_URL` and the production OAuth redirect. Do not reuse local secrets.

## Current security notes

- Page access is centrally guarded, while API authorization is still enforced inside individual route handlers and needs further consolidation and automated coverage.
- Auth rate limiting is in-memory and does not coordinate across serverless instances.
- Rate limiting currently covers only selected registration/login/verification endpoints.
- `NEXTAUTH_SECRET` also derives TOTP encryption and signed application tokens; rotation needs a planned migration/recovery procedure.
- Admin checks are duplicated across routes and should be consolidated.
- Development admin bypasses must be proven impossible in production.
- Session/device history, revocation, password reset, and account recovery need completion.
- Sensitive P2P actions should require recent authentication and, where appropriate, 2FA.

See `docs/PRODUCTION-READINESS.md` for launch gates.
