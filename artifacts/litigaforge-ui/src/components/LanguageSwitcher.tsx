import { useLanguage } from "../hooks/useLanguage";

const LANG_LABELS: Record<string, string> = {
  en: "English",
  hi: "हिंदी",
  te: "తెలుగు",
  ar: "العربية",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

const LANG_FLAGS: Record<string, string> = {
  en: "🇬🇧",
  hi: "🇮🇳",
  te: "🇮🇳",
  ar: "🇦🇪",
  de: "🇩🇪",
  fr: "🇫🇷",
  es: "🇪🇸",
};

export default function LanguageSwitcher({ countryCode }: { countryCode?: string }) {
  const { lang, switchLang, availableLangs } = useLanguage(countryCode);

  if (availableLangs.length <= 1) return null;

  return (
    <div className="flex items-center gap-1" data-testid="language-switcher">
      {availableLangs.map((l) => (
        <button
          key={l}
          onClick={() => switchLang(l)}
          data-testid={`lang-option-${l}`}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
            l === lang
              ? "bg-amber-500 text-black shadow"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          <span>{LANG_FLAGS[l]}</span>
          <span className="hidden sm:inline">{LANG_LABELS[l]}</span>
        </button>
      ))}
    </div>
  );
}
