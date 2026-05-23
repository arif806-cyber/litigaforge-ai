import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ChevronRight, AlertTriangle, ArrowRight } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
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

  return (<>
      <SEOHelmet title="Case History" description="Browse all previously forged legal cases with entity extraction and chain results." canonical="/cases" />
    <div className="max-w-5xl mx-auto px-4 py-8 md:px-8 md:py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary" />
          Case Archives
        </h1>
        <p className="text-muted-foreground mt-2 font-medium">
          Historical records of all generated legal strategies and extracted intelligence.
        </p>
      </div>

      <div className="space-y-6">
        {isLoading && (
          <div className="space-y-4" data-testid="cases-loading">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl bg-card border-border" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
            <div>
              <h4 className="text-destructive font-semibold">Failed to load archives</h4>
              <p className="text-sm text-destructive/80 mt-1">{String(error)}</p>
            </div>
          </div>
        )}

        {data && data.cases.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            data-testid="cases-empty"
            className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-2xl shadow-sm"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground tracking-tight">No Cases Forged Yet</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Initiate your first legal strategy on the Forge page to populate the archives.
            </p>
            <Link href="/" className="mt-6 flex items-center gap-2 text-primary font-medium hover:underline">
              Go to The Forge <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}

        {data && data.cases.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Timeline
              </p>
              <span data-testid="text-total-cases" className="text-xs font-medium text-muted-foreground">
                {data.total} records
              </span>
            </div>

            <div className="space-y-4">
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
                    className="group flex items-center justify-between bg-card p-5 rounded-2xl border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold text-primary">{c.case_id}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">{formatTime(c.timestamp)}</span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">{c.prompt_preview}</p>
                      <span className="text-xs text-muted-foreground mt-2 block sm:hidden">{formatTime(c.timestamp)}</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors flex-shrink-0">
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </>);
}