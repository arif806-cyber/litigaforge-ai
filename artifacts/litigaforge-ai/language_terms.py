"""Small, conservative legal-term glossary for reading-aid translations."""

_TERMS = {
    "hi": {"vakalat": "वकालतनामा", "injunction": "निषेधाज्ञा", "ex parte": "एकपक्षीय",
           "adjournment": "स्थगन", "interim order": "अंतरिम आदेश"},
    "te": {"vakalat": "వకాలత్‌నామా", "injunction": "నిషేధాజ్ఞ", "ex parte": "ఏకపక్ష",
           "adjournment": "వాయిదా", "interim order": "మధ్యంతర ఉత్తర్వు"},
    "ta": {"vakalat": "வக்காலத்து", "injunction": "தடை உத்தரவு", "ex parte": "ஒருதலைப்பட்ச",
           "adjournment": "ஒத்திவைப்பு", "interim order": "இடைக்கால உத்தரவு"},
    "kn": {"vakalat": "ವಕಾಲತ್ತು", "injunction": "ತಡೆಯಾಜ್ಞೆ", "ex parte": "ಏಕಪಕ್ಷೀಯ",
           "adjournment": "ಮುಂದೂಡಿಕೆ", "interim order": "ಮಧ್ಯಂತರ ಆದೇಶ"},
    "mr": {"vakalat": "वकालनामा", "injunction": "प्रतिबंधक आदेश", "ex parte": "एकतर्फी",
           "adjournment": "तहकूब", "interim order": "अंतरिम आदेश"},
    "ml": {"vakalat": "വക്കാലത്ത്", "injunction": "നിരോധനാജ്ഞ", "ex parte": "ഏകപക്ഷീയ",
           "adjournment": "മാറ്റിവയ്ക്കൽ", "interim order": "ഇടക്കാല ഉത്തരവ്"},
    "bn": {"vakalat": "ওকালতনামা", "injunction": "নিষেধাজ্ঞা", "ex parte": "একতরফা",
           "adjournment": "মুলতবি", "interim order": "অন্তর্বর্তী আদেশ"},
    "gu": {"vakalat": "વકાલતનામું", "injunction": "મનાઈ હુકમ", "ex parte": "એકપક્ષીય",
           "adjournment": "મુલતવી", "interim order": "વચગાળાનો હુકમ"},
    "pa": {"vakalat": "ਵਕਾਲਤਨਾਮਾ", "injunction": "ਰੋਕ ਦਾ ਹੁਕਮ", "ex parte": "ਇਕਪਾਸੜ",
           "adjournment": "ਮੁਲਤਵੀ", "interim order": "ਅੰਤਰਿਮ ਹੁਕਮ"},
    "or": {"vakalat": "ଓକିଲନାମା", "injunction": "ନିଷେଧାଜ୍ଞା", "ex parte": "ଏକପାଖିଆ",
           "adjournment": "ମୁଲତବୀ", "interim order": "ଅନ୍ତରୀଣ ଆଦେଶ"},
    "ur": {"vakalat": "وکالت نامہ", "injunction": "حکم امتناعی", "ex parte": "یک طرفہ",
           "adjournment": "التوا", "interim order": "عبوری حکم"},
}


def legal_glossary(language: str) -> dict[str, str]:
    return _TERMS.get(language, {})
