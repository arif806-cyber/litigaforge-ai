import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CalendarSearch, ChevronRight, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { boardProgress, courtDayKey, fetchCourtDay, type CourtDayMatter, type HearingBrief } from "./api";
import { BoardUpdateSheet } from "./BoardUpdateSheet";
import { BriefSheet } from "./BriefSheet";
import { CourtBoardCard } from "./CourtBoardCard";
import { MatterCard } from "./MatterCard";
import { ShareSheet } from "./ShareSheet";
import { WeekStrip } from "./WeekStrip";
import type { ShareInput } from "./share";

export interface UpcomingHearing { id: number; title: string; hearing_date: string; court?: string | null }

const ALERT_KEY = "lf-board-alert";
const readAlert = () => { try { return localStorage.getItem(ALERT_KEY) !== "off"; } catch { return true; } };

/** Pick the matter whose turn is nearest; the board card follows it unless the advocate taps another item. */
function nextUp(matters: CourtDayMatter[]): CourtDayMatter | null {
  const onBoard = matters.filter((m) => m.court_key && m.item);
  if (!onBoard.length) return null;
  const ranked = [...onBoard].sort((a, b) => {
    const pa = boardProgress(a), pb = boardProgress(b);
    const sa = pa && !pa.passed ? pa.ahead : Number.MAX_SAFE_INTEGER;
    const sb = pb && !pb.passed ? pb.ahead : Number.MAX_SAFE_INTEGER;
    return sa - sb;
  });
  return ranked[0];
}

export function CourtDay({
  upcoming, onAddCase,
}: {
  upcoming: UpcomingHearing[];
  onAddCase: () => void;
}) {
  const [day, setDay] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: courtDayKey(day),
    queryFn: () => fetchCourtDay(day),
    staleTime: 30_000,
    // Boards move during the court day: refresh every minute while the tab is visible.
    refetchInterval: (query) => (query.state.data && query.state.data.date === query.state.data.today ? 60_000 : false),
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const isToday = !!data && data.date === data.today;
  const matters = data?.matters ?? [];
  const [focusId, setFocusId] = useState<number | null>(null);
  const focused = useMemo(
    () => (isToday ? matters.find((m) => m.case_id === focusId && m.court_key) ?? nextUp(matters) : null),
    [isToday, matters, focusId],
  );

  const [alertOn, setAlertOn] = useState(readAlert);
  const toggleAlert = () => {
    const next = !alertOn;
    setAlertOn(next);
    try { localStorage.setItem(ALERT_KEY, next ? "on" : "off"); } catch { /* storage unavailable */ }
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
  };

  // Notify once when the focused matter comes within three items.
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (!alertOn || !focused?.board || focused.board.stale) return;
    const p = boardProgress(focused);
    if (!p || p.passed || p.ahead > 3) return;
    const tag = `${focused.case_id}:${data?.date}`;
    if (notified.current === tag) return;
    notified.current = tag;
    if (typeof navigator !== "undefined") navigator.vibrate?.([30, 60, 30]);
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      const hall = focused.hall ? `Court ${focused.hall}` : "your court";
      // Private matters never put party names on a lock screen.
      const what = focused.sensitive ? "Your matter" : focused.title;
      try { new Notification(`Head to ${hall}`, { body: `${what} is ${p.ahead || "now"} ${p.ahead ? "away" : "being heard"}`, tag }); } catch { /* unsupported */ }
    }
  }, [alertOn, focused, data?.date]);

  const [sheet, setSheet] = useState<"board" | "brief" | "share" | null>(null);
  const [sheetMatter, setSheetMatter] = useState<CourtDayMatter | null>(null);
  const [shareInput, setShareInput] = useState<Omit<ShareInput, "lang"> | null>(null);
  const open = (kind: "board" | "brief", m: CourtDayMatter) => { setSheetMatter(m); setSheet(kind); };
  const shareToday = (m: CourtDayMatter) => {
    setShareInput({ mode: isToday ? "today" : "next", clientName: m.client_name, title: m.title, court: m.court, hall: m.hall, item: m.item, date: data?.date });
    setSheet("share");
  };
  const shareFromBrief = (b: HearingBrief) => {
    const future = b.next_date && data && b.next_date > data.today;
    setShareInput({
      mode: future ? "next" : "today", clientName: sheetMatter?.client_name, title: b.title, court: b.court ?? sheetMatter?.court,
      hall: future ? null : sheetMatter?.hall, item: future ? null : sheetMatter?.item, date: future ? b.next_date : data?.date,
    });
    setSheet("share");
  };

  const dayLabel = data
    ? new Date(`${data.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" data-testid="today-agenda">
      <div className="space-y-4">
        {isLoading && (
          <div className="space-y-3" aria-label="Loading today's hearings">
            <Skeleton className="h-[260px] rounded-[26px]" /><Skeleton className="h-[140px] rounded-[22px]" />
          </div>
        )}

        {isError && (
          <div role="alert" className="rounded-[22px] border border-border bg-card p-5 text-sm">
            <p className="font-semibold">Couldn’t load your court day.</p>
            <button type="button" onClick={() => refetch()} className="mt-2 font-semibold text-primary">Try again</button>
          </div>
        )}

        {focused && (
          <>
            <CourtBoardCard matter={focused} alertOn={alertOn} onToggleAlert={toggleAlert} onUpdate={() => open("board", focused)} />
            {matters.filter((m) => m.court_key).length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Choose which court board to follow">
                {matters.filter((m) => m.court_key && m.item).map((m) => (
                  <button key={m.case_id} type="button" onClick={() => setFocusId(m.case_id)} aria-pressed={m.case_id === focused.case_id}
                    className={cn("h-9 shrink-0 rounded-full border px-3 text-xs font-semibold",
                      m.case_id === focused.case_id ? "border-[#17181B] bg-[#17181B] text-[#F6F3EC]" : "border-border bg-card text-foreground")}>
                    {m.hall ? `Court ${m.hall}` : "Court"} · Item {m.item}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {data && (
          <section aria-labelledby="court-day-list-title" className="space-y-3">
            <div className="flex items-baseline justify-between gap-2" data-testid="today-agenda-heading">
              <h3 id="court-day-list-title" className="lf-display flex items-center gap-2 text-xl font-bold tracking-[-0.01em]">
                <span>{isToday ? "Hearings today" : `Hearings · ${dayLabel}`}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{matters.length}</span>
              </h3>
              <Link href="/cause-lists" data-testid="today-cause-lists-link" className="inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-primary">
                Cause lists <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {matters.length ? (
              <div className="space-y-3">
                {matters.map((m) => (
                  <MatterCard key={m.case_id} matter={m} focused={!!focused && focused.case_id === m.case_id}
                    onFocus={isToday && m.court_key ? () => setFocusId(m.case_id) : undefined}
                    onBrief={() => open("brief", m)} onShare={() => shareToday(m)} />
                ))}
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-border bg-card px-5 py-7 text-center">
                <CalendarSearch className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
                <p className="lf-display mt-2 text-lg font-bold">{isToday ? "No hearings on your cases today" : "No hearings this day"}</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                  Add hearing dates to your cases, or load your courts’ cause lists to find your matters automatically.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button type="button" onClick={onAddCase} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add case
                  </button>
                  <Link href="/cause-lists" className="inline-flex h-10 items-center rounded-xl border border-border bg-background px-3.5 text-sm font-semibold">
                    Open cause lists
                  </Link>
                </div>
              </div>
            )}
            {data.matters.some((m) => m.place_source === "cause_list") && (
              <p className="text-xs leading-5 text-muted-foreground">{data.notice}</p>
            )}
          </section>
        )}
      </div>

      <aside className="space-y-4">
        {data && <WeekStrip week={data.week} selected={data.date} today={data.today} onPick={(d) => { setDay(d === data.today ? null : d); setFocusId(null); }} />}
        <section className="rounded-[22px] border border-border bg-card p-3" aria-labelledby="coming-up-title">
          <div className="mb-1 flex items-center justify-between px-1">
            <h3 id="coming-up-title" className="text-sm font-semibold">Coming up</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{upcoming.length}</span>
          </div>
          {upcoming.length ? (
            <ul className="divide-y divide-border/60">
              {upcoming.map((h) => {
                const d = new Date(`${h.hearing_date.slice(0, 10)}T00:00:00`);
                return (
                  <li key={h.id}>
                    <button type="button" onClick={() => setDay(h.hearing_date.slice(0, 10))}
                      className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-muted/50">
                      <time dateTime={h.hearing_date.slice(0, 10)} className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-border bg-background py-1">
                        <span className="text-[10px] font-semibold uppercase text-primary">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                        <span className="lf-display text-lg font-bold leading-5 tabular-nums">{d.getDate()}</span>
                      </time>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{h.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {d.toLocaleDateString("en-IN", { weekday: "short" })}{h.court ? ` · ${h.court}` : ""}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="px-1 py-3 text-xs text-muted-foreground">No upcoming hearing dates saved on your active cases.</p>}
        </section>
      </aside>

      <BoardUpdateSheet matter={sheet === "board" ? sheetMatter : null} open={sheet === "board"} onOpenChange={(o) => !o && setSheet(null)} />
      <BriefSheet matter={sheetMatter} open={sheet === "brief"} onOpenChange={(o) => !o && setSheet(null)} onShare={shareFromBrief} />
      <ShareSheet input={shareInput} open={sheet === "share"} onOpenChange={(o) => !o && setSheet(null)} />
    </div>
  );
}
