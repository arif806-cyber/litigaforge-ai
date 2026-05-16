import { useState } from "react";
import { useLocation } from "wouter";
import { Scale, Loader2, AlertTriangle, Eye, EyeOff, CheckCircle2, Briefcase, User2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const ROLES = [
  {
    id: "advocate",
    title: "Advocate / Lawyer",
    subtitle: "Full AI legal workspace",
    icon: Briefcase,
    features: ["Case Forge", "AI Drafting", "Legal Research", "Template Library", "16 API Chains"],
    color: "border-primary bg-primary/5 ring-primary/30",
    check: "text-primary",
  },
  {
    id: "client",
    title: "Client / Party",
    subtitle: "Track your cases",
    icon: User2,
    features: ["View case status", "Document access", "Hearing reminders"],
    color: "border-blue-400 bg-blue-50/50 ring-blue-300",
    check: "text-blue-600",
  },
];

export default function Register() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<"advocate" | "client">("advocate");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordStrong = password.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordStrong) { setError("Password must be at least 8 characters"); return; }
    setError("");
    setLoading(true);
    try {
      await register(name, email, password, role);
      setLocation(role === "advocate" ? "/dashboard" : "/");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Scale className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create Account</h1>
          <p className="text-sm text-muted-foreground mt-1">Choose your role to get started</p>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {ROLES.map((r) => {
            const Icon = r.icon;
            const selected = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id as "advocate" | "client")}
                className={cn(
                  "text-left p-4 rounded-2xl border-2 ring-0 transition-all duration-200 relative",
                  selected ? cn(r.color, "ring-2") : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                {selected && (
                  <CheckCircle2 className={cn("absolute top-3 right-3 w-4 h-4", r.check)} />
                )}
                <Icon className={cn("w-6 h-6 mb-2", selected ? r.check : "text-gray-400")} />
                <p className={cn("font-bold text-sm", selected ? "text-gray-900" : "text-gray-600")}>{r.title}</p>
                <p className="text-[11px] text-gray-400 mb-2">{r.subtitle}</p>
                <ul className="space-y-0.5">
                  {r.features.map(f => (
                    <li key={f} className="text-[10px] text-gray-500 flex items-center gap-1">
                      <span className={cn("w-1 h-1 rounded-full", selected ? r.check.replace("text-", "bg-") : "bg-gray-300")} />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {role === "advocate" ? "Advocate Name" : "Full Name"}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder={role === "advocate" ? "Adv. Ramesh Kumar" : "Rajesh Reddy"}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder={role === "advocate" ? "advocate@lawfirm.com" : "client@example.com"}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition pr-11"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${passwordStrong ? "text-green-600" : "text-amber-600"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {passwordStrong ? "Strong password" : "Use at least 8 characters"}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name || !email || !passwordStrong}
              className="w-full h-11 rounded-xl bg-primary text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Creating account…" : `Create ${role === "advocate" ? "Advocate" : "Client"} Account`}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button onClick={() => setLocation("/login")} className="text-primary font-semibold hover:underline">
              Sign in
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 font-mono">
          HYDERABAD HIGH COURT DIVISION · TELANGANA & AP
        </p>
      </motion.div>
    </div>
  );
}
