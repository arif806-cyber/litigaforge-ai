import { useState } from "react";
import { Scale, CheckCircle2, Loader2, Bell, Clock, FileText, Mail } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";

const PERKS = [
  {
    icon: Scale,
    title: "Top 5 judgments, ranked",
    body: "The most important new Supreme Court & High Court rulings, prioritised by court and recency.",
  },
  {
    icon: FileText,
    title: "Plain-language summaries",
    body: "Each judgment in two clear lines, with a link to the full AI analysis.",
  },
  {
    icon: Clock,
    title: "Every morning, 7 AM IST",
    body: "One concise email a day. Unsubscribe in a single click, any time.",
  },
];

export default function Digest() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/digest/subscribe", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div
        className="flex-1 w-full max-w-2xl mx-auto px-4 py-10 space-y-8"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        data-testid="page-digest"
      >
        <SEOHelmet
          title="Daily Judgment Digest"
          description="Get the 5 most important new Supreme Court & High Court judgments in your inbox every morning — free, with plain-language summaries."
          canonical="/digest"
        />

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Daily Judgment Digest</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-1">
            The top 5 new judgments, summarised and delivered every morning at 7 AM IST.
          </p>
        </div>

        {/* Form / success */}
        {submitted ? (
          <div
            className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-6 flex items-start gap-3"
            data-testid="digest-success"
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900">You're subscribed</p>
              <p className="text-sm text-emerald-800 mt-1">
                You'll receive the top 5 judgments every morning at 7 AM IST. Every email has a
                one-click unsubscribe link.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="digest-form">
            <div>
              <label htmlFor="digest-name" className="block text-sm font-medium text-foreground mb-1.5">
                Name <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="digest-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Your name"
                data-testid="input-name"
              />
            </div>

            <div>
              <label htmlFor="digest-email" className="block text-sm font-medium text-foreground mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="digest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
                required
                data-testid="input-email"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" data-testid="digest-error">{error}</p>
            )}

            <Button type="submit" disabled={submitting} className="w-full" data-testid="button-subscribe">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subscribing…
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Subscribe — it's free
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              No spam. One email a day. Unsubscribe any time.
            </p>
          </form>
        )}

        {/* What you'll get */}
        <div className="grid sm:grid-cols-3 gap-3">
          {PERKS.map((p) => (
            <div key={p.title} className="bg-muted/40 rounded-xl p-4 border border-border space-y-2">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <p.icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <h2 className="text-sm font-bold text-foreground">{p.title}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      <LegalDisclaimerFooter />
    </div>
  );
}
