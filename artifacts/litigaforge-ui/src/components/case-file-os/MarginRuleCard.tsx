import type { ReactNode } from "react";

export interface MarginRuleCardProps {
  children: ReactNode;
  /** Optional file-tab label rendered on a navy perforated tab. */
  tab?: ReactNode;
  /** Show the "Live · synced" pulse indicator in the tab row. */
  live?: boolean;
  /** Text shown next to the live dot. */
  liveLabel?: string;
  className?: string;
  /** Inner padding classes for the ruled body. */
  bodyClassName?: string;
  "data-testid"?: string;
}

/**
 * MarginRuleCard — the signature "case file" surface: a ruled-paper body with
 * the red legal-pad margin (+ faint gold hairline), an optional perforated
 * file tab, and a live-sync indicator.
 */
export function MarginRuleCard({
  children,
  tab,
  live = false,
  liveLabel = "Live · synced",
  className,
  bodyClassName,
  "data-testid": testId = "margin-rule-card",
}: MarginRuleCardProps) {
  return (
    <div
      className={`cfos-paper rounded-2xl border border-border overflow-hidden ${className ?? ""}`}
      data-testid={testId}
    >
      {(tab || live) && (
        <div className="flex items-stretch">
          {tab && (
            <div className="cfos-tab px-5 py-2 text-white" style={{ background: "hsl(var(--primary))" }}>
              <span className="cfos-docket text-white/90">{tab}</span>
            </div>
          )}
          {live && (
            <div className="flex-1 flex items-center justify-end gap-2 pr-4">
              <span className="cfos-live-dot" />
              <span className="cfos-docket">{liveLabel}</span>
            </div>
          )}
        </div>
      )}
      <div className={`cfos-rule ${bodyClassName ?? "p-6 pt-5"}`}>{children}</div>
    </div>
  );
}
