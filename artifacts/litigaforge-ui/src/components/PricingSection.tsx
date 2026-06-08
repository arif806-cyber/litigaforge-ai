import { useState } from "react";
import { Link } from "wouter";
import { Check, Sparkles } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { getPricing, type PricingTier } from "@/data/pricingPlans";

const UI: Record<string, Record<string, string>> = {
  heading: {
    en: "Simple, transparent pricing",
    es: "Precios simples y transparentes",
    hi: "सरल, पारदर्शी मूल्य निर्धारण",
    te: "సరళమైన, పారదర్శక ధరలు",
    ar: "تسعير بسيط وشفاف",
    de: "Einfache, transparente Preise",
    fr: "Tarification simple et transparente",
  },
  sub: {
    en: "Start free. Upgrade anytime. Cancel whenever you want.",
    es: "Empieza gratis. Mejora cuando quieras. Cancela en cualquier momento.",
    hi: "मुफ़्त शुरू करें। कभी भी अपग्रेड करें। जब चाहें रद्द करें।",
    te: "ఉచితంగా ప్రారంభించండి. ఎప్పుడైనా అప్‌గ్రేడ్ చేయండి. మీకు నచ్చినప్పుడు రద్దు చేయండి.",
    ar: "ابدأ مجانًا. قم بالترقية في أي وقت. ألغِ متى شئت.",
    de: "Kostenlos starten. Jederzeit upgraden. Jederzeit kündbar.",
    fr: "Commencez gratuitement. Améliorez à tout moment. Annulez quand vous voulez.",
  },
  monthly: {
    en: "Monthly", es: "Mensual", hi: "मासिक", te: "నెలవారీ", ar: "شهري", de: "Monatlich", fr: "Mensuel",
  },
  annual: {
    en: "Annual", es: "Anual", hi: "वार्षिक", te: "వార్షిక", ar: "سنوي", de: "Jährlich", fr: "Annuel",
  },
  save: {
    en: "Save 20%", es: "Ahorra 20%", hi: "20% बचाएं", te: "20% ఆదా", ar: "وفّر 20٪", de: "20% sparen", fr: "Économisez 20%",
  },
  free_tier: {
    en: "Free", es: "Gratis", hi: "मुफ़्त", te: "ఉచితం", ar: "مجاني", de: "Kostenlos", fr: "Gratuit",
  },
  basic_tier: {
    en: "Basic", es: "Básico", hi: "बेसिक", te: "బేసిక్", ar: "أساسي", de: "Basic", fr: "Basique",
  },
  pro_tier: {
    en: "Pro", es: "Pro", hi: "प्रो", te: "ప్రో", ar: "احترافي", de: "Pro", fr: "Pro",
  },
  popular: {
    en: "Most Popular", es: "Más popular", hi: "सबसे लोकप्रिय", te: "అత్యంత జనాదరణ", ar: "الأكثر شيوعًا", de: "Am beliebtesten", fr: "Le plus populaire",
  },
  get_started: {
    en: "Get Started", es: "Empezar", hi: "शुरू करें", te: "ప్రారంభించండి", ar: "ابدأ الآن", de: "Loslegen", fr: "Commencer",
  },
  trial: {
    en: "Start 7-day Free Trial", es: "Prueba gratis de 7 días", hi: "7 दिन का मुफ़्त ट्रायल शुरू करें", te: "7-రోజుల ఉచిత ట్రయల్ ప్రారంభించండి", ar: "ابدأ تجربة مجانية لمدة 7 أيام", de: "7-tägige Gratis-Testphase starten", fr: "Essai gratuit de 7 jours",
  },
  per_doc_title: {
    en: "Pay per document", es: "Paga por documento", hi: "प्रति दस्तावेज़ भुगतान", te: "పత్రానికి చెల్లించండి", ar: "ادفع لكل مستند", de: "Pro Dokument zahlen", fr: "Payez par document",
  },
  per_doc_sub: {
    en: "No subscription. One polished legal document, ready to file.", es: "Sin suscripción. Un documento legal pulido, listo para presentar.", hi: "कोई सदस्यता नहीं। एक तैयार कानूनी दस्तावेज़।", te: "సబ్‌స్క్రిప్షన్ లేదు. ఒక సిద్ధమైన న్యాయ పత్రం.", ar: "بدون اشتراك. مستند قانوني واحد جاهز للتقديم.", de: "Kein Abo. Ein fertiges Rechtsdokument zum Einreichen.", fr: "Sans abonnement. Un document juridique prêt à déposer.",
  },
  per_doc_cta: {
    en: "Pay Once, No Subscription", es: "Paga una vez, sin suscripción", hi: "एक बार भुगतान करें, कोई सदस्यता नहीं", te: "ఒకసారి చెల్లించండి, సబ్‌స్క్రిప్షన్ లేదు", ar: "ادفع مرة واحدة، بدون اشتراك", de: "Einmal zahlen, kein Abo", fr: "Payez une fois, sans abonnement",
  },
  per_month: {
    en: "/mo", es: "/mes", hi: "/माह", te: "/నెల", ar: "/شهر", de: "/Monat", fr: "/mois",
  },
  per_year: {
    en: "/yr", es: "/año", hi: "/वर्ष", te: "/సంవత్సరం", ar: "/سنة", de: "/Jahr", fr: "/an",
  },
};

function tr(key: string, lang: string): string {
  const g = UI[key];
  return (g && (g[lang] || g.en)) || key;
}

function formatPrice(currency: string, amount: number): string {
  // Pure alphabetic codes (e.g. "AED") read as "AED 12"; anything containing a
  // currency symbol (₹, $, €, £, "CA$", "A$", "S$") prefixes with no space.
  const isAlphaCode = /^[A-Za-z]+$/.test(currency);
  return isAlphaCode ? `${currency} ${amount.toLocaleString()}` : `${currency}${amount.toLocaleString()}`;
}

interface PricingSectionProps {
  countryCode: string;
}

export default function PricingSection({ countryCode }: PricingSectionProps) {
  const cc = countryCode.toUpperCase();
  const { lang } = useLanguage(cc);
  const pricing = getPricing(cc);
  const [annual, setAnnual] = useState(false);
  const isRtl = lang === "ar";

  const periodPrice = (tier: PricingTier) => {
    if (tier.price === 0) return { display: formatPrice(pricing.currency, 0), suffix: "" };
    if (annual) {
      const yearly = Math.round(tier.price * 12 * 0.8);
      return { display: formatPrice(pricing.currency, yearly), suffix: tr("per_year", lang) };
    }
    return { display: formatPrice(pricing.currency, tier.price), suffix: tr("per_month", lang) };
  };

  const tiers = [
    { id: "free", name: tr("free_tier", lang), data: pricing.free, cta: tr("get_started", lang), ctaHref: "/register", highlight: false },
    { id: "basic", name: tr("basic_tier", lang), data: pricing.basic, cta: tr("trial", lang), ctaHref: "/register", highlight: false },
    { id: "pro", name: tr("pro_tier", lang), data: pricing.pro, cta: tr("trial", lang), ctaHref: "/register", highlight: true },
  ];

  return (
    <section data-testid="section-pricing" dir={isRtl ? "rtl" : "ltr"}>
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold" data-testid="pricing-heading">
          {tr("heading", lang)}
        </h2>
        <p className="text-muted-foreground mt-2">{tr("sub", lang)}</p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 mt-6 p-1 rounded-full border border-border bg-card" data-testid="billing-toggle">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            aria-pressed={!annual}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${!annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="toggle-monthly"
          >
            {tr("monthly", lang)}
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            aria-pressed={annual}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-2 ${annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="toggle-annual"
          >
            {tr("annual", lang)}
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {tr("save", lang)}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {tiers.map((tier) => {
          const { display, suffix } = periodPrice(tier.data);
          return (
            <div
              key={tier.id}
              className={`relative flex flex-col gap-5 p-6 rounded-3xl border bg-card transition ${
                tier.highlight ? "border-primary shadow-xl shadow-primary/10 md:-translate-y-2" : "border-border"
              }`}
              data-testid={`tier-${tier.id}`}
            >
              {tier.highlight && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow"
                  data-testid="badge-popular"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {tr("popular", lang)}
                </span>
              )}
              <div>
                <h3 className="font-bold text-lg">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold" data-testid={`price-${tier.id}`}>{display}</span>
                  {suffix && <span className="text-muted-foreground text-sm">{suffix}</span>}
                </div>
              </div>
              <ul className="flex flex-col gap-3 flex-1">
                {tier.data.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={tier.ctaHref}
                className={`inline-flex items-center justify-center px-5 py-3 rounded-xl text-sm font-semibold transition ${
                  tier.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                    : "border border-border bg-card hover:border-primary/40"
                }`}
                data-testid={`button-tier-${tier.id}`}
              >
                {tier.cta}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Pay per document */}
      <div
        className="mt-5 rounded-3xl border border-border bg-gradient-to-br from-amber-500/5 via-card to-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
        data-testid="tier-per-doc"
      >
        <div>
          <h3 className="font-bold text-lg">{tr("per_doc_title", lang)}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">{tr("per_doc_sub", lang)}</p>
        </div>
        <div className="flex items-center gap-5">
          <span className="text-3xl font-bold whitespace-nowrap" data-testid="price-per-doc">
            {formatPrice(pricing.currency, pricing.per_doc.price)}
          </span>
          <Link
            href="/free-documents"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition whitespace-nowrap"
            data-testid="button-per-doc"
          >
            {tr("per_doc_cta", lang)}
          </Link>
        </div>
      </div>
    </section>
  );
}
