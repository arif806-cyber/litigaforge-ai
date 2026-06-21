const STAGES = [
  { key: "posted",    label: "Posted" },
  { key: "matched",   label: "Matched" },
  { key: "requested", label: "Requested" },
  { key: "proposals", label: "Proposals" },
  { key: "hired",     label: "Hired" },
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
      <div className="flex items-start w-full">
        {STAGES.map((stage, i) => {
          const isDone   = i < safeIndex;
          const isActive = i === safeIndex;
          return (
            <div key={stage.key} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 select-none",
                    isDone   ? "bg-emerald-500 text-white shadow-sm" : "",
                    isActive ? "bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse" : "",
                    !isDone && !isActive ? "bg-muted text-muted-foreground" : "",
                  ].join(" ")}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                <span
                  className={[
                    "text-[10px] mt-1.5 leading-tight text-center",
                    isActive ? "font-bold text-blue-600" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {stage.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={[
                    "flex-1 h-0.5 mt-4 mx-1 transition-colors duration-300",
                    isDone ? "bg-emerald-400" : "bg-border",
                  ].join(" ")}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
