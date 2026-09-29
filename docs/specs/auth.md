# Auth

## Overview

Email/password authentication backed entirely by Supabase Auth. The API is a thin wrapper around Supabase's Auth methods (`signUp`, `signInWithPassword`, `refreshSession`, `signOut`, `getUser`) — there is no custom credential storage, no `users` table, and no service-role usage anywhere in this feature.

## Data model

No custom tables. Identity lives in Supabase's built-in `auth.users`. A `public.profiles` row is auto-created for every new `auth.users` row via a `handle_new_user()` trigger (`SECURITY DEFINER`, fires `AFTER INSERT ON auth.users`) — see `docs/specs/profiles.md`.

## Access rules

| Endpoint | Auth |
|---|---|
| `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh` | Public |
| `POST /auth/logout`, `GET /auth/me` | Bearer JWT (`JwtAuthGuard`) |

## Endpoints

| Method | Path | Auth | Request | Response | Status |
|---|---|---|---|---|---|
| POST | `/auth/signup` | — | `SignUpDto { email, password }` | `AuthResponseDto` | 201 / 400 / 409 / 422 (email confirmation pending) |
| POST | `/auth/login` | — | `LoginDto { email, password }` | `AuthResponseDto` | 200 / 400 / 401 |
| POST | `/auth/refresh` | — | `RefreshTokenDto { refreshToken }` | `AuthResponseDto` | 200 / 400 / 401 |
| POST | `/auth/logout` | Bearer | — | — | 204 / 401 |
| GET | `/auth/me` | Bearer | — | `CurrentUserDto { id, email }` | 200 / 401 |

`AuthResponseDto`: `{ accessToken, refreshToken, expiresAt, user: { id, email } }`

Signup/login are throttled to 5/min, refresh to 10/min (`@Throttle`, on top of the global 100/min default).

## Business logic notes

- **Email confirmation**: whether `signup` returns a session immediately depends on the Supabase project's "Confirm email" setting. When on, `signUp()` returns no session (`data.session === null`) and the endpoint returns `422` ("check your email"). When off, Supabase auto-confirms at signup and a session is returned immediately — there's no way to get a genuine "logged in but unconfirmed" middle state via Supabase's own gate (verified empirically against the live project).
- **Logout actually revokes the session.** The shared `SUPABASE_CLIENT` is a stateless singleton (`persistSession: false`), so a plain `auth.signOut()` on it is a no-op. `AuthService.logout()` instead builds a short-lived client scoped to the caller's own access token (`createScopedSupabaseClient`) and calls `auth.admin.signOut(accessToken, 'global')` on it — this only needs the caller's own JWT, not the service-role key, despite living under the SDK's `admin` namespace.
- **Generic error messages on login/refresh** (`'Invalid email or password.'` / `'Invalid or expired refresh token.'`) regardless of the underlying Supabase error, to avoid confirming whether an email is registered.
- `signUp`'s error mapping treats `error.status === 422` as "account already exists" (→ 409) — this over-matches other 422-class Supabase errors like weak-password (known Medium finding, not fixed, see below).

## Security notes (from `auth-security-reviewer`)

Fixed (Critical/High):
- Logout was a silent no-op (didn't actually revoke sessions) — fixed as described above.
- No rate limiting on login/signup/refresh — fixed via `@nestjs/throttler`.

Left as known tradeoffs (Medium/Low, not fixed):
- `signUp`'s `error.status === 422` check over-matches non-"already exists" validation errors (should key off `error.code` only).
- Signup reveals account existence (409 vs 201) — no rate-limit-independent mitigation.
- No `@MaxLength` on signup password; no `helmet()`; Swagger exposed unauthenticated at `/docs` in all environments including prod.
- Tokens are returned in the JSON body, not `httpOnly` cookies — a deliberate tradeoff for an API-first backend, revisit if a first-party browser frontend ever needs it.

## Tests

Unit: `src/features/auth/auth.service.spec.ts`, `src/shared/auth/guards/jwt-auth.guard.spec.ts` (signup/login/refresh/logout/getMe success + every error branch; guard's token extraction/validation edge cases). E2E: `test/auth.e2e-spec.ts` (validation errors, mocked-success flows, 401s on guarded routes).
