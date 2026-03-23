import { useParams, Link, Navigate } from "react-router-dom";
import { useState, useCallback } from "react";
import { useAuth } from "../auth";
import { NoteEditor, type LessonConfig, type LessonErrorItem, type PlacedBeat } from "./Staff";
import { lessons } from "../data/lessons";

/** Normalize an RN string for comparison: trim, collapse spaces, lowercase for case-insensitive match on quality. */
function normalizeRn(rn: string): string {
  return rn.trim().replace(/\s+/g, "");
}

export function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const lesson = lessons.find((l) => l.id === id);

  const [partWritingErrors, setPartWritingErrors] = useState<LessonErrorItem[]>([]);
  const [computedRomans, setComputedRomans] = useState<string[][]>([]);
  const [studentRomans, setStudentRomans] = useState<Record<number, string>>({});
  const [trebleBeats, setTrebleBeats] = useState<PlacedBeat[]>([]);
  const [bassBeats, setBassBeats] = useState<PlacedBeat[]>([]);
  const [checked, setChecked] = useState(false);
  const [key, setKey] = useState(0);

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

  if (!lesson) return <Navigate to="/lessons" replace />;

  const lessonConfig: LessonConfig = {
    lockedTrebleBeats: lesson.sopranoBeats,
    tonicIdx: lesson.tonicIdx,
    scaleName: lesson.scaleName,
    tsTop: lesson.tsTop,
    tsBottom: lesson.tsBottom,
    onErrorsComputed,
    onRomansComputed,
    onStudentRomansChanged,
    onBeatsChanged,
  };

  // Check completeness: every soprano beat needs notes in both treble and bass
  const incompleteBeatCount = lesson.sopranoBeats.length;
  const missingVoices: string[] = [];
  if (checked) {
    for (let i = 0; i < incompleteBeatCount; i++) {
      const tb = trebleBeats[i];
      const bb = bassBeats[i];
      // Treble should have at least 2 notes (soprano + alto)
      const trebleNotes = tb && !tb.isRest ? tb.notes.length : 0;
      const bassNotes = bb && !bb.isRest ? bb.notes.length : 0;
      if (trebleNotes < 2) {
        missingVoices.push(`Beat ${(i % (lesson.tsTop)) + 1}, m. ${Math.floor(i / lesson.tsTop) + 1}: missing alto`);
      }
      if (bassNotes < 2) {
        missingVoices.push(`Beat ${(i % (lesson.tsTop)) + 1}, m. ${Math.floor(i / lesson.tsTop) + 1}: missing tenor or bass`);
      } else if (bassNotes < 1) {
        missingVoices.push(`Beat ${(i % (lesson.tsTop)) + 1}, m. ${Math.floor(i / lesson.tsTop) + 1}: missing bass voices`);
      }
    }
    // Check RN entries
    for (let i = 0; i < incompleteBeatCount; i++) {
      const val = (studentRomans[i] ?? "").trim();
      if (!val) {
        missingVoices.push(`Beat ${(i % (lesson.tsTop)) + 1}, m. ${Math.floor(i / lesson.tsTop) + 1}: missing roman numeral`);
      }
    }
  }

  const isIncomplete = missingVoices.length > 0;

  // Compute RN comparison results when checked
  const rnResults: { beat: number; student: string; expected: string; correct: boolean }[] = [];
  if (checked) {
    for (let i = 0; i < computedRomans.length; i++) {
      const expected = computedRomans[i];
      if (!expected || expected.length === 0) continue;
      const studentVal = (studentRomans[i] ?? "").trim();
      // Check if the student's answer matches any of the possible RN labels
      const correct = studentVal !== "" && expected.some(
        (rn) => normalizeRn(rn) === normalizeRn(studentVal)
      );
      rnResults.push({
        beat: i,
        student: studentVal || "(empty)",
        expected: expected[0],
        correct,
      });
    }
  }

  const rnErrors = rnResults.filter((r) => !r.correct);
  const totalErrors = partWritingErrors.length + rnErrors.length + missingVoices.length;
  const passed = checked && !isIncomplete && totalErrors === 0;

  const btnFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NoteEditor
        key={key}
        lessonConfig={lessonConfig}
        header={
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Link to="/lessons" style={{
                fontSize: 13, color: theme.textMuted, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                <span style={{ fontSize: 16 }}>&larr;</span> Lessons
              </Link>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "inherit", textAlign: "center", whiteSpace: "nowrap" }}>
              {lesson.title}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
              {!checked ? (
                <button
                  onClick={() => setChecked(true)}
                  style={{
                    padding: "6px 16px", fontSize: 13, fontWeight: 600, fontFamily: btnFont,
                    background: dk ? "#e0ddd8" : "#1a1a1a",
                    color: dk ? "#1a1a1e" : "#fff",
                    border: "none", borderRadius: 6, cursor: "pointer",
                  }}
                >
                  Check
                </button>
              ) : (
                <>
                  <span style={{
                    fontSize: 13, fontWeight: 600,
                    color: passed ? theme.successText : theme.errorText,
                  }}>
                    {passed ? "All correct!" : `${totalErrors} issue${totalErrors !== 1 ? "s" : ""}`}
                  </span>
                  <button
                    onClick={() => setChecked(false)}
                    style={{
                      padding: "6px 16px", fontSize: 13, fontWeight: 600, fontFamily: btnFont,
                      background: "none", color: "inherit",
                      border: `1px solid ${theme.cardBorder}`, borderRadius: 6, cursor: "pointer",
                    }}
                  >
                    Keep Editing
                  </button>
                  <button
                    onClick={() => { setChecked(false); setKey((k) => k + 1); }}
                    style={{
                      padding: "6px 16px", fontSize: 13, fontWeight: 600, fontFamily: btnFont,
                      background: dk ? "#e0ddd8" : "#1a1a1a",
                      color: dk ? "#1a1a1e" : "#fff",
                      border: "none", borderRadius: 6, cursor: "pointer",
                    }}
                  >
                    Try Again
                  </button>
                </>
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
        }
      />

      {/* Results overlay */}
      {checked && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}
          onClick={() => setChecked(false)}
        >
          <div
            style={{
              background: theme.cardBg,
              borderRadius: 12, padding: "32px",
              maxWidth: 520, width: "90%", maxHeight: "80vh", overflowY: "auto",
              color: theme.text,
              border: `2px solid ${passed ? theme.successBorder : theme.errorBorder}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {passed ? (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: theme.successText }}>
                  All correct!
                </h2>
                <p style={{ fontSize: 14, color: theme.textSub, marginBottom: 24, lineHeight: 1.5 }}>
                  Your harmonization and roman numeral analysis are both correct. Well done!
                </p>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: theme.errorText }}>
                  {totalErrors} issue{totalErrors !== 1 ? "s" : ""} found
                </h2>

                {/* Missing voices / RN entries */}
                {missingVoices.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: theme.textMuted }}>
                      Incomplete ({missingVoices.length})
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {missingVoices.map((msg, i) => (
                        <div key={i} style={{
                          fontSize: 13, padding: "8px 12px", borderRadius: 6,
                          background: dk ? "rgba(160,160,160,0.12)" : "rgba(0,0,0,0.04)",
                        }}>
                          {msg}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RN errors */}
                {rnErrors.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: theme.warnText }}>
                      Roman Numeral Analysis ({rnErrors.length})
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {rnErrors.map((r, i) => (
                        <div key={i} style={{
                          fontSize: 13, padding: "8px 12px", borderRadius: 6,
                          background: theme.warnBg,
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                        }}>
                          <span>
                            Beat {r.beat + 1}: you wrote <strong style={{ fontFamily: "serif", fontStyle: "italic" }}>{r.student}</strong>,
                            expected <strong style={{ fontFamily: "serif", fontStyle: "italic" }}>{r.expected}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Part-writing errors */}
                {partWritingErrors.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: theme.errorText }}>
                      Part-Writing Errors ({partWritingErrors.length})
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {partWritingErrors.map((err, i) => (
                        <div key={i} style={{
                          fontSize: 13, padding: "8px 12px", borderRadius: 6,
                          background: theme.errorBg,
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                        }}>
                          <span style={{ fontWeight: 600 }}>{err.fullName}</span>
                          <span style={{ color: theme.textMuted, fontSize: 12, whiteSpace: "nowrap" }}>{err.location}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              {!passed && (
                <button
                  onClick={() => setChecked(false)}
                  style={{
                    padding: "8px 20px", fontSize: 13, fontWeight: 600, fontFamily: btnFont,
                    background: "none", color: "inherit",
                    border: `1px solid ${theme.cardBorder}`, borderRadius: 6, cursor: "pointer",
                  }}
                >
                  Keep Editing
                </button>
              )}
              <button
                onClick={() => { setChecked(false); setKey((k) => k + 1); }}
                style={{
                  padding: "8px 20px", fontSize: 13, fontWeight: 600, fontFamily: btnFont,
                  background: dk ? "#e0ddd8" : "#1a1a1a",
                  color: dk ? "#1a1a1e" : "#fff",
                  border: "none", borderRadius: 6, cursor: "pointer",
                }}
              >
                {passed ? "Try Again" : "Reset & Try Again"}
              </button>
              {passed && (
                <Link to="/lessons" style={{
                  padding: "8px 20px", fontSize: 13, fontWeight: 600, fontFamily: btnFont,
                  background: "none", color: "inherit",
                  border: `1px solid ${theme.cardBorder}`,
                  borderRadius: 6, textDecoration: "none",
                  display: "inline-flex", alignItems: "center",
                }}>
                  Back to Lessons
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
