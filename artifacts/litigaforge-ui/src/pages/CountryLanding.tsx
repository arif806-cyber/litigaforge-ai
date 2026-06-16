import { Link } from "wouter";
import {
  Scale,
  Phone,
  ArrowRight,
  Sparkles,
  FileText,
  Search,
  MessageSquareText,
  ShieldCheck,
  Handshake,
  MapPin,
  Check,
} from "lucide-react";
import CountrySwitcher from "@/components/CountrySwitcher";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PainPointsGrid from "@/components/PainPointsGrid";
import PricingSection from "@/components/PricingSection";
import SocialProofBar from "@/components/SocialProofBar";
import TrustStrip from "@/components/TrustStrip";
import { LegalDisclaimerFooter } from "@/components/legal-disclaimer";
import { MarginRuleCard, PaperSurface, ScoreRing, Stamp, Chip } from "@/components/case-file-os";
import { useLanguage } from "@/hooks/useLanguage";
import { getLandingContent } from "@/lib/countryLandingData";

/**
 * Local UI dictionary (en/es/hi/te/ar/de/fr + en fallback) for section copy
 * introduced by the Case File OS homepage. The central Translation interface
 * keeps the country-aware hero (t.hero_title / t.hero_sub) — outcome framing is
 * layered on via these short, fully-localized strings.
 */
const L: Record<string, Record<string, string>> = {
  nav_ask: { en: "Ask Legal AI", es: "Consultar IA legal", hi: "AI से पूछें", te: "AIని అడగండి", ar: "اسأل الذكاء الاصطناعي", de: "KI-Recht fragen", fr: "Demander à l’IA" },
  nav_documents: { en: "Free Documents", es: "Documentos gratis", hi: "मुफ़्त दस्तावेज़", te: "ఉచిత పత్రాలు", ar: "مستندات مجانية", de: "Gratis-Dokumente", fr: "Documents gratuits" },
  nav_find_lawyer: { en: "Find a Lawyer", es: "Buscar abogado", hi: "वकील खोजें", te: "న్యాయవాదిని కనుగొనండి", ar: "ابحث عن محامٍ", de: "Anwalt finden", fr: "Trouver un avocat" },
  nav_for_lawyers: { en: "For Lawyers", es: "Para abogados", hi: "वकीलों के लिए", te: "న్యాయవాదుల కోసం", ar: "للمحامين", de: "Für Anwälte", fr: "Pour les avocats" },
  search: { en: "Search", es: "Buscar", hi: "खोजें", te: "శోధించండి", ar: "بحث", de: "Suchen", fr: "Rechercher" },
  eyebrow: { en: "AI Legal Operating System", es: "Sistema legal con IA", hi: "AI लीगल ऑपरेटिंग सिस्टम", te: "AI లీగల్ ఆపరేటింగ్ సిస్టమ్", ar: "نظام قانوني بالذكاء الاصطناعي", de: "KI-Rechtsbetriebssystem", fr: "Système juridique IA" },
  ask_free: { en: "Ask a Legal Question Free", es: "Haz una consulta legal gratis", hi: "मुफ़्त कानूनी सवाल पूछें", te: "ఉచితంగా న్యాయ ప్రశ్న అడగండి", ar: "اطرح سؤالاً قانونياً مجاناً", de: "Rechtsfrage kostenlos stellen", fr: "Posez une question juridique gratuitement" },
  benefit_free: { en: "Free to start", es: "Gratis para empezar", hi: "शुरू करना मुफ़्त", te: "ప్రారంభం ఉచితం", ar: "ابدأ مجاناً", de: "Kostenlos starten", fr: "Gratuit au départ" },
  benefit_verified: { en: "Bar-verified advocates", es: "Abogados verificados", hi: "सत्यापित अधिवक्ता", te: "ధ్రువీకరించబడిన న్యాయవాదులు", ar: "محامون موثّقون", de: "Verifizierte Anwälte", fr: "Avocats vérifiés" },
  benefit_instant: { en: "Instant AI answers", es: "Respuestas IA al instante", hi: "तुरंत AI उत्तर", te: "తక్షణ AI సమాధానాలు", ar: "إجابات فورية بالذكاء الاصطناعي", de: "Sofortige KI-Antworten", fr: "Réponses IA instantanées" },
  hero_micro: { en: "No credit card needed · Free legal Q&A", es: "Sin tarjeta · Consultas legales gratis", hi: "क्रेडिट कार्ड नहीं चाहिए · मुफ़्त कानूनी प्रश्नोत्तर", te: "క్రెడిట్ కార్డ్ అవసరం లేదు · ఉచిత న్యాయ ప్రశ్నోత్తరాలు", ar: "بدون بطاقة ائتمان · أسئلة قانونية مجانية", de: "Keine Kreditkarte · Kostenlose Rechtsfragen", fr: "Sans carte bancaire · Questions juridiques gratuites" },
  ai_live: { en: "AI · live", es: "IA · en vivo", hi: "AI · लाइव", te: "AI · లైవ్", ar: "ذكاء اصطناعي · مباشر", de: "KI · live", fr: "IA · en direct" },
  sample_label: { en: "Sample case file", es: "Expediente de muestra", hi: "नमूना केस फ़ाइल", te: "నమూనా కేసు ఫైల్", ar: "ملف قضية نموذجي", de: "Beispiel-Fallakte", fr: "Dossier exemple" },
  sample_matter: { en: "Tenancy deposit dispute", es: "Disputa de depósito de alquiler", hi: "किराया जमा विवाद", te: "అద్దె డిపాజిట్ వివాదం", ar: "نزاع وديعة الإيجار", de: "Mietkautionsstreit", fr: "Litige sur le dépôt de garantie" },
  matter_label: { en: "Matter", es: "Asunto", hi: "मामला", te: "విషయం", ar: "الموضوع", de: "Sache", fr: "Affaire" },
  sample_court: { en: "Civil court", es: "Tribunal civil", hi: "सिविल न्यायालय", te: "సివిల్ కోర్టు", ar: "محكمة مدنية", de: "Zivilgericht", fr: "Tribunal civil" },
  next_hearing: { en: "Next hearing", es: "Próxima audiencia", hi: "अगली सुनवाई", te: "తదుపరి విచారణ", ar: "الجلسة القادمة", de: "Nächste Anhörung", fr: "Prochaine audience" },
  bar_verified: { en: "Bar-verified", es: "Verificado", hi: "सत्यापित", te: "ధ్రువీకరించబడింది", ar: "موثّق", de: "Verifiziert", fr: "Vérifié" },
  illustrative: { en: "Illustrative preview", es: "Vista ilustrativa", hi: "उदाहरण पूर्वावलोकन", te: "ఉదాహరణ ప్రివ్యూ", ar: "معاينة توضيحية", de: "Beispielansicht", fr: "Aperçu illustratif" },
  how_heading: { en: "How LitigaForge works", es: "Cómo funciona LitigaForge", hi: "LitigaForge कैसे काम करता है", te: "LitigaForge ఎలా పనిచేస్తుంది", ar: "كيف يعمل LitigaForge", de: "So funktioniert LitigaForge", fr: "Comment fonctionne LitigaForge" },
  how_sub: { en: "From your question to your next legal step — in three steps.", es: "De tu pregunta a tu próximo paso legal — en tres pasos.", hi: "आपके सवाल से आपके अगले कानूनी कदम तक — तीन चरणों में।", te: "మీ ప్రశ్న నుండి మీ తదుపరి న్యాయ చర్య వరకు — మూడు దశల్లో.", ar: "من سؤالك إلى خطوتك القانونية التالية — في ثلاث خطوات.", de: "Von Ihrer Frage zum nächsten rechtlichen Schritt — in drei Schritten.", fr: "De votre question à votre prochaine étape juridique — en trois étapes." },
  step_label: { en: "Step", es: "Paso", hi: "चरण", te: "దశ", ar: "خطوة", de: "Schritt", fr: "Étape" },
  step1_t: { en: "Ask or post your case", es: "Pregunta o publica tu caso", hi: "पूछें या केस पोस्ट करें", te: "అడగండి లేదా కేసు పోస్ట్ చేయండి", ar: "اسأل أو انشر قضيتك", de: "Fragen oder Fall posten", fr: "Posez ou publiez votre affaire" },
  step1_d: { en: "Describe your issue in plain language or post a case. Free legal Q&A — no account needed to start.", es: "Describe tu problema en lenguaje sencillo o publica un caso. Consultas legales gratis, sin cuenta para empezar.", hi: "अपनी समस्या सरल भाषा में बताएं या केस पोस्ट करें। मुफ़्त कानूनी प्रश्नोत्तर — शुरू करने के लिए खाता ज़रूरी नहीं।", te: "మీ సమస్యను సరళ భాషలో వివరించండి లేదా కేసు పోస్ట్ చేయండి. ఉచిత న్యాయ ప్రశ్నోత్తరాలు — ప్రారంభించడానికి ఖాతా అవసరం లేదు.", ar: "صف مشكلتك بلغة بسيطة أو انشر قضية. أسئلة قانونية مجانية — لا حاجة لحساب للبدء.", de: "Beschreiben Sie Ihr Anliegen in einfacher Sprache oder posten Sie einen Fall. Kostenlose Rechtsfragen — kein Konto nötig.", fr: "Décrivez votre problème simplement ou publiez une affaire. Questions juridiques gratuites — sans compte pour démarrer." },
  step2_t: { en: "AI analyzes & matches", es: "La IA analiza y empareja", hi: "AI विश्लेषण और मिलान", te: "AI విశ్లేషణ & మ్యాచ్", ar: "الذكاء الاصطناعي يحلّل ويطابق", de: "KI analysiert & vermittelt", fr: "L’IA analyse et met en relation" },
  step2_d: { en: "Get instant AI guidance and match with Bar-verified advocates, each scored 0–100 for fit.", es: "Recibe orientación IA al instante y conecta con abogados verificados, puntuados de 0 a 100 por idoneidad.", hi: "तुरंत AI मार्गदर्शन पाएं और सत्यापित अधिवक्ताओं से मिलान करें, हर एक 0–100 स्कोर के साथ।", te: "తక్షణ AI మార్గదర్శనం పొందండి మరియు ధ్రువీకరించబడిన న్యాయవాదులతో మ్యాచ్ అవ్వండి, ప్రతి ఒక్కరికి 0–100 స్కోర్.", ar: "احصل على إرشاد فوري بالذكاء الاصطناعي وتطابق مع محامين موثّقين، كلٌّ بدرجة من 0 إلى 100.", de: "Erhalten Sie sofortige KI-Beratung und werden Sie mit verifizierten Anwälten vermittelt — je 0–100 bewertet.", fr: "Obtenez des conseils IA instantanés et soyez mis en relation avec des avocats vérifiés, notés de 0 à 100." },
  step3_t: { en: "Connect & proceed", es: "Conecta y avanza", hi: "जुड़ें और आगे बढ़ें", te: "కనెక్ట్ అయ్యి ముందుకు సాగండి", ar: "تواصل وتابع", de: "Verbinden & fortfahren", fr: "Connectez et avancez" },
  step3_d: { en: "Chat, share documents, track hearings, and keep your case moving forward.", es: "Chatea, comparte documentos, sigue audiencias y mantén tu caso en marcha.", hi: "चैट करें, दस्तावेज़ साझा करें, सुनवाई ट्रैक करें और अपने केस को आगे बढ़ाते रहें।", te: "చాట్ చేయండి, పత్రాలు పంచుకోండి, విచారణలను ట్రాక్ చేయండి మరియు మీ కేసును ముందుకు సాగిస్తూ ఉండండి.", ar: "تحدّث وشارك المستندات وتابع الجلسات وأبقِ قضيتك تتقدّم.", de: "Chatten, Dokumente teilen, Termine verfolgen und Ihren Fall in Bewegung halten.", fr: "Discutez, partagez des documents, suivez les audiences et faites progresser votre affaire." },
  docs_sub: { en: "AI-drafted, ready to fill and file.", es: "Redactados por IA, listos para completar y presentar.", hi: "AI द्वारा तैयार, भरने और दाखिल करने को तैयार।", te: "AI ద్వారా రూపొందించబడింది, పూరించి దాఖలు చేయడానికి సిద్ధం.", ar: "صياغة بالذكاء الاصطناعي، جاهزة للتعبئة والتقديم.", de: "KI-erstellt, zum Ausfüllen und Einreichen bereit.", fr: "Rédigés par IA, prêts à remplir et déposer." },
  lawyers_heading: { en: "Are you an advocate?", es: "¿Eres abogado?", hi: "क्या आप अधिवक्ता हैं?", te: "మీరు న్యాయవాదినా?", ar: "هل أنت محامٍ؟", de: "Sind Sie Anwalt?", fr: "Êtes-vous avocat ?" },
  lawyers_sub: { en: "Build a verified profile, receive AI-matched client requests in your practice areas, and manage cases with instrument-grade tools.", es: "Crea un perfil verificado, recibe solicitudes de clientes emparejadas por IA en tus áreas y gestiona casos con herramientas de precisión.", hi: "सत्यापित प्रोफ़ाइल बनाएं, अपने क्षेत्रों में AI-मिलान वाले क्लाइंट अनुरोध पाएं और बेहतरीन टूल से केस संभालें।", te: "ధ్రువీకరించబడిన ప్రొఫైల్‌ను రూపొందించండి, మీ ప్రాక్టీస్ ఏరియాల్లో AI-మ్యాచ్ క్లయింట్ అభ్యర్థనలను పొందండి మరియు సాధనాలతో కేసులను నిర్వహించండి.", ar: "أنشئ ملفاً موثقاً، واستقبل طلبات عملاء مطابَقة بالذكاء الاصطناعي في مجالات تخصصك، وأدر القضايا بأدوات دقيقة.", de: "Erstellen Sie ein verifiziertes Profil, erhalten Sie KI-vermittelte Mandatsanfragen in Ihren Fachgebieten und verwalten Sie Fälle mit präzisen Werkzeugen.", fr: "Créez un profil vérifié, recevez des demandes de clients mises en relation par IA dans vos domaines et gérez vos affaires avec des outils de précision." },
  lawyers_b1: { en: "Verified profile & Bar badge", es: "Perfil verificado e insignia", hi: "सत्यापित प्रोफ़ाइल और बैज", te: "ధ్రువీకరించబడిన ప్రొఫైల్ & బ్యాడ్జ్", ar: "ملف موثّق وشارة نقابة", de: "Verifiziertes Profil & Abzeichen", fr: "Profil vérifié et badge" },
  lawyers_b2: { en: "AI-matched client requests", es: "Solicitudes de clientes por IA", hi: "AI-मिलान क्लाइंट अनुरोध", te: "AI-మ్యాచ్ క్లయింట్ అభ్యర్థనలు", ar: "طلبات عملاء بالذكاء الاصطناعي", de: "KI-vermittelte Mandate", fr: "Demandes clients via IA" },
  lawyers_b3: { en: "Case & document workspace", es: "Espacio de casos y documentos", hi: "केस और दस्तावेज़ वर्कस्पेस", te: "కేసు & పత్రాల వర్క్‌స్పేస్", ar: "مساحة عمل للقضايا والمستندات", de: "Fall- & Dokumentbereich", fr: "Espace dossiers et documents" },
  lawyers_cta: { en: "Join as an Advocate", es: "Únete como abogado", hi: "अधिवक्ता के रूप में जुड़ें", te: "న్యాయవాదిగా చేరండి", ar: "انضم كمحامٍ", de: "Als Anwalt beitreten", fr: "Rejoindre en tant qu’avocat" },
};

const HOW_STEPS = [
  { num: "01", icon: MessageSquareText, t: "step1_t", d: "step1_d" },
  { num: "02", icon: Sparkles, t: "step2_t", d: "step2_d" },
  { num: "03", icon: Handshake, t: "step3_t", d: "step3_d" },
] as const;

function openPalette() {
  window.dispatchEvent(new Event("lf-open-command-palette"));
}

interface CountryLandingProps {
  countryCode?: string;
}

export default function CountryLanding({ countryCode = "IN" }: CountryLandingProps) {
  const cc = countryCode.toUpperCase();
  const { t, lang } = useLanguage(cc);
  const content = getLandingContent(cc);
  const isRtl = lang === "ar";
  const tr = (key: string) => {
    const g = L[key];
    return (g && (g[lang] || g.en)) || key;
  };
  const arrow = `w-4 h-4 ${isRtl ? "rotate-180" : ""}`;

  const navLinks = [
    { href: "/ask", label: tr("nav_ask"), testid: "link-nav-ask" },
    { href: "/free-documents", label: tr("nav_documents"), testid: "link-nav-documents" },
    { href: "/lawyers", label: tr("nav_find_lawyer"), testid: "link-nav-find-lawyer" },
    { href: "/register?role=lawyer", label: tr("nav_for_lawyers"), testid: "link-nav-for-lawyers" },
  ];

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      dir={isRtl ? "rtl" : "ltr"}
      data-testid="country-landing"
    >
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0" data-testid="link-home">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <Scale className="w-4 h-4 text-primary-foreground" />
            </span>
            <span>LitigaForge AI</span>
          </Link>

          {/* Desktop public discovery nav */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            {navLinks.map((l) => (
              <Link
                key={l.testid}
                href={l.href}
                className="px-3 py-2 rounded-lg hover:bg-secondary/70 transition"
                data-testid={l.testid}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openPalette}
              className="hidden sm:inline-flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card text-xs text-muted-foreground hover:border-primary/40 transition"
              data-testid="button-command-palette"
              aria-label={tr("search")}
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{tr("search")}</span>
              <kbd className="cfos-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-secondary/60">⌘K</kbd>
            </button>
            <LanguageSwitcher countryCode={cc} />
            <CountrySwitcher />
            <Link
              href="/login"
              className="inline-flex text-sm font-semibold px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
              data-testid="link-signin"
            >
              {t.login}
            </Link>
          </div>
        </div>

        {/* Mobile discovery row — horizontal scroll of public links */}
        <div className="md:hidden border-t border-border/70 overflow-x-auto">
          <div className="flex items-center gap-1 px-4 py-2 whitespace-nowrap text-sm font-medium">
            {navLinks.map((l) => (
              <Link
                key={`m-${l.testid}`}
                href={l.href}
                className="px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:border-primary/40 transition"
                data-testid={`${l.testid}-mobile`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* ── 1. HERO ── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 pt-12 md:pt-16 pb-10 md:pb-14">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            {/* Left — copy */}
            <div className="text-center lg:text-start">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card/70">
                <span className="cfos-live-dot" />
                <span className="cfos-docket">{tr("eyebrow")}</span>
              </span>

              <div className="text-5xl md:text-6xl mt-5 mb-3" data-testid="hero-flag">{content.flag}</div>

              <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight" data-testid="hero-title">
                {t.hero_title}
              </h1>
              <p className="text-muted-foreground text-base md:text-lg mt-4 max-w-xl mx-auto lg:mx-0" data-testid="hero-sub">
                {t.hero_sub}
              </p>

              {/* Outcome benefit chips */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-5">
                <Chip>{tr("benefit_free")}</Chip>
                <Chip>{tr("benefit_verified")}</Chip>
                <Chip>{tr("benefit_instant")}</Chip>
              </div>

              {/* CTAs — primary = Ask (free), secondary = Post a case */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-7">
                <Link
                  href="/ask"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition shadow-lg shadow-primary/20"
                  data-testid="button-ask-ai"
                >
                  <Sparkles className="w-4 h-4" /> {tr("ask_free")}
                </Link>
                <Link
                  href="/post-case"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-border bg-card font-semibold hover:border-primary/40 transition"
                  data-testid="button-get-started"
                >
                  {t.post_case} <ArrowRight className={arrow} />
                </Link>
              </div>
              <p className="text-xs text-muted-foreground mt-3">{tr("hero_micro")}</p>
            </div>

            {/* Right — illustrative case-file dossier */}
            <div className="relative">
              <MarginRuleCard
                tab={<span>{tr("sample_label")}</span>}
                live
                liveLabel={tr("ai_live")}
                className="max-w-md mx-auto"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="cfos-docket text-muted-foreground">{tr("matter_label")}</div>
                    <div className="font-bold text-lg leading-snug">{tr("sample_matter")}</div>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <Chip>
                        <MapPin className="w-3 h-3" />
                        <span>{tr("sample_court")}</span>
                      </Chip>
                      <Chip>{tr("next_hearing")}: ·····</Chip>
                    </div>
                  </div>
                  <ScoreRing score={92} size={92} showLabel={false} data-testid="hero-score-ring" />
                </div>

                <div className="my-4 border-t border-border/70" />

                <div className="flex items-center justify-between gap-3">
                  <Stamp>{tr("bar_verified")}</Stamp>
                  <span className="cfos-docket text-muted-foreground">{tr("illustrative")}</span>
                </div>
              </MarginRuleCard>
            </div>
          </div>

          {/* Social proof — real counts, zero-safe */}
          <div className="mt-10 md:mt-12 max-w-2xl mx-auto lg:mx-0">
            <SocialProofBar countryCode={cc} />
            {/* Static, defensible trust signals (no fabricated claims) */}
            <div className="mt-5">
              <TrustStrip countryCode={cc} />
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-14 md:py-16 space-y-16">
        {/* ── 2. HOW IT WORKS (before pricing) ── */}
        <section data-testid="section-how-it-works">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold" data-testid="how-it-works-heading">{tr("how_heading")}</h2>
            <p className="text-muted-foreground mt-2">{tr("how_sub")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {HOW_STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <PaperSurface
                  key={s.num}
                  elevation={1}
                  className="p-6 flex flex-col gap-3"
                  data-testid={`how-step-${s.num}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="cfos-mono text-3xl font-bold" style={{ color: "hsl(var(--cfos-gold))" }}>{s.num}</span>
                  </div>
                  <div className="cfos-docket text-muted-foreground">{tr("step_label")} {s.num}</div>
                  <h3 className="font-semibold text-lg leading-snug">{tr(s.t)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tr(s.d)}</p>
                </PaperSurface>
              );
            })}
          </div>
        </section>

        {/* ── 3. PAIN POINTS GRID ── */}
        <PainPointsGrid countryCode={cc} />

        {/* ── 4. TOP DOCUMENTS ── */}
        <section data-testid="section-top-documents">
          <div className="flex items-end justify-between mb-6 gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">{t.docs_heading}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tr("docs_sub")}</p>
            </div>
            <Link
              href="/free-documents"
              className="text-sm font-semibold text-primary hover:underline whitespace-nowrap inline-flex items-center gap-1"
              data-testid="link-all-documents"
            >
              {t.documents} <ArrowRight className={arrow} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 snap-x">
            {content.topDocuments.map((doc) => (
              <Link
                key={doc}
                href="/free-documents"
                className="snap-start shrink-0 w-44 flex flex-col gap-3 p-4 rounded-2xl border border-border bg-card cfos-elev-1 hover:border-primary/40 transition"
                data-testid={`document-${doc.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-semibold leading-snug">{doc}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 5. EMERGENCY HELPLINE ── */}
        <PaperSurface
          elevation={2}
          className="p-5 md:p-6 flex items-center gap-4 border-emerald-500/30"
          data-testid="section-emergency"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Phone className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="cfos-docket text-muted-foreground">{t.emergency_label}</p>
            <p className="text-base md:text-lg font-bold cfos-mono" data-testid="emergency-number">{t.emergency_number}</p>
          </div>
        </PaperSurface>

        {/* ── 6. PRICING ── */}
        <PricingSection countryCode={cc} />

        {/* ── 7. FOR LAWYERS ── */}
        <section
          className="rounded-3xl bg-primary text-primary-foreground p-8 md:p-12 overflow-hidden relative"
          data-testid="section-for-lawyers"
        >
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="cfos-docket" style={{ color: "hsl(var(--cfos-gold))" }}>{tr("nav_for_lawyers")}</span>
              <h2 className="text-2xl md:text-3xl font-bold mt-2">{tr("lawyers_heading")}</h2>
              <p className="text-primary-foreground/80 mt-3 max-w-md">{tr("lawyers_sub")}</p>
              <Link
                href="/register?role=lawyer"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[hsl(var(--cfos-gold))] text-primary font-semibold hover:opacity-90 transition mt-6"
                data-testid="button-for-lawyers"
              >
                {tr("lawyers_cta")} <ArrowRight className={arrow} />
              </Link>
            </div>
            <ul className="flex flex-col gap-3">
              {["lawyers_b1", "lawyers_b2", "lawyers_b3"].map((k) => (
                <li key={k} className="flex items-center gap-3 rounded-xl bg-primary-foreground/10 px-4 py-3">
                  <Check className="w-5 h-5 shrink-0" style={{ color: "hsl(var(--cfos-gold))" }} />
                  <span className="font-medium">{tr(k)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 8. FINAL CTA ── */}
        <section
          className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-12 text-center"
          data-testid="section-cta"
        >
          <h2 className="text-2xl md:text-3xl font-bold max-w-2xl mx-auto" data-testid="cta-title">
            {t.join_title}
          </h2>
          <p className="text-muted-foreground mt-3">{t.join_sub}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition shadow-lg shadow-primary/20"
              data-testid="button-sign-up"
            >
              {t.sign_up} <ArrowRight className={arrow} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-border bg-card font-semibold hover:border-primary/40 transition"
              data-testid="button-login"
            >
              {t.login}
            </Link>
          </div>
        </section>
      </div>

      {/* FOOTER — consistent with the in-app shell */}
      <LegalDisclaimerFooter />
    </div>
  );
}
