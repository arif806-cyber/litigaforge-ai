const STAGES = [
  { key: "posted",    label: "Posted" },
  { key: "matched",   label: "Matched" },
  { key: "requested", label: "Request" },
  { key: "proposals", label: "Proposal" },
  { key: "hired",     label: "Hired" },
  { key: "completed", label: "Complete" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

interface CaseProgressRailProps {
  currentStage: StageKey | string;
}

export default function CaseProgressRail({ currentStage }: CaseProgressRailProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStage);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm px-4 pt-3 pb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Your Case Journey
      </p>
      <div className="relative grid w-full grid-cols-6 items-start">
        <div aria-hidden="true" className="absolute left-[8.333%] right-[8.333%] top-4 h-0.5 bg-border">
          <div
            className="h-full bg-emerald-500 transition-[width] duration-300"
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
                  isDone   ? "bg-emerald-500 text-white shadow-sm" : "",
                  isActive ? "bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse" : "",
                  !isDone && !isActive ? "bg-muted text-muted-foreground" : "",
                ].join(" ")}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span
                className={[
                  "mt-1.5 min-h-8 w-full break-words px-0.5 text-center text-[11px] leading-tight",
                  isActive ? "font-bold text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
