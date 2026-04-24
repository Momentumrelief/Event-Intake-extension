import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  type LeadDetail,
  type LeadStatus,
  type DuplicateCandidateDetail,
  type LeadFieldValueDetail,
} from "../lib/api.js";

const STATUS_COLORS: Record<LeadStatus, { bg: string; fg: string }> = {
  draft: { bg: "#f3f4f6", fg: "#4b5563" },
  submitted: { bg: "#dbeafe", fg: "#1e40af" },
  needs_review: { bg: "#fef3c7", fg: "#92400e" },
  ready: { bg: "#d1fae5", fg: "#047857" },
  sync_queued: { bg: "#e0e7ff", fg: "#3730a3" },
  syncing: { bg: "#e0e7ff", fg: "#3730a3" },
  synced: { bg: "#d1fae5", fg: "#047857" },
  sync_failed: { bg: "#fee2e2", fg: "#991b1b" },
  sync_rejected: { bg: "#fee2e2", fg: "#991b1b" },
  exported: { bg: "#f3f4f6", fg: "#4b5563" },
  archived: { bg: "#e5e7eb", fg: "#6b7280" },
};

const CONSENT_TYPE_LABEL: Record<string, string> = {
  contact: "Contact",
  marketing: "Marketing",
  treatment: "Treatment",
  custom: "Custom",
};

const APPROVABLE_STATUSES: LeadStatus[] = ["submitted", "needs_review", "sync_failed", "sync_rejected"];
const REJECTABLE_STATUSES: LeadStatus[] = ["submitted", "needs_review", "ready", "sync_failed", "sync_rejected"];

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const l = await api.leads.get(id);
      setLead(l);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleApprove() {
    if (!id || !lead) return;
    setActionBusy(true);
    setActionMsg(null);
    try {
      await api.leads.approve(id);
      setActionMsg("Lead approved — now ready for EHR sync.");
      await load();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReject() {
    if (!id || !lead) return;
    const reason = window.prompt("Rejection reason (required):");
    if (!reason || !reason.trim()) return;
    setActionBusy(true);
    setActionMsg(null);
    try {
      await api.leads.reject(id, reason.trim());
      setActionMsg("Lead rejected and archived.");
      await load();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleResolveDuplicate(
    candidate: DuplicateCandidateDetail,
    resolution: "dismissed" | "new_record",
  ) {
    if (!id) return;
    const prompts: Record<typeof resolution, string> = {
      dismissed: "Dismiss this candidate? The lead will be treated as a different person than the match.",
      new_record: "Mark this lead as a new record? A new EHR patient will be created even though a candidate match exists.",
    };
    if (!window.confirm(prompts[resolution])) return;
    setResolvingId(candidate.id);
    setActionMsg(null);
    try {
      await api.leads.resolveCandidate(id, candidate.id, { status: resolution });
      await load();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Resolution failed");
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) return <div style={styles.placeholder}>Loading…</div>;
  if (error && !lead) {
    return (
      <div style={{ ...styles.placeholder, color: "#b91c1c" }}>
        {error}
        <div style={{ marginTop: 12 }}>
          <button style={styles.secondaryBtn} onClick={() => navigate("/review")}>← Back to Review Queue</button>
        </div>
      </div>
    );
  }
  if (!lead) return null;

  const statusColor = STATUS_COLORS[lead.status] ?? { bg: "#f3f4f6", fg: "#4b5563" };
  const pendingDuplicates = lead.duplicates.filter((d) => d.status === "pending").length;
  const canApprove = APPROVABLE_STATUSES.includes(lead.status) && pendingDuplicates === 0;
  const canReject = REJECTABLE_STATUSES.includes(lead.status);

  const contactFieldKeys = new Set(["first_name", "last_name", "email", "phone", "date_of_birth"]);
  const nonContactFieldValues = lead.fieldValues.filter(
    (fv) => !contactFieldKeys.has(fv.formField.key),
  );
  const orderedFieldValues = [...nonContactFieldValues].sort(
    (a, b) => a.formField.displayOrder - b.formField.displayOrder,
  );

  return (
    <div style={styles.page}>
      <div style={styles.breadcrumb}>
        <Link to="/review" style={styles.breadcrumbLink}>← Review Queue</Link>
      </div>

      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{lead.firstName} {lead.lastName}</h2>
          <div style={styles.subMeta}>
            <span style={{ ...styles.badge, backgroundColor: statusColor.bg, color: statusColor.fg }}>
              {lead.status}
            </span>
            <span style={styles.subMetaText}>
              Captured {new Date(lead.createdAt).toLocaleString()} at{" "}
              <Link to={`/events/${lead.event.id}`} style={styles.inlineLink}>{lead.event.name}</Link>
            </span>
          </div>
        </div>
        <div style={styles.actions}>
          <button
            onClick={handleApprove}
            disabled={!canApprove || actionBusy}
            style={{ ...styles.primaryBtn, ...(canApprove ? {} : styles.disabledBtn) }}
            title={
              canApprove
                ? "Approve this lead for EHR sync"
                : pendingDuplicates > 0
                  ? "Resolve all pending duplicate candidates first"
                  : `Cannot approve a lead in status "${lead.status}"`
            }
          >
            Approve
          </button>
          <button
            onClick={handleReject}
            disabled={!canReject || actionBusy}
            style={{ ...styles.dangerBtn, ...(canReject ? {} : styles.disabledBtn) }}
          >
            Reject
          </button>
        </div>
      </div>

      {actionMsg && <div style={styles.actionMsg}>{actionMsg}</div>}

      <div style={styles.grid}>
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Identity & contact</h3>
          <dl style={styles.dl}>
            <dt style={styles.dt}>Name</dt>
            <dd style={styles.dd}>{lead.firstName} {lead.lastName}</dd>
            <dt style={styles.dt}>Email</dt>
            <dd style={styles.dd}>{lead.email ?? <span style={styles.muted}>—</span>}</dd>
            <dt style={styles.dt}>Phone</dt>
            <dd style={styles.dd}>{lead.phone ?? <span style={styles.muted}>—</span>}</dd>
            <dt style={styles.dt}>Date of birth</dt>
            <dd style={styles.dd}>{lead.dateOfBirth ? new Date(lead.dateOfBirth).toLocaleDateString() : <span style={styles.muted}>—</span>}</dd>
            <dt style={styles.dt}>Source</dt>
            <dd style={styles.dd}>{lead.source ?? <span style={styles.muted}>—</span>}</dd>
            {lead.approvedAt && (
              <>
                <dt style={styles.dt}>Approved</dt>
                <dd style={styles.dd}>{new Date(lead.approvedAt).toLocaleString()}</dd>
              </>
            )}
            {lead.rejectionReason && (
              <>
                <dt style={styles.dt}>Rejected</dt>
                <dd style={styles.dd}>{lead.rejectionReason}</dd>
              </>
            )}
          </dl>
        </section>

        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Submitted fields <span style={styles.countBadge}>{orderedFieldValues.length}</span></h3>
          {orderedFieldValues.length === 0 ? (
            <p style={styles.muted}>No additional fields submitted beyond identity/contact.</p>
          ) : (
            <dl style={styles.dl}>
              {orderedFieldValues.map((fv) => (
                <FieldRow key={fv.id} value={fv} />
              ))}
            </dl>
          )}
        </section>

        <section style={{ ...styles.card, gridColumn: "1 / -1" }}>
          <h3 style={styles.cardTitle}>Consents <span style={styles.countBadge}>{lead.consents.length}</span></h3>
          {lead.consents.length === 0 ? (
            <p style={styles.muted}>No consent records on file. Required consents must be captured before approval.</p>
          ) : (
            <table style={styles.innerTable}>
              <thead>
                <tr>
                  <th style={styles.innerTh}>Type</th>
                  <th style={styles.innerTh}>Short label</th>
                  <th style={styles.innerTh}>Granted</th>
                  <th style={styles.innerTh}>Captured at</th>
                  <th style={styles.innerTh}>Version</th>
                </tr>
              </thead>
              <tbody>
                {lead.consents.map((c) => (
                  <tr key={c.id}>
                    <td style={styles.innerTd}>
                      <span style={styles.consentTypeTag}>
                        {CONSENT_TYPE_LABEL[c.consentTemplateVersion.consentTemplate.consentType] ?? c.consentTemplateVersion.consentTemplate.consentType}
                      </span>
                    </td>
                    <td style={styles.innerTd}>{c.consentTemplateVersion.shortLabel}</td>
                    <td style={styles.innerTd}>
                      <span style={{ ...styles.grantedPill, backgroundColor: c.granted ? "#d1fae5" : "#fee2e2", color: c.granted ? "#047857" : "#991b1b" }}>
                        {c.granted ? "Yes" : "No"}
                      </span>
                    </td>
                    <td style={styles.innerTd}>{new Date(c.capturedAt).toLocaleString()}</td>
                    <td style={styles.innerTd}>v{c.consentTemplateVersion.versionNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section style={{ ...styles.card, gridColumn: "1 / -1" }}>
          <h3 style={styles.cardTitle}>
            Duplicate candidates <span style={styles.countBadge}>{lead.duplicates.length}</span>
            {pendingDuplicates > 0 && (
              <span style={styles.pendingPill}>{pendingDuplicates} pending</span>
            )}
          </h3>
          {lead.duplicates.length === 0 ? (
            <p style={styles.muted}>No duplicate candidates detected.</p>
          ) : (
            <div style={styles.duplicateList}>
              {lead.duplicates.map((d) => (
                <DuplicateRow
                  key={d.id}
                  candidate={d}
                  busy={resolvingId === d.id}
                  onResolve={handleResolveDuplicate}
                />
              ))}
            </div>
          )}
          <p style={styles.footnote}>
            Merge flow (picking a surviving record) is not wired in this view yet. Use Dismiss or Mark as new record for now.
          </p>
        </section>

        <section style={{ ...styles.card, gridColumn: "1 / -1" }}>
          <h3 style={styles.cardTitle}>EHR sync history</h3>
          {lead.ehrPatientRef && (
            <div style={styles.syncedBanner}>
              Synced to <strong>{lead.ehrPatientRef.ehrProvider}</strong> — patient{" "}
              <code>{lead.ehrPatientRef.ehrPatientId}</code>
              {" · "}
              <span style={styles.muted}>
                recorded {new Date(lead.ehrPatientRef.createdAt).toLocaleString()}
              </span>
            </div>
          )}
          {lead.syncJobs.length === 0 ? (
            <p style={styles.muted}>
              {lead.ehrPatientRef
                ? "No retryable sync jobs on record — this lead's EHR reference was created directly."
                : "No sync attempts yet."}
            </p>
          ) : (
            <table style={styles.innerTable}>
              <thead>
                <tr>
                  <th style={styles.innerTh}>Status</th>
                  <th style={styles.innerTh}>Attempt</th>
                  <th style={styles.innerTh}>Last attempt</th>
                  <th style={styles.innerTh}>Error</th>
                  <th style={styles.innerTh}>EHR patient</th>
                </tr>
              </thead>
              <tbody>
                {lead.syncJobs.map((j) => (
                  <tr key={j.id}>
                    <td style={styles.innerTd}>
                      <span style={styles.syncStatusPill}>{j.status}</span>
                    </td>
                    <td style={styles.innerTd}>{j.attemptCount} / {j.maxAttempts}</td>
                    <td style={styles.innerTd}>
                      {j.lastAttemptedAt ? new Date(j.lastAttemptedAt).toLocaleString() : <span style={styles.muted}>—</span>}
                    </td>
                    <td style={styles.innerTd}>
                      {j.errorMessage ? (
                        <span style={styles.errorText}>{j.errorCode ?? ""} {j.errorMessage}</span>
                      ) : <span style={styles.muted}>—</span>}
                    </td>
                    <td style={styles.innerTd}>{j.ehrPatientId ?? <span style={styles.muted}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function FieldRow({ value }: { value: LeadFieldValueDetail }) {
  const displayValue = renderFieldValue(value);
  return (
    <>
      <dt style={styles.dt}>
        {value.formField.label}
        {value.formField.required && <span style={styles.requiredMark}>*</span>}
        <span style={styles.fieldTypeTag}>{value.formField.type}</span>
      </dt>
      <dd style={styles.dd}>{displayValue}</dd>
    </>
  );
}

function renderFieldValue(value: LeadFieldValueDetail): React.ReactNode {
  const raw = value.value;
  if (!raw) return <span style={styles.muted}>—</span>;

  if (value.formField.type === "single_select" || value.formField.type === "multi_select") {
    const options = parseOptions(value.formField.options);
    if (value.formField.type === "multi_select") {
      const parts = safeParseJson<string[]>(raw) ?? [raw];
      const labels = parts.map((v) => options.find((o) => o.value === v)?.label ?? v);
      return labels.join(", ");
    }
    return options.find((o) => o.value === raw)?.label ?? raw;
  }

  if (value.formField.type === "checkbox" || value.formField.type === "consent_checkbox") {
    return raw === "true" ? "Yes" : raw === "false" ? "No" : raw;
  }

  if (value.formField.type === "long_text") {
    return <span style={styles.longText}>{raw}</span>;
  }

  return raw;
}

function parseOptions(json: string | null): Array<{ value: string; label: string }> {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed as Array<{ value: string; label: string }>;
  } catch {
    // fall through
  }
  return [];
}

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseMatchReason(raw: string): string[] {
  const parsed = safeParseJson<unknown>(raw);
  if (Array.isArray(parsed)) return parsed.map(String);
  return [raw];
}

function DuplicateRow({
  candidate,
  busy,
  onResolve,
}: {
  candidate: DuplicateCandidateDetail;
  busy: boolean;
  onResolve: (c: DuplicateCandidateDetail, r: "dismissed" | "new_record") => void;
}) {
  const reasons = parseMatchReason(candidate.matchReason);
  const scorePct = Math.round(candidate.matchScore * 100);
  const isResolved = candidate.status !== "pending";
  const typeLabel = candidate.candidateType === "internal_lead" ? "Internal lead" : "EHR patient";

  return (
    <div style={styles.duplicateRow}>
      <div style={styles.duplicateRowHead}>
        <div>
          <span style={styles.duplicateType}>{typeLabel}</span>
          <code style={styles.duplicateRef}>{candidate.candidateRef}</code>
        </div>
        <div style={styles.duplicateMeta}>
          <span style={styles.scoreBadge}>{scorePct}% match</span>
          <span style={{ ...styles.duplicateStatus, backgroundColor: isResolved ? "#e5e7eb" : "#fef3c7", color: isResolved ? "#4b5563" : "#92400e" }}>
            {candidate.status}
          </span>
        </div>
      </div>
      <div style={styles.duplicateReasons}>
        {reasons.map((r) => (
          <span key={r} style={styles.reasonChip}>{r}</span>
        ))}
      </div>
      {isResolved ? (
        <p style={styles.duplicateFootnote}>
          Resolved{candidate.resolvedAt ? ` ${new Date(candidate.resolvedAt).toLocaleString()}` : ""}
          {candidate.resolutionNote ? ` — ${candidate.resolutionNote}` : ""}
        </p>
      ) : (
        <div style={styles.duplicateActions}>
          <button
            onClick={() => onResolve(candidate, "dismissed")}
            disabled={busy}
            style={styles.secondaryBtn}
          >
            Dismiss
          </button>
          <button
            onClick={() => onResolve(candidate, "new_record")}
            disabled={busy}
            style={styles.secondaryBtn}
          >
            Mark as new record
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "20px 32px 40px", maxWidth: 1100, margin: "0 auto" },
  breadcrumb: { marginBottom: 10 },
  breadcrumbLink: { fontSize: 13, color: "#2563eb", textDecoration: "none" },
  inlineLink: { color: "#2563eb", textDecoration: "none" },
  placeholder: { padding: "40px 32px", color: "#6b7280", fontSize: 14 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 6 },
  subMeta: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  subMetaText: { fontSize: 13, color: "#6b7280" },
  badge: { display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.03em" },
  actions: { display: "flex", gap: 8 },
  primaryBtn: { padding: "8px 14px", backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  dangerBtn: { padding: "8px 14px", backgroundColor: "#fff", color: "#b91c1c", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  secondaryBtn: { padding: "6px 12px", backgroundColor: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12, cursor: "pointer" },
  disabledBtn: { opacity: 0.45, cursor: "not-allowed" },
  actionMsg: { backgroundColor: "#ecfeff", border: "1px solid #a5f3fc", color: "#155e75", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 14 },
  grid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 },
  card: { backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px 18px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 },
  countBadge: { display: "inline-block", backgroundColor: "#f3f4f6", color: "#6b7280", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 600 },
  pendingPill: { marginLeft: "auto", backgroundColor: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 },
  dl: { display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 8, columnGap: 12, fontSize: 13 },
  dt: { color: "#6b7280", fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", paddingTop: 1, display: "flex", alignItems: "center", gap: 6 },
  dd: { color: "#111827", fontSize: 13, margin: 0, wordBreak: "break-word" },
  muted: { color: "#9ca3af", fontSize: 13 },
  requiredMark: { color: "#ef4444" },
  fieldTypeTag: { fontSize: 10, fontWeight: 500, color: "#9ca3af", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 999, padding: "1px 6px", textTransform: "lowercase" },
  longText: { whiteSpace: "pre-wrap", display: "block" },
  innerTable: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  innerTh: { textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" },
  innerTd: { padding: "8px 10px", color: "#374151", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" },
  consentTypeTag: { display: "inline-block", padding: "1px 8px", fontSize: 11, fontWeight: 600, backgroundColor: "#eff6ff", color: "#1d4ed8", borderRadius: 999 },
  grantedPill: { display: "inline-block", padding: "1px 8px", fontSize: 11, fontWeight: 700, borderRadius: 999 },
  duplicateList: { display: "flex", flexDirection: "column", gap: 10 },
  duplicateRow: { border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 12px", backgroundColor: "#fafafa" },
  duplicateRowHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 10 },
  duplicateType: { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginRight: 8 },
  duplicateRef: { fontSize: 12, color: "#111827", backgroundColor: "#fff", padding: "1px 6px", borderRadius: 4, border: "1px solid #e5e7eb" },
  duplicateMeta: { display: "flex", gap: 8, alignItems: "center" },
  scoreBadge: { fontSize: 11, fontWeight: 700, color: "#1d4ed8", backgroundColor: "#dbeafe", padding: "2px 8px", borderRadius: 999 },
  duplicateStatus: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.03em" },
  duplicateReasons: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 },
  reasonChip: { fontSize: 11, color: "#4338ca", backgroundColor: "#eef2ff", padding: "2px 8px", borderRadius: 999 },
  duplicateFootnote: { fontSize: 12, color: "#6b7280", fontStyle: "italic" },
  duplicateActions: { display: "flex", gap: 8 },
  footnote: { fontSize: 11, color: "#9ca3af", marginTop: 10, fontStyle: "italic" },
  syncedBanner: { backgroundColor: "#ecfdf5", border: "1px solid #a7f3d0", padding: "8px 12px", borderRadius: 6, fontSize: 13, color: "#065f46", marginBottom: 10 },
  syncStatusPill: { display: "inline-block", padding: "2px 8px", fontSize: 11, fontWeight: 700, backgroundColor: "#f3f4f6", color: "#374151", borderRadius: 999, textTransform: "uppercase" },
  errorText: { color: "#b91c1c" },
};
