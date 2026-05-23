import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, AlertTriangle, FileText, Database, Scale, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const ENTITY_CONFIG: Record<string, { label: string; color: string }> = {
  pan:            { label: "PAN",       color: "text-violet-700 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800" },
  gstin:          { label: "GSTIN",     color: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  vehicle_number: { label: "Vehicle No.", color: "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800" },
  party_name:     { label: "Party",     color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  case_number:    { label: "Case No.",  color: "text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800" },
  state_code:     { label: "State",     color: "text-cyan-700 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800" },
  location:       { label: "Location",  color: "text-teal-700 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 border-teal-200 dark:border-teal-800" },
  case_type:      { label: "Case Type", color: "text-fuchsia-700 bg-fuchsia-100 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800" },
  dl_number:      { label: "DL No.",    color: "text-indigo-700 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800" },
  aadhaar:        { label: "Aadhaar",   color: "text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800" },
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
      <div className="max-w-4xl mx-auto px-4 py-8 md:px-8 md:py-12 space-y-6" data-testid="case-loading">
        <Skeleton className="h-10 w-32 bg-card rounded-lg" />
        <Skeleton className="h-12 w-64 bg-card rounded-lg" />
        <Skeleton className="h-32 w-full bg-card rounded-xl" />
        <Skeleton className="h-64 w-full bg-card rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 md:px-8 md:py-12">
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
          <div>
            <h4 className="text-destructive font-semibold">Failed to load case file</h4>
            <p className="text-sm text-destructive/80 mt-1">{String(error)}</p>
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
    <div className="max-w-4xl mx-auto px-4 py-8 md:px-8 md:py-12">
      <Button
        variant="ghost"
        onClick={() => setLocation("/cases")}
        data-testid="button-back"
        className="text-muted-foreground hover:text-foreground hover:bg-accent -ml-4 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Archives
      </Button>

      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <h1
              data-testid="text-case-id"
              className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3 mb-2"
            >
              <FileText className="w-8 h-8 text-primary" />
              {caseData.case_id}
            </h1>
            {caseData.timestamp && (
              <span className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"/>
                {formatTime(caseData.timestamp)}
              </span>
            )}
          </div>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">

        {/* Prompt */}
        {caseData.prompt && (
          <motion.div variants={item} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
               <LayoutList className="w-4 h-4" /> Initial Facts
            </h3>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
               <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">{caseData.prompt}</p>
            </div>
          </motion.div>
        )}

        {/* Entities */}
        {entities.length > 0 && (
          <motion.div variants={item} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4" /> Extracted Entities
            </h3>
            <div className="flex flex-wrap gap-2">
              {entities.map(([key, value]) => {
                const config = ENTITY_CONFIG[key as string] || { label: key, color: "text-muted-foreground bg-muted border-border" };
                return (
                  <div
                    key={key}
                    data-testid={`entity-${key}`}
                    className={cn("flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium", config.color)}
                  >
                    <span className="opacity-70">{config.label}:</span>
                    <span className="font-mono">{String(value)}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Final output */}
        {caseData.final_output && (
          <motion.div variants={item} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
               <Scale className="w-4 h-4" /> Synthesized Strategy
            </h3>
            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm prose prose-sm dark:prose-invert max-w-none">
              <div
                data-testid="text-final-output"
                className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-foreground/90"
              >
                {caseData.final_output}
              </div>
            </div>
          </motion.div>
        )}

        {/* API results */}
        {(() => {
          const liveResults = Object.entries(apiResults).filter(
            ([, data]) =>
              typeof data === "object" && data !== null &&
              ["success", "live"].includes((data as Record<string, unknown>).status as string)
          );
          if (liveResults.length === 0) return null;
          return (
            <motion.div variants={item} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                 <Database className="w-4 h-4" /> Retrieved Data
              </h3>
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <Accordion type="multiple" className="divide-y divide-border">
                  {liveResults.map(([chain, data]) => (
                    <AccordionItem key={chain} value={chain} className="border-0">
                      <AccordionTrigger
                        data-testid={`accordion-${chain}`}
                        className="px-6 py-4 hover:bg-muted/50 transition-colors font-semibold text-sm"
                      >
                        {chain} API Response
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6 pt-2">
                        <div className="bg-muted rounded-xl p-4 overflow-auto max-h-[400px]">
                          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {JSON.stringify(data, null, 2)}
                          </pre>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </motion.div>
          );
        })()}
      </motion.div>
    </div>
  );
}