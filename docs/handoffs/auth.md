# Frontend Handoff: Auth

## What's new

Email/password authentication. Base URL: `http://localhost:3000/api/v1` (local dev) — all calls go through this backend, never call Supabase directly. Swagger: `http://localhost:3000/docs`.

## Endpoints

### `POST /auth/signup`

```json
// Request
{ "email": "student@example.com", "password": "Str0ngPassword!" }

// 201 Response
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "v1.Mr5MSp8N...",
  "expiresAt": 1790131144,
  "user": { "id": "6ad2db68-...", "email": "student@example.com" }
}
```

If the backend's Supabase project has "Confirm email" on, this instead returns `422`:
```json
{ "message": "Account created. Check your email to confirm your account before logging in.", "error": "Unprocessable Entity", "statusCode": 422 }
```
Show a "check your email" screen for this case — there's no session yet, the user can't do anything authenticated until they click the emailed link and then log in.

### `POST /auth/login`

```json
// Request
{ "email": "student@example.com", "password": "Str0ngPassword!" }
// 200 Response: same AuthResponseDto shape as signup
```
`401` for wrong credentials — message is intentionally generic (`"Invalid email or password."`), don't try to distinguish "wrong password" from "no such account" in the UI.

### `POST /auth/refresh`

```json
// Request
{ "refreshToken": "v1.Mr5MSp8N..." }
// 200: same AuthResponseDto shape
```
Call this when a request 401s, or proactively when `expiresAt` (unix seconds) is close. On `401` here, the refresh token itself is dead — log the user out and send them to login.

### `POST /auth/logout`

Bearer required. `204` on success — actually revokes the session server-side (not just a client-side token discard).

### `GET /auth/me`

Bearer required. `200: { "id": "...", "email": "..." }`. Useful for a quick "am I still logged in" check on app load.

## Integration gotchas

- **Store both tokens.** `accessToken` for the `Authorization: Bearer <token>` header on every authenticated call; `refreshToken` for renewing the session.
- **Rate limits**: signup/login allow 5 requests/min per caller, refresh allows 10/min — handle `429` (show "too many attempts, try again in a bit").
- **Validation errors** are `400` with `{ message: string[], error: "Bad Request", statusCode: 400 }` — `message` can be multiple strings if several fields fail at once.
- Once you build the profile-edit screen, note that a fresh signup's `profiles` row exists immediately (auto-created) but with every name field `null` — the UI should treat "no name set yet" as a normal, expected state, not an error.
