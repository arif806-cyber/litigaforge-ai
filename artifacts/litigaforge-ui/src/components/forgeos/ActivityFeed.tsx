import { Activity, GitCommitHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ForgeActivityItem } from "./types";

function formatTime(iso: string): string {
  return new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function summarize(item: ForgeActivityItem): string {
  const detail = item.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const message = (detail as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return item.target_type ? `${item.target_type} #${item.target_id}` : "";
}

export function ActivityFeed({ activity }: { activity: ForgeActivityItem[] }) {
  if (activity.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No activity yet.</p>;
  }
  return (
    <div className="space-y-0 max-h-[420px] overflow-y-auto" data-testid="forgeos-activity-feed">
      {activity.map((item, idx) => (
        <div key={`${item.kind}-${item.created_at}-${idx}`} className="flex gap-3 py-2.5 border-b border-border/50 last:border-0">
          <div
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
              item.kind === "audit" ? "bg-blue-500/15" : "bg-violet-500/15"
            )}
          >
            {item.kind === "audit" ? (
              <Activity className="w-3 h-3 text-blue-500" />
            ) : (
              <GitCommitHorizontal className="w-3 h-3 text-violet-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground truncate">{item.action}</p>
            <p className="text-[11px] text-muted-foreground truncate">{summarize(item)}</p>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">{formatTime(item.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
