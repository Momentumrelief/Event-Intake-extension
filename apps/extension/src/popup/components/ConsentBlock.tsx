import { type ApiConsentRequirement } from "../../lib/types.js";

interface Props {
  requirement: ApiConsentRequirement;
  granted: boolean;
  onChange: (granted: boolean) => void;
}

export function ConsentBlock({ requirement, granted, onChange }: Props) {
  const { consentTemplateVersion: version } = requirement;
  const isRequired = requirement.required;

  return (
    <div style={{ ...styles.block, borderColor: isRequired && !granted ? "#f87171" : "#e5e7eb" }}>
      <div style={styles.typeTag}>
        {version.consentTemplate.consentType.toUpperCase()}
        {isRequired && <span style={styles.required}>*</span>}
      </div>
      <p style={styles.body}>{version.bodyText}</p>
      <label style={styles.checkRow}>
        <input
          type="checkbox"
          checked={granted}
          onChange={(e) => onChange(e.target.checked)}
          style={styles.checkbox}
          required={isRequired}
        />
        <span style={styles.checkLabel}>{version.shortLabel}</span>
      </label>
      {isRequired && !granted && (
        <p style={styles.errorHint}>This consent is required to submit.</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  block: { border: "1px solid", borderRadius: 6, padding: "10px 12px", marginBottom: 8, backgroundColor: "#fafafa" },
  typeTag: { fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 6, letterSpacing: "0.08em" },
  required: { color: "#ef4444", marginLeft: 2 },
  body: { fontSize: 11, color: "#374151", lineHeight: 1.5, marginBottom: 8, maxHeight: 80, overflowY: "auto" },
  checkRow: { display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" },
  checkbox: { marginTop: 2, flexShrink: 0 },
  checkLabel: { fontSize: 12, color: "#111827", fontWeight: 500 },
  errorHint: { fontSize: 11, color: "#ef4444", marginTop: 4 },
};
