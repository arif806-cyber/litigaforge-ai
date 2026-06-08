import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { FileSearch, Loader2, AlertTriangle, AlertCircle, CheckCircle2, Info, ChevronDown } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCountry } from "@/hooks/useCountry";
import { ClarifyDialog } from "@/components/ClarifyDialog";

const DOC_TYPES = [
  { id: "contract", label: "Contract / Agreement" },
  { id: "sale_deed", label: "Sale Deed" },
  { id: "rental_agreement", label: "Rental / Lease Agreement" },
  { id: "legal_notice", label: "Legal Notice" },
  { id: "fir", label: "FIR / Complaint" },
  { id: "petition", label: "Court Petition" },
  { id: "power_of_attorney", label: "Power of Attorney" },
  { id: "mou", label: "MOU / LOI" },
  { id: "will", label: "Will / Testament" },
  { id: "other", label: "Other Document" },
];

const RISK_CONFIG = {
  HIGH:   { color: "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800", icon: AlertTriangle },
  MEDIUM: { color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800", icon: AlertCircle },
  LOW:    { color: "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800", icon: Info },
};

interface AnalysisResult {
  summary: string;
  risk_score: number;
  risks: { severity: string; issue: string; section?: string }[];
  missing_clauses: string[];
  jurisdiction_issues: string[];
  recommendations: string[];
}

function RiskScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800"
    : score >= 4 ? "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
    : "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800";
  const label = score >= 7 ? "High Risk" : score >= 4 ? "Medium Risk" : "Low Risk";
  return (
    <div className={cn("inline-flex items-center gap-4 px-5 py-3 rounded-2xl border", color)}>
      <span className="text-3xl font-bold tracking-tighter">{score}<span className="text-lg opacity-50">/10</span></span>
      <div className="text-left border-l border-current/20 pl-4">
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-0.5">Risk Score</div>
        <div className="text-sm font-semibold">{label}</div>
      </div>
    </div>
  );
}

export default function Review() {
  const { activeCode, activeConfig } = useCountry();
  const [docText, setDocText] = useState("");
  const [docType, setDocType] = useState("contract");
  const [docTypeOpen, setDocTypeOpen] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [clarifyOpen, setClarifyOpen] = useState(false);

  const analyze = useMutation({
    mutationFn: (context: string) => apiFetch("/document/analyze", {
      method: "POST",
      body: JSON.stringify({ document_text: docText, document_type: docType, country: activeCode, context }),
    }),
    onSuccess: (data) => setResult(data),
  });

  const runAnalyze = (extraDetails: string) => {
    setClarifyOpen(false);
    setResult(null);
    analyze.mutate(extraDetails);
  };

  const selectedType = DOC_TYPES.find(d => d.id === docType) ?? DOC_TYPES[0];

  return (
    <PageShell title="Document Analyzer" subtitle={`Paste any legal document — AI identifies risks, missing clauses, and jurisdiction issues under the law of ${activeConfig?.name ?? "your country"}.`} icon={<FileSearch className="w-6 h-6 text-primary" />}>
      <SEOHelmet
        title="Free Legal Document Analyzer | LitigaForge AI"
        description="Paste any contract, agreement, notice, or legal document and get an instant AI risk score, missing clause detection, and recommendations. Free online legal document analyzer."
        canonical="/review"
        keywords="legal document analyzer, contract review online free, document analysis, rental agreement check, missing clause detector"
      />

      <div className="space-y-8">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8 space-y-6">
          <div className="relative">
            <label className="block text-sm font-semibold text-foreground mb-3">Document Type</label>
            <button
              onClick={() => setDocTypeOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-input bg-background text-sm font-medium text-foreground hover:border-primary/50 transition-colors shadow-sm"
            >
              {selectedType.label}
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", docTypeOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
              {docTypeOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden"
                >
                  {DOC_TYPES.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setDocType(d.id); setDocTypeOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-3 text-sm font-medium transition-colors",
                        d.id === docType ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div>
            <div className="flex justify-between items-end mb-3">
              <label className="block text-sm font-semibold text-foreground">
                Document Text
              </label>
               <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">{docText.length.toLocaleString()} chars</span>
            </div>
            <textarea
              value={docText}
              onChange={e => setDocText(e.target.value)}
              rows={12}
              placeholder="Paste the full text of the document here. The more complete the text, the better the analysis..."
              className="w-full px-5 py-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-y font-mono leading-relaxed shadow-sm"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setClarifyOpen(true)}
              disabled={docText.trim().length < 50 || analyze.isPending}
              size="lg"
              className="px-8 shadow-md"
            >
              {analyze.isPending
                ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Analysing…</>
                : <><FileSearch className="w-5 h-5 mr-2" /> Analyse Document</>}
            </Button>
          </div>

          {analyze.isError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
              {(analyze.error as Error).message}
            </div>
          )}
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Summary + risk score */}
              <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8">
                <div className="flex flex-col sm:flex-row gap-8">
                   <div className="flex-shrink-0">
                     <RiskScoreBadge score={result.risk_score} />
                   </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Executive Summary
                    </h3>
                    <p className="text-base text-foreground/80 leading-relaxed">{result.summary}</p>
                  </div>
                </div>
              </div>

              {/* Risks */}
              {result.risks.length > 0 && (
                <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8">
                   <h3 className="text-sm font-bold text-foreground mb-5 flex items-center justify-between">
                     <span className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                        Identified Risks
                     </span>
                     <span className="bg-muted px-2 py-1 rounded text-xs font-mono text-muted-foreground">{result.risks.length} found</span>
                   </h3>
                  <div className="space-y-3">
                    {result.risks.map((r, i) => {
                      const cfg = RISK_CONFIG[r.severity as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.LOW;
                      const Icon = cfg.icon;
                      return (
                        <div key={i} className={cn("flex gap-4 p-4 rounded-xl border", cfg.color)}>
                          <div className="bg-background rounded-full p-2 h-fit mt-0.5">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-[10px] tracking-widest uppercase px-2 py-0.5 rounded bg-background/50 border border-current/10">{r.severity}</span>
                              {r.section && <span className="text-xs font-mono font-medium opacity-80">Section {r.section}</span>}
                            </div>
                            <p className="text-sm font-medium leading-snug">{r.issue}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Missing clauses */}
                {result.missing_clauses.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8">
                    <h3 className="text-sm font-bold text-foreground mb-5 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                       Missing Clauses
                    </h3>
                    <ul className="space-y-4">
                      {result.missing_clauses.map((c, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-foreground/80 font-medium">
                          <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <span className="pt-1 leading-snug">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {result.recommendations.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8">
                     <h3 className="text-sm font-bold text-foreground mb-5 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                       Recommendations
                    </h3>
                    <ul className="space-y-4">
                      {result.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-foreground/80 font-medium">
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="leading-snug">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ClarifyDialog
        open={clarifyOpen}
        surface="document"
        baseText={docText}
        country={activeCode}
        onProceed={runAnalyze}
        onClose={() => setClarifyOpen(false)}
        proceedLabel="Analyse Document"
      />
    </PageShell>
  );
}