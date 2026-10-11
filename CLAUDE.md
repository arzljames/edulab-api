# edulab-api

NestJS (TypeScript) REST API for EduLab. Data and authentication are provided by Supabase (Postgres + Supabase Auth), accessed through `@supabase/supabase-js`. There is no ORM.

## Commands

Verify these against `package.json` and update this list if any differ.

- `npm run start:dev` — run the API with watch mode
- `npm run build` — compile to `dist/`
- `npm run test` — unit tests (Jest, config in `jest.config.ts`)
- `npm run test:e2e` — e2e tests in `test/`
- `npx oxlint` — lint (config in `oxlint.json`)
- `npx tsc --noEmit` — type-check without building

Before finishing any task: type-check, lint, and run the tests for the files you touched.

## Project structure

- `src/main.ts` — bootstrap (global pipes, `/api/v1` prefix, CORS, Swagger at `/api/v1/docs`)
- `src/app.module.ts` — root module; every feature module is registered here
- `src/shared/` — cross-feature code, imported by more than one `src/features/*` module. `src/shared/supabase/` (client providers, config) and `src/shared/auth/` (`JwtAuthGuard`, `@CurrentUser()`, `AuthenticatedUser`) are the current shared modules. Ask before adding a new top-level folder here.
- `src/features/<feature>/` — one folder per domain feature (`auth`, `resources`, `profiles`, `uploads`):
  - `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`
  - `dto/`, `interfaces/` — only when the feature needs them; guards/decorators meant for reuse across features go in `src/shared/`, not inside a single feature
  - `<feature>-config.ts` — feature-specific configuration (only for config not already in `src/shared/supabase/supabase-config.ts`)
- `supabase/` — Supabase CLI project: `migrations/` (source of truth for schema), `config.toml`, generated `database.types.ts` (re-exported from `src/shared/supabase/database.types.ts` for a stable in-`src` import path)
- `test/` — e2e tests

## Docs (Claude Doc artifacts, not repo files)

Feature specs and the frontend integration handoff live as Claude Doc artifacts, not files in this repo — see `/pr`. Two living docs, one section per feature, updated in place as features ship (never create a new doc per feature):

- **Feature Specs** — internal reference (data model, access rules, endpoints, business logic, security notes, tests) — <https://claude.ai/artifact/N6kqC28oAnnFs6Lqh891cJ>
- **Frontend Integration Handoff** — written for the frontend session (endpoints, request/response examples, gotchas) — <https://claude.ai/artifact/KyK2hopVhbgHnvYt7UrL38>

## Conventions

- File names are kebab-case with a type suffix: `create-lesson.dto.ts`, `jwt-auth.guard.ts`, `current-user.decorator.ts`.
- Controllers are thin (HTTP only); business logic lives in services.
- Every request body and query uses a DTO with `class-validator` decorators. Never return raw database rows; map to response DTOs.
- Configuration goes through `@nestjs/config`. Do not read `process.env` outside config files.
- Use Nest's `Logger`, never `console.log`.
- Code used by only one feature stays in that feature. Do not import another feature's internals; move shared code to a shared module instead (ask before creating new top-level folders).

## Supabase rules

- supabase-js returns `{ data, error }` and does not throw. Always check `error` and convert it to a Nest exception.
- Two Supabase client shapes live in `src/shared/supabase/`: `SUPABASE_CLIENT` (anon-key singleton, no user session — only for Supabase Auth calls like `signUp`/`signInWithPassword`/`getUser`) and `REQUEST_SUPABASE_CLIENT` (request-scoped, carries the caller's bearer token so `auth.uid()` resolves under RLS — use this for every query against an RLS-protected table). Never query a data table with `SUPABASE_CLIENT`.
- No feature currently uses the service role / secret key — RLS is the authorization boundary for all data access so far. If a feature genuinely needs it, any code using it must enforce authorization (ownership checks) in NestJS, and never expose the key in responses or logs.
- Every table has Row Level Security enabled; a new table without RLS is a bug, not an oversight to fix later.
- Multi-step writes that must be atomic go into a Postgres function called with `.rpc()`.
- Schema changes are made only through Supabase CLI migrations (`supabase/migrations/`), never in the dashboard. The schema is under version control; treat `supabase/migrations/` as the source of truth and read recent migrations for naming/RLS conventions before writing a new one.
- Never run commands against the remote Supabase project (`db push`, `link`, `pull`, remote resets) without explicit confirmation.

## Subagents (`.claude/agents/`)

Delegate to these agents rather than doing their work inline:

| Agent                      | Use for                                                                        |
| -------------------------- | ------------------------------------------------------------------------------ |
| `nestjs-architect`         | Module structure, scaffolding, where code belongs, shared modules              |
| `database-specialist`      | Migrations, tables, RLS policies, indexes, Postgres functions, generated types |
| `api-designer`             | Controllers, endpoints, DTOs, validation, pagination, Swagger                  |
| `test-writer`              | Unit and e2e tests; run after implementing or changing code                    |
| `auth-security-reviewer`   | Read-only security review after auth, permission, or data-access changes       |
| `error-logging-specialist` | Exception filters, error format, logging, health checks                        |

Subagents do not see this conversation. When delegating, give them the full context they need: the feature requirements, relevant file paths, and the output of any earlier agent they depend on.

## Feature workflow

For a new feature, follow this order (or run `/new-feature <description>`):

1. Plan: agree on the data model, endpoints, and permissions with the user before writing code.
2. `database-specialist` — migration, RLS, types.
3. `nestjs-architect` — scaffold the module under `src/features/`.
4. `api-designer` — DTOs, controller, Swagger.
5. Implement service logic.
6. `test-writer` and `auth-security-reviewer` — can run in parallel.
7. Fix findings, then run type-check, lint, and all tests.
8. Ship: run `/pr` (see `.claude/commands/pr.md`) — updates the two living docs (see "Docs" above), branches, commits, and opens a PR to `main`. Always stops for confirmation before pushing or opening the PR — never push or open a PR unattended.
