# Close Procedure

This procedure is required for Claude, Codex, and any other agent before ending a work session.

## Goal

Leave the repository in a state where the next person or agent can immediately understand what happened, what is true now, and what remains.

## 1. Create Or Update A Session File

Create a dated Markdown file under `sessions/` using this naming pattern:

```text
sessions/YYYY-MM-DD-HHMM-agent-summary.md
```

Use local time. Keep the summary short and factual.

Required sections:

```markdown
# Session: Short Title

Date: YYYY-MM-DD
Agent: Claude | Codex | Other

## Objective

What the session tried to accomplish.

## Changes Made

- File or area changed: concise explanation.

## Verification

- Command run: result.
- Not run: reason.

## Canonical Updates

- File updated: reason.
- Not needed: reason.

## Deferred Work

- Ticket or backlog item created/updated.

## Git State

- Committed: yes/no.
- Pushed: yes/no.
- Commit: hash or N/A.
- Deferred reason: N/A or explanation.
```

## 2. Update Canonical Files

Update the canonical files whenever the session changes their subject matter:

- `README.md` for setup, repository layout, or how to use the project.
- `docs/architecture.md` for architecture, integration strategy, security, data model, or compliance assumptions.
- `docs/implementation-plan.md` for phase scope, ownership, acceptance criteria, or delivery order.
- `docs/close-procedure.md` for handoff process changes.
- `tickets/backlog.md` for unresolved bugs, future features, open decisions, or blocked work.

Do not bury important project truth only in chat. Put durable information into the relevant canonical file.

## 3. Capture Deferred Work

If anything remains unfinished, add it to `tickets/backlog.md` or create a dedicated ticket under `tickets/`.

Each ticket should include:

- Status: `open`, `blocked`, `in_progress`, or `done`.
- Type: `bug`, `feature`, `chore`, `decision`, or `research`.
- Priority: `P0`, `P1`, `P2`, or `P3`.
- Context.
- Acceptance criteria.
- Links to related docs, files, or session notes.

## 4. Verify

Run the smallest useful verification set for the work completed.

Examples:

- Documentation-only change: inspect rendered Markdown or at least read the changed files.
- TypeScript change: run lint, tests, or typecheck according to `package.json`.
- Database/schema change: run migration validation or tests where available.
- UI change: run the app and check the affected screen.

If verification cannot run, record why in the session file.

## 5. Commit, Push, Or Defer

If this directory is a Git repository:

1. Check `git status --short`.
2. Stage only the relevant files.
3. Commit with a concise message.
4. Push if a remote is configured and the user has not asked to defer.

If this directory is not a Git repository, or commit/push cannot be completed:

- Record the reason in the session file.
- Leave clear instructions for the next step.
- Tell the user the commit/push state in the final response.

Never hide uncommitted work.

## 6. Final User Response

The final response should include:

- What changed.
- What verification ran.
- Whether anything was deferred.
- Whether changes were committed and pushed, or why they were not.
