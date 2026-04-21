# Session: Seed Demo Event Workflow (TICKET-000)

Date: 2026-04-21
Agent: Claude

## Objective

Finish and verify TICKET-000 (seed demo event workflow) against the pre-existing
uncommitted `apps/api/src/seed.ts` diff. Ensure the seed creates realistic demo
data for dashboard/review queue, is idempotent, and survives legacy dev-database
state left behind by earlier partial runs.

## Changes Made

- `apps/api/src/seed.ts`: replaced brittle derived-UUID upserts (which collided
  across templates in an earlier buggy version of the seed) with composite-unique
  upserts for the child tables. Specifically:
  - `FormField` now upserts on `(formTemplateVersionId, key)`.
  - `EventConsentRequirement` now upserts on `(eventId, consentTemplateVersionId)`.
  - `LeadFieldValue` now upserts on `(leadId, formFieldId)`.
  - `LeadConsent` now upserts on `(leadId, consentTemplateVersionId)`.
  - `EhrPatientRef` now upserts on `leadId`.
  - Removed the now-unused stable-id derivation helpers and `valueSlot` counter.
  Top-level entities (org, clinic, user, form templates, consent templates, events,
  leads, duplicate candidates) still use stable explicit IDs for determinism.
- `tickets/backlog.md`: marked TICKET-000 done with a resolution summary.
- `tickets/seed-demo-event-workflow.md`: status → done, resolved 2026-04-21.

## Verification

- `pnpm --filter api db:seed` (first run after fix): succeeded.
- `pnpm --filter api db:seed` (second run): succeeded — idempotent.
- Row-count check after two runs:
  - `event`: 3, `formTemplate`/`formTemplateVersion`: 3/3, `formField`: 19.
  - `consentTemplate`/`consentTemplateVersion`: 3/3, `eventConsentRequirement`: 5.
  - `lead`: 12, split 3/3/3/3 across submitted/needs_review/ready/synced.
  - `leadFieldValue`: 68, `leadConsent`: 18, `duplicateCandidate`: 3, `ehrPatientRef`: 3.
- API smoke test (started `npx tsx --env-file=.env src/main.ts` directly, since
  the existing `dev` script in `apps/api/package.json` has a pre-existing arg-order
  bug that makes tsx treat `watch` as a module path):
  - `POST /auth/login` with `admin@demo.com` / `password123` → returns JWT and clinic.
  - `GET /clinics/:id/events` → returns 3 events, each with `leadCount: 4`.
  - `GET /clinics/:id/review-queue` → returns 6 leads (3 submitted + 3 needs_review),
    each `needs_review` lead has `_count.duplicates: 1`.
- Web dev server not booted — verified API-layer surface only. UI is static React
  wired to these endpoints, so seeded data will render there too.
- Typecheck (`pnpm --filter api typecheck`): still fails with the same pre-existing
  errors in `src/modules/leads/routes.ts` and `src/modules/sync/worker.ts` that
  exist on main. Confirmed by stashing changes and re-running — the failures are
  unrelated to this ticket and were not introduced by these edits.

## Canonical Updates

- `tickets/backlog.md`: TICKET-000 moved to done.
- `tickets/seed-demo-event-workflow.md`: status set to done.
- No changes needed to `README.md`, `docs/architecture.md`, or
  `docs/implementation-plan.md` — seed instructions (`pnpm --filter api db:seed`)
  are unchanged; data model and phase scope are unchanged.

## Deferred Work

- **Pre-existing API typecheck failures** in `routes.ts` and `worker.ts`
  (`exactOptionalPropertyTypes` violations on `email/phone/resolutionNote`, plus a
  `true → never` assignment in `worker.ts:71`). Out of scope for TICKET-000; should
  be tracked separately if not already.
- **`apps/api` `dev` script is broken** (`tsx --env-file=.env watch src/main.ts`
  treats `watch` as a module path — `watch` must come first: `tsx watch --env-file=.env …`).
  Not fixed here because it's outside TICKET-000's scope and may be intentionally
  deferred. Workaround documented above for smoke testing.
- TICKET-001 (load Chrome extension) remains the top open backlog item.

## Git State

- Committed: yes.
- Pushed: yes.
- Commit: `5e752d1` (Seed demo event workflow (TICKET-000)).
- Deferred reason: N/A.
