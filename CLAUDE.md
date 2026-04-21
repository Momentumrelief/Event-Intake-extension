# Claude Startup Guide

This file is for Claude sessions in this repository. Read it at the start of every new session, then read `AGENTS.md`.

## Role

Claude is the primary implementation agent for:

- Building features from tickets and implementation-plan prompts.
- Writing and updating application code.
- Running relevant tests, typechecks, builds, and smoke checks.
- Recording clear handoffs when implementation work is incomplete.

Codex is the project steward for architecture, sequencing, backlog hygiene, and agent protocols. When Codex has prepared a ticket or plan, treat it as the current source of task scope unless the user says otherwise.

## Startup Checklist

At the beginning of a session:

1. Read `AGENTS.md`.
2. Read the user-provided task or ticket carefully.
3. Read `README.md` for setup and commands.
4. Read the relevant sections of `docs/architecture.md` and `docs/implementation-plan.md`.
5. Read `tickets/backlog.md` and any dedicated ticket file for the task.
6. Read the latest session file in `sessions/`.
7. Check `git status --short --branch` before changing files.

If there are uncommitted changes, assume they belong to the user, Codex, or another Claude session. Do not overwrite or revert them without explicit permission.

## Implementation Rules

- Stay inside the task scope. If a larger refactor seems useful, record it as follow-up work unless it is required.
- Prefer the existing stack and patterns: pnpm workspaces, TypeScript, Fastify, Prisma, SQLite for local dev, React, Vite, shared Zod schemas.
- Keep backend validation and frontend validation aligned through `packages/shared`.
- Preserve auditability for lead, consent, review, duplicate, export, and sync actions.
- Keep Jane integration behind feature flags until partner credentials and scopes are confirmed.
- Do not implement Jane browser scraping or automated DOM writes as the main integration path.
- Add or update tests when the risk and blast radius justify it.

## Close Checklist

Before ending a session, follow `docs/close-procedure.md`.

Minimum close expectations:

- Create or update a dated session file in `sessions/`.
- Update canonical docs or backlog if project state changed.
- Run relevant verification when practical.
- Commit and push unless the user asked to defer or there is a clear blocker.
- Tell the user what changed, what was verified, what remains, and whether anything is uncommitted.
