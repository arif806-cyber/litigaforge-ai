import { useState } from "react";
import { useCountry } from "../hooks/useCountry";

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

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground text-sm font-medium transition"
        data-testid="button-country-switcher"
      >
        <span>{active.flag}</span>
        <span className="hidden sm:inline">{active.name}</span>
        <span className="text-muted-foreground text-xs">▼</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-52 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
            {ALL_COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => { switchCountry(c.code); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition text-left ${
                  c.code === activeCode
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground"
                }`}
                data-testid={`country-option-${c.code}`}
              >
                <span className="text-xl">{c.flag}</span>
                <span>{c.name}</span>
                {c.code === activeCode && <span className="ml-auto text-primary">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
