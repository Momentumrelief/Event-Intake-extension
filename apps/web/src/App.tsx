import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LoginPage } from "./pages/LoginPage.js";
import { ReviewQueuePage } from "./pages/ReviewQueuePage.js";
import { EventsListPage } from "./pages/EventsListPage.js";
import { EventEditPage } from "./pages/EventEditPage.js";
import { EventDetailPage } from "./pages/EventDetailPage.js";
import { LeadDetailPage } from "./pages/LeadDetailPage.js";
import { api, getToken, clearToken } from "./lib/api.js";

interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  clinics: Array<{ id: string; name: string; role: string }>;
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
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Dashboard</h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
        Clinic ID: <code style={{ backgroundColor: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{clinicId}</code>
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { label: "REVIEW QUEUE", text: "View pending leads →", href: "/review" },
          { label: "EVENTS", text: "Manage events →", href: "/events" },
          { label: "EHR SYNC", text: "Coming in Phase 5", href: null },
        ].map((card) => (
          <div key={card.label} style={cardStyle}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", marginBottom: 6 }}>{card.label}</p>
            {card.href
              ? <a href={card.href} style={{ fontSize: 14, color: "#2563eb", textDecoration: "none" }}>{card.text}</a>
              : <p style={{ fontSize: 14, color: "#9ca3af" }}>{card.text}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// All routing lives inside BrowserRouter so hooks like useNavigate work
function AppRoutes() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api.auth.me()
      .then((u) => { setUser(u as AuthUser); setLoading(false); })
      .catch(() => { clearToken(); setLoading(false); });
  }, []);

  function handleLogin(loggedInUser: AuthUser) {
    setUser(loggedInUser);
    navigate("/");
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#9ca3af" }}>
        Loading…
      </div>
    );
  }

  const clinicId = user?.clinics[0]?.id ?? "";

  return (
    <Routes>
      <Route path="/login" element={
        user
          ? <Navigate to="/" replace />
          : <LoginPage onLogin={handleLogin} />
      } />
      <Route path="/*" element={
        !getToken()
          ? <Navigate to="/login" replace />
          : user
            ? (
              <Layout user={user}>
                <Routes>
                  <Route path="/" element={<DashboardPage clinicId={clinicId} />} />
                  <Route path="/review" element={<ReviewQueuePage clinicId={clinicId} />} />
                  <Route path="/leads/:id" element={<LeadDetailPage />} />
                  <Route path="/events" element={<EventsListPage clinicId={clinicId} />} />
                  <Route path="/events/new" element={<EventEditPage clinicId={clinicId} />} />
                  <Route path="/events/:id" element={<EventDetailPage />} />
                  <Route path="/events/:id/edit" element={<EventEditPage clinicId={clinicId} />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            )
            : <Navigate to="/login" replace />
      } />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: 8,
  padding: "16px 20px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
  border: "1px solid #e5e7eb",
};

const styles: Record<string, React.CSSProperties> = {
  layout: { minHeight: "100vh", display: "flex", flexDirection: "column" },
  nav: { backgroundColor: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", padding: "0 24px", height: 56, gap: 24 },
  navBrand: { fontSize: 15, fontWeight: 700, color: "#111827", marginRight: 8 },
  navLinks: { display: "flex", gap: 4, flex: 1 },
  navLink: { padding: "6px 10px", borderRadius: 6, fontSize: 14, color: "#6b7280", textDecoration: "none" },
  navLinkActive: { backgroundColor: "#eff6ff", color: "#2563eb", fontWeight: 600 },
  navUser: { display: "flex", alignItems: "center", gap: 12 },
  clinicName: { fontSize: 13, color: "#6b7280" },
  logoutBtn: { padding: "5px 10px", fontSize: 13, border: "1px solid #e5e7eb", borderRadius: 5, cursor: "pointer", backgroundColor: "#fff", color: "#374151" },
  main: { flex: 1 },
};
