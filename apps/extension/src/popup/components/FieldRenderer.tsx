import { type ApiFormField } from "../../lib/types.js";

interface Props {
  field: ApiFormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function FieldRenderer({ field, value, onChange, error }: Props) {
  const id = `field-${field.id}`;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    border: `1px solid ${error ? "#f87171" : "#d1d5db"}`,
    borderRadius: 6,
    fontSize: 13,
    boxSizing: "border-box",
    backgroundColor: "#fff",
  };

  let input: React.ReactNode;

  if (field.type === "single_select" && field.options) {
    input = (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        style={inputStyle}
      >
        <option value="">{field.placeholder ?? "Select…"}</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "multi_select" && field.options) {
    const selected = value ? value.split(",") : [];
    input = (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {field.options.map((o) => (
          <label key={o.value} style={{ display: "flex", gap: 6, fontSize: 12, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, o.value]
                  : selected.filter((v) => v !== o.value);
                onChange(next.join(","));
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  } else if (field.type === "checkbox") {
    input = (
      <label style={{ display: "flex", gap: 8, fontSize: 12, alignItems: "center", cursor: "pointer" }}>
        <input
          type="checkbox"
          id={id}
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
        {field.placeholder ?? field.label}
      </label>
    );
  } else if (field.type === "long_text") {
    input = (
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        rows={3}
        style={{ ...inputStyle, resize: "vertical" }}
      />
    );
  } else if (field.type === "date" || field.type === "date_of_birth") {
    input = (
      <input
        type="date"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        style={inputStyle}
      />
    );
  } else if (field.type === "number") {
    input = (
      <input
        type="number"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        style={inputStyle}
      />
    );
  } else {
    // short_text, phone, email, address
    input = (
      <input
        type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        style={inputStyle}
        autoComplete={field.type === "email" ? "email" : field.type === "phone" ? "tel" : undefined}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <div style={{ marginBottom: 10 }}>
        {input}
        {error && <p style={styles.error}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <label htmlFor={id} style={styles.label}>
        {field.label}
        {field.required && <span style={styles.required}>*</span>}
      </label>
      {field.helpText && <p style={styles.hint}>{field.helpText}</p>}
      {input}
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  label: { display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 3 },
  required: { color: "#ef4444", marginLeft: 2 },
  hint: { fontSize: 11, color: "#6b7280", marginBottom: 3 },
  error: { fontSize: 11, color: "#ef4444", marginTop: 2 },
};
