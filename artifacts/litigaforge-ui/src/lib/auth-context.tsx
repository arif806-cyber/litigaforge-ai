import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getCountryFromPath, buildCountryUrl } from "./country";
import { _tryRefresh } from "./api";

function dashboardUrl(role: string): string {
  const country =
    getCountryFromPath() ??
    localStorage.getItem("country_override")?.toLowerCase() ??
    "in";
  const page = role === "lawyer" ? "lawyer-dashboard" : "client-dashboard";
  return buildCountryUrl(country, page);
}

const BASE = "/litigaforge";

export interface User {
  id: number;
  email: string;
  name: string;
  subscription_tier: "free" | "professional" | "advocate_pro";
  cases_this_month: number;
  month_reset_date: string;
  is_superuser: boolean;
  role: "client" | "lawyer";
  created_at: string;
  is_verified?: boolean;
  username?: string | null;
  is_profile_public?: boolean;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: string, recaptchaToken?: string) => Promise<void>;
  googleLogin: (credential: string, role?: string) => Promise<void>;
  appleLogin: (idToken: string, firstName?: string, lastName?: string, role?: string) => Promise<void>;
  passkeyLogin: (token: string, user: User) => void;
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
    // Anonymous visitors (no stored JWT) are definitely logged out — skip the
    // /auth/me round-trip entirely. This (a) renders the app immediately
    // instead of blocking first paint behind a network request, and (b) avoids
    // logging a 401 in the console on every public page load (the homepage /
    // Lighthouse case). Logged-in users still revalidate via /auth/me.
    if (typeof window !== "undefined" && !localStorage.getItem("lf_token")) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      let res = await fetch(`${BASE}/auth/me`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      // The access cookie is short-lived. On a 401, attempt one silent refresh
      // (using the long-lived refresh cookie) and re-check before giving up, so
      // a genuinely logged-in user stays signed in across a cold reload instead
      // of being bounced once their access token expires.
      if (res.status === 401 && (await _tryRefresh())) {
        res = await fetch(`${BASE}/auth/me`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
      }
      if (res.ok) {
        setUser(await res.json());
      } else {
        setUser(null);
        // Session is truly gone (refresh failed too) but a stale lf_token flag
        // remains. Drop it so future page loads skip the /auth/me probe and
        // stop logging repeated 401s. Only on a real 401 — never on a network
        // error, so a transient blip doesn't silently sign the user out.
        if (res.status === 401 && typeof window !== "undefined") {
          localStorage.removeItem("lf_token");
        }
      }
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
    if (data.token) {
      localStorage.setItem("lf_token", data.token);
      setToken(data.token);
    }
    setUser(data.user);
    // Redirect based on role — preserve country prefix
    const role = data.user?.role ?? "client";
    window.location.href = dashboardUrl(role);
  };

  const register = async (name: string, email: string, password: string, role: string = "client", recaptchaToken?: string) => {
    const data = await authFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role, recaptcha_token: recaptchaToken ?? null }),
    });
    if (data.token) {
      localStorage.setItem("lf_token", data.token);
      setToken(data.token);
    }
    setUser(data.user);
  };

  const googleLogin = async (credential: string, role: string = "client") => {
    const data = await authFetch("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential, role }),
    });
    if (data.token) {
      localStorage.setItem("lf_token", data.token);
      setToken(data.token);
    }
    setUser(data.user);
    const userRole = data.user?.role ?? "client";
    window.location.href = dashboardUrl(userRole);
  };

  const appleLogin = async (idToken: string, firstName?: string, lastName?: string, role: string = "client") => {
    const data = await authFetch("/auth/apple", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken, first_name: firstName ?? null, last_name: lastName ?? null, role }),
    });
    if (data.token) {
      localStorage.setItem("lf_token", data.token);
      setToken(data.token);
    }
    setUser(data.user);
    const userRole = data.user?.role ?? "client";
    window.location.href = dashboardUrl(userRole);
  };

  const passkeyLogin = (jwtToken: string, userData: User) => {
    localStorage.setItem("lf_token", jwtToken);
    setToken(jwtToken);
    setUser(userData);
    const userRole = userData.role ?? "client";
    window.location.href = dashboardUrl(userRole);
  };

  const logout = async () => {
    try {
      await authFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore server errors during logout
    }
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") localStorage.removeItem("lf_token");
  };

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LoadingSpinner message="Starting LitigaForge AI..." />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, googleLogin, appleLogin, passkeyLogin, logout, refreshUser }}>
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
