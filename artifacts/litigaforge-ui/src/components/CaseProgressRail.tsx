const STAGES = [
  { key: "posted",    label: "Posted" },
  { key: "matched",   label: "Matched" },
  { key: "requested", label: "Request" },
  { key: "proposals", label: "Proposal" },
  { key: "hired",     label: "Hired" },
  { key: "completed", label: "Done" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

interface CaseProgressRailProps {
  currentStage: StageKey | string;
}

export default function CaseProgressRail({ currentStage }: CaseProgressRailProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStage);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div data-testid="client-case-journey" className="overflow-hidden rounded-2xl border border-border bg-card px-4 pt-3 pb-4 shadow-sm">
      <p className="mb-3 text-[11px] font-semibold text-muted-foreground">
        Your case journey
      </p>
      <div className="scrollbar-hidden overflow-x-auto">
      <div className="relative grid min-w-full grid-cols-6 items-start">
        <div aria-hidden="true" className="absolute left-[8.333%] right-[8.333%] top-4 h-0.5 bg-border">
          <div
            className="h-full bg-secondary transition-[width] duration-300"
            style={{ width: `${(safeIndex / (STAGES.length - 1)) * 100}%` }}
          />
        </div>
        {STAGES.map((stage, i) => {
          const isDone   = i < safeIndex;
          const isActive = i === safeIndex;
          return (
            <div key={stage.key} className="relative z-10 flex min-w-0 flex-col items-center">
              <div
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 select-none",
                   isDone   ? "bg-secondary text-secondary-foreground shadow-sm" : "",
                  isActive ? "bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse" : "",
                  !isDone && !isActive ? "bg-muted text-muted-foreground" : "",
                ].join(" ")}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span
                className={[
                  "mt-1.5 min-h-8 w-full whitespace-nowrap px-0.5 text-center text-[11px] leading-tight",
                  isActive ? "font-bold text-primary" : "text-muted-foreground",
                ].join(" ")}
                data-testid="case-progress-step-label"
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
