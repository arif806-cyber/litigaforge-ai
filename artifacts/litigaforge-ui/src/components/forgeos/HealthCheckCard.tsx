import { CheckCircle2, AlertTriangle, XCircle, HeartPulse } from "lucide-react";
import type { ForgeHealthCheckRun, ForgeHealthCheckResult } from "./types";

function parseResults(run: ForgeHealthCheckRun): ForgeHealthCheckResult[] {
  if (Array.isArray(run.results)) return run.results;
  try {
    const parsed = JSON.parse(run.results);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function statusStyle(status: ForgeHealthCheckRun["overall_status"]) {
  if (status === "ok") {
    return { icon: CheckCircle2, label: "All systems go", classes: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" };
  }
  if (status === "degraded") {
    return { icon: AlertTriangle, label: "Degraded", classes: "bg-amber-500/15 text-amber-500 border-amber-500/30" };
  }
  return { icon: XCircle, label: "Critical", classes: "bg-red-500/15 text-red-500 border-red-500/30" };
}

export function HealthCheckCard({ run }: { run: ForgeHealthCheckRun | null }) {
  if (!run) {
    return (
      <div className="rounded-xl border border-border bg-card p-4" data-testid="forgeos-health-check-card">
        <div className="flex items-center gap-2 mb-1">
          <HeartPulse className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Product Health Check</h3>
        </div>
        <p className="text-xs text-muted-foreground">No run yet — production runs automatically at 07:00 IST daily.</p>
      </div>
    );
  }

  const results = parseResults(run);
  const style = statusStyle(run.overall_status);
  const StatusIcon = style.icon;
  const ranAt = new Date(run.created_at);

  return (
    <div className="rounded-xl border border-border bg-card p-4" data-testid="forgeos-health-check-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Product Health Check</h3>
        </div>
        <span
          data-testid="forgeos-health-check-status"
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${style.classes}`}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          {style.label}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Last run {ranAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
      </p>
      <ul className="space-y-1.5">
        {results.map((r) => (
          <li key={r.name} className="flex items-center justify-between text-xs" data-testid={`forgeos-health-check-item-${r.name}`}>
            <span className="flex items-center gap-1.5 text-foreground">
              {r.status === "ok" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <XCircle className={`w-3.5 h-3.5 flex-shrink-0 ${r.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
              )}
              {r.name.replace(/_/g, " ")}
            </span>
            <span className="text-muted-foreground truncate max-w-[50%] text-right">{r.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
