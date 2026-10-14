import { useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { buildShareMessage, SHARE_LANGS, whatsappLink, type ShareInput, type ShareLang } from "./share";

const LANG_KEY = "lf-share-lang";

function readLang(): ShareLang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "te" || v === "hi" ? v : "en";
  } catch { return "en"; }
}

/** Share a hearing date with the client in their language, on WhatsApp or anywhere else. */
export function ShareSheet({
  input, open, onOpenChange,
}: {
  input: Omit<ShareInput, "lang"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [lang, setLang] = useState<ShareLang>(readLang);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (open) setCopied(false); }, [open]);

  const message = useMemo(() => (input ? buildShareMessage({ ...input, lang }) : ""), [input, lang]);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const pick = (next: ShareLang) => {
    setLang(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* storage unavailable */ }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setCopied(false); }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="mx-auto max-w-md rounded-t-[28px] border-0 bg-card pb-[max(env(safe-area-inset-bottom),20px)]" data-testid="share-sheet">
        <div className="space-y-4 px-5 pt-3">
          <div>
            <DrawerDescription className="text-[13px] text-muted-foreground">
              {input?.clientName ? `To ${input.clientName}` : "To your client"}
            </DrawerDescription>
            <DrawerTitle className="lf-display mt-0.5 text-2xl font-extrabold tracking-[-0.02em]">
              {input?.mode === "today" ? "Tell your client" : "Share next date"}
            </DrawerTitle>
          </div>

          <div role="group" aria-label="Message language" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
            {SHARE_LANGS.map((l) => (
              <button key={l.id} type="button" aria-pressed={lang === l.id} onClick={() => pick(l.id)}
                data-testid={`share-lang-${l.id}`}
                className={cn("h-11 rounded-xl text-sm font-semibold transition-colors",
                  lang === l.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                {l.label}
              </button>
            ))}
          </div>

          <div className="rounded-3xl bg-[#E6DFD3] p-4">
            <p data-testid="share-preview" lang={lang}
              className="ml-auto max-w-[300px] whitespace-pre-line rounded-[18px] rounded-br-md bg-[#D9F7C9] px-3.5 py-3 text-[15px] leading-[22px] text-[#13241A] shadow-[0_1px_1px_rgba(0,0,0,0.08)]">
              {message}
            </p>
          </div>

          <div className={cn("grid gap-3", canNativeShare ? "grid-cols-3" : "grid-cols-2")}>
            <a href={whatsappLink(message)} target="_blank" rel="noreferrer" data-testid="share-whatsapp"
              className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#1F7A4D] text-[15px] font-semibold text-white">
              <MessageCircle className="h-5 w-5" aria-hidden="true" /> WhatsApp
            </a>
            <button type="button" onClick={copy}
              className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-border bg-background text-[15px] font-semibold">
              {copied ? <Check className="h-5 w-5 text-[#1F7A4D]" /> : <Copy className="h-5 w-5" />} {copied ? "Copied" : "Copy"}
            </button>
            {canNativeShare && (
              <button type="button" onClick={() => navigator.share({ text: message }).catch(() => undefined)}
                className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-border bg-background text-[15px] font-semibold">
                <Share2 className="h-5 w-5" /> More
              </button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Nothing is sent until you press send in WhatsApp or another app.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
