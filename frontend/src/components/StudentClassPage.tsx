import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { useTheme } from "../useTheme";

interface StudentLesson {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  template: string;
  sortOrder: number;
  score: number | null;
  workStatus: string | null; // "draft" | "submitted" | null
}

const templateLabels: Record<string, string> = {
  harmonize_melody: "Melody Harmonization",
  figured_bass: "Figured Bass",
  roman_numeral_analysis: "Roman Numeral Analysis",
};

export function StudentClassPage() {
  const { classId } = useParams<{ classId: string }>();
  const { token } = useAuth();
  const theme = useTheme();

  const [lessons, setLessons] = useState<StudentLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!classId) return;
    fetch(`${API_BASE}/api/student/classes/${classId}/lessons`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => { setLessons(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [classId, token]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: theme.bg, color: theme.textMuted, fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  if (error) return <Navigate to="/" replace />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.bg, color: theme.text }}>
      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${theme.headerBorder}`,
        background: theme.headerBg,
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <Link to="/" style={{
          fontSize: 13, color: theme.textMuted, textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <span style={{ fontSize: 16 }}>&larr;</span> Home
        </Link>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>
          Class Lessons
        </span>
      </header>

      {/* Lesson list */}
      <div style={{ flex: 1, padding: "32px 40px", maxWidth: 800, margin: "0 auto", width: "100%" }}>
        {lessons.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "48px 24px",
            color: theme.textMuted,
            fontSize: 14,
          }}>
            No lessons have been assigned to this class yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {lessons.map((lesson, idx) => {
              const status = lesson.workStatus === "submitted"
                ? "completed"
                : lesson.workStatus === "draft"
                  ? "in_progress"
                  : "not_started";

              return (
                <Link
                  key={lesson.id}
                  to={`/classes/${classId}/lessons/${lesson.id}`}
                  style={{
                    background: theme.cardBg,
                    border: `1px solid ${theme.cardBorder}`,
                    borderRadius: 10,
                    padding: "20px 24px",
                    boxShadow: theme.cardShadow,
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    transition: "transform 0.12s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
                >
                  {/* Number */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, flexShrink: 0,
                    background: status === "completed"
                      ? theme.successBg
                      : theme.badgeBg,
                    color: status === "completed"
                      ? theme.successText
                      : theme.textMuted,
                    border: `1px solid ${status === "completed" ? theme.successText : theme.cardBorder}`,
                  }}>
                    {status === "completed" ? "\u2713" : idx + 1}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>{lesson.title}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                        background: theme.badgeBg, color: theme.textMuted,
                      }}>
                        {lesson.difficulty}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: theme.textSub, marginBottom: 4 }}>
                      {lesson.description}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>
                      {templateLabels[lesson.template] || lesson.template}
                    </div>
                  </div>

                  {/* Status / Score */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {status === "completed" && (
                      <div style={{ fontSize: 14, fontWeight: 700, color: theme.successText }}>
                        {lesson.score !== null ? `${Math.round(lesson.score)}%` : "Submitted"}
                      </div>
                    )}
                    {status === "in_progress" && (
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.warnText }}>
                        Draft saved
                      </div>
                    )}
                    {status === "not_started" && (
                      <div style={{ fontSize: 13, color: theme.textMuted }}>
                        Not started
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
