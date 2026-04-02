import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import React from "react";

function buildTheme(dk: boolean, toggleDark: () => void) {
  return {
    dk,
    toggleDark,
    // Base
    bg: dk ? "#1e1e22" : "#e8e4e0",
    cardBg: dk ? "#2a2a30" : "#fff",
    cardBorder: dk ? "#3a3a40" : "#e0dcd8",
    cardShadow: dk ? "0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
    text: dk ? "#e0ddd8" : "#1a1a1a",
    textSub: dk ? "#aaa" : "#555",
    textMuted: dk ? "#9a9a9a" : "#666",
    // Layout
    footerBg: dk ? "#222228" : "#f0ede9",
    footerBorder: dk ? "#3a3a40" : "#e0dcd8",
    headerBg: dk ? "#222228" : "#f5f2ef",
    headerBorder: dk ? "#3a3a40" : "#e0dcd8",
    sidebarBg: dk ? "#222228" : "#f5f2ef",
    sidebarBorder: dk ? "#3a3a40" : "#e0dcd8",
    sidebarHover: dk ? "#2e2e34" : "#ece9e5",
    sidebarActive: dk ? "#32323a" : "#e8e4e0",
    // Controls
    btnBg: dk ? "#e0ddd8" : "#1a1a1a",
    btnText: dk ? "#1a1a1e" : "#fff",
    inputBg: dk ? "#1e1e22" : "#fff",
    inputBorder: dk ? "#444" : "#ccc",
    badgeBg: dk ? "#32323a" : "#f0eeeb",
    accent: dk ? "#7c9cff" : "#4a6fff",
    // Status
    successBg: dk ? "rgba(22,163,74,0.15)" : "rgba(22,163,74,0.08)",
    successBorder: dk ? "#22c55e" : "#16a34a",
    successText: dk ? "#6ee7a0" : "#16a34a",
    errorBg: dk ? "rgba(220,38,38,0.15)" : "rgba(220,38,38,0.08)",
    errorBorder: dk ? "#f87171" : "#dc2626",
    errorText: dk ? "#fca5a5" : "#dc2626",
    dangerText: dk ? "#f87171" : "#dc2626",
    warnBg: dk ? "rgba(234,179,8,0.15)" : "rgba(234,179,8,0.08)",
    warnText: dk ? "#fbbf24" : "#d97706",
  };
}

const noop = () => {};
const defaultTheme = buildTheme(false, noop);
const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dk, setDk] = useState(() => {
    try { return localStorage.getItem("contrapunctus_dark") === "true"; } catch { return false; }
  });

  const toggleDark = useCallback(() => {
    setDk((prev) => {
      const next = !prev;
      try { localStorage.setItem("contrapunctus_dark", String(next)); } catch {}
      return next;
    });
  }, []);

  const theme = buildTheme(dk, toggleDark);

  useEffect(() => {
    document.documentElement.style.background = theme.bg;
    document.body.style.background = theme.bg;
  }, [theme.bg]);

  return React.createElement(ThemeContext.Provider, { value: theme }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export type Theme = ReturnType<typeof buildTheme>;
