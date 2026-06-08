import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, ChevronDown, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ClarifySurface = "ask" | "document" | "judgments" | "chat" | "case";

interface ClarifyDialogProps {
  open: boolean;
  surface: ClarifySurface;
  baseText: string;
  country: string;
  onProceed: (extraDetails: string) => void;
  onClose: () => void;
  proceedLabel?: string;
  title?: string;
}

interface ClarifyResponse {
  needs_clarification: boolean;
  questions: string[];
}

const GENERIC_FIELDS = [
  { id: "location", label: "Location / jurisdiction", placeholder: "e.g. city, state or region" },
  { id: "parties", label: "People or parties involved", placeholder: "e.g. employer, landlord, spouse" },
  { id: "dates", label: "Key dates", placeholder: "e.g. when it happened, deadlines" },
  { id: "amount", label: "Amount / value involved", placeholder: "e.g. ₹50,000, $2,000" },
  { id: "notes", label: "Anything else", placeholder: "Other details that may matter" },
] as const;

export function ClarifyDialog({
  open, surface, baseText, country,
  onProceed, onClose, proceedLabel = "Get Answer", title = "A few quick details",
}: ClarifyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [generic, setGeneric] = useState<Record<string, string>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setQuestions([]);
    setAnswers({});
    setGeneric({});
    setDetailsOpen(false);
    (async () => {
      try {
        const data: ClarifyResponse = await apiFetch("/clarify", {
          method: "POST",
          body: JSON.stringify({ text: baseText, surface, country }),
        });
        if (cancelled) return;
        const qs = Array.isArray(data?.questions) ? data.questions : [];
        setQuestions(qs);
        setDetailsOpen(qs.length === 0);
      } catch {
        if (!cancelled) {
          setQuestions([]);
          setDetailsOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, baseText, surface, country]);

  const compose = (): string => {
    const parts: string[] = [];
    questions.forEach((q, i) => {
      const a = (answers[i] ?? "").trim();
      if (a) parts.push(`${q} ${a}`);
    });
    for (const f of GENERIC_FIELDS) {
      const v = (generic[f.id] ?? "").trim();
      if (v) parts.push(`${f.label}: ${v}`);
    }
    if (!parts.length) return "";
    return "Additional details provided by the user:\n- " + parts.join("\n- ");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={onClose}
          data-testid="clarify-overlay"
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            className="bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-border shadow-2xl max-h-[88vh] flex flex-col"
            data-testid="clarify-dialog"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-base font-bold text-foreground">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                data-testid="clarify-close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Working out what would help…</p>
                </div>
              ) : (
                <>
                  {questions.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Answering these helps us give a more accurate answer. All are optional.
                      </p>
                      {questions.map((q, i) => (
                        <div key={i} className="space-y-1.5">
                          <label className="block text-sm font-semibold text-foreground">{q}</label>
                          <input
                            value={answers[i] ?? ""}
                            onChange={e => setAnswers(p => ({ ...p, [i]: e.target.value }))}
                            placeholder="Your answer (optional)"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            data-testid={`clarify-answer-${i}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Your input looks clear. You can optionally add more details below for an even better answer.
                    </p>
                  )}

                  <div className="border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setDetailsOpen(o => !o)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
                      data-testid="clarify-details-toggle"
                    >
                      Add more details (optional)
                      <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", detailsOpen && "rotate-180")} />
                    </button>
                    <AnimatePresence>
                      {detailsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/50">
                            {GENERIC_FIELDS.map(f => (
                              <div key={f.id} className="space-y-1.5">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</label>
                                <input
                                  value={generic[f.id] ?? ""}
                                  onChange={e => setGeneric(p => ({ ...p, [f.id]: e.target.value }))}
                                  placeholder={f.placeholder}
                                  className="w-full px-3.5 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                  data-testid={`clarify-field-${f.id}`}
                                />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => onProceed("")}
                disabled={loading}
                data-testid="clarify-skip"
              >
                Skip
              </Button>
              <Button
                onClick={() => onProceed(compose())}
                disabled={loading}
                className="px-6 shadow-md"
                data-testid="clarify-proceed"
              >
                {proceedLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
