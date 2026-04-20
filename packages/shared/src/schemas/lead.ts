import { z } from "zod";

export const LeadStatus = z.enum([
  "draft",
  "submitted",
  "needs_review",
  "ready",
  "sync_queued",
  "syncing",
  "synced",
  "sync_failed",
  "sync_rejected",
  "exported",
  "archived",
]);
export type LeadStatus = z.infer<typeof LeadStatus>;

export const TERMINAL_LEAD_STATUSES: LeadStatus[] = ["synced", "sync_rejected", "exported", "archived"];
export const REVIEWABLE_LEAD_STATUSES: LeadStatus[] = ["submitted", "needs_review"];

export const LeadConsentRecord = z.object({
  consentTemplateVersionId: z.string().uuid(),
  granted: z.boolean(),
  capturedAt: z.string().datetime(),
  rawCheckboxValue: z.boolean(),
});
export type LeadConsentRecord = z.infer<typeof LeadConsentRecord>;

export const LeadFieldValue = z.object({
  formFieldId: z.string().uuid(),
  value: z.string(),
});
export type LeadFieldValue = z.infer<typeof LeadFieldValue>;

export const CreateLeadSchema = z.object({
  idempotencyKey: z.string().min(1).max(128),
  eventId: z.string().uuid(),
  formTemplateVersionId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().toLowerCase().optional(),
  phone: z.string().max(30).optional(),
  dateOfBirth: z.string().date().optional(),
  source: z.string().max(100).optional(),
  fieldValues: z.array(LeadFieldValue),
  consents: z.array(LeadConsentRecord),
});
export type CreateLeadSchema = z.infer<typeof CreateLeadSchema>;

export const LeadSummary = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  status: LeadStatus,
  eventId: z.string().uuid(),
  createdAt: z.string().datetime(),
  duplicateCandidateCount: z.number().int().optional(),
  missingRequiredConsents: z.array(z.string()).optional(),
});
export type LeadSummary = z.infer<typeof LeadSummary>;

export const ApproveLeadSchema = z.object({
  note: z.string().max(500).optional(),
});

export const RejectLeadSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const BulkApproveSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(50),
});

export const ResolveDuplicateSchema = z.object({
  status: z.enum(["merged", "dismissed", "new_record"]),
  resolutionNote: z.string().max(500).optional(),
});
