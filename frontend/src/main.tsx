import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NoteEditor } from "./components/Staff";
import { AuthProvider, useAuth } from "./auth";
import { SignupPage, LoginPage } from "./components/AuthPages";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function EditorPage() {
  const { user, logout } = useAuth();
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "32px 16px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 960,
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
        padding: "36px 40px 48px",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          borderBottom: "1px solid #e0dcd8",
          paddingBottom: 16,
        }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: -0.5,
            color: "#1a1a1a",
            margin: 0,
          }}>
            Contrapunctus
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, color: "#666" }}>{user?.displayName}</span>
            <button
              onClick={logout}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                background: "none",
                border: "1px solid #ccc",
                borderRadius: 4,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        <NoteEditor />
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <ProtectedRoute>
              <EditorPage />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
