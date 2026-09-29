# Frontend Handoff: Profiles

## What's new

User profile data (name, photo) separate from the auth account. A profile is created automatically the instant someone signs up — you never need to call a "create profile" endpoint, it already exists (with everything `null`) by the time your first `GET` runs.

## Endpoints

### `GET /profiles/me` (Bearer)

```json
{
  "id": "6ad2db68-3117-4638-8f8f-332e86857c12",
  "firstName": null, "middleName": null, "lastName": null, "profilePhoto": null,
  "createdAt": "2026-09-23T01:39:04.233Z", "updatedAt": "2026-09-23T01:39:04.233Z"
}
```
Fetch this after login to populate a profile/settings screen. All name fields being `null` is the normal state for a brand-new account — render as empty inputs, not an error state.

### `GET /profiles/:id` — no auth needed

Same shape as above, for any user's `id` (e.g. showing a resource author's name/avatar). This is intentionally public — every field on a profile is meant to be viewable by anyone.

### `PATCH /profiles/me` (Bearer)

```json
// Request — every field optional, send only what changed
{ "firstName": "Ada", "lastName": "Lovelace" }

// 200 Response
{
  "id": "6ad2db68-...",
  "firstName": "Ada", "middleName": null, "lastName": "Lovelace",
  "profilePhoto": null,
  "createdAt": "2026-09-23T01:39:04.233Z", "updatedAt": "2026-09-23T02:15:49.171Z"
}
```
For `profilePhoto`, upload the image via `POST /uploads` first (see `docs/handoffs/uploads.md`) and send the returned URL as the string value here — same pattern as a resource's `file` field.

## Integration gotchas

- There's no `PATCH /profiles/:id` for other users — you can only ever update your own profile, and the target is always inferred from your bearer token, never from a URL param.
- `firstName`/`middleName`/`lastName` are capped at 100 characters, `profilePhoto` at 2048 — exceeding either gets a `400`.
- Sending a `PATCH` with no recognized fields (e.g. `{}`) is harmless — you just get back the unchanged profile with `200`, not an error.
