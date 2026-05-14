import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, AlertTriangle, FileText, CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const ENTITY_CONFIG: Record<string, { label: string; color: string }> = {
  pan: { label: "PAN", color: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
  gstin: { label: "GSTIN", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  vehicle_number: { label: "Vehicle No.", color: "text-green-400 border-green-500/30 bg-green-500/10" },
  party_name: { label: "Party", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  case_number: { label: "Case No.", color: "text-rose-400 border-red-500/30 bg-red-500/10" },
  state_code: { label: "State", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
  location: { label: "Location", color: "text-teal-400 border-teal-500/30 bg-teal-500/10" },
  case_type: { label: "Case Type", color: "text-fuchsia-400 border-pink-500/30 bg-pink-500/10" },
  dl_number: { label: "DL No.", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10" },
  aadhaar: { label: "Aadhaar", color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
};

const CHAIN_COLORS: Record<string, string> = {
  GSTIN: "border-blue-500/50 text-blue-400 bg-blue-500/5",
  PAN: "border-violet-500/50 text-violet-400 bg-violet-500/5",
  DigiLocker: "border-cyan-500/50 text-cyan-400 bg-cyan-500/5",
  eCourts: "border-amber-500/50 text-amber-400 bg-amber-500/5",
  VAHAN: "border-green-500/50 text-green-400 bg-green-500/5",
  SARATHI: "border-teal-500/50 text-teal-400 bg-teal-500/5",
  BPCL_LPG: "border-orange-500/50 text-orange-400 bg-orange-500/5",
  MERIPEHCHAAN: "border-pink-500/50 text-pink-400 bg-pink-500/5",
  MEE_SEVA_TG: "border-red-500/50 text-red-400 bg-red-500/5",
  TRANSPORT_TS: "border-indigo-500/50 text-indigo-400 bg-indigo-500/5",
};

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return ts; }
}

export default function CaseDetail({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();

  const { data: caseData, isLoading, isError, error } = useQuery({
    queryKey: ["case", params.id],
    queryFn: () => apiFetch(`/cases/${params.id}`),
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="px-4 py-5 md:px-10 md:py-8 space-y-6" data-testid="case-loading">
        <Skeleton className="h-10 w-64 bg-white/5 rounded-xl" />
        <Skeleton className="h-32 w-full max-w-4xl bg-white/5 rounded-xl" />
        <Skeleton className="h-64 w-full max-w-4xl bg-white/5 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-5 md:px-10 md:py-8">
        <div className="glass-panel border-destructive/50 bg-destructive/10 rounded-xl p-6 flex items-start gap-4">
          <div className="p-2 bg-destructive/20 rounded-full flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h4 className="text-destructive font-semibold">Failed to load case file</h4>
            <p className="text-sm text-destructive/80 mt-1 font-mono">{String(error)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!caseData) return null;

  const entities = Object.entries(caseData.extracted_entities ?? caseData.entities_found ?? {}).filter(([, v]) => v);
  const chainMap: { chain: string; status: string }[] = caseData.chain_map ?? [];
  const apiResults: Record<string, unknown> = caseData.api_results ?? {};

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.05] via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0 relative z-10 border-b border-white/[0.05] bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl">
          <Button
            variant="ghost"
            onClick={() => setLocation("/cases")}
            data-testid="button-back"
            className="text-muted-foreground hover:text-white hover:bg-white/5 -ml-4 mb-4 h-8 px-4 rounded-lg flex items-center gap-2 transition-all group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Archives
          </Button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-6 h-6 text-primary" />
                <h1
                  data-testid="text-case-id"
                  className="text-3xl font-mono font-bold text-white tracking-tight drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]"
                >
                  {caseData.case_id}
                </h1>
              </div>
              {caseData.timestamp && (
                <span className="text-xs text-muted-foreground font-mono bg-white/5 px-3 py-1 rounded-md">
                  {formatTime(caseData.timestamp)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-5 md:px-10 md:py-8 relative z-10">
        <motion.div variants={container} initial="hidden" animate="show" className="max-w-5xl space-y-8 pb-20">
          
          {/* Prompt */}
          {caseData.prompt && (
            <motion.div variants={item} className="glass-panel p-6 rounded-xl">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-white/20" /> Initial Facts
              </p>
              <p className="text-base text-white/90 leading-relaxed font-mono bg-black/40 p-4 rounded-lg border border-white/5">{caseData.prompt}</p>
            </motion.div>
          )}

          {/* Entities */}
          {entities.length > 0 && (
            <motion.div variants={item}>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-white/20" /> Extracted Entities
              </p>
              <div className="flex flex-wrap gap-3">
                {entities.map(([key, value]) => {
                  const config = ENTITY_CONFIG[key as string] || { label: key, color: "text-white border-white/20 bg-white/5" };
                  return (
                    <div
                      key={key}
                      data-testid={`entity-${key}`}
                      className={cn("flex items-center gap-2 text-sm border rounded-lg px-3 py-2 shadow-sm", config.color)}
                    >
                      <span className="opacity-70 text-xs font-medium uppercase tracking-wide">{config.label}</span>
                      <span className="w-px h-3 bg-current opacity-20" />
                      <span className="font-mono font-bold">{String(value)}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Chain Stepper */}
          {chainMap.length > 0 && (
            <motion.div variants={item} className="glass-panel p-6 rounded-xl">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-4 h-px bg-white/20" /> Execution Pipeline
              </p>
              <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none">
                {chainMap.map((item, idx) => (
                  <div key={item.chain} className="flex items-center gap-2 flex-shrink-0">
                    <div className={cn("px-3 py-1.5 rounded border text-xs font-mono font-bold flex items-center gap-2", CHAIN_COLORS[item.chain] || "border-white/20 text-white bg-white/5")}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {item.chain}
                    </div>
                    {idx < chainMap.length - 1 && <div className="w-8 h-px bg-white/20 border-t border-dashed border-white/40" />}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Final output */}
          {caseData.final_output && (
            <motion.div variants={item}>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-white/20" /> Synthesized Strategy
              </p>
              <div className="glass-panel p-8 rounded-2xl border-l-4 border-l-primary relative overflow-hidden bg-gradient-to-r from-primary/[0.02] to-transparent">
                <div
                  data-testid="text-final-output"
                  className="relative z-10 text-base md:text-lg text-white/90 leading-relaxed font-serif whitespace-pre-wrap"
                >
                  {caseData.final_output}
                </div>
              </div>
            </motion.div>
          )}

          {/* API results */}
          {Object.keys(apiResults).length > 0 && (
            <motion.div variants={item}>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-white/20" /> Raw API Intelligence
              </p>
              <div className="glass-panel rounded-xl overflow-hidden">
                <Accordion type="multiple" className="divide-y divide-white/5">
                  {Object.entries(apiResults).map(([chain, data]) => {
                    const colorClass = CHAIN_COLORS[chain]?.split(' ')[0] || 'border-white/20';
                    return (
                      <AccordionItem key={chain} value={chain} className="border-0">
                        <AccordionTrigger
                          data-testid={`accordion-${chain}`}
                          className={cn("px-6 py-4 hover:no-underline hover:bg-white/5 transition-colors group relative border-l-4", colorClass)}
                        >
                          <span className="text-sm font-mono font-bold">{chain} Payload</span>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 pt-2">
                          <div className="bg-black/60 rounded-lg p-4 border border-white/5 overflow-auto max-h-[400px]">
                            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
                              {JSON.stringify(data, null, 2)}
                            </pre>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
