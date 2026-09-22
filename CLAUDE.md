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

- `src/main.ts` — bootstrap (global pipes, prefix, Swagger, CORS)
- `src/app.module.ts` — root module; every feature module is registered here
- `src/features/<feature>/` — one folder per domain feature. `src/features/auth/` is the reference implementation:
  - `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`
  - `dto/`, `interfaces/`, `guards/`, `decorators/` — only when the feature needs them
  - `<feature>-config.ts` — feature-specific configuration
- `test/` — e2e tests

## Conventions

- File names are kebab-case with a type suffix: `create-lesson.dto.ts`, `jwt-auth.guard.ts`, `current-user.decorator.ts`.
- Controllers are thin (HTTP only); business logic lives in services.
- Every request body and query uses a DTO with `class-validator` decorators. Never return raw database rows; map to response DTOs.
- Configuration goes through `@nestjs/config`. Do not read `process.env` outside config files.
- Use Nest's `Logger`, never `console.log`.
- Code used by only one feature stays in that feature. Do not import another feature's internals; move shared code to a shared module instead (ask before creating new top-level folders).

## Supabase rules

- supabase-js returns `{ data, error }` and does not throw. Always check `error` and convert it to a Nest exception.
- The Supabase client currently lives in `src/features/auth/supabase-auth.client.ts`. Do not import it from other features; a shared Supabase module is needed once a second feature requires database access.
- The service role / secret key bypasses Row Level Security. Any code using it must enforce authorization (ownership checks) in NestJS. Never expose this key in responses or logs.
- Multi-step writes that must be atomic go into a Postgres function called with `.rpc()`.
- Schema changes are made only through Supabase CLI migrations, never in the dashboard.
- **TODO:** the `supabase/` folder does not exist yet, so the schema is not under version control. Run `supabase init`, `supabase link`, and `supabase db pull` before the first schema change.
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
