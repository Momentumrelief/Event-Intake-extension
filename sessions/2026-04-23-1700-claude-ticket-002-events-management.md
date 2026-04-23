# Session: TICKET-002 — Events management and inline template builder

Date: 2026-04-23
Agent: Claude

## Objective

Replace the `/events` placeholder with a full events management flow: list,
create, edit, archive events; pick an existing form template or build a new
one inline during event setup; preview the intake questionnaire before
publishing; show assigned template version and consent requirements on the
event detail page.

## Changes

### API

- `apps/api/src/modules/events/routes.ts`
  - `GET /clinics/:clinicId/form-templates` now returns a compact list shape:
    `{ id, name, createdAt, latestVersion: { id, versionNumber, isPublished,
    publishedAt, fieldCount, leadCount } | null }` — so the event setup UI can
    surface field/lead counts and show whether the version is published.
  - `POST /clinics/:clinicId/form-templates` now accepts an optional `publish`
    flag (default `true`) so inline-created templates are immediately
    available as `defaultFormTemplateVersionId` on an event. Also fixed an
    options-serialization bug: options are now `JSON.stringify`-ed on write
    (previously relied on `as never` and would fail the SQLite `String`
    column). Matches what `seed.ts` already does on write and
    `GET /form-template-versions/:id` does on read.

### Shared

- `packages/shared/src/ehr-adapter/index.ts`
  - `EhrAdapter.exportCsv` return type changed from `Promise<Buffer>` to
    `Promise<Uint8Array>`. Node callers returning `Buffer` still satisfy it
    (Buffer extends Uint8Array). This lets `@eventintake/shared` be
    type-checked inside the browser-targeted web app without requiring
    `@types/node`.
- `apps/api/src/modules/ehr/mock-adapter.ts`
  - Return type updated to match.

### Web

- `apps/web/src/lib/api.ts`
  - Added typed interfaces: `EventListItem`, `EventDetail`, `CreateEventPayload`,
    `FieldType`, `PiiCategory`, `FormFieldInput`, `FormTemplateListItem`,
    `FormTemplateVersionDetail`, `ConsentTemplateListItem`,
    `EventConsentRequirementPayload`, plus `EventStatus`, `EventType`.
  - `api.events.*` and `api.consent.*` now typed instead of `unknown`.
  - Added `api.formTemplates.{list, create, getVersion, publish}`.
- `apps/web/src/components/TemplateBuilder.tsx` — inline field editor
  (add/remove/reorder, per-field label, snake_case key with validation,
  type, PII category, placeholder, help text, required toggle, options
  textarea for selects).
- `apps/web/src/components/IntakePreview.tsx` — read-only render of
  fields + consent blocks shaped like the extension popup.
- `apps/web/src/pages/EventsListPage.tsx` — table of events for the clinic
  with status filter, name/type/dates/location/status/leads/tags columns,
  "+ New event" button.
- `apps/web/src/pages/EventEditPage.tsx` — create/edit form. Sections:
  event details; template assignment with segmented control for
  "Use existing" (dropdown of clinic templates with read-only field list)
  vs "Build new" (preset chips + inline TemplateBuilder); consent
  requirements multi-select with required/optional radio. Live preview
  sidebar and a modal preview triggered from the toolbar. Inline creation
  path: POST form-template (publish=true) → POST event with
  `defaultFormTemplateVersionId` → PUT consent requirements.
- `apps/web/src/pages/EventDetailPage.tsx` — shows event header with
  status badge, metadata, assigned template version with field list,
  consent requirements with required/optional pills, extension preview,
  and actions: Edit, Activate, Close, Move back to draft, Archive
  (confirm prompt).
- `apps/web/src/App.tsx` — removed `EventsPlaceholder`; mounted
  `/events`, `/events/new`, `/events/:id`, `/events/:id/edit`.

## Verification

Commands run from repo root:

- `pnpm --filter shared typecheck` → clean.
- `pnpm --filter web typecheck` → clean (0 errors).
- `pnpm --filter web build` → clean (61 modules, 283 kB).
- `pnpm --filter api typecheck` → 8 errors, **all pre-existing** (same set
  as on `main` before this session: audit/service.ts:16, consent/routes.ts:76,
  events/routes.ts:54, events/routes.ts (createMany helpText), leads/routes.ts
  97/141/394, sync/worker.ts:71). My changes shift the events createMany
  error from line 156 → 186 because the POST handler gained ~30 lines;
  no new errors.
- `pnpm --filter api test` / `pnpm --filter shared test` → no test files
  exist in either package (reported as failure by vitest, not a regression).

API smoke (against the seeded demo DB, via curl):

- `POST /auth/login admin@demo.com` → 200, token.
- `GET /clinics/:id/form-templates` → returns new shape with
  `latestVersion.fieldCount` and `leadCount`.
- `POST /clinics/:id/form-templates` with two fields
  (short_text + single_select with options) → 201; returned version has
  `isPublished: true`, options round-trip parsed correctly on
  `GET /form-template-versions/:id`.
- `POST /clinics/:id/events` with `defaultFormTemplateVersionId` → 201,
  event persisted with the assigned version.
- `PATCH /events/:id` with `{status:"active"}` → ok; then `"closed"` → ok;
  then `"archived"` → ok.
- `PUT /events/:id/consent-requirements` with two requirements (required
  contact + optional marketing) → `{count:2}`; subsequent GET returns both
  with expected `required` flags and consentTemplate metadata.
- `GET /clinics/:id/events?status=archived` → returns only the archived
  smoke event.

Web smoke:

- `pnpm --filter web dev` starts on 5173. `curl /events` → 200 (SPA
  index). Actually interacting with the UI in a browser (login, render
  the events list, create an event with inline template, preview,
  activate/close/archive) was not performed from this session — that
  requires a person driving Chrome against the running dev servers.

## Leftover smoke data

The API smoke test created one event `Smoke Event 2026`
(id `4bf0fb10-…`, archived) using an inline-created template
`Smoke Template` (id `182f02ca-…`). Both live in the demo SQLite DB.
They are harmless (archived status; 0 leads) but can be removed by
re-running `pnpm --filter api db:seed` if a clean slate is preferred
— the seed is idempotent for its own rows but does not prune extras.

## Canonical updates

- `tickets/backlog.md`: mark TICKET-002 as done with a resolution note
  pointing at this session.

## Git state

- Modified:
  - `apps/api/src/modules/events/routes.ts`
  - `apps/api/src/modules/ehr/mock-adapter.ts`
  - `apps/web/src/App.tsx`
  - `apps/web/src/lib/api.ts`
  - `packages/shared/src/ehr-adapter/index.ts`
- New:
  - `apps/web/src/components/IntakePreview.tsx`
  - `apps/web/src/components/TemplateBuilder.tsx`
  - `apps/web/src/pages/EventsListPage.tsx`
  - `apps/web/src/pages/EventEditPage.tsx`
  - `apps/web/src/pages/EventDetailPage.tsx`
  - `sessions/2026-04-23-1700-claude-ticket-002-events-management.md`
- Committed: see final assistant message for hash.
- Pushed: see final assistant message.

## Deferred / unverified

- Browser walkthrough of the events UI (create with inline template,
  preview, activate/close/archive, edit, re-assign template) was not
  performed by this session and should be done once by a human before
  calling the ticket fully acceptance-tested.
- Pre-existing API typecheck failures are still on `main`; fixing them
  is out of scope for this ticket but worth a separate cleanup pass —
  they'll eventually bite `tsc --noEmit` in CI.
- TICKET-008 (template library management) remains the natural follow-up
  for things this ticket intentionally left out: editing existing
  templates, duplicating templates, cross-event version visibility.
