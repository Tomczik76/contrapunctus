import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { NoteEditor } from "./components/staff";
import { AuthProvider, useAuth } from "./auth";
import { SignupPage, LoginPage } from "./components/AuthPages";
import { LandingPage } from "./components/LandingPage";
import { AdminPage } from "./components/AdminPage";
import { Dashboard } from "./components/Dashboard";
import { LessonList } from "./components/LessonList";
import { LessonPage } from "./components/LessonPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/landing" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function EditorPage() {
  const { user, logout } = useAuth();
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NoteEditor
        header={
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <Link to="/" style={{
              fontSize: 13, color: "#888", textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ fontSize: 16 }}>&larr;</span> Home
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, opacity: 0.6 }}>{user?.displayName}</span>
              <button
                onClick={logout}
                style={{
                  padding: 0,
                  fontSize: 12,
                  background: "none",
                  border: "none",
                  opacity: 0.6,
                  color: "inherit",
                  cursor: "pointer",
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
              >
                Sign out
              </button>
            </div>
          </div>
        }
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/landing" element={<PublicOnly><LandingPage /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/editor" element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          } />
          <Route path="/lessons" element={
            <ProtectedRoute>
              <LessonList />
            </ProtectedRoute>
          } />
          <Route path="/lessons/:id" element={
            <ProtectedRoute>
              <LessonPage />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
