import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { FileSearch, Loader2, AlertTriangle, AlertCircle, CheckCircle2, Info, ChevronDown, Upload, FileText, X, FileCheck } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCountry } from "@/hooks/useCountry";
import { REVIEW_COPY } from "@/lib/country-copy";
import { ClarifyDialog } from "@/components/ClarifyDialog";
import { RiskMeter } from "@/components/case-file-os";

const DOC_TYPES = [
  { id: "contract",          label: "Contract / Agreement" },
  { id: "sale_deed",         label: "Sale Deed" },
  { id: "rental_agreement",  label: "Rental / Lease Agreement" },
  { id: "legal_notice",      label: "Legal Notice" },
  { id: "fir",               label: "FIR / Criminal Complaint" },
  { id: "petition",          label: "Court Petition / Writ" },
  { id: "court_order",       label: "Court Order / Judgment" },
  { id: "written_statement", label: "Written Statement / Counter" },
  { id: "cause_list",        label: "Cause List / Daily Board" },
  { id: "affidavit",         label: "Affidavit" },
  { id: "vakalatnama",       label: "Vakalatnama" },
  { id: "power_of_attorney", label: "Power of Attorney" },
  { id: "mou",               label: "MOU / LOI" },
  { id: "will",              label: "Will / Testament" },
  { id: "other",             label: "Other — AI will identify" },
];

const RISK_CONFIG = {
  HIGH:   { color: "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800", icon: AlertTriangle },
  MEDIUM: { color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800", icon: AlertCircle },
  LOW:    { color: "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800", icon: Info },
};

const ANALYSIS_STEPS = [
  { after: 0, label: "Reading your document", detail: "Identifying sections, parties, and key terms" },
  { after: 7, label: "Checking important clauses", detail: "Looking for gaps, unusual terms, and obligations" },
  { after: 16, label: "Reviewing legal risks", detail: "Assessing red flags for the selected jurisdiction" },
  { after: 28, label: "Scoring overall risk", detail: "Weighing the issues by severity and impact" },
  { after: 40, label: "Preparing your report", detail: "Turning the findings into clear next steps" },
];

interface AnalysisResult {
  summary: string;
  risk_score: number;
  risks: { severity: string; issue: string; section?: string }[];
  missing_clauses: string[];
  jurisdiction_issues: string[];
  recommendations: string[];
}

// The backend returns { analysis: { risk_score: 0–100, red_flags, missing_clauses,
// recommendations, compliance_notes, summary }, document_type }. Map that onto the
// flat shape this page renders so the instrument + result panels populate correctly.
function normalizeAnalysis(data: unknown): AnalysisResult {
  const root = (data ?? {}) as Record<string, unknown>;
  const a = (root.analysis && typeof root.analysis === "object"
    ? root.analysis
    : root) as Record<string, unknown>;

  const rawFlags = Array.isArray(a.red_flags)
    ? a.red_flags
    : Array.isArray(a.risks)
      ? a.risks
      : [];
  const risks = rawFlags
    .map((item): { severity: string; issue: string; section?: string } => {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const sev = String(o.severity ?? "MEDIUM").toUpperCase();
        return {
          severity: sev === "CRITICAL" ? "HIGH" : sev,
          issue: String(o.issue ?? o.text ?? ""),
          section: o.section != null ? String(o.section) : undefined,
        };
      }
      const s = String(item ?? "");
      const m = s.match(/^\s*(critical|high|medium|low)\s*[—–:-]\s+(.+)$/i);
      if (m) {
        const sev = m[1].toUpperCase();
        return { severity: sev === "CRITICAL" ? "HIGH" : sev, issue: m[2].trim() };
      }
      return { severity: "MEDIUM", issue: s.trim() };
    })
    .filter((r) => r.issue.length > 0);

  const jurisdiction = Array.isArray(a.jurisdiction_issues)
    ? (a.jurisdiction_issues as unknown[]).map(String)
    : typeof a.compliance_notes === "string" && a.compliance_notes.trim()
      ? [a.compliance_notes.trim()]
      : [];

  const scoreNum = Number(a.risk_score);

  return {
    summary: typeof a.summary === "string" ? a.summary : "",
    risk_score: Number.isFinite(scoreNum) ? scoreNum : 0,
    risks,
    missing_clauses: Array.isArray(a.missing_clauses) ? (a.missing_clauses as unknown[]).map(String) : [],
    jurisdiction_issues: jurisdiction,
    recommendations: Array.isArray(a.recommendations) ? (a.recommendations as unknown[]).map(String) : [],
  };
}

function RiskScoreBadge({ score }: { score: number }) {
  // risk_score is on a 0–100 scale, matching the RiskMeter gauge directly.
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const label = value >= 70 ? "High Risk" : value >= 40 ? "Medium Risk" : "Low Risk";
  const labelColor = value >= 70 ? "text-red-700 dark:text-red-300"
    : value >= 40 ? "text-amber-700 dark:text-amber-300"
    : "text-green-700 dark:text-green-300";
  return (
    <div className="flex flex-col items-center gap-1.5" data-testid="risk-score-badge">
      <RiskMeter value={value} size={168} showLabel={false} />
      <div className="text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Risk Score</div>
        <div className={cn("text-sm font-semibold", labelColor)}>{label}</div>
      </div>
    </div>
  );
}

export default function Review() {
  const { activeCode, activeConfig } = useCountry();
  const copy = REVIEW_COPY[activeCode.toUpperCase()] ?? REVIEW_COPY.IN;
  const [inputMode, setInputMode] = useState<"paste" | "upload">("paste");
  const [docText, setDocText] = useState("");
  const [docType, setDocType] = useState("contract");
  const [docTypeOpen, setDocTypeOpen] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [analysisSeconds, setAnalysisSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedType = DOC_TYPES.find(d => d.id === docType) ?? DOC_TYPES[0];

  const analyzeText = useMutation({
    mutationFn: (context: string) => apiFetch("/document/analyze", {
      method: "POST",
      body: JSON.stringify({ document_text: docText, document_type: docType, country: activeCode, context }),
    }),
    onSuccess: (data) => setResult(normalizeAnalysis(data)),
  });

  const analyzeFile = useMutation({
    mutationFn: async (context: string) => {
      if (!uploadedFile) throw new Error("No file selected");
      const form = new FormData();
      form.append("file", uploadedFile);
      form.append("document_type", docType);
      form.append("country", activeCode);
      form.append("context", context);
      const res = await fetch("/litigaforge/document/analyze-file", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try { msg = JSON.parse(text).detail ?? text; } catch {}
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult(normalizeAnalysis(data));
      setUploadedFile(null);
    },
  });

  const runAnalyze = (extraDetails: string) => {
    setClarifyOpen(false);
    setResult(null);
    if (inputMode === "upload" && uploadedFile) {
      analyzeFile.mutate(extraDetails);
    } else {
      analyzeText.mutate(extraDetails);
    }
  };

  const isAnalyzing = analyzeText.isPending || analyzeFile.isPending;
  const activeAnalysisStep = ANALYSIS_STEPS.reduce(
    (active, step, index) => analysisSeconds >= step.after ? index : active,
    0,
  );
  const analysisProgress = Math.min(92, 8 + Math.round((analysisSeconds / 45) * 84));
  const canAnalyze = inputMode === "paste"
    ? docText.trim().length >= 50
    : uploadedFile !== null;

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalysisSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setAnalysisSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isAnalyzing]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setUploadedFile(f);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setUploadedFile(f);
  };

  return (
    <PageShell title={copy.pageTitle} subtitle={copy.pageSubtitle} icon={<FileSearch className="w-6 h-6 text-primary" />}>
      <SEOHelmet
        title="Free Legal Document Analyzer | LitigaForge AI"
        description="Upload or paste any contract, agreement, notice, or legal document and get an instant AI risk score, missing clause detection, and recommendations."
        canonical="/review"
        keywords="legal document analyzer, contract review online free, document analysis, rental agreement check, missing clause detector"
      />

      <div className="space-y-8">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8 space-y-6">
          {/* Document Type */}
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

          {/* Input Mode Toggle */}
          <div className="flex bg-muted rounded-xl p-1 gap-1">
            <button
              onClick={() => setInputMode("paste")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                inputMode === "paste" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="w-4 h-4" /> Paste Text
            </button>
            <button
              onClick={() => setInputMode("upload")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                inputMode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Upload className="w-4 h-4" /> Upload File
            </button>
          </div>

          {/* Paste Mode */}
          {inputMode === "paste" && (
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
          )}

          {/* Upload Mode */}
          {inputMode === "upload" && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Upload Document
              </label>
              {!uploadedFile ? (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileSelect}
                  />
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Click or drag to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOCX, TXT, PNG, JPG, WEBP — max 10MB
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
                  <FileCheck className="w-5 h-5 text-green-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={() => setUploadedFile(null)}
                    className="p-1.5 rounded-lg hover:bg-background/80 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Analyze Button */}
          <div className="flex justify-end">
            <Button
              onClick={() => setClarifyOpen(true)}
              disabled={!canAnalyze || isAnalyzing}
              size="lg"
              className="px-8 shadow-md"
            >
              {isAnalyzing
                ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Analysing...</>
                : <><FileSearch className="w-5 h-5 mr-2" /> Analyse Document</>}
            </Button>
          </div>

          {analyzeText.isError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
              {(analyzeText.error as Error).message}
            </div>
          )}
          {analyzeFile.isError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
              {(analyzeFile.error as Error).message}
            </div>
          )}
        </div>

        <AnimatePresence>
          {isAnalyzing && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              aria-live="polite"
              aria-label="Document analysis progress"
              className="bg-card rounded-2xl border border-primary/20 shadow-sm overflow-hidden"
              data-testid="analysis-progress"
            >
              <div className="p-6 md:p-8 border-b border-border">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-semibold text-foreground">Building your risk report</h2>
                      <span className="text-xs font-mono text-muted-foreground tabular-nums">
                        {analysisSeconds}s
                      </span>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeAnalysisStep}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="mt-1"
                      >
                        <p className="text-sm font-medium text-primary">{ANALYSIS_STEPS[activeAnalysisStep].label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{ANALYSIS_STEPS[activeAnalysisStep].detail}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                <div className="mt-5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${analysisProgress}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {ANALYSIS_STEPS.map((step, index) => {
                    const isComplete = index < activeAnalysisStep;
                    const isCurrent = index === activeAnalysisStep;
                    return (
                      <div key={step.label} className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border",
                          isComplete && "bg-primary border-primary text-primary-foreground",
                          isCurrent && "border-primary text-primary bg-primary/10",
                          !isComplete && !isCurrent && "border-border text-muted-foreground",
                        )}>
                          {isComplete
                            ? <CheckCircle2 className="w-3.5 h-3.5" />
                            : <span className="text-[10px] font-bold">{index + 1}</span>}
                        </span>
                        <span className={cn(
                          "text-[11px] leading-tight truncate",
                          isCurrent ? "text-foreground font-semibold" : "text-muted-foreground",
                        )}>
                          {step.label.replace(" your document", "").replace(" important", "")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 md:p-8 bg-muted/20" aria-hidden="true">
                <div className="flex flex-col sm:flex-row gap-8 animate-pulse">
                  <div className="w-36 h-36 rounded-full border-[14px] border-muted flex-shrink-0 mx-auto sm:mx-0" />
                  <div className="flex-1 space-y-3 pt-2">
                    <div className="h-3 w-32 rounded bg-muted" />
                    <div className="h-4 w-full rounded bg-muted" />
                    <div className="h-4 w-11/12 rounded bg-muted" />
                    <div className="h-4 w-4/5 rounded bg-muted" />
                    <div className="h-4 w-2/3 rounded bg-muted" />
                  </div>
                </div>
                <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
                  <div className="h-24 rounded-xl bg-muted/80" />
                  <div className="h-24 rounded-xl bg-muted/80" />
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

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
        baseText={inputMode === "paste" ? docText : (uploadedFile?.name ?? "")}
        country={activeCode}
        onProceed={runAnalyze}
        onClose={() => setClarifyOpen(false)}
        proceedLabel="Analyse Document"
      />
    </PageShell>
  );
}
