import { Globe, ShieldCheck, Scale, BadgeCheck } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * Static, defensible trust signals shown beneath the hero social-proof bar.
 * Claims are deliberately limited to the product's supported capabilities,
 * legal-information tools, and advocates verified by a human when available.
 * We deliberately never ship fabricated
 * testimonials, partner logos or review counts. Localized via a local UI
 * dictionary, same pattern as SocialProofBar / PricingSection.
 */
const UI: Record<string, Record<string, string>> = {
  countries: {
    en: "Built for legal work", es: "Diseñado para el trabajo legal", hi: "कानूनी काम के लिए बनाया गया",
    te: "తెలంగాణ మరియు ఆంధ్రప్రదేశ్ కోసం రూపొందించబడింది", ar: "مصمم لتيلانجانا وأندرا براديش",
    de: "Für juristische Arbeit entwickelt", fr: "Conçu pour le travail juridique",
  },
  verified: {
    en: "Admin-checked enrolment badge where shown", es: "Inscripción revisada donde se indique", hi: "जहाँ दिखे वहाँ नामांकन जाँचा गया",
    te: "చూపిన చోట నమోదు తనిఖీ", ar: "فحص التسجيل حيثما يظهر",
    de: "Geprüfter Status, wo angezeigt", fr: "Inscription contrôlée lorsqu’indiquée",
  },
  grounded: {
    en: "Grounded in local law", es: "Basado en la ley local", hi: "स्थानीय कानून पर आधारित",
    te: "స్థానిక చట్టం ఆధారంగా", ar: "مستند إلى القانون المحلي",
    de: "Basiert auf lokalem Recht", fr: "Fondé sur le droit local",
  },
  free: {
    en: "Free to start — no card", es: "Gratis — sin tarjeta", hi: "मुफ़्त शुरुआत — कार्ड नहीं",
    te: "ఉచిత ప్రారంభం — కార్డ్ అవసరం లేదు", ar: "ابدأ مجاناً — بدون بطاقة",
    de: "Kostenlos starten — keine Karte", fr: "Gratuit — sans carte",
  },
};

function tr(key: string, lang: string): string {
  const g = UI[key];
  return (g && (g[lang] || g.en)) || key;
}

interface TrustStripProps {
  countryCode: string;
}

export default function TrustStrip({ countryCode }: TrustStripProps) {
  const { lang } = useLanguage(countryCode.toUpperCase());
  const items = [
    { key: "countries", icon: Globe },
    { key: "verified", icon: ShieldCheck },
    { key: "grounded", icon: Scale },
    { key: "free", icon: BadgeCheck },
  ] as const;

  return (
    <div
      className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2"
      data-testid="trust-strip"
    >
      {items.map(({ key, icon: Icon }) => (
        <div
          key={key}
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground"
          data-testid={`trust-${key}`}
        >
          <Icon
            className="w-4 h-4 shrink-0"
            style={{ color: "hsl(var(--cfos-gold))" }}
            aria-hidden="true"
          />
          <span>{tr(key, lang)}</span>
        </div>
      ))}
    </div>
  );
}
