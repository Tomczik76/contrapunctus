import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";

interface ClassInfo {
  id: string;
  name: string;
  status: string;
  educatorId: string;
  educatorName: string;
  enrolled?: boolean;
  isOwner?: boolean;
}

export function JoinPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_BASE}/api/join/${inviteCode}`, { headers })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(data.error || "Class not found");
        } else {
          setClassInfo(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load class information");
        setLoading(false);
      });
  }, [inviteCode, token]);

  async function handleJoin() {
    setJoining(true);
    setError(null);
    const res = await fetch(`${API_BASE}/api/join/${inviteCode}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to join class");
      setJoining(false);
    } else {
      setJoined(true);
      setJoining(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 440,
    background: "#fff",
    borderRadius: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
    padding: "40px 36px",
    textAlign: "center",
  };

  const btnStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "12px 32px",
    fontSize: 16,
    fontWeight: 700,
    color: "#fff",
    background: "#1a1a1a",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
    textDecoration: "none",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <p style={{ color: "#666", fontSize: 14 }}>Loading...</p>
      </div>
    );
  }

  if (error && !classInfo) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: "#1a1a1a" }}>
            Unable to Join
          </h1>
          <p style={{ fontSize: 15, color: "#555", marginBottom: 24 }}>{error}</p>
          <Link to="/" style={{ ...btnStyle, background: "none", color: "#1a1a1a", border: "1px solid #ccc", padding: "10px 24px", fontSize: 14 }}>
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!classInfo) return null;

  // Joined successfully
  if (joined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>
            You're in!
          </h1>
          <p style={{ fontSize: 15, color: "#555", marginBottom: 24 }}>
            You've joined <strong>{classInfo.name}</strong>.
          </p>
          <Link to="/" style={btnStyle}>
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={cardStyle}>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
            You've been invited to join
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>
            {classInfo.name}
          </h1>
          <p style={{ fontSize: 15, color: "#555", marginBottom: 32 }}>
            Taught by {classInfo.educatorName}
          </p>
          {classInfo.status !== "active" ? (
            <p style={{ fontSize: 14, color: "#c0392b" }}>
              This class is no longer accepting new students.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              <Link
                to={`/signup?redirect=/join/${inviteCode}`}
                style={btnStyle}
              >
                Create Account
              </Link>
              <Link
                to={`/login?redirect=/join/${inviteCode}`}
                style={{ fontSize: 14, color: "#1a1a1a", fontWeight: 700 }}
              >
                Already have an account? Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Logged in, already enrolled
  if (classInfo.enrolled) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>
            Already Enrolled
          </h1>
          <p style={{ fontSize: 15, color: "#555", marginBottom: 24 }}>
            You're already a member of <strong>{classInfo.name}</strong>.
          </p>
          <Link to="/" style={btnStyle}>
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Logged in, is the educator who owns this class
  if (classInfo.isOwner) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>
            This is Your Class
          </h1>
          <p style={{ fontSize: 15, color: "#555", marginBottom: 24 }}>
            You're the educator for <strong>{classInfo.name}</strong>. You can't enroll as a student in your own class.
          </p>
          <Link to="/educator/classes" style={btnStyle}>
            Go to Educator Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Logged in, class archived
  if (classInfo.status !== "active") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>
            Class Archived
          </h1>
          <p style={{ fontSize: 15, color: "#555", marginBottom: 24 }}>
            <strong>{classInfo.name}</strong> is no longer accepting new students.
          </p>
          <Link to="/" style={{ ...btnStyle, background: "none", color: "#1a1a1a", border: "1px solid #ccc", padding: "10px 24px", fontSize: 14 }}>
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Logged in, can join
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
      <div style={cardStyle}>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
          You've been invited to join
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>
          {classInfo.name}
        </h1>
        <p style={{ fontSize: 15, color: "#555", marginBottom: 32 }}>
          Taught by {classInfo.educatorName}
        </p>
        {error && <p style={{ fontSize: 14, color: "#c0392b", marginBottom: 16 }}>{error}</p>}
        <button
          onClick={handleJoin}
          disabled={joining}
          style={{ ...btnStyle, opacity: joining ? 0.6 : 1 }}
        >
          {joining ? "Joining..." : "Join Class"}
        </button>
      </div>
    </div>
  );
}
