# Event Intake

Chrome extension and supporting web service for capturing event leads, validating and enriching them, and moving approved records into Jane.app or a future EHR integration.

## Current Canonical Files

- `docs/architecture.md` - product architecture, integration strategy, data model, and compliance assumptions.
- `docs/implementation-plan.md` - phased delivery plan, owners, tasks, and acceptance criteria.
- `docs/close-procedure.md` - required close procedure for Claude, Codex, or any other agent.
- `tickets/backlog.md` - deferred issues, future features, and follow-up decisions.
- `sessions/` - session close notes and handoff records.

## Workspace Layout

- `apps/api` - backend API.
- `apps/extension` - Chrome extension.
- `apps/web` - admin web app.
- `packages/shared` - shared TypeScript schemas and utilities.
- `docs` - canonical architecture and planning documents.
- `tickets` - backlog items and ticket templates.
- `sessions` - dated session records.

## Development

Use the commands in `package.json` as the source of truth for local development, linting, testing, and building.

Before ending a work session, follow `docs/close-procedure.md`.
