import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ForgeAgent } from "./types";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function AgentCard({ agent }: { agent: ForgeAgent }) {
  const isActive = agent.status === "active";
  const isWorking = isActive && agent.current_mission_id != null;
  const missionsCompleted = Number(agent.kpis?.missions_completed ?? 0);
  const missionsFailed = Number(agent.kpis?.missions_failed ?? 0);

  return (
    <div
      data-testid={`forgeos-agent-card-${agent.id}`}
      className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg",
              isActive ? "bg-violet-500/15" : "bg-muted"
            )}
          >
            {agent.avatar || <Bot className={cn("w-4 h-4", isActive ? "text-violet-500" : "text-muted-foreground")} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{agent.role}</p>
          </div>
        </div>
        <span
          className={cn(
            "flex-shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border",
            isActive
              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-400 dark:border-zinc-800"
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-400")} />
          {agent.status}
        </span>
      </div>

      {isWorking ? (
        <div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>Mission #{agent.current_mission_id}</span>
            <span>{agent.progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${Math.max(4, agent.progress)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Idle · last active {timeAgo(agent.last_activity_at)}</p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{missionsCompleted} done</span>
        {missionsFailed > 0 && <span className="text-red-500 font-medium">{missionsFailed} failed</span>}
        <span className="ml-auto truncate">{agent.model || "—"}</span>
      </div>
    </div>
  );
}

export function AgentsGrid({ agents }: { agents: ForgeAgent[] }) {
  if (agents.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No agents registered yet.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3" data-testid="forgeos-agents-grid">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
