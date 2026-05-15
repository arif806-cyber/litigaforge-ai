import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { FileSearch, Loader2, AlertTriangle, AlertCircle, CheckCircle2, Info, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  HIGH:   { color: "text-red-700 bg-red-50 border-red-200",    icon: AlertTriangle, dot: "bg-red-500" },
  MEDIUM: { color: "text-amber-700 bg-amber-50 border-amber-200", icon: AlertCircle, dot: "bg-amber-500" },
  LOW:    { color: "text-green-700 bg-green-50 border-green-200", icon: Info, dot: "bg-green-500" },
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
  const color = score >= 7 ? "text-red-700 bg-red-100 border-red-300"
    : score >= 4 ? "text-amber-700 bg-amber-100 border-amber-300"
    : "text-green-700 bg-green-100 border-green-300";
  const label = score >= 7 ? "High Risk" : score >= 4 ? "Medium Risk" : "Low Risk";
  return (
    <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-mono font-bold", color)}>
      <span className="text-2xl">{score}</span>
      <div className="text-left">
        <div className="text-[10px] uppercase tracking-widest opacity-70">Risk Score</div>
        <div className="text-xs">{label}</div>
      </div>
    </div>
  );
}

export default function Review() {
  const [docText, setDocText] = useState("");
  const [docType, setDocType] = useState("contract");
  const [docTypeOpen, setDocTypeOpen] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const analyze = useMutation({
    mutationFn: () => apiFetch("/document/analyze", {
      method: "POST",
      body: JSON.stringify({ document_text: docText, document_type: docType }),
    }),
    onSuccess: (data) => setResult(data),
  });

  const selectedType = DOC_TYPES.find(d => d.id === docType) ?? DOC_TYPES[0];

  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent pointer-events-none" />

      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0 relative z-10 border-b border-gray-200">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
          <FileSearch className="w-6 h-6 text-primary" />
          Document Analyzer
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Paste any legal document — Claude AI identifies risks, missing clauses, and jurisdiction issues under Indian law.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-4 py-6 md:px-10 md:py-8 relative z-10">
        <div className="max-w-3xl space-y-6 pb-20">

          {/* Input card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">

            {/* Doc type selector */}
            <div className="relative">
              <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Document Type</label>
              <button
                onClick={() => setDocTypeOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 hover:border-primary/40 transition"
              >
                {selectedType.label}
                <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", docTypeOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {docTypeOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden"
                  >
                    {DOC_TYPES.map(d => (
                      <button
                        key={d.id}
                        onClick={() => { setDocType(d.id); setDocTypeOpen(false); }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors",
                          d.id === docType ? "text-primary font-semibold bg-primary/5" : "text-gray-700"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Text area */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
                Paste Document Text
              </label>
              <textarea
                value={docText}
                onChange={e => setDocText(e.target.value)}
                rows={12}
                placeholder="Paste the full text of the document here. The more complete the text, the better the analysis..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition resize-y font-mono leading-relaxed"
              />
              <p className="text-xs text-gray-400 mt-1.5 font-mono">{docText.length.toLocaleString()} chars (max 8,000 analysed)</p>
            </div>

            <button
              onClick={() => { setResult(null); analyze.mutate(); }}
              disabled={docText.trim().length < 50 || analyze.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {analyze.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</>
                : <><FileSearch className="w-4 h-4" /> Analyse Document</>}
            </button>

            {analyze.isError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
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
                className="space-y-4"
              >
                {/* Summary + risk score */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-2">Executive Summary</p>
                      <p className="text-sm text-gray-800 leading-relaxed">{result.summary}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <RiskScoreBadge score={result.risk_score} />
                    </div>
                  </div>
                </div>

                {/* Risks */}
                {result.risks.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-4">Legal Risks ({result.risks.length})</p>
                    <div className="space-y-3">
                      {result.risks.map((r, i) => {
                        const cfg = RISK_CONFIG[r.severity as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.LOW;
                        const Icon = cfg.icon;
                        return (
                          <div key={i} className={cn("flex gap-3 px-4 py-3 rounded-xl border text-sm", cfg.color)}>
                            <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-bold text-[10px] font-mono uppercase tracking-widest">{r.severity}</span>
                                {r.section && <span className="text-[10px] font-mono opacity-70">§ {r.section}</span>}
                              </div>
                              {r.issue}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Missing clauses */}
                {result.missing_clauses.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400 mb-4">Missing Clauses</p>
                    <ul className="space-y-2">
                      {result.missing_clauses.map((c, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {result.recommendations.length > 0 && (
                  <div className="bg-white rounded-2xl border border-primary/20 shadow-sm p-6">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-primary mb-4">Recommendations</p>
                    <ul className="space-y-2.5">
                      {result.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-gray-800">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
