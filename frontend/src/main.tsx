import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Link, useSearchParams } from "react-router-dom";
import { NoteEditor } from "./components/staff";
import { AuthProvider, useAuth } from "./auth";
import { SignupPage, LoginPage } from "./components/AuthPages";
import { LandingPage } from "./components/LandingPage";
import { AdminPage } from "./components/AdminPage";
import { Dashboard } from "./components/Dashboard";
import { LessonList } from "./components/LessonList";
import { LessonPage } from "./components/LessonPage";
import { EducatorDashboard } from "./components/EducatorDashboard";
import { JoinPage } from "./components/JoinPage";
import { ClassDetailPage } from "./components/ClassDetailPage";
import { EducatorLessonEditor } from "./components/EducatorLessonEditor";
import { StudentClassPage } from "./components/StudentClassPage";
import { ClassLessonPage } from "./components/ClassLessonPage";
import { EducatorGradePage } from "./components/EducatorGradePage";
import { CommunityPage } from "./components/CommunityPage";
import { CommunityExercisePage } from "./components/CommunityExercisePage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/landing" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  if (loading) return null;
  if (user) return <Navigate to={redirect || "/"} replace />;
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
          <Route path="/join/:inviteCode" element={<JoinPage />} />
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
          <Route path="/classes/:classId" element={
            <ProtectedRoute>
              <StudentClassPage />
            </ProtectedRoute>
          } />
          <Route path="/classes/:classId/lessons/:lessonId" element={
            <ProtectedRoute>
              <ClassLessonPage />
            </ProtectedRoute>
          } />
          <Route path="/community" element={
            <ProtectedRoute>
              <CommunityPage />
            </ProtectedRoute>
          } />
          <Route path="/community/:id" element={
            <ProtectedRoute>
              <CommunityExercisePage />
            </ProtectedRoute>
          } />
          <Route path="/educator" element={
            <ProtectedRoute>
              <EducatorDashboard section="classes" />
            </ProtectedRoute>
          } />
          <Route path="/educator/classes" element={
            <ProtectedRoute>
              <EducatorDashboard section="classes" />
            </ProtectedRoute>
          } />
          <Route path="/educator/classes/:classId" element={
            <ProtectedRoute>
              <ClassDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/educator/lessons" element={
            <ProtectedRoute>
              <EducatorDashboard section="lessons" />
            </ProtectedRoute>
          } />
          <Route path="/educator/classes/:classId/students/:studentId/lessons/:lessonId/grade" element={
            <ProtectedRoute>
              <EducatorGradePage />
            </ProtectedRoute>
          } />
          <Route path="/educator/lessons/new" element={
            <ProtectedRoute>
              <EducatorLessonEditor />
            </ProtectedRoute>
          } />
          <Route path="/educator/lessons/:lessonId/edit" element={
            <ProtectedRoute>
              <EducatorLessonEditor />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
