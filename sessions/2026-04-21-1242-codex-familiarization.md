# Session: Project Familiarization

Date: 2026-04-21
Agent: Codex

## Objective

Inspect the Event Intake repository and summarize current project state without intentionally changing implementation code.

## Current State

- Monorepo is present with `apps/api`, `apps/web`, `apps/extension`, and `packages/shared`.
- API is Fastify + Prisma + SQLite with route modules for auth, events/forms, leads/review/duplicates, consent templates, EHR mappings, sync jobs, and export/copy packet.
- Web admin is currently thin: login works, dashboard shell exists, review queue table exists, and events is still a placeholder.
- Chrome extension source exists with popup capture flow, event selector, field renderer, consent block, storage helpers, and background retry worker, but prior handoff says it has not been loaded/tested in Chrome.
- Canonical docs describe a broader phased plan through event setup, consent management, duplicate review, sync lifecycle, exports, and Jane integration.
- Backlog shows `TICKET-000: Seed demo event workflow` as the active P1 item.
- Git branch is `main` tracking `origin/main`.

## Working Tree

- Pre-existing modified file: `apps/api/src/seed.ts`.
- The seed change appears to expand demo data substantially: stable IDs, three events, form templates, consent templates, event consent requirements, 12 leads across statuses, duplicate candidates, and EHR patient refs.
- This session intentionally did not edit that WIP implementation file.

## Verification

Commands run:

- `git status --short --branch`: branch is clean relative to upstream except `apps/api/src/seed.ts` is modified.
- `git diff -- apps/api/src/seed.ts`: inspected the current seed WIP.
- `pnpm.cmd -r typecheck`: sandboxed run failed with `spawn EPERM`.
- `pnpm.cmd -r typecheck` outside sandbox: reached TypeScript and failed in `packages/shared/src/ehr-adapter/index.ts` because `Buffer` is referenced without Node type definitions in `packages/shared`.
- `pnpm.cmd --filter api db:seed`: sandboxed run failed with `spawn EPERM`.
- `pnpm.cmd --filter api db:seed` outside sandbox: reached Prisma and failed with `P2002` unique constraint violation on `form_fields(form_template_version_id, key)`.

## Known Issues

- Workspace typecheck is not currently clean due to missing Node `Buffer` typing in the shared package.
- The current seed WIP is not rerunnable against the existing local SQLite DB. It upserts `formField` rows by fixed `id`, but existing rows already occupy the unique `(form_template_version_id, key)` pairs with different IDs.
- Review queue UI has a `Review` button routing to `/leads/:id`, but no lead detail route/page is implemented in `apps/web/src/App.tsx`.

## Deferred Work

- Fix `TICKET-000` seed idempotency, likely by upserting form fields and similar child rows by their natural composite unique keys where available, or by cleaning/migrating old demo rows deliberately.
- Fix shared package Node typing for `Buffer` or avoid `Buffer` in shared browser-facing types.
- Continue backlog items in `tickets/backlog.md`, especially Chrome extension manual load test, events management UI, and lead detail page.

## Git State

- Committed: yes.
- Pushed: yes.
- Commit: see latest Git log for this session note.
- Deferred reason: Existing implementation WIP in `apps/api/src/seed.ts` remains uncommitted because this was a familiarization pass, and verification found blockers that should be fixed before committing the seed workflow.
