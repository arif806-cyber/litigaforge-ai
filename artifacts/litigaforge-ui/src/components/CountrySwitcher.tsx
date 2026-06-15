import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useCountry } from "../hooks/useCountry";
import { X, Check, ChevronDown, Globe } from "lucide-react";

interface CountryItem {
  code: string;
  name: string;
  flag: string;
}

const ALL_COUNTRIES: CountryItem[] = [
  { code: "IN", name: "India",          flag: "🇮🇳" },
  { code: "US", name: "United States",  flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AE", name: "UAE",            flag: "🇦🇪" },
  { code: "AU", name: "Australia",      flag: "🇦🇺" },
  { code: "CA", name: "Canada",         flag: "🇨🇦" },
  { code: "SG", name: "Singapore",      flag: "🇸🇬" },
  { code: "DE", name: "Germany",        flag: "🇩🇪" },
];

// Single source of truth for which presentation to mount, so only ONE menu
// (and therefore one set of `country-option-*` testids) is ever in the DOM.
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

export default function CountrySwitcher() {
  const { activeCode, switchCountry } = useCountry();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const active = ALL_COUNTRIES.find((c) => c.code === activeCode) || ALL_COUNTRIES[0];

  const handleSelect = (code: string) => {
    switchCountry(code);
    setOpen(false);
  };

  // Anchor the desktop dropdown under the trigger. It is portalled to <body>
  // (escaping the header's backdrop-filter containing block), so we position it
  // with viewport-relative fixed coordinates derived from the trigger rect.
  useLayoutEffect(() => {
    if (!open || isMobile) return;
    const PANEL_W = 224; // w-56
    const MARGIN = 8;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const rtl =
        typeof document !== "undefined" &&
        document.documentElement.dir === "rtl";
      // LTR: align panel's right edge to trigger's right edge.
      // RTL: align panel's left edge to trigger's left edge.
      let left = rtl ? r.left : r.right - PANEL_W;
      // Clamp within the viewport so it never overflows off-screen.
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - PANEL_W - MARGIN));
      setPos({ top: Math.round(r.bottom + 8), left: Math.round(left) });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, isMobile]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* ── Trigger button ─────────────────────────── */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground text-sm font-medium transition-colors"
        data-testid="button-country-switcher"
      >
        <span className="text-base leading-none">{active.flag}</span>
        <span className="hidden sm:inline text-sm">{active.name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {/* ── Mobile: bottom sheet (portalled to body to escape the
            header's backdrop-filter containing block) ───────────── */}
      {open &&
        isMobile &&
        createPortal(
          <div className="fixed inset-0 z-[100]">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            {/* Sheet */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-popover text-popover-foreground rounded-t-2xl shadow-2xl"
              style={{ maxHeight: "75vh" }}
              onClick={(e) => e.stopPropagation()}
              role="listbox"
              aria-label="Select country"
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground">Select Country</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Country list */}
              <div className="overflow-y-auto pb-8" style={{ maxHeight: "calc(75vh - 100px)" }}>
                {ALL_COUNTRIES.map((c) => {
                  const isActive = c.code === activeCode;
                  return (
                    <button
                      key={c.code}
                      onClick={() => handleSelect(c.code)}
                      data-testid={`country-option-${c.code}`}
                      role="option"
                      aria-selected={isActive}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors active:bg-muted/80 ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="text-3xl leading-none">{c.flag}</span>
                      <span className="flex-1 font-medium text-base">{c.name}</span>
                      {isActive && (
                        <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Desktop: dropdown (portalled to body, anchored to the trigger
            so it is never clipped by the header's backdrop-filter) ──── */}
      {open &&
        !isMobile &&
        createPortal(
          <div className="fixed inset-0 z-[100]">
            {/* Click-away backdrop */}
            <div className="absolute inset-0" onClick={() => setOpen(false)} />
            {/* Dropdown panel */}
            <div
              className="absolute w-56 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl overflow-y-auto"
              style={{
                top: pos?.top ?? 64,
                left: pos?.left ?? 8,
                visibility: pos ? "visible" : "hidden",
                maxHeight: "min(380px, 70vh)",
              }}
              onClick={(e) => e.stopPropagation()}
              role="listbox"
              aria-label="Select country"
            >
              {ALL_COUNTRIES.map((c) => {
                const isActive = c.code === activeCode;
                return (
                  <button
                    key={c.code}
                    onClick={() => handleSelect(c.code)}
                    data-testid={`country-option-${c.code}`}
                    role="option"
                    aria-selected={isActive}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground hover:bg-accent"
                    }`}
                  >
                    <span className="text-xl leading-none">{c.flag}</span>
                    <span className="flex-1">{c.name}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
