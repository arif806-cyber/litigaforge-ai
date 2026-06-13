import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { AdSlot } from "@/components/AdSlot";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";
import {
  Loader2, Sparkles, Lock, FileText, ShieldCheck, AlertTriangle,
  Download, Copy, CheckCircle2, Printer, Scale, CreditCard, Globe2,
} from "lucide-react";

interface TemplateField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  help_text?: string;
}

interface TemplateMeta {
  slug: string;
  title: string;
  description: string;
  fields: TemplateField[];
  price_usd: string;
  currency: string;
  configured: boolean;
  demo_available: boolean;
}

type Phase = "form" | "preview" | "finalizing" | "paid";

const inputClass =
  "w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm";

function getReturnUrl() {
  return window.location.origin + window.location.pathname;
}

export default function UsDemandLetter() {
  const [meta, setMeta] = useState<TemplateMeta | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [docId, setDocId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [fullText, setFullText] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load template (fields + price + payment availability)
  useEffect(() => {
    apiFetch("/documents/paid/template")
      .then((d: TemplateMeta) => setMeta(d))
      .catch(() => setError("Could not load the demand-letter form. Please refresh."));
  }, []);

  // Returning from checkout: ?doc=<id> → poll until paid, then fetch full text
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const doc = params.get("doc");
    if (!doc) return;
    setDocId(doc);
    setPhase("finalizing");
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const s = await apiFetch(`/documents/paid/status/${doc}`);
        if (cancelled) return;
        if (s.status === "paid") {
          await loadFull(doc);
          return;
        }
      } catch {
        /* keep trying */
      }
      if (cancelled) return;
      if (attempts >= 20) {
        setError("We couldn't confirm your payment yet. If you completed checkout, it can take a minute — use the button below to retry.");
        return;
      }
      pollRef.current = setTimeout(poll, 2000);
    };
    poll();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFull = async (doc: string) => {
    try {
      const d = await apiFetch(`/documents/paid/document/${doc}`);
      setFullText(d.document_text);
      setPhase("paid");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your document.");
    }
  };

  const requiredFilled =
    meta?.fields.filter((f) => f.required).every((f) => values[f.name]?.trim()) ?? false;

  const handleGenerate = async () => {
    if (!meta) return;
    setError("");
    setGenerating(true);
    try {
      const d = await apiFetch("/documents/paid/generate", {
        method: "POST",
        body: JSON.stringify({ fields: values, email: values.sender_email || "" }),
      });
      setDocId(d.doc_id);
      setPreview(d.preview_text);
      setPhase("preview");
      setMeta((m) => (m ? { ...m, configured: d.configured, demo_available: d.demo_available, price_usd: d.price_usd } : m));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleUnlock = async () => {
    if (!docId) return;
    setError("");
    setUnlocking(true);
    try {
      const d = await apiFetch("/documents/paid/checkout", {
        method: "POST",
        body: JSON.stringify({
          doc_id: docId,
          email: values.sender_email || "",
          return_url: getReturnUrl(),
        }),
      });
      if (d.checkout_url) {
        window.location.href = d.checkout_url;
        return;
      }
      if (d.status === "paid") {
        await loadFull(docId);
        return;
      }
      if (d.demo) {
        // Off-production demo: simulate a successful payment so the flow is testable.
        await apiFetch(`/documents/paid/demo-complete/${docId}`, { method: "POST" });
        await loadFull(docId);
        return;
      }
      setError("Checkout is unavailable right now. Please try again shortly.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setUnlocking(false);
    }
  };

  const retryConfirm = async () => {
    if (!docId) return;
    setError("");
    setPhase("finalizing");
    try {
      const s = await apiFetch(`/documents/paid/status/${docId}`);
      if (s.status === "paid") {
        await loadFull(docId);
      } else {
        setError("Payment not confirmed yet. Please wait a moment and retry.");
      }
    } catch {
      setError("Could not check payment status. Please retry.");
    }
  };

  const handleCopy = async () => {
    if (!fullText) return;
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!fullText) return;
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "us_demand_letter.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!fullText) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<title>Demand Letter</title><pre style="font-family:Georgia,serif;white-space:pre-wrap;padding:48px;line-height:1.7;font-size:14px;max-width:720px;margin:0 auto">${fullText.replace(/</g, "&lt;")}</pre>`
    );
    w.document.close();
    w.focus();
    w.print();
  };

  const price = meta?.price_usd || "29";

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <SEOHelmet
        title="U.S. Demand Letter — Draft & Send in Minutes"
        description="Create a professional, state-specific U.S. demand letter for unpaid debts, broken contracts, deposits, or damages. AI-drafted, ready to send. Pay only when you're happy."
        canonical="/us-demand-letter"
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-10" data-testid="page-us-demand-letter">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <Globe2 className="w-3.5 h-3.5" /> United States
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground flex items-center justify-center gap-2">
            <Scale className="w-8 h-8 text-primary" /> U.S. Demand Letter
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Owed money or wronged? Generate a firm, professional, state-specific demand letter that gets results —
            often resolving disputes <strong>before</strong> you ever go to court. Preview free, unlock for{" "}
            <strong>${price}</strong>.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Secure checkout</span>
            <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-primary" /> Ready to send</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> No account needed</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2" data-testid="error-banner">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p>{error}</p>
              {phase === "finalizing" && docId && (
                <Button size="sm" variant="outline" onClick={retryConfirm} data-testid="button-retry-confirm">
                  Retry payment check
                </Button>
              )}
            </div>
          </div>
        )}

        {/* FINALIZING (returned from checkout) */}
        {phase === "finalizing" && !error && (
          <div className="bg-card border border-border rounded-2xl p-10 text-center" data-testid="finalizing">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="font-semibold text-foreground">Confirming your payment…</p>
            <p className="text-sm text-muted-foreground mt-1">This usually takes a few seconds. Please don't close this page.</p>
          </div>
        )}

        {/* PAID — full document */}
        {phase === "paid" && (
          <div className="max-w-3xl mx-auto" data-testid="paid-document">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 mb-5 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-emerald-900">Your demand letter is unlocked</p>
                <p className="text-sm text-emerald-800">Download, copy, or print it below — it's ready to send.</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="border-b border-border p-3 flex items-center gap-2 flex-wrap">
                <Button variant="ghost" size="sm" onClick={handleDownload} data-testid="button-download">
                  <Download className="w-4 h-4 mr-1" /> Download
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCopy} data-testid="button-copy">
                  {copied ? <CheckCircle2 className="w-4 h-4 mr-1 text-green-600" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handlePrint} data-testid="button-print">
                  <Printer className="w-4 h-4 mr-1" /> Print / Save PDF
                </Button>
              </div>
              <div className="p-6 max-h-[640px] overflow-y-auto">
                <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground">{fullText}</pre>
              </div>
            </div>
          </div>
        )}

        {/* FORM + PREVIEW/PAYWALL */}
        {(phase === "form" || phase === "preview") && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Your details
              </h2>
              {!meta ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                meta.fields.map((field) => (
                  <div key={field.name} className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea
                        value={values[field.name] || ""}
                        onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                        placeholder={field.placeholder}
                        rows={3}
                        className={`${inputClass} resize-none`}
                        data-testid={`input-${field.name}`}
                      />
                    ) : field.type === "select" ? (
                      <select
                        value={values[field.name] || ""}
                        onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                        className={inputClass}
                        data-testid={`input-${field.name}`}
                      >
                        <option value="">Select {field.label}</option>
                        {(field.options || []).map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                        value={values[field.name] || ""}
                        onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                        placeholder={field.placeholder}
                        className={inputClass}
                        data-testid={`input-${field.name}`}
                      />
                    )}
                    {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
                  </div>
                ))
              )}

              <Button
                onClick={handleGenerate}
                disabled={!requiredFilled || generating}
                className="w-full"
                size="lg"
                data-testid="button-generate"
              >
                {generating ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Drafting your letter…</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2" /> Generate Free Preview</>
                )}
              </Button>
              {!requiredFilled && meta && (
                <p className="text-xs text-muted-foreground text-center">Fill all required fields (*) to generate your free preview.</p>
              )}
            </div>

            {/* Preview / Paywall */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Preview
              </h2>

              {phase !== "preview" ? (
                <div className="bg-muted/50 border border-dashed border-border rounded-2xl p-8 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    Your AI-drafted demand letter preview appears here. The full, ready-to-send letter unlocks after payment.
                  </p>
                </div>
              ) : (
                <div className="space-y-4" data-testid="preview-block">
                  <div className="relative bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-5 max-h-[360px] overflow-hidden">
                      <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground">{preview}</pre>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                  </div>

                  {/* Paywall card */}
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-center">
                    <Lock className="w-7 h-7 text-primary mx-auto mb-2" />
                    <p className="font-semibold text-foreground">Unlock your complete demand letter</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Get the full body, exact demand &amp; deadline, legal basis, and signature block — ready to send today.
                    </p>
                    <div className="text-3xl font-bold text-foreground my-3">${price}<span className="text-sm font-normal text-muted-foreground"> one-time</span></div>
                    <Button onClick={handleUnlock} disabled={unlocking} size="lg" className="w-full" data-testid="button-unlock">
                      {unlocking ? (
                        <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Starting checkout…</>
                      ) : (
                        <><CreditCard className="w-5 h-5 mr-2" /> Unlock for ${price}</>
                      )}
                    </Button>
                    {meta?.demo_available && (
                      <p className="text-[11px] text-amber-700 mt-2">Demo mode: no real payment is taken in this environment.</p>
                    )}
                    {meta && !meta.configured && !meta.demo_available && (
                      <p className="text-[11px] text-muted-foreground mt-2">Card payments are being set up. Please check back soon.</p>
                    )}
                  </div>

                  {/* AdSense for non-payers */}
                  <AdSlot className="my-2" />
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
                <p className="font-medium mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Legal Disclaimer</p>
                <p>
                  LitigaForge is not a law firm and does not provide legal advice. This AI-generated document is for
                  informational purposes and does not create an attorney-client relationship. For high-value or complex
                  disputes, have a licensed attorney in your state review the letter before sending.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <LegalDisclaimerFooter />
    </div>
  );
}
