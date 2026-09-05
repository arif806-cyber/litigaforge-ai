import { useEffect, useState } from "react";
import { MessageSquareText, FileText, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";

interface Stats {
  answered_questions: number;
  verified_lawyers: number;
  documents_generated: number;
}

/**
 * Local UI dictionary (en/es/hi/te/ar/de/fr + en fallback) — same pattern as
 * PricingSection / PainPointsGrid. We never explode the central Translation
 * interface for section copy.
 *
 * Each metric has a numeric label (shown beneath a real count) and a
 * qualitative label (shown when the real count is 0, so we never advertise a
 * "0" or imply an inflated number).
 */
const UI: Record<string, Record<string, string>> = {
  answers: {
    en: "AI legal answers", es: "Respuestas legales con IA", hi: "AI कानूनी उत्तर",
    te: "AI న్యాయ సమాధానాలు", ar: "إجابات قانونية بالذكاء الاصطناعي",
    de: "KI-Rechtsantworten", fr: "Réponses juridiques par IA",
  },
  documents: {
    en: "Documents generated", es: "Documentos generados", hi: "तैयार दस्तावेज़",
    te: "రూపొందించిన పత్రాలు", ar: "مستندات تم إنشاؤها",
    de: "Erstellte Dokumente", fr: "Documents générés",
  },
  lawyers: {
    en: "Verified advocates", es: "Abogados verificados", hi: "सत्यापित अधिवक्ता",
    te: "ధ్రువీకరించబడిన న్యాయవాదులు", ar: "محامون موثّقون",
    de: "Verifizierte Anwälte", fr: "Avocats vérifiés",
  },
  answers_q: {
    en: "Free AI legal answers", es: "Respuestas legales con IA gratis", hi: "मुफ़्त AI कानूनी उत्तर",
    te: "ఉచిత AI న్యాయ సమాధానాలు", ar: "إجابات قانونية مجانية بالذكاء الاصطناعي",
    de: "Kostenlose KI-Rechtsantworten", fr: "Réponses juridiques IA gratuites",
  },
  documents_q: {
    en: "Ready-to-file documents", es: "Documentos listos para presentar", hi: "दाखिल करने योग्य दस्तावेज़",
    te: "దాఖలు చేయదగిన పత్రాలు", ar: "مستندات جاهزة للتقديم",
    de: "Einreichfertige Dokumente", fr: "Documents prêts à déposer",
  },
  lawyers_q: {
    en: "Bar-verified directory", es: "Directorio verificado", hi: "सत्यापित निर्देशिका",
    te: "ధ్రువీకరించబడిన డైరెక్టరీ", ar: "دليل محامين موثّق",
    de: "Verifiziertes Anwaltsverzeichnis", fr: "Annuaire d’avocats vérifiés",
  },
};

function tr(key: string, lang: string): string {
  const g = UI[key];
  return (g && (g[lang] || g.en)) || key;
}

interface SocialProofBarProps {
  countryCode: string;
}

export default function SocialProofBar({ countryCode }: SocialProofBarProps) {
  const { lang } = useLanguage(countryCode.toUpperCase());
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiFetch("/stats") as Promise<Stats>,
      apiFetch("/lawyers") as Promise<{ total?: number }>,
    ])
      .then(([d, directory]) => {
        // The directory's public total is the source of truth for the advocate
        // counter. It already excludes pending, rejected, and test profiles.
        if (alive) setStats({ ...d, verified_lawyers: directory.total ?? 0 });
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const loading = !stats && !failed;

  const metrics = [
    { key: "answers", qKey: "answers_q", icon: <MessageSquareText className="w-4 h-4" />, value: stats?.answered_questions ?? 0 },
    { key: "documents", qKey: "documents_q", icon: <FileText className="w-4 h-4" />, value: stats?.documents_generated ?? 0 },
    { key: "lawyers", qKey: "lawyers_q", icon: <ShieldCheck className="w-4 h-4" />, value: stats?.verified_lawyers ?? 0 },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4" data-testid="social-proof-bar">
      {metrics.map((m) => {
        const showNumber = !loading && m.value > 0;
        return (
          <div
            key={m.key}
            className="rounded-xl border border-border bg-card/70 cfos-elev-1 px-3 py-3 sm:px-4 sm:py-4 text-center"
            data-testid={`stat-${m.key}`}
          >
            <div className="flex items-center justify-center mb-1.5" style={{ color: "hsl(var(--cfos-gold))" }}>
              {m.icon}
            </div>
            {loading ? (
              <div className="h-7 w-12 mx-auto rounded bg-muted animate-pulse" />
            ) : showNumber ? (
              <div className="cfos-mono text-xl sm:text-2xl font-bold leading-none" data-testid={`stat-${m.key}-value`}>
                {m.value.toLocaleString()}
              </div>
            ) : null}
            <div className={`text-[11px] sm:text-xs text-muted-foreground leading-tight ${showNumber ? "mt-1.5" : ""}`}>
              {showNumber ? tr(m.key, lang) : tr(m.qKey, lang)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
