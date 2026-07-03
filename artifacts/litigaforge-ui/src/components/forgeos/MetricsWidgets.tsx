import { IndianRupee, DollarSign, Bot, ListChecks } from "lucide-react";
import type { ForgeRevenueSummary, ForgeAiCostSummary, ForgeMissionCounts } from "./types";

function KpiCard({
  icon: Icon, label, value, sub, accent, testId,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent: string; testId: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3" data-testid={testId}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">{label}</p>
        <p className="text-lg font-bold text-foreground truncate">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

export function MetricsRow({
  revenue, aiCost, agentCount, activeAgentCount, missionCounts,
}: {
  revenue: ForgeRevenueSummary;
  aiCost: ForgeAiCostSummary;
  agentCount: number;
  activeAgentCount: number;
  missionCounts: ForgeMissionCounts;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <KpiCard
        testId="forgeos-kpi-revenue"
        icon={IndianRupee}
        label="MRR"
        value={`₹${revenue.mrr_rupees.toLocaleString("en-IN")}`}
        sub={`${revenue.paid_subscribers} paid subscribers`}
        accent="bg-amber-500/15 text-amber-500"
      />
      <KpiCard
        testId="forgeos-kpi-ai-cost"
        icon={DollarSign}
        label="AI Spend (all-time)"
        value={`$${aiCost.total_cost_usd.toFixed(2)}`}
        sub={`$${aiCost.cost_today_usd.toFixed(2)} today · ${aiCost.total_tokens.toLocaleString()} tokens`}
        accent="bg-violet-500/15 text-violet-500"
      />
      <KpiCard
        testId="forgeos-kpi-agents"
        icon={Bot}
        label="Agents Active"
        value={`${activeAgentCount} / ${agentCount}`}
        sub={aiCost.unmetered_calls > 0 ? `${aiCost.unmetered_calls} unmetered fallback calls` : "all calls metered"}
        accent="bg-emerald-500/15 text-emerald-500"
      />
      <KpiCard
        testId="forgeos-kpi-missions"
        icon={ListChecks}
        label="Missions Running"
        value={`${missionCounts.running}`}
        sub={`${missionCounts.total} total · ${missionCounts.completed} completed`}
        accent="bg-blue-500/15 text-blue-500"
      />
    </div>
  );
}
