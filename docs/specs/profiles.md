# Profiles

## Overview

App-owned user profile data (name, photo) separate from Supabase's `auth.users`. Read/update only — there's no create or delete flow, since every row is provisioned automatically.

## Data model

**`profiles`** — `id` (PK, `references auth.users(id) on delete cascade` — mirrors the auth user's id, no surrogate key), `first_name`, `middle_name`, `last_name`, `profile_photo` (all nullable text), `created_at`, `updated_at`.

A `handle_new_user()` trigger (`SECURITY DEFINER`, `AFTER INSERT ON auth.users`) inserts a `profiles` row (all name/photo fields null) the instant someone signs up — verified live: the row exists before any application code runs.

RLS: `SELECT` is public (anyone can view any profile — needed for e.g. showing a resource author's name). `UPDATE` is owner-only (`auth.uid() = id`). No client `INSERT`/`DELETE` policy — the trigger, running `SECURITY DEFINER`, is the only insert path.

## Access rules

| Endpoint | Auth |
|---|---|
| `GET /profiles/:id` | Public |
| `GET /profiles/me`, `PATCH /profiles/me` | Bearer JWT |

`PATCH /profiles/me`'s target is always `@CurrentUser('id')` — never a client-supplied id — so there's no way to update another user's profile regardless of what's in the request body.

## Endpoints

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/profiles/me` | Bearer | — | `ProfileResponseDto` |
| GET | `/profiles/:id` | — | — | `ProfileResponseDto` or 404 |
| PATCH | `/profiles/me` | Bearer | `UpdateProfileDto { firstName?, middleName?, lastName?, profilePhoto? }` | `ProfileResponseDto` |

`ProfileResponseDto`: `{ id, firstName, middleName, lastName, profilePhoto, createdAt, updatedAt }` — name/photo fields nullable until set.

## Business logic notes

- `update()` builds a partial payload from only the DTO fields that are `!== undefined`. If the payload ends up empty (caller sent a body with no recognized fields), it short-circuits to `findOne(id)` and returns `200` with the unchanged profile rather than a distinct "nothing to update" signal — a deliberate simplicity choice, not a bug.
- No relation to `resources`/`auth` beyond the `id` FK — profile data is purely descriptive.

## Security notes (from `auth-security-reviewer`)

No Critical/High/Medium findings. Confirmed clean: no mass-assignment surface, no PII beyond the intentionally-public name/photo fields, update target always scoped to the authenticated caller.

Left as optional hardening (Low, not fixed): `profilePhoto` accepts any string with no `@IsUrl()`/scheme validation. The backend never fetches or processes it (no SSRF risk here), but if a frontend ever renders it unsanitized (`<img src>`), a `javascript:`/`data:` URI could be a stored-XSS vector on that client.

## Tests

Unit: `profiles.service.spec.ts` (100% coverage on the service). E2E: `test/profiles.e2e-spec.ts`.
