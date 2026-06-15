export interface StageTimelineProps {
  /** Ordered stage labels. */
  stages: string[];
  /** Index of the current (in-progress) stage; earlier stages render done. */
  active?: number;
  className?: string;
  "data-testid"?: string;
}

/**
 * StageTimeline — a horizontal case-progression docket
 * (Filed → Notice → Hearing → Arguments → Judgment).
 */
export function StageTimeline({
  stages,
  active = 0,
  className,
  "data-testid": testId = "stage-timeline",
}: StageTimelineProps) {
  return (
    <div className={`flex items-center ${className ?? ""}`} data-testid={testId}>
      {stages.map((s, i) => {
        const done = i < active, now = i === active;
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`grid place-items-center rounded-full border-2 transition-colors ${
                done ? "border-[hsl(var(--cfos-good))] bg-[hsl(var(--cfos-good))] text-white" :
                now ? "border-[hsl(var(--cfos-gold))] bg-[hsl(var(--cfos-gold))] text-[hsl(var(--accent-foreground))]" :
                "border-border bg-card text-muted-foreground"}`} style={{ width: 26, height: 26 }}>
                <span className="cfos-mono text-[11px] font-bold">{i + 1}</span>
              </div>
              <span className={`cfos-docket whitespace-nowrap ${now ? "text-foreground" : ""}`}>{s}</span>
            </div>
            {i < stages.length - 1 && (
              <div className="h-0.5 flex-1 mx-1 mb-5 rounded-full" style={{
                background: done ? "hsl(var(--cfos-good))" : "hsl(var(--border))" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
