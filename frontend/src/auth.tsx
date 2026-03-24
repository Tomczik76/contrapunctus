import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export const API_BASE = import.meta.env.DEV ? "http://localhost:8080" : "";

interface User {
  id: string;
  email: string;
  displayName: string;
  isEducator: boolean;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  signup: (email: string, displayName: string, password: string, isEducator: boolean) => Promise<string | null>;
  login: (email: string, password: string) => Promise<{ error?: string; user?: User }>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("auth");
    if (saved) {
      try {
        const { user, token } = JSON.parse(saved);
        setUser(user);
        setToken(token);
      } catch {}
    }
    setLoading(false);
  }, []);

  function persist(user: User, token: string) {
    setUser(user);
    setToken(token);
    localStorage.setItem("auth", JSON.stringify({ user, token }));
  }

  async function signup(email: string, displayName: string, password: string, isEducator: boolean): Promise<string | null> {
    const res = await fetch(`${API_BASE}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, displayName, password, isEducator }),
    });
    const data = await res.json();
    if (!res.ok) return data.error || "Signup failed";
    persist(data.user, data.token);
    return null;
  }

  async function login(email: string, password: string): Promise<{ error?: string; user?: User }> {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Login failed" };
    persist(data.user, data.token);
    return { user: data.user };
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth");
  }

  return (
    <AuthContext value={{ user, token, loading, signup, login, logout }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

const ADMIN_KEY = "contrapunctus_admin_token";
export const getAdminToken = () => sessionStorage.getItem(ADMIN_KEY);
export const setAdminToken = (t: string) => sessionStorage.setItem(ADMIN_KEY, t);
export const clearAdminToken = () => sessionStorage.removeItem(ADMIN_KEY);
export const adminHeaders = () => ({ "X-Admin-Token": getAdminToken() ?? "" });
