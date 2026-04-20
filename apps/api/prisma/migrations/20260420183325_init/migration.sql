-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "country" TEXT NOT NULL DEFAULT 'CA',
    "ehr_provider" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "clinics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "clinic_memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinic_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clinic_memberships_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "clinic_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "location_name" TEXT,
    "address" TEXT,
    "start_at" DATETIME NOT NULL,
    "end_at" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL,
    "default_form_template_version_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "campaign_tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "events_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "form_templates_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "form_template_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "form_template_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_template_versions_form_template_id_fkey" FOREIGN KEY ("form_template_id") REFERENCES "form_templates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "form_fields" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "form_template_version_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "help_text" TEXT,
    "placeholder" TEXT,
    "options" TEXT,
    "pii_category" TEXT NOT NULL DEFAULT 'none',
    "ehr_field_path" TEXT,
    "ehr_transform" TEXT,
    "ehr_fallback_to_note" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_fields_form_template_version_id_fkey" FOREIGN KEY ("form_template_version_id") REFERENCES "form_template_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "consent_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "consent_type" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consent_templates_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "consent_template_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consent_template_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "body_text" TEXT NOT NULL,
    "short_label" TEXT NOT NULL,
    "effective_from" DATETIME NOT NULL,
    "effective_until" DATETIME,
    "created_by" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consent_template_versions_consent_template_id_fkey" FOREIGN KEY ("consent_template_id") REFERENCES "consent_templates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "consent_template_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "event_consent_requirements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "consent_template_version_id" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL,
    CONSTRAINT "event_consent_requirements_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "event_consent_requirements_consent_template_version_id_fkey" FOREIGN KEY ("consent_template_version_id") REFERENCES "consent_template_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "form_template_version_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "date_of_birth" DATETIME,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "idempotency_key" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" DATETIME,
    "rejection_reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "leads_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "leads_form_template_version_id_fkey" FOREIGN KEY ("form_template_version_id") REFERENCES "form_template_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "leads_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lead_field_values" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "form_field_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_field_values_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lead_field_values_form_field_id_fkey" FOREIGN KEY ("form_field_id") REFERENCES "form_fields" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lead_consents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "consent_template_version_id" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "captured_at" DATETIME NOT NULL,
    "captured_by" TEXT NOT NULL,
    "raw_checkbox_value" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_consents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lead_consents_consent_template_version_id_fkey" FOREIGN KEY ("consent_template_version_id") REFERENCES "consent_template_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "duplicate_candidates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "candidate_type" TEXT NOT NULL,
    "candidate_ref" TEXT NOT NULL,
    "match_reason" TEXT NOT NULL,
    "match_score" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolved_by" TEXT,
    "resolved_at" DATETIME,
    "resolution_note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "duplicate_candidates_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "duplicate_candidates_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ehr_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinic_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "clinic_url" TEXT,
    "encrypted_tokens" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "last_tested_at" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ehr_connections_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ehr_field_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinic_id" TEXT NOT NULL,
    "ehr_connection_id" TEXT NOT NULL,
    "form_field_key" TEXT NOT NULL,
    "ehr_field_path" TEXT NOT NULL,
    "transform" TEXT NOT NULL DEFAULT 'none',
    "fallback_to_note" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ehr_field_mappings_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ehr_field_mappings_ehr_connection_id_fkey" FOREIGN KEY ("ehr_connection_id") REFERENCES "ehr_connections" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ehr_sync_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "ehr_connection_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_attempted_at" DATETIME,
    "next_retry_at" DATETIME,
    "ehr_patient_id" TEXT,
    "ehr_request_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "error_payload" TEXT,
    "field_mapping_snapshot" TEXT,
    "cancelled_by" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ehr_sync_jobs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ehr_sync_jobs_ehr_connection_id_fkey" FOREIGN KEY ("ehr_connection_id") REFERENCES "ehr_connections" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ehr_sync_jobs_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ehr_patient_refs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "ehr_provider" TEXT NOT NULL,
    "ehr_patient_id" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ehr_patient_refs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_memberships_clinic_id_user_id_key" ON "clinic_memberships"("clinic_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_template_versions_form_template_id_version_number_key" ON "form_template_versions"("form_template_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "form_fields_form_template_version_id_key_key" ON "form_fields"("form_template_version_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "consent_template_versions_consent_template_id_version_number_key" ON "consent_template_versions"("consent_template_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "event_consent_requirements_event_id_consent_template_version_id_key" ON "event_consent_requirements"("event_id", "consent_template_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_idempotency_key_key" ON "leads"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "lead_field_values_lead_id_form_field_id_key" ON "lead_field_values"("lead_id", "form_field_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_consents_lead_id_consent_template_version_id_key" ON "lead_consents"("lead_id", "consent_template_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "ehr_field_mappings_ehr_connection_id_form_field_key_key" ON "ehr_field_mappings"("ehr_connection_id", "form_field_key");

-- CreateIndex
CREATE UNIQUE INDEX "ehr_patient_refs_lead_id_key" ON "ehr_patient_refs"("lead_id");
