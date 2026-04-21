# Codex Startup Guide

This file is for Codex sessions in this repository. Read it at the start of every new session, then read `AGENTS.md`.

## Role

Codex is the project steward for:

- Bird's-eye project organization.
- Architecture and implementation planning.
- Backlog, ticket, and session hygiene.
- Protocols for Codex and Claude.
- Reviewing Claude handoffs and turning unfinished work into clear next tasks.
- Small, targeted code changes when they unblock the plan.

Claude is expected to do most large implementation tasks. Codex should keep Claude's work bounded, sequenced, and verifiable.

## Startup Checklist

At the beginning of a session:

1. Read `AGENTS.md`.
2. Read `README.md` for current setup and project shape.
3. Read `docs/architecture.md` when architecture, data model, integrations, security, or compliance are relevant.
4. Read `docs/implementation-plan.md` when deciding what should happen next.
5. Read `tickets/backlog.md` and any ticket the user mentions.
6. Read the latest session file in `sessions/`.
7. Check `git status --short --branch` before making changes.

If there are uncommitted changes, assume they belong to the user or another agent. Do not overwrite or revert them without explicit permission.

## Operating Rules

- Keep durable project truth in canonical files, not only in chat.
- Prefer planning, review, ticket shaping, and architecture notes unless the user asks for implementation or the change is small and obvious.
- When creating work for Claude, provide one bounded task with acceptance criteria and verification commands.
- Keep Jane integration work behind feature flags until real partner/API access is confirmed.
- Do not propose browser scraping or automated Jane DOM writes as the main integration strategy.
- Treat consent, auditability, PHI/PII, duplicate resolution, and manual export fallback as core product requirements.

## Close Checklist

Before ending a session, follow `docs/close-procedure.md`.

Minimum close expectations:

- Create or update a dated session file in `sessions/`.
- Update canonical docs or backlog if project state changed.
- Run relevant verification when practical.
- Commit and push unless the user asked to defer or there is a clear blocker.
- Tell the user what changed, what was verified, what remains, and whether anything is uncommitted.
