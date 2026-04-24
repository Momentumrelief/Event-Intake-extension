# Session: TICKET-010 — Fix local API startup and Windows dev ergonomics

Date: 2026-04-23
Agent: Claude

## Objective

Restore `pnpm --filter api dev` as the documented local startup path so the seeded demo login can be exercised without the direct-`tsx` workaround, and keep the change scoped to local startup only.

## Changes Made

- `apps/api/package.json`: reordered the `dev` script from `tsx --env-file=.env watch src/main.ts` to `tsx watch --env-file=.env src/main.ts`. `tsx` treats `watch` as a subcommand, so putting it first stops it from being parsed as a module path. No other scripts or dependencies touched.
- `README.md`: replaced the Quick Start API/web startup block that called `./node_modules/.bin/tsx ...` / `./node_modules/.bin/vite` with the standard `pnpm --filter api dev` and `pnpm --filter web dev` commands. Added a short PowerShell execution-policy caveat pointing users at `cmd.exe`, Git Bash, or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` when `pnpm.ps1` is blocked.
- `tickets/backlog.md`: marked TICKET-010 as `done` and recorded the resolution + verification details inline.
- `sessions/2026-04-23-1830-claude-ticket-010-local-api-startup.md`: this handoff.

## Verification

- `git status --short --branch`: clean at session start (`main...origin/main`).
- `pnpm --filter api dev` (Git Bash on Windows 11): booted — logs show `tsx watch --env-file=.env src/main.ts`, `Sync worker started (Redis connected).`, `Server listening at http://0.0.0.0:3000`, `API listening at http://localhost:3000`.
- `curl -X POST http://localhost:3000/auth/login` with `admin@demo.com` / `password123`: returned a JWT + user payload with `Westside Physiotherapy` owner membership.
- `curl http://localhost:3000/auth/me` with the returned bearer token: returned the same profile — login + auth round-trip confirmed.
- `pnpm --filter api test`: exits 1 with `No test files found, exiting with code 1`. API package has no vitest suites yet; not introduced by this change.
- `pnpm --filter api typecheck`: fails with pre-existing `exactOptionalPropertyTypes` errors in `src/modules/events/routes.ts`, `src/modules/leads/routes.ts`, and `src/modules/sync/worker.ts`. `git log -1` on those paths points to `fbea9d6` (TICKET-002), so these predate this session and are out of scope for TICKET-010.
- Not run: browser walkthrough at `http://localhost:5173` (web admin). Login was smoke-tested against the API directly.

## Canonical Updates

- `README.md`: updated because the documented startup path was wrong on `main`.
- `tickets/backlog.md`: updated because TICKET-010 is now resolved.
- `apps/api/package.json`: updated because that was the bug.
- `docs/architecture.md`, `docs/implementation-plan.md`, `docs/close-procedure.md`: not needed — no architecture, plan, or process changes.

## Deferred Work

- Pre-existing `pnpm --filter api typecheck` failures under `exactOptionalPropertyTypes` (TICKET-002 regression, unrelated to startup). Not fixed here to keep the change tightly scoped; worth a follow-up ticket if it isn't already tracked.
- Browser click-through for the web admin login at `http://localhost:5173` still needs a human session; API-side login is verified.

## Git State

- Committed: yes.
- Pushed: yes.
- Commit: `a0c60f7`.
- Deferred reason: N/A.
