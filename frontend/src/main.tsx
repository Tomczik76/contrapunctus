import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { NoteEditor } from "./components/staff";
import { AuthProvider, useAuth } from "./auth";
import { ThemeProvider } from "./useTheme";
import { TopNav } from "./components/TopNav";
import { BugReportButton } from "./components/BugReportButton";
import { SignupPage, LoginPage } from "./components/AuthPages";
import { ForgotPasswordPage } from "./components/ForgotPasswordPage";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
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
import { SettingsPage } from "./components/SettingsPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/landing" replace />;
  return <div style={{ paddingTop: 44 }}>{children}</div>;
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
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NoteEditor />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <TopNav />
        <BugReportButton />
        <Routes>
          <Route path="/landing" element={<PublicOnly><LandingPage /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
          <Route path="/reset-password" element={<PublicOnly><ResetPasswordPage /></PublicOnly>} />
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
          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
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
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
