import { z } from "zod";
import { FieldTransform } from "./form-template.js";

export const EhrProvider = z.enum(["jane", "practice_fusion", "simplepractice", "csv"]);
export type EhrProvider = z.infer<typeof EhrProvider>;

export const SyncJobStatus = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "rejected",
  "cancelled",
]);
export type SyncJobStatus = z.infer<typeof SyncJobStatus>;

export const DuplicateCandidateStatus = z.enum(["pending", "merged", "dismissed", "new_record"]);
export type DuplicateCandidateStatus = z.infer<typeof DuplicateCandidateStatus>;

export const DuplicateCandidateType = z.enum(["internal_lead", "ehr_patient"]);
export type DuplicateCandidateType = z.infer<typeof DuplicateCandidateType>;

export const EhrFieldMappingSchema = z.object({
  id: z.string().uuid(),
  clinicId: z.string().uuid(),
  ehrConnectionId: z.string().uuid(),
  formFieldKey: z.string(),
  ehrFieldPath: z.string(),
  transform: FieldTransform,
  fallbackToNote: z.boolean(),
  displayOrder: z.number().int().min(0),
});
export type EhrFieldMappingSchema = z.infer<typeof EhrFieldMappingSchema>;

export const CreateEhrFieldMappingSchema = EhrFieldMappingSchema.omit({
  id: true,
  clinicId: true,
});
export type CreateEhrFieldMappingSchema = z.infer<typeof CreateEhrFieldMappingSchema>;

export const EhrSyncJobSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  ehrConnectionId: z.string().uuid(),
  status: SyncJobStatus,
  attemptCount: z.number().int(),
  maxAttempts: z.number().int(),
  lastAttemptedAt: z.string().datetime().optional(),
  nextRetryAt: z.string().datetime().optional(),
  ehrPatientId: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EhrSyncJobSchema = z.infer<typeof EhrSyncJobSchema>;

export const DuplicateCandidateSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  candidateType: DuplicateCandidateType,
  candidateRef: z.string(),
  matchReason: z.array(z.string()),
  matchScore: z.number().min(0).max(1),
  status: DuplicateCandidateStatus,
  resolvedBy: z.string().uuid().optional(),
  resolvedAt: z.string().datetime().optional(),
  resolutionNote: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type DuplicateCandidateSchema = z.infer<typeof DuplicateCandidateSchema>;

export const SyncLeadSchema = z.object({
  ehrConnectionId: z.string().uuid(),
});

export const BulkSyncSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(50),
  ehrConnectionId: z.string().uuid(),
});
