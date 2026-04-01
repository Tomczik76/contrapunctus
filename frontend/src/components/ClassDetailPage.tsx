import { useState, useEffect, useCallback } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { useTheme } from "../useTheme";
import { formatDate, formatRelative } from "../dateFormat";

interface ClassDetail {
  id: string;
  name: string;
  inviteCode: string;
  status: string;
  studentCount: number;
  createdAt: string;
}

interface Student {
  id: string;
  displayName: string;
  email: string;
  enrolledAt: string;
  lessonsCompleted: number;
  lastActiveAt: string | null;
}

interface ClassLesson {
  id: string;
  title: string;
  difficulty: string;
  template: string;
  sortOrder: number;
  studentsCompleted: number;
  avgScore: number | null;
}

interface AvailableLesson {
  id: string;
  title: string;
  difficulty: string;
  template: string;
  assignedClasses: { id: string; name: string }[];
}

const templateLabels: Record<string, string> = {
  harmonize_melody: "Melody Harmonization",
  figured_bass: "Figured Bass",
};


export function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const { user, token, logout } = useAuth();
  const theme = useTheme();
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"students" | "lessons" | "grades" | "settings">("students");

  // Students
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Lessons
  const [lessons, setLessons] = useState<ClassLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [availableLessons, setAvailableLessons] = useState<AvailableLesson[]>([]);

  // Grades
  interface GradeEntry { studentId: string; studentName: string; lessonId: string; score: number | null; status: string | null }
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);

  // Settings
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Invite
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  // Confirm dialogs
  const [removingStudent, setRemovingStudent] = useState<string | null>(null);
  const [unassigningLesson, setUnassigningLesson] = useState<string | null>(null);

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const headers = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  // Load class detail
  useEffect(() => {
    fetch(`${API_BASE}/api/educator/classes/${classId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setCls(data); setEditName(data?.name || ""); setLoading(false); })
      .catch(() => setLoading(false));
  }, [classId, token]);

  // Load students
  useEffect(() => {
    if (tab !== "students" || !cls) return;
    setStudentsLoading(true);
    fetch(`${API_BASE}/api/educator/classes/${classId}/students`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setStudents(data); setStudentsLoading(false); })
      .catch(() => setStudentsLoading(false));
  }, [tab, cls, classId, token]);

  // Load lessons
  useEffect(() => {
    if (tab !== "lessons" || !cls) return;
    setLessonsLoading(true);
    fetch(`${API_BASE}/api/educator/classes/${classId}/lessons`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setLessons(data); setLessonsLoading(false); })
      .catch(() => setLessonsLoading(false));
  }, [tab, cls, classId, token]);

  // Load grades
  useEffect(() => {
    if (tab !== "grades" || !cls) return;
    setGradesLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/educator/classes/${classId}/grades`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      // Also need lesson names — reuse lessons if loaded, else fetch
      lessons.length > 0
        ? Promise.resolve(lessons)
        : fetch(`${API_BASE}/api/educator/classes/${classId}/lessons`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([gradeData, lessonData]) => {
        setGrades(gradeData);
        if (lessons.length === 0) setLessons(lessonData);
        setGradesLoading(false);
      })
      .catch(() => setGradesLoading(false));
  }, [tab, cls, classId, token]);

  if (!user?.isEducator) return <Navigate to="/" replace />;
  if (loading) return <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: theme.textMuted }}>Loading...</p></div>;
  if (!cls) return <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: theme.textMuted }}>Class not found.</p></div>;

  const inviteUrl = `${window.location.origin}/join/${cls.inviteCode}`;

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerateInvite() {
    setRegenerating(true);
    const res = await fetch(`${API_BASE}/api/educator/classes/${classId}/regenerate-invite`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const updated = await res.json();
      setCls(updated);
    }
    setRegenerating(false);
    setShowRegenConfirm(false);
  }

  async function handleRemoveStudent(studentId: string) {
    await fetch(`${API_BASE}/api/educator/classes/${classId}/students/${studentId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setCls(prev => prev ? { ...prev, studentCount: prev.studentCount - 1 } : prev);
    setRemovingStudent(null);
  }

  async function handleAssignLesson(lessonId: string) {
    const res = await fetch(`${API_BASE}/api/educator/classes/${classId}/lessons`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ lessonId }),
    });
    if (res.ok) {
      const lesson = await res.json();
      setLessons(prev => [...prev, lesson]);
    }
    setShowAssignPicker(false);
  }

  async function handleUnassignLesson(lessonId: string) {
    await fetch(`${API_BASE}/api/educator/classes/${classId}/lessons/${lessonId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    setLessons(prev => prev.filter(l => l.id !== lessonId));
    setUnassigningLesson(null);
  }

  async function handleSaveSettings() {
    setSaving(true);
    const res = await fetch(`${API_BASE}/api/educator/classes/${classId}`, {
      method: "PUT", headers: headers(),
      body: JSON.stringify({ name: editName, status: cls!.status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCls(updated);
    }
    setSaving(false);
  }

  async function toggleArchive() {
    const newStatus = cls!.status === "active" ? "archived" : "active";
    const res = await fetch(`${API_BASE}/api/educator/classes/${classId}`, {
      method: "PUT", headers: headers(),
      body: JSON.stringify({ name: cls!.name, status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCls(updated);
    }
  }

  async function openAssignPicker() {
    const res = await fetch(`${API_BASE}/api/educator/lessons`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const all: AvailableLesson[] = await res.json();
      setAvailableLessons(all);
    }
    setShowAssignPicker(true);
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...lessons];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    setLessons(reordered);
    setDragIdx(idx);
  }

  async function handleDragEnd() {
    setDragIdx(null);
    await fetch(`${API_BASE}/api/educator/classes/${classId}/lessons/order`, {
      method: "PUT", headers: headers(),
      body: JSON.stringify({ lessonIds: lessons.map(l => l.id) }),
    });
  }

  const assignedIds = new Set(lessons.map(l => l.id));
  const unassignedLessons = availableLessons.filter(l => !assignedIds.has(l.id));

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: active ? 700 : 400,
    color: active ? theme.text : theme.textMuted,
    background: "none",
    border: "none",
    borderBottom: active ? `2px solid ${theme.text}` : "2px solid transparent",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "color 0.12s ease",
  });

  const smallBtnStyle: React.CSSProperties = {
    padding: "5px 10px",
    fontSize: 12,
    color: theme.textMuted,
    background: theme.badgeBg,
    border: `1px solid ${theme.cardBorder}`,
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.bg, color: theme.text }}>
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
          <Link to="/educator/classes" style={{
            fontSize: 13, color: theme.textMuted, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ fontSize: 16 }}>&larr;</span> Classes
          </Link>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
            {cls.name}
          </span>
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

      <main style={{ flex: 1, padding: "24px 40px", maxWidth: 960, width: "100%", margin: "0 auto" }}>
        {/* Invite URL section */}
        <div style={{
          background: theme.cardBg,
          border: `1px solid ${theme.cardBorder}`,
          borderRadius: 8,
          padding: "16px 20px",
          marginBottom: 24,
          boxShadow: theme.cardShadow,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Invite Link
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <code style={{
              flex: 1,
              fontSize: 13,
              padding: "8px 12px",
              background: theme.dk ? "#1a1a1e" : "#f5f2ef",
              borderRadius: 4,
              color: theme.textSub,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {inviteUrl}
            </code>
            <button onClick={copyLink} style={{ ...smallBtnStyle, color: copied ? theme.successText : theme.textMuted }}>
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              onClick={() => setShowRegenConfirm(true)}
              style={smallBtnStyle}
            >
              Regenerate
            </button>
          </div>
          {cls.status === "archived" && (
            <p style={{ fontSize: 12, color: theme.dangerText, marginTop: 8, marginBottom: 0 }}>
              This class is archived. The invite link is disabled.
            </p>
          )}
        </div>

        {/* Regenerate confirmation dialog */}
        {showRegenConfirm && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }} onClick={() => setShowRegenConfirm(false)}>
            <div style={{
              background: theme.cardBg, borderRadius: 8, padding: "24px 28px",
              maxWidth: 420, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Regenerate Invite Link?</h3>
              <p style={{ fontSize: 14, color: theme.textSub, marginBottom: 20 }}>
                The current invite link will stop working. Students who already joined will not be affected. Anyone with the old link will no longer be able to join.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setShowRegenConfirm(false)} style={smallBtnStyle}>Cancel</button>
                <button
                  onClick={regenerateInvite}
                  disabled={regenerating}
                  style={{ ...smallBtnStyle, background: theme.dangerText, color: "#fff", border: "none", opacity: regenerating ? 0.6 : 1 }}
                >
                  {regenerating ? "Regenerating..." : "Regenerate"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${theme.cardBorder}`, marginBottom: 24 }}>
          <button style={tabStyle(tab === "students")} onClick={() => setTab("students")}>
            Students ({cls.studentCount})
          </button>
          <button style={tabStyle(tab === "lessons")} onClick={() => setTab("lessons")}>
            Lessons
          </button>
          <button style={tabStyle(tab === "grades")} onClick={() => setTab("grades")}>
            Grades
          </button>
          <button style={tabStyle(tab === "settings")} onClick={() => setTab("settings")}>
            Settings
          </button>
        </div>

        {/* Students Tab */}
        {tab === "students" && (
          studentsLoading ? (
            <p style={{ color: theme.textMuted, fontSize: 14 }}>Loading students...</p>
          ) : students.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: theme.textMuted, fontSize: 14 }}>
              No students enrolled yet. Share the invite link to get started.
            </div>
          ) : (
            <div style={{
              background: theme.cardBg,
              border: `1px solid ${theme.cardBorder}`,
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: theme.cardShadow,
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                    <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, color: theme.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Student</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, color: theme.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Enrolled</th>
                    <th style={{ textAlign: "center", padding: "10px 16px", fontWeight: 600, color: theme.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Completed</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, color: theme.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Last Active</th>
                    <th style={{ width: 60, padding: "10px 16px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ fontWeight: 600 }}>{s.displayName}</div>
                        <div style={{ fontSize: 12, color: theme.textMuted }}>{s.email}</div>
                      </td>
                      <td style={{ padding: "10px 16px", color: theme.textSub }}>{formatDate(s.enrolledAt)}</td>
                      <td style={{ padding: "10px 16px", textAlign: "center", color: theme.textSub }}>{s.lessonsCompleted}</td>
                      <td style={{ padding: "10px 16px", color: theme.textMuted }}>{formatRelative(s.lastActiveAt)}</td>
                      <td style={{ padding: "10px 16px" }}>
                        {removingStudent === s.id ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => handleRemoveStudent(s.id)} style={{ ...smallBtnStyle, color: theme.dangerText, fontSize: 11 }}>Confirm</button>
                            <button onClick={() => setRemovingStudent(null)} style={{ ...smallBtnStyle, fontSize: 11 }}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setRemovingStudent(s.id)} style={{ ...smallBtnStyle, fontSize: 11 }} title="Remove student from class">
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Lessons Tab */}
        {tab === "lessons" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button onClick={openAssignPicker} style={{
                padding: "8px 16px", fontSize: 14, fontWeight: 600,
                color: theme.btnText, background: theme.btnBg,
                border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
              }}>
                Assign Lesson
              </button>
            </div>

            {lessonsLoading ? (
              <p style={{ color: theme.textMuted, fontSize: 14 }}>Loading lessons...</p>
            ) : lessons.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: theme.textMuted, fontSize: 14 }}>
                No lessons assigned. Assign lessons from your library.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lessons.map((lesson, idx) => (
                  <div
                    key={lesson.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      background: theme.cardBg,
                      border: `1px solid ${dragIdx === idx ? theme.text : theme.cardBorder}`,
                      borderRadius: 8,
                      padding: "14px 20px",
                      boxShadow: theme.cardShadow,
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      cursor: "grab",
                      opacity: dragIdx === idx ? 0.7 : 1,
                      transition: "border-color 0.12s ease, opacity 0.12s ease",
                    }}
                  >
                    <span style={{ color: theme.textMuted, fontSize: 12, cursor: "grab", userSelect: "none", flexShrink: 0 }} title="Drag to reorder">
                      &#x2630;
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{lesson.title}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                          background: theme.badgeBg, color: theme.textMuted,
                        }}>
                          {lesson.difficulty}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 13, color: theme.textSub }}>
                        <span>{templateLabels[lesson.template] || lesson.template}</span>
                        <span>{lesson.studentsCompleted} completed</span>
                        {lesson.avgScore !== null && <span>Avg: {Math.round(lesson.avgScore)}%</span>}
                      </div>
                    </div>
                    {unassigningLesson === lesson.id ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => handleUnassignLesson(lesson.id)} style={{ ...smallBtnStyle, color: theme.dangerText, fontSize: 11 }}>Confirm</button>
                        <button onClick={() => setUnassigningLesson(null)} style={{ ...smallBtnStyle, fontSize: 11 }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setUnassigningLesson(lesson.id)} style={{ ...smallBtnStyle, fontSize: 11 }}>
                        Unassign
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Assign lesson picker modal */}
            {showAssignPicker && (
              <div style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
              }} onClick={() => setShowAssignPicker(false)}>
                <div style={{
                  background: theme.cardBg, borderRadius: 8, padding: "24px 28px",
                  maxWidth: 500, width: "100%", maxHeight: "70vh", overflow: "auto",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Assign a Lesson</h3>
                  {unassignedLessons.length === 0 ? (
                    <p style={{ color: theme.textMuted, fontSize: 14 }}>
                      {availableLessons.length === 0
                        ? "You haven't created any lessons yet. Create one in the Lessons section first."
                        : "All your lessons are already assigned to this class."}
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {unassignedLessons.map(lesson => (
                        <div
                          key={lesson.id}
                          onClick={() => handleAssignLesson(lesson.id)}
                          style={{
                            padding: "12px 16px",
                            border: `1px solid ${theme.cardBorder}`,
                            borderRadius: 6,
                            cursor: "pointer",
                            transition: "background 0.12s ease",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = theme.dk ? "#32323a" : "#f5f2ef"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>{lesson.title}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 8,
                              background: theme.badgeBg, color: theme.textMuted,
                            }}>
                              {lesson.difficulty}
                            </span>
                          </div>
                          <span style={{ fontSize: 12, color: theme.textSub }}>
                            {templateLabels[lesson.template] || lesson.template}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                    <button onClick={() => setShowAssignPicker(false)} style={smallBtnStyle}>Close</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Grades Tab */}
        {tab === "grades" && (
          gradesLoading ? (
            <p style={{ color: theme.textMuted, fontSize: 14 }}>Loading grades...</p>
          ) : (() => {
            // Build gradebook matrix
            const lessonOrder = lessons.map(l => l.id);
            const studentMap = new Map<string, { name: string; scores: Map<string, { score: number | null; status: string | null }> }>();
            for (const g of grades) {
              if (!studentMap.has(g.studentId)) {
                studentMap.set(g.studentId, { name: g.studentName, scores: new Map() });
              }
              studentMap.get(g.studentId)!.scores.set(g.lessonId, { score: g.score, status: g.status });
            }
            const studentList = Array.from(studentMap.entries()).map(([id, data]) => ({
              id,
              name: data.name,
              scores: data.scores,
              avg: (() => {
                const submitted = Array.from(data.scores.values()).filter(s => s.status === "submitted" && s.score !== null);
                if (submitted.length === 0) return null;
                return submitted.reduce((sum, s) => sum + s.score!, 0) / submitted.length;
              })(),
            }));

            if (studentList.length === 0 || lessonOrder.length === 0) {
              return (
                <div style={{ textAlign: "center", padding: "48px 24px", color: theme.textMuted, fontSize: 14 }}>
                  {studentList.length === 0 ? "No students enrolled yet." : "No lessons assigned yet."}
                </div>
              );
            }

            // Class averages per lesson
            const classAvgs = lessonOrder.map(lid => {
              const scores = studentList.map(s => s.scores.get(lid)).filter(s => s?.status === "submitted" && s.score !== null);
              if (scores.length === 0) return null;
              return scores.reduce((sum, s) => sum + s!.score!, 0) / scores.length;
            });
            const overallAvg = (() => {
              const allAvgs = studentList.map(s => s.avg).filter((a): a is number => a !== null);
              if (allAvgs.length === 0) return null;
              return allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length;
            })();

            return (
              <div style={{
                background: theme.cardBg,
                border: `1px solid ${theme.cardBorder}`,
                borderRadius: 8,
                overflow: "auto",
                boxShadow: theme.cardShadow,
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, whiteSpace: "nowrap" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${theme.cardBorder}` }}>
                      <th style={{
                        textAlign: "left", padding: "10px 16px", fontWeight: 600, color: theme.textMuted,
                        fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5,
                        position: "sticky", left: 0, background: theme.cardBg, zIndex: 1,
                      }}>Student</th>
                      {lessons.map(l => (
                        <th key={l.id} style={{
                          textAlign: "center", padding: "10px 12px", fontWeight: 600, color: theme.textMuted,
                          fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5,
                          maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis",
                        }} title={l.title}>{l.title}</th>
                      ))}
                      <th style={{
                        textAlign: "center", padding: "10px 12px", fontWeight: 700, color: theme.text,
                        fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5,
                        borderLeft: `2px solid ${theme.cardBorder}`,
                      }}>Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentList.map(student => (
                      <tr key={student.id} style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                        <td style={{
                          padding: "10px 16px", fontWeight: 600,
                          position: "sticky", left: 0, background: theme.cardBg, zIndex: 1,
                        }}>{student.name}</td>
                        {lessonOrder.map(lid => {
                          const entry = student.scores.get(lid);
                          const st = entry?.status;
                          const sc = entry?.score;
                          const gradeUrl = `/educator/classes/${classId}/students/${student.id}/lessons/${lid}/grade`;
                          return (
                            <td key={lid} style={{
                              textAlign: "center", padding: "10px 12px",
                              color: st === "submitted"
                                ? (sc != null && sc >= 90 ? theme.successText : sc != null && sc < 60 ? theme.dangerText : theme.text)
                                : theme.textMuted,
                              fontWeight: st === "submitted" ? 600 : 400,
                            }}>
                              {st === "submitted" ? (
                                <Link to={gradeUrl} style={{
                                  color: "inherit", textDecoration: "none",
                                  borderBottom: `1px dashed currentColor`,
                                  cursor: "pointer",
                                }}>
                                  {sc != null ? `${Math.round(sc)}%` : "Needs grade"}
                                </Link>
                              ) : st === "draft"
                                ? "In progress"
                                : "\u2014"}
                            </td>
                          );
                        })}
                        <td style={{
                          textAlign: "center", padding: "10px 12px", fontWeight: 700,
                          borderLeft: `2px solid ${theme.cardBorder}`,
                          color: student.avg !== null
                            ? (student.avg >= 90 ? theme.successText : student.avg < 60 ? theme.dangerText : theme.text)
                            : theme.textMuted,
                        }}>
                          {student.avg !== null ? `${Math.round(student.avg)}%` : "\u2014"}
                        </td>
                      </tr>
                    ))}
                    {/* Class average row */}
                    <tr style={{ borderTop: `2px solid ${theme.cardBorder}` }}>
                      <td style={{
                        padding: "10px 16px", fontWeight: 700, fontSize: 11,
                        textTransform: "uppercase", letterSpacing: 0.5, color: theme.textMuted,
                        position: "sticky", left: 0, background: theme.cardBg, zIndex: 1,
                      }}>Class Average</td>
                      {classAvgs.map((avg, i) => (
                        <td key={i} style={{
                          textAlign: "center", padding: "10px 12px", fontWeight: 600,
                          color: avg !== null
                            ? (avg >= 90 ? theme.successText : avg < 60 ? theme.dangerText : theme.text)
                            : theme.textMuted,
                        }}>
                          {avg !== null ? `${Math.round(avg)}%` : "\u2014"}
                        </td>
                      ))}
                      <td style={{
                        textAlign: "center", padding: "10px 12px", fontWeight: 700,
                        borderLeft: `2px solid ${theme.cardBorder}`,
                        color: overallAvg !== null
                          ? (overallAvg >= 90 ? theme.successText : overallAvg < 60 ? theme.dangerText : theme.text)
                          : theme.textMuted,
                      }}>
                        {overallAvg !== null ? `${Math.round(overallAvg)}%` : "\u2014"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()
        )}

        {/* Settings Tab */}
        {tab === "settings" && (
          <div style={{ maxWidth: 500 }}>
            <div style={{
              background: theme.cardBg,
              border: `1px solid ${theme.cardBorder}`,
              borderRadius: 8,
              padding: "24px",
              marginBottom: 20,
              boxShadow: theme.cardShadow,
            }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Class Name</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", fontSize: 15,
                  border: `1px solid ${theme.cardBorder}`, borderRadius: 4,
                  fontFamily: "inherit", background: theme.inputBg, color: theme.text,
                  boxSizing: "border-box",
                }}
              />
              <button
                onClick={handleSaveSettings}
                disabled={saving || editName === cls.name || !editName.trim()}
                style={{
                  marginTop: 12, padding: "8px 16px", fontSize: 14, fontWeight: 600,
                  color: theme.btnText, background: theme.btnBg,
                  border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                  opacity: saving || editName === cls.name || !editName.trim() ? 0.5 : 1,
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>

            <div style={{
              background: theme.cardBg,
              border: `1px solid ${theme.cardBorder}`,
              borderRadius: 8,
              padding: "24px",
              boxShadow: theme.cardShadow,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                {cls.status === "active" ? "Archive Class" : "Unarchive Class"}
              </h3>
              <p style={{ fontSize: 13, color: theme.textSub, marginBottom: 16 }}>
                {cls.status === "active"
                  ? "Archiving hides the class from students and disables the invite link. All data is preserved."
                  : "Unarchiving will make the class visible again and re-enable the invite link."}
              </p>
              <button
                onClick={toggleArchive}
                style={{
                  padding: "8px 16px", fontSize: 14, fontWeight: 600,
                  color: cls.status === "active" ? theme.dangerText : theme.successText,
                  background: "none",
                  border: `1px solid ${cls.status === "active" ? theme.dangerText : theme.successText}`,
                  borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {cls.status === "active" ? "Archive Class" : "Unarchive Class"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
