import { useState } from "react";
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

export default function CountrySwitcher() {
  const { activeCode, switchCountry } = useCountry();
  const [open, setOpen] = useState(false);
  const active = ALL_COUNTRIES.find((c) => c.code === activeCode) || ALL_COUNTRIES[0];

  const handleSelect = (code: string) => {
    switchCountry(code);
    setOpen(false);
  };

  return (
    <>
      {/* ── Trigger button ─────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
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
        createPortal(
          <div className="sm:hidden fixed inset-0 z-[100]">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            {/* Sheet */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-2xl"
              style={{ maxHeight: "75vh" }}
              onClick={(e) => e.stopPropagation()}
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
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors active:bg-muted/80 ${
                        isActive
                          ? "bg-primary/8 text-primary"
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

      {/* ── Desktop: dropdown (anchored inline to the trigger) ──── */}
      {open && (
        <div className="hidden sm:block">
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            {/* Dropdown panel */}
            <div className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-y-auto"
              style={{ maxHeight: "min(380px, 70vh)" }}>
              {ALL_COUNTRIES.map((c) => {
                const isActive = c.code === activeCode;
                return (
                  <button
                    key={c.code}
                    onClick={() => handleSelect(c.code)}
                    data-testid={`country-option-${c.code}`}
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
          </div>
      )}
    </>
  );
}
