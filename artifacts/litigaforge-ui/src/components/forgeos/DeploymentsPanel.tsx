import { GitPullRequest, RefreshCw, ExternalLink, CircleCheck, CircleX, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ForgeDeploymentStatus } from "./types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function RunStatusIcon({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status !== "completed") return <CircleDashed className="w-4 h-4 text-amber-500 animate-pulse" />;
  if (conclusion === "success") return <CircleCheck className="w-4 h-4 text-emerald-500" />;
  if (conclusion === "failure") return <CircleX className="w-4 h-4 text-red-500" />;
  return <CircleDashed className="w-4 h-4 text-muted-foreground" />;
}

export function DeploymentsPanel({
  data, isLoading, onRefresh, refreshing,
}: {
  data?: ForgeDeploymentStatus;
  isLoading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Loading deployment status…</p>;
  }
  if (!data || !data.available) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center" data-testid="forgeos-deployments-unavailable">
        GitHub deployment status unavailable{data?.reason ? `: ${data.reason}` : "."}
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="forgeos-deployments-panel">
      <div className="flex items-center justify-end">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          data-testid="forgeos-deployments-refresh"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} /> Refresh
        </button>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Open Pull Requests ({data.pull_requests.length})</p>
        {data.pull_requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open pull requests.</p>
        ) : (
          <div className="space-y-2">
            {data.pull_requests.map((pr) => (
              <a
                key={pr.number}
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 hover:bg-muted/40 transition-colors"
              >
                <GitPullRequest className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    #{pr.number} {pr.title} {pr.draft && <span className="text-[10px] text-muted-foreground">(draft)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{pr.author} · updated {formatTime(pr.updated_at)}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Recent Workflow Runs ({data.workflow_runs.length})</p>
        {data.workflow_runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent workflow runs.</p>
        ) : (
          <div className="space-y-2">
            {data.workflow_runs.map((run) => (
              <a
                key={run.id}
                href={run.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 hover:bg-muted/40 transition-colors"
              >
                <RunStatusIcon status={run.status} conclusion={run.conclusion} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{run.name}</p>
                  <p className="text-[11px] text-muted-foreground">{run.event} · {formatTime(run.updated_at)}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
