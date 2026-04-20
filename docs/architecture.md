# Event Intake Architecture

## Product Goal

Build a Chrome extension and supporting web service that lets clinic staff capture lead information at events, validate and enrich it, then push it into Jane.app and later other EHR or practice management systems.

The product should optimize for speed at the booth, auditability after the event, and compliant handling of personal and health-related information.

## EHR Integration Philosophy

Treat EHR synchronization as a controlled back-office workflow, not a real-time booth operation. The booth captures leads. The back office reviews, resolves duplicates, confirms consent, maps fields, and exports to the EHR on a human-approved schedule. This separation means:

- A slow Jane API or a missed duplicate never disrupts capture.
- Staff at the booth see only "submitted" or "offline draft" — not EHR errors.
- Admins resolve problems at a desk with full context, not under booth pressure.
- The manual export fallback is always available regardless of API status.

## Current Integration Reality

Jane has two relevant positions that affect architecture:

- Jane's public integrations/help pages still state that Jane does not offer an open API or API keys.
- Jane also has a Jane Developer Platform for approved technology partners. It uses OAuth 2.0 Authorization Code with PKCE, practitioner consent, clinic-specific API calls, and beta endpoints such as patients, appointments, treatments, staff members, locations, disciplines, and company.

Architecture implication: use Jane's official Developer Platform if you can get partner access. Treat direct browser automation inside Jane as a fallback/manual-assist mode only, not as the system of record integration.

## High-Level System

```text
Event booth browser
  |
  | Chrome extension popup / side panel
  v
Extension background service worker
  |
  | HTTPS API, authenticated user session
  v
Backend API
  |
  | database, queue, audit log, token vault
  v
Back-office review queue (admin web app)
  |
  +--> EHR sync pipeline (after human approval)
  |      +--> Jane Developer Platform
  |      +--> future EHR adapter
  +--> Manual export fallback (CSV / copy packet)
```

## Components

### Chrome Extension

Use Manifest V3.

Responsibilities:

- Fast lead capture UI generated from the selected event's intake form template.
- Event selection/tagging so every lead is tied to a specific event such as a marathon, medical conference, health fair, employer benefits day, or community screening.
- Support configurable fields such as complaint, address, phone, email, preferred contact method, requested service, referral source, insurance interest, availability, and notes.
- Render versioned consent blocks inline (pulled from `consent_template_versions`), capture checkbox state with timestamp and version ID.
- Offline-tolerant local draft queue for unreliable event Wi-Fi.
- Duplicate warning before submit when the backend finds matching email/phone.
- Optional page helper if staff are inside Jane, but only for navigation or copy-assist. Avoid scraping or DOM-based writes as the primary flow.
- Authenticated communication with your backend.

Recommended extension surfaces:

- `popup` for quick capture.
- `sidePanel` if staff need to keep the form open while browsing.
- `options` page for clinic/event configuration.
- `background.service_worker` for auth state, queue sync, and message routing.

Do not store long-lived EHR tokens in the extension. Store only a short-lived app session token or refresh mechanism appropriate for your backend.

### Backend API

Responsibilities:

- Own user accounts, clinic membership, roles, and event workspaces.
- Receive leads from extension.
- Validate and normalize lead data.
- Detect duplicates across event leads and EHR patients when possible.
- Store audit events for all create/update/export/sync actions.
- Own EHR OAuth flows and token refresh.
- Move leads through a review queue before any EHR write.
- Push approved leads into EHR systems through adapter interfaces.
- Provide retryable sync jobs and human-readable error states.

Recommended stack:

- API: TypeScript + Node.js, preferably NestJS or Fastify.
- Database: Postgres.
- ORM/query layer: Prisma or Drizzle.
- Queue: BullMQ + Redis for early product, or managed queue later.
- Hosting: Render/Fly/Railway for prototype, then HIPAA-capable cloud deployment with signed BAA if handling PHI.

### Web Admin App

Responsibilities:

- Configure clinics, events, staff, Jane clinic URLs, event-specific intake form templates, default lead mappings, consent language, and follow-up workflows.
- Build event forms using a small controlled form-builder rather than arbitrary code.
- Manage versioned consent templates per event type or per event.
- Review queue: inspect leads, resolve duplicates, confirm or reject EHR sync.
- Per-field EHR mapping configuration.
- Retry failed syncs.
- Export CSV / copy packet as manual fallback.
- Manage EHR connections.

This can be the same frontend codebase as the extension if using React, but keep extension-specific runtime code separate from web app code.

### Integration Adapter Layer

Define a stable internal interface before writing Jane-specific logic.

```ts
interface EhrAdapter {
  provider: "jane" | "practice_fusion" | "simplepractice" | "csv";
  connectUrl(clinicId: string, returnTo: string): Promise<string>;
  testConnection(connectionId: string): Promise<ConnectionHealth>;
  searchPatient(connectionId: string, query: PatientSearchQuery): Promise<PatientMatch[]>;
  createPatient(connectionId: string, lead: NormalizedLead, mappings: FieldMapping[]): Promise<EhrPatientRef>;
  updatePatient?(connectionId: string, patientId: string, patch: PatientPatch, mappings: FieldMapping[]): Promise<void>;
  createNote?(connectionId: string, patientId: string, note: LeadNote): Promise<void>;
  exportCsv(leads: NormalizedLead[], mappings: FieldMapping[]): Promise<Buffer>;
}
```

Benefits:

- Jane can be first without hard-coding Jane assumptions everywhere.
- Other EHR systems can be added without rewriting lead capture.
- `CsvEhrAdapter` satisfies clinics whose EHR has no practical API and is always available as a fallback.

## Consent Templates With Versioning

### Why Separate From Form Templates

Consent language has distinct legal requirements: once a patient has accepted a specific version of consent text, that exact text must be preserved immutably in the audit record. Consent templates therefore version independently of intake form templates.

A single event may require multiple consent types:

- **Contact consent**: permission to follow up via phone or email.
- **Marketing consent**: separate opt-in for promotional messages.
- **Treatment consent**: permission to receive clinical care, required before patient creation in many jurisdictions.

### Consent Template Data Model

```sql
consent_templates
  id              uuid primary key
  clinic_id       uuid references clinics
  name            text                   -- e.g. "Treatment Consent – Standard"
  consent_type    text                   -- contact | marketing | treatment | custom
  created_by      uuid references users
  created_at      timestamptz

consent_template_versions
  id              uuid primary key
  consent_template_id  uuid references consent_templates
  version_number  int
  body_text       text                   -- exact legal text rendered to patient
  short_label     text                   -- checkbox label shown in extension
  effective_from  date
  effective_until date                   -- null means currently active
  created_by      uuid references users
  created_at      timestamptz

event_consent_requirements
  id                         uuid primary key
  event_id                   uuid references events
  consent_template_version_id uuid references consent_template_versions
  required                   boolean     -- if true, lead cannot submit without this consent
  display_order              int

lead_consents
  id                         uuid primary key
  lead_id                    uuid references leads
  consent_template_version_id uuid references consent_template_versions
  granted                    boolean
  captured_at                timestamptz
  captured_by                uuid references users
  ip_address                 inet        -- capture device, for audit
  raw_checkbox_value         boolean     -- exactly what the user checked
```

### Event-Specific Consent To Receive Treatment

When an event requires treatment consent (e.g. a screening clinic, a physiotherapy booth), add a `treatment` type consent requirement to the event. The extension will render the treatment consent block before the submit button. The backend will:

1. Reject any lead submission missing required consent records.
2. Record the exact `consent_template_version_id` and timestamp.
3. Block EHR patient creation for leads without valid treatment consent.

**API endpoints:**

```
GET  /clinics/:id/consent-templates
POST /clinics/:id/consent-templates
GET  /consent-templates/:id/versions
POST /consent-templates/:id/versions
GET  /events/:id/consent-requirements
PUT  /events/:id/consent-requirements
```

## Review Queue Before EHR Sync

No lead is pushed to an EHR automatically. All leads pass through a review queue. This is intentional: it surfaces duplicates, consent gaps, and field mapping problems at a desk rather than under booth pressure.

### Lead Status Lifecycle

```
draft           -- saved locally in extension, not yet submitted
submitted       -- received by backend, validation pending
needs_review    -- duplicate candidates found, consent missing, or validation warning
ready           -- passed all checks, available for EHR sync or export
sync_queued     -- admin approved; sync job created
syncing         -- sync job running
synced          -- successfully written to EHR; ehr_patient_ref created
sync_failed     -- transient error; will retry up to retry limit
sync_rejected   -- permanent error (e.g. EHR validation failure); requires manual resolution
exported        -- manually exported via CSV / copy packet
archived        -- no further action needed
```

Transitions:

- `submitted` → `needs_review` if duplicate candidates exist or required consent is missing.
- `submitted` → `ready` if all checks pass.
- `needs_review` → `ready` when admin resolves duplicates and confirms consent.
- `ready` → `sync_queued` when admin selects leads and clicks "Sync to EHR".
- `sync_queued` → `syncing` → `synced` | `sync_failed` | `sync_rejected`.
- Any status → `exported` when admin downloads or copies the lead.
- Any terminal status → `archived`.

### Review Queue API Endpoints

```
GET  /clinics/:id/review-queue            -- paginated, filterable by status, event, date
GET  /leads/:id                           -- full lead detail with consents, field values, candidates
POST /leads/:id/approve                   -- moves to ready; records reviewer and timestamp
POST /leads/:id/reject                    -- moves to archived with rejection reason
POST /leads/bulk-approve                  -- approve multiple leads
POST /leads/:id/sync                      -- enqueue single lead for EHR sync
POST /leads/bulk-sync                     -- enqueue multiple approved leads
```

### Review Queue Acceptance Criteria

- Leads with duplicate candidates cannot be approved until the duplicate is resolved.
- Leads missing required treatment consent cannot be approved.
- Approving a lead records the reviewer's user ID and timestamp in the audit log.
- The queue defaults to showing `submitted` and `needs_review` leads for the last 30 days.
- Bulk actions work on up to 50 leads at a time.

## Per-Field EHR Mapping

Not all intake form fields map cleanly to EHR structured fields. The mapping layer makes the translation explicit and editable by admins without a code deploy.

### Data Model

```sql
ehr_field_mappings
  id                        uuid primary key
  clinic_id                 uuid references clinics
  ehr_connection_id         uuid references ehr_connections
  form_field_key            text           -- matches IntakeField.key
  ehr_field_path            text           -- EHR-specific path, e.g. "patient.chiefComplaint"
  transform                 text           -- none | uppercase | date_iso | phone_e164 | custom
  custom_transform_fn       text           -- name of a registered transform function, null if transform != custom
  fallback_to_note          boolean        -- if true and ehr_field_path is unsupported, append to note
  display_order             int
  created_at                timestamptz
  updated_at                timestamptz
```

### Mapping Behavior

1. When a sync job runs, it loads the clinic's `ehr_field_mappings` for the target EHR connection.
2. For each lead field value, it looks up the mapping by `form_field_key`.
3. If a mapping exists and `ehr_field_path` is supported by the adapter, the value is transformed and sent as a structured field.
4. If `fallback_to_note` is true and the path is unsupported, the field label and value are appended to a note body.
5. Fields with no mapping and no fallback are stored only in your database.

### Per-Field Mapping API Endpoints

```
GET  /clinics/:id/ehr-mappings?connectionId=
POST /clinics/:id/ehr-mappings
PUT  /ehr-mappings/:id
DELETE /ehr-mappings/:id
GET  /ehr-connections/:id/supported-fields   -- adapter introspection, returns known EHR field paths
```

### Per-Field Mapping Acceptance Criteria

- Admin can configure field mappings per EHR connection without a code change.
- Unmapped fields with `fallback_to_note = true` appear in a structured note attached to the EHR patient record.
- Sync job logs which fields were mapped, which fell back to note, and which were skipped.
- The mapping editor shows a preview of how a sample lead would be structured before sync.

## Duplicate Resolution Before Patient Creation

Duplicate detection runs at two points: immediately after lead submission (within your own database) and immediately before EHR patient creation (against the EHR patient roster if a search endpoint is available).

### Duplicate Candidate Model

```sql
duplicate_candidates
  id              uuid primary key
  lead_id         uuid references leads
  candidate_type  text             -- internal_lead | ehr_patient
  candidate_ref   text             -- lead_id or EHR patient ID string
  match_reason    text[]           -- ["email", "phone", "name_dob"]
  match_score     numeric(5,2)     -- 0.00–1.00
  status          text             -- pending | merged | dismissed | new_record
  resolved_by     uuid references users
  resolved_at     timestamptz
  resolution_note text
  created_at      timestamptz
```

### Duplicate Detection Flow

Internal detection (at submission):

1. Backend normalizes email and phone from the submitted lead.
2. Queries `leads` for rows with matching email OR phone in the same clinic.
3. Optionally fuzzy-matches on `(first_name, last_name, date_of_birth)` using pg_trgm.
4. Creates `duplicate_candidates` rows for each match above the threshold.
5. Moves lead to `needs_review` if any candidate exists.

EHR detection (before sync):

1. When a lead enters `sync_queued`, the sync worker calls `adapter.searchPatient` before `createPatient`.
2. If matches are returned, creates `duplicate_candidates` with `candidate_type = ehr_patient`.
3. Moves lead back to `needs_review`.
4. Admin resolves: `merged` (update existing EHR patient), `dismissed` (confirmed new patient), or `new_record` (create anyway with a note).

### Duplicate Resolution API Endpoints

```
GET  /leads/:id/duplicates
POST /leads/:id/duplicates/:candidateId/resolve   -- body: { status, resolution_note }
POST /leads/:id/merge-into/:targetLeadId          -- merge and archive the duplicate
```

### Duplicate Resolution Acceptance Criteria

- A lead with unresolved `pending` duplicate candidates cannot be approved or synced.
- Resolving a duplicate records the resolver's user ID, timestamp, and resolution note.
- If the resolution is `merged`, the surviving record absorbs the dismissed lead's consents and field values, and the dismissed lead is archived.
- EHR duplicate detection runs as the first step of the sync worker before any write.

## Sync Status Lifecycle

### `ehr_sync_jobs` Table

```sql
ehr_sync_jobs
  id                  uuid primary key
  lead_id             uuid references leads
  ehr_connection_id   uuid references ehr_connections
  status              text        -- queued | running | succeeded | failed | rejected | cancelled
  attempt_count       int         default 0
  max_attempts        int         default 5
  last_attempted_at   timestamptz
  next_retry_at       timestamptz
  ehr_patient_id      text        -- populated on success
  ehr_request_id      text        -- EHR-side idempotency key or request ID
  error_code          text
  error_message       text
  error_payload       jsonb       -- sanitized EHR error body (no PHI in logs)
  field_mapping_snapshot jsonb   -- copy of mappings used at sync time
  created_at          timestamptz
  updated_at          timestamptz
```

### Sync Job Lifecycle

- `queued`: created when admin approves sync.
- `running`: worker picks up the job; sets `last_attempted_at`.
- `succeeded`: EHR accepted the write; `ehr_patient_id` recorded; lead moves to `synced`.
- `failed`: transient error (network, 429, 5xx); `next_retry_at` set with exponential backoff; lead remains `sync_failed` until retries exhausted.
- `rejected`: permanent error (EHR validation failure, duplicate flagged by EHR, missing required field); no further retries; lead moves to `sync_rejected`; admin must intervene.
- `cancelled`: admin cancelled before the worker picked it up.

Retry policy: exponential backoff starting at 60 seconds, doubling up to 1 hour, max 5 attempts. After max attempts, transition to `rejected` and notify the admin.

### Sync Status API Endpoints

```
GET  /leads/:id/sync-jobs             -- history of sync attempts for a lead
POST /leads/:id/sync-jobs/:jobId/cancel
POST /leads/:id/sync-jobs/:jobId/retry  -- manual retry for rejected jobs
GET  /clinics/:id/sync-summary        -- counts by status for dashboard widget
```

## Manual Export Fallback

The manual export is always available, regardless of EHR connection status. It is not a degraded mode — it is a fully supported workflow for:

- Clinics waiting for Jane partner approval.
- Events where internet connectivity is unreliable.
- Leads that were sync-rejected and need manual data entry into the EHR.
- Auditors who need a structured snapshot of event data.

### Export Formats

**CSV export:**

- Core columns always first: `lead_id`, `event_name`, `event_date`, `first_name`, `last_name`, `email`, `phone`, `date_of_birth`, `status`, `consents_granted`, `captured_at`.
- Configurable field columns follow, named by `form_field_key`.
- EHR mapping columns optional: adds a column per mapped EHR field showing the transformed value.
- Consent columns: one column per `consent_type` with `granted` / `not_granted` / `not_shown`.

**Copy packet:**

- Single-lead view formatted for pasting into a web form.
- Groups fields by section: identity, contact, clinical, consents.
- Includes consent version text for manual documentation.

**Batch export for manual Jane import:**

- If Jane supports a structured CSV import, shape the export to match Jane's expected columns using the clinic's field mappings.

### Export API Endpoints

```
POST /events/:id/export/csv           -- body: { leadIds?, includeEhrMapping? }
POST /events/:id/export/jane-import   -- Jane-shaped CSV using field mappings
GET  /leads/:id/copy-packet           -- JSON formatted for display in copy-packet UI
```

### Manual Export Acceptance Criteria

- CSV export is available for any lead in any status.
- Export records an `audit_event` with the exporter's user ID and timestamp.
- The Jane import CSV uses the clinic's active field mappings to name columns correctly.
- Copy packet includes the exact consent text version accepted by the patient.
- Exported leads are flagged as `exported` in the lead status but are not archived automatically.

## Jane Integration Strategy

### Preferred Path: Jane Developer Platform

Use Jane's OAuth 2.0 Authorization Code with PKCE through the backend.

Flow:

1. Clinic admin clicks "Connect Jane" in your web admin.
2. Backend creates OAuth state and PKCE verifier/challenge.
3. Browser redirects to Jane IAM with `client_id`, `redirect_uri`, scopes, PKCE challenge, and clinic resource.
4. Jane redirects back with authorization code.
5. Backend exchanges code for access and refresh tokens.
6. Backend stores encrypted token material and clinic URL.
7. Sync jobs call Jane APIs server-side with `Authorization: Bearer <access_token>`.
8. On `401`, backend refreshes token. On refresh failure, admin must reconnect.

Important Jane-specific constraints:

- API access appears to be partner-approved, not self-serve open API access.
- Jane APIs are clinic-specific; the clinic URL/resource matters.
- Redirect URIs must be HTTPS and pre-registered.
- PKCE is required.
- Rate limits must be handled, including `429` and `Retry-After`.
- Use scopes narrowly.

### Fallback Path: Manual Assist

If partner API access is delayed:

- Capture all leads in your app.
- Provide CSV export shaped for manual import if Jane supports the needed import workflow.
- Provide a "copy packet" view that formats fields for staff to paste into Jane.
- Optionally provide a Chrome extension content script that detects Jane pages and opens your lead side panel, but avoid automated writes unless Jane's terms and clinic policies explicitly allow it.

This fallback still creates value at events without building a fragile scraper.

## Data Model

Core tables (full list including new tables):

- `organizations`: billing/customer entity.
- `clinics`: clinic settings, timezone, country, default EHR provider.
- `users`: staff/admin accounts.
- `clinic_memberships`: role mapping.
- `events`: event name, event type, location, start/end date, campaign metadata, active form template.
- `form_templates`: reusable intake form definitions owned by a clinic.
- `form_template_versions`: immutable versions of each form template so historical lead answers can always be interpreted.
- `form_fields`: field definitions for a template version.
- `consent_templates`: named consent blocks owned by a clinic.
- `consent_template_versions`: immutable versioned text for each consent template.
- `event_consent_requirements`: which consent versions are required for a given event.
- `leads`: normalized lead record tied to an event and a form template version.
- `lead_field_values`: user-submitted answers for configurable fields.
- `lead_consents`: timestamped consent capture referencing exact `consent_template_version_id`.
- `lead_notes`: notes and follow-up context.
- `duplicate_candidates`: pairs of leads or lead+EHR patient that require resolution.
- `ehr_connections`: provider, clinic, encrypted tokens, status.
- `ehr_field_mappings`: per-field mapping from form field key to EHR field path.
- `ehr_sync_jobs`: lead-to-EHR sync attempts with full lifecycle status.
- `ehr_patient_refs`: mapping between local lead/person and EHR patient ID.
- `audit_events`: immutable operational log.

### Event Model

An event is the operational container for lead collection.

Event fields:

- `id`
- `clinic_id`
- `name`, for example "Denver Marathon Expo 2026"
- `event_type`, for example `marathon`, `medical_conference`, `health_fair`, `corporate_event`, `screening`, `other`
- `location_name`
- `address`, optional
- `start_at`
- `end_at`
- `timezone`
- `default_form_template_version_id`
- `status`: `draft`, `active`, `closed`, `archived`
- `campaign_tags`, optional string array for reporting

Every lead must have an `event_id`. The extension should make the active event obvious at the top of the capture UI and allow staff to switch events only intentionally.

### Configurable Intake Forms

Use a controlled schema-based form builder. Do not let users inject HTML, scripts, or arbitrary JSON logic.

Supported field types for MVP:

- `short_text`
- `long_text`
- `phone`
- `email`
- `address`
- `date`
- `date_of_birth`
- `single_select`
- `multi_select`
- `checkbox`
- `consent_checkbox`
- `number`

Field definition:

```ts
type IntakeField = {
  id: string;
  key: string;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  helpText?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  piiCategory: "none" | "contact" | "health" | "demographic" | "insurance";
  ehrMapping?: {
    ehrFieldPath: string;
    transform: "none" | "uppercase" | "date_iso" | "phone_e164";
    fallbackToNote: boolean;
  };
  displayOrder: number;
};
```

Field rules:

- `key` is stable and machine-readable, for example `chief_complaint`, `phone`, `street_address`.
- `label` is user-facing and can change between template versions.
- Required fields are enforced in the extension and backend.
- Once a template is used by submitted leads, edits create a new `form_template_version`.
- Field values are stored separately from normalized lead identity fields.

Recommended default form templates:

- Marathon or fitness event: name, phone, email, chief complaint/injury area, activity level, preferred contact method, consent to contact, treatment consent if performing screening.
- Medical conference: name, organization, role, email, phone, service interest, partnership interest, notes, consent to contact.
- Health fair: name, phone, email, address, complaint/goal, preferred clinic location, consent to contact.
- Employer benefits event: name, employee ID optional, phone, email, service interest, availability, consent to contact.

### Lead Model

Every lead has a normalized core plus event-specific answers.

Core lead fields for MVP:

- first name
- last name
- phone
- email
- date of birth, optional but useful for duplicate matching
- event ID
- form template version ID
- source/referral
- status: see full lifecycle in the Review Queue section above

Configurable values can include:

- chief complaint or health goal
- address
- service interest
- preferred location
- preferred practitioner
- preferred contact method
- insurance interest
- event-specific screening answers
- notes

Keep duplicated contact fields synchronized carefully:

- The normalized `leads.phone` and `leads.email` fields power duplicate detection.
- The configurable answers preserve exactly what the user entered in the event form.
- If a form includes phone/email fields, the backend should map them into the normalized lead columns during validation.

### Form Builder UX

Admin web app:

- Create event.
- Choose event type.
- Select an existing form template or start from an event-type preset.
- Add, remove, reorder, and require fields.
- Configure per-field EHR mappings inline.
- Add consent requirements for the event (contact, marketing, treatment).
- Preview the exact extension capture form including consent blocks.
- Publish the form for event staff.

Extension:

- Load active events available to the signed-in staff member.
- Staff selects the event at the beginning of a shift.
- The extension caches the selected event, form template version, and consent template versions.
- Capture screen renders fields in configured order with consent blocks at the bottom.
- Submitted lead includes `event_id`, `form_template_version_id`, normalized core fields, configurable field values, consent records (each with `consent_template_version_id` and timestamp), and an idempotency key.

Reporting:

- Lead list can filter by event, event type, status, campaign tags, and consent status.
- CSV export includes core columns first, then event-specific columns, then consent columns.
- EHR sync maps only fields supported by the selected EHR adapter per the clinic's field mapping configuration.

## Data Flow

Event setup:

1. Admin creates an event.
2. Admin picks or creates an intake form template.
3. System saves a versioned template and assigns it to the event.
4. Admin adds consent requirements: selects active consent template versions for contact, marketing, and treatment as applicable.
5. Admin configures per-field EHR mappings for the event's target EHR connection.
6. Event is marked active.

Lead capture:

1. Staff opens extension.
2. Extension fetches active events, selected event form, and required consent template versions.
3. Staff enters lead details and checks consent boxes.
4. Extension validates locally and saves a local draft.
5. Extension submits to backend with idempotency key.
6. Backend validates against the same template version.
7. Backend normalizes identity/contact fields and stores configurable answers.
8. Backend validates required consents; records each consent with version ID and timestamp.
9. Backend runs duplicate detection.
10. Backend moves lead to `needs_review` if duplicates or consent gaps found, or to `ready` if all checks pass.

Review queue:

1. Admin opens review queue in web app.
2. Admin inspects leads in `needs_review`: resolves duplicate candidates, confirms consents, checks field values.
3. Admin approves leads (moves to `ready`) or rejects them (moves to `archived`).
4. Admin selects approved leads and clicks "Sync to EHR" or "Export CSV".

EHR sync:

1. Sync worker loads the lead, field mapping snapshot, and EHR connection.
2. Worker calls `adapter.searchPatient` first; if EHR duplicates found, lead moves back to `needs_review`.
3. Worker maps fields using `ehr_field_mappings`; fields with `fallback_to_note` are assembled into a note body.
4. Worker calls `adapter.createPatient` (or `updatePatient` if merging into existing).
5. On success: `ehr_patient_refs` row created, lead moves to `synced`, audit event recorded.
6. On transient failure: job retries with backoff.
7. On permanent failure: job moves to `rejected`, lead moves to `sync_rejected`, admin notified.

Manual export:

1. Admin selects leads in any status.
2. Admin clicks "Export CSV" or "Export Jane Import CSV".
3. Backend applies field mappings to shape the export.
4. Lead status updated to `exported`; audit event recorded.

## Security And Compliance

Assume this can become PHI/PII even if initial leads are lightweight.

Minimum bar:

- TLS everywhere.
- No EHR tokens in extension storage.
- Encrypt OAuth refresh tokens at rest using KMS or managed secrets.
- Row-level authorization by clinic.
- Staff roles: owner, admin, event_staff, reviewer.
- Audit log for view/create/update/approve/reject/export/sync.
- Consent records are immutable after creation; only archived, never deleted.
- Data retention controls per clinic/event.
- Field-level minimization in the extension.
- No lead data in analytics tools.
- No sensitive data in logs; `error_payload` in sync jobs must be sanitized.
- Backups and deletion workflow.

HIPAA note: if clinics use this for protected health information in the US, hosting, logging, support tooling, analytics, error tracking, and email providers may need BAAs. Design as if this matters from day one.

## Reliability

Extension:

- Save drafts locally immediately.
- Show sync status per lead.
- Retry backend upload when online.
- Never silently discard a lead.

Backend:

- Use idempotency keys for lead submissions and EHR create calls.
- Queue EHR writes.
- Separate "lead accepted by your system" from "lead synced to EHR".
- Store provider response IDs and error payload summaries.
- Implement retry with backoff for transient failures.
- Stop retrying and mark `sync_rejected` for validation or duplicate problems; notify admin.
- Manual export is always available as a fallback regardless of EHR connection status.

## Suggested Repository Layout

```text
apps/
  extension/
    manifest.json
    src/
      popup/
      sidepanel/
      background/
      content/
  web/
    src/
      review-queue/
      duplicate-resolution/
      field-mapping/
      consent-templates/
  api/
    src/
      modules/
        auth/
        clinics/
        events/
        leads/
        consent/
        review/
        ehr/
        sync/
        export/
        audit/
packages/
  shared/
    src/
      schemas/
      types/
      ehr-adapter/
      field-transforms/
  config/
docs/
  architecture.md
  implementation-plan.md
```

## MVP Boundary

Build first:

- Extension lead capture with versioned consent blocks.
- Backend lead storage with full status lifecycle.
- Admin event setup including consent requirements and field mapping configuration.
- Duplicate detection inside your own database.
- Review queue with approve/reject workflow.
- CSV export and copy packet view.
- Jane adapter interface with mocked implementation.
- Jane OAuth skeleton behind a feature flag.

Build after partner/API access is confirmed:

- Jane patient search for EHR duplicate detection.
- Jane patient create/update using per-field mappings.
- Jane note creation for unmapped fields with `fallback_to_note`.
- Full retry/reconciliation dashboard.

Avoid in MVP:

- Multi-EHR abstraction beyond the adapter interface.
- Automated browser writes into Jane.
- Complex insurance/intake form workflows.
- Appointment booking unless Jane API access confirms the required endpoints and permissions.
