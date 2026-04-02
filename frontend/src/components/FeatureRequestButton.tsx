import { useState } from "react";
import { useAuth, API_BASE } from "../auth";
import { useTheme } from "../useTheme";

export function FeatureRequestButton({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token } = useAuth();
  const theme = useTheme();
  const dk = theme.dk;

  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!open || !token) return null;

  const handleSubmit = async () => {
    if (!desc.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch(`${API_BASE}/api/feature-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: desc }),
      });
      if (res.ok) {
        setStatus("sent");
        setTimeout(() => { setDesc(""); setStatus("idle"); onClose(); }, 1500);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const close = () => { setDesc(""); setStatus("idle"); onClose(); };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.2)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={() => { if (status !== "sending") close(); }}>
      <div style={{
        background: theme.cardBg, borderRadius: 12, padding: 24,
        width: "100%", maxWidth: 440, margin: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        color: theme.text,
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Request a Feature</h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: theme.textSub }}>
          Describe the feature you'd like to see in Contrapunctus.
        </p>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Describe the feature..."
          rows={4}
          style={{
            width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 14,
            fontFamily: "inherit",
            background: dk ? "#1a1a1e" : "#f5f3f0",
            border: `1px solid ${dk ? "#444" : "#ccc"}`,
            borderRadius: 8, color: theme.text, resize: "vertical",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
          <button onClick={close} disabled={status === "sending"} style={{
            padding: "10px 20px", fontSize: 14, fontWeight: 600, fontFamily: "inherit",
            background: "transparent", color: theme.textSub,
            border: `1px solid ${theme.cardBorder}`, borderRadius: 8, cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={status === "sending" || !desc.trim()} style={{
            padding: "10px 20px", fontSize: 14, fontWeight: 600, fontFamily: "inherit",
            background: status === "sent" ? "#16a34a" : status === "error" ? "#dc2626" : theme.accent,
            color: "#fff", border: "none", borderRadius: 8, cursor: "pointer",
            opacity: status === "sending" ? 0.6 : 1,
          }}>
            {status === "sending" ? "Sending..." : status === "sent" ? "Sent!" : status === "error" ? "Failed - Retry" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
