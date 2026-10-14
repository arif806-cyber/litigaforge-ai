import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { postBoardUpdate, type CourtDayMatter } from "./api";

/** Bottom sheet: an advocate standing in court reports which item is being heard. */
export function BoardUpdateSheet({
  matter, open, onOpenChange,
}: {
  matter: CourtDayMatter | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const start = matter?.board?.now_item ?? 1;
  const [value, setValue] = useState(start);
  const [note, setNote] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (open) { setValue(start); setNote(null); }
  }, [open, start]);

  const save = useMutation({
    mutationFn: () => postBoardUpdate(matter!.court_key!, value),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["court-day"] });
      if (result.status === "accepted") {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
        onOpenChange(false);
      } else {
        setNote({ tone: "warn", text: result.message });
      }
    },
    onError: (error: Error) => setNote({ tone: "error", text: error.message || "Could not update the board." }),
  });

  const step = (delta: number) => setValue((v) => Math.min(Math.max(v + delta, 1), 2000));
  const hall = matter?.hall ? `Court ${matter.hall}` : "this court";

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="mx-auto max-w-md rounded-t-[28px] border-0 bg-card pb-[max(env(safe-area-inset-bottom),20px)]" data-testid="board-update-sheet">
        <div className="space-y-5 px-5 pt-3">
          <div>
            <DrawerDescription className="text-[13px] text-muted-foreground">{[matter?.court, hall].filter(Boolean).join(" · ")}</DrawerDescription>
            <DrawerTitle className="lf-display mt-0.5 text-2xl font-extrabold tracking-[-0.02em]">Which item is being heard now?</DrawerTitle>
          </div>

          <div className="flex items-center justify-center gap-5">
            <button type="button" onClick={() => step(-1)} aria-label="One less"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted text-foreground active:scale-95">
              <Minus className="h-6 w-6" />
            </button>
            <label className="sr-only" htmlFor="board-item-input">Item number being heard</label>
            <input
              id="board-item-input"
              data-testid="board-item-input"
              inputMode="numeric"
              pattern="[0-9]*"
              value={value}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                if (n) setValue(Math.min(n, 2000));
              }}
              className="lf-display w-[130px] bg-transparent text-center text-[76px] font-extrabold leading-[76px] tracking-[-0.04em] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
            />
            <button type="button" onClick={() => step(1)} aria-label="One more"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted text-foreground active:scale-95">
              <Plus className="h-6 w-6" />
            </button>
          </div>

          <div className="flex justify-center gap-2">
            {[1, 3, 5].map((n) => (
              <button key={n} type="button" onClick={() => step(n)}
                className="h-9 rounded-full border border-border px-3 text-sm font-semibold text-foreground/80">
                +{n}
              </button>
            ))}
          </div>

          <p className="text-center text-[13px] text-muted-foreground">
            Advocates tracking {hall} see this update. Please update after stepping out of the court hall.
          </p>

          {note && (
            <p role="alert" className={note.tone === "error" ? "text-center text-sm text-destructive" : "text-center text-sm text-primary"}>
              {note.text}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => onOpenChange(false)}
              className="h-[52px] rounded-2xl border border-border bg-background text-[15px] font-semibold">
              Cancel
            </button>
            <button type="button" data-testid="board-update-submit" disabled={!matter?.court_key || save.isPending}
              onClick={() => save.mutate()}
              className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#17181B] text-[15px] font-semibold text-[#F6F3EC] disabled:opacity-60">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Update board
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
