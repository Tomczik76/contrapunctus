import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_BASE } from "../auth";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const strength = {
    length:  password.length >= 8,
    number:  /\d/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
  const passwordValid = strength.length && strength.number && strength.special;

  const reqStyle = (met: boolean): React.CSSProperties => ({
    fontSize: 12,
    color: met ? "#2a7d4f" : "#999",
    display: "flex",
    alignItems: "center",
    gap: 4,
    transition: "color 0.15s ease",
  });

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
    const res = await fetch(`${API_BASE}/api/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) setError(data.error || "Reset failed");
    else setSuccess(true);
  }

  if (!token) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", flexDirection: "column", gap: 16,
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a" }}>Invalid reset link</div>
        <Link to="/login" style={{ color: "#1a1a1a", fontWeight: 700 }}>Back to login</Link>
      </div>
    );
  }

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
          fontSize: 24, fontWeight: 700, letterSpacing: -0.5,
          marginBottom: 24, textAlign: "center", color: "#1a1a1a",
        }}>
          Set New Password
        </h1>

        {success ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#2a7d4f", fontWeight: 600, margin: "0 0 16px" }}>
              Your password has been reset.
            </p>
            <Link to="/login" style={{ fontSize: 14, color: "#1a1a1a", fontWeight: 700 }}>
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ color: "#c0392b", fontSize: 14, marginBottom: 12, textAlign: "center" }}>
                {error}
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 700, color: "#333" }}>
                New Password
              </label>
              <input
                style={{
                  width: "100%", padding: "10px 12px", fontSize: 15,
                  border: "1px solid #ccc", borderRadius: 4, fontFamily: "inherit",
                }}
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
              <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 700, color: "#333" }}>
                Confirm Password
              </label>
              <input
                style={{
                  width: "100%", padding: "10px 12px", fontSize: 15,
                  border: "1px solid #ccc", borderRadius: 4, fontFamily: "inherit",
                }}
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%", padding: "12px", fontSize: 16, fontWeight: 700,
                color: "#fff", background: "#1a1a1a", border: "none",
                borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {submitting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
