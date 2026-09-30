---
description: Write feature docs, branch, commit, and open a PR to main for the current feature work
argument-hint: [feature name or description, if not obvious from context]
---

Ship the current feature work in `edulab-api`: $ARGUMENTS

This command is the last step after a feature's code, tests, and security review are done — either invoked directly, or as Phase 8 of `/new-feature`. Do not use it mid-feature; the code should already work and pass `npx tsc --noEmit`, lint, and tests before you start this.

## 1. Identify the feature

Figure out what's being shipped from context: recent conversation, `git status`, `git diff` (staged, unstaged, and against `origin/main` if already committed), and which files under `src/features/` are new or changed. If it's ambiguous (e.g. several unrelated things happened in this session), ask before proceeding rather than guessing — a PR should be one coherent feature, not a grab-bag.

Pick a short kebab-case slug for it (e.g. `resource-comments`, `cloudinary-uploads`) — used for the branch name and as the heading for this feature's section in both living docs.

## 2. Update the two living docs (Claude Doc artifacts — never repo files, never a new doc per feature)

Feature docs are **Claude Doc artifacts**, not `.md` files in this repo. There are exactly two, both referenced in `CLAUDE.md`'s "Docs" section — read that section first for their current links:

- **Feature Specs** — one section per feature.
- **Frontend Integration Handoff** — one section per feature, written for whoever is building the frontend (a person or another Claude session), not for a backend engineer.

Before touching either: load the docs skill (`anthropic-skills:docs` or whatever this session lists), then `read` the doc (its link is in `CLAUDE.md`) to see its current tabs/sections and ids — never recreate it, never guess ids. If this feature is genuinely new (no existing section for it), add a new section following the existing ones' heading pattern; if you're revising a feature that already shipped, update its existing section in place instead of appending a duplicate.

**Feature Specs** section content, only where applicable to this feature (omit a heading rather than filling it with "N/A"):
- **Overview** — one paragraph: what this feature does and why.
- **Data model** — tables/columns/relations touched or added, and their RLS policies (owner/public/system-only per operation). Skip if no schema changed.
- **Access rules** — who can read/create/update/delete each resource, in plain language.
- **Endpoints** — a table: method, path (including the `/api/v1` prefix), auth requirement, request DTO shape, response DTO shape, status codes.
- **Business logic notes** — anything non-obvious: validation rules, edge cases, triggers, rate limits.
- **Security notes** — findings from the `auth-security-reviewer` pass: what was fixed, and any Medium/Low findings left as known tradeoffs (with the reasoning, so they don't get silently "fixed" later by someone who doesn't know it was deliberate).
- **Tests** — what's covered, what's explicitly out of scope.

**Frontend Integration Handoff** section content:
- **Endpoints** — method, path, auth (bearer/public), request body shape, response shape, status codes a client needs to handle. Real field names/types, not internal DB column names.
- **Integration gotchas** — `null`-able fields, validation limits that produce a 400, rate limits, ownership rules affecting visibility, anything async/eventually-consistent.
- **Example requests/responses** — at least one realistic JSON example per endpoint.

Pull details from the real code and migrations — describe what's actually there, not intended behavior. Keep terminology and structure consistent with the other features' sections already in each doc.

## 3. Branch and commit

- Check `git status` and `git branch --show-current` first.
- If currently on `main`: create a new branch off it, named `feature/<slug>`.
- If already on a feature branch for this work, stay on it.
- Stage and commit the feature code (if not already committed) — the two docs are artifacts, not repo files, so there's nothing doc-related to commit. If the code was already committed on `main` directly (e.g. an earlier session pushed straight to `main` before this workflow existed), note that in your report rather than trying to rewrite history, and ask how to proceed.

## 4. Stop before pushing

**Show a summary — branch name, commit(s), links to the two updated doc sections — and wait for explicit confirmation before pushing or opening the PR.** This project's standing preference is to confirm before every push and PR, not to run this step unattended.

## 5. Push and open the PR

Once confirmed:

- `git push -u origin <branch>`
- `gh pr create --base main --title "<concise title>" --body "<summary>"` — body should briefly restate what the feature does and link both living docs (the URLs are in `CLAUDE.md`'s "Docs" section), plus a test-plan checklist. End the body with the PR attribution line from this session's system reminder, same as any other PR.
- Report the PR URL back.
