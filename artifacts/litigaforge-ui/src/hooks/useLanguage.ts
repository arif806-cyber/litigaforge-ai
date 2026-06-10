import { useState, useEffect } from "react";
import translations, { type Translation } from "../i18n";
import { getCountryFromPath } from "../lib/country";

const COUNTRY_DEFAULT_LANG: Record<string, string> = {
  IN: "en",
  US: "en",
  GB: "en",
  AE: "ar",
  AU: "en",
  CA: "en",
  SG: "en",
  DE: "de",
};

const LANG_EVENT = "lf-lang-change";

// Non-Latin scripts are loaded on demand (not in index.html) so the default
// English experience never downloads Telugu/Devanagari/Arabic webfonts.
const SCRIPT_FONTS: Record<string, string> = {
  te: "https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600;700&display=swap",
  hi: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap",
  ar: "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap",
};

function ensureScriptFont(lang: string) {
  const href = SCRIPT_FONTS[lang];
  if (!href || typeof document === "undefined") return;
  if (document.querySelector(`link[data-font="${lang}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-font", lang);
  document.head.appendChild(link);
}

function resolveLang(countryCode: string): string {
  const country = translations[countryCode] || translations.IN;
  const available = Object.keys(country);
  const stored = localStorage.getItem(`lang_${countryCode}`);
  if (stored && available.includes(stored)) return stored;
  return COUNTRY_DEFAULT_LANG[countryCode] || available[0] || "en";
}

// Country-aware language hook. Falls back to the active country from the URL,
// then India. State is synced across every component instance via the
// "lf-lang-change" event (and cross-tab via the storage event), so switching
// language in the header instantly re-renders the sidebar, dashboard, etc.
export function useLanguage(countryCode?: string) {
  const cc = (countryCode || getCountryFromPath() || "IN").toUpperCase();
  const [lang, setLang] = useState(() => resolveLang(cc));

  useEffect(() => {
    setLang(resolveLang(cc));
    const sync = () => setLang(resolveLang(cc));
    window.addEventListener(LANG_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LANG_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [cc]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    ensureScriptFont(lang);
  }, [lang]);

  const switchLang = (newLang: string) => {
    localStorage.setItem(`lang_${cc}`, newLang);
    setLang(newLang);
    window.dispatchEvent(new Event(LANG_EVENT));
  };

  const countryTranslations = translations[cc] || translations.IN;
  const t = (countryTranslations[lang] ||
    countryTranslations.en ||
    Object.values(countryTranslations)[0]) as Translation;
  const availableLangs = Object.keys(countryTranslations);

  return { lang, switchLang, t, availableLangs };
}
