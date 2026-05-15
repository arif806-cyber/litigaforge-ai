import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, AlertTriangle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const ENTITY_CONFIG: Record<string, { label: string; color: string }> = {
  pan:            { label: "PAN",       color: "text-violet-700 border-violet-200 bg-violet-50" },
  gstin:          { label: "GSTIN",     color: "text-blue-700 border-blue-200 bg-blue-50" },
  vehicle_number: { label: "Vehicle No.", color: "text-green-700 border-green-200 bg-green-50" },
  party_name:     { label: "Party",     color: "text-amber-700 border-amber-200 bg-amber-50" },
  case_number:    { label: "Case No.",  color: "text-rose-700 border-rose-200 bg-rose-50" },
  state_code:     { label: "State",     color: "text-cyan-700 border-cyan-200 bg-cyan-50" },
  location:       { label: "Location",  color: "text-teal-700 border-teal-200 bg-teal-50" },
  case_type:      { label: "Case Type", color: "text-fuchsia-700 border-fuchsia-200 bg-fuchsia-50" },
  dl_number:      { label: "DL No.",    color: "text-indigo-700 border-indigo-200 bg-indigo-50" },
  aadhaar:        { label: "Aadhaar",   color: "text-orange-700 border-orange-200 bg-orange-50" },
};

const CHAIN_COLORS: Record<string, string> = {
  GSTIN:        "border-blue-300 text-blue-700 bg-blue-50/50",
  PAN:          "border-violet-300 text-violet-700 bg-violet-50/50",
  DigiLocker:   "border-cyan-300 text-cyan-700 bg-cyan-50/50",
  eCourts:      "border-amber-300 text-amber-700 bg-amber-50/50",
  VAHAN:        "border-green-300 text-green-700 bg-green-50/50",
  SARATHI:      "border-teal-300 text-teal-700 bg-teal-50/50",
  BPCL_LPG:    "border-orange-300 text-orange-700 bg-orange-50/50",
  MERIPEHCHAAN: "border-pink-300 text-pink-700 bg-pink-50/50",
  MEE_SEVA_TG:  "border-red-300 text-red-700 bg-red-50/50",
  TRANSPORT_TS: "border-indigo-300 text-indigo-700 bg-indigo-50/50",
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
        <Skeleton className="h-10 w-64 bg-gray-100 rounded-xl" />
        <Skeleton className="h-32 w-full max-w-4xl bg-gray-100 rounded-xl" />
        <Skeleton className="h-64 w-full max-w-4xl bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-5 md:px-10 md:py-8">
        <div className="glass-panel border-destructive/40 bg-destructive/5 rounded-xl p-6 flex items-start gap-4">
          <div className="p-2 bg-destructive/10 rounded-full flex-shrink-0">
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
  const apiResults: Record<string, unknown> = caseData.api_results ?? {};

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0 relative z-10 border-b border-gray-200 bg-white/70 backdrop-blur-sm">
        <div className="max-w-5xl">
          <Button
            variant="ghost"
            onClick={() => setLocation("/cases")}
            data-testid="button-back"
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 -ml-4 mb-4 h-8 px-4 rounded-lg flex items-center gap-2 transition-all group"
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
                  className="text-3xl font-mono font-bold text-gray-900 tracking-tight"
                >
                  {caseData.case_id}
                </h1>
              </div>
              {caseData.timestamp && (
                <span className="text-xs text-muted-foreground font-mono bg-gray-100 px-3 py-1 rounded-md">
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
                <span className="w-4 h-px bg-gray-300" /> Initial Facts
              </p>
              <p className="text-base text-gray-800 leading-relaxed font-mono bg-gray-50 p-4 rounded-lg border border-gray-100">{caseData.prompt}</p>
            </motion.div>
          )}

          {/* Entities */}
          {entities.length > 0 && (
            <motion.div variants={item}>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-gray-300" /> Extracted Entities
              </p>
              <div className="flex flex-wrap gap-3">
                {entities.map(([key, value]) => {
                  const config = ENTITY_CONFIG[key as string] || { label: key, color: "text-gray-700 border-gray-200 bg-gray-50" };
                  return (
                    <div
                      key={key}
                      data-testid={`entity-${key}`}
                      className={cn("flex items-center gap-2 text-sm border rounded-lg px-3 py-2 shadow-sm", config.color)}
                    >
                      <span className="opacity-70 text-xs font-medium uppercase tracking-wide">{config.label}</span>
                      <span className="w-px h-3 bg-current opacity-30" />
                      <span className="font-mono font-bold">{String(value)}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Final output */}
          {caseData.final_output && (
            <motion.div variants={item}>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-4 h-px bg-gray-300" /> Synthesized Strategy
              </p>
              <div className="glass-panel p-8 rounded-2xl border-l-4 border-l-primary relative overflow-hidden">
                <div
                  data-testid="text-final-output"
                  className="relative z-10 text-base md:text-lg text-gray-800 leading-relaxed font-serif whitespace-pre-wrap"
                >
                  {caseData.final_output}
                </div>
              </div>
            </motion.div>
          )}

          {/* API results — only show chains that returned live data */}
          {(() => {
            const liveResults = Object.entries(apiResults).filter(
              ([, data]) => typeof data === "object" && data !== null && (data as Record<string, unknown>).status === "success"
            );
            if (liveResults.length === 0) return null;
            return (
              <motion.div variants={item}>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-4 h-px bg-gray-300" /> Retrieved Data
                </p>
                <div className="glass-panel rounded-xl overflow-hidden">
                  <Accordion type="multiple" className="divide-y divide-gray-100">
                    {liveResults.map(([chain, data]) => {
                      const colorClass = CHAIN_COLORS[chain]?.split(' ')[0] || 'border-gray-200';
                      return (
                        <AccordionItem key={chain} value={chain} className="border-0">
                          <AccordionTrigger
                            data-testid={`accordion-${chain}`}
                            className={cn("px-6 py-4 hover:no-underline hover:bg-gray-50 transition-colors group relative border-l-4", colorClass)}
                          >
                            <span className="text-sm font-mono font-bold text-gray-700">{chain}</span>
                          </AccordionTrigger>
                          <AccordionContent className="px-6 pb-6 pt-2">
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 overflow-auto max-h-[400px]">
                              <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap leading-relaxed">
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
            );
          })()}
        </motion.div>
      </div>
    </div>
  );
}
