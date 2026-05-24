import { useState } from "react";
import { useLocation } from "wouter";
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

  const isSignIn = mode === "signin";
  const isClient = role === "client";

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isSignIn && name.trim().length < 2) errs.name = "Name must be at least 2 characters";
    if (!email.includes("@") || !email.includes(".")) errs.email = "Enter a valid email address";
    if (password.length < 8) errs.password = "Password must be at least 8 characters";
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
  };

  return (
    <div className="min-h-screen flex bg-background" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <SEOHelmet title={isSignIn ? "Sign In" : "Create Account"} description="Access LitigaForge AI legal tools." canonical="/login" />

      {/* Left: Hero */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10">
            <Scale className="w-4 h-4 text-amber-400" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">LitigaForge</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-white leading-tight">
            Legal intelligence<br />for Telangana & AP
          </h2>
          <p className="text-sm leading-relaxed text-white/60">
            Connect with verified lawyers, analyze documents, search judgments, and get AI-powered legal strategy — all in one platform.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <div className="text-center">
              <p className="text-xl font-bold text-white">16</p>
              <p className="text-[11px] text-white/50">Gov APIs</p>
            </div>
            <div className="w-px h-8 bg-white/15" />
            <div className="text-center">
              <p className="text-xl font-bold text-white">3</p>
              <p className="text-[11px] text-white/50">AI Engines</p>
            </div>
            <div className="w-px h-8 bg-white/15" />
            <div className="text-center">
              <p className="text-xl font-bold text-white">100+</p>
              <p className="text-[11px] text-white/50">Lawyers</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-white/30">
          Trusted by advocates across Telangana & Andhra Pradesh
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

              <button
                type="submit"
                disabled={loading || !email || !password || (!isSignIn && !name)}
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
            By continuing, you agree to our terms of service and privacy policy
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
