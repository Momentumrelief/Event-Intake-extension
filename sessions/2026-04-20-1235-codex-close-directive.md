# Session: Close Directive And Backlog Setup

Date: 2026-04-20
Agent: Codex

## Objective

Create a clear close procedure for Claude and Codex, add canonical handoff files, and create a ticket folder for deferred work.

## Changes Made

- `README.md`: added project overview, workspace layout, and canonical file list.
- `AGENTS.md`: added shared close directive and handoff standard.
- `CLAUDE.md`: pointed Claude to the shared agent instructions and close procedure.
- `docs/close-procedure.md`: documented the required session close workflow.
- `tickets/`: added backlog, README, and ticket template.
- `sessions/`: added this session file and folder README.

## Verification

- `rg --files -g 'README.md' -g 'AGENTS.md' -g 'CLAUDE.md' -g 'docs/*.md' -g 'tickets/*.md' -g 'sessions/*.md'`: confirmed new canonical, ticket, and session files are present.
- `Get-Content -Path docs\close-procedure.md`: read back close procedure.
- `Get-Content -Path tickets\backlog.md`: read back backlog.
- `git status --short`: failed because this workspace is not a Git repository.

## Canonical Updates

- `README.md` added as a canonical project entry point.
- `docs/close-procedure.md` added as the canonical close procedure.
- `tickets/backlog.md` added as the canonical backlog.
- `sessions/2026-04-20-1235-codex-close-directive.md` added as the current session record.

## Deferred Work

- `tickets/backlog.md` includes open items for Jane access, compliance assumptions, event presets, and Git setup.

## Git State

- Committed: no.
- Pushed: no.
- Commit: N/A.
- Deferred reason: this workspace is not a Git repository, so commit and push cannot be completed here.
