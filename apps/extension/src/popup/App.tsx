import { useState, useEffect } from "react";
import { EventSelector } from "./components/EventSelector.js";
import { LeadForm } from "./components/LeadForm.js";
import {
  getAuth,
  setAuth,
  clearAuth,
  getSelectedEventId,
  setSelectedEventId,
} from "../lib/storage.js";
import { login, getActiveEvents, getFormTemplateVersion, getConsentRequirements } from "../lib/api.js";
import type {
  StoredAuth,
  ApiEvent,
  ApiFormTemplateVersion,
  ApiConsentRequirement,
} from "../lib/types.js";

type Screen =
  | "loading"
  | "login"
  | "event-select"
  | "form"
  | "success"
  | "error";

export function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [auth, setAuthState] = useState<StoredAuth | null>(null);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [selectedEventId, setSelectedEventIdState] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState<ApiFormTemplateVersion | null>(null);
  const [consentReqs, setConsentReqs] = useState<ApiConsentRequirement[]>([]);
  const [successData, setSuccessData] = useState<{ leadId: string; isDuplicate: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    getAuth().then((stored) => {
      if (stored) {
        setAuthState(stored);
        loadEvents(stored);
      } else {
        setScreen("login");
      }
    });
  }, []);

  async function loadEvents(a: StoredAuth) {
    setScreen("loading");
    try {
      const clinicId = a.user.clinics[0]?.id;
      if (!clinicId) throw new Error("No clinic found");
      const evts = await getActiveEvents(clinicId);
      setEvents(evts);

      const storedEventId = await getSelectedEventId();
      const matchedEvent = evts.find((e) => e.id === storedEventId);

      if (matchedEvent) {
        await selectEvent(matchedEvent.id, matchedEvent);
      } else {
        setScreen("event-select");
      }
    } catch {
      setScreen("event-select");
    }
  }

  async function selectEvent(eventId: string, event?: ApiEvent) {
    setSelectedEventIdState(eventId);
    await setSelectedEventId(eventId);
    setScreen("loading");

    try {
      const ev = event ?? events.find((e) => e.id === eventId);
      if (!ev?.defaultFormTemplateVersionId) {
        setErrorMsg("This event has no published form template. Ask your admin to configure one.");
        setScreen("error");
        return;
      }

      const [version, reqs] = await Promise.all([
        getFormTemplateVersion(ev.defaultFormTemplateVersionId),
        getConsentRequirements(eventId),
      ]);

      setFormVersion(version);
      setConsentReqs(reqs);
      setScreen("form");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load form");
      setScreen("error");
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const result = await login(loginEmail, loginPassword);
      await setAuth(result);
      setAuthState(result);
      await loadEvents(result);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await clearAuth();
    setAuthState(null);
    setScreen("login");
  }

  function handleSuccess(leadId: string, isDuplicate: boolean) {
    setSuccessData({ leadId, isDuplicate });
    setScreen("success");
  }

  function startNewLead() {
    setSuccessData(null);
    setScreen("form");
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  if (screen === "loading") {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading…</p>
      </div>
    );
  }

  if (screen === "login") {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>Event Intake</h1>
        <form onSubmit={handleLogin} style={styles.loginForm}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              style={styles.input}
              required
              autoFocus
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          {loginError && <p style={styles.errorText}>{loginError}</p>}
          <button type="submit" disabled={loginLoading} style={styles.primaryBtn}>
            {loginLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  if (screen === "event-select") {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>Select Event</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>Sign out</button>
        </div>
        <EventSelector
          events={events}
          selectedId={selectedEventId}
          onSelect={selectEvent}
          loading={false}
        />
      </div>
    );
  }

  if (screen === "error") {
    return (
      <div style={styles.page}>
        <div style={styles.errorBanner}>{errorMsg}</div>
        <button onClick={() => setScreen("event-select")} style={styles.secondaryBtn}>
          Back to Events
        </button>
      </div>
    );
  }

  if (screen === "success") {
    return (
      <div style={styles.page}>
        <div style={styles.successBox}>
          <div style={styles.successIcon}>✓</div>
          <p style={styles.successTitle}>Lead submitted!</p>
          {successData?.isDuplicate && (
            <p style={styles.duplicateNote}>
              ⚠ Possible duplicate detected — an admin will review before EHR sync.
            </p>
          )}
        </div>
        <button onClick={startNewLead} style={styles.primaryBtn}>
          Capture Another Lead
        </button>
        {selectedEvent && (
          <button
            onClick={() => { setSelectedEventIdState(null); setScreen("event-select"); }}
            style={styles.secondaryBtn}
          >
            Switch Event
          </button>
        )}
      </div>
    );
  }

  // form screen
  return (
    <div style={styles.formPage}>
      <div style={{ ...styles.header, padding: "8px 14px", marginBottom: 0, flexShrink: 0 }}>
        <div>
          <span style={styles.eventBadge}>{selectedEvent?.name ?? "Event"}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setScreen("event-select")} style={styles.iconBtn} title="Switch event">
            ⇄
          </button>
          <button onClick={handleLogout} style={styles.iconBtn} title="Sign out">
            ×
          </button>
        </div>
      </div>

      {formVersion && auth && (
        <LeadForm
          eventId={selectedEventId!}
          formVersion={formVersion}
          consentRequirements={consentReqs}
          staffUserId={auth.user.id}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "12px 14px", minHeight: 200 },
  formPage: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 },
  centered: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  spinner: { width: 24, height: 24, border: "3px solid #e5e7eb", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  loadingText: { fontSize: 12, color: "#9ca3af" },
  title: { fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 16 },
  loginForm: { display: "flex", flexDirection: "column", gap: 10 },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 12, fontWeight: 500, color: "#374151" },
  input: { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 },
  errorText: { fontSize: 12, color: "#dc2626" },
  primaryBtn: { padding: "8px 16px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%", marginBottom: 6 },
  secondaryBtn: { padding: "7px 12px", backgroundColor: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer", width: "100%", marginBottom: 6 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #e5e7eb" },
  headerTitle: { fontSize: 13, fontWeight: 600, color: "#111827" },
  eventBadge: { fontSize: 11, fontWeight: 600, color: "#1d4ed8", backgroundColor: "#dbeafe", padding: "2px 8px", borderRadius: 999 },
  logoutBtn: { fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" },
  iconBtn: { fontSize: 14, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: "2px 6px", lineHeight: 1 },
  errorBanner: { backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "#991b1b", marginBottom: 10 },
  successBox: { textAlign: "center", padding: "20px 0" },
  successIcon: { fontSize: 32, color: "#16a34a" },
  successTitle: { fontSize: 15, fontWeight: 600, color: "#111827", marginTop: 8, marginBottom: 4 },
  duplicateNote: { fontSize: 12, color: "#92400e", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px", marginTop: 8 },
};
