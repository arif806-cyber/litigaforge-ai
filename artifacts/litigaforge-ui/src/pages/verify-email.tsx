import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Loader2, Scale, XCircle } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";

const BASE = "/litigaforge";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    fetch(`${BASE}/auth/verify?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.detail || "This verification link is invalid or expired.");
        setState("success");
        setMessage(payload.message || "Your email has been verified.");
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "We could not verify your email.");
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SEOHelmet title="Verify Email | LitigaForge" description="Verify your LitigaForge account email address." canonical="/verify-email" noIndex />
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <Scale className="mx-auto mb-5 h-10 w-10 text-primary" />
        {state === "loading" && <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />}
        {state === "success" && <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />}
        {state === "error" && <XCircle className="mx-auto h-10 w-10 text-destructive" />}
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          {state === "loading" ? "Verifying your email…" : state === "success" ? "Email verified" : "Verification unsuccessful"}
        </h1>
        {state !== "loading" && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
        {state !== "loading" && (
          <button type="button" className="mt-6 text-sm font-semibold text-primary hover:underline" onClick={() => setLocation("/login")}>
            Continue to sign in
          </button>
        )}
      </div>
    </div>
  );
}