import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ChevronRight, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { EmptyStateArt } from "@/components/graphics/EmptyStateArt";

interface CaseListItem {
  case_id: string;
  timestamp: string;
  prompt_preview: string;
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch {
    return ts;
  }
}

export default function Cases() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiFetch("/cases?limit=50"),
    staleTime: 10000,
  });

  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="px-4 py-5 md:px-10 md:py-8 flex-shrink-0 relative z-10 border-b border-white/[0.05]">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          Case Archives
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Historical records of all generated legal strategies and extracted intelligence.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-4 py-5 md:px-10 md:py-8 relative z-10">
        {isLoading && (
          <div className="space-y-4" data-testid="cases-loading">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        )}

        {isError && (
          <div className="glass-panel border-destructive/50 bg-destructive/10 rounded-xl p-6 flex items-start gap-4">
            <div className="p-2 bg-destructive/20 rounded-full flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h4 className="text-destructive font-semibold">Failed to load archives</h4>
              <p className="text-sm text-destructive/80 mt-1 font-mono">{String(error)}</p>
            </div>
          </div>
        )}

        {data && data.cases.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            data-testid="cases-empty"
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <EmptyStateArt className="w-56 h-44 mb-4" />
            <h3 className="text-xl font-bold text-white tracking-wide">No Cases Forged Yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Initiate your first legal strategy on the Forge page to populate the archives.
            </p>
          </motion.div>
        )}

        {data && data.cases.length > 0 && (
          <div className="max-w-5xl space-y-6 pb-20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <span className="w-4 h-px bg-white/20" /> Timeline
              </p>
              <span data-testid="text-total-cases" className="text-xs font-mono text-primary bg-primary/10 px-3 py-1 rounded-full font-bold">
                {data.total} records
              </span>
            </div>

            <div className="space-y-3">
              {(data.cases as CaseListItem[]).map((c, i) => (
                <motion.div
                  key={c.case_id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={`/cases/${c.case_id}`}
                    data-testid={`card-case-${c.case_id}`}
                    className="group flex items-center justify-between glass-panel p-4 md:p-5 rounded-xl hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.8)] transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-mono font-bold text-primary drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">{c.case_id}</span>
                        <span className="text-[10px] text-white/30 font-mono hidden sm:inline">{formatTime(c.timestamp)}</span>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed line-clamp-2">{c.prompt_preview}</p>
                      <span className="text-[10px] text-white/30 font-mono mt-1.5 block sm:hidden">{formatTime(c.timestamp)}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-primary flex-shrink-0 transition-colors" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
