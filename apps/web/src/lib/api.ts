const BASE = "/api";

export type EventStatus = "draft" | "active" | "closed" | "archived";
export type EventType =
  | "marathon"
  | "medical_conference"
  | "health_fair"
  | "corporate_event"
  | "screening"
  | "other";

export interface EventListItem {
  id: string;
  name: string;
  eventType: EventType;
  locationName?: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  status: EventStatus;
  campaignTags: string[];
  leadCount: number;
  defaultFormTemplateVersionId?: string | null;
}

export interface EventDetail {
  id: string;
  clinicId: string;
  name: string;
  eventType: EventType;
  locationName?: string | null;
  address?: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  status: EventStatus;
  campaignTags: string;
  defaultFormTemplateVersionId?: string | null;
  consentRequirements?: Array<{
    id: string;
    eventId: string;
    consentTemplateVersionId: string;
    required: boolean;
    displayOrder: number;
    consentTemplateVersion?: {
      id: string;
      versionNumber: number;
      bodyText: string;
      shortLabel: string;
      consentTemplate: { id: string; name: string; consentType: string };
    };
  }>;
}

export interface CreateEventPayload {
  name: string;
  eventType: EventType;
  locationName?: string;
  address?: string;
  startAt: string;
  endAt: string;
  timezone: string;
  campaignTags?: string[];
  defaultFormTemplateVersionId?: string;
}

export type FieldType =
  | "short_text"
  | "long_text"
  | "phone"
  | "email"
  | "address"
  | "date"
  | "date_of_birth"
  | "single_select"
  | "multi_select"
  | "checkbox"
  | "consent_checkbox"
  | "number";

export type PiiCategory = "none" | "contact" | "health" | "demographic" | "insurance";

export interface FormFieldInput {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  // Zod `.optional()` infers `T | undefined` on the output shape rather than a
  // missing property, so allow `undefined` explicitly to stay compatible with
  // exactOptionalPropertyTypes.
  helpText?: string | undefined;
  placeholder?: string | undefined;
  options?: Array<{ value: string; label: string }> | undefined;
  piiCategory: PiiCategory;
  ehrFieldPath?: string | undefined;
  ehrTransform?: "none" | "uppercase" | "date_iso" | "phone_e164" | undefined;
  ehrFallbackToNote?: boolean | undefined;
  displayOrder: number;
}

export interface FormTemplateListItem {
  id: string;
  name: string;
  createdAt: string;
  latestVersion: {
    id: string;
    versionNumber: number;
    isPublished: boolean;
    publishedAt: string | null;
    fieldCount: number;
    leadCount: number;
  } | null;
}

export interface FormTemplateVersionDetail {
  id: string;
  formTemplateId: string;
  versionNumber: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  formTemplate: { id: string; name: string; clinicId: string };
  fields: Array<FormFieldInput & { id: string; formTemplateVersionId: string }>;
}

export interface ConsentTemplateListItem {
  id: string;
  name: string;
  consentType: "contact" | "marketing" | "treatment" | "custom";
  versions: Array<{
    id: string;
    versionNumber: number;
    bodyText: string;
    shortLabel: string;
  }>;
}

export interface EventConsentRequirementPayload {
  consentTemplateVersionId: string;
  required: boolean;
  displayOrder: number;
}

let _token: string | null = localStorage.getItem("ei_token");

export function setToken(token: string) {
  _token = token;
  localStorage.setItem("ei_token", token);
}

export function clearToken() {
  _token = null;
  localStorage.removeItem("ei_token");
}

export function getToken(): string | null {
  return _token;
}

class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    if (res.status === 401) {
      clearToken();
      window.location.href = "/login";
    }
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ accessToken: string; user: { id: string; email: string; firstName: string; lastName: string; clinics: Array<{ id: string; name: string; role: string }> } }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    me: () => request<{ id: string; email: string; clinics: Array<{ id: string; name: string; role: string }> }>("/auth/me"),
  },
  events: {
    list: (clinicId: string, status?: string) =>
      request<EventListItem[]>(`/clinics/${clinicId}/events${status ? `?status=${status}` : ""}`),
    get: (id: string) => request<EventDetail>(`/events/${id}`),
    create: (clinicId: string, data: CreateEventPayload) =>
      request<EventDetail>(`/clinics/${clinicId}/events`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateEventPayload> & { status?: EventStatus }) =>
      request<EventDetail>(`/events/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    leads: (eventId: string, status?: string, page = 1) =>
      request<{ leads: unknown[]; total: number }>(`/events/${eventId}/leads?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`),
    exportCsv: (eventId: string, data: unknown) =>
      fetch(`${BASE}/events/${eventId}/export/csv`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${_token}` }, body: JSON.stringify(data) }),
  },
  formTemplates: {
    list: (clinicId: string) =>
      request<FormTemplateListItem[]>(`/clinics/${clinicId}/form-templates`),
    create: (clinicId: string, data: { name: string; fields: FormFieldInput[]; publish?: boolean }) =>
      request<{ id: string; name: string; currentVersionId: string }>(
        `/clinics/${clinicId}/form-templates`,
        { method: "POST", body: JSON.stringify(data) },
      ),
    getVersion: (versionId: string) =>
      request<FormTemplateVersionDetail>(`/form-template-versions/${versionId}`),
    publish: (templateId: string, versionId: string) =>
      request<unknown>(`/form-templates/${templateId}/versions/publish`, {
        method: "POST",
        body: JSON.stringify({ versionId }),
      }),
  },
  leads: {
    get: (id: string) => request<unknown>(`/leads/${id}`),
    approve: (id: string, note?: string) =>
      request<unknown>(`/leads/${id}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
    reject: (id: string, reason: string) =>
      request<unknown>(`/leads/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
    bulkApprove: (leadIds: string[]) =>
      request<unknown>("/leads/bulk-approve", { method: "POST", body: JSON.stringify({ leadIds }) }),
    reviewQueue: (clinicId: string, status?: string, page = 1) =>
      request<{ leads: unknown[]; total: number }>(`/clinics/${clinicId}/review-queue?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`),
    duplicates: (id: string) => request<unknown[]>(`/leads/${id}/duplicates`),
    resolveCandidate: (id: string, candidateId: string, data: unknown) =>
      request<unknown>(`/leads/${id}/duplicates/${candidateId}/resolve`, { method: "POST", body: JSON.stringify(data) }),
    copyPacket: (id: string) => request<unknown>(`/leads/${id}/copy-packet`),
    syncJobs: (id: string) => request<unknown[]>(`/leads/${id}/sync-jobs`),
    sync: (id: string, ehrConnectionId: string) =>
      request<unknown>(`/leads/${id}/sync`, { method: "POST", body: JSON.stringify({ ehrConnectionId }) }),
  },
  consent: {
    templates: (clinicId: string) =>
      request<ConsentTemplateListItem[]>(`/clinics/${clinicId}/consent-templates`),
    createTemplate: (clinicId: string, data: unknown) =>
      request<unknown>(`/clinics/${clinicId}/consent-templates`, { method: "POST", body: JSON.stringify(data) }),
    versions: (templateId: string) => request<unknown[]>(`/consent-templates/${templateId}/versions`),
    createVersion: (templateId: string, data: unknown) =>
      request<unknown>(`/consent-templates/${templateId}/versions`, { method: "POST", body: JSON.stringify(data) }),
    eventRequirements: (eventId: string) => request<unknown[]>(`/events/${eventId}/consent-requirements`),
    setEventRequirements: (eventId: string, requirements: EventConsentRequirementPayload[]) =>
      request<unknown>(`/events/${eventId}/consent-requirements`, { method: "PUT", body: JSON.stringify({ requirements }) }),
  },
  ehr: {
    connections: (clinicId: string) => request<unknown[]>(`/clinics/${clinicId}/ehr-connections`),
    mappings: (clinicId: string, connectionId?: string) =>
      request<unknown[]>(`/clinics/${clinicId}/ehr-mappings${connectionId ? `?connectionId=${connectionId}` : ""}`),
    createMapping: (clinicId: string, data: unknown) =>
      request<unknown>(`/clinics/${clinicId}/ehr-mappings`, { method: "POST", body: JSON.stringify(data) }),
    updateMapping: (id: string, data: unknown) =>
      request<unknown>(`/ehr-mappings/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteMapping: (id: string) =>
      request<void>(`/ehr-mappings/${id}`, { method: "DELETE" }),
    syncSummary: (clinicId: string) => request<unknown>(`/clinics/${clinicId}/sync-summary`),
    supportedFields: (connectionId: string) =>
      request<Array<{ path: string; label: string; type: string }>>(`/ehr-connections/${connectionId}/supported-fields`),
  },
};
