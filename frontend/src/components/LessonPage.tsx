import { useParams, Link, Navigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { NoteEditor, type LessonConfig, type PlacedBeat } from "./staff";
import { fetchLesson, type Lesson } from "../data/lessons";
import { useTheme } from "../useTheme";
import { normalizeRn } from "./staff/normalizeRn";
import { useLessonCallbacks } from "../hooks/useLessonCallbacks";

export function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchLesson(id)
      .then(setLesson)
      .catch(() => setLesson(null))
      .finally(() => setLoadingLesson(false));
  }, [id]);

  const {
    partWritingErrors, computedRomans, studentRomans, trebleBeats, bassBeats,
    onErrorsComputed, onRomansComputed, onStudentRomansChanged, onBeatsChanged,
  } = useLessonCallbacks();
  const [checked, setChecked] = useState(false);
  const [key, setKey] = useState(0);

  const theme = useTheme();
  const dk = theme.dk;

  const lessonConfig: LessonConfig | null = useMemo(() => {
    if (!lesson) return null;
    return {
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
      checked,
    };
  }, [lesson, onErrorsComputed, onRomansComputed, onStudentRomansChanged, onBeatsChanged, checked]);

  if (loadingLesson) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: 14 }}>Loading lesson...</div>;
  if (!lesson || !lessonConfig) return <Navigate to="/lessons" replace />;

  // Check completeness
  const isFiguredBass = lesson.template === "figured_bass";
  const isRomanNumeral = lesson.template === "roman_numeral_analysis";
  // For figured bass, only check beats where the locked bass has actual notes
  const lockedBeats = isFiguredBass ? (lesson.bassBeats ?? []) : lesson.sopranoBeats;
  const checkIndices: number[] = [];
  for (let i = 0; i < lockedBeats.length; i++) {
    const b = lockedBeats[i];
    if (!b.isRest && b.notes.length > 0) checkIndices.push(i);
  }

  const missingVoices: string[] = [];
  if (checked) {
    // For roman numeral analysis, students don't add notes — skip voice checks
    if (!isRomanNumeral) {
      for (const i of checkIndices) {
        const tb = trebleBeats[i];
        const bb = bassBeats[i];
        const trebleNotes = tb && !tb.isRest ? tb.notes.length : 0;
        const bassNotes = bb && !bb.isRest ? bb.notes.length : 0;
        const beatLabel = `Beat ${(i % lesson.tsTop) + 1}, m. ${Math.floor(i / lesson.tsTop) + 1}`;
        if (isFiguredBass) {
          if (trebleNotes < 2) {
            missingVoices.push(`${beatLabel}: missing soprano or alto`);
          }
          if (bassNotes < 2) {
            missingVoices.push(`${beatLabel}: missing tenor`);
          }
        } else {
          if (trebleNotes < 2) {
            missingVoices.push(`${beatLabel}: missing alto`);
          }
          if (bassNotes < 2) {
            missingVoices.push(`${beatLabel}: missing tenor or bass`);
          }
        }
      }
    }
    // Check RN entries
    for (const i of checkIndices) {
      const val = (studentRomans[i] ?? "").trim();
      if (!val) {
        missingVoices.push(`Beat ${(i % lesson.tsTop) + 1}, m. ${Math.floor(i / lesson.tsTop) + 1}: missing roman numeral`);
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
          <>
            {/* Error summary panel — shown when checked and there are issues */}
            {checked && !passed && (
              <div style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${theme.cardBorder}`,
                maxHeight: 180,
                overflowY: "auto",
                fontSize: 13,
              }}>
                {/* Incomplete */}
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

                {/* RN errors */}
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

                {/* Part-writing errors */}
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

            {/* Success banner */}
            {checked && passed && (
              <div style={{
                padding: "10px 16px",
                borderBottom: `1px solid ${theme.successBorder}`,
                background: theme.successBg,
                textAlign: "center",
                fontSize: 14, fontWeight: 600, color: theme.successText,
              }}>
                All correct! Your harmonization and roman numeral analysis are both correct.
              </div>
            )}

            {/* Bottom bar */}
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
                    {passed && (
                      <Link to="/lessons" style={{
                        padding: "6px 16px", fontSize: 13, fontWeight: 600, fontFamily: btnFont,
                        background: "none", color: "inherit",
                        border: `1px solid ${theme.cardBorder}`,
                        borderRadius: 6, textDecoration: "none",
                        display: "inline-flex", alignItems: "center",
                      }}>
                        Next
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        }
      />
    </div>
  );
}
