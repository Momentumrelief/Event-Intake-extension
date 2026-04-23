import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  type EventDetail,
  type EventStatus,
  type FormTemplateVersionDetail,
} from "../lib/api.js";
import { IntakePreview, type ConsentPreviewBlock } from "../components/IntakePreview.js";

const STATUS_COLORS: Record<EventStatus, { bg: string; fg: string }> = {
  draft: { bg: "#f3f4f6", fg: "#4b5563" },
  active: { bg: "#d1fae5", fg: "#047857" },
  closed: { bg: "#fef3c7", fg: "#92400e" },
  archived: { bg: "#e5e7eb", fg: "#6b7280" },
};

const TRANSITIONS: Array<{ from: EventStatus[]; to: EventStatus; label: string; tone: "default" | "warn" }> = [
  { from: ["draft", "closed"], to: "active", label: "Activate", tone: "default" },
  { from: ["active", "draft"], to: "closed", label: "Close", tone: "default" },
  { from: ["active", "closed"], to: "draft", label: "Move back to draft", tone: "default" },
  { from: ["draft", "closed", "active"], to: "archived", label: "Archive", tone: "warn" },
];

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [templateVersion, setTemplateVersion] = useState<FormTemplateVersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const ev = await api.events.get(id);
      setEvent(ev);
      if (ev.defaultFormTemplateVersionId) {
        const version = await api.formTemplates.getVersion(ev.defaultFormTemplateVersionId);
        setTemplateVersion(version);
      } else {
        setTemplateVersion(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(next: EventStatus, label: string) {
    if (!event || !id) return;
    if (next === "archived" && !confirm(`Archive "${event.name}"? Historical leads remain intact, but the event will be hidden from defaults.`)) return;
    setStatusBusy(true);
    try {
      await api.events.update(id, { status: next });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${label.toLowerCase()} event`);
    } finally {
      setStatusBusy(false);
    }
  }

  if (loading) return <div style={styles.placeholder}>Loading…</div>;
  if (error && !event) return <div style={{ ...styles.placeholder, color: "#b91c1c" }}>{error}</div>;
  if (!event) return null;

  const color = STATUS_COLORS[event.status];
  const campaignTags = parseCampaignTags(event.campaignTags);

  const requirementsDisplay = event.consentRequirements ?? [];
  const previewConsents: ConsentPreviewBlock[] = requirementsDisplay.flatMap((r) => {
    if (!r.consentTemplateVersion) return [];
    return [{
      id: r.id,
      consentType: r.consentTemplateVersion.consentTemplate.consentType,
      shortLabel: r.consentTemplateVersion.shortLabel,
      bodyText: r.consentTemplateVersion.bodyText,
      required: r.required,
    }];
  });

  const transitions = TRANSITIONS.filter((t) => t.from.includes(event.status));

  return (
    <div style={styles.page}>
      <div style={styles.crumbs}>
        <Link to="/events" style={styles.crumbLink}>Events</Link>
        <span style={{ color: "#9ca3af" }}>/</span>
        <span>{event.name}</span>
      </div>

      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <h2 style={styles.heading}>{event.name}</h2>
            <span style={{ ...styles.badge, backgroundColor: color.bg, color: color.fg }}>{event.status}</span>
          </div>
          <div style={styles.metaRow}>
            <Meta label="Type" value={event.eventType.replace(/_/g, " ")} />
            <Meta label="Dates" value={formatDateRange(event.startAt, event.endAt)} />
            <Meta label="Timezone" value={event.timezone} />
            {event.locationName && <Meta label="Location" value={event.locationName} />}
          </div>
        </div>
        <div style={styles.actions}>
          <button onClick={() => navigate(`/events/${event.id}/edit`)} style={styles.primaryBtn}>Edit</button>
          {transitions.map((t) => (
            <button
              key={t.to}
              onClick={() => changeStatus(t.to, t.label)}
              disabled={statusBusy}
              style={t.tone === "warn" ? styles.warnBtn : styles.secondaryBtn}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        <section style={styles.card}>
          <h3 style={styles.cardHeading}>Overview</h3>
          <dl style={styles.descList}>
            <Term term="Location" detail={event.locationName ?? "—"} />
            <Term term="Address" detail={event.address ?? "—"} />
            <Term
              term="Campaign tags"
              detail={campaignTags.length > 0 ? campaignTags.join(", ") : "—"}
            />
          </dl>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHead}>
            <h3 style={styles.cardHeading}>Assigned form template</h3>
            {templateVersion && (
              <span style={styles.versionPill}>
                v{templateVersion.versionNumber}
                {templateVersion.isPublished ? " · published" : " · unpublished"}
              </span>
            )}
          </div>
          {!templateVersion ? (
            <div style={styles.warning}>
              No form template is assigned. Staff cannot capture leads for this event until one is set.
              <div style={{ marginTop: 8 }}>
                <button onClick={() => navigate(`/events/${event.id}/edit`)} style={styles.secondaryBtn}>
                  Assign a template
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={styles.templateName}>{templateVersion.formTemplate.name}</div>
              <ul style={styles.fieldList}>
                {templateVersion.fields
                  .slice()
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((f) => (
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
            </>
          )}
        </section>

        <section style={styles.card}>
          <h3 style={styles.cardHeading}>Consent requirements</h3>
          {requirementsDisplay.length === 0 ? (
            <div style={styles.muted}>No consent requirements configured for this event.</div>
          ) : (
            <ul style={styles.consentList}>
              {requirementsDisplay.map((r) => r.consentTemplateVersion && (
                <li key={r.id} style={styles.consentItem}>
                  <div>
                    <div style={styles.consentName}>
                      {r.consentTemplateVersion.consentTemplate.name}
                      <span style={styles.typePill}>{r.consentTemplateVersion.consentTemplate.consentType}</span>
                      {r.required ? (
                        <span style={styles.requiredPill}>required</span>
                      ) : (
                        <span style={styles.optionalPill}>optional</span>
                      )}
                    </div>
                    <div style={styles.consentMeta}>
                      v{r.consentTemplateVersion.versionNumber} · {r.consentTemplateVersion.shortLabel}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside style={styles.previewCol}>
          <div style={styles.sideHeading}>Extension preview</div>
          <IntakePreview
            eventName={event.name}
            fields={templateVersion ? (templateVersion.fields as never) : []}
            consents={previewConsents}
          />
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", marginRight: 24 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#111827", textTransform: "capitalize" }}>{value}</span>
    </span>
  );
}

function Term({ term, detail }: { term: string; detail: string }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 13, padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
      <dt style={{ width: 130, color: "#6b7280", fontWeight: 600 }}>{term}</dt>
      <dd style={{ color: "#111827", margin: 0 }}>{detail}</dd>
    </div>
  );
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };
  if (sameDay) return `${start.toLocaleString(undefined, fmt)} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  return `${start.toLocaleString(undefined, fmt)} → ${end.toLocaleString(undefined, fmt)}`;
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

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "24px 32px", maxWidth: 1200, margin: "0 auto" },
  placeholder: { padding: "40px 32px", color: "#6b7280" },
  crumbs: { display: "flex", gap: 8, fontSize: 12, color: "#6b7280", marginBottom: 10 },
  crumbLink: { color: "#6b7280", textDecoration: "none" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 20, flexWrap: "wrap" },
  titleRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  heading: { fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 },
  badge: { display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: "capitalize" },
  metaRow: { display: "flex", flexWrap: "wrap" },
  actions: { display: "flex", flexWrap: "wrap", gap: 8 },
  primaryBtn: { padding: "7px 14px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  secondaryBtn: { padding: "7px 12px", backgroundColor: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#374151" },
  warnBtn: { padding: "7px 12px", backgroundColor: "#fff", border: "1px solid #fecaca", borderRadius: 6, fontSize: 13, cursor: "pointer", color: "#b91c1c" },
  error: { backgroundColor: "#fef2f2", color: "#b91c1c", padding: "10px 14px", borderRadius: 6, marginBottom: 14, fontSize: 13 },
  grid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 380px", gap: 16, alignItems: "flex-start" },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb", gridColumn: "span 1" },
  cardHeading: { fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 10px 0" },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  versionPill: { fontSize: 11, padding: "2px 8px", borderRadius: 999, backgroundColor: "#eff6ff", color: "#1d4ed8", fontWeight: 600 },
  templateName: { fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 8 },
  fieldList: { margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151", display: "flex", flexDirection: "column", gap: 3 },
  fieldMeta: { color: "#6b7280", fontSize: 12 },
  consentList: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 },
  consentItem: { border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 },
  consentName: { fontSize: 13, fontWeight: 600, color: "#111827", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  consentMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  typePill: { fontSize: 10, padding: "1px 7px", borderRadius: 999, backgroundColor: "#eff6ff", color: "#1d4ed8", fontWeight: 600 },
  requiredPill: { fontSize: 10, padding: "1px 7px", borderRadius: 999, backgroundColor: "#fee2e2", color: "#b91c1c", fontWeight: 600 },
  optionalPill: { fontSize: 10, padding: "1px 7px", borderRadius: 999, backgroundColor: "#f3f4f6", color: "#6b7280", fontWeight: 600 },
  warning: { fontSize: 13, color: "#92400e", backgroundColor: "#fef3c7", padding: "10px 12px", borderRadius: 8, lineHeight: 1.5 },
  descList: { margin: 0 },
  muted: { color: "#9ca3af", fontSize: 13 },
  previewCol: { position: "sticky", top: 80, display: "flex", flexDirection: "column", gap: 8 },
  sideHeading: { fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" },
};
