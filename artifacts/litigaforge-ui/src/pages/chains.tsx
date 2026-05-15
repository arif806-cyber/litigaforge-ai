import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Info, Link2, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChainDiagram } from "@/components/graphics/ChainDiagram";

interface Chain {
  name: string;
  description: string;
}

const CHAIN_COLORS: Record<string, { badge: string; border: string; glow: string }> = {
  GSTIN: { badge: "text-blue-400 bg-blue-500/10 border-blue-500/30", border: "group-hover:border-blue-500/50", glow: "group-hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]" },
  PAN: { badge: "text-violet-400 bg-violet-500/10 border-violet-500/30", border: "group-hover:border-violet-500/50", glow: "group-hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]" },
  DigiLocker: { badge: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30", border: "group-hover:border-cyan-500/50", glow: "group-hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]" },
  eCourts: { badge: "text-amber-400 bg-amber-500/10 border-amber-500/30", border: "group-hover:border-amber-500/50", glow: "group-hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]" },
  VAHAN: { badge: "text-green-400 bg-green-500/10 border-green-500/30", border: "group-hover:border-green-500/50", glow: "group-hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]" },
  SARATHI: { badge: "text-teal-400 bg-teal-500/10 border-teal-500/30", border: "group-hover:border-teal-500/50", glow: "group-hover:shadow-[0_0_20px_rgba(20,184,166,0.15)]" },
  BPCL_LPG: { badge: "text-orange-400 bg-orange-500/10 border-orange-500/30", border: "group-hover:border-orange-500/50", glow: "group-hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]" },
  MERIPEHCHAAN: { badge: "text-pink-400 bg-pink-500/10 border-pink-500/30", border: "group-hover:border-pink-500/50", glow: "group-hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]" },
  MEE_SEVA_TG: { badge: "text-red-400 bg-red-500/10 border-red-500/30", border: "group-hover:border-red-500/50", glow: "group-hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]" },
  TRANSPORT_TS: { badge: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30", border: "group-hover:border-indigo-500/50", glow: "group-hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]" },
};

const DEFAULT_COLOR = { badge: "text-white bg-white/5 border-white/20", border: "group-hover:border-white/40", glow: "group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]" };

export default function Chains() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["chains"],
    queryFn: () => apiFetch("/chains"),
    staleTime: 300000,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch("/healthz"),
    staleTime: 15000,
  });

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, scale: 0.95, y: 10 }, show: { opacity: 1, scale: 1, y: 0 } };

  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.03] via-transparent to-transparent pointer-events-none" />

      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0 relative z-10 border-b border-white/[0.05]">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Link2 className="w-6 h-6 text-primary" />
          Data Pipelines
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          The nervous system of LitigaForge. These independent API chains are dynamically orchestrated based on extracted entities to build comprehensive intelligence.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-4 py-5 md:px-10 md:py-8 relative z-10">
        <div className="max-w-6xl space-y-8">

          {/* Architecture diagram */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-xl p-6 space-y-3"
          >
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <span className="w-4 h-px bg-white/20" /> Execution Architecture
            </p>
            <div className="overflow-x-auto -mx-2 px-2">
              <ChainDiagram className="w-full min-w-[480px] opacity-80" />
            </div>
          </motion.div>

          {/* Mode notice */}
          {health && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              data-testid="mode-notice"
              className={cn(
                "relative overflow-hidden flex items-center gap-4 px-6 py-4 rounded-xl border glass-panel",
                health.dummy_mode ? "border-amber-500/30" : "border-green-500/30"
              )}
            >
              <div className={cn("absolute inset-0 opacity-10 animate-pulse-slow", health.dummy_mode ? "bg-amber-500" : "bg-green-500")} />
              <div className={cn("p-2 rounded-full", health.dummy_mode ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400")}>
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className={cn("font-bold font-mono tracking-wide", health.dummy_mode ? "text-amber-400" : "text-green-400")}>
                  {health.dummy_mode
                    ? "FALLBACK MODE ACTIVE"
                    : (health as any).ai_mode === "gemini"
                    ? "GEMINI AI ACTIVE"
                    : (health as any).ai_mode === "openai"
                    ? "GPT-4o ACTIVE"
                    : "LIVE MODE ACTIVE"}
                </h4>
                <p className="text-sm text-white/70 mt-0.5">
                  {health.dummy_mode
                    ? "Using smart regex + data-driven templates. Set OPENAI_API_KEY or configure Gemini for full AI synthesis."
                    : (health as any).ai_mode === "gemini"
                    ? "Powered by Gemini 2.5 Flash (free, via Replit AI Integrations). Entity extraction and strategy synthesis are AI-driven."
                    : "Chains are connected directly to live government and institutional APIs with AI synthesis."}
                </p>
              </div>
            </motion.div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="chains-loading">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl bg-white/5" />
              ))}
            </div>
          )}

          {isError && (
            <div className="glass-panel border-destructive/50 bg-destructive/10 rounded-xl p-6 flex items-start gap-4">
              <div className="p-2 bg-destructive/20 rounded-full flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h4 className="text-destructive font-semibold">Failed to load pipelines</h4>
                <p className="text-sm text-destructive/80 mt-1 font-mono">{String(error)}</p>
              </div>
            </div>
          )}

          {data && (
            <>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <span className="w-4 h-px bg-white/20" /> {data.total_chains} Available Pipelines
              </p>

              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(data.chains as Chain[]).map((chain) => {
                  const colors = CHAIN_COLORS[chain.name] || DEFAULT_COLOR;
                  return (
                    <motion.div
                      key={chain.name}
                      variants={item}
                      data-testid={`chain-card-${chain.name}`}
                      className={cn(
                        "group glass-panel rounded-xl p-6 flex flex-col gap-4 transition-all duration-300 cursor-default border-white/[0.08]",
                        colors.border,
                        colors.glow
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("px-3 py-1 rounded text-xs font-mono font-bold tracking-widest border transition-colors", colors.badge)}>
                          {chain.name}
                        </span>
                        <div className="flex gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        </div>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">{chain.description}</p>
                    </motion.div>
                  );
                })}
              </motion.div>

              {data.note && (
                <p className="text-xs text-muted-foreground/40 font-mono text-center pt-8">{data.note}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
