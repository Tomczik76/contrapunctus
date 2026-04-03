import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useTheme } from "../useTheme";
import { FeatureRequestButton } from "./FeatureRequestButton";
import { RoadmapButton } from "./RoadmapButton";

export function TopNav() {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const dk = theme.dk;
  const [open, setOpen] = useState(false);
  const [featureRequestOpen, setFeatureRequestOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const location = useLocation();
  const isHome = location.pathname === "/";

  const hoverBg = dk ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";

  if (!user) {
    // Show minimal nav with logo + login/signup on public pages
    if (location.pathname === "/landing" || location.pathname === "/login" || location.pathname === "/signup"
        || location.pathname === "/forgot-password" || location.pathname.startsWith("/reset-password")) {
      return null;
    }
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        background: dk ? "rgba(28,28,32,0.92)" : "rgba(250,248,245,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: `1px solid ${theme.cardBorder}`,
        height: 44,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px",
      }}>
        <Link to="/landing" style={{
          fontSize: 15, fontWeight: 700, color: theme.text, textDecoration: "none",
          letterSpacing: -0.3, display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          Contrapunctus
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/login" style={{
            fontSize: 13, fontWeight: 600, color: theme.text, textDecoration: "none",
            padding: "4px 12px", borderRadius: 8,
            border: `1px solid ${theme.cardBorder}`,
            fontFamily: "inherit",
          }}>Log in</Link>
          <Link to="/signup" style={{
            fontSize: 13, fontWeight: 600, color: theme.btnText, textDecoration: "none",
            padding: "5px 12px", borderRadius: 8, background: theme.btnBg,
            fontFamily: "inherit",
          }}>Sign up</Link>
        </div>
      </div>
    );
  }
  const menuItemStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, width: "100%",
    padding: "10px 14px", fontSize: 13, color: theme.text,
    background: "none", border: "none", cursor: "pointer",
    fontFamily: "inherit", textAlign: "left",
  };

  return (
    <>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        background: dk ? "rgba(28,28,32,0.92)" : "rgba(250,248,245,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: `1px solid ${theme.cardBorder}`,
        height: 44,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px",
      }}>
        <Link to="/" style={{
          fontSize: 15, fontWeight: 700, color: theme.text, textDecoration: "none",
          letterSpacing: -0.3, display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          {!isHome && <span style={{ fontSize: 16 }}>&larr;</span>}
          Contrapunctus
        </Link>

        <div ref={ref} style={{ position: "relative" }}>
          <button
            onClick={() => setOpen(!open)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              color: theme.text, fontSize: 13, fontFamily: "inherit",
              padding: "4px 8px", borderRadius: 6,
            }}
          >
            <span style={{ opacity: 0.7 }}>{user.displayName}</span>
            <span style={{ fontSize: 10, opacity: 0.5 }}>{open ? "\u25B2" : "\u25BC"}</span>
          </button>

          {open && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: 4,
              background: theme.cardBg, border: `1px solid ${theme.cardBorder}`,
              borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              minWidth: 180, overflow: "hidden",
            }}>
              <Link
                to="/settings"
                onClick={() => setOpen(false)}
                style={{ ...menuItemStyle, textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 15 }}>{"\u2699"}</span>
                Settings
              </Link>
              <button
                onClick={() => { theme.toggleDark(); }}
                style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 15 }}>{dk ? "\u2600" : "\u263E"}</span>
                {dk ? "Light mode" : "Dark mode"}
              </button>
              <button
                onClick={() => { setOpen(false); setFeatureRequestOpen(true); }}
                style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                Request a Feature
              </button>
              <button
                onClick={() => { setOpen(false); setRoadmapOpen(true); }}
                style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                Roadmap
              </button>
              <a
                href="https://discord.gg/zSTuZ65m"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                style={{ ...menuItemStyle, textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                Discord
              </a>
              <div style={{ height: 1, background: theme.cardBorder }} />
              <button
                onClick={() => { setOpen(false); logout(); }}
                style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <FeatureRequestButton open={featureRequestOpen} onClose={() => setFeatureRequestOpen(false)} />
      <RoadmapButton open={roadmapOpen} onClose={() => setRoadmapOpen(false)} />
    </>
  );
}
