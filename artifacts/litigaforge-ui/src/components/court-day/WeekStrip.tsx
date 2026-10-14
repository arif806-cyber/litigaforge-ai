import { cn } from "@/lib/utils";

export function WeekStrip({
  week, selected, today, onPick,
}: {
  week: { date: string; count: number }[];
  selected: string;
  today: string;
  onPick: (date: string) => void;
}) {
  return (
    <nav aria-label="This week" className="grid grid-cols-7 gap-1.5" data-testid="court-day-week">
      {week.map((d) => {
        const date = new Date(`${d.date}T00:00:00`);
        const on = d.date === selected;
        const isToday = d.date === today;
        const label = date.toLocaleDateString("en-IN", { weekday: "short" });
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onPick(d.date)}
            aria-pressed={on}
            aria-label={`${date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}, ${d.count || "no"} ${d.count === 1 ? "hearing" : "hearings"}`}
            className={cn(
              "flex min-h-[66px] flex-col items-center justify-center gap-0.5 rounded-2xl border py-1.5 transition-colors",
              on ? "border-[#17181B] bg-[#17181B] text-[#F6F3EC]"
                : isToday ? "border-primary/60 bg-card text-foreground" : "border-border bg-card text-foreground",
            )}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-75">{label}</span>
            <span className="lf-display text-xl font-bold leading-[22px] tabular-nums">{date.getDate()}</span>
            <span aria-hidden="true" className="flex h-1 gap-0.5">
              {Array.from({ length: Math.min(d.count, 4) }).map((_, i) => (
                <span key={i} className={cn("h-1 w-1 rounded-full", on ? "bg-[#F0B44C]" : "bg-primary")} />
              ))}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
