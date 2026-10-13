import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getCountryFromPath, buildCountryUrl } from "./country";
import { _tryRefresh } from "./api";
import planPrices from "../../../../shared-plan-prices.json";

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
// turn a `next` parameter (or a stale return-path value) into an open redirect.
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
function navigateAfterAuth(role: string, isDemo = false) {
  if (isDemo) {
    window.location.href = "/workspace";
    return;
  }
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
  is_demo?: boolean;
  must_change_password?: boolean;
  role: "client" | "lawyer" | "advocate";
  has_lawyer_profile?: boolean;
  created_at: string;
  is_verified?: boolean;
  lawyer_status?: string | null;
  lawyer_rejection_reason?: string | null;
  username?: string | null;
  is_profile_public?: boolean;
  preferred_language?: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, role?: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: string, recaptchaToken?: string) => Promise<void>;
  googleLogin: (credential: string, role?: string) => Promise<void>;
  appleLogin: (idToken: string, firstName?: string, lastName?: string, role?: string) => Promise<void>;
  passkeyLogin: (user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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
      // of being bounced once their cookie-based access token expires.
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

  const login = async (email: string, password: string, role: string = "client") => {
    const data = await authFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });
    setUser(data.user);
    if ((role === "advocate" || role === "lawyer") && !data.user?.has_lawyer_profile) {
      window.location.href = buildCountryUrl(getCountryFromPath() ?? "in", "lawyers/register?setup=advocate");
      return;
    }
    navigateAfterAuth(data.user?.role ?? "client", !!data.user?.is_demo);
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
    navigateAfterAuth(data.user?.role ?? "client", !!data.user?.is_demo);
  };

  const appleLogin = async (idToken: string, firstName?: string, lastName?: string, role: string = "client") => {
    const data = await authFetch("/auth/apple", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken, first_name: firstName ?? null, last_name: lastName ?? null, role }),
    });
    setUser(data.user);
    navigateAfterAuth(data.user?.role ?? "client", !!data.user?.is_demo);
  };

  const passkeyLogin = (userData: User) => {
    setUser(userData);
    navigateAfterAuth(userData.role ?? "client", !!userData.is_demo);
  };

  const logout = async () => {
    try {
      await authFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore server errors during logout
    }
    setUser(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await authFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    await refreshUser();
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
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, appleLogin, passkeyLogin, logout, refreshUser, changePassword }}>
      {user?.must_change_password ? (
        <ForcedPasswordChange onSubmit={changePassword} onLogout={logout} email={user.email} />
      ) : children}
    </AuthContext.Provider>
  );
}

function ForcedPasswordChange({ onSubmit, onLogout, email }: {
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  onLogout: () => Promise<void>;
  email: string;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (next.length < 12) return setError("Use at least 12 characters.");
    if (next !== confirm) return setError("The new passwords do not match.");
    setSaving(true);
    try { await onSubmit(current, next); }
    catch (e) { setError(e instanceof Error ? e.message : "Password change failed."); }
    finally { setSaving(false); }
  }
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#07101f", color: "#e2e8f0" }}>
      <form onSubmit={submit} style={{ width: "min(100%, 440px)", padding: 28, borderRadius: 18, background: "#101b2d", border: "1px solid #24364d" }}>
        <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Set a new password</h1>
        <p style={{ color: "#a9b7c9", lineHeight: 1.6 }}>This demo advocate account uses a temporary password. Change it before continuing. Signed in as {email}.</p>
        {["Current temporary password", "New password", "Confirm new password"].map((label, i) => (
          <label key={label} style={{ display: "block", marginTop: 14, fontSize: 13 }}>
            {label}
            <input aria-label={label} type="password" autoComplete={i === 0 ? "current-password" : "new-password"} required value={[current, next, confirm][i]} onChange={e => (i === 0 ? setCurrent(e.target.value) : i === 1 ? setNext(e.target.value) : setConfirm(e.target.value))} style={{ display: "block", boxSizing: "border-box", width: "100%", marginTop: 6, padding: 11, borderRadius: 8, background: "#081321", border: "1px solid #34445a", color: "white" }} />
          </label>
        ))}
        {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}
        <button disabled={saving} style={{ width: "100%", marginTop: 18, padding: 12, border: 0, borderRadius: 8, color: "#06201e", background: "#35d0bd", fontWeight: 800 }}>{saving ? "Saving…" : "Change password"}</button>
        <button type="button" onClick={() => void onLogout()} style={{ width: "100%", marginTop: 10, padding: 10, border: "1px solid #34445a", borderRadius: 8, color: "#cbd5e1", background: "transparent" }}>Sign out</button>
      </form>
    </main>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const TIER_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(planPrices.advocate).map(([tier, plan]) => [tier, plan.name]),
  ),
};

export const TIER_LIMITS: Record<string, number> = {
  free: 5,
  professional: 50,
  advocate_pro: -1,
};
