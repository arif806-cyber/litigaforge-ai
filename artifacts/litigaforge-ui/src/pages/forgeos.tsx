import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Cpu, AlertTriangle, Loader2, Bot, Rocket, ScrollText, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useForgeOsStream } from "@/lib/useForgeOsStream";
import { Button } from "@/components/ui/button";
import { SEOHelmet } from "@/components/SEOHelmet";
import { AgentsGrid } from "@/components/forgeos/AgentsGrid";
import { MissionsPanel, MissionCountPills } from "@/components/forgeos/MissionsPanel";
import { ActivityFeed } from "@/components/forgeos/ActivityFeed";
import { MetricsRow } from "@/components/forgeos/MetricsWidgets";
import { DeploymentsPanel } from "@/components/forgeos/DeploymentsPanel";
import { AuditLogPanel } from "@/components/forgeos/AuditLogPanel";
import { ApprovalsPanel } from "@/components/forgeos/ApprovalsPanel";
import type {
  ForgeDashboardSnapshot, ForgeDeploymentStatus, ForgeAuditEntry, ForgeApproval,
} from "@/components/forgeos/types";

type Tab = "overview" | "approvals" | "deployments" | "audit";

function LiveIndicator({ status }: { status: string }) {
  const isLive = status === "live";
  const isReconnecting = status === "reconnecting";
  return (
    <span
      data-testid="forgeos-stream-status"
      className={
        "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border " +
        (isLive
          ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
          : isReconnecting
            ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
            : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-400 dark:border-zinc-800")
      }
    >
      <span
        className={
          "w-1.5 h-1.5 rounded-full " +
          (isLive ? "bg-emerald-500 animate-pulse" : isReconnecting ? "bg-amber-500 animate-pulse" : "bg-zinc-400")
        }
      />
      {isLive ? "Live" : isReconnecting ? "Reconnecting…" : "Connecting…"}
    </span>
  );
}

function TabButton({
  active, onClick, icon: Icon, label, badge,
}: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`forgeos-tab-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

function OverviewTab({ snapshot }: { snapshot: ForgeDashboardSnapshot }) {
  return (
    <div className="space-y-6">
      <MetricsRow
        revenue={snapshot.revenue}
        aiCost={snapshot.ai_cost}
        agentCount={snapshot.agent_count}
        activeAgentCount={snapshot.active_agent_count}
        missionCounts={snapshot.mission_counts}
      />

      <div>
        <h2 className="text-sm font-bold text-foreground mb-3">Agents</h2>
        <AgentsGrid agents={snapshot.agents} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-3">
          <h2 className="text-sm font-bold text-foreground">Missions</h2>
          <MissionCountPills counts={snapshot.mission_counts} />
          <MissionsPanel missions={snapshot.missions} agents={snapshot.agents} />
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">Activity</h2>
          <div className="rounded-xl border border-border bg-card p-3">
            <ActivityFeed activity={snapshot.activity} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForgeOsPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const isSuperuser = !!user?.is_superuser;

  const dashboardQuery = useQuery<ForgeDashboardSnapshot>({
    queryKey: ["forgeos-dashboard"],
    queryFn: () => apiFetch("/forgeos/dashboard"),
    enabled: isSuperuser,
    staleTime: 15_000,
  });

  const streamStatus = useForgeOsStream(isSuperuser);

  const [deployRefreshing, setDeployRefreshing] = useState(false);
  const deploymentsQuery = useQuery<ForgeDeploymentStatus>({
    queryKey: ["forgeos-deployments"],
    queryFn: () => apiFetch("/forgeos/deployments"),
    enabled: isSuperuser && tab === "deployments",
    staleTime: 30_000,
  });

  const auditQuery = useQuery<ForgeAuditEntry[]>({
    queryKey: ["forgeos-audit-log"],
    queryFn: () => apiFetch("/forgeos/audit-log"),
    enabled: isSuperuser && tab === "audit",
    staleTime: 15_000,
  });

  const approvalsQuery = useQuery<ForgeApproval[]>({
    queryKey: ["forgeos-approvals"],
    queryFn: () => apiFetch("/forgeos/approvals"),
    enabled: isSuperuser && tab === "approvals",
    staleTime: 10_000,
    refetchInterval: tab === "approvals" ? 20_000 : false,
  });

  if (loading) {
    return (
      <>
        <SEOHelmet title="ForgeOS Command Center" description="Live multi-agent orchestration dashboard." canonical="/forgeos" />
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (!isSuperuser) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">ForgeOS Command Center requires superuser access.</p>
        <Button onClick={() => setLocation("/")}>Go Home</Button>
      </div>
    );
  }

  const pendingApprovalCount = (approvalsQuery.data ?? []).filter((a) => a.status === "pending").length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <SEOHelmet title="ForgeOS Command Center" description="Live multi-agent orchestration dashboard." canonical="/forgeos" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Cpu className="w-6 h-6 text-violet-500" />
          <h1 className="text-2xl font-bold">ForgeOS Command Center</h1>
        </div>
        <LiveIndicator status={streamStatus} />
      </div>

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={Bot} label="Overview" />
        <TabButton active={tab === "approvals"} onClick={() => setTab("approvals")} icon={ShieldCheck} label="Approvals" badge={pendingApprovalCount} />
        <TabButton active={tab === "deployments"} onClick={() => setTab("deployments")} icon={Rocket} label="Deployments" />
        <TabButton active={tab === "audit"} onClick={() => setTab("audit")} icon={ScrollText} label="Audit Log" />
      </div>

      {dashboardQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : dashboardQuery.isError || !dashboardQuery.data ? (
        <p className="text-sm text-destructive py-8 text-center">Failed to load ForgeOS dashboard.</p>
      ) : (
        <>
          {tab === "overview" && <OverviewTab snapshot={dashboardQuery.data} />}
          {tab === "approvals" && (
            <ApprovalsPanel approvals={approvalsQuery.data ?? []} isLoading={approvalsQuery.isLoading} />
          )}
          {tab === "deployments" && (
            <DeploymentsPanel
              data={deploymentsQuery.data}
              isLoading={deploymentsQuery.isLoading}
              refreshing={deployRefreshing}
              onRefresh={async () => {
                setDeployRefreshing(true);
                try {
                  await apiFetch("/forgeos/deployments?force_refresh=true");
                  await deploymentsQuery.refetch();
                } finally {
                  setDeployRefreshing(false);
                }
              }}
            />
          )}
          {tab === "audit" && <AuditLogPanel entries={auditQuery.data ?? []} isLoading={auditQuery.isLoading} />}
        </>
      )}
    </div>
  );
}
