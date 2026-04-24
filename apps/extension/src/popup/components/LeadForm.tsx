import { useState, useCallback, useRef } from "react";
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
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [draftId] = useState(() => generateId());
  const formRef = useRef<HTMLFormElement | null>(null);

  const setField = useCallback((fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[fieldId]; return next; });
    setSubmitError(null);
    setInfoMessage(null);
  }, []);

  const setConsent = useCallback((versionId: string, granted: boolean) => {
    setConsentStates((prev) => ({ ...prev, [versionId]: granted }));
    setErrors((prev) => { const next = { ...prev }; delete next[`consent-${versionId}`]; return next; });
    setSubmitError(null);
    setInfoMessage(null);
  }, []);

  const getMissingRequiredLabels = (): string[] => {
    const missingFields = formVersion.fields
      .filter((field) => field.required && !fieldValues[field.id]?.trim())
      .map((field) => field.label);
    const missingConsents = consentRequirements
      .filter((req) => req.required && !consentStates[req.consentTemplateVersionId])
      .map((req) => req.consentTemplateVersion.shortLabel);
    return [...missingFields, ...missingConsents];
  };

  const focusFirstError = (nextErrors: Record<string, string>) => {
    const [firstErrorKey] = Object.keys(nextErrors);
    if (!firstErrorKey) return;

    const targetId = firstErrorKey.startsWith("consent-") ? firstErrorKey : `field-${firstErrorKey}`;
    const target = formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus();
  };

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
    if (Object.keys(newErrors).length > 0) {
      setSubmitError("Complete the required items before submitting.");
      setTimeout(() => focusFirstError(newErrors), 0);
    }
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
      ...(getNameFieldValue("email") ? { email: getNameFieldValue("email") } : {}),
      ...(getNameFieldValue("phone") ? { phone: getNameFieldValue("phone") } : {}),
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
    setSubmitError(null);
    setInfoMessage("Draft saved locally.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);
    setInfoMessage(null);

    try {
      const idempotencyKey = `submit-${draftId}-${staffUserId}`;
      const email = getNameFieldValue("email");
      const phone = getNameFieldValue("phone");
      const dateOfBirth = getNameFieldValue("date_of_birth");

      const payload = {
        idempotencyKey,
        eventId,
        formTemplateVersionId: formVersion.id,
        firstName: getNameFieldValue("first_name"),
        lastName: getNameFieldValue("last_name"),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(dateOfBirth ? { dateOfBirth } : {}),
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
      try {
        const draft: StoredDraft = {
          id: draftId,
          eventId,
          formTemplateVersionId: formVersion.id,
          idempotencyKey,
          firstName: payload.firstName,
          lastName: payload.lastName,
          ...(payload.email ? { email: payload.email } : {}),
          ...(payload.phone ? { phone: payload.phone } : {}),
          ...(payload.dateOfBirth ? { dateOfBirth: payload.dateOfBirth } : {}),
          savedAt: new Date().toISOString(),
          fieldValues: payload.fieldValues,
          consents: payload.consents,
          submitted: false,
        };
        await saveDraft(draft);
      } catch (draftError) {
        console.error("Failed to save draft before submit", draftError);
      }

      const result = await submitLead(payload);
      await removeDraft(draftId);
      onSuccess(result.id, result.duplicateCandidateCount > 0);
    } catch (err) {
      console.error("Lead submission failed", err);
      const message = err instanceof Error ? err.message : "Submit failed";
      if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
        await handleSaveDraft();
        setInfoMessage("Offline — lead saved locally. Reopen the popup when the API is reachable to retry.");
        setSubmitError(`Could not reach the API at http://localhost:3000. Confirm 'pnpm --filter api dev' is running, then click Submit Lead again.`);
      } else {
        setSubmitError(`Submit failed: ${message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const missingLabels = getMissingRequiredLabels();
  const submitLabel = submitting
    ? "Submitting…"
    : missingLabels.length > 0
      ? `Submit Lead (${missingLabels.length} missing)`
      : "Submit Lead";

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate style={styles.form}>
      <div style={styles.scrollArea}>
        {formVersion.fields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={fieldValues[field.id] ?? ""}
            onChange={(v) => setField(field.id, v)}
            {...(errors[field.id] ? { error: errors[field.id] } : {})}
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
                {...(errors[`consent-${req.consentTemplateVersionId}`]
                  ? { error: errors[`consent-${req.consentTemplateVersionId}`] }
                  : {})}
              />
            ))}
          </div>
        )}
      </div>

      <div style={styles.footer}>
        {missingLabels.length > 0 && (
          <div style={styles.validationSummary}>
            <strong>{missingLabels.length} required item{missingLabels.length === 1 ? "" : "s"} left:</strong>{" "}
            {missingLabels.join(", ")}
          </div>
        )}

        {submitError && (
          <div style={styles.errorBanner} role="alert">{submitError}</div>
        )}

        {infoMessage && !submitError && (
          <div style={styles.infoBanner}>{infoMessage}</div>
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
          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.primaryBtn,
              ...(missingLabels.length > 0 ? styles.primaryBtnBlocked : null),
            }}
            title={missingLabels.length > 0 ? `Missing: ${missingLabels.join(", ")}` : "Submit lead"}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 },
  scrollArea: { flex: 1, overflowY: "auto", padding: "10px 14px 4px" },
  footer: { borderTop: "1px solid #e5e7eb", padding: "8px 14px 10px", backgroundColor: "#fff", boxShadow: "0 -4px 8px -6px rgba(15, 23, 42, 0.18)", flexShrink: 0 },
  consentHeading: { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 },
  validationSummary: { backgroundColor: "#fff7ed", border: "1px solid #fdba74", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#9a3412", marginBottom: 8 },
  errorBanner: { backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#991b1b", marginBottom: 8 },
  infoBanner: { backgroundColor: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#065f46", marginBottom: 8 },
  actions: { display: "flex", gap: 8, justifyContent: "flex-end" },
  primaryBtn: { padding: "8px 16px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  primaryBtnBlocked: { backgroundColor: "#9ca3af" },
  secondaryBtn: { padding: "8px 12px", backgroundColor: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" },
};
