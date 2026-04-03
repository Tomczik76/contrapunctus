import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { NoteEditor } from "./components/staff";
import type { PlacedBeat } from "./components/staff/types";
import { AuthProvider, useAuth, API_BASE } from "./auth";
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

interface Project {
  id: string;
  name: string;
  trebleBeats: PlacedBeat[];
  bassBeats: PlacedBeat[];
  tsTop: number;
  tsBottom: number;
  tonicIdx: number;
  scaleName: string;
  createdAt: string;
  updatedAt: string;
}

const SESSION_KEY = "contrapunctus_editor_session";

function loadSession(): { projectId: string | null; projectName: string } {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { projectId: s.projectId ?? null, projectName: s.projectName ?? "Untitled" };
    }
  } catch { /* ignore */ }
  return { projectId: null, projectName: "Untitled" };
}

function saveSession(projectId: string | null, projectName: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ projectId, projectName }));
}

function EditorPage() {
  const { token } = useAuth();
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);

  // Restore session from localStorage on mount.
  // If URL has a projectId that differs from session (e.g. bookmark), load from server instead.
  const [session] = useState(loadSession);
  const [urlOverride] = useState(() => !!(urlProjectId && urlProjectId !== session.projectId));
  const [projectId, setProjectId] = useState<string | null>(urlOverride ? urlProjectId! : session.projectId);
  const [projectName, setProjectName] = useState(urlOverride ? "Loading..." : session.projectName);
  const [loadingFromUrl, setLoadingFromUrl] = useState(urlOverride);

  const [saving, setSaving] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Track current editor state (updated by NoteEditor callbacks)
  const [treble, setTreble] = useState<PlacedBeat[]>([]);
  const [bass, setBass] = useState<PlacedBeat[]>([]);
  const [settings, setSettings] = useState({ tsTop: 4, tsBottom: 4, tonicIdx: 0, scaleName: "major" });

  // Snapshot of state at last save — dirty = current refs !== saved refs
  const savedTrebleRef = useRef<PlacedBeat[]>(treble);
  const savedBassRef = useRef<PlacedBeat[]>(bass);
  const savedSettingsRef = useRef(settings);

  const dirty = treble !== savedTrebleRef.current
    || bass !== savedBassRef.current
    || settings !== savedSettingsRef.current;

  const markClean = () => {
    savedTrebleRef.current = trebleRef.current;
    savedBassRef.current = bassRef.current;
    savedSettingsRef.current = settingsRef.current;
  };

  // Keep refs in sync for buildBody (which runs outside render)
  const trebleRef = useRef(treble);
  trebleRef.current = treble;
  const bassRef = useRef(bass);
  bassRef.current = bass;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  // Persist session to localStorage whenever it changes
  useEffect(() => { saveSession(projectId, projectName); }, [projectId, projectName]);

  // Sync URL to match current project
  useEffect(() => {
    const target = projectId ? `/editor/${projectId}` : "/editor";
    if (window.location.pathname !== target) navigate(target, { replace: true });
  }, [projectId, navigate]);

  // Load project from server when arriving via direct URL (bookmark/shared link)
  useEffect(() => {
    if (!urlOverride || !token) return;
    fetch(`${API_BASE}/api/projects/${urlProjectId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.ok) {
          const p: Project = await res.json();
          setProjectName(p.name);
          localStorage.setItem("contrapunctus_state", JSON.stringify({
            trebleBeats: p.trebleBeats, bassBeats: p.bassBeats,
            tsTop: p.tsTop, tsBottom: p.tsBottom, tonicIdx: p.tonicIdx, scaleName: p.scaleName,
          }));
          snapshotPending.current = true;
          setEditorKey((k) => k + 1);
        } else {
          setProjectId(null);
          setProjectName("Untitled");
        }
      })
      .finally(() => setLoadingFromUrl(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProjects = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setProjects(await res.json());
  }, [token]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // When editorKey changes, the next callback updates are the "clean" baseline
  const snapshotPending = useRef(true);

  const handleTrebleChanged = useCallback((beats: PlacedBeat[]) => {
    setTreble(beats);
    if (snapshotPending.current) savedTrebleRef.current = beats;
  }, []);
  const handleBassChanged = useCallback((beats: PlacedBeat[]) => {
    setBass(beats);
    if (snapshotPending.current) savedBassRef.current = beats;
  }, []);
  const handleSettingsChanged = useCallback((s: { tsTop: number; tsBottom: number; tonicIdx: number; scaleName: string }) => {
    setSettings(s);
    if (snapshotPending.current) savedSettingsRef.current = s;
  }, []);

  // Turn off snapshot mode after the first render cycle (child effects have already fired callbacks above)
  useEffect(() => {
    if (snapshotPending.current) snapshotPending.current = false;
  });

  const buildBody = (name: string) => ({
    name,
    trebleBeats: trebleRef.current,
    bassBeats: bassRef.current,
    ...settingsRef.current,
  });

  const doSave = async () => {
    if (!token || !projectId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: "PUT", headers, body: JSON.stringify(buildBody(projectName)),
      });
      if (res.ok) { markClean(); fetchProjects(); }
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!token) return;
    if (projectId) {
      await doSave();
    } else {
      setShowSaveAs(true);
      setSaveAsName("Untitled");
    }
  };

  const handleSaveAs = async () => {
    if (!token || !saveAsName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST", headers, body: JSON.stringify(buildBody(saveAsName.trim())),
      });
      if (res.ok) {
        const p: Project = await res.json();
        setProjectId(p.id);
        setProjectName(p.name);
        markClean();
        setShowSaveAs(false);
        fetchProjects();
      }
    } finally { setSaving(false); }
  };

  /** Guard an action behind the unsaved-changes modal. If clean, run immediately. */
  const guardUnsaved = (action: () => void) => {
    if (!dirty) { action(); return; }
    setPendingAction(() => action);
  };

  const loadProject = (p: Project) => {
    setProjectId(p.id);
    setProjectName(p.name);
    markClean();
    localStorage.setItem("contrapunctus_state", JSON.stringify({
      trebleBeats: p.trebleBeats, bassBeats: p.bassBeats,
      tsTop: p.tsTop, tsBottom: p.tsBottom,
      tonicIdx: p.tonicIdx, scaleName: p.scaleName,
    }));
    snapshotPending.current = true;
    setEditorKey((k) => k + 1);
  };

  const handleOpen = (p: Project) => {
    setShowList(false);
    guardUnsaved(() => {
      fetch(`${API_BASE}/api/projects/${p.id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => { if (res.ok) loadProject(await res.json()); });
    });
  };

  const handleNew = () => {
    guardUnsaved(() => {
      setProjectId(null);
      setProjectName("Untitled");
      markClean();
      localStorage.removeItem("contrapunctus_state");
      snapshotPending.current = true;
      setEditorKey((k) => k + 1);
    });
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (!projectId || !token) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!projectId || !token) return;
    await fetch(`${API_BASE}/api/projects/${projectId}`, { method: "DELETE", headers });
    fetchProjects();
    setProjectId(null);
    setProjectName("Untitled");
    markClean();
    setShowDeleteConfirm(false);
    localStorage.removeItem("contrapunctus_state");
    snapshotPending.current = true;
    setEditorKey((k) => k + 1);
  };

  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const handleRename = () => {
    setRenameValue(projectName);
    setShowRename(true);
  };

  const confirmRename = async () => {
    if (!projectId || !token || !renameValue.trim()) return;
    const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
      method: "PUT", headers, body: JSON.stringify(buildBody(renameValue.trim())),
    });
    if (res.ok) { setProjectName(renameValue.trim()); fetchProjects(); }
    setShowRename(false);
  };

  const dismissModal = () => setPendingAction(null);

  const handleModalSave = async () => {
    if (projectId) {
      await doSave();
      const action = pendingAction;
      setPendingAction(null);
      action?.();
    } else {
      // Untitled — need Save As first, then run the pending action
      setShowSaveAs(true);
      setSaveAsName("Untitled");
      // pendingAction stays set; handleSaveAs won't clear it.
      // We'll run it after save completes — see handleSaveAsThenPending.
    }
  };

  const handleSaveAsThenPending = async () => {
    if (!token || !saveAsName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST", headers, body: JSON.stringify(buildBody(saveAsName.trim())),
      });
      if (res.ok) {
        const p: Project = await res.json();
        setProjectId(p.id);
        setProjectName(p.name);
        markClean();
        setShowSaveAs(false);
        fetchProjects();
        const action = pendingAction;
        setPendingAction(null);
        action?.();
      }
    } finally { setSaving(false); }
  };

  const handleModalDiscard = () => {
    markClean();
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  };

  if (loadingFromUrl) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  const tb = { background: "none", border: "1px solid #999", borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 13 } as const;
  const tbActive = { ...tb, background: "#5b4a3f", color: "#fff", borderColor: "#5b4a3f" } as const;

  const projectBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 0" }}>
      <span style={{ fontWeight: 700, fontSize: 15 }}>
        {projectName}
        {dirty && " *"}
      </span>
      {projectId && (
        <button style={tb} onClick={handleRename} title="Rename">Rename</button>
      )}
      <div style={{ flex: 1 }} />
      <button style={tb} onClick={handleNew}>New</button>
      <button style={tb} onClick={() => { setShowList(!showList); setShowSaveAs(false); }}>
        Open {showList ? "▲" : "▼"}
      </button>
      <button style={dirty ? tbActive : tb} onClick={handleSave} disabled={saving || !dirty}>
        {saving ? "Saving..." : "Save"}
      </button>
      <button style={tb} onClick={() => { setShowSaveAs(!showSaveAs); setShowList(false); setSaveAsName(projectId ? projectName + " (copy)" : "Untitled"); }}>
        Save As
      </button>
      {projectId && (
        <button style={{ ...tb, color: "#c0392b", borderColor: "#c0392b" }} onClick={handleDelete}>Delete</button>
      )}
    </div>
  );

  const projectListDropdown = showList && (
    <div style={{ background: "#fff", border: "1px solid #ccc", borderRadius: 6, padding: 8, marginBottom: 8, maxHeight: 300, overflow: "auto" }}>
      {projects.length === 0 && <div style={{ color: "#888", fontSize: 13, padding: 8 }}>No saved projects</div>}
      {projects.map((p) => (
        <div key={p.id} onClick={() => handleOpen(p)} style={{ padding: "6px 10px", cursor: "pointer", borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f0ece8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
          <span style={{ fontWeight: 600 }}>{p.name}</span>
          <span style={{ fontSize: 11, color: "#888" }}>{new Date(p.updatedAt).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );

  const onSaveAsSubmit = pendingAction ? handleSaveAsThenPending : handleSaveAs;

  const saveAsDialog = showSaveAs && (
    <div style={{ background: "#fff", border: "1px solid #ccc", borderRadius: 6, padding: 12, marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
      <label style={{ fontSize: 13 }}>Name:</label>
      <input value={saveAsName} onChange={(e) => setSaveAsName(e.target.value)} style={{ flex: 1, padding: "4px 8px", border: "1px solid #ccc", borderRadius: 4, fontFamily: "inherit" }}
        onKeyDown={(e) => { if (e.key === "Enter") onSaveAsSubmit(); }} autoFocus />
      <button style={tbActive} onClick={onSaveAsSubmit} disabled={saving || !saveAsName.trim()}>
        {saving ? "Saving..." : "Save"}
      </button>
      <button style={tb} onClick={() => { setShowSaveAs(false); setPendingAction(null); }}>Cancel</button>
    </div>
  );

  const unsavedModal = pendingAction && !showSaveAs && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
      onClick={dismissModal}>
      <div style={{ background: "#fff", borderRadius: 10, padding: "24px 28px", maxWidth: 400, width: "90%", fontFamily: "inherit", boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Unsaved Changes</div>
        <p style={{ fontSize: 14, color: "#555", marginBottom: 20, lineHeight: 1.5 }}>
          You have unsaved changes to <strong>{projectName}</strong>. What would you like to do?
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={tb} onClick={dismissModal}>Cancel</button>
          <button style={{ ...tb, color: "#c0392b", borderColor: "#c0392b" }} onClick={handleModalDiscard}>Discard</button>
          <button style={tbActive} onClick={handleModalSave}>{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );

  const deleteModal = showDeleteConfirm && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
      onClick={() => setShowDeleteConfirm(false)}>
      <div style={{ background: "#fff", borderRadius: 10, padding: "24px 28px", maxWidth: 400, width: "90%", fontFamily: "inherit", boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete Project</div>
        <p style={{ fontSize: 14, color: "#555", marginBottom: 20, lineHeight: 1.5 }}>
          Are you sure you want to delete <strong>{projectName}</strong>? This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={tb} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
          <button style={{ ...tb, background: "#c0392b", color: "#fff", borderColor: "#c0392b" }} onClick={confirmDelete}>Delete</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NoteEditor
        key={editorKey}
        header={<>{projectBar}{projectListDropdown}{saveAsDialog}</>}
        embedded={false}
        onTrebleBeatsChanged={handleTrebleChanged}
        onBassBeatsChanged={handleBassChanged}
        onSettingsChanged={handleSettingsChanged}
      />
      {unsavedModal}
      {deleteModal}
      {showRename && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={() => setShowRename(false)}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "24px 28px", maxWidth: 400, width: "90%", fontFamily: "inherit", boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Rename Project</div>
            <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); }}
              style={{ width: "100%", padding: "6px 10px", border: "1px solid #ccc", borderRadius: 4, fontFamily: "inherit", fontSize: 14, boxSizing: "border-box", marginBottom: 16 }}
              autoFocus />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={tb} onClick={() => setShowRename(false)}>Cancel</button>
              <button style={tbActive} onClick={confirmRename} disabled={!renameValue.trim()}>Rename</button>
            </div>
          </div>
        </div>
      )}
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
          <Route path="/editor/:projectId" element={
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
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/community/:id" element={<CommunityExercisePage />} />
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
