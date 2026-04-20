# Implementation Plan

## Phase 0: Product And Access Decisions

Owner: you

Tasks:

- Contact Jane about Developer Platform partner access.
- Confirm allowed Jane scopes and whether patient create/update is available for your use case.
- Confirm whether event leads are only contact leads or include health concerns that trigger PHI handling.
- Choose initial deployment environment based on compliance requirements.
- Define the first clinic workflow: create patient, add note, create appointment request, or export lead.
- Define the first 3 event presets, for example marathon, medical conference, and health fair.
- Decide which fields are always part of the normalized lead identity record, such as name, phone, email, and optional date of birth.
- Decide which event types require treatment consent vs. contact consent only.
- Draft initial consent language for each consent type (contact, marketing, treatment).

Deliverables:

- Jane integration decision: `official_api`, `manual_export_first`, or `hybrid`.
- MVP lead field list.
- MVP configurable field type list.
- First event form presets.
- Initial consent language per type.
- Compliance assumptions.

## Phase 1: Repo And Foundations

Owner: Codex or Claude

Tasks:

- Create monorepo structure.
- Add TypeScript tooling.
- Add shared schemas with Zod.
- Add lint, format, and test commands.
- Add local Docker Compose for Postgres and Redis.
- Add `.env.example`.
- Run initial Prisma migration for all core tables including `consent_templates`, `consent_template_versions`, `event_consent_requirements`, `lead_consents`, `duplicate_candidates`, `ehr_field_mappings`, and `ehr_sync_jobs`.

Suggested stack:

- pnpm workspaces
- TypeScript
- React for extension/web UI
- Fastify or NestJS for API
- Prisma or Drizzle for database
- Vitest for unit tests
- Playwright for browser/extension smoke tests

Acceptance criteria:

- `pnpm install`, `pnpm test`, and `pnpm lint` work.
- API can boot locally.
- Extension can be loaded unpacked in Chrome.
- Database schema matches the full table list in `docs/architecture.md`.

## Phase 2: Lead Capture MVP

Owner: Claude

Tasks:

- Build event-specific extension popup lead form.
- Add event selection/tagging.
- Render fields from a versioned form template instead of a hard-coded form.
- Fetch required consent template versions for the selected event; render consent blocks in the form.
- Add local draft persistence.
- Add submit-to-backend flow including consent records.
- Add backend event and form-template read endpoints.
- Add `GET /events/:id/consent-requirements` so the extension can fetch required consents.
- Add backend `POST /leads` with required-consent validation.
- Add backend `GET /events/:id/leads`.
- Add validation and normalization.
- Add duplicate detection by email/phone; move lead to `needs_review` on match.

Acceptance criteria:

- A staff member can capture a lead in under 30 seconds.
- Every lead is tied to an event.
- The same extension can render different forms for a marathon vs. a medical conference.
- Required consent blocks render; submitting without them is blocked.
- Each consent record stores the `consent_template_version_id` and timestamp.
- Losing network does not lose the draft.
- Duplicate email/phone creates a warning and results in `needs_review` status.

## Phase 3: Admin Web App And Consent Management

Owner: Claude

Tasks:

- Build login.
- Build clinic dashboard.
- Build event creation/editing.
- Build controlled form-template editor.
- Add field types: short text, long text, phone, email, address, date, date of birth, single select, multi select, checkbox, consent checkbox, and number.
- Add event presets for marathon, medical conference, health fair, and generic lead capture.
- Add form preview.
- Build consent template management:
  - List and create consent templates per clinic.
  - Create new versions of existing consent templates.
  - Prevent editing a version that has been accepted by any lead (immutable after first use).
  - Show version history with effective dates.
- Build event consent requirements editor:
  - Add/remove consent requirements per event.
  - Mark each as required or optional.
  - Select which active version applies.
  - Support `contact`, `marketing`, and `treatment` types.
- Build lead table with status filters including `needs_review` and `sync_rejected`.
- Build lead detail page showing consents captured, field values, and sync history.
- Build CSV export.

API endpoints added in this phase:

```
GET  /clinics/:id/consent-templates
POST /clinics/:id/consent-templates
GET  /consent-templates/:id/versions
POST /consent-templates/:id/versions
GET  /events/:id/consent-requirements
PUT  /events/:id/consent-requirements
POST /events/:id/export/csv
GET  /leads/:id/copy-packet
```

Acceptance criteria:

- Admin can create an event, configure the exact fields staff will collect, and add consent requirements.
- Admin can publish a versioned form template for an event.
- Admin can create a new version of a consent template; old accepted versions remain immutable.
- Staff can submit leads tied to that event.
- Treatment consent can be made required; leads without it cannot be approved.
- Admin can export leads with core columns plus event-specific columns plus consent status columns.
- Copy packet shows the exact consent text version the patient accepted.

## Phase 4: Review Queue And Duplicate Resolution

Owner: Claude

Tasks:

- Build review queue page in admin web app:
  - Paginated lead list filtered by `submitted` and `needs_review` by default.
  - Show duplicate candidate count per lead inline.
  - Show consent status badge (all consents granted, missing required consent).
  - Approve single or bulk leads; reject with a reason.
- Build lead detail review panel:
  - Show all field values and their configured EHR mapping targets.
  - Show consent records with version text.
  - Show duplicate candidates with match reason and score.
- Build duplicate resolution UI:
  - Side-by-side comparison of the submitted lead and each candidate (internal lead or EHR patient stub).
  - Actions: merge into existing, dismiss candidate (confirmed new), or new record with note.
  - Block approval until all `pending` candidates are resolved.
- Add backend duplicate resolution endpoints.
- Add EHR duplicate check step in sync worker (calls `adapter.searchPatient` before `createPatient`).

API endpoints added in this phase:

```
GET  /clinics/:id/review-queue
POST /leads/:id/approve
POST /leads/:id/reject
POST /leads/bulk-approve
GET  /leads/:id/duplicates
POST /leads/:id/duplicates/:candidateId/resolve
POST /leads/:id/merge-into/:targetLeadId
```

Acceptance criteria:

- Leads with unresolved duplicate candidates cannot be approved.
- Resolving a duplicate records resolver user ID, timestamp, and resolution note in the audit log.
- Merging two leads absorbs consents and field values from the dismissed record.
- EHR duplicate check runs as the first step of every sync job.
- If EHR returns a match, the lead is moved back to `needs_review` with a new candidate row.
- Admin can dismiss an EHR duplicate candidate and confirm the lead as a new patient.

## Phase 5: Per-Field EHR Mapping And Sync Lifecycle

Owner: Codex

Tasks:

- Build field mapping editor in admin web app:
  - List all form field keys for the clinic's active templates.
  - For each field, set `ehr_field_path`, `transform`, and `fallback_to_note`.
  - Fetch supported EHR field paths from `GET /ehr-connections/:id/supported-fields` (mock for now).
  - Show a sample lead preview of how values will be structured.
- Implement `EhrAdapter` interface in shared package including `exportCsv` and `fieldMappings`.
- Implement `MockEhrAdapter` with `searchPatient` returning configurable test fixtures.
- Implement `CsvEhrAdapter` shaped for manual Jane import using field mappings.
- Add sync job table and BullMQ worker with the full status lifecycle:
  - `queued` → `running` → `succeeded` | `failed` | `rejected`
  - Exponential backoff retry up to 5 attempts.
  - Transition to `rejected` after max attempts; notify admin.
- Add `field_mapping_snapshot` to sync job row at queue time.
- Add idempotency key behavior for EHR create calls.
- Add audit events for every sync state transition.
- Build sync status panel on the lead detail page showing attempt history, error messages, and retry controls.

API endpoints added in this phase:

```
GET  /clinics/:id/ehr-mappings
POST /clinics/:id/ehr-mappings
PUT  /ehr-mappings/:id
DELETE /ehr-mappings/:id
GET  /ehr-connections/:id/supported-fields
POST /leads/:id/sync
POST /leads/bulk-sync
GET  /leads/:id/sync-jobs
POST /leads/:id/sync-jobs/:jobId/cancel
POST /leads/:id/sync-jobs/:jobId/retry
GET  /clinics/:id/sync-summary
POST /events/:id/export/jane-import
```

Acceptance criteria:

- Lead sync can run through a mock adapter using real field mappings.
- Fields with `fallback_to_note = true` are assembled into a note body and logged.
- `field_mapping_snapshot` in the sync job row matches the mappings in effect at queue time.
- Transient failures retry with backoff; permanent failures reach `rejected` after 5 attempts.
- Sync status is visible in admin UI with full attempt history.
- Failed syncs are retryable manually from the admin UI.
- CsvEhrAdapter produces a file shaped by the clinic's field mappings.
- Jane import CSV uses field mapping paths as column headers.

## Phase 6: Jane Integration

Owner: Codex strategy, Claude implementation

Prerequisite:

- Jane partner credentials and approved redirect URI.

Tasks:

- Add `JaneAdapter` implementing `EhrAdapter`.
- Add Jane OAuth connect route.
- Store encrypted Jane refresh tokens server-side.
- Add token refresh flow.
- Add Jane connection health check.
- Implement `searchPatient` using Jane patient search endpoint.
- Implement `createPatient` and `updatePatient` using field mappings; unmapped fields with `fallback_to_note` go into Jane notes.
- Handle `401`, `429`, `Retry-After`, and Jane validation errors; map to `failed` vs. `rejected` transitions correctly.
- Add `GET /ehr-connections/:id/supported-fields` returning the real Jane field path list.
- Test full flow in Jane staging/partner dev environment.

Acceptance criteria:

- Clinic admin can connect Jane via OAuth.
- Backend can make a test Jane API call and report connection health.
- `searchPatient` returns EHR duplicate candidates before any write.
- Lead can sync to Jane in a staging/partner development environment.
- Fields with `fallback_to_note = true` appear in a Jane note attached to the patient record.
- Failed sync gives actionable error text to an admin; transient vs. permanent errors are correctly classified.

## Phase 7: Hardening

Owner: Codex/Claude

Tasks:

- Add role-based access checks (owner, admin, event_staff, reviewer).
- Add audit log viewer.
- Add structured logging with sensitive field redaction; verify `error_payload` in sync jobs contains no PHI.
- Add backup and retention policy.
- Add E2E tests for: extension capture, consent capture, duplicate detection, review queue approve/reject, sync lifecycle, CSV export.
- Add Sentry or equivalent only if configured to avoid sensitive payloads.
- Add deployment documentation.

Acceptance criteria:

- Tests cover core capture, consent, duplicate resolution, and sync flows.
- Logs do not expose lead notes, DOB, tokens, or raw EHR payloads.
- A clinic can revoke Jane access.
- A clinic can delete or archive event lead data according to policy.
- Consent records are retained even when leads are archived (separate deletion policy).

## Recommended Claude Task Prompts

### Scaffold

```text
Create the monorepo structure described in docs/architecture.md. Use pnpm workspaces, TypeScript, React, Fastify, Prisma, Vitest, and Docker Compose for Postgres/Redis. Include all tables listed in the Data Model section: organizations, clinics, users, clinic_memberships, events, form_templates, form_template_versions, form_fields, consent_templates, consent_template_versions, event_consent_requirements, leads, lead_field_values, lead_consents, lead_notes, duplicate_candidates, ehr_connections, ehr_field_mappings, ehr_sync_jobs, ehr_patient_refs, audit_events. Add scripts for lint, test, dev:api, dev:web, and dev:extension.
```

### Shared Schemas

```text
Implement shared Zod schemas for Lead (with full status lifecycle), Event, FormTemplate, FormTemplateVersion, IntakeField (with ehrMapping inline), LeadFieldValue, ConsentTemplate, ConsentTemplateVersion, EventConsentRequirement, LeadConsent, DuplicateCandidate, EhrFieldMapping, and EhrSyncJob based on docs/architecture.md. Export TypeScript types. Add focused unit tests for event validation, form-template validation, required field validation, phone/email normalization, and consent required-field enforcement.
```

### Extension MVP

```text
Build the Chrome Manifest V3 extension popup lead capture UI. It should let staff select an active event, render that event's versioned intake form template, fetch required consent template versions for the event, render consent blocks before the submit button, save drafts locally, validate required fields and required consents, and submit to the API with consent records including consent_template_version_id and captured_at. Use the shared schemas. Do not implement Jane DOM automation.
```

### API MVP

```text
Implement the leads/events/form-template/consent API with database persistence. Leads must store normalized core fields plus configurable field values tied to a form_template_version_id. Consent records must store consent_template_version_id, granted, captured_at, and raw_checkbox_value. Include required-consent validation on POST /leads (reject if required consents are missing or granted=false), duplicate detection by normalized email and phone, idempotency keys, and audit events. Add tests for template validation, required configurable fields, required consent validation, duplicate detection, and idempotent submit.
```

### Consent Template Management

```text
Build the consent template admin UI and API. Admin can: create consent templates per clinic with a consent_type (contact, marketing, treatment, custom); create new versions with body_text, short_label, and effective_from; view version history. A version that has at least one lead_consent referencing it is immutable — editing must create a new version. Add event consent requirements editor: admin selects which consent template versions are required for a given event, marks each required or optional, and sets display_order. Endpoints: GET/POST /clinics/:id/consent-templates, GET/POST /consent-templates/:id/versions, GET/PUT /events/:id/consent-requirements.
```

### Review Queue

```text
Build the review queue page and lead detail review panel. The queue page shows paginated leads in submitted and needs_review status with columns for: lead name, event, captured_at, status, duplicate candidate count, and consent status badge. Admin can approve or reject individual leads; bulk approve works on up to 50 leads. Approving records reviewer user ID and timestamp in the audit log. A lead with unresolved pending duplicate candidates cannot be approved — show a clear error. A lead missing required treatment consent cannot be approved — show which consents are missing. Endpoints: GET /clinics/:id/review-queue, POST /leads/:id/approve, POST /leads/:id/reject, POST /leads/bulk-approve.
```

### Duplicate Resolution

```text
Build the duplicate resolution UI and backend. The lead detail panel shows each duplicate_candidate with match_reason and match_score. For internal_lead candidates, show a side-by-side comparison of core fields. For ehr_patient candidates, show the EHR stub fields available. Admin can resolve each candidate as: merged (pick surviving record), dismissed (confirmed they are different people), or new_record (create a new EHR patient with a note). Merging absorbs the dismissed lead's consents and field values. Unresolved pending candidates block approval. Backend: GET /leads/:id/duplicates, POST /leads/:id/duplicates/:candidateId/resolve, POST /leads/:id/merge-into/:targetLeadId. Add the EHR duplicate check step in the sync worker (searchPatient before createPatient); if matches found, create duplicate_candidates and move lead back to needs_review.
```

### EHR Field Mapping Editor

```text
Build the per-field EHR mapping editor in the admin web app. Show all form_field_keys from the clinic's active form templates. For each field, admin can set: ehr_field_path (select from supported-fields list or type manually), transform (none, uppercase, date_iso, phone_e164), and fallback_to_note (boolean). Show a preview panel using a sample lead that shows how each field value would appear after transformation and which fields would go into the note body. Endpoints: GET /clinics/:id/ehr-mappings, POST /clinics/:id/ehr-mappings, PUT /ehr-mappings/:id, DELETE /ehr-mappings/:id, GET /ehr-connections/:id/supported-fields (mock returning a fixed list for now).
```

### Sync Worker And Lifecycle

```text
Implement the EHR sync BullMQ worker with the full status lifecycle: queued → running → succeeded | failed | rejected. Retry policy: exponential backoff starting at 60s, doubling to a max of 1 hour, max 5 attempts. After 5 failed attempts transition to rejected. At queue time, snapshot the current ehr_field_mappings into the sync job row as field_mapping_snapshot. Apply transforms. Assemble fallback_to_note fields into a note body string. Call adapter.searchPatient first; if matches returned, create duplicate_candidates, move lead to needs_review, and cancel the sync job. On success, write to ehr_patient_refs and move lead to synced. On permanent failure, move lead to sync_rejected. Emit audit events for every state transition. Add GET /leads/:id/sync-jobs, POST /leads/:id/sync-jobs/:jobId/cancel, POST /leads/:id/sync-jobs/:jobId/retry, GET /clinics/:id/sync-summary.
```

### Manual Export Fallback

```text
Implement the CSV and copy packet export. POST /events/:id/export/csv accepts optional leadIds array and includeEhrMapping boolean. It returns a CSV with core columns first, then field value columns named by form_field_key, then consent columns (one per consent_type showing granted/not_granted/not_shown). If includeEhrMapping is true, add EHR-mapped columns showing transformed values. POST /events/:id/export/jane-import returns a CSV shaped by the clinic's ehr_field_mappings using ehr_field_path as column headers. GET /leads/:id/copy-packet returns JSON with sections: identity, contact, clinical, consents (including full body_text of the accepted consent version). All exports write an audit_event with exporter user ID and timestamp. Move exported leads to exported status.
```

### Jane Adapter Skeleton

```text
Implement the Jane adapter skeleton behind a feature flag. Include OAuth connect/callback routes, PKCE state handling, encrypted token storage interface, token refresh, and provider error mapping. Implement searchPatient as a stub that returns an empty array. Map Jane error codes to failed vs. rejected sync transitions: 401/403 → failed (token issue, will refresh and retry), 422 → rejected (validation error, no retry), 429 → failed (rate limit, respect Retry-After), 5xx → failed. Do not implement createPatient or updatePatient until endpoint/scope details are confirmed.
```

## Management Rules For Working With AI Coders

- Give Claude one bounded task at a time.
- Require tests or a smoke check with each implementation task.
- Keep Jane API work behind feature flags until real credentials exist.
- Review all auth, token, and logging changes manually.
- Verify that sync job error_payload logging strips PHI before merging.
- Do not let either agent solve missing Jane access by scraping Jane pages.
- Consent template versions that have been accepted by any lead are immutable — reject any PR that modifies accepted versions.
- Keep `docs/architecture.md` current when a major implementation decision changes.
