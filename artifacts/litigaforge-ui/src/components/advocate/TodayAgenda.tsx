import { Link } from "wouter";
import { CalendarSearch, ChevronRight, FileText, MapPin, Plus, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AgendaHearing {
  id: number;
  title: string;
  hearing_date: string;
  case_stage?: string;
  cnr_number?: string;
  client_name?: string;
}

export interface HearingPlace {
  court?: string | null;
  hall?: string | null;
  item?: string | number | null;
}

const dayKey = (value: string) => value.slice(0, 10);
const asDate = (value: string) => new Date(`${dayKey(value)}T00:00:00`);

function relativeDay(value: string, todayKey: string): string {
  const diff = Math.round((asDate(value).getTime() - asDate(todayKey).getTime()) / 86_400_000);
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return asDate(value).toLocaleDateString("en-IN", { weekday: "short" });
}

function placeLine(place: HearingPlace): string {
  const hall = place.hall && !/hall|court|room/i.test(String(place.hall)) ? `Hall ${place.hall}` : place.hall;
  return [place.court, hall].filter(Boolean).join(" · ");
}

function shareText(hearing: AgendaHearing, place: HearingPlace): string {
  const date = asDate(hearing.hearing_date).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const where = [placeLine(place), place.item != null && place.item !== "" ? `Item ${place.item}` : null]
    .filter(Boolean).join(", ");
  return `Next hearing: ${hearing.title}\n${date}${where ? `\n${where}` : ""}\n\n— shared via LitigaForge`;
}

/** Big, glanceable cause-list item number — the thing an advocate looks for on the board. */
function ItemNumber({ item }: { item: HearingPlace["item"] }) {
  const has = item != null && item !== "";
  return (
    <div
      data-testid="today-item-number"
      className="flex w-[64px] shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 py-2 text-primary"
      aria-label={has ? `Cause list item ${item}` : "Item number not listed yet"}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">Item</span>
      <span className="text-[28px] font-bold leading-8 tabular-nums">{has ? item : "—"}</span>
    </div>
  );
}

function TodayCard({ hearing, place }: { hearing: AgendaHearing; place: HearingPlace }) {
  const where = placeLine(place);
  const share = `https://wa.me/?text=${encodeURIComponent(shareText(hearing, place))}`;
  return (
    <li className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-destructive" />
      <div className="flex gap-3 p-3 pl-4">
        <ItemNumber item={place.item} />
        <div className="min-w-0 flex-1">
          <Link
            data-testid="today-hearing-title"
            href="/lawyer-dashboard/cases"
            className="block text-[15px] font-semibold leading-5 text-foreground hover:text-primary"
          >
            {hearing.title}
          </Link>
          <p data-testid="today-hearing-meta" className="mt-0.5 flex items-center gap-1 truncate text-[13px] leading-5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{where || "Court not added yet"}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {hearing.case_stage && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">{hearing.case_stage}</span>
            )}
            {hearing.cnr_number && (
              <span className="truncate text-[11px] font-mono tabular-nums text-muted-foreground">{hearing.cnr_number}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex border-t border-border text-[13px] font-semibold">
        <a
          href={share}
          target="_blank"
          rel="noreferrer"
          data-testid="today-share-date"
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 text-primary hover:bg-primary/5"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" /> Share with client
        </a>
        <span aria-hidden="true" className="w-px bg-border" />
        <Link
          href="/lawyer-dashboard/cases"
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 text-foreground/80 hover:bg-muted/60"
        >
          <FileText className="h-4 w-4" aria-hidden="true" /> Open case
        </Link>
      </div>
    </li>
  );
}

function UpcomingRow({ hearing, place, todayKey }: { hearing: AgendaHearing; place: HearingPlace; todayKey: string }) {
  const d = asDate(hearing.hearing_date);
  const where = placeLine(place);
  return (
    <li>
      <Link
        href="/lawyer-dashboard/cases"
        className="flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-muted/50"
      >
        <time
          dateTime={dayKey(hearing.hearing_date)}
          className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-border bg-background py-1"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            {d.toLocaleDateString("en-IN", { month: "short" })}
          </span>
          <span className="text-lg font-bold leading-5 tabular-nums text-foreground">{d.getDate()}</span>
        </time>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{hearing.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {relativeDay(hearing.hearing_date, todayKey)}{where ? ` · ${where}` : ""}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function TodayAgenda({
  todayCases, upcomingCases, todayKey, placeOf, onAddCase,
}: {
  todayCases: AgendaHearing[];
  upcomingCases: AgendaHearing[];
  todayKey: string;
  placeOf: (hearing: AgendaHearing) => HearingPlace;
  onAddCase: () => void;
}) {
  return (
    <section aria-label="Today’s hearing agenda" data-testid="today-agenda" className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2" data-testid="today-agenda-heading">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span>Hearings today</span>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              todayCases.length ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
            )}>{todayCases.length}</span>
          </h3>
          <Link href="/cause-lists" className="inline-flex min-h-8 items-center gap-1 rounded-lg px-1.5 text-xs font-semibold text-primary hover:bg-primary/5" data-testid="today-cause-lists-link">
            Cause lists <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        {todayCases.length ? (
          <ul className="space-y-3">
            {todayCases.slice(0, 6).map((hearing) => (
              <TodayCard key={hearing.id} hearing={hearing} place={placeOf(hearing)} />
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center">
            <CalendarSearch className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-foreground">No hearings on your cases today</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
              Add hearing dates to your cases, or check today’s court cause lists.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button type="button" onClick={onAddCase} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground">
                <Plus className="h-4 w-4" aria-hidden="true" /> Add case
              </button>
              <Link href="/cause-lists" className="inline-flex min-h-10 items-center rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground">
                Open cause lists
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="self-start rounded-2xl border border-border bg-card p-3">
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <h3 className="text-sm font-semibold text-foreground">Coming up</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{upcomingCases.length}</span>
        </div>
        {upcomingCases.length ? (
          <ul className="divide-y divide-border/60">
            {upcomingCases.map((hearing) => (
              <UpcomingRow key={hearing.id} hearing={hearing} place={placeOf(hearing)} todayKey={todayKey} />
            ))}
          </ul>
        ) : (
          <p className="px-1 py-3 text-xs text-muted-foreground">No upcoming hearing dates saved on your active cases.</p>
        )}
      </div>
    </section>
  );
}
