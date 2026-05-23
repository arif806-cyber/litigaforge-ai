import { createContext, useContext, useState, useEffect, useCallback } from "react";

const BASE = "/litigaforge";

export interface User {
  id: number;
  email: string;
  name: string;
  subscription_tier: "free" | "professional" | "advocate_pro";
  cases_this_month: number;
  month_reset_date: string;
  is_superuser: boolean;
  created_at: string;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

async function authFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text).detail ?? text; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authFetch("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await authFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await authFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await authFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore server errors during logout
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const TIER_LABELS: Record<string, string> = {
  free: "Free",
  professional: "Professional",
  advocate_pro: "Advocate Pro",
};

export const TIER_LIMITS: Record<string, number> = {
  free: 5,
  professional: 50,
  advocate_pro: -1,
};
