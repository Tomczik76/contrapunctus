import { Link } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { useEffect, useState } from "react";
import { useTheme } from "../useTheme";

interface EnrolledClass {
  id: string;
  name: string;
  educatorName: string;
  totalLessons: number;
  completedLessons: number;
}

export function Dashboard() {
  const { user, token } = useAuth();
  const theme = useTheme();
  const dk = theme.dk;
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClass[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/student/classes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setEnrolledClasses)
      .catch(() => {});
  }, [token]);

  const cardStyle: React.CSSProperties = {
    background: theme.cardBg,
    borderRadius: 12,
    padding: "32px 28px",
    boxShadow: theme.cardShadow,
    border: `1px solid ${theme.cardBorder}`,
    textDecoration: "none",
    color: theme.text,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    cursor: "pointer",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.bg, color: theme.text }}>
      {/* Header area */}
      <div style={{
        padding: "48px 24px 0",
        maxWidth: 700,
        margin: "0 auto",
        width: "100%",
        textAlign: "center",
      }}>
        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: -0.5,
          marginBottom: 6,
        }}>
          Contrapunctus
        </h1>
        <p style={{ fontSize: 14, color: theme.textMuted, margin: "0 0 40px" }}>
          Welcome back, {user?.displayName}
        </p>
      </div>

      {/* Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 24,
        maxWidth: 700,
        margin: "0 auto",
        padding: "0 24px 48px",
        width: "100%",
      }}>
        <Link to="/editor" style={cardStyle}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
        >
          <span style={{ fontSize: 28, marginBottom: 4 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="8" x2="24" y2="8" />
              <line x1="4" y1="12" x2="24" y2="12" />
              <line x1="4" y1="16" x2="24" y2="16" />
              <line x1="4" y1="20" x2="24" y2="20" />
              <line x1="4" y1="24" x2="24" y2="24" />
              <ellipse cx="16" cy="14" rx="3.5" ry="2.5" fill="currentColor" stroke="none" transform="rotate(-15 16 14)" />
            </svg>
          </span>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Composition Editor</span>
          <span style={{ fontSize: 13, color: theme.textSub, lineHeight: 1.5 }}>
            Free-form composition with real-time harmonic analysis
          </span>
        </Link>

        <Link to="/community" style={cardStyle}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
        >
          <span style={{ fontSize: 28, marginBottom: 4 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="11" r="3.5" />
              <circle cx="19" cy="11" r="3.5" />
              <path d="M4 23 C4 19 6 17 9 17 C12 17 14 19 14 23" />
              <path d="M14 23 C14 19 16 17 19 17 C22 17 24 19 24 23" />
            </svg>
          </span>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Community</span>
          <span style={{ fontSize: 13, color: theme.textSub, lineHeight: 1.5 }}>
            Create and attempt exercises, earn points, climb the leaderboard
          </span>
        </Link>

        {user?.isEducator && (
          <Link to="/educator" style={{ ...cardStyle, gridColumn: "1 / -1" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
          >
            <span style={{ fontSize: 28, marginBottom: 4 }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="14" cy="10" r="4" />
                <path d="M7 24 C7 20 10 17 14 17 C18 17 21 20 21 24" />
                <line x1="22" y1="8" x2="22" y2="14" />
                <line x1="19" y1="11" x2="25" y2="11" />
              </svg>
            </span>
            <span style={{ fontSize: 17, fontWeight: 700 }}>Educator Dashboard</span>
            <span style={{ fontSize: 13, color: theme.textSub, lineHeight: 1.5 }}>
              Manage classes, create lessons, and track student progress
            </span>
          </Link>
        )}
      </div>

      {/* My Classes */}
      {enrolledClasses.length > 0 && (
        <div style={{
          maxWidth: 700,
          margin: "0 auto",
          padding: "0 24px 48px",
          width: "100%",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, letterSpacing: -0.3 }}>My Classes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {enrolledClasses.map(cls => (
              <Link
                key={cls.id}
                to={`/classes/${cls.id}`}
                style={{
                  ...cardStyle,
                  padding: "20px 24px",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{cls.name}</div>
                  <div style={{ fontSize: 13, color: theme.textSub }}>{cls.educatorName}</div>
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: cls.completedLessons === cls.totalLessons && cls.totalLessons > 0
                    ? (dk ? "#6ee7a0" : "#16a34a")
                    : theme.textSub,
                  whiteSpace: "nowrap",
                }}>
                  {cls.completedLessons}/{cls.totalLessons} completed
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
