import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Scale, Loader2, AlertTriangle, Eye, EyeOff, User, Briefcase, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { SEOHelmet } from "@/components/SEOHelmet";
import { motion, AnimatePresence } from "framer-motion";
import OnboardingModal from "@/components/OnboardingModal";

type Role = "client" | "lawyer";
type Mode = "signin" | "signup";

export default function Login() {
  const { login, register } = useAuth();
  const [, setLocation] = useLocation();

  const [role, setRole] = useState<Role>("client");
  const [mode, setMode] = useState<Mode>("signin");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [consent, setConsent] = useState(false);

  const isSignIn = mode === "signin";
  const isClient = role === "client";

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
        // login() in auth-context redirects; no extra handling needed
      } else {
        await register(name, email, password, role);
        // Show onboarding for first-time users
        const alreadyOnboarded = localStorage.getItem("lf_onboarded");
        if (!alreadyOnboarded) {
          setShowOnboarding(true);
        } else {
          setLocation(role === "lawyer" ? "/lawyer-dashboard" : "/client-dashboard");
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
        style={{ background: "linear-gradient(160deg, #1a2744 0%, #0f1a35 60%, #0a1020 100%)" }}>

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
              Telangana &amp; AP Legal AI
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-tight">
              Legal intelligence<br />
              <span style={{ background: "linear-gradient(90deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                built for your courts.
              </span>
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              Connect with verified advocates, analyze documents, search TG &amp; AP judgments, and get AI legal strategy — all in one platform.
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5">
            {[
              { n: "16", label: "Gov APIs" },
              { n: "3", label: "AI Models" },
              { n: "100+", label: "Lawyers" },
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
          Trusted by advocates across Telangana &amp; Andhra Pradesh
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
              onClick={() => toggleMode("signin")}
              className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all ${
                isSignIn ? "text-primary bg-muted" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
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
                <label className="text-sm font-medium text-foreground">Password</label>
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
            onComplete={() => setShowOnboarding(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
