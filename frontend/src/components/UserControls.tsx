import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { useTheme } from "../useTheme";
import { BugReportButton } from "./BugReportButton";

const linkStyle: React.CSSProperties = {
  padding: 0, fontSize: 12, background: "none", border: "none",
  opacity: 0.6, color: "inherit", cursor: "pointer",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  textDecoration: "underline", textUnderlineOffset: 2,
};

export function UserControls() {
  const { user, logout } = useAuth();
  const theme = useTheme();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        onClick={theme.toggleDark}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 16,
          color: "inherit",
          opacity: 0.6,
          padding: "0 2px",
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
        title={theme.dk ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme.dk ? "\u2600" : "\u263E"}
      </button>
      <Link
        to="/settings"
        style={{ fontSize: 13, opacity: 0.6, color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
      >
        <span style={{ fontSize: 18 }}>{"\u2699"}</span>
        {user?.displayName}
      </Link>
      <BugReportButton />
      <button
        onClick={logout}
        style={linkStyle}
        onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
      >
        Sign out
      </button>
    </div>
  );
}
