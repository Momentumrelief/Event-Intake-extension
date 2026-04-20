import { z } from "zod";

export const AuditAction = z.enum([
  "lead_created",
  "lead_updated",
  "lead_approved",
  "lead_rejected",
  "lead_exported",
  "lead_synced",
  "lead_merged",
  "consent_captured",
  "duplicate_resolved",
  "sync_queued",
  "sync_started",
  "sync_succeeded",
  "sync_failed",
  "sync_rejected",
  "sync_cancelled",
  "ehr_connected",
  "ehr_disconnected",
  "token_refreshed",
]);
export type AuditAction = z.infer<typeof AuditAction>;
