import { useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { getPainPoints, painPointHref, type PainPoint, type Urgency } from "@/data/countryPainPoints";

const UI_LABELS: Record<string, Record<string, string>> = {
  heading: {
    en: "What is your legal problem?",
    es: "¿Cuál es tu problema legal?",
    hi: "आपकी कानूनी समस्या क्या है?",
    te: "మీ న్యాయ సమస్య ఏమిటి?",
    ar: "ما هي مشكلتك القانونية؟",
    de: "Was ist Ihr rechtliches Problem?",
    fr: "Quel est votre problème juridique ?",
  },
  free: {
    en: "Free",
    es: "Gratis",
    hi: "मुफ़्त",
    te: "ఉచితం",
    ar: "مجاني",
    de: "Kostenlos",
    fr: "Gratuit",
  },
  emergency: {
    en: "Emergency",
    es: "Emergencia",
    hi: "आपातकाल",
    te: "అత్యవసరం",
    ar: "طارئ",
    de: "Notfall",
    fr: "Urgence",
  },
  critical: {
    en: "Critical",
    es: "Crítico",
    hi: "गंभीर",
    te: "క్లిష్టమైన",
    ar: "حرج",
    de: "Kritisch",
    fr: "Critique",
  },
  high: {
    en: "High Priority",
    es: "Alta prioridad",
    hi: "उच्च प्राथमिकता",
    te: "అధిక ప్రాధాన్యత",
    ar: "أولوية عالية",
    de: "Hohe Priorität",
    fr: "Priorité élevée",
  },
  medium: {
    en: "Common",
    es: "Común",
    hi: "सामान्य",
    te: "సాధారణం",
    ar: "شائع",
    de: "Häufig",
    fr: "Courant",
  },
};

function label(key: string, lang: string): string {
  const group = UI_LABELS[key];
  return (group && (group[lang] || group.en)) || key;
}

function localizedTitle(p: PainPoint, lang: string): string {
  if (lang === "te" && p.title_te) return p.title_te;
  if (lang === "hi" && p.title_hi) return p.title_hi;
  if (lang === "ar" && p.title_ar) return p.title_ar;
  return p.title;
}

const URGENCY_STYLE: Record<Urgency, string> = {
  emergency: "bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30 animate-pulse",
  critical: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/20",
  medium: "bg-muted text-muted-foreground ring-1 ring-border",
};

interface PainPointsGridProps {
  countryCode: string;
}

export default function PainPointsGrid({ countryCode }: PainPointsGridProps) {
  const cc = countryCode.toUpperCase();
  const { lang } = useLanguage(cc);
  const [, navigate] = useLocation();
  const painPoints = getPainPoints(cc);
  const isRtl = lang === "ar";

  return (
    <section data-testid="section-pain-points" dir={isRtl ? "rtl" : "ltr"}>
      <h2 className="text-xl md:text-2xl font-bold mb-6" data-testid="pain-points-heading">
        {label("heading", lang)}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {painPoints.map((p) => {
          const title = localizedTitle(p, lang);
          return (
            <div
              key={p.id}
              className="group flex flex-col gap-3 p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-lg transition"
              data-testid={`pain-${p.service}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl leading-none">
                  <span aria-hidden="true">{p.icon}</span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${URGENCY_STYLE[p.urgency]}`}
                    data-testid={`urgency-${p.service}`}
                  >
                    {label(p.urgency, lang)}
                  </span>
                  {p.price_free && (
                    <span
                      className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30"
                      data-testid={`free-${p.service}`}
                    >
                      {label("free", lang)}
                    </span>
                  )}
                </div>
              </div>
              <h3 className="font-semibold leading-snug text-lg">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">{p.desc}</p>
              <button
                type="button"
                onClick={() => navigate(painPointHref(p))}
                className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
                data-testid={`cta-${p.service}`}
              >
                {p.cta}
                <ArrowRight className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
