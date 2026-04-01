import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../auth";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch(`${API_BASE}/api/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    setSubmitting(false);
    setSubmitted(true);
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
          marginBottom: 8, textAlign: "center", color: "#1a1a1a",
        }}>
          Reset Password
        </h1>

        {submitted ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, margin: "16px 0 24px" }}>
              If an account exists with that email, we've sent a password reset link. Check your inbox.
            </p>
            <Link to="/login" style={{ fontSize: 14, color: "#1a1a1a", fontWeight: 700 }}>
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: "#888", textAlign: "center", margin: "0 0 24px" }}>
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 700, color: "#333" }}>
                  Email
                </label>
                <input
                  style={{
                    width: "100%", padding: "10px 12px", fontSize: 15,
                    border: "1px solid #ccc", borderRadius: 4, fontFamily: "inherit",
                  }}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {submitting ? "Sending..." : "Send Reset Link"}
              </button>
              <p style={{ marginTop: 16, textAlign: "center", fontSize: 14 }}>
                <Link to="/login" style={{ color: "#1a1a1a", fontWeight: 700 }}>Back to login</Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
