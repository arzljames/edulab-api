# Frontend Handoff: Resources

## What's new

Resources (worksheets/files/links) with drafts, publishing, tags, plus bookmarks, stars, and threaded comments. Everything requires a bearer token from `docs/handoffs/auth.md` for any write; reads are mostly public.

## Endpoints

### `POST /resources` — create (Bearer)

```json
// Request
{
  "title": "Fractions Worksheet",
  "description": "Practice sheet for grade 5",
  "gradeLevel": "Grade 5",
  "subject": "Mathematics",
  "file": "https://res.cloudinary.com/.../fractions.pdf",
  "visibility": "public",
  "tags": ["fractions", "worksheet"]
}
// 201 Response
{
  "id": "218914e9-...", "userId": "6ad2db68-...",
  "title": "Fractions Worksheet", "description": "Practice sheet for grade 5",
  "gradeLevel": "Grade 5", "subject": "Mathematics",
  "file": "https://res.cloudinary.com/.../fractions.pdf",
  "visibility": "public", "status": "draft", "publishedAt": null,
  "tags": ["fractions", "worksheet"],
  "createdAt": "2026-09-23T01:39:47.048Z", "updatedAt": "2026-09-23T01:39:47.048Z"
}
```
All fields except `title` are optional. New resources always start as `status: "draft"` — invisible to everyone but the owner until published. Get a `file` URL from `POST /uploads` first (see `docs/handoffs/uploads.md`) if the resource has an attachment.

### `GET /resources` — public feed (no auth needed)

Query params: `?subject=Mathematics&gradeLevel=Grade+5&tag=fractions&page=1&limit=20`. Returns `ResourceResponseDto[]` — **only `public` + `published`** resources, regardless of who's asking. Use this for the discovery/browse screen.

### `GET /resources/mine` — my resources (Bearer)

Same response shape, no query params — returns every resource the caller owns, any status/visibility. Use this for "my resources" / drafts management.

### `GET /resources/:id` — single resource

No guard, but **send the bearer token if the user is logged in anyway** — an owner viewing their own draft/private resource needs their token attached for RLS to let them see it; a logged-out or different user gets `404` for anything not public+published (indistinguishable from "doesn't exist" — don't build UI that assumes you can tell the difference).

### `PATCH /resources/:id` — update (Bearer, owner only)

Same body shape as create, all fields optional, plus `status: "draft" | "published"`. **Publishing is just `{ "status": "published" }`** — the backend stamps `publishedAt` automatically. `tags` (if included) replaces the full tag list, not a merge — send the complete desired set.

### `DELETE /resources/:id` (Bearer, owner) → `204`

### `GET /tags` — no auth

```json
[{ "id": "1daa443e-...", "name": "fractions", "createdAt": "2026-09-23T01:39:25.445Z" }]
```
Use for tag-picker autocomplete. There's no separate "create tag" call — just include new tag names directly in a resource's `tags` array and the backend upserts them.

### Bookmarks / Stars (Bearer, identical shape for both)

```
POST   /resources/:id/bookmark   → 201
DELETE /resources/:id/bookmark   → 204
GET    /bookmarks                → ResourceResponseDto[]  (same shape as the feed)

POST   /resources/:id/star       → 201
DELETE /resources/:id/star       → 204
GET    /stars                    → ResourceResponseDto[]
```
Both are plain toggles — `POST` is idempotent-ish (won't error if already bookmarked), `DELETE` always succeeds whether or not it was bookmarked.

### Comments

```json
// POST /resources/:id/comments  (Bearer)
{ "comment": "This was really helpful!", "parentCommentId": null }
// 201 Response
{
  "id": "e0ad4dbd-...", "resourceId": "218914e9-...",
  "userId": "6ad2db68-...", "parentCommentId": null,
  "comment": "This was really helpful!",
  "createdAt": "2026-09-23T01:40:16.651Z", "updatedAt": "2026-09-23T01:40:16.651Z"
}
```
For a threaded reply, set `parentCommentId` to the parent comment's `id`.

`GET /resources/:id/comments` (no auth) returns a **flat, chronological array** — build the reply tree client-side by grouping on `parentCommentId`. `userId` and `parentCommentId` can be `null` (comment author deleted their account / parent comment was deleted) — render these as e.g. "[deleted user]" rather than crashing.

`PATCH /comments/:id` / `DELETE /comments/:id` (Bearer, comment author only) — `{ "comment": "..." }` / `204`.

## Integration gotchas

- **Owner-vs-public visibility is entirely token-driven**, not a separate "as-owner" flag or endpoint. Always send the bearer token on `GET /resources` / `GET /resources/:id` / `GET /resources/:id/comments` when the user is logged in, even though these routes don't require it — it changes what comes back.
- `404` on `GET /resources/:id` means either "doesn't exist" or "exists but you can't see it" — always the same response, by design.
- `visibility`/`status` are enums (`'public'|'private'`, `'draft'|'published'`) — validate client-side against these exact string values before sending, the API rejects anything else with `400`.
- No pagination metadata (total count, next-page cursor) is returned yet — `GET /resources` just returns however many rows matched `page`/`limit`. If you need "are there more pages," request `limit + 1` and check the count, or ask the backend to add proper pagination metadata.
