import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useState, useEffect } from "react";
import { fetchLessons, type Lesson } from "../data/lessons";
import { useTheme } from "../useTheme";

export function LessonList() {
  const { user, logout } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const theme = useTheme();
  const dk = theme.dk;

  useEffect(() => {
    fetchLessons()
      .then(setLessons)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const difficultyColors: Record<string, string> = {
    beginner: dk ? "#6ee7a0" : "#16a34a",
    intermediate: dk ? "#fbbf24" : "#d97706",
    advanced: dk ? "#f87171" : "#dc2626",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.bg, color: theme.text }}>
      <div style={{
        padding: "48px 24px 0",
        maxWidth: 700,
        margin: "0 auto",
        width: "100%",
      }}>
        <Link to="/" style={{
          fontSize: 13, color: theme.textMuted, textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 24,
        }}>
          <span style={{ fontSize: 16 }}>&larr;</span> Back to Dashboard
        </Link>

        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: -0.5,
          marginBottom: 8,
        }}>
          Lessons
        </h1>
        <p style={{ fontSize: 14, color: theme.textSub, margin: "0 0 32px" }}>
          Practice 4-part harmony through guided exercises.
        </p>

        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: theme.textMuted, fontSize: 14 }}>
            Loading lessons...
          </div>
        )}

        {error && (
          <div style={{ padding: 40, textAlign: "center", color: "#dc2626", fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 100 }}>
          {lessons.map((lesson) => (
            <Link
              key={lesson.id}
              to={`/lessons/${lesson.id}`}
              style={{
                background: theme.cardBg,
                borderRadius: 10,
                padding: "20px 24px",
                boxShadow: theme.cardShadow,
                border: `1px solid ${theme.cardBorder}`,
                textDecoration: "none",
                color: theme.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{lesson.title}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
                    color: difficultyColors[lesson.difficulty],
                    textTransform: "uppercase",
                  }}>
                    {lesson.difficulty}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: theme.textSub, margin: 0, lineHeight: 1.5 }}>
                  {lesson.description}
                </p>
              </div>
              <span style={{ fontSize: 18, color: theme.textMuted, flexShrink: 0 }}>&rarr;</span>
            </Link>
          ))}
          {!loading && !error && lessons.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: theme.textMuted, fontSize: 14 }}>
              No lessons available yet.
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: "auto" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: theme.footerBg,
        borderTop: `1px solid ${theme.footerBorder}`,
        padding: "16px 24px", color: theme.text,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 700,
          margin: "0 auto",
        }}>
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
      </div>
    </div>
  );
}
