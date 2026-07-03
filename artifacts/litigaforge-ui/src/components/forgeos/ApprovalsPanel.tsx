import { useState } from "react";
import { Check, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ForgeApproval } from "./types";

function formatTime(iso: string): string {
  return new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function ApprovalsPanel({ approvals, isLoading }: { approvals: ForgeApproval[]; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/forgeos/approvals/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forgeos-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["forgeos-dashboard"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiFetch(`/forgeos/approvals/${id}/reject`, { method: "POST", body: { reason } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forgeos-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["forgeos-dashboard"] });
      setRejectingId(null);
      setReason("");
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Loading approvals…</p>;
  }

  const pending = approvals.filter((a) => a.status === "pending");
  const decided = approvals.filter((a) => a.status !== "pending").slice(0, 20);

  return (
    <div className="space-y-6" data-testid="forgeos-approvals-panel">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
          Pending ({pending.length})
        </p>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending approvals.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((approval) => (
              <div key={approval.id} className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-3" data-testid={`forgeos-approval-${approval.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {approval.mission_id ? `Mission #${approval.mission_id}` : `Workflow step #${approval.workflow_step_id}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">requested by {approval.requested_by} · {formatTime(approval.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => approveMutation.mutate(approval.id)}
                      disabled={approveMutation.isPending}
                      data-testid={`forgeos-approval-approve-${approval.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(rejectingId === approval.id ? null : approval.id)}
                      data-testid={`forgeos-approval-reject-${approval.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
                {rejectingId === approval.id && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason (optional)"
                      data-testid={`forgeos-approval-reject-reason-${approval.id}`}
                      className="flex-1 text-xs rounded-lg border border-border bg-background px-2.5 py-1.5"
                    />
                    <button
                      onClick={() => rejectMutation.mutate({ id: approval.id, reason })}
                      disabled={rejectMutation.isPending}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Recently Decided</p>
        {decided.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decided approvals yet.</p>
        ) : (
          <div className="space-y-1.5">
            {decided.map((approval) => (
              <div key={approval.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg border border-border/60">
                <span className="text-foreground">
                  {approval.mission_id ? `Mission #${approval.mission_id}` : `Workflow step #${approval.workflow_step_id}`}
                </span>
                <span className={approval.status === "approved" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-500 font-semibold"}>
                  {approval.status}
                </span>
                <span className="text-muted-foreground">{approval.reviewed_at ? formatTime(approval.reviewed_at) : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
