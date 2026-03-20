import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 15,
  border: "1px solid #ccc",
  borderRadius: 4,
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 700,
  color: "#333",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  fontSize: 16,
  fontWeight: 700,
  color: "#fff",
  background: "#1a1a1a",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: "inherit",
};

const errorStyle: React.CSSProperties = {
  color: "#c0392b",
  fontSize: 14,
  marginBottom: 12,
  textAlign: "center",
};

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
        padding: "36px 32px 40px",
      }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: -0.5,
          marginBottom: 24,
          textAlign: "center",
          color: "#1a1a1a",
        }}>
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    const err = await signup(email, displayName, password);
    setSubmitting(false);
    if (err) setError(err);
    else navigate("/");
  }

  return (
    <AuthShell title="Create Account">
      <form onSubmit={handleSubmit}>
        {error && <div style={errorStyle}>{error}</div>}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email</label>
          <input
            style={inputStyle}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Display Name</label>
          <input
            style={inputStyle}
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Password</label>
          <input
            style={inputStyle}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Confirm Password</label>
          <input
            style={inputStyle}
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button style={buttonStyle} type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Sign Up"}
        </button>
        <p style={{ marginTop: 16, textAlign: "center", fontSize: 14 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#1a1a1a", fontWeight: 700 }}>Log in</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await login(email, password);
    setSubmitting(false);
    if (err) setError(err);
    else navigate("/");
  }

  return (
    <AuthShell title="Sign In">
      <form onSubmit={handleSubmit}>
        {error && <div style={errorStyle}>{error}</div>}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email</label>
          <input
            style={inputStyle}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Password</label>
          <input
            style={inputStyle}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button style={buttonStyle} type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign In"}
        </button>
        <p style={{ marginTop: 16, textAlign: "center", fontSize: 14 }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "#1a1a1a", fontWeight: 700 }}>Sign up</Link>
        </p>
      </form>
    </AuthShell>
  );
}
