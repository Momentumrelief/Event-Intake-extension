import { EhrFieldMappingSchema, EhrProvider } from "../schemas/ehr.js";
import { z } from "zod";

export const PatientSearchQuery = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().date().optional(),
});
export type PatientSearchQuery = z.infer<typeof PatientSearchQuery>;

export const PatientMatch = z.object({
  ehrPatientId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  matchScore: z.number().min(0).max(1),
});
export type PatientMatch = z.infer<typeof PatientMatch>;

export const NormalizedLead = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  fieldValues: z.record(z.string(), z.string()),
});
export type NormalizedLead = z.infer<typeof NormalizedLead>;

export const ConnectionHealth = z.object({
  connected: z.boolean(),
  latencyMs: z.number().optional(),
  errorMessage: z.string().optional(),
});
export type ConnectionHealth = z.infer<typeof ConnectionHealth>;

export const EhrPatientRef = z.object({
  ehrPatientId: z.string(),
  ehrProvider: EhrProvider,
});
export type EhrPatientRef = z.infer<typeof EhrPatientRef>;

export type FieldMapping = z.infer<typeof EhrFieldMappingSchema>;

export interface EhrAdapter {
  readonly provider: z.infer<typeof EhrProvider>;
  connectUrl(clinicId: string, returnTo: string): Promise<string>;
  testConnection(connectionId: string): Promise<ConnectionHealth>;
  listSupportedFields(): Promise<Array<{ path: string; label: string; type: string }>>;
  searchPatient(connectionId: string, query: PatientSearchQuery): Promise<PatientMatch[]>;
  createPatient(
    connectionId: string,
    lead: NormalizedLead,
    mappings: FieldMapping[],
  ): Promise<EhrPatientRef>;
  updatePatient?(
    connectionId: string,
    ehrPatientId: string,
    lead: NormalizedLead,
    mappings: FieldMapping[],
  ): Promise<void>;
  createNote?(connectionId: string, ehrPatientId: string, noteBody: string): Promise<void>;
  // Returns CSV bytes. Typed as Uint8Array so the interface doesn't require
  // Node types on the browser side; Node implementations can still return Buffer
  // since Buffer extends Uint8Array.
  exportCsv(leads: NormalizedLead[], mappings: FieldMapping[]): Promise<Uint8Array>;
}
