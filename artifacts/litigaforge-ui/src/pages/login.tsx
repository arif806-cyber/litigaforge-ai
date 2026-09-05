import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Scale, Loader2, AlertTriangle, Eye, EyeOff, User, Briefcase, ArrowRight, Fingerprint } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { SEOHelmet } from "@/components/SEOHelmet";
import { motion, AnimatePresence } from "framer-motion";
import OnboardingModal from "@/components/OnboardingModal";
import { loadGoogleIdentity, GOOGLE_CLIENT_ID, hasGoogleClientId } from "@/lib/google-auth";
import { signInWithApple, hasAppleClientId, loadAppleSDK } from "@/lib/apple-auth";
import { hasPasskeySupport, authenticatePasskey } from "@/lib/passkeys";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { trackEvent } from "@/lib/analytics";
import { useCountry } from "@/hooks/useCountry";
import { safeAuthNext } from "@/lib/auth-context";

const COUNTRY_COPY: Record<string, { badge: string; heading: string; sub: string; trust: string }> = {
  IN: { badge: "India Legal AI", heading: "Legal intelligence\nbuilt for your courts.", sub: "Connect with verified advocates, analyze documents, search Indian judgments, and get AI legal strategy — all in one platform.", trust: "Trusted by advocates across India" },
  DE: { badge: "Deutschland Legal AI", heading: "Rechtsintelligenz\nfür Ihre Gerichte.", sub: "Verbinden Sie sich mit verifizierten Anwälten, analysieren Sie Dokumente und entwickeln Sie KI-gestützte Rechtsstrategien.", trust: "Trusted by legal professionals across Germany" },
  AE: { badge: "UAE Legal AI", heading: "Legal intelligence\nbuilt for your courts.", sub: "Connect with verified advocates across the UAE, analyze contracts, and get AI-powered legal strategy — Arabic & English.", trust: "Trusted by legal professionals across the UAE" },
  US: { badge: "US Legal AI", heading: "Legal intelligence\nbuilt for your courts.", sub: "Connect with verified attorneys, analyze contracts, research case law, and get AI legal strategy — all in one platform.", trust: "Trusted by legal professionals across the United States" },
  GB: { badge: "UK Legal AI", heading: "Legal intelligence\nbuilt for your courts.", sub: "Connect with verified solicitors and barristers, analyze documents, and get AI-powered legal strategy for England, Wales & Scotland.", trust: "Trusted by legal professionals across the United Kingdom" },
  AU: { badge: "Australia Legal AI", heading: "Legal intelligence\nbuilt for your courts.", sub: "Connect with verified solicitors, analyze contracts, research Australian case law, and get AI legal strategy.", trust: "Trusted by legal professionals across Australia" },
  CA: { badge: "Canada Legal AI", heading: "Legal intelligence\nbuilt for your courts.", sub: "Connect with verified lawyers, analyze contracts, and get AI-powered legal strategy — bilingual English & French support.", trust: "Trusted by legal professionals across Canada" },
  SG: { badge: "Singapore Legal AI", heading: "Legal intelligence\nbuilt for your courts.", sub: "Connect with verified advocates, analyze contracts, and get AI-powered legal strategy for Singapore courts.", trust: "Trusted by legal professionals across Singapore" },
};

type Role = "client" | "lawyer";
type Mode = "signin" | "signup";

// Read conversion intent passed from public CTAs (e.g. Workspace, For Lawyers).
function readAuthParams(): { role: string | null; plan: string | null; billing: string | null; next: string | null } {
  if (typeof window === "undefined") return { role: null, plan: null, billing: null, next: null };
  const p = new URLSearchParams(window.location.search);
  return { role: p.get("role"), plan: p.get("plan"), billing: p.get("billing"), next: safeAuthNext(p.get("next")) };
}

export default function Login() {
  const { login, register, googleLogin, appleLogin, passkeyLogin } = useAuth();
  const [, setLocation] = useLocation();
  const { activeCode } = useCountry();
  const copy = COUNTRY_COPY[activeCode.toUpperCase()] ?? COUNTRY_COPY.IN;
  const headingLines = copy.heading.split("\n");

  const [role, setRole] = useState<Role>("client");
  const [mode, setMode] = useState<Mode>(() => window.location.pathname.endsWith("/register") ? "signup" : "signin");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [consent, setConsent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const googleContainerRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef(role);

  const isSignIn = mode === "signin";
  const isClient = role === "client";

  useEffect(() => { roleRef.current = role; }, [role]);

  // Honor both the current advocate spelling and the legacy lawyer spelling.
  // Workspace intent defaults to the advocate flow as it requires a profile.
  useEffect(() => {
    const { role: r, next } = readAuthParams();
    if (r === "lawyer" || r === "advocate" || next === "/workspace") setRole("lawyer");
    else if (r === "client") setRole("client");
    if (next) {
      try { sessionStorage.setItem("lf_return_to", next); } catch { /* unavailable */ }
    }
  }, []);

  // Carry the selected pricing plan through registration into the upgrade flow.
  const postAuthDest = (currentRole: Role): string => {
    const { plan, billing, next } = readAuthParams();
    if (next) return next;
    if (plan && plan !== "free") {
      const q = new URLSearchParams({ plan });
      if (billing) q.set("billing", billing);
      return `/subscription?${q.toString()}`;
    }
    return currentRole === "lawyer" ? "/lawyer-dashboard" : "/client-dashboard";
  };

  // Preload Apple SDK
  useEffect(() => { if (hasAppleClientId) loadAppleSDK(); }, []);

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setError("");
    try {
      const { id_token, user } = await signInWithApple();
      await appleLogin(id_token, user?.firstName, user?.lastName, roleRef.current);
      trackEvent("login_success", { provider: "apple", role: roleRef.current });
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== "popup_closed_by_user") {
        setError(e.message || "Apple sign-in failed");
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setError("");
    try {
      const data = await authenticatePasskey();
      passkeyLogin(data.token, data.user as unknown as Parameters<typeof passkeyLogin>[1]);
      trackEvent("login_success", { provider: "passkey" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Passkey authentication failed");
    } finally {
      setPasskeyLoading(false);
    }
  };

  useEffect(() => {
    if (!hasGoogleClientId || !googleContainerRef.current) return;
    const container = googleContainerRef.current;
    container.innerHTML = "";
    loadGoogleIdentity().then(() => {
      if (!window.google?.accounts?.id || !container.isConnected) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID as string,
        callback: (resp: { credential: string }) => {
          setGoogleLoading(true);
          setError("");
          googleLogin(resp.credential, roleRef.current)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : "Google sign-in failed"))
            .finally(() => setGoogleLoading(false));
        },
      });
      window.google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        text: isSignIn ? "signin_with" : "signup_with",
        width: Math.min(container.offsetWidth || 300, 380),
        logo_alignment: "center",
      });
    });
  }, [isSignIn, googleLogin]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isSignIn && name.trim().length < 2) errs.name = "Name must be at least 2 characters";
    if (!email.includes("@") || !email.includes(".")) errs.email = "Enter a valid email address";
    if (password.length < 8) errs.password = "Password must be at least 8 characters";
    if (!isSignIn && !consent) errs.consent = "You must agree to the Privacy Policy and Terms to create an account";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setLoading(true);
    try {
      if (isSignIn) {
        await login(email, password);
        trackEvent("login_success", { role });
      } else {
        const recaptchaToken = await getRecaptchaToken("register");
        await register(name, email, password, role === "lawyer" ? "advocate" : "client", recaptchaToken ?? undefined);
        trackEvent("register_success", { role });
        // Show onboarding for first-time users
        const alreadyOnboarded = localStorage.getItem("lf_onboarded");
        if (!alreadyOnboarded) {
          setShowOnboarding(true);
        } else {
          setLocation(postAuthDest(role));
        }
      }
    } catch (err: any) {
      setError(err.message || (isSignIn ? "Login failed" : "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = (m: Mode) => {
    setMode(m);
    setError("");
    setFieldErrors({});
    setConsent(false);
  };

  return (
    <div className="min-h-screen flex bg-background" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <SEOHelmet title={isSignIn ? "Sign In" : "Create Account"} description="Access LitigaForge AI legal tools." canonical="/login" />

      {/* Left: Hero panel — navy dark */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1a1b2e 0%, #0d0e1a 60%, #0A0B10 100%)" }}>

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        {/* Glow orbs */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)", transform: "translate(-30%, 30%)" }} />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <Scale className="w-5 h-5" style={{ color: "#f59e0b" }} />
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight">LitigaForge</span>
            <span className="font-bold text-sm" style={{ color: "#f59e0b" }}> AI</span>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              {copy.badge}
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight">
              {headingLines[0]}<br />
              <span style={{ background: "linear-gradient(90deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                {headingLines[1] ?? ""}
              </span>
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              {copy.sub}
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5">
            {[
              { n: "24/7", label: "AI Access" },
              { n: "3", label: "AI Models" },
              { n: "Early access", label: "Advocates onboarding" },
            ].map(({ n, label }, i, arr) => (
              <div key={label} className="flex items-center gap-5">
                <div className="text-center">
                  <p className="text-lg font-extrabold text-white">{n}</p>
                  <p className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</p>
                </div>
                {i < arr.length - 1 && <div className="w-px h-7" style={{ background: "rgba(255,255,255,0.12)" }} />}
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="space-y-2.5">
            {[
              { icon: "✓", text: "Verified advocates with Bar Council IDs" },
              { icon: "⚡", text: "AI-matched in under 2 minutes" },
              { icon: "🔒", text: "Anonymous case posting available" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <span className="text-[13px]">{icon}</span>
                <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
          {copy.trust}
        </p>
      </div>

      {/* Right: Auth Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Role Tabs */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              type="button"
              onClick={() => setRole("client")}
              className={`flex items-center gap-2 justify-center px-4 py-3 rounded-xl border font-semibold text-sm transition-all ${
                isClient
                  ? "border-primary bg-primary text-primary-foreground shadow"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
            >
              <User className="w-4 h-4" /> Client
            </button>
            <button
              type="button"
              onClick={() => setRole("lawyer")}
              className={`flex items-center gap-2 justify-center px-4 py-3 rounded-xl border font-semibold text-sm transition-all ${
                !isClient
                  ? "border-primary bg-primary text-primary-foreground shadow"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
            >
              <Briefcase className="w-4 h-4" /> Advocate
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center justify-center gap-1 mb-6">
            <button
              type="button"
              data-testid="tab-login"
              onClick={() => toggleMode("signin")}
              className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all ${
                isSignIn ? "text-primary bg-muted" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              data-testid="tab-register"
              onClick={() => toggleMode("signup")}
              className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all ${
                !isSignIn ? "text-primary bg-muted" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Card */}
          <div className="bg-card rounded-2xl border border-border shadow-xl p-8">
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-foreground">
                {isSignIn ? `Welcome back, ${isClient ? "Client" : "Advocate"}` : `Join as ${isClient ? "Client" : "Advocate"}`}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {isSignIn ? "Enter your credentials to continue" : "Start your legal journey today"}
              </p>
            </div>

            {/* ── Social login buttons — always visible ── */}
            <div className="mb-5 space-y-2.5">
              {/* Google Sign-In */}
              {hasGoogleClientId ? (
                <>
                  <div
                    ref={googleContainerRef}
                    className="w-full flex justify-center min-h-[44px]"
                    aria-label="Sign in with Google"
                  />
                  {googleLoading && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Signing in with Google…
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setError("Add VITE_GOOGLE_CLIENT_ID in Replit Secrets to enable Google Sign-In")}
                  className="w-full h-11 rounded-xl border border-border bg-card text-foreground font-medium text-sm flex items-center justify-center gap-2.5 hover:bg-muted transition-all"
                  aria-label="Sign in with Google (setup required)"
                  data-testid="google-btn"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </button>
              )}

              {/* Sign in with Apple */}
              {hasAppleClientId ? (
                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  disabled={appleLoading}
                  className="w-full h-11 rounded-xl border border-border bg-black text-white font-medium text-sm flex items-center justify-center gap-2.5 hover:bg-neutral-900 disabled:opacity-60 transition-all"
                  aria-label="Sign in with Apple"
                >
                  {appleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white flex-shrink-0" aria-hidden="true">
                      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09z"/>
                      <path d="M15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
                    </svg>
                  )}
                  {appleLoading ? "Signing in with Apple…" : (isSignIn ? "Sign in with Apple" : "Continue with Apple")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setError("Add VITE_APPLE_CLIENT_ID in Replit Secrets to enable Apple Sign-In")}
                  className="w-full h-11 rounded-xl border border-border bg-neutral-950 text-white font-medium text-sm flex items-center justify-center gap-2.5 hover:bg-neutral-900 transition-all"
                  aria-label="Sign in with Apple (setup required)"
                  data-testid="apple-btn"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white flex-shrink-0" aria-hidden="true">
                    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09z"/>
                    <path d="M15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
                  </svg>
                  Sign in with Apple
                </button>
              )}

              {/* Passkey (sign-in only) */}
              {isSignIn && (
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={passkeyLoading}
                  className="w-full h-11 rounded-xl border border-border bg-card text-foreground font-medium text-sm flex items-center justify-center gap-2.5 hover:bg-muted disabled:opacity-60 transition-all"
                  aria-label="Sign in with a Passkey"
                  data-testid="passkey-btn"
                >
                  {passkeyLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Fingerprint className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                  {passkeyLoading ? "Authenticating…" : "Sign in with Passkey"}
                </button>
              )}

              {/* Divider */}
              <div className="relative pt-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground font-medium">or continue with email</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {!isSignIn && (
                  <motion.div
                    key="name-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <label className="text-sm font-medium text-foreground">Full Name</label>
                    <input
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: "" })); }}
                      required={!isSignIn}
                      placeholder={isClient ? "Ravi Kumar" : "Adv. Ramesh Kumar"}
                      className={`w-full px-4 py-3 rounded-xl border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${
                        fieldErrors.name ? "border-red-400 focus:ring-red-400" : "border-border"
                      }`}
                    />
                    {fieldErrors.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email Address</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: "" })); }}
                  required
                  placeholder="you@example.com"
                  className={`w-full px-4 py-3 rounded-xl border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${
                    fieldErrors.email ? "border-red-400 focus:ring-red-400" : "border-border"
                  }`}
                />
                {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  {isSignIn && (
                    <Link href="/forgot-password">
                      <span className="text-xs text-primary hover:underline cursor-pointer">Forgot password?</span>
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    autoComplete={isSignIn ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: "" })); }}
                    required
                    placeholder="Minimum 8 characters"
                    className={`w-full px-4 py-3 rounded-xl border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all pr-12 ${
                      fieldErrors.password ? "border-red-400 focus:ring-red-400" : "border-border"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {!isSignIn && (
                <motion.div
                  key="consent-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => { setConsent(e.target.checked); setFieldErrors((p) => ({ ...p, consent: "" })); }}
                      className="mt-0.5 w-4 h-4 rounded border-border accent-primary flex-shrink-0"
                      data-testid="consent-checkbox"
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      I have read and agree to the{" "}
                      <Link href="/privacy">
                        <span className="text-primary underline cursor-pointer">Privacy Policy</span>
                      </Link>
                      {" "}and{" "}
                      <Link href="/terms">
                        <span className="text-primary underline cursor-pointer">Terms of Service</span>
                      </Link>
                      . I consent to LitigaForge AI processing my personal data as described therein, in compliance with the DPDP Act 2023.
                    </span>
                  </label>
                  {fieldErrors.consent && (
                    <p className="text-xs text-red-500 mt-1.5">{fieldErrors.consent}</p>
                  )}
                </motion.div>
              )}

              <button
                type="submit"
                data-testid="create-account-btn"
                disabled={loading || !email || !password || (!isSignIn && !name) || (!isSignIn && !consent)}
                className="w-full h-12 rounded-xl font-semibold tracking-wide flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md bg-primary text-white"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {loading ? (isSignIn ? "Signing in…" : "Creating account…") : isSignIn ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {isSignIn ? (
                <>
                  New to LitigaForge?{" "}
                  <button onClick={() => toggleMode("signup")} className="font-semibold text-primary hover:underline">
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button onClick={() => toggleMode("signin")} className="font-semibold text-primary hover:underline">
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground mt-6 font-medium">
            <Link href="/privacy"><span className="underline cursor-pointer hover:text-primary transition-colors">Privacy Policy</span></Link>
            {" · "}
            <Link href="/terms"><span className="underline cursor-pointer hover:text-primary transition-colors">Terms of Service</span></Link>
            {" · DPDP Act 2023 compliant"}
          </p>
        </motion.div>
      </div>

      {/* Role-based onboarding for new registrations */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingModal
            role={role}
            redirectTo={postAuthDest(role)}
            onComplete={() => setShowOnboarding(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
