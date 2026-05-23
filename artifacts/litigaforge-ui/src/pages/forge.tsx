import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Scale, Loader2, ChevronRight, AlertTriangle, Zap, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ScalesHero } from "@/components/graphics/ScalesHero";

interface ForgeResult {
  status: string;
  case_id: string;
  chains_executed: string[];
  chain_map: { chain: string; status: string }[];
  entities_found: Record<string, string>;
  api_results: Record<string, unknown>;
  meta_suggestions: string[];
  final_output: string;
}

const ENTITY_CONFIG: Record<string, { label: string; color: string }> = {
  pan:            { label: "PAN",       color: "text-violet-700 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300" },
  gstin:          { label: "GSTIN",     color: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300" },
  vehicle_number: { label: "Vehicle No.", color: "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300" },
  party_name:     { label: "Party",     color: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300" },
  case_number:    { label: "Case No.",  color: "text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300" },
  state_code:     { label: "State",     color: "text-cyan-700 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300" },
  location:       { label: "Location",  color: "text-teal-700 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300" },
  case_type:      { label: "Case Type", color: "text-fuchsia-700 bg-fuchsia-100 dark:bg-fuchsia-900/30 dark:text-fuchsia-300" },
  dl_number:      { label: "DL No.",    color: "text-indigo-700 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300" },
  aadhaar:        { label: "Aadhaar",   color: "text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300" },
};

const EXAMPLE_PROMPTS = [
  { text: "Property dispute case — enter party PAN numbers, GSTIN, property location, and any suspected forged documents.", hotkey: "1" },
  { text: "Road accident / MACT case — enter vehicle registration, driver licence number, accident location, and date.", hotkey: "2" },
  { text: "GST dispute case — enter GSTIN, PAN, case number, court details, and department notice sections.", hotkey: "3" },
];

function PipelineLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-32 space-y-6">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary relative z-10" />
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse-glow" />
      </div>
      <p className="text-lg font-medium text-foreground tracking-tight">Synthesizing Strategy...</p>
      <p className="text-sm text-muted-foreground">Extracting entities and running API chains</p>
    </div>
  );
}

export default function Forge() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<ForgeResult | null>(null);
  const [focused, setFocused] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const prefill = sessionStorage.getItem("forge_prefill");
    if (prefill) {
      setPrompt(prefill);
      sessionStorage.removeItem("forge_prefill");
    }
  }, []);

  const forge = useMutation({
    mutationFn: (p: string) =>
      apiFetch("/forge", {
        method: "POST",
        body: JSON.stringify({ prompt: p }),
      }),
    onSuccess: (data: ForgeResult) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["memory-stats"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setResult(null);
    forge.mutate(prompt.trim());
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const num = parseInt(e.key);
        if (num > 0 && num <= EXAMPLE_PROMPTS.length) {
          e.preventDefault();
          setPrompt(EXAMPLE_PROMPTS[num - 1].text);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:px-8 md:py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
        <div className="max-w-2xl">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4"
          >
            The Forge
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground leading-relaxed"
          >
            Input case facts. We'll extract entities, execute government API chains, and synthesize a Supreme Court-grade legal strategy.
          </motion.p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className={cn(
              "rounded-2xl p-1 transition-all duration-300 bg-card border shadow-sm",
              focused ? "border-primary ring-4 ring-primary/10" : "border-border"
            )}>
              <Textarea
                data-testid="input-prompt"
                value={prompt}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the case facts here. Include PAN, GSTIN, vehicle numbers, or names..."
                className="min-h-[200px] border-0 focus-visible:ring-0 resize-none text-base bg-transparent p-4 placeholder:text-muted-foreground/60"
                disabled={forge.isPending}
              />
            </div>

            <AnimatePresence>
              {!prompt && !result && !forge.isPending && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Templates</p>
                  <div className="grid gap-3">
                    {EXAMPLE_PROMPTS.map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        data-testid={`example-prompt-${i}`}
                        onClick={() => setPrompt(ex.text)}
                        className="group flex items-start gap-4 text-left p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-mono text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          ⌘{ex.hotkey}
                        </span>
                        <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors leading-relaxed">{ex.text}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-4">
              <Button
                data-testid="button-forge"
                type="submit"
                size="lg"
                disabled={!prompt.trim() || forge.isPending}
                className="h-14 px-8 text-base shadow-lg hover:shadow-xl transition-all"
              >
                <Zap className="w-5 h-5 mr-2" />
                INITIATE FORGE
              </Button>

              {result && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-14 px-8 text-base"
                  onClick={() => { setResult(null); setPrompt(""); }}
                >
                  Reset
                </Button>
              )}
            </div>
          </form>

          {forge.isError && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
              <div>
                <h4 className="text-destructive font-semibold text-lg">Forge Sequence Failed</h4>
                <p className="text-sm text-destructive/80 mt-1">{String(forge.error)}</p>
              </div>
            </motion.div>
          )}

          {forge.isPending && <PipelineLoading />}
          
          {result && !forge.isPending && (
             <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-12 space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-card border border-border rounded-2xl shadow-sm">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                     </div>
                     <div>
                       <h3 className="font-semibold text-lg">Synthesis Complete</h3>
                       <p className="text-sm font-mono text-muted-foreground">{result.case_id}</p>
                     </div>
                   </div>
                   <Button onClick={() => setLocation(`/cases/${result.case_id}`)} variant="outline" className="gap-2">
                      View Full File <ChevronRight className="w-4 h-4" />
                   </Button>
                </div>

                {Object.keys(result.entities_found).length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Extracted Entities</h4>
                    <div className="flex flex-wrap gap-2">
                       {Object.entries(result.entities_found).map(([key, value]) => {
                          if (!value) return null;
                          const config = ENTITY_CONFIG[key] || { label: key, color: "bg-muted text-muted-foreground" };
                          return (
                            <div key={key} className={cn("px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2", config.color)}>
                              <span className="opacity-70">{config.label}:</span>
                              <span className="font-mono">{value}</span>
                            </div>
                          );
                       })}
                    </div>
                  </div>
                )}

                {result.final_output && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Strategy</h4>
                    <div className="p-8 bg-card border border-border rounded-2xl shadow-sm prose prose-sm dark:prose-invert max-w-none">
                       <div className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-foreground/90">
                         {result.final_output}
                       </div>
                    </div>
                  </div>
                )}

              </motion.div>
          )}

        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
             <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
               <Scale className="w-5 h-5 text-primary" />
               Capabilities
             </h3>
             <ul className="space-y-4 text-sm text-muted-foreground">
               <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"/> Extracts entities (PAN, GSTIN, Vehicle Nos)</li>
               <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"/> Cross-references 16 Govt APIs</li>
               <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"/> Synthesizes arguments and precedents</li>
               <li className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"/> Generates final actionable strategy</li>
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
}