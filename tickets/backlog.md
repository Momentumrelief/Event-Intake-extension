# Backlog

## Open Items

---

### TICKET-000: Seed demo event workflow

- Status: done
- Type: feature
- Priority: P1
- Ticket: `tickets/seed-demo-event-workflow.md`
- Context: The app has a dashboard/review shell, but seed data only creates a user and clinic, so the UI is mostly empty after login.
- Acceptance criteria:
  - Demo seed creates realistic events, forms, consents, leads, and duplicate candidates
  - Dashboard and review queue show useful data after setup
  - Seed command can be rerun safely without duplicating data
- Resolution: `apps/api/src/seed.ts` seeds 3 events (marathon, health fair, employer), 3 versioned form templates (19 fields), contact/marketing/treatment consent templates with 5 event consent requirements, 12 leads split evenly across submitted/needs_review/ready/synced, 3 duplicate candidates, and 3 EHR patient refs. Child-table upserts use composite unique keys so the seed self-heals legacy id collisions. Verified via two successive `pnpm --filter api db:seed` runs and API smoke test (login + review queue returns 6 leads with duplicates/consents counts).

---

### TICKET-001: Load Chrome extension in browser

- Status: open (backend + build ready; awaits manual Chrome load)
- Type: chore
- Priority: P1
- Context: Extension code is written but has never been loaded into Chrome. Must test popup flow end-to-end: event select → form fill → submit → success/duplicate warning.
- Acceptance criteria:
  - Extension loads in `chrome://extensions` with Developer Mode enabled
  - Popup opens and shows event list
  - Form submits a lead and receives confirmation
  - Duplicate warning displays when `duplicateCandidateCount > 0`
- Progress (2026-04-21 claude session):
  - Fixed extension build so `dist/` matches manifest.json paths: popup now at `dist/popup/index.html`, service worker at `dist/background/service-worker.js`.
  - Fixed seed field keys from camelCase (`firstName`, `lastName`, …) to snake_case (`first_name`, `last_name`, `date_of_birth`, `primary_concern`, `race_distance`, `current_treatment`) to match the `packages/shared` IntakeField regex and the extension's lookup convention.
  - Fixed seed options storage from flat string arrays to `{value,label}` objects the extension consumes.
  - Fixed `GET /form-template-versions/:id` to parse `options` JSON before returning.
  - Verified end-to-end API contract the extension uses: login, list active events, load form version (options arrive parsed), load consent requirements, submit new lead (→ ready), submit duplicate (→ needs_review with `duplicateCandidateCount=1`), idempotent replay, required-consent rejection returns 400.
  - Browser-side portion (load `apps/extension/dist` at `chrome://extensions` with Developer Mode on, click the toolbar icon, exercise the popup) still needs the user to perform manually.
- Progress (2026-04-23 claude session):
  - Removed the `icons` block from `apps/extension/public/manifest.json` — the manifest referenced `icons/icon{16,48,128}.png`, but no icon files exist in the repo, so Chrome was flagging the extension on load. Without the block Chrome falls back to the default toolbar icon and loads cleanly.
  - Rebuilt `apps/extension/dist` from fresh source; confirmed `dist/manifest.json`, `dist/popup/{index.html,popup.js}`, and `dist/background/service-worker.js` are all present.
  - Re-ran the full API contract with the live local API (demo seed): login, list active events (3), fetch form version fields (`first_name/last_name/email/phone/race_distance/primary_concern`), fetch consent requirements (contact required + marketing optional, nested `consentTemplateVersion.consentTemplate.consentType` present), POST lead (→ `ready`, `duplicateCandidateCount=0`), POST duplicate-email lead (→ `needs_review`, `duplicateCandidateCount=1`).
  - CORS on the API already allows `chrome-extension://*` (see `apps/api/.env` + `apps/api/src/app.ts:40`), so the extension can reach `http://localhost:3000` from its own origin.
  - Remaining human-only step: in Chrome open `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select `C:\Users\paint\eventintake\apps\extension\dist`. Then click the Event Intake toolbar icon, sign in with `admin@demo.com` / `password123`, select an event, submit one lead, submit a second lead reusing the same email, and confirm the duplicate warning appears on the success screen.

---

### TICKET-002: Events management and inline template builder

- Status: done
- Type: feature
- Priority: P1
- Ticket: `tickets/events-management-template-builder.md`
- Context: `/events` route shows a placeholder. Clinic operators need to create and manage events from the web admin, choose existing intake templates, or build a new template directly from the event setup flow.
- Acceptance criteria:
  - List existing events for the clinic
  - Create new event (name, event type, dates, location, campaign tags, status)
  - Choose an existing form template during event creation
  - Create/build a new form template during event creation
  - Preview the event intake questionnaire before publishing
  - Edit/deactivate/archive event
  - Form template version and consent requirements visible on event detail
- Resolution: Web admin now has `/events` (list), `/events/new` + `/events/:id/edit` (create/edit with segmented existing-vs-new template picker, preset chips, inline field builder, required/optional consent picker, live + modal questionnaire preview), and `/events/:id` (detail with assigned template version, consent requirements, and Edit/Activate/Close/Draft/Archive actions). Inline-created templates are auto-published so they can be assigned immediately; existing templates stay immutable once leads reference them. API tweaks: `GET /clinics/:id/form-templates` returns `latestVersion.fieldCount/leadCount`, `POST /clinics/:id/form-templates` takes an optional `publish` flag (defaults true) and now stores options as `JSON.stringify(...)` matching the seed/read path. Verified via `pnpm --filter web typecheck/build` + curl-driven API smoke (login, list/POST templates, POST event, PATCH through active/closed/archived, PUT consent requirements). Session: `sessions/2026-04-23-1700-claude-ticket-002-events-management.md`. Browser click-through is the only step deferred to a human.

---

### TICKET-003: Lead detail page

- Status: open
- Type: feature
- Priority: P1
- Context: Review queue shows leads but no detail view. Operators need to see full field values, consent status, sync history, and duplicate candidates side-by-side.
- Acceptance criteria:
  - All submitted field values displayed
  - Consent grants shown (field, granted, timestamp)
  - Duplicate candidates listed with match score and reason
  - Resolve/dismiss duplicate action available
  - EHR sync history (status, timestamp, error if any)

---

### TICKET-004: Consent template management UI

- Status: open
- Type: feature
- Priority: P2
- Context: Consent templates exist in the data model and are enforced at submit time, but there is no UI to create or version them.
- Acceptance criteria:
  - List consent templates for the clinic
  - Create new template version
  - Mark a field as required consent
  - View which events use each template

---

### TICKET-005: Initialize git repository

- Status: done
- Type: chore
- Priority: P1
- Context: The project directory needed to be initialized and pushed to GitHub.
- Acceptance criteria:
  - `git init` run in `C:\Users\paint\eventintake`
  - `.gitignore` already present (node_modules, dist, .env, *.db)
  - Initial commit staged and created
  - Remote added and pushed (GitHub or other)
- Resolution: Repository is connected to `https://github.com/Momentumrelief/Event-Intake-extension.git`; `main` tracks `origin/main`.

---

### TICKET-006: Jane OAuth adapter (Phase 5/6)

- Status: open
- Type: feature
- Priority: P3
- Context: EHR sync currently has no real adapter. Jane App OAuth flow needs to be built behind a feature flag.
- Acceptance criteria:
  - OAuth 2.0 authorization code flow with Jane App
  - Token stored per clinic
  - Patient search and create endpoints wired to Jane API
  - Feature-flagged so sync still works without it (manual export fallback)

---

### TICKET-007: Manual export fallback UI

- Status: open
- Type: feature
- Priority: P2
- Context: Architecture calls for CSV/PDF export as fallback when EHR sync is unavailable or rejected. Not yet built.
- Acceptance criteria:
  - Export approved leads as CSV from review queue
  - Fields map to common EHR import format
  - Export logged as `exported` status in sync history

---

### TICKET-008: Template library management

- Status: open
- Type: feature
- Priority: P1
- Ticket: `tickets/template-library-management.md`
- Context: Clinic operators need a dedicated template library where they can create new intake templates, choose existing templates, duplicate templates, and modify templates through versioned updates.
- Acceptance criteria:
  - List reusable templates for the clinic
  - Create a new template from scratch
  - Duplicate an existing template
  - Edit fields, labels, types, required flags, options, and display order
  - Preview the template as potential clients will see it
  - Editing a used template creates a new immutable version
  - Show which events use each template version

---

### TICKET-009: Intake questionnaire branding settings

- Status: open
- Type: feature
- Priority: P2
- Ticket: `tickets/intake-branding-settings.md`
- Context: Clinic operators need control over client-facing intake questionnaire branding, including logo, colors, title, and intro copy.
- Acceptance criteria:
  - Configure clinic-level intake branding with optional event override
  - Add or select a logo for the questionnaire
  - Configure primary, accent, background, and button colors
  - Configure questionnaire title and intro text
- Preview branding with a real template and consent blocks
- Apply branding consistently in the client-facing intake UI
- Keep branding scoped by clinic

---

### TICKET-010: Fix local API startup and Windows dev ergonomics

- Status: done
- Type: bug
- Priority: P1
- Context: Local startup instructions on `main` were brittle on Windows. `pnpm --filter api dev` was broken because the API script used `tsx --env-file=.env watch src/main.ts`, which made `tsx` treat `watch` as a module path. PowerShell with restrictive execution policy also blocks `pnpm.ps1` on some machines.
- Acceptance criteria:
  - `pnpm --filter api dev` starts the API successfully on Windows and non-Windows shells
  - README startup instructions match the working commands
  - Login flow can be exercised locally with the seeded demo user using the documented startup path
  - Any required PowerShell or `.CMD` guidance is documented only if still necessary after the script fix
- Resolution: Reordered `apps/api/package.json` dev script to `tsx watch --env-file=.env src/main.ts` so `tsx` recognises `watch` as its subcommand. `pnpm --filter api dev` now boots the API on `http://localhost:3000` (verified via Git Bash on Windows 11). README Quick Start restored to `pnpm --filter api dev` / `pnpm --filter web dev` with a short PowerShell execution-policy caveat. Login smoke test: `POST /auth/login` with `admin@demo.com` / `password123` returned a JWT and `GET /auth/me` with that token returned the expected `Westside Physiotherapy` owner profile. Session: `sessions/2026-04-23-1830-claude-ticket-010-local-api-startup.md`.
