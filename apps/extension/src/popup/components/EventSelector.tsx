import { type ApiEvent } from "../../lib/types.js";

interface Props {
  events: ApiEvent[];
  selectedId: string | null;
  onSelect: (eventId: string) => void;
  loading: boolean;
}

export function EventSelector({ events, selectedId, onSelect, loading }: Props) {
  if (loading) {
    return <div style={styles.loading}>Loading events…</div>;
  }

  if (events.length === 0) {
    return (
      <div style={styles.empty}>
        No active events found. Ask your admin to activate an event.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <label style={styles.label}>Active Event</label>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        style={styles.select}
      >
        <option value="" disabled>
          Select an event…
        </option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.name}
          </option>
        ))}
      </select>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { marginBottom: 12 },
  label: { display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" },
  select: { width: "100%", padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, backgroundColor: "#fff", cursor: "pointer" },
  loading: { fontSize: 12, color: "#9ca3af", padding: "8px 0" },
  empty: { fontSize: 12, color: "#6b7280", padding: "8px 0", fontStyle: "italic" },
};
