import { getAuth } from "./storage.js";
import type { ApiEvent, ApiFormTemplateVersion, ApiConsentRequirement } from "./types.js";

const BASE_URL = "http://localhost:3000";

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const auth = await getAuth();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(auth ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  return request<{
    accessToken: string;
    user: { id: string; email: string; firstName: string; lastName: string; clinics: Array<{ id: string; name: string; role: string }> };
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getActiveEvents(clinicId: string): Promise<ApiEvent[]> {
  return request<ApiEvent[]>(`/clinics/${clinicId}/events?status=active`);
}

export async function getFormTemplateVersion(versionId: string): Promise<ApiFormTemplateVersion> {
  return request<ApiFormTemplateVersion>(`/form-template-versions/${versionId}`);
}

export async function getConsentRequirements(eventId: string): Promise<ApiConsentRequirement[]> {
  return request<ApiConsentRequirement[]>(`/events/${eventId}/consent-requirements`);
}

export async function submitLead(data: unknown) {
  return request<{ id: string; status: string; duplicateCandidateCount: number }>("/leads", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
