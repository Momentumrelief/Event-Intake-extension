import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status: string;
  createdAt: string;
  event: { id: string; name: string };
  _count: { duplicates: number };
}

interface Props {
  clinicId: string;
}

const STATUS_COLORS: Record<string, string> = {
  submitted: "#dbeafe",
  needs_review: "#fef3c7",
  ready: "#d1fae5",
  sync_queued: "#e0e7ff",
  syncing: "#e0e7ff",
  synced: "#d1fae5",
  sync_failed: "#fee2e2",
  sync_rejected: "#fee2e2",
  exported: "#f3f4f6",
  archived: "#f3f4f6",
};

export function ReviewQueuePage({ clinicId }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.leads.reviewQueue(clinicId, statusFilter || undefined, page);
      setLeads(result.leads as Lead[]);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [clinicId, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l) => l.id)));
    }
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return;
    setActionLoading(true);
    try {
      await api.leads.bulkApprove([...selected]);
      setSelected(new Set());
      await load();
    } finally {
      setActionLoading(false);
    }
  }

  const pageCount = Math.ceil(total / 50);

  return (
    <div style={styles.page}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Review Queue</h2>
        <div style={styles.filters}>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={styles.select}
          >
            <option value="">submitted + needs_review</option>
            <option value="submitted">submitted</option>
            <option value="needs_review">needs_review</option>
            <option value="ready">ready</option>
            <option value="synced">synced</option>
            <option value="sync_rejected">sync_rejected</option>
          </select>
          {selected.size > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={actionLoading}
              style={styles.approveBtn}
            >
              Approve {selected.size} lead{selected.size > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading…</div>
      ) : leads.length === 0 ? (
        <div style={styles.empty}>No leads in this queue.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.theadRow}>
              <th style={styles.th}>
                <input
                  type="checkbox"
                  checked={selected.size === leads.length}
                  onChange={toggleAll}
                />
              </th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Contact</th>
              <th style={styles.th}>Event</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Duplicates</th>
              <th style={styles.th}>Captured</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} style={styles.row}>
                <td style={styles.td}>
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                  />
                </td>
                <td style={styles.td}>
                  <span style={styles.name}>
                    {lead.firstName} {lead.lastName}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={styles.contact}>{lead.email ?? lead.phone ?? "—"}</span>
                </td>
                <td style={styles.td}>{lead.event.name}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      backgroundColor: STATUS_COLORS[lead.status] ?? "#f3f4f6",
                    }}
                  >
                    {lead.status}
                  </span>
                </td>
                <td style={styles.td}>
                  {lead._count.duplicates > 0 ? (
                    <span style={{ ...styles.badge, backgroundColor: "#fef3c7", color: "#92400e" }}>
                      {lead._count.duplicates} candidate{lead._count.duplicates > 1 ? "s" : ""}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td style={styles.td}>
                  {new Date(lead.createdAt).toLocaleDateString()}
                </td>
                <td style={styles.td}>
                  <button
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    style={styles.viewBtn}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pageCount > 1 && (
        <div style={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={styles.pageBtn}>
            ← Prev
          </button>
          <span style={styles.pageInfo}>
            Page {page} of {pageCount} ({total} total)
          </span>
          <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} style={styles.pageBtn}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "24px 32px" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  heading: { fontSize: 22, fontWeight: 700, color: "#111827" },
  filters: { display: "flex", gap: 12, alignItems: "center" },
  select: { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 },
  approveBtn: { padding: "7px 14px", backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  loading: { color: "#6b7280", fontSize: 14, padding: "32px 0", textAlign: "center" },
  empty: { color: "#9ca3af", fontSize: 14, padding: "32px 0", textAlign: "center" },
  table: { width: "100%", borderCollapse: "collapse", backgroundColor: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" },
  theadRow: { backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" },
  row: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "11px 14px", fontSize: 13, color: "#374151", verticalAlign: "middle" },
  name: { fontWeight: 600, color: "#111827" },
  contact: { color: "#6b7280" },
  badge: { display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 },
  viewBtn: { padding: "4px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5, cursor: "pointer", backgroundColor: "#fff" },
  pagination: { display: "flex", gap: 16, alignItems: "center", justifyContent: "center", marginTop: 20 },
  pageBtn: { padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer", backgroundColor: "#fff" },
  pageInfo: { fontSize: 13, color: "#6b7280" },
};
