import { useState } from "react";
import { useLocation } from "wouter";
import { Scale, Loader2, AlertTriangle, Eye, EyeOff, User, Briefcase, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { SEOHelmet } from "@/components/SEOHelmet";
import { motion, AnimatePresence } from "framer-motion";

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
      } else {
        await register(name, email, password, role);
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
    <div className="min-h-screen flex" style={{ background: "#F8FAFC", fontFamily: "'Space Grotesk', sans-serif" }}>
      <SEOHelmet title={isSignIn ? "Sign In" : "Create Account"} description="Access LitigaForge AI legal tools." canonical="/login" />

      {/* Left: Hero */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10" style={{ background: "#1a2744" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
            <Scale className="w-4 h-4" style={{ color: "#FBBF24" }} />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">LitigaForge</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-white leading-tight">
            Legal intelligence<br />for Telangana & AP
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            Connect with verified lawyers, analyze documents, search judgments, and get AI-powered legal strategy — all in one platform.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <div className="text-center">
              <p className="text-xl font-bold text-white">16</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Gov APIs</p>
            </div>
            <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.15)" }} />
            <div className="text-center">
              <p className="text-xl font-bold text-white">3</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>AI Engines</p>
            </div>
            <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.15)" }} />
            <div className="text-center">
              <p className="text-xl font-bold text-white">100+</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Lawyers</p>
            </div>
          </div>
        </div>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
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
                  ? "border-[#1a2744] bg-[#1a2744] text-white shadow"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              }`}
            >
              <User className="w-4 h-4" /> Client
            </button>
            <button
              type="button"
              onClick={() => setRole("lawyer")}
              className={`flex items-center gap-2 justify-center px-4 py-3 rounded-xl border font-semibold text-sm transition-all ${
                !isClient
                  ? "border-[#1a2744] bg-[#1a2744] text-white shadow"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
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
                isSignIn ? "text-[#1a2744] bg-gray-100" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => toggleMode("signup")}
              className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all ${
                !isSignIn ? "text-[#1a2744] bg-gray-100" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8">
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-gray-900">
                {isSignIn ? `Welcome back, ${isClient ? "Client" : "Advocate"}` : `Join as ${isClient ? "Client" : "Advocate"}`}
              </h1>
              <p className="text-xs text-gray-400 mt-1">
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
                    <label className="text-sm font-medium text-gray-700">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: "" })); }}
                      required={!isSignIn}
                      placeholder={isClient ? "Ravi Kumar" : "Adv. Ramesh Kumar"}
                      className={`w-full px-4 py-3 rounded-xl border bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a2744] focus:border-transparent transition-all ${
                        fieldErrors.name ? "border-red-400 focus:ring-red-400" : "border-gray-200"
                      }`}
                    />
                    {fieldErrors.name && <p className="text-xs text-red-500">{fieldErrors.name}</p>}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: "" })); }}
                  required
                  placeholder="you@example.com"
                  className={`w-full px-4 py-3 rounded-xl border bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a2744] focus:border-transparent transition-all ${
                    fieldErrors.email ? "border-red-400 focus:ring-red-400" : "border-gray-200"
                  }`}
                />
                {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: "" })); }}
                    required
                    placeholder="Minimum 8 characters"
                    className={`w-full px-4 py-3 rounded-xl border bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a2744] focus:border-transparent transition-all pr-12 ${
                      fieldErrors.password ? "border-red-400 focus:ring-red-400" : "border-gray-200"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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
                className="w-full h-12 rounded-xl font-semibold tracking-wide flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                style={{ background: "#1a2744", color: "#fff" }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {loading ? (isSignIn ? "Signing in…" : "Creating account…") : isSignIn ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              {isSignIn ? (
                <>
                  New to LitigaForge?{" "}
                  <button onClick={() => toggleMode("signup")} className="font-semibold text-[#1a2744] hover:underline">
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button onClick={() => toggleMode("signin")} className="font-semibold text-[#1a2744] hover:underline">
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="text-center text-[11px] text-gray-400 mt-6 font-medium">
            By continuing, you agree to our terms of service and privacy policy
          </p>
        </motion.div>
      </div>
    </div>
  );
}
