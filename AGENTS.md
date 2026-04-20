# Agent Instructions

This file applies to Codex, Claude, and any other coding agent working in this repository.

## Required Close Directive

Before ending any work session:

1. Create or update a session file in `sessions/`.
2. Update canonical files if the session changed architecture, implementation plan, setup, or backlog state.
3. Move unresolved work into `tickets/backlog.md` or a dedicated ticket file.
4. Run the relevant verification commands when practical.
5. Commit and push if this directory is a Git repository and the user has not asked to defer.
6. If commit or push is not possible, record the reason in the session file and tell the user exactly what remains.

Full procedure: `docs/close-procedure.md`.

## Canonical Files

Keep these files current:

- `README.md`
- `docs/architecture.md`
- `docs/implementation-plan.md`
- `docs/close-procedure.md`
- `tickets/backlog.md`
- Latest file in `sessions/`

## Handoff Standard

Every handoff should make it clear:

- What changed.
- What commands were run.
- What is known to work.
- What is unverified.
- What is blocked or deferred.
- Whether changes were committed, pushed, or left uncommitted.
