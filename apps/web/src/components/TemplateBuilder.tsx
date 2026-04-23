import { useMemo } from "react";
import type { FieldType, FormFieldInput, PiiCategory } from "../lib/api.js";

const FIELD_TYPES: FieldType[] = [
  "short_text",
  "long_text",
  "phone",
  "email",
  "address",
  "date",
  "date_of_birth",
  "single_select",
  "multi_select",
  "checkbox",
  "consent_checkbox",
  "number",
];

const PII_CATEGORIES: PiiCategory[] = ["none", "contact", "health", "demographic", "insurance"];

const KEY_RE = /^[a-z_][a-z0-9_]*$/;

interface Props {
  fields: FormFieldInput[];
  onChange: (next: FormFieldInput[]) => void;
  disabled?: boolean;
}

/**
 * Inline form builder for use during event setup. Enforces snake_case keys
 * (matching the shared IntakeField regex) and keeps displayOrder contiguous.
 */
export function TemplateBuilder({ fields, onChange, disabled = false }: Props) {
  const ordered = useMemo(() => [...fields].sort((a, b) => a.displayOrder - b.displayOrder), [fields]);

  function update(index: number, patch: Partial<FormFieldInput>) {
    const next = ordered.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange(renumber(next));
  }

  function updateOptional(index: number, key: "placeholder" | "helpText", value: string) {
    const next = ordered.map((f, i) => {
      if (i !== index) return f;
      const copy = { ...f };
      if (value) {
        copy[key] = value;
      } else {
        delete copy[key];
      }
      return copy;
    });
    onChange(renumber(next));
  }

  function remove(index: number) {
    onChange(renumber(ordered.filter((_, i) => i !== index)));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(renumber(next));
  }

  function add() {
    const next: FormFieldInput = {
      key: nextAvailableKey(ordered, "new_field"),
      label: "New field",
      type: "short_text",
      required: false,
      piiCategory: "none",
      displayOrder: ordered.length,
    };
    onChange([...ordered, next]);
  }

  return (
    <div style={styles.wrap}>
      {ordered.length === 0 && <div style={styles.empty}>No fields yet. Add one below or apply a preset.</div>}
      {ordered.map((f, i) => {
        const keyInvalid = !KEY_RE.test(f.key);
        const keyDuplicate = ordered.filter((x) => x.key === f.key).length > 1;
        const supportsOptions = f.type === "single_select" || f.type === "multi_select";
        return (
          <div key={i} style={styles.row}>
            <div style={styles.rowHeader}>
              <span style={styles.rowIndex}>#{i + 1}</span>
              <div style={styles.reorderBtns}>
                <button type="button" onClick={() => move(i, -1)} disabled={disabled || i === 0} style={styles.iconBtn} title="Move up">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={disabled || i === ordered.length - 1} style={styles.iconBtn} title="Move down">↓</button>
              </div>
              <button type="button" onClick={() => remove(i)} disabled={disabled} style={styles.removeBtn}>Remove</button>
            </div>

            <div style={styles.grid}>
              <div style={styles.field}>
                <label style={styles.label}>Label</label>
                <input
                  value={f.label}
                  disabled={disabled}
                  onChange={(e) => update(i, { label: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Key (machine-readable)</label>
                <input
                  value={f.key}
                  disabled={disabled}
                  onChange={(e) => update(i, { key: e.target.value })}
                  style={{
                    ...styles.input,
                    borderColor: keyInvalid || keyDuplicate ? "#dc2626" : "#d1d5db",
                  }}
                />
                {keyInvalid && <div style={styles.error}>Use snake_case letters, numbers, underscores only.</div>}
                {!keyInvalid && keyDuplicate && <div style={styles.error}>Key must be unique within the template.</div>}
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Type</label>
                <select value={f.type} disabled={disabled} onChange={(e) => update(i, { type: e.target.value as FieldType })} style={styles.input}>
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>PII category</label>
                <select value={f.piiCategory} disabled={disabled} onChange={(e) => update(i, { piiCategory: e.target.value as PiiCategory })} style={styles.input}>
                  {PII_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Placeholder</label>
                <input
                  value={f.placeholder ?? ""}
                  disabled={disabled}
                  onChange={(e) => updateOptional(i, "placeholder", e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Help text</label>
                <input
                  value={f.helpText ?? ""}
                  disabled={disabled}
                  onChange={(e) => updateOptional(i, "helpText", e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={f.required}
                disabled={disabled}
                onChange={(e) => update(i, { required: e.target.checked })}
              />
              Required
            </label>

            {supportsOptions && (
              <div style={styles.field}>
                <label style={styles.label}>Options (one per line — "value|Label" or "Value")</label>
                <textarea
                  rows={Math.max(3, (f.options ?? []).length + 1)}
                  disabled={disabled}
                  value={(f.options ?? []).map((o) => (o.value === o.label ? o.label : `${o.value}|${o.label}`)).join("\n")}
                  onChange={(e) => update(i, { options: parseOptions(e.target.value) })}
                  style={{ ...styles.input, fontFamily: "monospace", fontSize: 12 }}
                />
                {(f.options ?? []).length === 0 && (
                  <div style={styles.hint}>At least one option is required for select fields.</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button type="button" onClick={add} disabled={disabled} style={styles.addBtn}>
        + Add field
      </button>
    </div>
  );
}

function renumber(list: FormFieldInput[]): FormFieldInput[] {
  return list.map((f, i) => ({ ...f, displayOrder: i }));
}

function nextAvailableKey(fields: FormFieldInput[], base: string): string {
  if (!fields.some((f) => f.key === base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}_${i}`;
    if (!fields.some((f) => f.key === candidate)) return candidate;
  }
  return `${base}_${Date.now()}`;
}

function parseOptions(text: string): Array<{ value: string; label: string }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const sep = line.indexOf("|");
      if (sep >= 0) {
        const value = line.slice(0, sep).trim();
        const label = line.slice(sep + 1).trim();
        return { value: value || label, label: label || value };
      }
      const slug = line.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      return { value: slug || line, label: line };
    });
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: 12 },
  empty: { padding: 18, fontSize: 13, color: "#9ca3af", textAlign: "center", border: "1px dashed #d1d5db", borderRadius: 8 },
  row: { border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, backgroundColor: "#fff", display: "flex", flexDirection: "column", gap: 10 },
  rowHeader: { display: "flex", alignItems: "center", gap: 8 },
  rowIndex: { fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", flex: 1 },
  reorderBtns: { display: "flex", gap: 2 },
  iconBtn: { border: "1px solid #d1d5db", borderRadius: 5, backgroundColor: "#fff", width: 26, height: 26, cursor: "pointer", fontSize: 12, lineHeight: 1 },
  removeBtn: { border: "1px solid #fecaca", color: "#b91c1c", backgroundColor: "#fff", borderRadius: 5, padding: "3px 8px", fontSize: 12, cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { padding: "6px 9px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 13, outline: "none" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" },
  addBtn: { padding: "9px", border: "1px dashed #d1d5db", borderRadius: 8, backgroundColor: "#f9fafb", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  error: { fontSize: 11, color: "#dc2626" },
  hint: { fontSize: 11, color: "#d97706" },
};
