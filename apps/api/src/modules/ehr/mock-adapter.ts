import type { EhrAdapter, PatientSearchQuery, PatientMatch, NormalizedLead, ConnectionHealth, EhrPatientRef, FieldMapping } from "@eventintake/shared";
import { applyTransform } from "../../lib/normalize.js";

export class MockEhrAdapter implements EhrAdapter {
  readonly provider = "csv" as const;

  async connectUrl(_clinicId: string, returnTo: string): Promise<string> {
    return `${returnTo}?mock=true`;
  }

  async testConnection(_connectionId: string): Promise<ConnectionHealth> {
    return { connected: true, latencyMs: 5 };
  }

  listSupportedFields(): Promise<Array<{ path: string; label: string; type: string }>> {
    return Promise.resolve([
      { path: "patient.firstName", label: "First Name", type: "string" },
      { path: "patient.lastName", label: "Last Name", type: "string" },
      { path: "patient.email", label: "Email", type: "email" },
      { path: "patient.phone", label: "Phone", type: "phone" },
      { path: "patient.dateOfBirth", label: "Date of Birth", type: "date" },
      { path: "patient.chiefComplaint", label: "Chief Complaint", type: "string" },
      { path: "patient.notes", label: "Notes", type: "text" },
    ]);
  }

  async searchPatient(_connectionId: string, _query: PatientSearchQuery): Promise<PatientMatch[]> {
    return [];
  }

  async createPatient(
    _connectionId: string,
    lead: NormalizedLead,
    _mappings: FieldMapping[],
  ): Promise<EhrPatientRef> {
    // Simulate patient creation with a deterministic fake ID
    const ehrPatientId = `mock-${lead.id.slice(0, 8)}`;
    return { ehrPatientId, ehrProvider: "csv" };
  }

  async exportCsv(leads: NormalizedLead[], mappings: FieldMapping[]): Promise<Uint8Array> {
    const coreHeaders = ["id", "firstName", "lastName", "email", "phone", "dateOfBirth"];
    const mappingHeaders = mappings.map((m) => m.ehrFieldPath);
    const headers = [...coreHeaders, ...mappingHeaders];

    const rows = leads.map((lead) => {
      const core = [
        lead.id,
        lead.firstName,
        lead.lastName,
        lead.email ?? "",
        lead.phone ?? "",
        lead.dateOfBirth ?? "",
      ];
      const mapped = mappings.map((m) => {
        const raw = lead.fieldValues[m.formFieldKey] ?? "";
        return applyTransform(raw, m.transform);
      });
      return [...core, ...mapped].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    return Buffer.from(csv, "utf-8");
  }
}
