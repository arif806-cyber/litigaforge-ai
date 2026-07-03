import { cn } from "@/lib/utils";
import { MISSION_STATUS_STYLES, type ForgeMission, type ForgeMissionCounts, type ForgeAgent } from "./types";

function formatTime(iso: string): string {
  return new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const COUNT_ORDER: (keyof ForgeMissionCounts)[] = [
  "running", "assigned", "waiting", "reviewing", "planned", "completed", "failed", "cancelled",
];

export function MissionCountPills({ counts }: { counts: ForgeMissionCounts }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="forgeos-mission-counts">
      {COUNT_ORDER.map((status) => (
        <span
          key={status}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-semibold border capitalize",
            MISSION_STATUS_STYLES[status]
          )}
        >
          {status}: {counts[status]}
        </span>
      ))}
    </div>
  );
}

export function MissionsPanel({ missions, agents }: { missions: ForgeMission[]; agents: ForgeAgent[] }) {
  const agentName = (id: number | null) => agents.find((a) => a.id === id)?.name ?? "Unassigned";

  if (missions.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No missions yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border" data-testid="forgeos-missions-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-semibold">Mission</th>
            <th className="px-3 py-2 font-semibold">Agent</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Updated</th>
          </tr>
        </thead>
        <tbody>
          {missions.map((m) => (
            <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30" data-testid={`forgeos-mission-row-${m.id}`}>
              <td className="px-3 py-2.5">
                <p className="font-medium text-foreground truncate max-w-[280px]">{m.title}</p>
                {m.error && <p className="text-[11px] text-red-500 truncate max-w-[280px]">{m.error}</p>}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{agentName(m.agent_id)}</td>
              <td className="px-3 py-2.5">
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize", MISSION_STATUS_STYLES[m.status])}>
                  {m.status}
                </span>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-[11px]">{formatTime(m.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
