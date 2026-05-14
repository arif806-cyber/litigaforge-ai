import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Scale, Loader2, ChevronRight, AlertTriangle, Zap, CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ScalesHero } from "@/components/graphics/ScalesHero";
import { ChainDiagram } from "@/components/graphics/ChainDiagram";

interface ChainMapItem { chain: string; status: string; }
interface ForgeResult {
  status: string;
  case_id: string;
  chains_executed: string[];
  chain_map: ChainMapItem[];
  entities_found: Record<string, string>;
  api_results: Record<string, unknown>;
  meta_suggestions: string[];
  final_output: string;
}

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
  GSTIN: "border-blue-500/30 text-blue-400 bg-blue-500/10",
  PAN: "border-violet-500/30 text-violet-400 bg-violet-500/10",
  DigiLocker: "border-cyan-500/30 text-cyan-400 bg-cyan-500/10",
  eCourts: "border-amber-500/30 text-amber-400 bg-amber-500/10",
  VAHAN: "border-green-500/30 text-green-400 bg-green-500/10",
  SARATHI: "border-teal-500/30 text-teal-400 bg-teal-500/10",
  BPCL_LPG: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  MERIPEHCHAAN: "border-pink-500/30 text-pink-400 bg-pink-500/10",
  MEE_SEVA_TG: "border-red-500/30 text-red-400 bg-red-500/10",
  TRANSPORT_TS: "border-indigo-500/30 text-indigo-400 bg-indigo-500/10",
};

const EXAMPLE_PROMPTS = [
  { text: "My client Ramesh Kumar with PAN ABCDE1234F and GSTIN 36ABCDE1234F1Z5 has a property dispute in Hyderabad. Vehicle TS09EA1234 involved.", hotkey: "1" },
  { text: "Client Lakshmi Devi, DL No. TS0920230001234, met with an accident in Vijayawada. Need RC and DL verification.", hotkey: "2" },
  { text: "GST fraud case — GSTIN 29AABCU9603R1ZM and PAN AABCU9603R, case filed at City Civil Court Hyderabad.", hotkey: "3" },
];

const LOADING_CHAINS = ["GSTIN", "PAN", "eCourts", "VAHAN", "SARATHI", "MEE_SEVA_TG", "TRANSPORT_TS", "MERIPEHCHAAN", "DigiLocker"];

function PipelineLoading() {
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      setActiveIdx(current);
      current++;
      if (current > LOADING_CHAINS.length + 1) current = 0;
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel p-8 rounded-xl space-y-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" />
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="relative">
          <Loader2 className="w-6 h-6 animate-spin text-primary relative z-10" />
          <div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-pulse" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white tracking-wide">Forging Intelligence</h3>
          <p className="text-xs text-muted-foreground font-mono mt-1">Executing multi-hop data extraction pipeline...</p>
        </div>
      </div>

      {/* Pipeline flow diagram */}
      <div className="relative z-10">
        <ChainDiagram className="w-full max-w-2xl mx-auto opacity-70" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 relative z-10">
        {LOADING_CHAINS.map((chain, i) => {
          const status = i < activeIdx ? "done" : i === activeIdx ? "loading" : "pending";
          return (
            <motion.div
              key={chain}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border text-sm font-mono transition-all duration-300",
                status === "done" ? "bg-primary/10 border-primary/30 text-primary" :
                status === "loading" ? "bg-white/5 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]" :
                "bg-black/20 border-white/5 text-muted-foreground/40"
              )}
            >
              {status === "done" && <CheckCircle2 className="w-4 h-4 text-primary" />}
              {status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              {status === "pending" && <CircleDashed className="w-4 h-4" />}
              {chain}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function Forge() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<ForgeResult | null>(null);
  const [focused, setFocused] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Pre-fill from Use Cases page
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
    <div className="h-full flex flex-col relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      {/* Header with hero illustration */}
      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0 relative z-10 flex items-start justify-between">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3"
          >
            <Zap className="w-6 h-6 text-primary" />
            The Forge
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed"
          >
            Input your case facts. LitigaForge will extract entities, execute government API chains, and synthesize a Supreme Court-grade legal strategy.
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="flex-shrink-0 hidden lg:block"
        >
          <ScalesHero className="w-56 h-44 opacity-80" />
        </motion.div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 md:px-10 md:pb-10 space-y-6 md:space-y-8 relative z-10">
        {/* Input form */}
        <form onSubmit={handleSubmit} className="max-w-4xl space-y-4 md:space-y-6">
          <div className="relative group">
            <div className={cn(
              "absolute -inset-0.5 rounded-xl blur transition duration-1000",
              focused || prompt ? "bg-primary/30 opacity-100" : "bg-white/5 opacity-0 group-hover:opacity-100"
            )} />
            <Textarea
              data-testid="input-prompt"
              value={prompt}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the case facts here. Include PAN, GSTIN, vehicle numbers, or names..."
              className={cn(
                "relative min-h-[120px] md:min-h-[160px] font-mono text-sm md:text-base resize-none bg-black/60 border-white/10 text-white placeholder:text-muted-foreground/50 rounded-xl p-4 md:p-5 shadow-2xl transition-all",
                focused && "border-primary/50 shadow-[0_0_30px_rgba(251,191,36,0.1)]"
              )}
              disabled={forge.isPending}
            />
          </div>

          <AnimatePresence>
            {!prompt && !result && !forge.isPending && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <span className="w-8 h-px bg-white/10" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Suggested Inputs</p>
                  <span className="flex-1 h-px bg-white/10" />
                </div>
                <div className="grid gap-2">
                  {EXAMPLE_PROMPTS.map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      data-testid={`example-prompt-${i}`}
                      onClick={() => setPrompt(ex.text)}
                      className="group flex items-center justify-between text-left text-sm border border-white/5 rounded-lg px-4 py-3 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 transition-all"
                    >
                      <span className="text-muted-foreground group-hover:text-white transition-colors">{ex.text}</span>
                      <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity ml-4 flex-shrink-0">
                        <kbd className="bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono text-white">⌘</kbd>
                        <kbd className="bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono text-white">{ex.hotkey}</kbd>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              data-testid="button-forge"
              type="submit"
              disabled={!prompt.trim() || forge.isPending}
              className={cn(
                "h-12 md:h-14 px-6 md:px-8 rounded-xl font-bold text-sm md:text-base tracking-wide transition-all shadow-xl overflow-hidden relative w-full sm:w-auto",
                prompt.trim() && !forge.isPending
                  ? "bg-primary text-primary-foreground hover:scale-[1.02] shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)]"
                  : "bg-white/5 text-white/40 cursor-not-allowed"
              )}
            >
              {prompt.trim() && !forge.isPending && (
                <div className="absolute inset-0 shimmer-gradient animate-shimmer opacity-30" />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Scale className="w-5 h-5" />
                INITIATE FORGE
              </span>
            </Button>
            
            {result && (
              <Button
                type="button"
                variant="outline"
                className="h-12 md:h-14 px-6 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium w-full sm:w-auto"
                onClick={() => { setResult(null); setPrompt(""); }}
              >
                Reset Canvas
              </Button>
            )}
          </div>
        </form>

        {forge.isError && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl glass-panel border-destructive/50 bg-destructive/10 rounded-xl p-6 flex items-start gap-4">
            <div className="p-2 bg-destructive/20 rounded-full flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h4 className="text-destructive font-semibold">Forge Sequence Failed</h4>
              <p className="text-sm text-destructive/80 mt-1 font-mono">{String(forge.error)}</p>
            </div>
          </motion.div>
        )}

        {forge.isPending ? (
          <div className="max-w-4xl w-full"><PipelineLoading /></div>
        ) : result ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl"
          >
            <ForgeResults result={result} onViewCase={() => setLocation(`/cases/${result.case_id}`)} />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function ForgeResults({ result, onViewCase }: { result: ForgeResult; onViewCase: () => void }) {
  const entities = Object.entries(result.entities_found).filter(([, v]) => v);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8 pb-20">
      {/* Case ID Banner */}
      <motion.div variants={item} className="flex items-center justify-between glass-panel p-4 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-primary font-mono text-sm font-bold tracking-widest">{result.case_id}</span>
          </div>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Case Generated Successfully</span>
        </div>
        <button
          data-testid="link-view-case"
          onClick={onViewCase}
          className="flex items-center gap-2 text-sm text-white bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg transition-colors font-medium"
        >
          Open Case File <ChevronRight className="w-4 h-4" />
        </button>
      </motion.div>

      {/* Entities */}
      {entities.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <span className="w-4 h-px bg-white/20" /> Extracted Entities
          </h3>
          <div className="flex flex-wrap gap-3">
            {entities.map(([key, value]) => {
              const config = ENTITY_CONFIG[key] || { label: key, color: "text-white border-white/20 bg-white/5" };
              return (
                <div
                  key={key}
                  data-testid={`entity-${key}`}
                  className={cn("flex items-center gap-2 text-sm border rounded-lg px-3 py-2 shadow-sm", config.color)}
                >
                  <span className="opacity-70 text-xs font-medium uppercase tracking-wide">{config.label}</span>
                  <span className="w-px h-3 bg-current opacity-20" />
                  <span className="font-mono font-bold">{value}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Chain Execution Ribbon */}
      <motion.div variants={item} className="space-y-3">
        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <span className="w-4 h-px bg-white/20" /> API Chains Executed
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x">
          {result.chain_map.map((c) => (
            <div
              key={c.chain}
              data-testid={`chain-row-${c.chain}`}
              className="glass-panel p-4 rounded-xl min-w-[200px] flex-shrink-0 snap-start flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <span className={cn("text-xs font-bold font-mono px-2 py-1 rounded border", CHAIN_COLORS[c.chain] || "text-white bg-white/10 border-white/20")}>
                  {c.chain}
                </span>
                {c.status === "live" ? (
                  <span className="flex items-center gap-1.5 text-[10px] text-green-400 font-mono uppercase font-bold bg-green-500/10 px-2 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-mono uppercase font-bold bg-amber-500/10 px-2 py-0.5 rounded">Dummy</span>
                )}
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-full" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Strategy Block */}
      {result.final_output && (
        <motion.div variants={item} className="space-y-3">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <span className="w-4 h-px bg-white/20" /> Final Synthesis
          </h3>
          <div className="glass-panel p-8 rounded-2xl border-l-4 border-l-primary relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Scale className="w-64 h-64 text-primary" />
            </div>
            <div
              data-testid="text-final-output"
              className="relative z-10 text-base md:text-lg text-white/90 leading-relaxed font-serif whitespace-pre-wrap"
            >
              {result.final_output}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
