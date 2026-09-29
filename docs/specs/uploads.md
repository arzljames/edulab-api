# Uploads

## Overview

A standalone file-upload service, deliberately decoupled from `resources`. The frontend calls this first to get a URL, then includes that URL as a plain string in a resource's `file` field (or anywhere else that needs one, e.g. a future profile photo upload) — no file bytes or upload metadata are ever persisted in Postgres.

## Data model

None. This feature has no database table — it's a stateless proxy to Cloudinary. Uploaded files exist only in Cloudinary's storage, referenced by whatever URL the consuming feature chooses to save.

## Access rules

`POST /uploads` requires a valid Bearer JWT (`JwtAuthGuard`) — prevents anonymous abuse of the Cloudinary account's quota/cost. No ownership concept beyond "must be logged in": uploads aren't tied to a specific user record or resource at upload time (see Security notes).

## Endpoints

| Method | Path | Auth | Request | Response | Status |
|---|---|---|---|---|---|
| POST | `/uploads` | Bearer | `multipart/form-data`, field `file` | `UploadResponseDto { url }` | 201 / 400 (no file / disallowed type) / 401 / 413 (>15MB) / 500 (Cloudinary unconfigured) |

Throttled to 10/min on top of the global 100/min default.

## Business logic notes

- **Allowed types**: images (jpeg/png/webp/gif), PDF, and Office formats (doc/docx/ppt/pptx/xls/xlsx) — gated by `file.mimetype` (client-declared, not content-sniffed — see Security notes).
- **Max size**: 15MB, enforced by multer at the stream level before the handler runs (can't be bypassed by lying about `Content-Length`).
- **In-memory storage**: `FileInterceptor` uses multer's default in-memory buffer (no disk write), streamed directly to Cloudinary via `upload_stream`.
- **Folder**: all uploads land under a fixed `edulab/resources` Cloudinary folder; no `public_id` is supplied, so Cloudinary generates a random, non-enumerable identifier per asset.
- **Lazy config validation, deliberately**: `cloudinaryClientProvider` never throws if `CLOUDINARY_*` env vars are missing — it's eagerly instantiated at module bootstrap, and an earlier version that threw there crashed the *entire app*, not just uploads. `UploadsService.uploadFile()` checks config and throws a clean `500` at request time instead. Don't "fix" this back to eager validation.

## Security notes (from `auth-security-reviewer`)

Fixed (High): `@nestjs/platform-express@12.0.1` was shipping a nested, vulnerable `multer@2.2.0` (two DoS advisories) separate from the patched `2.4.0` already in `package.json`, and `FileInterceptor` was actually resolving to the vulnerable nested copy. Fixed via `npm audit fix` (deduped the tree, no breaking changes) — `npm audit --omit=dev` now reports 0 vulnerabilities.

Left as known tradeoffs (Medium, not fixed):
- **File type is mimetype-only, not content-verified.** A client can lie about `Content-Type`. Not executable risk (this Node process never parses/runs the file), but means arbitrary content could end up hosted at an EduLab-associated Cloudinary URL. Would need magic-byte sniffing (e.g. the `file-type` package) plus Cloudinary's own `allowed_formats` option as a second gate.
- **No per-user quota, uploads aren't linked to any record.** A file lands in Cloudinary the moment `POST /uploads` succeeds, whether or not it's ever attached to a resource. Only the 10/min throttle limits velocity, not total volume over time — no storage cap, no orphaned-asset cleanup job.

Low (not fixed): in-memory storage is fine at current scale but worth revisiting under heavy concurrent load; Cloudinary upstream failures currently surface as a generic `400` rather than `502`/`500`.

## Tests

Unit: `uploads.service.spec.ts` (config-missing paths, Cloudinary success/error paths, 100% coverage). E2E: `test/uploads.e2e-spec.ts` (401, no-file 400, disallowed-mimetype 400, oversized 413, mocked-success 201).
