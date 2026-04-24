# Session: TICKET-003 — Lead detail page

Date: 2026-04-23
Agent: Claude

## Objective

Build a full lead detail view so reviewers can open a lead from the review queue and see identity/contact, submitted field values, captured consents, duplicate candidates, and EHR sync history side-by-side. Foundation for later duplicate-resolution and sync workflows, so the primitives had to be correct even where the UI stays minimal.

## Changes Made

- `apps/web/src/pages/LeadDetailPage.tsx` (new): full detail page. Sections (in order): breadcrumb back to review queue, header with name/status badge/event link/captured timestamp, Approve + Reject action bar (Approve disabled when pending duplicate candidates exist or when the lead is not in an approvable status per `apps/api/src/modules/leads/routes.ts:267`; Reject prompts for a reason), Identity & contact, Submitted fields, Consents, Duplicate candidates, EHR sync history. Smart rendering for each field type using the parsed `options` JSON from `formField.options`; multi-select arrays are parsed from their stored JSON; checkbox/consent_checkbox show Yes/No; long_text preserves whitespace. Core identity fields (`first_name`, `last_name`, `email`, `phone`, `date_of_birth`) are excluded from the "Submitted fields" card since they already appear in the Identity & contact card.
- `apps/web/src/pages/LeadDetailPage.tsx`: wired resolve/dismiss actions. Dismiss → `POST /leads/:id/duplicates/:candidateId/resolve { status: "dismissed" }`. Mark as new record → same endpoint with `status: "new_record"`. Both go through a `window.confirm` and reload the lead. Already-resolved candidates render a footnote with the resolution timestamp and note instead of action buttons. Merge-into-target is explicitly out of scope for this ticket — noted via a short footnote so the UI does not misrepresent functionality.
- `apps/web/src/pages/LeadDetailPage.tsx`: EHR sync section shows (a) a green banner with `ehrPatientRef.ehrProvider` + `ehrPatientId` when the lead is already synced, and (b) a table of sync jobs when any are on record. Empty state messages distinguish the two reasons for no jobs ("ehrPatientRef was created directly" vs "no sync attempts yet").
- `apps/web/src/lib/api.ts`: added typed interfaces `LeadStatus`, `LeadFieldValueDetail`, `LeadConsentDetail`, `DuplicateCandidateDetail`, `SyncJobDetail`, `EhrPatientRefDetail`, `LeadNoteDetail`, `LeadDetail`. Changed `api.leads.get` from `unknown` to `LeadDetail`, `api.leads.duplicates` to `DuplicateCandidateDetail[]`, `api.leads.syncJobs` to `SyncJobDetail[]`, and narrowed `api.leads.resolveCandidate`'s second arg to `{ status: "merged" | "dismissed" | "new_record"; resolutionNote?: string }`.
- `apps/web/src/App.tsx`: imported `LeadDetailPage` and added `<Route path="/leads/:id" element={<LeadDetailPage />} />` in the Layout-wrapped routes block. The review queue's existing Review button already navigated to `/leads/${lead.id}` (see `ReviewQueuePage.tsx:183`), so no review-queue changes were needed.
- `tickets/backlog.md`: flipped TICKET-003 status to `done (pending human browser click-through)` and recorded the resolution + verification inline.
- This session file.

## What was intentionally NOT changed

- API server routes: `GET /leads/:id` already returns the full nested shape (`apps/api/src/modules/leads/routes.ts:168-191`), `GET /leads/:id/duplicates`, and `POST /leads/:id/duplicates/:candidateId/resolve` are all present. No backend work was needed.
- Duplicate merge UI (target-lead picker): out of scope for this ticket.
- Full sync detail/retry controls: sync jobs are listed read-only. Retry/cancel endpoints exist (`apps/api/src/modules/sync/routes.ts:118,135`) but belong to a later phase per `docs/implementation-plan.md` phase 5.

## Verification

- `git status --short --branch`: clean at start (`main...origin/main`).
- `pnpm --filter web typecheck`: clean (strict mode + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` all satisfied).
- `pnpm --filter web build`: 62 modules, `dist/assets/index-1Dr-eY3n.js` 299.09 kB (gzip 85.30 kB). No warnings.
- API live on `http://localhost:3000` (background task `bb0l9jwdq`) with seeded data.
- Vite dev on `http://localhost:5173` (background task `b02xjgt47`).
- Proxy+contract smoke test against a real lead with duplicates: `GET /api/leads/66660000-0000-1000-0000-000000000002` via the vite proxy returned `status=needs_review`, 1 duplicate candidate (`candidateType=ehr_patient`, `matchScore=0.87`, `matchReason=["email_exact","phone_normalized"]`), 2 consents (contact/marketing both granted), 6 field values, 0 syncJobs, no ehrPatientRef. This is the exact row the detail page will render.
- Cross-checked against a synced lead (`66660000-0000-1000-0000-000000000004`): returns `ehrPatientRef={provider: "jane", ehrPatientId: "jane_pt_001"}` and `syncJobs: []`, which the page handles as "Synced banner + no retryable sync jobs on record".
- Not run: `pnpm --filter web test` (no tests yet in the web package); `pnpm --filter api typecheck` (pre-existing failures unrelated to this ticket).

## Human-only remaining step

1. With the dev servers already up, open `http://localhost:5173`, sign in with `admin@demo.com` / `password123`.
2. Navigate to **Review Queue**. Click **Review** on any row — for coverage, try:
   - `Alex Rivera` (needs_review, 1 pending duplicate): should block Approve until you click Dismiss on the duplicate row, then Approve should enable.
   - `Jamie Chen` (submitted, 0 duplicates): Approve should be enabled.
   - `Taylor Kim` (synced): should render the green "Synced to jane — patient jane_pt_001" banner.
3. Confirm each section renders: header status badge matches the lead state; identity card shows email/phone/DOB/source; submitted fields list shows field labels + values (not raw keys or IDs); consents table shows type tag + short label + Yes/No grant pill + captured-at; duplicate rows show percentage score + parsed reason chips; EHR card renders correctly for both synced and unsynced leads.
4. If the manual run passes, TICKET-003 can be flipped from `done (pending human browser click-through)` to plain `done` in the backlog.

## Canonical Updates

- `tickets/backlog.md`: TICKET-003 updated to reflect the real completion state (done pending browser verification).
- `README.md`, `docs/architecture.md`, `docs/implementation-plan.md`, `docs/close-procedure.md`: not changed. The architecture and plan already described the lead detail page shape; this session implemented it faithfully.

## Deferred Work

- Merge-into-target duplicate flow (select a surviving lead) — documented in the page as a footnote.
- Sync job retry/cancel from the detail page (Phase 5).
- Copy-packet button, CSV export per lead — out of this ticket's scope.
- Pre-existing `pnpm --filter api typecheck` `exactOptionalPropertyTypes` failures — still tracked by scheduled routine `trig_01W3CN9QgExdDXKJ1iaoNeib` (2026-04-30).

## Git State

- Committed: pending at time of writing this note.
- Pushed: pending.
- Commit: TBD after close.
- Deferred reason: N/A — commit goes out right after this file is saved.
