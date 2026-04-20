export interface StoredAuth {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    clinics: Array<{ id: string; name: string; role: string }>;
  };
}

export interface StoredDraft {
  id: string;
  eventId: string;
  formTemplateVersionId: string;
  idempotencyKey: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  source?: string;
  fieldValues: Array<{ formFieldId: string; value: string }>;
  consents: Array<{
    consentTemplateVersionId: string;
    granted: boolean;
    capturedAt: string;
    rawCheckboxValue: boolean;
  }>;
  savedAt: string;
  submitted: boolean;
}

export interface ApiEvent {
  id: string;
  name: string;
  eventType: string;
  locationName?: string;
  startAt: string;
  endAt: string;
  timezone: string;
  status: string;
  defaultFormTemplateVersionId?: string;
}

export interface ApiFormField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  helpText?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  piiCategory: string;
  displayOrder: number;
}

export interface ApiFormTemplateVersion {
  id: string;
  versionNumber: number;
  isPublished: boolean;
  fields: ApiFormField[];
}

export interface ApiConsentRequirement {
  id: string;
  eventId: string;
  consentTemplateVersionId: string;
  required: boolean;
  displayOrder: number;
  consentTemplateVersion: {
    id: string;
    bodyText: string;
    shortLabel: string;
    consentTemplate: {
      name: string;
      consentType: string;
    };
  };
}
