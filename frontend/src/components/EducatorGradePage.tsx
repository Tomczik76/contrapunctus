import { useParams, Link, Navigate } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import { useAuth, API_BASE } from "../auth";
import { NoteEditor, type LessonConfig, type LessonErrorItem, type PlacedBeat } from "./staff";

interface LessonDetail {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  template: string;
  tonicIdx: number;
  scaleName: string;
  tsTop: number;
  tsBottom: number;
  sopranoBeats: PlacedBeat[];
  bassBeats?: PlacedBeat[];
  figuredBass?: string[][];
}

interface StudentWork {
  trebleBeats: PlacedBeat[];
  bassBeats: PlacedBeat[];
  studentRomans: Record<number, string>;
  score: number | null;
  status: string;
}

interface StudentInfo {
  id: string;
  displayName: string;
}

export function EducatorGradePage() {
  const { classId, studentId, lessonId } = useParams<{
    classId: string;
    studentId: string;
    lessonId: string;
  }>();
  const { user, token, logout } = useAuth();

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [work, setWork] = useState<StudentWork | null>(null);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradeInput, setGradeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  const [darkMode] = useState(() => {
    try { return localStorage.getItem("contrapunctus_dark") === "true"; } catch { return false; }
  });
  const dk = darkMode;
  const theme = {
    bg: dk ? "#1e1e22" : "#e8e4e0",
    cardBg: dk ? "#2a2a30" : "#fff",
    cardBorder: dk ? "#3a3a40" : "#e0dcd8",
    text: dk ? "#e0ddd8" : "#1a1a1a",
    textSub: dk ? "#aaa" : "#555",
    textMuted: dk ? "#888" : "#888",
    successText: dk ? "#6ee7a0" : "#16a34a",
    dangerText: dk ? "#f87171" : "#dc2626",
    inputBg: dk ? "#1e1e22" : "#fff",
    btnBg: dk ? "#e0ddd8" : "#1a1a1a",
    btnText: dk ? "#1a1a1e" : "#fff",
  };

  useEffect(() => {
    if (!classId || !studentId || !lessonId || !token) return;
    const headers = { Authorization: `Bearer ${token}` };
    let done = 0;
    const checkDone = () => { if (++done >= 3) setLoading(false); };

    fetch(`${API_BASE}/api/educator/lessons/${lessonId}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(setLesson)
      .catch(() => setLesson(null))
      .finally(checkDone);

    fetch(`${API_BASE}/api/educator/classes/${classId}/students/${studentId}/lessons/${lessonId}/work`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then((w: StudentWork | null) => {
        setWork(w);
        if (w?.score != null) setGradeInput(String(Math.round(w.score)));
      })
      .catch(() => setWork(null))
      .finally(checkDone);

    fetch(`${API_BASE}/api/educator/classes/${classId}/students`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then((students: { id: string; displayName: string }[]) => {
        const s = students.find(s => s.id === studentId);
        setStudent(s ? { id: s.id, displayName: s.displayName } : null);
      })
      .catch(() => setStudent(null))
      .finally(checkDone);
  }, [classId, studentId, lessonId, token]);

  const onErrorsComputed = useCallback((_: LessonErrorItem[]) => {}, []);
  const onRomansComputed = useCallback((_: string[][]) => {}, []);
  const onStudentRomansChanged = useCallback((_: Record<number, string>) => {}, []);
  const onBeatsChanged = useCallback((_treble: PlacedBeat[], _bass: PlacedBeat[]) => {}, []);

  function handleSaveGrade() {
    if (!classId || !studentId || !lessonId || !token || saving) return;
    const scoreVal = parseFloat(gradeInput);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) return;
    setSaving(true);
    fetch(`${API_BASE}/api/educator/classes/${classId}/students/${studentId}/lessons/${lessonId}/grade`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ score: scoreVal }),
    })
      .then(r => {
        if (r.ok) {
          setSaveFlash(true);
          setTimeout(() => setSaveFlash(false), 1500);
        }
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  if (!lesson || !work) {
    return <Navigate to={`/educator/classes/${classId}`} replace />;
  }

  const studentName = student?.displayName ?? "Student";
  const btnFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const backUrl = `/educator/classes/${classId}`;

  const lessonConfig: LessonConfig = {
    lockedTrebleBeats: lesson.sopranoBeats,
    lockedBassBeats: lesson.bassBeats,
    figuredBass: lesson.figuredBass,
    tonicIdx: lesson.tonicIdx,
    scaleName: lesson.scaleName,
    tsTop: lesson.tsTop,
    tsBottom: lesson.tsBottom,
    onErrorsComputed,
    onRomansComputed,
    onStudentRomansChanged,
    onBeatsChanged,
    checked: true,
    initialStudentRomans: work.studentRomans,
    showStudentRomans: true,
  };

  const gradeValid = (() => {
    const v = parseFloat(gradeInput);
    return !isNaN(v) && v >= 0 && v <= 100;
  })();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NoteEditor
        lessonConfig={lessonConfig}
        readOnly
        initialTrebleBeats={work.trebleBeats}
        initialBassBeats={work.bassBeats}
        header={
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              padding: "12px 0",
            }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <Link to={backUrl} style={{
                  fontSize: 13, color: theme.textMuted, textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  <span style={{ fontSize: 16 }}>&larr;</span> Class
                </Link>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "inherit" }}>
                  {lesson.title}
                </span>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  {studentName}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "inherit" }}>Grade:</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={gradeInput}
                    onChange={e => setGradeInput(e.target.value)}
                    style={{
                      width: 60,
                      padding: "5px 8px",
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: btnFont,
                      textAlign: "center",
                      border: `1px solid ${theme.cardBorder}`,
                      borderRadius: 6,
                      background: theme.inputBg,
                      color: "inherit",
                      outline: "none",
                    }}
                    onFocus={e => e.target.style.borderColor = theme.btnBg}
                    onBlur={e => e.target.style.borderColor = theme.cardBorder}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>%</span>
                  <button
                    onClick={handleSaveGrade}
                    disabled={saving || !gradeValid}
                    style={{
                      padding: "6px 16px", fontSize: 13, fontWeight: 600, fontFamily: btnFont,
                      background: theme.btnBg, color: theme.btnText,
                      border: "none", borderRadius: 6, cursor: gradeValid ? "pointer" : "default",
                      opacity: saving || !gradeValid ? 0.5 : 1,
                    }}
                  >
                    {saveFlash ? "Saved!" : saving ? "Saving..." : "Save Grade"}
                  </button>
                </div>
                <span style={{ fontSize: 13, opacity: 0.6 }}>{user?.displayName}</span>
                <button
                  onClick={logout}
                  style={{
                    padding: 0, fontSize: 12, background: "none", border: "none",
                    opacity: 0.6, color: "inherit", cursor: "pointer", fontFamily: btnFont,
                    textDecoration: "underline", textUnderlineOffset: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
                >
                  Sign out
                </button>
              </div>
            </div>
          </>
        }
      />
    </div>
  );
}
