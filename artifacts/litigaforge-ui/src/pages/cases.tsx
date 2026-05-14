import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ChevronRight, AlertTriangle, Scale } from "lucide-react";
import { motion } from "framer-motion";

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

      <div className="px-10 py-8 flex-shrink-0 relative z-10 border-b border-white/[0.05]">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          Case Archives
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Historical records of all generated legal strategies and extracted intelligence.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-10 py-8 relative z-10">
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
            className="flex flex-col items-center justify-center py-32 text-center"
          >
            <div className="relative mb-6">
              <Scale className="w-20 h-20 text-white/10" />
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
            </div>
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

            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-28 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
              {(data.cases as CaseListItem[]).map((c, i) => (
                <motion.div
                  key={c.case_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href={`/cases/${c.case_id}`}>
                    <a
                      data-testid={`card-case-${c.case_id}`}
                      className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group cursor-pointer"
                    >
                      {/* Timeline Dot */}
                      <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-background bg-white/20 group-hover:bg-primary group-hover:border-primary/30 group-hover:shadow-[0_0_15px_hsl(var(--primary))] transition-all duration-300 absolute left-28 -translate-x-1/2 md:left-1/2" />
                      
                      <div className="w-[calc(100%-8rem)] md:w-[calc(50%-2rem)] glass-panel p-5 rounded-xl group-hover:-translate-y-1 group-hover:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.8)] group-hover:border-primary/30 transition-all duration-300 ml-auto md:ml-0">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-mono font-bold text-primary group-hover:text-primary/90 transition-colors drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">{c.case_id}</span>
                          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
                        </div>
                        <p className="text-sm text-white/80 leading-relaxed line-clamp-2">{c.prompt_preview}</p>
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground font-mono bg-black/40 px-2 py-1 rounded">
                            {formatTime(c.timestamp)}
                          </span>
                        </div>
                      </div>
                    </a>
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
