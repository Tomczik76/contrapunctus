import { useState, useEffect } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";

interface ClassItem {
  id: string;
  name: string;
  inviteCode: string;
  status: string;
  studentCount: number;
  createdAt: string;
}

interface LessonItem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  template: string;
  createdAt: string;
  assignedClasses: { id: string; name: string }[];
}

function useTheme() {
  const [darkMode] = useState(() => {
    try { return localStorage.getItem("contrapunctus_dark") === "true"; } catch { return false; }
  });
  const dk = darkMode;
  return {
    dk,
    bg: dk ? "#1e1e22" : "#e8e4e0",
    cardBg: dk ? "#2a2a30" : "#fff",
    cardBorder: dk ? "#3a3a40" : "#e0dcd8",
    cardShadow: dk ? "0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
    text: dk ? "#e0ddd8" : "#1a1a1a",
    textSub: dk ? "#aaa" : "#555",
    textMuted: dk ? "#888" : "#888",
    sidebarBg: dk ? "#222228" : "#f5f2ef",
    sidebarBorder: dk ? "#3a3a40" : "#e0dcd8",
    sidebarHover: dk ? "#2e2e34" : "#ece9e5",
    sidebarActive: dk ? "#32323a" : "#e8e4e0",
    btnBg: dk ? "#e0ddd8" : "#1a1a1a",
    btnText: dk ? "#1a1a1e" : "#fff",
    badgeBg: dk ? "#32323a" : "#f0eeeb",
    successText: dk ? "#6ee7a0" : "#16a34a",
  };
}

function Sidebar({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const location = useLocation();
  const isClasses = location.pathname === "/educator" || location.pathname === "/educator/classes";
  const isLessons = location.pathname === "/educator/lessons";

  const linkStyle = (active: boolean): React.CSSProperties => ({
    display: "block",
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: active ? 700 : 400,
    color: theme.text,
    textDecoration: "none",
    borderRadius: 6,
    background: active ? theme.sidebarActive : "transparent",
    transition: "background 0.12s ease",
  });

  return (
    <nav style={{
      width: 220,
      flexShrink: 0,
      borderRight: `1px solid ${theme.sidebarBorder}`,
      background: theme.sidebarBg,
      padding: "20px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <Link to="/educator/classes" style={linkStyle(isClasses)}
        onMouseEnter={e => { if (!isClasses) e.currentTarget.style.background = theme.sidebarHover; }}
        onMouseLeave={e => { if (!isClasses) e.currentTarget.style.background = "transparent"; }}
      >
        Classes
      </Link>
      <Link to="/educator/lessons" style={linkStyle(isLessons)}
        onMouseEnter={e => { if (!isLessons) e.currentTarget.style.background = theme.sidebarHover; }}
        onMouseLeave={e => { if (!isLessons) e.currentTarget.style.background = "transparent"; }}
      >
        Lessons
      </Link>
    </nav>
  );
}

function ClassesSection({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const { token } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/educator/classes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { setClasses(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch(`${API_BASE}/api/educator/classes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const cls = await res.json();
      setClasses(prev => [cls, ...prev]);
      setName("");
      setShowForm(false);
    }
    setCreating(false);
  }

  function copyInviteUrl(cls: ClassItem) {
    const url = `${window.location.origin}/join/${cls.inviteCode}`;
    navigator.clipboard.writeText(url);
    setCopiedId(cls.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function regenerateInvite(cls: ClassItem) {
    setRegeneratingId(cls.id);
    const res = await fetch(`${API_BASE}/api/educator/classes/${cls.id}/regenerate-invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const updated = await res.json();
      setClasses(prev => prev.map(c => c.id === cls.id ? updated : c));
    }
    setRegeneratingId(null);
  }

  if (loading) return <p style={{ color: theme.textMuted, fontSize: 14 }}>Loading classes...</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: 0 }}>Classes</h2>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 600,
            color: theme.btnText,
            background: theme.btnBg,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Create Class
        </button>
      </div>

      {showForm && (
        <div style={{
          background: theme.cardBg,
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: 8,
          padding: "20px",
          marginBottom: 20,
          boxShadow: theme.cardShadow,
        }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 6 }}>
            Class Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Music Theory 101 - Fall 2026"
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 15,
              border: `1px solid ${theme.cardBorder}`,
              borderRadius: 4,
              fontFamily: "inherit",
              background: theme.dk ? "#1e1e22" : "#fff",
              color: theme.text,
              boxSizing: "border-box",
            }}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            autoFocus
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              style={{
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 600,
                color: theme.btnText,
                background: theme.btnBg,
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: "inherit",
                opacity: creating || !name.trim() ? 0.5 : 1,
              }}
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => { setShowForm(false); setName(""); }}
              style={{
                padding: "8px 16px",
                fontSize: 14,
                color: theme.textMuted,
                background: "none",
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {classes.length === 0 && !showForm ? (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          color: theme.textMuted,
          fontSize: 14,
        }}>
          No classes yet. Create your first class to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {classes.map(cls => (
            <div
              key={cls.id}
              style={{
                background: theme.cardBg,
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: 8,
                padding: "16px 20px",
                boxShadow: theme.cardShadow,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Link
                    to={`/educator/classes/${cls.id}`}
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: theme.text,
                      textDecoration: "none",
                    }}
                  >
                    {cls.name}
                  </Link>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: cls.status === "active"
                      ? (theme.dk ? "rgba(22,163,74,0.15)" : "rgba(22,163,74,0.08)")
                      : theme.badgeBg,
                    color: cls.status === "active" ? theme.successText : theme.textMuted,
                  }}>
                    {cls.status}
                  </span>
                </div>
                <span style={{ fontSize: 13, color: theme.textSub }}>
                  {cls.studentCount} {cls.studentCount === 1 ? "student" : "students"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => copyInviteUrl(cls)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    color: copiedId === cls.id ? theme.successText : theme.textMuted,
                    background: theme.badgeBg,
                    border: `1px solid ${theme.cardBorder}`,
                    borderRadius: 4,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                    transition: "color 0.15s ease",
                  }}
                >
                  {copiedId === cls.id ? "Copied!" : "Copy Invite URL"}
                </button>
                <button
                  onClick={() => regenerateInvite(cls)}
                  disabled={regeneratingId === cls.id}
                  title="Generate a new invite URL (invalidates the old one)"
                  style={{
                    padding: "6px 10px",
                    fontSize: 12,
                    color: theme.textMuted,
                    background: theme.badgeBg,
                    border: `1px solid ${theme.cardBorder}`,
                    borderRadius: 4,
                    cursor: regeneratingId === cls.id ? "wait" : "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                    opacity: regeneratingId === cls.id ? 0.5 : 1,
                  }}
                >
                  {regeneratingId === cls.id ? "..." : "Regenerate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonsSection({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const { token } = useAuth();
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/educator/lessons`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { setLessons(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const templateLabels: Record<string, string> = {
    harmonize_melody: "Melody Harmonization",
    figured_bass: "Figured Bass",
    roman_numeral_analysis: "Roman Numeral Analysis",
  };

  if (loading) return <p style={{ color: theme.textMuted, fontSize: 14 }}>Loading lessons...</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: 0 }}>Lessons</h2>
        <Link
          to="/educator/lessons/new"
          style={{
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 600,
            color: theme.btnText,
            background: theme.btnBg,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: "inherit",
            textDecoration: "none",
          }}
        >
          Create Lesson
        </Link>
      </div>

      {lessons.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          color: theme.textMuted,
          fontSize: 14,
        }}>
          No lessons yet. Create your first lesson to assign it to a class.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lessons.map(lesson => (
            <Link
              key={lesson.id}
              to={`/educator/lessons/${lesson.id}/edit`}
              style={{
                background: theme.cardBg,
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: 8,
                padding: "16px 20px",
                boxShadow: theme.cardShadow,
                textDecoration: "none",
                color: "inherit",
                display: "block",
                transition: "box-shadow 0.12s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>{lesson.title}</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: theme.badgeBg,
                  color: theme.textMuted,
                }}>
                  {lesson.difficulty}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: theme.textSub }}>
                <span>{templateLabels[lesson.template] || lesson.template}</span>
                <span>
                  {lesson.assignedClasses.length === 0
                    ? "Unassigned"
                    : lesson.assignedClasses.map(c => c.name).join(", ")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function EducatorDashboard({ section }: { section: "classes" | "lessons" }) {
  const { user, logout } = useAuth();
  const theme = useTheme();

  if (!user?.isEducator) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: theme.bg,
      color: theme.text,
    }}>
      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${theme.sidebarBorder}`,
        background: theme.sidebarBg,
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/" style={{
            fontSize: 13, color: theme.textMuted, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ fontSize: 16 }}>&larr;</span> Home
          </Link>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
            Educator Dashboard
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, opacity: 0.6 }}>{user?.displayName}</span>
          <button
            onClick={logout}
            style={{
              padding: 0, fontSize: 12, background: "none", border: "none",
              opacity: 0.6, color: "inherit", cursor: "pointer",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              textDecoration: "underline", textUnderlineOffset: 2,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar theme={theme} />
        <main style={{ flex: 1, padding: "32px 40px", maxWidth: 900 }}>
          {section === "classes" ? (
            <ClassesSection theme={theme} />
          ) : (
            <LessonsSection theme={theme} />
          )}
        </main>
      </div>
    </div>
  );
}
