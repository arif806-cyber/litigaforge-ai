import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getCountryFromPath, buildCountryUrl } from "./country";
import { _tryRefresh } from "./api";

function isAdvocate(role: string): boolean {
  return role === "lawyer" || role === "advocate";
}

function dashboardUrl(role: string): string {
  const country =
    getCountryFromPath() ??
    localStorage.getItem("country_override")?.toLowerCase() ??
    "in";
  const page = isAdvocate(role) ? "lawyer-dashboard" : "client-dashboard";
  return buildCountryUrl(country, page);
}

// Only accept app-relative destinations. Auth links are public input, so never
// turn a `next` parameter (or a stale sessionStorage value) into an open redirect.
export function safeAuthNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

// Navigate after a successful auth — honors any pre-login saved destination.
function navigateAfterAuth(role: string) {
  try {
    const returnTo = safeAuthNext(sessionStorage.getItem("lf_return_to"));
    if (returnTo && returnTo !== "/login" && returnTo !== "/register" && returnTo !== "/signup") {
      sessionStorage.removeItem("lf_return_to");
      window.location.href = returnTo;
      return;
    }
  } catch { /* sessionStorage unavailable (private browsing edge case) */ }
  window.location.href = dashboardUrl(role);
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
  role: "client" | "lawyer" | "advocate";
  created_at: string;
  is_verified?: boolean;
  lawyer_status?: string | null;
  username?: string | null;
  is_profile_public?: boolean;
}

interface AuthCtx {
  user: User | null;
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
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
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
    setUser(data.user);
    navigateAfterAuth(data.user?.role ?? "client");
  };

  const register = async (name: string, email: string, password: string, role: string = "client", recaptchaToken?: string) => {
    const data = await authFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role, recaptcha_token: recaptchaToken ?? null }),
    });
    setUser(data.user);
    if (isAdvocate(data.user?.role ?? role)) {
      // Keep a requested destination (notably Workspace) until the mandatory
      // advocate profile has been submitted.
      window.location.href = buildCountryUrl(
        getCountryFromPath() ?? "in",
        "lawyers/register",
      );
    }
  };

  const googleLogin = async (credential: string, role: string = "client") => {
    const data = await authFetch("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential, role }),
    });
    setUser(data.user);
    navigateAfterAuth(data.user?.role ?? "client");
  };

  const appleLogin = async (idToken: string, firstName?: string, lastName?: string, role: string = "client") => {
    const data = await authFetch("/auth/apple", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken, first_name: firstName ?? null, last_name: lastName ?? null, role }),
    });
    setUser(data.user);
    navigateAfterAuth(data.user?.role ?? "client");
  };

  const passkeyLogin = (_jwtToken: string, userData: User) => {
    setUser(userData);
    navigateAfterAuth(userData.role ?? "client");
  };

  const logout = async () => {
    try {
      await authFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore server errors during logout
    }
    setUser(null);
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
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, appleLogin, passkeyLogin, logout, refreshUser }}>
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
