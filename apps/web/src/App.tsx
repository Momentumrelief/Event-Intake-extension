import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { LoginPage } from "./pages/LoginPage.js";
import { ReviewQueuePage } from "./pages/ReviewQueuePage.js";
import { api, getToken, clearToken } from "./lib/api.js";

interface AuthUser {
  id: string;
  email: string;
  clinics: Array<{ id: string; name: string; role: string }>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Layout({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const clinic = user.clinics[0];
  return (
    <div style={styles.layout}>
      <nav style={styles.nav}>
        <div style={styles.navBrand}>Event Intake</div>
        <div style={styles.navLinks}>
          <NavLink to="/" end style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}>
            Dashboard
          </NavLink>
          <NavLink to="/review" style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}>
            Review Queue
          </NavLink>
          <NavLink to="/events" style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}>
            Events
          </NavLink>
        </div>
        <div style={styles.navUser}>
          <span style={styles.clinicName}>{clinic?.name}</span>
          <button
            onClick={() => { clearToken(); window.location.href = "/login"; }}
            style={styles.logoutBtn}
          >
            Sign out
          </button>
        </div>
      </nav>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

function DashboardPage({ clinicId }: { clinicId: string }) {
  return (
    <div style={{ padding: "24px 32px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Dashboard</h2>
      <p style={{ color: "#6b7280", fontSize: 14 }}>
        Clinic ID: <code>{clinicId}</code>
      </p>
      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div style={cardStyle}>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>REVIEW QUEUE</p>
          <a href="/review" style={{ fontSize: 14, color: "#2563eb" }}>View pending leads →</a>
        </div>
        <div style={cardStyle}>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>EVENTS</p>
          <a href="/events" style={{ fontSize: 14, color: "#2563eb" }}>Manage events →</a>
        </div>
        <div style={cardStyle}>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>EHR SYNC</p>
          <p style={{ fontSize: 14, color: "#374151" }}>Coming in Phase 5</p>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: 8,
  padding: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
  border: "1px solid #e5e7eb",
};

function EventsPlaceholder() {
  return (
    <div style={{ padding: "24px 32px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Events</h2>
      <p style={{ color: "#6b7280", fontSize: 14 }}>Event management UI — coming in Phase 3.</p>
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api.auth.me().then((u) => {
      setUser(u as AuthUser);
      setLoading(false);
    }).catch(() => {
      clearToken();
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>Loading…</div>;
  }

  const clinicId = user?.clinics[0]?.id ?? "";

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              {user ? (
                <Layout user={user}>
                  <Routes>
                    <Route path="/" element={<DashboardPage clinicId={clinicId} />} />
                    <Route path="/review" element={<ReviewQueuePage clinicId={clinicId} />} />
                    <Route path="/events" element={<EventsPlaceholder />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )}
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: { minHeight: "100vh", display: "flex", flexDirection: "column" },
  nav: { backgroundColor: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", padding: "0 24px", height: 56, gap: 24 },
  navBrand: { fontSize: 16, fontWeight: 700, color: "#111827", marginRight: 8 },
  navLinks: { display: "flex", gap: 4, flex: 1 },
  navLink: { padding: "6px 10px", borderRadius: 6, fontSize: 14, color: "#6b7280", textDecoration: "none" },
  navLinkActive: { backgroundColor: "#eff6ff", color: "#2563eb", fontWeight: 600 },
  navUser: { display: "flex", alignItems: "center", gap: 12 },
  clinicName: { fontSize: 13, color: "#6b7280" },
  logoutBtn: { padding: "5px 10px", fontSize: 13, border: "1px solid #e5e7eb", borderRadius: 5, cursor: "pointer", backgroundColor: "#fff", color: "#374151" },
  main: { flex: 1 },
};
