import { useState, useEffect, useRef, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, GOOGLE_CLIENT_ID } from "../auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (el: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

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

function GoogleSignInButton({ onCredential }: { onCredential: (token: string) => void }) {
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    function renderBtn() {
      if (!window.google || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: any) => {
          if (response.credential) onCredential(response.credential);
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "outline",
        size: "large",
        width: "336",
        text: "continue_with",
      });
    }

    if (window.google) {
      renderBtn();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = renderBtn;
      document.head.appendChild(script);
    }
  }, [onCredential]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div ref={btnRef} />
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
      <div style={{ flex: 1, height: 1, background: "#ddd" }} />
      <span style={{ fontSize: 13, color: "#999" }}>or</span>
      <div style={{ flex: 1, height: 1, background: "#ddd" }} />
    </div>
  );
}

export function SignupPage() {
  const { signup, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [role, setRole] = useState<"individual" | "educator" | null>(redirect ? "individual" : null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const strength = {
    length:  password.length >= 8,
    number:  /\d/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
  const passwordValid = strength.length && strength.number && strength.special;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passwordValid) {
      setError("Password does not meet the requirements");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    const err = await signup(email, displayName, password, role === "educator");
    setSubmitting(false);
    if (err) setError(err);
    else navigate(redirect || (role === "educator" ? "/educator" : "/"));
  }

  async function handleGoogleCredential(idToken: string) {
    setError(null);
    const result = await googleLogin(idToken, role === "educator");
    if (result.error) setError(result.error);
    else navigate(redirect || (role === "educator" ? "/educator" : "/"));
  }

  const reqStyle = (met: boolean): React.CSSProperties => ({
    fontSize: 12,
    color: met ? "#2a7d4f" : "#999",
    display: "flex",
    alignItems: "center",
    gap: 4,
    transition: "color 0.15s ease",
  });

  if (role === null) {
    const cardStyle: React.CSSProperties = {
      background: "#fff",
      borderRadius: 12,
      padding: "32px 28px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
      border: "1px solid #e0dcd8",
      textDecoration: "none",
      color: "#1a1a1a",
      display: "flex",
      flexDirection: "column" as const,
      gap: 8,
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
      cursor: "pointer",
      textAlign: "left" as const,
    };

    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        background: "#e8e4e0",
      }}>
        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: -0.5,
          marginBottom: 6,
          textAlign: "center",
          color: "#1a1a1a",
        }}>
          Contrapunctus
        </h1>
        <p style={{ fontSize: 14, color: "#888", margin: "0 0 40px", textAlign: "center" }}>
          How will you be using Contrapunctus?
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 24,
          maxWidth: 700,
          width: "100%",
          padding: "0 24px",
        }}>
          <div
            style={cardStyle}
            onClick={() => setRole("individual")}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
          >
            <span style={{ fontSize: 28, marginBottom: 4 }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 6 C14 6 10 4 4 5 V22 C10 21 14 23 14 23 C14 23 18 21 24 22 V5 C18 4 14 6 14 6 Z" />
                <line x1="14" y1="6" x2="14" y2="23" />
              </svg>
            </span>
            <span style={{ fontSize: 17, fontWeight: 700 }}>Individual</span>
            <span style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>
              Practice four-part harmony through guided lessons and free composition
            </span>
          </div>

          <div
            style={cardStyle}
            onClick={() => setRole("educator")}
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
            <span style={{ fontSize: 17, fontWeight: 700 }}>Educator</span>
            <span style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>
              Create classes, author custom lessons, and track student progress
            </span>
          </div>
        </div>
        <p style={{ marginTop: 24, textAlign: "center", fontSize: 14, color: "#1a1a1a" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#1a1a1a", fontWeight: 700 }}>Log in</Link>
        </p>
      </div>
    );
  }

  return (
    <AuthShell title={role === "educator" ? "Create Educator Account" : "Create Account"}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <button
          onClick={() => setRole(null)}
          style={{
            background: "none",
            border: "none",
            fontSize: 13,
            color: "#888",
            cursor: "pointer",
            fontFamily: "inherit",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          &larr; Change account type
        </button>
      </div>
      <GoogleSignInButton onCredential={handleGoogleCredential} />
      <Divider />
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
          {password.length > 0 && (
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <span style={reqStyle(strength.length)}>{strength.length ? "\u2713" : "\u00B7"} 8+ characters</span>
              <span style={reqStyle(strength.number)}>{strength.number ? "\u2713" : "\u00B7"} Number</span>
              <span style={reqStyle(strength.special)}>{strength.special ? "\u2713" : "\u00B7"} Special character</span>
            </div>
          )}
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
          <Link to={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login"} style={{ color: "#1a1a1a", fontWeight: 700 }}>Log in</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function LoginPage() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.error) setError(result.error);
    else navigate(redirect || (result.user?.isEducator ? "/educator" : "/"));
  }

  async function handleGoogleCredential(idToken: string) {
    setError(null);
    const result = await googleLogin(idToken, false);
    if (result.error) setError(result.error);
    else navigate(redirect || (result.user?.isEducator ? "/educator" : "/"));
  }

  return (
    <AuthShell title="Sign In">
      <GoogleSignInButton onCredential={handleGoogleCredential} />
      <Divider />
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
          <div style={{ textAlign: "right", marginTop: 6 }}>
            <Link to="/forgot-password" style={{ fontSize: 13, color: "#888", textDecoration: "underline", textUnderlineOffset: 2 }}>
              Forgot password?
            </Link>
          </div>
        </div>
        <button style={buttonStyle} type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign In"}
        </button>
        <p style={{ marginTop: 16, textAlign: "center", fontSize: 14 }}>
          Don't have an account?{" "}
          <Link to={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : "/signup"} style={{ color: "#1a1a1a", fontWeight: 700 }}>Sign up</Link>
        </p>
      </form>
    </AuthShell>
  );
}
