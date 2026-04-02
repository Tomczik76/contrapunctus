import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth, API_BASE } from "../auth";
import { useTheme } from "../useTheme";
import { COUNTRIES } from "../countries";

export function SettingsPage() {
  const { user, token, updateUser } = useAuth();
  const theme = useTheme();
  const dk = theme.dk;

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [country, setCountry] = useState(user?.country ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setDisplayName(data.displayName);
          setCountry(data.country ?? "");
          setCity(data.city ?? "");
        }
      })
      .catch(() => {});
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          country: country || null,
          city: city || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        updateUser(data);
        setMessage({ text: "Saved", error: false });
      } else {
        setMessage({ text: data.error || "Failed to save", error: true });
      }
    } catch {
      setMessage({ text: "Network error", error: true });
    } finally {
      setSaving(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: dk ? "#2a2a30" : "#fff",
    border: `1px solid ${theme.cardBorder}`,
    borderRadius: 10,
    padding: "24px 28px",
    maxWidth: 480,
    width: "100%",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: theme.textSub,
    marginBottom: 4,
    display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    fontSize: 14,
    fontFamily: "inherit",
    border: `1px solid ${theme.cardBorder}`,
    borderRadius: 6,
    background: dk ? "#1e1e24" : "#faf9f7",
    color: theme.text,
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link to="/" style={{ fontSize: 14, color: theme.textMuted, textDecoration: "none" }}>&larr; Home</Link>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Settings</span>
        </div>

        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={inputStyle}
              maxLength={200}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">— Select —</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={inputStyle}
              maxLength={200}
              placeholder="Optional"
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={saving || !displayName.trim()}
              style={{
                padding: "8px 24px",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "inherit",
                background: theme.accent,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: saving ? "default" : "pointer",
                opacity: saving || !displayName.trim() ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {message && (
              <span style={{ fontSize: 13, color: message.error ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                {message.text}
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 13, color: theme.textMuted }}>
          Email: {user?.email}
        </div>
      </div>
    </div>
  );
}
