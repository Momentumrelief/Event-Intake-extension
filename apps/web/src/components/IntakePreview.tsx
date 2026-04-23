import type { FormFieldInput } from "../lib/api.js";

export interface ConsentPreviewBlock {
  id: string;
  consentType: string;
  shortLabel: string;
  bodyText: string;
  required: boolean;
}

interface Props {
  eventName?: string;
  fields: FormFieldInput[];
  consents?: ConsentPreviewBlock[];
  showHeader?: boolean;
}

/**
 * Renders the intake questionnaire as event staff would see it on the booth
 * extension. Read-only — no state captured. Matches the extension's field
 * order and consent placement (consents go below all fields).
 */
export function IntakePreview({ eventName, fields, consents = [], showHeader = true }: Props) {
  const ordered = [...fields].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <div style={styles.wrap}>
      {showHeader && (
        <div style={styles.header}>
          <div style={styles.deviceLabel}>Extension preview</div>
          {eventName && <div style={styles.eventName}>{eventName}</div>}
        </div>
      )}
      {ordered.length === 0 && (
        <div style={styles.empty}>No fields yet. Add a field or pick a preset to see a preview.</div>
      )}
      {ordered.map((field) => (
        <div key={field.key + field.displayOrder} style={styles.field}>
          <label style={styles.label}>
            {field.label}
            {field.required && <span style={styles.required}> *</span>}
          </label>
          {renderControl(field)}
          {field.helpText && <div style={styles.help}>{field.helpText}</div>}
        </div>
      ))}
      {consents.length > 0 && (
        <div style={styles.consentSection}>
          <div style={styles.consentHeading}>Consents</div>
          {consents
            .slice()
            .sort((a, b) => a.consentType.localeCompare(b.consentType))
            .map((c) => (
              <label key={c.id} style={styles.consentRow}>
                <input type="checkbox" disabled style={{ marginTop: 3 }} />
                <span>
                  <span style={styles.consentLabel}>
                    {c.shortLabel}
                    {c.required && <span style={styles.required}> *</span>}
                    <span style={styles.consentType}> · {c.consentType}</span>
                  </span>
                  <div style={styles.consentBody}>{c.bodyText}</div>
                </span>
              </label>
            ))}
        </div>
      )}
      <button style={styles.submitBtn} disabled>Submit lead</button>
    </div>
  );
}

function renderControl(field: FormFieldInput): React.ReactNode {
  const base: React.CSSProperties = {
    width: "100%",
    padding: "7px 9px",
    border: "1px solid #d1d5db",
    borderRadius: 5,
    fontSize: 13,
    backgroundColor: "#fff",
  };
  switch (field.type) {
    case "long_text":
      return <textarea disabled placeholder={field.placeholder} rows={3} style={base} />;
    case "single_select":
      return (
        <select disabled style={base}>
          <option value="">Select…</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case "multi_select":
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(field.options ?? []).map((o) => (
            <label key={o.value} style={styles.chip}>
              <input type="checkbox" disabled /> {o.label}
            </label>
          ))}
          {(!field.options || field.options.length === 0) && (
            <span style={{ fontSize: 12, color: "#9ca3af" }}>(no options configured)</span>
          )}
        </div>
      );
    case "checkbox":
    case "consent_checkbox":
      return (
        <label style={styles.checkboxRow}>
          <input type="checkbox" disabled />
          <span style={{ fontSize: 13, color: "#374151" }}>{field.placeholder ?? field.label}</span>
        </label>
      );
    case "date":
    case "date_of_birth":
      return <input disabled type="date" style={base} />;
    case "number":
      return <input disabled type="number" placeholder={field.placeholder} style={base} />;
    case "email":
      return <input disabled type="email" placeholder={field.placeholder ?? "name@example.com"} style={base} />;
    case "phone":
      return <input disabled type="tel" placeholder={field.placeholder ?? "(555) 555-1234"} style={base} />;
    case "address":
      return <textarea disabled placeholder={field.placeholder ?? "Street, city, state, postal"} rows={2} style={base} />;
    case "short_text":
    default:
      return <input disabled type="text" placeholder={field.placeholder} style={base} />;
  }
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  header: { marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #f3f4f6" },
  deviceLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", fontWeight: 700 },
  eventName: { fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 2 },
  empty: { fontSize: 13, color: "#9ca3af", padding: "18px 0", textAlign: "center" },
  field: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: 600, color: "#374151" },
  required: { color: "#dc2626" },
  help: { fontSize: 11, color: "#6b7280" },
  chip: {
    display: "inline-flex",
    gap: 4,
    alignItems: "center",
    fontSize: 12,
    padding: "3px 8px",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    backgroundColor: "#f9fafb",
  },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8 },
  consentSection: { marginTop: 14, paddingTop: 12, borderTop: "1px solid #e5e7eb" },
  consentHeading: { fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 },
  consentRow: { display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10, fontSize: 12 },
  consentLabel: { fontSize: 12, fontWeight: 600, color: "#111827" },
  consentType: { color: "#9ca3af", fontWeight: 400 },
  consentBody: { fontSize: 11, color: "#6b7280", marginTop: 3, lineHeight: 1.4 },
  submitBtn: { width: "100%", marginTop: 14, padding: "8px", borderRadius: 6, border: "none", backgroundColor: "#e5e7eb", color: "#6b7280", fontSize: 13, fontWeight: 600 },
};
