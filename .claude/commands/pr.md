---
description: Write feature docs, branch, commit, and open a PR to main for the current feature work
argument-hint: [feature name or description, if not obvious from context]
---

Ship the current feature work in `edulab-api`: $ARGUMENTS

This command is the last step after a feature's code, tests, and security review are done — either invoked directly, or as Phase 8 of `/new-feature`. Do not use it mid-feature; the code should already work and pass `npx tsc --noEmit`, lint, and tests before you start this.

## 1. Identify the feature

Figure out what's being shipped from context: recent conversation, `git status`, `git diff` (staged, unstaged, and against `origin/main` if already committed), and which files under `src/features/` are new or changed. If it's ambiguous (e.g. several unrelated things happened in this session), ask before proceeding rather than guessing — a PR should be one coherent feature, not a grab-bag.

Pick a short kebab-case slug for it (e.g. `resource-comments`, `cloudinary-uploads`). You'll reuse this slug for the branch name and both doc filenames.

## 2. Write the feature spec doc

Create `docs/specs/<slug>.md` covering, only where applicable to this feature:

- **Overview** — one paragraph: what this feature does and why.
- **Data model** — tables/columns/relations touched or added, and a summary of their RLS policies (owner/public/system-only per operation). Skip if the feature added no schema.
- **Access rules** — who can read/create/update/delete each resource, in plain language.
- **Endpoints** — a table: method, path (including the `/api/v1` prefix), auth requirement, request DTO shape, response DTO shape, status codes.
- **Business logic notes** — anything non-obvious: validation rules, edge cases, background jobs/triggers involved, rate limits.
- **Security notes** — findings from the `auth-security-reviewer` pass on this feature: what was fixed, and any Medium/Low findings left as known tradeoffs (with the reasoning, so it doesn't get silently "fixed" later by someone who doesn't know it was deliberate).
- **Tests** — what's covered (unit/e2e counts), what's explicitly out of scope.

Pull the actual details from the real code and migrations — don't describe intended behavior, describe what's actually there. If something in this list doesn't apply, omit the heading rather than filling it with "N/A".

## 3. Write the frontend handoff doc

Create `docs/handoffs/<slug>.md` — written for whoever is building the frontend against this feature (a person or another Claude session), not for a backend engineer. Structure:

- **What's new** — one or two sentences.
- **Endpoints** — method, path, auth (bearer required? public?), request body shape, response shape, and the status codes a client needs to handle. Use real field names and types, not the internal DB column names.
- **Integration gotchas** — anything a frontend dev would trip over: fields that can be `null`, validation limits that'll produce a 400, rate limits, ownership rules that affect what a user can see/do, anything asynchronous or eventually-consistent.
- **Example requests/responses** — at least one realistic JSON example per endpoint, enough to copy-paste against.

Keep this self-contained: someone should be able to paste just this file into a frontend-focused Claude session and start integrating without needing the rest of the backend repo for context. If a prior handoff doc already exists for a related feature (check `docs/handoffs/`), keep terminology and structure consistent with it rather than reinventing the format each time.

## 4. Branch and commit

- Check `git status` and `git branch --show-current` first.
- If currently on `main`: create a new branch off it, named `feature/<slug>`.
- If already on a feature branch for this work, stay on it.
- Stage and commit the feature code (if not already committed) and the two new docs. If the code was already committed on `main` directly (e.g. an earlier session pushed straight to `main` before this workflow existed), note that in your report instead of trying to rewrite history — just commit the two new docs on a branch and open the PR for those, or ask how to proceed if that doesn't make sense for what's being shipped.

## 5. Stop before pushing

**Show a summary — branch name, commit(s), the two doc files — and wait for explicit confirmation before pushing or opening the PR.** This project's standing preference is to confirm before every push and PR, not to run this step unattended.

## 6. Push and open the PR

Once confirmed:

- `git push -u origin <branch>`
- `gh pr create --base main --title "<concise title>" --body "<summary>"` — body should briefly restate what the feature does and link/reference the two docs (e.g. `See docs/specs/<slug>.md and docs/handoffs/<slug>.md`), plus a test-plan checklist. End the body with the PR attribution line from this session's system reminder, same as any other PR.
- Report the PR URL back.
