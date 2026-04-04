import { useState, useEffect, useRef, type FormEvent } from "react";
import { useAuth, GOOGLE_CLIENT_ID } from "../auth";
import { passwordStrength, isPasswordValid, reqStyle } from "../passwordValidation";

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

interface SignupModalProps {
  onSuccess: () => void;
  onClose: () => void;
  action?: string;
}

export function SignupModal({ onSuccess, onClose, action = "submit" }: SignupModalProps) {
  const { signup, login, googleLogin } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    function renderBtn() {
      if (!window.google || !googleBtnRef.current) return;
      googleBtnRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: any) => {
          if (response.credential) handleGoogleCredential(response.credential);
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        width: "320",
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
  }, [mode]);

  async function handleGoogleCredential(idToken: string) {
    setError(null);
    const result = await googleLogin(idToken, false);
    if (result.error) setError(result.error);
    else onSuccess();
  }

  const strength = passwordStrength(password);
  const passwordValid = isPasswordValid(password);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passwordValid) { setError("Password does not meet the requirements"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setSubmitting(true);
    const err = await signup(email, displayName, password, false);
    setSubmitting(false);
    if (err) setError(err);
    else onSuccess();
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.error) setError(result.error);
    else onSuccess();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", fontSize: 15,
    border: "1px solid #ccc", borderRadius: 4, fontFamily: "inherit",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", marginBottom: 6, fontSize: 14, fontWeight: 700, color: "#333",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 12, padding: "32px 28px",
          width: "100%", maxWidth: 400,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700, textAlign: "center", color: "#1a1a1a" }}>
          {mode === "signup" ? `Create an account to ${action}` : `Sign in to ${action}`}
        </h2>

        {GOOGLE_CLIENT_ID && (
          <>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div ref={googleBtnRef} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#ddd" }} />
              <span style={{ fontSize: 13, color: "#666" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#ddd" }} />
            </div>
          </>
        )}

        {mode === "signup" ? (
          <form onSubmit={handleSignup}>
            {error && <div style={{ color: "#c0392b", fontSize: 14, marginBottom: 12, textAlign: "center" }}>{error}</div>}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Display Name</label>
              <input style={inputStyle} type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" required value={password} onChange={e => setPassword(e.target.value)} />
              {password.length > 0 && (
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  <span style={reqStyle(strength.length)}>{strength.length ? "\u2713" : "\u00B7"} 8+ characters</span>
                  <span style={reqStyle(strength.number)}>{strength.number ? "\u2713" : "\u00B7"} Number</span>
                  <span style={reqStyle(strength.special)}>{strength.special ? "\u2713" : "\u00B7"} Special character</span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Confirm Password</label>
              <input style={inputStyle} type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%", padding: 12, fontSize: 16, fontWeight: 700,
                color: "#fff", background: "#1a1a1a", border: "none",
                borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {submitting ? "Creating account..." : "Sign Up & Submit"}
            </button>
            <p style={{ marginTop: 14, textAlign: "center", fontSize: 14 }}>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); }}
                style={{ background: "none", border: "none", color: "#1a1a1a", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14, padding: 0 }}
              >
                Log in
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            {error && <div style={{ color: "#c0392b", fontSize: 14, marginBottom: 12, textAlign: "center" }}>{error}</div>}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%", padding: 12, fontSize: 16, fontWeight: 700,
                color: "#fff", background: "#1a1a1a", border: "none",
                borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {submitting ? "Signing in..." : "Sign In & Submit"}
            </button>
            <p style={{ marginTop: 14, textAlign: "center", fontSize: 14 }}>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); }}
                style={{ background: "none", border: "none", color: "#1a1a1a", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14, padding: 0 }}
              >
                Sign up
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
