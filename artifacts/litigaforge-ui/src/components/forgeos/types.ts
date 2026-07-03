export interface ForgeAgent {
  id: number;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  model: string;
  status: "active" | "disabled";
  avatar: string;
  kpis: Record<string, number>;
  current_mission_id: number | null;
  progress: number;
  last_activity_at: string | null;
  created_at: string;
}

export interface ForgeMission {
  id: number;
  title: string;
  description: string;
  agent_id: number | null;
  status:
    | "planned"
    | "waiting"
    | "assigned"
    | "running"
    | "reviewing"
    | "completed"
    | "failed"
    | "cancelled";
  requires_approval: boolean;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ForgeApproval {
  id: number;
  mission_id: number | null;
  workflow_step_id: number | null;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  reviewed_by: number | null;
  reason: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface ForgeAuditEntry {
  id: number;
  actor_user_id: number | null;
  action: string;
  target_type: string;
  target_id: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface ForgeActivityItem {
  kind: "audit" | "event";
  created_at: string;
  action: string;
  target_type: string;
  target_id: string;
  detail: Record<string, unknown> | string;
}

export interface ForgeRevenueSummary {
  mrr_rupees: number;
  paid_subscribers: number;
  by_tier: Record<string, { subscribers: number; mrr_rupees: number }>;
}

export interface ForgeAiCostSummary {
  total_cost_usd: number;
  total_tokens: number;
  cost_today_usd: number;
  by_agent: { agent_id: number; name: string; cost_usd: number }[];
  unmetered_calls: number;
}

export interface ForgeMissionCounts {
  planned: number;
  waiting: number;
  assigned: number;
  running: number;
  reviewing: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
}

export interface ForgeHealthCheckResult {
  name: string;
  severity: "critical" | "degraded";
  status: "ok" | "fail";
  latency_ms: number;
  detail: string;
}

export interface ForgeHealthCheckRun {
  overall_status: "ok" | "degraded" | "critical";
  results: ForgeHealthCheckResult[] | string;
  created_at: string;
}

export interface ForgeDashboardSnapshot {
  agents: ForgeAgent[];
  agent_count: number;
  active_agent_count: number;
  missions: ForgeMission[];
  mission_counts: ForgeMissionCounts;
  revenue: ForgeRevenueSummary;
  ai_cost: ForgeAiCostSummary;
  activity: ForgeActivityItem[];
  health_check: ForgeHealthCheckRun | null;
}

export interface ForgePullRequest {
  number: number;
  title: string;
  author: string;
  url: string;
  created_at: string;
  updated_at: string;
  draft: boolean;
}

export interface ForgeWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  event: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface ForgeDeploymentStatus {
  available: boolean;
  reason: string;
  pull_requests: ForgePullRequest[];
  workflow_runs: ForgeWorkflowRun[];
}

export const MISSION_STATUS_STYLES: Record<string, string> = {
  planned: "bg-muted text-muted-foreground border-border",
  waiting: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  assigned: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  running: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
  reviewing: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  failed: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  cancelled: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-400 dark:border-zinc-800",
};
