import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Link2, Zap, Database } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChainDiagram } from "@/components/graphics/ChainDiagram";
import { PageShell } from "@/components/PageShell";

interface Chain {
  name: string;
  description: string;
}

const CHAIN_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  GSTIN:        { bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300" },
  PAN:          { bg: "bg-violet-100 dark:bg-violet-900/30", border: "border-violet-200 dark:border-violet-800", text: "text-violet-700 dark:text-violet-300" },
  DigiLocker:   { bg: "bg-cyan-100 dark:bg-cyan-900/30", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-300" },
  eCourts:      { bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300" },
  VAHAN:        { bg: "bg-green-100 dark:bg-green-900/30", border: "border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-300" },
  SARATHI:      { bg: "bg-teal-100 dark:bg-teal-900/30", border: "border-teal-200 dark:border-teal-800", text: "text-teal-700 dark:text-teal-300" },
  BPCL_LPG:    { bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300" },
  MERIPEHCHAAN: { bg: "bg-pink-100 dark:bg-pink-900/30", border: "border-pink-200 dark:border-pink-800", text: "text-pink-700 dark:text-pink-300" },
  MEE_SEVA_TG:  { bg: "bg-red-100 dark:bg-red-900/30", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300" },
  TRANSPORT_TS: { bg: "bg-indigo-100 dark:bg-indigo-900/30", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-300" },
};

const DEFAULT_COLOR = { bg: "bg-muted", border: "border-border", text: "text-muted-foreground" };

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

  return (<>
      <SEOHelmet title="API Chains" description="Explore 16 government API integrations for legal intelligence." canonical="/chains" />
    <PageShell title="Data Pipelines" subtitle="The nervous system of LitigaForge. These independent API chains are dynamically orchestrated to build comprehensive intelligence." icon={<Link2 className="w-6 h-6 text-primary" />}>
      <div className="space-y-8">
        {/* Architecture diagram */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-6">
            <Database className="w-4 h-4" /> Execution Architecture
          </h3>
          <div className="overflow-x-auto -mx-2 px-2">
            <ChainDiagram className="w-full min-w-[480px] opacity-80" />
          </div>
        </motion.div>

        {/* Mode notice */}
        {health && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="mode-notice"
            className={cn(
              "flex items-start gap-4 p-5 rounded-2xl border shadow-sm",
              health.dummy_mode ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800" : "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
            )}
          >
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", health.dummy_mode ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400")}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className={cn("font-bold text-sm", health.dummy_mode ? "text-amber-800 dark:text-amber-300" : "text-green-800 dark:text-green-300")}>
                {health.dummy_mode
                  ? "Fallback Mode Active"
                  : (health as any).ai_mode === "gemini"
                  ? "Gemini AI Active"
                  : (health as any).ai_mode === "openai"
                  ? "GPT-5 Active"
                  : "Live Mode Active"}
              </h4>
              <p className={cn("text-sm mt-1 leading-relaxed", health.dummy_mode ? "text-amber-700/80 dark:text-amber-400/80" : "text-green-700/80 dark:text-green-400/80")}>
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
              <Skeleton key={i} className="h-32 w-full rounded-2xl bg-card border border-border" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
            <div>
              <h4 className="text-destructive font-semibold">Failed to load pipelines</h4>
              <p className="text-sm text-destructive/80 mt-1">{String(error)}</p>
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Available Pipelines
              </h3>
              <span className="text-xs font-medium text-muted-foreground">
                {data.total_chains} active
              </span>
            </div>

            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(data.chains as Chain[]).map((chain) => {
                const colors = CHAIN_COLORS[chain.name] || DEFAULT_COLOR;
                return (
                  <motion.div
                    key={chain.name}
                    variants={item}
                    data-testid={`chain-card-${chain.name}`}
                    className="group bg-card border border-border rounded-2xl p-6 flex flex-col gap-3 hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-default"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("px-3 py-1 rounded-md text-xs font-bold tracking-wide border", colors.bg, colors.text, colors.border)}>
                        {chain.name}
                      </span>
                      <div className="flex gap-1.5 opacity-20 group-hover:opacity-100 transition-opacity">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed font-medium">{chain.description}</p>
                  </motion.div>
                );
              })}
            </motion.div>

            {data.note && (
              <p className="text-sm text-muted-foreground/60 text-center font-medium pt-8">{data.note}</p>
            )}
          </div>
        )}
      </div>
    </PageShell>
  </>);
}