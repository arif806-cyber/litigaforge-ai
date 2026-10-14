import { Link } from "wouter";
import { Lock, MapPin, Share2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { boardProgress, type CourtDayMatter } from "./api";

export function MatterCard({
  matter, focused, onFocus, onBrief, onShare,
}: {
  matter: CourtDayMatter;
  focused: boolean;
  onFocus?: () => void;
  onBrief: () => void;
  onShare: () => void;
}) {
  const progress = boardProgress(matter);
  const where = [matter.court, matter.hall ? `Court ${matter.hall}` : null].filter(Boolean).join(" · ");
  const chip = progress && !matter.board?.stale
    ? progress.passed ? { text: "Board passed your item", cls: "bg-destructive/10 text-destructive" }
      : progress.ahead === 0 ? { text: "Being heard now", cls: "bg-primary/15 text-primary" }
      : { text: `${progress.ahead} ahead`, cls: progress.ahead <= 3 ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground/80" }
    : null;

  return (
    <article
      data-testid={`court-day-matter-${matter.case_id}`}
      className={cn(
        "overflow-hidden rounded-[22px] border bg-card shadow-[0_1px_2px_rgba(23,24,27,0.04)] transition-colors",
        focused ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <div className="flex gap-3 p-3.5">
        <button
          type="button"
          onClick={onFocus}
          disabled={!onFocus}
          aria-label={matter.item ? `Track item ${matter.item} on the court board` : "Item number not listed"}
          data-testid="matter-item"
          className="flex w-[66px] shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/10 py-2 text-primary disabled:cursor-default"
        >
          <span className="text-[10px] font-semibold tracking-[0.16em]">ITEM</span>
          <span className="lf-display text-[32px] font-extrabold leading-[34px] tabular-nums">{matter.item ?? "—"}</span>
          {matter.list_size ? <span className="text-[10px] font-medium text-primary">of {matter.list_size}</span> : null}
        </button>
        <div className="min-w-0 flex-1 space-y-0.5">
          <Link href="/lawyer-dashboard/cases" data-testid="court-day-matter-title"
            className="block min-h-0 text-base font-semibold leading-[21px] text-foreground hover:text-primary">
            {matter.title}
          </Link>
          {matter.cnr && <p className="truncate font-mono text-xs text-muted-foreground">{matter.cnr}</p>}
          <p className="flex items-center gap-1 truncate text-[13px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{where || "Court not added yet"}</span>
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {matter.stage && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80">{matter.stage}</span>}
            {chip && <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", chip.cls)}>{chip.text}</span>}
            {matter.sensitive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/70">
                <Lock className="h-3 w-3" aria-hidden="true" /> Private
              </span>
            )}
            {!matter.item && (
              <Link href="/cause-lists" className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-medium text-primary">
                Find item in cause list
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-border/70">
        <button type="button" onClick={onBrief} data-testid="matter-brief"
          className="flex min-h-12 items-center justify-center gap-2 text-sm font-semibold text-primary hover:bg-primary/5">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Prep brief
        </button>
        <button type="button" onClick={onShare} data-testid="matter-share"
          className="flex min-h-12 items-center justify-center gap-2 border-l border-border/70 text-sm font-semibold text-foreground hover:bg-muted/50">
          <Share2 className="h-4 w-4" aria-hidden="true" /> Tell client
        </button>
      </div>
    </article>
  );
}
