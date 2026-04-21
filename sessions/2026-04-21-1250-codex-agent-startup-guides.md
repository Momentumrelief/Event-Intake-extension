# Session: Agent Startup Guides

Date: 2026-04-21
Agent: Codex

## Objective

Create startup guidance files for Codex and Claude so each new session begins with the same project context, role expectations, and handoff protocol.

## Changes Made

- `CODEX.md`: added a Codex-specific startup guide describing Codex as the project steward for architecture, planning, backlog hygiene, agent protocols, and scoped review.
- `CLAUDE.md`: expanded the Claude guide to describe Claude as the primary implementation agent, with startup steps and implementation rules.
- `AGENTS.md`: added a shared required startup directive that points agents to role-specific files, canonical project docs, latest session context, and `git status`.
- `sessions/2026-04-21-1250-codex-agent-startup-guides.md`: added this handoff note.
- Chat handoff: provided reusable startup prompts for Codex project-steward sessions, Claude implementation sessions, and the immediate next Claude task for fixing `TICKET-000`.

## Verification

- `Get-Content CODEX.md`: reviewed new Codex startup guide.
- `Get-Content CLAUDE.md`: reviewed expanded Claude startup guide.
- `Get-Content AGENTS.md`: reviewed shared startup directive.
- `git diff -- CODEX.md CLAUDE.md AGENTS.md`: reviewed protocol changes.
- `git status --short --branch`: confirmed only unrelated `apps/api/src/seed.ts` WIP remains after protocol commits.
- Full code tests were not run because this was documentation/protocol-only work.

## Canonical Updates

- `AGENTS.md`: updated because shared startup protocol changed.
- `CLAUDE.md`: updated because Claude startup expectations changed.
- `CODEX.md`: created because Codex startup expectations did not previously exist.
- Other canonical files were not changed because setup, architecture, implementation plan, and backlog scope were unchanged.

## Deferred Work

- Existing unrelated WIP remains in `apps/api/src/seed.ts`.
- Existing known blockers from the prior familiarization session remain: seed idempotency and shared package `Buffer` typing.

## Git State

- Committed: yes.
- Pushed: yes.
- Commit: see Git log for this session note.
- Deferred reason: N/A.
