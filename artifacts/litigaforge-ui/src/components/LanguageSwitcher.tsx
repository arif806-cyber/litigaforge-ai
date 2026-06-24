import { useState, useRef, useEffect } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const LANG_LABELS: Record<string, string> = {
  en: "English",
  hi: "हिंदी",
  te: "తెలుగు",
  ar: "العربية",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

const LANG_SHORT: Record<string, string> = {
  en: "EN",
  hi: "हि",
  te: "తె",
  ar: "عر",
  de: "DE",
  fr: "FR",
  es: "ES",
};

export default function LanguageSwitcher({ countryCode }: { countryCode?: string }) {
  const { lang, switchLang, availableLangs } = useLanguage(countryCode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (availableLangs.length <= 1) return null;

  return (
    <div ref={ref} className="relative" data-testid="language-switcher">
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid={`lang-active-${lang}`}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/70 transition-all"
      >
        <span className="font-bold text-foreground">{LANG_SHORT[lang] ?? lang.toUpperCase()}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[120px]">
          {availableLangs.map((l) => (
            <button
              key={l}
              onClick={() => { switchLang(l); setOpen(false); }}
              data-testid={`lang-option-${l}`}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors text-left",
                l === lang
                  ? "text-amber-600 bg-amber-50"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span className="w-5 font-bold text-[11px] text-muted-foreground">{LANG_SHORT[l] ?? l.toUpperCase()}</span>
              <span>{LANG_LABELS[l] ?? l}</span>
              {l === lang && <span className="ml-auto text-amber-500">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
