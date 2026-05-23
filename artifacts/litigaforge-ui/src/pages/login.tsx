import { useState } from "react";
import { useLocation } from "wouter";
import { Scale, Loader2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validate = () => {
    setEmailError("");
    setPasswordError("");
    let ok = true;
    if (!email.includes("@") || !email.includes(".")) {
      setEmailError("Enter a valid email address");
      ok = false;
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      ok = false;
    }
    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setLocation("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground shadow-lg mb-6">
            <Scale className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">LitigaForge AI</h1>
          <p className="text-muted-foreground mt-2 font-medium">Professional Legal Intelligence</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                required
                placeholder="advocate@example.com"
                className={`w-full px-4 py-3 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${emailError ? "border-destructive focus:ring-destructive" : "border-input"}`}
              />
              {emailError && (
                <p className="text-xs text-destructive mt-1">{emailError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setPasswordError(""); }}
                  required
                  placeholder="••••••••"
                  className={`w-full px-4 py-3 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all pr-12 ${passwordError ? "border-destructive focus:ring-destructive" : "border-input"}`}
                />
                {passwordError && (
                  <p className="text-xs text-destructive mt-1">{passwordError}</p>
                )}
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold tracking-wide flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? "Authenticating…" : "Sign In securely"}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            New to LitigaForge?{" "}
            <button
              onClick={() => setLocation("/register")}
              className="text-primary font-semibold hover:underline"
            >
              Request Access
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8 font-medium tracking-widest uppercase">
          Trusted by advocates in Telangana & AP
        </p>
      </motion.div>
    </div>
  );
}