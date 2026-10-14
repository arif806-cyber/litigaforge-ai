import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, BellOff, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { boardProgress, type CourtDayMatter } from "./api";

const NEAR = 3;

function ago(minutes: number) {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  return `${h} h ago`;
}

/** The dark "court board" card: what is being heard now vs. the advocate's item. */
export function CourtBoardCard({
  matter, alertOn, onToggleAlert, onUpdate,
}: {
  matter: CourtDayMatter;
  alertOn: boolean;
  onToggleAlert: () => void;
  onUpdate: () => void;
}) {
  const reduce = useReducedMotion();
  const board = matter.board;
  const progress = boardProgress(matter);
  const hallText = matter.hall ? `Court ${matter.hall}` : "Court";
  const near = !!progress && !board?.stale && !progress.passed && progress.ahead <= NEAR;
  const label = matter.sensitive ? "Your matter" : matter.title;

  let status: { title: string; sub: string; tone: "calm" | "near" | "now" | "muted" };
  if (!board) {
    status = {
      title: "No update from this court yet",
      sub: matter.list_size ? `Cause list: your matter is item ${matter.item} of ${matter.list_size}` : "Be the first to update it from the court hall",
      tone: "muted",
    };
  } else if (progress?.passed) {
    status = { title: "The board has passed your item", sub: "Check with the court master if your matter was called", tone: "near" };
  } else if (progress && progress.ahead === 0) {
    status = { title: "Your matter is being heard", sub: `${hallText} · ${label}`, tone: "now" };
  } else if (progress) {
    status = {
      title: `${progress.ahead} ${progress.ahead === 1 ? "matter" : "matters"} ahead of you`,
      sub: board.stale ? `Last known position · ${ago(board.minutes_ago)}`
        : progress.eta ? `About ${progress.eta} min at this court's pace today` : "Pace not known yet",
      tone: near ? "near" : "calm",
    };
  } else {
    status = { title: "Item number not on the list yet", sub: "Load today's cause list to track your position", tone: "muted" };
  }

  return (
    <section
      aria-label={`Court board for ${hallText}`}
      data-testid="court-board"
      className="relative overflow-hidden rounded-[26px] bg-[#17181B] p-[18px] text-[#F6F3EC] shadow-[0_18px_40px_rgba(23,24,27,0.22)]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em]">
          <span
            aria-hidden="true"
            className={cn("h-2 w-2 rounded-full", board && !board.stale ? "bg-[#E5483E] motion-safe:animate-pulse" : "bg-[#6B6F76]")}
          />
          COURT BOARD
        </p>
        <p className="truncate text-xs text-[#B9B5AC]">{[matter.court, hallText].filter(Boolean).join(" · ")}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 items-end gap-3">
        <div>
          <p className="text-xs text-[#B9B5AC]">{board?.stale ? "Last known" : "Now hearing"}</p>
          <div className="relative h-[70px] overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.p
                key={board?.now_item ?? "none"}
                data-testid="board-now"
                initial={reduce ? false : { y: 28, opacity: 0 }}
                animate={{ y: 0, opacity: board?.stale ? 0.55 : 1 }}
                exit={reduce ? undefined : { y: -28, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="lf-display text-[72px] font-extrabold leading-[70px] tracking-[-0.04em] tabular-nums"
              >
                {board?.now_item ?? "—"}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#B9B5AC]">Your item{matter.list_size ? <span className="text-[#8C887F]"> · of {matter.list_size}</span> : null}</p>
          <p data-testid="board-mine" className="lf-display text-[72px] font-extrabold leading-[70px] tracking-[-0.04em] text-[#F0B44C] tabular-nums">
            {matter.item ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.12]" aria-hidden="true">
        <motion.div
          className="h-2 rounded-full bg-gradient-to-r from-[#C98A1E] to-[#F0B44C]"
          initial={false}
          animate={{ width: `${Math.round((progress?.fraction ?? 0) * 100)}%` }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
        />
      </div>

      {/* Fixed-height status row: changes colour and words, never height, so nothing jumps under a thumb. */}
      <div
        role="status"
        aria-live="polite"
        data-testid="board-status"
        data-tone={status.tone}
        className={cn(
          "mt-3 flex min-h-[64px] items-center gap-3 rounded-2xl px-3 py-2 transition-colors",
          status.tone === "near" && "bg-[#E5483E] text-white",
          status.tone === "now" && "bg-[#F0B44C] text-[#17181B]",
          (status.tone === "calm" || status.tone === "muted") && "bg-white/[0.06]",
        )}
      >
        {status.tone === "near" || status.tone === "now"
          ? <MapPin className="h-5 w-5 shrink-0" aria-hidden="true" />
          : null}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-5">{status.title}</p>
          <p className={cn("truncate text-xs", status.tone === "calm" || status.tone === "muted" ? "text-[#B9B5AC]" : "opacity-90")}>
            {near && status.tone === "near" && !progress?.passed ? `Head to ${hallText} now` : status.sub}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-[#E9E4D9]">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {board ? `Updated ${ago(board.minutes_ago)}` : "No updates yet"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-[#9C988F]">
            {board ? `by ${board.advocates === 1 ? "1 advocate" : `${board.advocates} advocates`} in court` : "from advocates in court"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleAlert}
            aria-pressed={alertOn}
            aria-label={alertOn ? "Turn off the near-turn alert" : "Alert me when my turn is near"}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border",
              alertOn ? "border-[#F0B44C] bg-[#F0B44C] text-[#17181B]" : "border-white/30 text-[#F6F3EC]",
            )}
          >
            {alertOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onUpdate}
            data-testid="board-update-open"
            className="h-10 rounded-full bg-[#F6F3EC] px-4 text-[13px] font-semibold text-[#17181B]"
          >
            In court? Update
          </button>
        </div>
      </div>
    </section>
  );
}
