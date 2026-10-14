import { useQuery } from "@tanstack/react-query";
import { Lock, Scale, Share2, Sparkles } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchBrief, type CourtDayMatter, type HearingBrief } from "./api";

const fmt = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/** Order dates: "02 Oct" this year, "02 Oct 2025" otherwise, so the column never wraps. */
const fmtShort = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

/** Hearing brief from stored court data. Factual only: no predictions, no invented law. */
export function BriefSheet({
  matter, open, onOpenChange, onShare,
}: {
  matter: CourtDayMatter | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (brief: HearingBrief) => void;
}) {
  const { data: brief, isLoading, isError } = useQuery({
    queryKey: ["court-day-brief", matter?.case_id],
    queryFn: () => fetchBrief(matter!.case_id),
    enabled: open && !!matter,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-md rounded-t-[28px] border-0 bg-background" data-testid="brief-sheet">
        <div className="overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3">
          <DrawerDescription className="text-[13px] text-muted-foreground">
            {[matter?.item ? `Item ${matter.item}` : null, matter?.court, matter?.hall ? `Court ${matter.hall}` : null].filter(Boolean).join(" · ")}
          </DrawerDescription>
          <DrawerTitle className="lf-display mt-1 text-[28px] font-extrabold leading-[31px] tracking-[-0.02em]">
            {matter?.title}
          </DrawerTitle>
          {matter?.cnr && <p className="mt-1 font-mono text-[13px] text-muted-foreground">{matter.cnr}</p>}

          <div className="mt-4 rounded-[22px] border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-primary">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Hearing brief
              </p>
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">Verify</span>
            </div>

            {isLoading && (
              <div className="mt-4 space-y-3" aria-label="Loading brief">
                <Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" />
              </div>
            )}
            {isError && <p className="mt-3 text-sm text-destructive">Could not load the brief. Try again in a moment.</p>}

            {brief && (
              <div className="mt-3 space-y-4" data-testid="brief-body">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Stage</p><p className="font-semibold">{brief.stage || "Not recorded"}</p></div>
                  <div><p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Next date</p><p className="font-semibold">{fmt(brief.next_date)}</p></div>
                  {brief.judge && <div className="col-span-2"><p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Bench</p><p className="font-semibold">{brief.judge}</p></div>}
                </div>

                <Section title="Last orders">
                  {brief.last_orders.length ? (
                    <ul className="space-y-2">
                      {brief.last_orders.map((o, i) => (
                        <li key={i} className="flex gap-3 text-sm leading-5">
                          <span className="w-[86px] shrink-0 whitespace-nowrap pt-px font-mono text-xs text-primary">{fmtShort(o.date)}</span>
                          <span>{o.text}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">No orders stored yet. Track this CNR to fetch them.</p>}
                </Section>

                <Section title="Check before the hearing">
                  <ul className="space-y-1.5">
                    {brief.checklist.map((c) => (
                      <li key={c} className="flex gap-2 text-sm leading-5">
                        <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{c}
                      </li>
                    ))}
                  </ul>
                </Section>

                {brief.law.length > 0 && (
                  <Section title="New criminal laws">
                    <ul className="space-y-1.5 rounded-2xl bg-muted/60 p-3">
                      {brief.law.map((l) => (
                        <li key={l.old} className="flex items-start gap-2 text-sm">
                          <Scale className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          <span><strong className="font-semibold">{l.new ?? "No direct equivalent"}</strong>
                            <span className="text-muted-foreground"> — formerly {l.old}</span></span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                <p className="text-xs leading-5 text-muted-foreground">
                  {brief.verify_notice}{brief.data_as_of ? ` Court data as of ${fmt(brief.data_as_of)}.` : ""}
                </p>
                {brief.sensitive && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Private matter: party names are never shown to other users.
                  </p>
                )}
              </div>
            )}
          </div>

          <button type="button" disabled={!brief} onClick={() => brief && onShare(brief)} data-testid="brief-share"
            className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#17181B] text-[15px] font-semibold text-[#F6F3EC] disabled:opacity-60">
            <Share2 className="h-5 w-5" aria-hidden="true" /> Share with client
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
