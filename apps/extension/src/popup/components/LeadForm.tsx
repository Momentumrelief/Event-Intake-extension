import { useState, useCallback } from "react";
import { FieldRenderer } from "./FieldRenderer.js";
import { ConsentBlock } from "./ConsentBlock.js";
import { submitLead } from "../../lib/api.js";
import { saveDraft, removeDraft } from "../../lib/storage.js";
import type { ApiFormTemplateVersion, ApiConsentRequirement, StoredDraft } from "../../lib/types.js";

interface Props {
  eventId: string;
  formVersion: ApiFormTemplateVersion;
  consentRequirements: ApiConsentRequirement[];
  staffUserId: string;
  onSuccess: (leadId: string, isDuplicate: boolean) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function LeadForm({ eventId, formVersion, consentRequirements, staffUserId, onSuccess }: Props) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [consentStates, setConsentStates] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftId] = useState(() => generateId());

  const setField = useCallback((fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[fieldId]; return next; });
  }, []);

  const setConsent = useCallback((versionId: string, granted: boolean) => {
    setConsentStates((prev) => ({ ...prev, [versionId]: granted }));
    setErrors((prev) => { const next = { ...prev }; delete next[`consent-${versionId}`]; return next; });
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of formVersion.fields) {
      if (field.required && !fieldValues[field.id]?.trim()) {
        newErrors[field.id] = `${field.label} is required`;
      }
    }

    for (const req of consentRequirements) {
      if (req.required && !consentStates[req.consentTemplateVersionId]) {
        newErrors[`consent-${req.consentTemplateVersionId}`] = "Required consent not granted";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getNameFieldValue = (key: string): string => {
    const field = formVersion.fields.find((f) => f.key === key);
    return field ? (fieldValues[field.id] ?? "") : "";
  };

  const handleSaveDraft = async () => {
    const draft: StoredDraft = {
      id: draftId,
      eventId,
      formTemplateVersionId: formVersion.id,
      idempotencyKey: `draft-${draftId}`,
      firstName: getNameFieldValue("first_name"),
      lastName: getNameFieldValue("last_name"),
      email: getNameFieldValue("email") || undefined,
      phone: getNameFieldValue("phone") || undefined,
      fieldValues: Object.entries(fieldValues).map(([formFieldId, value]) => ({ formFieldId, value })),
      consents: Object.entries(consentStates).map(([consentTemplateVersionId, granted]) => ({
        consentTemplateVersionId,
        granted,
        capturedAt: new Date().toISOString(),
        rawCheckboxValue: granted,
      })),
      savedAt: new Date().toISOString(),
      submitted: false,
    };
    await saveDraft(draft);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const idempotencyKey = `submit-${draftId}-${staffUserId}`;

      const payload = {
        idempotencyKey,
        eventId,
        formTemplateVersionId: formVersion.id,
        firstName: getNameFieldValue("first_name"),
        lastName: getNameFieldValue("last_name"),
        email: getNameFieldValue("email") || undefined,
        phone: getNameFieldValue("phone") || undefined,
        dateOfBirth: getNameFieldValue("date_of_birth") || undefined,
        source: undefined,
        fieldValues: Object.entries(fieldValues)
          .filter(([, v]) => v.trim())
          .map(([formFieldId, value]) => ({ formFieldId, value })),
        consents: consentRequirements.map((req) => ({
          consentTemplateVersionId: req.consentTemplateVersionId,
          granted: consentStates[req.consentTemplateVersionId] ?? false,
          capturedAt: new Date().toISOString(),
          rawCheckboxValue: consentStates[req.consentTemplateVersionId] ?? false,
        })),
      };

      // Save locally first
      await saveDraft({
        id: draftId,
        ...payload,
        firstName: payload.firstName,
        lastName: payload.lastName,
        savedAt: new Date().toISOString(),
        submitted: false,
      } as StoredDraft);

      const result = await submitLead(payload);
      await removeDraft(draftId);
      onSuccess(result.id, result.duplicateCandidateCount > 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submit failed";
      if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
        // Offline — draft already saved locally
        setSubmitError("Offline: lead saved as draft. Will sync when back online.");
        await handleSaveDraft();
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formVersion.fields.map((field) => (
        <FieldRenderer
          key={field.id}
          field={field}
          value={fieldValues[field.id] ?? ""}
          onChange={(v) => setField(field.id, v)}
          error={errors[field.id]}
        />
      ))}

      {consentRequirements.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
          <p style={styles.consentHeading}>Consents</p>
          {consentRequirements.map((req) => (
            <ConsentBlock
              key={req.consentTemplateVersionId}
              requirement={req}
              granted={consentStates[req.consentTemplateVersionId] ?? false}
              onChange={(granted) => setConsent(req.consentTemplateVersionId, granted)}
            />
          ))}
        </div>
      )}

      {submitError && (
        <div style={styles.errorBanner}>{submitError}</div>
      )}

      <div style={styles.actions}>
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={submitting}
          style={styles.secondaryBtn}
        >
          Save Draft
        </button>
        <button type="submit" disabled={submitting} style={styles.primaryBtn}>
          {submitting ? "Submitting…" : "Submit Lead"}
        </button>
      </div>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  consentHeading: { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 },
  errorBanner: { backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#991b1b", marginBottom: 10 },
  actions: { display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid #e5e7eb" },
  primaryBtn: { padding: "7px 16px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  secondaryBtn: { padding: "7px 12px", backgroundColor: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" },
};
