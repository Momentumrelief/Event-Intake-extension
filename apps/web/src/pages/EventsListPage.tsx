import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type EventListItem, type EventStatus } from "../lib/api.js";

interface Props {
  clinicId: string;
}

const STATUS_COLORS: Record<EventStatus, { bg: string; fg: string }> = {
  draft: { bg: "#f3f4f6", fg: "#4b5563" },
  active: { bg: "#d1fae5", fg: "#047857" },
  closed: { bg: "#fef3c7", fg: "#92400e" },
  archived: { bg: "#e5e7eb", fg: "#6b7280" },
};

const STATUS_OPTIONS: Array<{ value: "" | EventStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

export function EventsListPage({ clinicId }: Props) {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | EventStatus>("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.events.list(clinicId, statusFilter || undefined);
      setEvents(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [clinicId, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={styles.page}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Events</h2>
        <div style={styles.filters}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | EventStatus)}
            style={styles.select}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => navigate("/events/new")}
            style={styles.primaryBtn}
          >
            + New event
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.placeholder}>Loading events…</div>
      ) : events.length === 0 ? (
        <div style={styles.placeholder}>
          No events yet.{" "}
          <Link to="/events/new" style={styles.link}>Create the first one →</Link>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.theadRow}>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Dates</th>
              <th style={styles.th}>Location</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Leads</th>
              <th style={styles.th}>Tags</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const color = STATUS_COLORS[e.status];
              return (
                <tr key={e.id} style={styles.row}>
                  <td style={styles.td}>
                    <Link to={`/events/${e.id}`} style={styles.nameLink}>{e.name}</Link>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.muted}>{e.eventType.replace(/_/g, " ")}</span>
                  </td>
                  <td style={styles.td}>{formatDateRange(e.startAt, e.endAt)}</td>
                  <td style={styles.td}>
                    <span style={styles.muted}>{e.locationName ?? "—"}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, backgroundColor: color.bg, color: color.fg }}>
                      {e.status}
                    </span>
                  </td>
                  <td style={styles.td}>{e.leadCount}</td>
                  <td style={styles.td}>
                    {e.campaignTags.length > 0 ? (
                      <span style={styles.tags}>{e.campaignTags.join(", ")}</span>
                    ) : (
                      <span style={styles.muted}>—</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <Link to={`/events/${e.id}`} style={styles.viewBtn}>Open</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (sameDay) return start.toLocaleDateString(undefined, fmt);
  return `${start.toLocaleDateString(undefined, fmt)} – ${end.toLocaleDateString(undefined, fmt)}`;
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "24px 32px" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  heading: { fontSize: 22, fontWeight: 700, color: "#111827" },
  filters: { display: "flex", gap: 10, alignItems: "center" },
  select: { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 },
  primaryBtn: { padding: "7px 14px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  placeholder: { color: "#6b7280", fontSize: 14, padding: "40px 0", textAlign: "center" },
  link: { color: "#2563eb", textDecoration: "none", fontWeight: 600 },
  error: { backgroundColor: "#fef2f2", color: "#b91c1c", padding: "10px 14px", borderRadius: 6, marginBottom: 14, fontSize: 13 },
  table: { width: "100%", borderCollapse: "collapse", backgroundColor: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" },
  theadRow: { backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" },
  row: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "11px 14px", fontSize: 13, color: "#374151", verticalAlign: "middle" },
  nameLink: { color: "#111827", fontWeight: 600, textDecoration: "none" },
  muted: { color: "#6b7280" },
  tags: { fontSize: 12, color: "#4b5563" },
  badge: { display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: "capitalize" },
  viewBtn: { padding: "4px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5, backgroundColor: "#fff", color: "#374151", textDecoration: "none" },
};
