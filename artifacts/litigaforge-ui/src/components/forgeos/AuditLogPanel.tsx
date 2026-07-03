import type { ForgeAuditEntry } from "./types";

function formatTime(iso: string): string {
  return new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function detailSummary(detail: Record<string, unknown>): string {
  const { actor, message, ...rest } = detail || {};
  const parts: string[] = [];
  if (typeof actor === "string") parts.push(`by ${actor}`);
  if (typeof message === "string") parts.push(message);
  const restKeys = Object.keys(rest);
  if (restKeys.length > 0 && parts.length === 0) {
    parts.push(restKeys.map((k) => `${k}=${JSON.stringify(rest[k])}`).join(", "));
  }
  return parts.join(" — ");
}

export function AuditLogPanel({ entries, isLoading }: { entries: ForgeAuditEntry[]; isLoading: boolean }) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Loading audit log…</p>;
  }
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No audit log entries yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border" data-testid="forgeos-audit-log-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-semibold">Action</th>
            <th className="px-3 py-2 font-semibold">Target</th>
            <th className="px-3 py-2 font-semibold">Detail</th>
            <th className="px-3 py-2 font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30" data-testid={`forgeos-audit-row-${entry.id}`}>
              <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{entry.action}</td>
              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                {entry.target_type ? `${entry.target_type} #${entry.target_id}` : "—"}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[320px]">{detailSummary(entry.detail)}</td>
              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-[11px]">{formatTime(entry.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
