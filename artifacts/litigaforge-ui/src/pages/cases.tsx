import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ChevronRight, AlertTriangle } from "lucide-react";

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
    <div className="h-full flex flex-col">
      <div className="border-b border-border px-8 py-5 flex-shrink-0">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">Case History</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          All forged cases from this session and loaded memory.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading && (
          <div className="space-y-2" data-testid="cases-loading">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        )}

        {isError && (
          <div className="border border-destructive/30 bg-destructive/10 rounded-md p-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{String(error)}</p>
          </div>
        )}

        {data && data.cases.length === 0 && (
          <div
            data-testid="cases-empty"
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <FileText className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No cases forged yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Use the Forge page to create your first case strategy.
            </p>
          </div>
        )}

        {data && data.cases.length > 0 && (
          <div className="space-y-0 border border-border rounded-md bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
              <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                Cases
              </p>
              <span
                data-testid="text-total-cases"
                className="text-[11px] font-mono text-muted-foreground"
              >
                {data.total} total
              </span>
            </div>
            <div className="divide-y divide-border">
              {(data.cases as CaseListItem[]).map((c) => (
                <Link key={c.case_id} href={`/cases/${c.case_id}`}>
                  <a
                    data-testid={`card-case-${c.case_id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono text-primary">{c.case_id}</span>
                        <span className="text-[10px] text-muted-foreground/50 font-mono">
                          {formatTime(c.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/70 truncate">{c.prompt_preview}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
                  </a>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
