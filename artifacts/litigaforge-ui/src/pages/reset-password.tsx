import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Loader2, Scale } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";

const BASE = "/litigaforge";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) { setState("error"); setMessage("This reset link is missing its token."); return; }
    if (password.length < 8) { setState("error"); setMessage("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setState("error"); setMessage("Passwords do not match."); return; }
    setState("loading"); setMessage("");
    try {
      const response = await fetch(`${BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "This reset link is invalid or expired.");
      setState("success"); setMessage(payload.message || "Your password has been reset.");
    } catch (error: unknown) {
      setState("error"); setMessage(error instanceof Error ? error.message : "Unable to reset password.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SEOHelmet title="Set New Password | LitigaForge" description="Set a new LitigaForge account password." canonical="/reset-password" noIndex />
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <Scale className="mx-auto mb-4 h-10 w-10 text-primary" />
        <h1 className="text-center text-xl font-semibold text-foreground">Set a new password</h1>
        {state === "success" ? (
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
            <p className="mt-3 text-sm text-muted-foreground">{message}</p>
            <button type="button" className="mt-5 text-sm font-semibold text-primary hover:underline" onClick={() => setLocation("/login")}>Continue to sign in</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground" />
            <input required minLength={8} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground" />
            {message && <p className="text-sm text-destructive">{message}</p>}
            <button disabled={state === "loading"} className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60">
              {state === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reset password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}