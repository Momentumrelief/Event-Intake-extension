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

- Status: open
- Type: chore
- Priority: P1
- Context: Extension code is written but has never been loaded into Chrome. Must test popup flow end-to-end: event select → form fill → submit → success/duplicate warning.
- Acceptance criteria:
  - Extension loads in `chrome://extensions` with Developer Mode enabled
  - Popup opens and shows event list
  - Form submits a lead and receives confirmation
  - Duplicate warning displays when `duplicateCandidateCount > 0`

---

### TICKET-002: Events management UI (Phase 3)

- Status: open
- Type: feature
- Priority: P1
- Context: `/events` route shows a placeholder. Clinic operators need to create and manage events from the web admin.
- Acceptance criteria:
  - List existing events for the clinic
  - Create new event (name, date, location, campaign tags, form template)
  - Edit/deactivate event
  - Form template version visible on event detail

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
