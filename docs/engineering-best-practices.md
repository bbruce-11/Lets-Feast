# Engineering Best Practices — Audit & Roadmap

Last updated: 2026-07-13
Scope: security/reliability posture for `apps/api` and `apps/admin`, evaluated against
what's needed to run a payments-adjacent, three-sided marketplace at production scale.

## Already solid (confirmed in code)

- Real password hashing via `bcryptjs` (not plaintext or reversible encryption)
- `JwtAuthGuard` verifies JWT **signatures** server-side (`jwtService.verify()`), not just decoding
- `RolesGuard` re-checks role fresh from the DB on every request — a revoked/changed
  role takes effect immediately, without waiting for token expiry
- Admin login cookie is `httpOnly` + `secure` (prod) + `sameSite: lax`
- `JWT_SECRET` already fails closed in production if unset
- Prisma ORM — parameterized queries by default, no raw string-built SQL observed

## Fixed in this pass (zero new dependencies)

1. **`STAFF_PASSCODE`** no longer silently falls back to the hardcoded `'feast-staff'`
   in production — it now throws at boot if unset, matching the `JWT_SECRET` pattern.
   *(`apps/api/src/auth/auth.service.ts`)*
2. **CORS** is no longer wide open — `main.ts` now resolves an explicit origin
   allowlist from `CORS_ORIGINS`, and throws at boot if that's unset in production.
   *(`apps/api/src/main.ts`)*
3. Documented that `apps/admin/middleware.ts`'s role check is UI-routing only (it
   doesn't verify the JWT signature) — the real boundary is the API's guards.
4. Added `.env.example` for both apps reflecting every env var actually referenced
   in the code.

## Needs your input before I can go further

- **`apps/api` and `apps/admin` both have no `package.json`** — can't install,
  build, typecheck, or add any dependency (including the ones below) until these
  exist. This blocks nearly everything past this point.
- **`apps/admin/lib/api.ts` doesn't exist** — `page.tsx` imports `adminApi` and a
  `Restaurant` type from it, but the file never made it into the repo.
- **`STAFF_PASSCODE` is a single platform-wide shared secret** by design right now.
  Worth deciding: is per-restaurant staff auth (or per-user accounts with the
  `restaurant_staff` role, bypassing the passcode entirely) in scope before the
  pilot, or is the shared passcode acceptable for a small, known pilot restaurant
  list and worth deferring to Phase 2?

## Recommended priority order for what's left

Given the July 24 demo deadline, in order of leverage vs. effort:

1. **Request validation** — add `class-validator`/`class-transformer` + a global
   `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`. Currently
   request bodies are trusted at the TypeScript-compile-time level only, with no
   runtime enforcement.
2. **Rate limiting** on `/auth/signin` and the staff passcode endpoint via
   `@nestjs/throttler` — cheap to add, meaningfully raises the cost of brute-forcing
   the passcode from gap #1 above.
3. **Security headers** (`helmet`) — CSP, `X-Frame-Options`, HSTS, etc. Low effort,
   standard for any public-facing API.
4. **CI on push** — GitHub Actions running `pnpm typecheck` and `pnpm test` per app,
   so regressions surface before a demo, not during one.
5. **Legal/compliance posture** — Terms of Service, Privacy Policy, and PCI-DSS
   scope (currently minimal since payments are `SIMULATED`, but this becomes real
   once Stripe Connect lands in Phase 2). This is a legal question, not an
   engineering one — worth raising with your trademark attorney while you're
   already meeting with them in late July, rather than treated as a dev task.

Items 1–4 are all things I can execute directly once `apps/api/package.json` and
`apps/admin/package.json` exist. Item 5 needs a lawyer, not a git commit.
