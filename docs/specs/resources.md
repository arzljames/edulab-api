# Resources

## Overview

Educational resources (worksheets, files, links) with a draft/publish workflow, tagging, and three companion features bundled into the same module: bookmarks (save-for-later), stars (favorite toggle), and threaded comments.

## Data model

- **`resources`** — `resource_id` (PK), `user_id` (FK → `auth.users`, owner), `title`, `description`, `grade_level`, `subject`, `file` (a plain URL string, see `docs/specs/uploads.md`), `visibility` (`public`|`private`, default `public`), `status` (`draft`|`published`, default `draft`), `published_at` (auto-stamped by a trigger the first time `status` becomes `published`), timestamps.
- **`tags`** — `tag_id`, `name` (unique), `created_at`. Shared vocabulary, no ownership.
- **`resource_tags`** — junction, composite PK `(resource_id, tag_id)`.
- **`bookmarks`**, **`stars`** — identical shape, composite PK `(user_id, resource_id)`, pure toggles.
- **`comments`** — `comment_id`, `resource_id`, `user_id` (nullable, `ON DELETE SET NULL` — comment survives author deletion), `parent_comment_id` (self-FK, nullable, `ON DELETE SET NULL` — reply survives parent deletion), `comment`, timestamps.

RLS summary: `resources` — owner sees all their own rows; anyone sees `visibility=public AND status=published` rows. `tags` — public read, any authenticated user can insert. `resource_tags`/`comments` — visibility follows the parent resource; write requires resource ownership (tags) or being the comment's own author. `bookmarks`/`stars` — fully owner-scoped.

## Access rules

See RLS summary above — enforced at the database level via `REQUEST_SUPABASE_CLIENT` (carries the caller's own JWT so `auth.uid()` resolves correctly), not duplicated as app-level checks except where noted below.

## Endpoints

| Method | Path | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| POST | `/resources` | Bearer | `CreateResourceDto` | `ResourceResponseDto` | 201 |
| GET | `/resources` | — | query: `subject?, gradeLevel?, tag?, page?, limit?` | `ResourceResponseDto[]` | Public feed — always `public`+`published` only, regardless of caller |
| GET | `/resources/mine` | Bearer | — | `ResourceResponseDto[]` | All of the caller's own, any status/visibility |
| GET | `/resources/:id` | optional | — | `ResourceResponseDto` | 404 if not visible; owner sees their own drafts/private if their token is sent, even though the route has no guard |
| PATCH | `/resources/:id` | Bearer, owner | `UpdateResourceDto` | `ResourceResponseDto` | Set `status: 'published'` to publish |
| DELETE | `/resources/:id` | Bearer, owner | — | — | 204 |
| GET | `/tags` | — | — | `TagResponseDto[]` | |
| POST/DELETE | `/resources/:id/bookmark` | Bearer | — | — | 201/204 |
| GET | `/bookmarks` | Bearer | — | `ResourceResponseDto[]` | |
| POST/DELETE | `/resources/:id/star` | Bearer | — | — | 201/204 |
| GET | `/stars` | Bearer | — | `ResourceResponseDto[]` | |
| POST | `/resources/:id/comments` | Bearer | `CreateCommentDto` | `CommentResponseDto` | 201 |
| GET | `/resources/:id/comments` | — | — | `CommentResponseDto[]` | Chronological, flat — thread client-side via `parentCommentId` |
| PATCH/DELETE | `/comments/:id` | Bearer, author | `UpdateCommentDto` | `CommentResponseDto` | |

`ResourceResponseDto`: `{ id, userId, title, description, gradeLevel, subject, file, visibility, status, publishedAt, tags: string[], createdAt, updatedAt }`
`CommentResponseDto`: `{ id, resourceId, userId, parentCommentId, comment, createdAt, updatedAt }`

## Business logic notes

- **Tags**: `CreateResourceDto`/`UpdateResourceDto` accept `tags?: string[]` (plain names). The service upserts unknown names (`ON CONFLICT DO NOTHING` — deliberately avoids needing UPDATE privilege on `tags` under RLS) and replaces the resource's `resource_tags` links wholesale on every write that includes `tags`.
- **`findAll` vs `findOne`**: the public feed (`findAll`) explicitly filters to `visibility=public AND status=published` at the query level (a deliberate product choice — an owner's own drafts shouldn't appear mixed into "the public feed" even if their token is attached). `findOne`, by contrast, has no explicit filter and relies entirely on RLS, so it naturally shows an owner their own private/draft resource when they're authenticated.
- **`published_at`** is set by a DB trigger the first time `status` transitions to `published`, and is not cleared on later unpublish/republish (preserves the original publish date).

## Security notes (from `auth-security-reviewer`)

No Critical/High findings.

Left as a known tradeoff (Medium, not fixed): **`bookmarks`/`stars` insert authorization is app-code-only** (`assertResourceVisible()` in `resources.helpers.ts`), not backed by RLS — unlike `comments`, whose RLS policy independently verifies resource visibility via a join. `bookmarks_insert_own`/`stars_insert_own` only check `auth.uid() = user_id`. Mitigated with an explicit "load-bearing, not defense-in-depth" comment at both call sites plus a regression test asserting `NotFoundException` when the check is bypassed — but if this check is ever accidentally removed in a refactor, nothing else stops a user from bookmarking/starring someone else's private resource.

## Tests

Unit: `resources.service.spec.ts`, `bookmarks.service.spec.ts`, `stars.service.spec.ts`, `comments.service.spec.ts`, `resources.helpers.spec.ts`. E2E: `test/resources.e2e-spec.ts`.
