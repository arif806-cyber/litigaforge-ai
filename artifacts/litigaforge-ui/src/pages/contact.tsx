import { useState } from "react";
import { Mail, MapPin, Clock, Send, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";

const CONTACT_EMAIL = "legal@litigaforge.com";

const SUBJECTS = [
  "General Inquiry",
  "Legal Question",
  "Technical Support",
  "Partnership",
  "Press & Media",
  "Other",
];

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!message.trim()) {
      setError("Please enter a message.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/contact", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          message: message.trim(),
        }),
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
        data-testid="page-contact"
      >
        <SEOHelmet
          title="Contact Us"
          description="Get in touch with LitigaForge AI. We typically respond within 24 hours."
          canonical="/contact"
        />

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Contact Us</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-1">We typically respond within 24 hours</p>
        </div>

        {/* Form / success */}
        {submitted ? (
          <div
            className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-6 flex items-start gap-3"
            data-testid="contact-success"
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900">Message sent</p>
              <p className="text-sm text-emerald-800 mt-1">
                Thank you! We will get back to you within 24 hours.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="contact-form">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-foreground mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Your full name"
                required
                data-testid="input-name"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium text-foreground mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
                required
                data-testid="input-email"
              />
            </div>

            <div>
              <label htmlFor="contact-subject" className="block text-sm font-medium text-foreground mb-1.5">
                Subject
              </label>
              <select
                id="contact-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputClass}
                data-testid="select-subject"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium text-foreground mb-1.5">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={`${inputClass} min-h-[140px] resize-y`}
                placeholder="How can we help you?"
                required
                data-testid="input-message"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" data-testid="contact-error">{error}</p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full"
              data-testid="button-send"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </form>
        )}

        {/* Contact details */}
        <div className="bg-muted/40 rounded-xl p-5 border border-border space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">Reach us directly</h2>
          <p className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-primary flex-shrink-0" />
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
            Hyderabad, Telangana, India
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 text-primary flex-shrink-0" />
            Monday to Saturday, 9AM to 6PM IST
          </p>
        </div>
      </div>

      <LegalDisclaimerFooter />
    </div>
  );
}
