---
description: Plan and build a new feature end to end using the project's subagents
argument-hint: <feature description>
---

Build the following feature for edulab-api: $ARGUMENTS

Follow the feature workflow in CLAUDE.md. Work in phases and do not skip ahead.

## Phase 1: Plan (no code yet)

Read CLAUDE.md, `src/app.module.ts`, and `src/features/auth/` to ground yourself in the project's conventions. Then present a plan containing:

1. **Data model:** tables, columns, relations, and constraints.
2. **Access rules:** who can read, create, update, and delete each resource. These become the RLS policies and service-level ownership checks.
3. **Endpoints:** method, path, auth requirement, request DTO, response shape, and status codes.
4. **Module structure:** files to create under `src/features/<feature>/`, plus any shared code that needs extracting.
5. **Open questions:** anything ambiguous in the request.

**Stop and wait for my approval of the plan before Phase 2.**

## Phase 2: Database

Delegate to the `database-specialist` agent with the approved data model and access rules. If it reports that the `supabase/` folder is missing, stop and ask me how to proceed.

## Phase 3: Scaffold

Delegate to the `nestjs-architect` agent with the approved module structure and the database agent's summary (tables and generated types path).

## Phase 4: API layer

Delegate to the `api-designer` agent with the approved endpoint list and the paths of the scaffolded files.

## Phase 5: Business logic

Implement the service methods yourself. Every supabase-js call checks `error`; every user-scoped operation on a resource verifies ownership or permission, especially when using the service role client.

## Phase 6: Verify

Delegate in parallel:

- `test-writer`: unit tests for the service and e2e tests for every endpoint.
- `auth-security-reviewer`: review the full diff for this feature.

Fix all Critical and High security findings and any failing tests. List Medium and Low findings for me to decide on.

## Phase 7: Report

Run `npx tsc --noEmit`, `npx oxlint`, and the full test suite. Then summarize: files created or changed, migrations added, endpoints, test results, remaining security findings, and any follow-up work.

## Phase 8: Ship

Follow `.claude/commands/pr.md` to write the docs, branch, commit, and open the PR for this feature.
