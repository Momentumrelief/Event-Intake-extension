# Session: Load Chrome Extension (TICKET-001)

Date: 2026-04-21
Agent: Claude

## Objective

Take TICKET-001 (load Chrome extension in browser) to a state where the user
can load `apps/extension/dist` unpacked into Chrome and drive the popup flow
end-to-end against the local API.

## Changes Made

### Extension build — `dist/` output paths now match `manifest.json`

- `apps/extension/vite.config.ts`: set `root: src` and explicit `publicDir` /
  `outDir` so the popup HTML lands at `dist/popup/index.html` (Vite was
  previously emitting it at `dist/src/popup/index.html`, which the manifest
  reference `popup/index.html` could not find).
- `apps/extension/tsconfig.sw.json`: changed `outDir` from `./dist` to
  `./dist/background` so the service worker lands at
  `dist/background/service-worker.js` (manifest reference) instead of
  `dist/service-worker.js`.

### Seed — field keys match the project's established convention

- `apps/api/src/seed.ts`: renamed field keys from camelCase to snake_case
  (`first_name`, `last_name`, `date_of_birth`, `primary_concern`,
  `race_distance`, `current_treatment`) to match:
  - `packages/shared/src/schemas/form-template.ts`: `IntakeField.key` is
    validated against `/^[a-z_][a-z0-9_]*$/` (snake_case only) and the built-in
    `FORM_PRESETS` all use snake_case.
  - `apps/extension/src/popup/components/LeadForm.tsx`: looks up
    `first_name` / `last_name` / `date_of_birth` by these keys to build the
    top-level Lead submission payload.
  - `docs/architecture.md` explicitly calls for snake_case field keys.
- `apps/api/src/seed.ts`: rewrote `options` from flat string arrays
  (`["5K","10K"]`) to `{value,label}` objects the extension's `FieldRenderer`
  actually reads (`<option value={o.value}>{o.label}</option>`).
- `apps/api/src/seed.ts`: `upsertFormTemplate` now deletes any stale form-field
  rows under a version whose key is NOT in the expected set, along with their
  lead field values — makes the seed self-heal orphan rows from an earlier
  camelCase run.

### API — parse `options` JSON before returning

- `apps/api/src/modules/events/routes.ts` (`GET /form-template-versions/:id`):
  parse each field's `options` string (stored JSON-serialized in SQLite) into
  an `Array<{value,label}>` before responding, so the extension doesn't need
  to know about the storage shape.

## Verification

### Commands run

- `pnpm --filter api db:seed` (twice, back-to-back) — both succeed,
  idempotent. Row counts: 19 form fields, 68 lead field values, 18 lead
  consents, 5 event consent requirements, 12 leads (3 each across
  submitted / needs_review / ready / synced), 3 duplicate candidates.
- `pnpm --filter extension build` — succeeds. Final `dist/` tree:
  - `dist/manifest.json`
  - `dist/background/service-worker.js`
  - `dist/popup/index.html` (script src rewritten to `/popup/popup.js`)
  - `dist/popup/popup.js`
- End-to-end API contract smoke test (`node` script hitting live API):
  1. `POST /auth/login` → 200, returns JWT + clinic.
  2. `GET /clinics/:id/events?status=active` → 3 events.
  3. `GET /form-template-versions/:id` → fields with `snake_case` keys;
     `options` is a `{value,label}[]` array (not a string).
  4. `GET /events/:id/consent-requirements` → 2 requirements with
     `consentTemplate.name` and `required` flags.
  5. `POST /leads` (unique email/phone) → 201, `status=ready`, `dups=0`.
  6. `POST /leads` (email/phone matching seeded lead `jamie.chen@example.com`)
     → 201, `status=needs_review`, `duplicateCandidateCount=1` — this is the
     exact signal the popup's success screen renders as
     "⚠ Possible duplicate detected".
  7. Idempotency: same `idempotencyKey` replayed → 200, returns the same lead id.
  8. Missing required consent → 400, as enforced in `leads/routes.ts`.
- Typecheck (`pnpm --filter extension typecheck`): still fails with two
  pre-existing errors in `apps/extension/src/popup/components/LeadForm.tsx`
  (lines 117 and 146) from `exactOptionalPropertyTypes` strictness. Confirmed
  on main (`git stash; pnpm typecheck`) — not introduced by this session.

### What is unverified

- **The browser-side AC of TICKET-001 is not yet verified**: loading
  `apps/extension/dist` unpacked at `chrome://extensions` and driving the
  popup (event select → form fill → consent → submit → success screen →
  duplicate warning). Claude cannot operate Chrome; this step is left for
  the user.

## How to finish TICKET-001 manually

1. Start the API: `npx tsx --env-file=.env apps/api/src/main.ts`
   (the package.json `dev` script has a pre-existing arg-order bug — see
   Deferred Work).
2. Reseed if needed: `pnpm --filter api db:seed`.
3. Rebuild the extension: `pnpm --filter extension build`.
4. Chrome → `chrome://extensions` → toggle Developer Mode on →
   "Load unpacked" → select `apps/extension/dist`.
5. Click the Event Intake toolbar icon. Sign in with
   `admin@demo.com` / `password123`.
6. Pick an event (e.g. "Vancouver Marathon Expo 2026"), fill required
   first name / last name / email / phone, grant the required Contact
   consent, Submit. Expect the success screen without the duplicate note.
7. Capture another lead using `jamie.chen@example.com` and `+16045550101`
   (the Marathon event's seeded lead). Expect the success screen WITH the
   "⚠ Possible duplicate detected" note.
8. Optionally click "Save Draft" mid-entry, close and reopen the popup,
   confirm the draft persists via `chrome.storage.local` (key `ei_drafts`).

## Canonical Updates

- `tickets/backlog.md`: TICKET-001 annotated with progress and handoff
  steps; kept **open** because Chrome-side ACs still need manual run.
- No changes to `README.md`, `docs/architecture.md`, or
  `docs/implementation-plan.md` — the underlying contracts and conventions
  didn't change; I aligned the seed and one API endpoint with them.

## Deferred Work

- **Browser-side smoke of TICKET-001**: see step list above. Keep the
  ticket open until this is exercised.
- **`apps/api` `dev` script bug** (pre-existing on main): package.json has
  `tsx --env-file=.env watch src/main.ts`. tsx interprets `watch` as a
  module path. Should be `tsx watch --env-file=.env src/main.ts`. Out of
  scope for this ticket; file a separate chore if the user wants it fixed.
- **Pre-existing typecheck failures** in `apps/api` (`leads/routes.ts`,
  `sync/worker.ts`) and `apps/extension`
  (`popup/components/LeadForm.tsx:117, :146`). All pre-existed on main.

## Git State

- Committed: yes (see final assistant message for hash).
- Pushed: yes.
- Commit: filled in below after push.
- Deferred reason: N/A.
