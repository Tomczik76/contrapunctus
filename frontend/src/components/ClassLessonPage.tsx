import { useParams, Link, Navigate } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import { useAuth, API_BASE } from "../auth";
import { NoteEditor, type LessonConfig, type LessonErrorItem, type PlacedBeat } from "./staff";

interface ClassLesson {
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

interface SavedWork {
  trebleBeats: PlacedBeat[];
  bassBeats: PlacedBeat[];
  studentRomans: Record<number, string>;
  score: number | null;
  status: string; // "draft" | "submitted"
}

function normalizeRn(rn: string): string {
  return rn
    .trim()
    .replace(/\s+/g, "")
    .replace(/°/g, "°")
    .replace(/([iIvV])(o)(?=\d|$)/g, "$1°")
    .replace(/([iIvV])(0)(?=\d|$)/g, "$1ø")
    .replace(/⁰/g, "0").replace(/¹/g, "1").replace(/²/g, "2").replace(/³/g, "3")
    .replace(/⁴/g, "4").replace(/⁵/g, "5").replace(/⁶/g, "6").replace(/⁷/g, "7")
    .replace(/⁸/g, "8").replace(/⁹/g, "9")
    .replace(/₀/g, "0").replace(/₁/g, "1").replace(/₂/g, "2").replace(/₃/g, "3")
    .replace(/₄/g, "4").replace(/₅/g, "5").replace(/₆/g, "6").replace(/₇/g, "7")
    .replace(/₈/g, "8").replace(/₉/g, "9");
}

export function ClassLessonPage() {
  const { classId, lessonId } = useParams<{ classId: string; lessonId: string }>();
  const { user, token, logout } = useAuth();
  const [lesson, setLesson] = useState<ClassLesson | null>(null);
  const [savedWork, setSavedWork] = useState<SavedWork | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(true);
  const [loadingWork, setLoadingWork] = useState(true);

  // Fetch lesson and saved work in parallel
  useEffect(() => {
    if (!classId || !lessonId || !token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API_BASE}/api/student/classes/${classId}/lessons/${lessonId}`, { headers })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setLesson)
      .catch(() => setLesson(null))
      .finally(() => setLoadingLesson(false));

    fetch(`${API_BASE}/api/student/classes/${classId}/lessons/${lessonId}/work`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(setSavedWork)
      .catch(() => setSavedWork(null))
      .finally(() => setLoadingWork(false));
  }, [classId, lessonId, token]);

  const [partWritingErrors, setPartWritingErrors] = useState<LessonErrorItem[]>([]);
  const [computedRomans, setComputedRomans] = useState<string[][]>([]);
  const [studentRomans, setStudentRomans] = useState<Record<number, string>>({});
  const [trebleBeats, setTrebleBeats] = useState<PlacedBeat[]>([]);
  const [bassBeats, setBassBeats] = useState<PlacedBeat[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
    footerBg: dk ? "#222228" : "#f0ede9",
    footerBorder: dk ? "#3a3a40" : "#e0dcd8",
    successBg: dk ? "rgba(22,163,74,0.15)" : "rgba(22,163,74,0.08)",
    successBorder: dk ? "#22c55e" : "#16a34a",
    successText: dk ? "#6ee7a0" : "#16a34a",
    errorBg: dk ? "rgba(220,38,38,0.15)" : "rgba(220,38,38,0.08)",
    errorBorder: dk ? "#f87171" : "#dc2626",
    errorText: dk ? "#fca5a5" : "#dc2626",
    warnBg: dk ? "rgba(234,179,8,0.15)" : "rgba(234,179,8,0.08)",
    warnText: dk ? "#fbbf24" : "#d97706",
  };

  const onErrorsComputed = useCallback((errs: LessonErrorItem[]) => {
    setPartWritingErrors(errs);
  }, []);

  const onRomansComputed = useCallback((romans: string[][]) => {
    setComputedRomans(romans);
  }, []);

  const onStudentRomansChanged = useCallback((sr: Record<number, string>) => {
    setStudentRomans(sr);
  }, []);

  const onBeatsChanged = useCallback((treble: PlacedBeat[], bass: PlacedBeat[]) => {
    setTrebleBeats(treble);
    setBassBeats(bass);
  }, []);

  // Determine if already submitted (from server)
  const alreadySubmitted = savedWork?.status === "submitted";
  const isReadOnly = submitted || alreadySubmitted;

  // Score/check computation — safe when lesson is null
  const isFiguredBass = lesson?.template === "figured_bass";
  const isRomanNumeral = lesson?.template === "roman_numeral_analysis";
  const lockedBeats = lesson ? (isFiguredBass ? (lesson.bassBeats ?? []) : lesson.sopranoBeats) : [];
  const checkIndices: number[] = [];
  for (let i = 0; i < lockedBeats.length; i++) {
    const b = lockedBeats[i];
    if (!b.isRest && b.notes.length > 0) checkIndices.push(i);
  }

  const missingVoices: string[] = [];
  if (isReadOnly && lesson) {
    if (!isRomanNumeral) {
      for (const i of checkIndices) {
        const tb = trebleBeats[i];
        const bb = bassBeats[i];
        const trebleNotes = tb && !tb.isRest ? tb.notes.length : 0;
        const bassNotes = bb && !bb.isRest ? bb.notes.length : 0;
        const beatLabel = `Beat ${(i % lesson.tsTop) + 1}, m. ${Math.floor(i / lesson.tsTop) + 1}`;
        if (isFiguredBass) {
          if (trebleNotes < 2) missingVoices.push(`${beatLabel}: missing soprano or alto`);
          if (bassNotes < 2) missingVoices.push(`${beatLabel}: missing tenor`);
        } else {
          if (trebleNotes < 2) missingVoices.push(`${beatLabel}: missing alto`);
          if (bassNotes < 2) missingVoices.push(`${beatLabel}: missing tenor or bass`);
        }
      }
    }
    for (const i of checkIndices) {
      const val = (studentRomans[i] ?? "").trim();
      if (!val) {
        missingVoices.push(`Beat ${(i % lesson.tsTop) + 1}, m. ${Math.floor(i / lesson.tsTop) + 1}: missing roman numeral`);
      }
    }
  }

  const isIncomplete = missingVoices.length > 0;

  const rnResults: { beat: number; student: string; expected: string; correct: boolean }[] = [];
  if (isReadOnly) {
    for (let i = 0; i < computedRomans.length; i++) {
      const expected = computedRomans[i];
      if (!expected || expected.length === 0) continue;
      const studentVal = (studentRomans[i] ?? "").trim();
      const correct = studentVal !== "" && expected.some(
        (rn) => normalizeRn(rn) === normalizeRn(studentVal)
      );
      rnResults.push({ beat: i, student: studentVal || "(empty)", expected: expected[0], correct });
    }
  }

  const rnErrors = rnResults.filter(r => !r.correct);

  // Submit to backend after confirming
  useEffect(() => {
    if (!submitted || alreadySubmitted) return;
    if (!classId || !lessonId || !token) return;
    fetch(`${API_BASE}/api/student/classes/${classId}/lessons/${lessonId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    }).catch(() => {});
  }, [submitted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Early returns — after all hooks
  const loading = loadingLesson || loadingWork;
  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 14 }}>Loading lesson...</div>;
  if (!lesson) return <Navigate to={`/classes/${classId}`} replace />;

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
    checked: isReadOnly,
    initialStudentRomans: savedWork?.studentRomans,
  };

  function handleSave() {
    if (!classId || !lessonId || !token || saving) return;
    setSaving(true);
    fetch(`${API_BASE}/api/student/classes/${classId}/lessons/${lessonId}/work`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trebleBeats, bassBeats, studentRomans }),
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

  function handleSubmit() {
    if (!classId || !lessonId || !token) return;
    // Save work first, then submit
    setSaving(true);
    fetch(`${API_BASE}/api/student/classes/${classId}/lessons/${lessonId}/work`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trebleBeats, bassBeats, studentRomans }),
    })
      .then(() => {
        setConfirming(false);
        setSubmitted(true);
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  }

  const btnFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const backUrl = `/classes/${classId}`;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Confirmation modal */}
      {confirming && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.5)",
        }}>
          <div style={{
            background: dk ? "#2a2a30" : "#fff",
            borderRadius: 12,
            padding: "32px 28px",
            maxWidth: 400,
            width: "90%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            color: theme.text,
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Submit your work?</h3>
            <p style={{ fontSize: 14, color: theme.textSub, marginBottom: 24, lineHeight: 1.5 }}>
              Once submitted, your work will be graded and you won't be able to edit it. Make sure you're satisfied with your answer.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirming(false)}
                style={{
                  padding: "8px 20px", fontSize: 14, fontWeight: 600, fontFamily: btnFont,
                  background: "none", color: theme.text,
                  border: `1px solid ${theme.cardBorder}`, borderRadius: 6, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  padding: "8px 20px", fontSize: 14, fontWeight: 600, fontFamily: btnFont,
                  background: dk ? "#e0ddd8" : "#1a1a1a",
                  color: dk ? "#1a1a1e" : "#fff",
                  border: "none", borderRadius: 6, cursor: "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <NoteEditor
        lessonConfig={lessonConfig}
        readOnly={isReadOnly}
        initialTrebleBeats={savedWork?.trebleBeats}
        initialBassBeats={savedWork?.bassBeats}
        header={
          <>
            {/* Error summary panel */}
            {isReadOnly && (missingVoices.length > 0 || rnErrors.length > 0 || partWritingErrors.length > 0) && (
              <div style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${theme.cardBorder}`,
                maxHeight: 180,
                overflowY: "auto",
                fontSize: 13,
              }}>
                {missingVoices.length > 0 && (
                  <div style={{ marginBottom: rnErrors.length > 0 || partWritingErrors.length > 0 ? 10 : 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: theme.textMuted }}>
                      Incomplete ({missingVoices.length})
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {missingVoices.map((msg, i) => (
                        <span key={i} style={{
                          padding: "3px 8px", borderRadius: 4, fontSize: 12,
                          background: dk ? "rgba(160,160,160,0.12)" : "rgba(0,0,0,0.04)",
                        }}>
                          {msg}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {rnErrors.length > 0 && (
                  <div style={{ marginBottom: partWritingErrors.length > 0 ? 10 : 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: theme.warnText }}>
                      Roman Numeral Analysis ({rnErrors.length})
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {rnErrors.map((r, i) => (
                        <span key={i} style={{
                          padding: "3px 8px", borderRadius: 4, fontSize: 12,
                          background: theme.warnBg,
                        }}>
                          Beat {r.beat + 1}: <em>{r.student}</em> &rarr; <em>{r.expected}</em>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {partWritingErrors.length > 0 && (
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 12, color: theme.errorText }}>
                      Part-Writing ({partWritingErrors.length})
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {partWritingErrors.map((err, i) => (
                        <span key={i} style={{
                          padding: "3px 8px", borderRadius: 4, fontSize: 12,
                          background: theme.errorBg,
                        }}>
                          <strong>{err.fullName}</strong>
                          <span style={{ color: theme.textMuted, marginLeft: 6, fontSize: 11 }}>{err.location}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submitted banner */}
            {isReadOnly && (
              <div style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${theme.cardBorder}`,
                textAlign: "center",
                fontSize: 14, fontWeight: 600, color: theme.textMuted,
              }}>
                {alreadySubmitted && savedWork?.score != null
                  ? <>Graded: <span style={{ color: theme.text }}>{Math.round(savedWork.score)}%</span></>
                  : "Submitted — awaiting grade"}
              </div>
            )}

            {/* Bottom bar */}
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
              <span style={{ fontSize: 14, fontWeight: 600, color: "inherit", textAlign: "center", whiteSpace: "nowrap" }}>
                {lesson.title}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
                {!isReadOnly ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      style={{
                        padding: "6px 16px", fontSize: 13, fontWeight: 600, fontFamily: btnFont,
                        background: "none", color: "inherit",
                        border: `1px solid ${theme.cardBorder}`, borderRadius: 6, cursor: "pointer",
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saveFlash ? "Saved!" : saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setConfirming(true)}
                      style={{
                        padding: "6px 16px", fontSize: 13, fontWeight: 600, fontFamily: btnFont,
                        background: dk ? "#e0ddd8" : "#1a1a1a",
                        color: dk ? "#1a1a1e" : "#fff",
                        border: "none", borderRadius: 6, cursor: "pointer",
                      }}
                    >
                      Submit
                    </button>
                  </>
                ) : (
                  <Link to={backUrl} style={{
                    padding: "6px 16px", fontSize: 13, fontWeight: 600, fontFamily: btnFont,
                    background: "none", color: "inherit",
                    border: `1px solid ${theme.cardBorder}`,
                    borderRadius: 6, textDecoration: "none",
                    display: "inline-flex", alignItems: "center",
                  }}>
                    Back to Class
                  </Link>
                )}
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
