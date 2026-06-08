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
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition"
        data-testid="button-country-switcher"
      >
        <span>{active.flag}</span>
        <span className="hidden sm:inline">{active.name}</span>
        <span className="text-gray-400 text-xs">▼</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            {ALL_COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => { switchCountry(c.code); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-800 transition text-left ${
                  c.code === activeCode ? "bg-yellow-500/10 text-yellow-400" : "text-gray-200"
                }`}
                data-testid={`country-option-${c.code}`}
              >
                <span className="text-xl">{c.flag}</span>
                <span>{c.name}</span>
                {c.code === activeCode && <span className="ml-auto">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
