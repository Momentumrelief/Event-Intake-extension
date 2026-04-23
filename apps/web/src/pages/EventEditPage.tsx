import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  api,
  type ConsentTemplateListItem,
  type CreateEventPayload,
  type EventDetail,
  type EventStatus,
  type EventType,
  type FormFieldInput,
  type FormTemplateListItem,
  type FormTemplateVersionDetail,
} from "../lib/api.js";
import { FORM_PRESETS } from "@eventintake/shared";
import { TemplateBuilder } from "../components/TemplateBuilder.js";
import { IntakePreview, type ConsentPreviewBlock } from "../components/IntakePreview.js";

interface Props {
  clinicId: string;
}

type TemplateMode = "existing" | "new";

const EVENT_TYPES: Array<{ value: EventType; label: string }> = [
  { value: "marathon", label: "Marathon / fitness event" },
  { value: "medical_conference", label: "Medical conference" },
  { value: "health_fair", label: "Health fair" },
  { value: "corporate_event", label: "Corporate / employer event" },
  { value: "screening", label: "Screening clinic" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS: EventStatus[] = ["draft", "active", "closed", "archived"];

type ConsentSelection = { versionId: string; required: boolean };

export function EventEditPage({ clinicId }: Props) {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  // Event fields
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState<EventType>("health_fair");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [timezone, setTimezone] = useState<string>(() =>
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  );
  const [campaignTagsText, setCampaignTagsText] = useState("");
  const [status, setStatus] = useState<EventStatus>("draft");

  // Template assignment
  const [templateMode, setTemplateMode] = useState<TemplateMode>("existing");
  const [existingTemplates, setExistingTemplates] = useState<FormTemplateListItem[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [existingVersionDetail, setExistingVersionDetail] = useState<FormTemplateVersionDetail | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateFields, setNewTemplateFields] = useState<FormFieldInput[]>([]);

  // Consent requirements
  const [consentTemplates, setConsentTemplates] = useState<ConsentTemplateListItem[]>([]);
  const [consentSelections, setConsentSelections] = useState<ConsentSelection[]>([]);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);

  // Async state
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load clinic-level lookups (templates, consent templates) once
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.formTemplates.list(clinicId), api.consent.templates(clinicId)])
      .then(([tmpls, consents]) => {
        if (cancelled) return;
        setExistingTemplates(tmpls);
        setConsentTemplates(consents);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load clinic data");
      });
    return () => { cancelled = true; };
  }, [clinicId]);

  // Load event in edit mode
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoading(true);
    api.events.get(id)
      .then(async (ev) => {
        if (cancelled) return;
        applyEvent(ev);
        if (ev.defaultFormTemplateVersionId) {
          setSelectedVersionId(ev.defaultFormTemplateVersionId);
          setTemplateMode("existing");
          try {
            const detail = await api.formTemplates.getVersion(ev.defaultFormTemplateVersionId);
            if (!cancelled) setExistingVersionDetail(detail);
          } catch {
            /* ignore — preview will just be empty */
          }
        }
        if (ev.consentRequirements) {
          setConsentSelections(
            ev.consentRequirements.map((r) => ({
              versionId: r.consentTemplateVersionId,
              required: r.required,
            })),
          );
        }
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load event"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  function applyEvent(ev: EventDetail) {
    setName(ev.name);
    setEventType(ev.eventType);
    setLocationName(ev.locationName ?? "");
    setAddress(ev.address ?? "");
    setStartAt(toLocalInput(ev.startAt));
    setEndAt(toLocalInput(ev.endAt));
    setTimezone(ev.timezone);
    setCampaignTagsText(parseCampaignTags(ev.campaignTags).join(", "));
    setStatus(ev.status);
  }

  // Fetch selected existing version details whenever the user picks a new one
  const loadVersion = useCallback(async (versionId: string) => {
    if (!versionId) { setExistingVersionDetail(null); return; }
    try {
      const detail = await api.formTemplates.getVersion(versionId);
      setExistingVersionDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load template version");
    }
  }, []);

  useEffect(() => {
    if (templateMode === "existing") void loadVersion(selectedVersionId);
  }, [templateMode, selectedVersionId, loadVersion]);

  function applyPreset(presetKey: string) {
    const preset = FORM_PRESETS[presetKey];
    if (!preset) return;
    setNewTemplateFields(preset.map((f, i) => ({ ...f, displayOrder: i })));
    if (!newTemplateName) {
      const pretty = presetKey.replace(/_/g, " ");
      setNewTemplateName(`${pretty.charAt(0).toUpperCase() + pretty.slice(1)} intake`);
    }
  }

  // Consent selection helpers
  function toggleConsentVersion(versionId: string) {
    setConsentSelections((prev) => {
      const found = prev.find((s) => s.versionId === versionId);
      if (found) return prev.filter((s) => s.versionId !== versionId);
      return [...prev, { versionId, required: true }];
    });
  }
  function setConsentRequired(versionId: string, required: boolean) {
    setConsentSelections((prev) =>
      prev.map((s) => (s.versionId === versionId ? { ...s, required } : s)),
    );
  }

  const previewFields: FormFieldInput[] = useMemo(() => {
    if (templateMode === "new") return newTemplateFields;
    if (existingVersionDetail) return existingVersionDetail.fields as FormFieldInput[];
    return [];
  }, [templateMode, newTemplateFields, existingVersionDetail]);

  const previewConsents: ConsentPreviewBlock[] = useMemo(() => {
    return consentSelections.flatMap((sel) => {
      const tmpl = consentTemplates.find((t) => t.versions.some((v) => v.id === sel.versionId));
      const ver = tmpl?.versions.find((v) => v.id === sel.versionId);
      if (!tmpl || !ver) return [];
      return [{
        id: sel.versionId,
        consentType: tmpl.consentType,
        shortLabel: ver.shortLabel,
        bodyText: ver.bodyText,
        required: sel.required,
      }];
    });
  }, [consentSelections, consentTemplates]);

  function validate(): string | null {
    if (!name.trim()) return "Event name is required.";
    if (!startAt || !endAt) return "Start and end dates are required.";
    if (new Date(endAt).getTime() < new Date(startAt).getTime()) return "End date must be after start date.";
    if (!timezone.trim()) return "Timezone is required.";

    if (templateMode === "existing") {
      if (!selectedVersionId) return "Pick an existing template version or build a new one.";
    } else {
      if (!newTemplateName.trim()) return "New template needs a name.";
      if (newTemplateFields.length === 0) return "New template needs at least one field.";
      const keyRe = /^[a-z_][a-z0-9_]*$/;
      const keys = new Set<string>();
      for (const f of newTemplateFields) {
        if (!keyRe.test(f.key)) return `Field key "${f.key}" must be snake_case.`;
        if (keys.has(f.key)) return `Duplicate field key "${f.key}".`;
        keys.add(f.key);
        if (!f.label.trim()) return `Field "${f.key}" needs a label.`;
        if ((f.type === "single_select" || f.type === "multi_select") && (!f.options || f.options.length === 0)) {
          return `Field "${f.key}" needs at least one option.`;
        }
      }
    }
    return null;
  }

  async function handleSave() {
    setError(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    try {
      // 1. Resolve the template version ID (create inline if needed).
      let versionId = selectedVersionId;
      if (templateMode === "new") {
        const created = await api.formTemplates.create(clinicId, {
          name: newTemplateName.trim(),
          fields: newTemplateFields,
          publish: true,
        });
        versionId = created.currentVersionId;
      }

      // 2. Create or update the event.
      const payload: CreateEventPayload = buildEventPayload({
        name,
        eventType,
        locationName,
        address,
        startAt,
        endAt,
        timezone,
        campaignTags: parseTagText(campaignTagsText),
        defaultFormTemplateVersionId: versionId,
      });

      let eventId: string;
      if (isEdit && id) {
        await api.events.update(id, { ...payload, status });
        eventId = id;
      } else {
        const created = await api.events.create(clinicId, payload);
        eventId = created.id;
      }

      // 3. Sync consent requirements (PUT replaces all — authoritative).
      await api.consent.setEventRequirements(
        eventId,
        consentSelections.map((s, i) => ({
          consentTemplateVersionId: s.versionId,
          required: s.required,
          displayOrder: i,
        })),
      );

      navigate(`/events/${eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={styles.placeholder}>Loading event…</div>;

  return (
    <div style={styles.page}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>{isEdit ? "Edit event" : "New event"}</h2>
        <div style={styles.toolbarActions}>
          <button onClick={() => setPreviewOpen(true)} style={styles.secondaryBtn}>
            Preview questionnaire
          </button>
          <button onClick={() => navigate("/events")} style={styles.cancelBtn}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={styles.primaryBtn}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create event"}
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.columns}>
        <div style={styles.mainCol}>
          <section style={styles.card}>
            <h3 style={styles.cardHeading}>Event details</h3>
            <div style={styles.grid2}>
              <Field label="Name" required>
                <input value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />
              </Field>
              <Field label="Event type" required>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  style={styles.input}
                >
                  {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Start">
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  style={styles.input}
                />
              </Field>
              <Field label="End">
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  style={styles.input}
                />
              </Field>
              <Field label="Timezone">
                <input value={timezone} onChange={(e) => setTimezone(e.target.value)} style={styles.input} />
              </Field>
              <Field label="Location name">
                <input value={locationName} onChange={(e) => setLocationName(e.target.value)} style={styles.input} />
              </Field>
              <Field label="Address" wide>
                <input value={address} onChange={(e) => setAddress(e.target.value)} style={styles.input} />
              </Field>
              <Field label="Campaign tags (comma-separated)" wide>
                <input value={campaignTagsText} onChange={(e) => setCampaignTagsText(e.target.value)} style={styles.input} />
              </Field>
              {isEdit && (
                <Field label="Status" wide>
                  <select value={status} onChange={(e) => setStatus(e.target.value as EventStatus)} style={styles.input}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHead}>
              <h3 style={styles.cardHeading}>Intake template</h3>
              <div style={styles.segmented}>
                <button
                  type="button"
                  onClick={() => setTemplateMode("existing")}
                  style={{ ...styles.segBtn, ...(templateMode === "existing" ? styles.segBtnActive : {}) }}
                >
                  Use existing
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateMode("new")}
                  style={{ ...styles.segBtn, ...(templateMode === "new" ? styles.segBtnActive : {}) }}
                >
                  Build new
                </button>
              </div>
            </div>

            {templateMode === "existing" ? (
              <>
                <Field label="Template" wide>
                  <select
                    value={selectedVersionId}
                    onChange={(e) => setSelectedVersionId(e.target.value)}
                    style={styles.input}
                  >
                    <option value="">Choose a template…</option>
                    {existingTemplates.map((t) => t.latestVersion && (
                      <option key={t.latestVersion.id} value={t.latestVersion.id}>
                        {t.name} (v{t.latestVersion.versionNumber} · {t.latestVersion.fieldCount} field{t.latestVersion.fieldCount === 1 ? "" : "s"})
                      </option>
                    ))}
                  </select>
                </Field>
                {existingVersionDetail && (
                  <div style={styles.readonlyFields}>
                    <div style={styles.readonlyHead}>
                      Fields in {existingVersionDetail.formTemplate.name} (v{existingVersionDetail.versionNumber})
                      {existingVersionDetail.isPublished ? (
                        <span style={styles.publishedPill}>published</span>
                      ) : (
                        <span style={styles.draftPill}>unpublished</span>
                      )}
                    </div>
                    <ul style={styles.fieldList}>
                      {existingVersionDetail.fields.map((f) => (
                        <li key={f.id}>
                          <strong>{f.label}</strong>{" "}
                          <span style={styles.fieldMeta}>
                            {f.type.replace(/_/g, " ")}
                            {f.required && " · required"}
                            {f.piiCategory !== "none" && ` · ${f.piiCategory}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div style={styles.readonlyNote}>
                      Existing templates are versioned and immutable once they receive leads. To change fields,
                      switch to <strong>Build new</strong> to create a new template for this event.
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <Field label="New template name" wide>
                  <input
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g., Denver Marathon 2026 intake"
                    style={styles.input}
                  />
                </Field>
                <div style={styles.presetRow}>
                  <span style={styles.presetLabel}>Start from preset:</span>
                  {Object.keys(FORM_PRESETS).map((k) => (
                    <button key={k} type="button" onClick={() => applyPreset(k)} style={styles.presetBtn}>
                      {k.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
                <TemplateBuilder fields={newTemplateFields} onChange={setNewTemplateFields} />
              </>
            )}
          </section>

          <section style={styles.card}>
            <h3 style={styles.cardHeading}>Consent requirements</h3>
            {consentTemplates.length === 0 ? (
              <div style={styles.hint}>
                No consent templates exist for this clinic yet. You can publish this event without any, then add
                them later from the consent template management screen.
              </div>
            ) : (
              <ul style={styles.consentList}>
                {consentTemplates.map((tmpl) => {
                  const [version] = tmpl.versions;
                  if (!version) return null;
                  const selection = consentSelections.find((s) => s.versionId === version.id);
                  return (
                    <li key={tmpl.id} style={styles.consentItem}>
                      <label style={styles.consentCheckRow}>
                        <input
                          type="checkbox"
                          checked={Boolean(selection)}
                          onChange={() => toggleConsentVersion(version.id)}
                        />
                        <div>
                          <div style={styles.consentName}>
                            {tmpl.name}
                            <span style={styles.consentTypePill}>{tmpl.consentType}</span>
                          </div>
                          <div style={styles.consentMeta}>v{version.versionNumber} · {version.shortLabel}</div>
                        </div>
                      </label>
                      {selection && (
                        <div style={styles.reqToggle}>
                          <label style={{ marginRight: 10 }}>
                            <input
                              type="radio"
                              checked={selection.required}
                              onChange={() => setConsentRequired(version.id, true)}
                            />{" "}
                            Required
                          </label>
                          <label>
                            <input
                              type="radio"
                              checked={!selection.required}
                              onChange={() => setConsentRequired(version.id, false)}
                            />{" "}
                            Optional
                          </label>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside style={styles.sideCol}>
          <div style={styles.sideHeading}>Live preview</div>
          <IntakePreview
            eventName={name || "New event"}
            fields={previewFields}
            consents={previewConsents}
          />
        </aside>
      </div>

      {previewOpen && (
        <div style={styles.modalBackdrop} onClick={() => setPreviewOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Questionnaire preview</h3>
              <button onClick={() => setPreviewOpen(false)} style={styles.cancelBtn}>Close</button>
            </div>
            <div style={{ padding: 20, display: "flex", justifyContent: "center", backgroundColor: "#f9fafb" }}>
              <IntakePreview
                eventName={name || "New event"}
                fields={previewFields}
                consents={previewConsents}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <label style={styles.fieldLabel}>
        {label}
        {required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function buildEventPayload(input: {
  name: string;
  eventType: EventType;
  locationName: string;
  address: string;
  startAt: string;
  endAt: string;
  timezone: string;
  campaignTags: string[];
  defaultFormTemplateVersionId: string;
}): CreateEventPayload {
  const payload: CreateEventPayload = {
    name: input.name.trim(),
    eventType: input.eventType,
    startAt: new Date(input.startAt).toISOString(),
    endAt: new Date(input.endAt).toISOString(),
    timezone: input.timezone.trim(),
    campaignTags: input.campaignTags,
    defaultFormTemplateVersionId: input.defaultFormTemplateVersionId,
  };
  const loc = input.locationName.trim();
  if (loc) payload.locationName = loc;
  const addr = input.address.trim();
  if (addr) payload.address = addr;
  return payload;
}

function parseTagText(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseCampaignTags(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "24px 32px", maxWidth: 1200, margin: "0 auto" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 10 },
  heading: { fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 },
  toolbarActions: { display: "flex", gap: 8 },
  primaryBtn: { padding: "7px 14px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  secondaryBtn: { padding: "7px 12px", backgroundColor: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#374151" },
  cancelBtn: { padding: "7px 12px", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#6b7280" },
  error: { backgroundColor: "#fef2f2", color: "#b91c1c", padding: "10px 14px", borderRadius: 6, marginBottom: 14, fontSize: 13 },
  placeholder: { padding: "40px 32px", color: "#6b7280" },
  columns: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 20, alignItems: "flex-start" },
  mainCol: { display: "flex", flexDirection: "column", gap: 16 },
  sideCol: { position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 8 },
  sideHeading: { fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb" },
  cardHeading: { fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 12px 0" },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, outline: "none" },
  segmented: { display: "flex", border: "1px solid #d1d5db", borderRadius: 6, overflow: "hidden" },
  segBtn: { border: "none", backgroundColor: "#fff", padding: "6px 12px", fontSize: 12, cursor: "pointer", color: "#4b5563" },
  segBtnActive: { backgroundColor: "#2563eb", color: "#fff", fontWeight: 600 },
  readonlyFields: { marginTop: 12, padding: 12, backgroundColor: "#f9fafb", borderRadius: 8 },
  readonlyHead: { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 },
  fieldList: { margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151", display: "flex", flexDirection: "column", gap: 3 },
  fieldMeta: { color: "#6b7280", fontSize: 12 },
  readonlyNote: { fontSize: 12, color: "#6b7280", marginTop: 10, lineHeight: 1.5 },
  publishedPill: { padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 600, backgroundColor: "#d1fae5", color: "#047857" },
  draftPill: { padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 600, backgroundColor: "#fef3c7", color: "#92400e" },
  presetRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "6px 0 14px 0" },
  presetLabel: { fontSize: 12, color: "#6b7280", fontWeight: 600 },
  presetBtn: { padding: "4px 10px", fontSize: 12, borderRadius: 999, border: "1px solid #d1d5db", backgroundColor: "#f9fafb", cursor: "pointer", textTransform: "capitalize" },
  consentList: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 },
  consentItem: { border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 },
  consentCheckRow: { display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" },
  consentName: { fontSize: 13, fontWeight: 600, color: "#111827", display: "flex", gap: 8, alignItems: "center" },
  consentTypePill: { fontSize: 10, padding: "1px 8px", borderRadius: 999, backgroundColor: "#eff6ff", color: "#1d4ed8", fontWeight: 600 },
  consentMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  reqToggle: { marginTop: 8, paddingTop: 8, borderTop: "1px solid #f3f4f6", fontSize: 12, color: "#374151" },
  hint: { fontSize: 13, color: "#6b7280", padding: "14px", backgroundColor: "#f9fafb", borderRadius: 8, lineHeight: 1.5 },
  modalBackdrop: { position: "fixed", inset: 0, backgroundColor: "rgba(17,24,39,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modal: { backgroundColor: "#fff", borderRadius: 12, maxWidth: 460, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #f3f4f6" },
};
