export type Lang = "en" | "te" | "hi";

export interface WS {
  // Brand
  brand:            string;
  brandSub:         string;
  // Toolbar
  newWorkspace:     string;
  addNode:          string;
  save:             string;
  saving:           string;
  undo:             string;
  redo:             string;
  nodesBadge:       (n: number) => string;
  // Right-panel tabs
  tabFiles:         string;
  tabSearch:        string;
  tabIntel:         string;
  tabSim:           string;
  tabTwin:          string;
  // Node presets
  nodeJudgment:     string;
  nodeFact:         string;
  nodeIssue:        string;
  nodeArgument:     string;
  nodeRisk:         string;
  nodeStrategy:     string;
  // Stats footer
  statNodes:        string;
  statEdges:        string;
  statAgents:       string;
  // Sessions
  noSessions:       string;
  // Welcome — no session
  welcomeTitle:     string;
  welcomeSub:       string;
  createFirst:      string;
  demoBtn:          string;
  // Welcome — empty canvas
  emptyTitle:       string;
  emptySub:         string;
  step1:            string;
  step1d:           string;
  step2:            string;
  step2d:           string;
  step3:            string;
  step3d:           string;
  // Agent panel
  descPlaceholder:  string;
  runAnalysis:      string;
  analyzing:        string;
}

export const STRINGS: Record<Lang, WS> = {
  en: {
    brand:           "FORGE",
    brandSub:        "WORKSPACE",
    newWorkspace:    "+ New Workspace",
    addNode:         "+ Add Node ▾",
    save:            "💾 Save",
    saving:          "Saving…",
    undo:            "↩ Undo",
    redo:            "↪ Redo",
    nodesBadge:      n => `${n} node${n !== 1 ? "s" : ""}`,
    tabFiles:        "📁 Files",
    tabSearch:       "🔍 Search",
    tabIntel:        "✦ Intel",
    tabSim:          "⚡ Sim",
    tabTwin:         "🧬 Twin",
    nodeJudgment:    "New Judgment",
    nodeFact:        "New Fact",
    nodeIssue:       "Legal Issue",
    nodeArgument:    "Argument",
    nodeRisk:        "Risk Factor",
    nodeStrategy:    "Strategy",
    statNodes:       "Nodes",
    statEdges:       "Edges",
    statAgents:      "Agents",
    noSessions:      "No workspaces yet",
    welcomeTitle:    "Welcome to Forge Workspace",
    welcomeSub:      "Legal Intelligence Operating System for Telangana & AP",
    createFirst:     "Create Your First Workspace",
    demoBtn:         "⚖️ Try Demo: Family Pension Matter",
    emptyTitle:      "Your canvas is empty",
    emptySub:        "Build your case strategy, visually",
    step1:           "Describe Case",
    step1d:          "Summarise your legal matter in the panel on the left",
    step2:           "Run AI Agents",
    step2d:          "5 specialist agents analyse precedents, risks & strategy",
    step3:           "Explore Canvas",
    step3d:          "Add judgments, connect arguments, simulate outcomes",
    descPlaceholder: "Describe your case, issues, and legal arguments…",
    runAnalysis:     "⚡ Run AI Analysis",
    analyzing:       "Analysing…",
  },

  te: {
    brand:           "ఫోర్జ్",
    brandSub:        "వర్క్‌స్పేస్",
    newWorkspace:    "+ కొత్త వర్క్‌స్పేస్",
    addNode:         "+ నోడ్ జోడించు ▾",
    save:            "💾 సేవ్ చేయి",
    saving:          "సేవ్ అవుతోంది…",
    undo:            "↩ రద్దు",
    redo:            "↪ మళ్ళీ",
    nodesBadge:      n => `${n} నోడ్లు`,
    tabFiles:        "📁 ఫైళ్ళు",
    tabSearch:       "🔍 వెతుకు",
    tabIntel:        "✦ విశ్లేషణ",
    tabSim:          "⚡ అనుకరణ",
    tabTwin:         "🧬 ట్విన్",
    nodeJudgment:    "కొత్త తీర్పు",
    nodeFact:        "కొత్త వాస్తవం",
    nodeIssue:       "న్యాయ సమస్య",
    nodeArgument:    "వాదన",
    nodeRisk:        "ప్రమాద అంశం",
    nodeStrategy:    "వ్యూహం",
    statNodes:       "నోడ్లు",
    statEdges:       "అనుసంధానాలు",
    statAgents:      "ఏజెంట్లు",
    noSessions:      "ఇంకా వర్క్‌స్పేస్‌లు లేవు",
    welcomeTitle:    "ఫోర్జ్ వర్క్‌స్పేస్‌కు స్వాగతం",
    welcomeSub:      "తెలంగాణ & ఆంధ్రప్రదేశ్ కోసం న్యాయ AI వ్యవస్థ",
    createFirst:     "మొదటి వర్క్‌స్పేస్ సృష్టించు",
    demoBtn:         "⚖️ డెమో చూడండి: కుటుంబ పెన్షన్ కేసు",
    emptyTitle:      "మీ కాన్వాస్ ఖాళీగా ఉంది",
    emptySub:        "మీ కేసు వ్యూహాన్ని దృశ్యంగా నిర్మించండి",
    step1:           "కేసు వివరించు",
    step1d:          "ఎడమ పానెల్‌లో మీ కేసు వివరాలు నమోదు చేయండి",
    step2:           "AI ఏజెంట్లు నడపండి",
    step2d:          "5 నిపుణ ఏజెంట్లు తీర్పులు, రిస్కులు & వ్యూహాన్ని విశ్లేషిస్తారు",
    step3:           "కాన్వాస్ అన్వేషించు",
    step3d:          "తీర్పు నోడ్లు జోడించి, వాదనలు కనెక్ట్ చేసి, ఫలితాలు అనుకరించు",
    descPlaceholder: "మీ కేసు, న్యాయ సమస్యలు మరియు వాదనలను వివరించండి…",
    runAnalysis:     "⚡ AI విశ్లేషణ చేయి",
    analyzing:       "విశ్లేషిస్తోంది…",
  },

  hi: {
    brand:           "फोर्ज",
    brandSub:        "वर्कस्पेस",
    newWorkspace:    "+ नया वर्कस्पेस",
    addNode:         "+ नोड जोड़ें ▾",
    save:            "💾 सेव करें",
    saving:          "सेव हो रहा है…",
    undo:            "↩ पूर्ववत्",
    redo:            "↪ फिर से",
    nodesBadge:      n => `${n} नोड`,
    tabFiles:        "📁 फ़ाइलें",
    tabSearch:       "🔍 खोजें",
    tabIntel:        "✦ विश्लेषण",
    tabSim:          "⚡ सिमुलेशन",
    tabTwin:         "🧬 ट्विन",
    nodeJudgment:    "नया निर्णय",
    nodeFact:        "नया तथ्य",
    nodeIssue:       "कानूनी मुद्दा",
    nodeArgument:    "तर्क",
    nodeRisk:        "जोखिम कारक",
    nodeStrategy:    "रणनीति",
    statNodes:       "नोड",
    statEdges:       "किनारे",
    statAgents:      "एजेंट",
    noSessions:      "अभी कोई वर्कस्पेस नहीं",
    welcomeTitle:    "फोर्ज वर्कस्पेस में आपका स्वागत है",
    welcomeSub:      "तेलंगाना और आंध्र प्रदेश के लिए कानूनी AI प्रणाली",
    createFirst:     "पहला वर्कस्पेस बनाएं",
    demoBtn:         "⚖️ डेमो: परिवार पेंशन मामला",
    emptyTitle:      "आपका कैनवास खाली है",
    emptySub:        "अपनी केस रणनीति को दृश्य रूप से बनाएं",
    step1:           "मामला बताएं",
    step1d:          "बाईं तरफ अपने कानूनी मामले का विवरण दें",
    step2:           "AI एजेंट चलाएं",
    step2d:          "5 विशेषज्ञ एजेंट निर्णय, जोखिम व रणनीति का विश्लेषण करेंगे",
    step3:           "कैनवास एक्सप्लोर करें",
    step3d:          "निर्णय नोड जोड़ें, तर्क जोड़ें, परिणाम अनुकरण करें",
    descPlaceholder: "अपने मामले, कानूनी मुद्दे और तर्क बताएं…",
    runAnalysis:     "⚡ AI विश्लेषण चलाएं",
    analyzing:       "विश्लेषण हो रहा है…",
  },
};

// ─── Language toggle component ─────────────────────────────────────────────────

const LANG_LABELS: Record<Lang, { short: string; full: string }> = {
  en: { short: "EN", full: "English" },
  te: { short: "తె",  full: "తెలుగు"  },
  hi: { short: "हि",  full: "हिंदी"   },
};

interface LangToggleProps {
  lang:    Lang;
  setLang: (l: Lang) => void;
}

export function LangToggle({ lang, setLang }: LangToggleProps) {
  return (
    <div
      title="Switch language / భాష మార్చు / भाषा बदलें"
      style={{
        display: "flex",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 7,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {(["en", "te", "hi"] as Lang[]).map((l, i) => (
        <button
          key={l}
          onClick={() => {
            setLang(l);
            try { localStorage.setItem("forge_lang", l); } catch { /* noop */ }
          }}
          title={LANG_LABELS[l].full}
          style={{
            padding: "5px 9px",
            background: lang === l
              ? "linear-gradient(135deg, rgba(20,184,166,0.25), rgba(14,116,144,0.2))"
              : "transparent",
            border: "none",
            borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
            color: lang === l ? "#14b8a6" : "#475569",
            fontSize: l === "en" ? 9.5 : 11,
            fontWeight: lang === l ? 800 : 600,
            cursor: "pointer",
            transition: "all 0.15s",
            lineHeight: 1,
          }}
        >
          {LANG_LABELS[l].short}
        </button>
      ))}
    </div>
  );
}

// ─── Utility ───────────────────────────────────────────────────────────────────

export function getInitialLang(): Lang {
  try {
    const stored = localStorage.getItem("forge_lang");
    if (stored === "en" || stored === "te" || stored === "hi") return stored;
  } catch { /* noop */ }
  return "en";
}
