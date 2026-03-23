import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { lessons } from "../data/lessons";
import { useState } from "react";

export function LessonList() {
  const { user, logout } = useAuth();
  const [darkMode] = useState(() => {
    try { return localStorage.getItem("contrapunctus_dark") === "true"; } catch { return false; }
  });
  const dk = darkMode;

  const theme = {
    bg: dk ? "#1e1e22" : "#e8e4e0",
    cardBg: dk ? "#2a2a30" : "#fff",
    cardBorder: dk ? "#3a3a40" : "#e0dcd8",
    cardShadow: dk ? "0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
    text: dk ? "#e0ddd8" : "#1a1a1a",
    textSub: dk ? "#aaa" : "#555",
    textMuted: dk ? "#888" : "#888",
    footerBg: dk ? "#222228" : "#f0ede9",
    footerBorder: dk ? "#3a3a40" : "#e0dcd8",
    accent: dk ? "#6ea4d4" : "#3a6ea5",
  };

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
