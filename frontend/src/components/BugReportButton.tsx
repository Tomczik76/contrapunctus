import { useState } from "react";
import { useAuth, API_BASE } from "../auth";
import { useTheme } from "../useTheme";

export function BugReportButton() {
  const { token } = useAuth();
  const theme = useTheme();
  const dk = theme.dk;

  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!token) return null;

  const handleSubmit = async () => {
    if (!token || !desc.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch(`${API_BASE}/api/bug-reports`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc, stateJson: { page: window.location.pathname } }),
      });
      if (res.ok) {
        setStatus("sent");
        setTimeout(() => { setOpen(false); setDesc(""); setStatus("idle"); }, 1500);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const modalBtnStyle: React.CSSProperties = {
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    background: theme.accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          zIndex: 150,
          padding: "5px 10px", fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
          background: dk ? "rgba(40,40,48,0.9)" : "rgba(240,237,233,0.9)",
          color: theme.textMuted, cursor: "pointer",
          border: `1px solid ${theme.cardBorder}`, borderBottom: "none",
          borderRadius: "6px 6px 0 0",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = theme.text)}
        onMouseLeave={e => (e.currentTarget.style.color = theme.textMuted)}
      >
        Bug?
      </button>

      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => { setOpen(false); setStatus("idle"); }}>
          <div style={{
            background: theme.cardBg, borderRadius: 12, padding: 24,
            width: "100%", maxWidth: 440, margin: 16,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            color: theme.text,
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Report a Bug</h3>
            <textarea
              style={{
                width: "100%", minHeight: 100, padding: "10px 12px", fontSize: 14,
                background: dk ? "#1a1a1e" : "#f5f3f0",
                border: `1px solid ${dk ? "#444" : "#ccc"}`,
                borderRadius: 8, color: theme.text, fontFamily: "inherit",
                boxSizing: "border-box", resize: "vertical",
              }}
              placeholder="Describe what went wrong..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={() => { setOpen(false); setStatus("idle"); }} style={{
                ...modalBtnStyle, background: "transparent", color: theme.textSub,
                border: `1px solid ${theme.cardBorder}`,
              }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={status === "sending" || status === "sent"} style={{
                ...modalBtnStyle, opacity: status === "sending" ? 0.6 : 1,
              }}>
                {status === "idle" ? "Send" : status === "sending" ? "Sending..." : status === "sent" ? "Sent!" : "Error — retry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
