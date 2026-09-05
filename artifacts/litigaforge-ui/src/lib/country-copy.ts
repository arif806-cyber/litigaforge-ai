/**
 * Country-aware page copy helpers.
 * Use activeCode (e.g. "IN", "US") to get localized titles, descriptions, and text.
 */

export interface PageCopy {
  title: string;
  description?: string;
  subtitle?: string;
  keywords?: string;
}

const COUNTRY_NAME: Record<string, string> = {
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  AE: "UAE",
  AU: "Australia",
  CA: "Canada",
  SG: "Singapore",
  DE: "Germany",
};

export function getCountryName(code: string): string {
  return COUNTRY_NAME[code.toUpperCase()] ?? "Global";
}

/* ── SEOHelmet defaults ─────────────────────────────────────────────────────── */

export function defaultTitle(code: string): string {
  const name = getCountryName(code);
  if (code.toUpperCase() === "IN") {
    return "LitigaForge AI \u2013 Find Lawyers & Legal Help in India";
  }
  if (code.toUpperCase() === "DE") {
    return "LitigaForge AI \u2013 KI-Rechtshilfe in Deutschland";
  }
  return `LitigaForge AI \u2013 AI Legal Help for ${name}`;
}

export function defaultDescription(code: string): string {
  const name = getCountryName(code);
  if (code.toUpperCase() === "IN") {
    return "AI-powered legal platform connecting clients with verified advocates in India. Get legal information, document analysis, and case matching.";
  }
  if (code.toUpperCase() === "DE") {
    return "KI-gest\u00fctzte Rechtsplattform. Verbinden Sie sich mit verifizierten Anw\u00e4lten, analysieren Sie Dokumente und erhalten Sie sofortige Rechtsberatung.";
  }
  return `AI-powered legal information platform for ${name}. Analyze documents, research legal issues, and browse the advocate directory.`;
}

/* ── Page-specific copy ──────────────────────────────────────────────────────── */

export const ASK_COPY: Record<string, PageCopy> = {
  IN: { title: "Legal Q&A \u2013 Free legal information", description: "Ask any legal question about Indian law. AI provides legal information. Property, family, criminal, GST, labour, consumer, and more.", subtitle: "Ask any legal question about Indian law. AI provides legal information.", keywords: "legal questions India, free legal information, property law, family law, criminal law, GST" },
  US: { title: "Legal Q&A \u2013 Free legal information", description: "Ask any legal question about US law. AI provides legal information. Employment, family, immigration, contracts, and more.", subtitle: "Ask any legal question about US law. AI provides legal information.", keywords: "legal questions US, free legal information, employment law, family law, immigration" },
  GB: { title: "Legal Q&A \u2013 Free legal information", description: "Ask any legal question about UK law. AI provides legal information. Property, family, criminal, employment, and more.", subtitle: "Ask any legal question about UK law. AI provides legal information.", keywords: "legal questions UK, free legal information, property law, family law, criminal law" },
  AE: { title: "Legal Q&A \u2013 Free legal information", description: "Ask any legal question about UAE law. AI provides legal information. Labour, tenancy, business, family, and more.", subtitle: "Ask any legal question about UAE law. AI provides legal information.", keywords: "legal questions UAE, free legal information, labour law, tenancy, business law" },
  AU: { title: "Legal Q&A \u2013 Free legal information", description: "Ask any legal question about Australian law. AI provides legal information. Property, family, criminal, employment, and more.", subtitle: "Ask any legal question about Australian law. AI provides legal information.", keywords: "legal questions Australia, free legal information, property law, family law, criminal law" },
  CA: { title: "Legal Q&A \u2013 Free legal information", description: "Ask any legal question about Canadian law. AI provides legal information. Property, family, immigration, employment, and more.", subtitle: "Ask any legal question about Canadian law. AI provides legal information.", keywords: "legal questions Canada, free legal information, property law, family law, immigration" },
  SG: { title: "Legal Q&A \u2013 Free legal information", description: "Ask any legal question about Singapore law. AI provides legal information. Property, family, employment, business, and more.", subtitle: "Ask any legal question about Singapore law. AI provides legal information.", keywords: "legal questions Singapore, free legal information, property law, family law, employment" },
  DE: { title: "Rechtsfragen \u2013 Kostenlose Rechtsberatung", description: "Stellen Sie jede Rechtsfrage zum deutschen Recht. KI beantwortet sofort. Mietrecht, Familienrecht, Arbeitsrecht und mehr.", subtitle: "Stellen Sie jede Rechtsfrage zum deutschen Recht. KI beantwortet sofort.", keywords: "Rechtsfragen Deutschland, kostenlose Rechtsberatung, Mietrecht, Familienrecht, Arbeitsrecht" },
};

export const LEGAL_CHAT_COPY: Record<string, { welcome: string; prompt: string }> = {
  IN: {
    welcome: "Hello! I am LitigaForge AI, your legal assistant for India.\n\nI can help you with:\n- Drafting legal notices, agreements, and petitions\n- Explaining procedural steps\n- Analyzing case scenarios\n- Citing relevant Indian laws\n\nSelect a template below or type your question.\n\n---\n*This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice.*",
    prompt: "Draft a formal legal notice for [describe issue]. Include all necessary sections under Indian law.",
  },
  US: {
    welcome: "Hello! I am LitigaForge AI, your legal assistant for the United States.\n\nI can help you with:\n- Drafting legal notices, demand letters, and contracts\n- Explaining procedural steps\n- Analyzing case scenarios\n- Citing relevant federal and state laws\n\nSelect a template below or type your question.\n\n---\n*This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice.*",
    prompt: "Draft a formal legal notice or demand letter for [describe issue]. Include all necessary sections under US law.",
  },
  GB: {
    welcome: "Hello! I am LitigaForge AI, your legal assistant for the United Kingdom.\n\nI can help you with:\n- Drafting legal notices, letters before action, and contracts\n- Explaining court procedures\n- Analyzing case scenarios\n- Citing relevant UK statutes and case law\n\nSelect a template below or type your question.\n\n---\n*This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice.*",
    prompt: "Draft a letter before action or formal notice for [describe issue]. Include all necessary sections under UK law.",
  },
  AE: {
    welcome: "Hello! I am LitigaForge AI, your legal assistant for the UAE.\n\nI can help you with:\n- Drafting legal notices and contracts\n- Explaining UAE court procedures\n- Analyzing case scenarios\n- Citing relevant UAE federal laws and DIFC/DIFC regulations\n\nSelect a template below or type your question.\n\n---\n*This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice.*",
    prompt: "Draft a formal legal notice for [describe issue]. Include all necessary sections under UAE law.",
  },
  AU: {
    welcome: "Hello! I am LitigaForge AI, your legal assistant for Australia.\n\nI can help you with:\n- Drafting legal notices and contracts\n- Explaining court procedures\n- Analyzing case scenarios\n- Citing relevant Australian statutes and case law\n\nSelect a template below or type your question.\n\n---\n*This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice.*",
    prompt: "Draft a formal legal notice or letter of demand for [describe issue]. Include all necessary sections under Australian law.",
  },
  CA: {
    welcome: "Hello! I am LitigaForge AI, your legal assistant for Canada.\n\nI can help you with:\n- Drafting legal notices and contracts\n- Explaining court procedures\n- Analyzing case scenarios\n- Citing relevant Canadian statutes and case law\n\nSelect a template below or type your question.\n\n---\n*This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice.*",
    prompt: "Draft a formal legal notice or demand letter for [describe issue]. Include all necessary sections under Canadian law.",
  },
  SG: {
    welcome: "Hello! I am LitigaForge AI, your legal assistant for Singapore.\n\nI can help you with:\n- Drafting legal notices and contracts\n- Explaining court procedures\n- Analyzing case scenarios\n- Citing relevant Singapore statutes and case law\n\nSelect a template below or type your question.\n\n---\n*This platform only connects users. Final attorney-client relationship is directly between client and lawyer. We are not providing legal advice.*",
    prompt: "Draft a formal legal notice or letter of demand for [describe issue]. Include all necessary sections under Singapore law.",
  },
  DE: {
    welcome: "Hallo! Ich bin LitigaForge AI, Ihr Rechtsassistent f\u00fcr Deutschland.\n\nIch kann Ihnen helfen bei:\n- Entwurf von rechtlichen Mahnungen und Vertr\u00e4gen\n- Erkl\u00e4rung gerichtlicher Verfahren\n- Analyse von Fallkonstellationen\n- Zitierung relevanter deutscher Gesetze\n\nW\u00e4hlen Sie eine Vorlage oder stellen Sie Ihre Frage.\n\n---\n*Diese Plattform vermittelt nur Kontakte. Die Anwalt-Mandant-Beziehung entsteht direkt zwischen Mandant und Anwalt. Wir erbringen keine Rechtsberatung.*",
    prompt: "Entwerfen Sie eine formelle Mahnung oder Rechtsmittelbelehrung f\u00fcr [Beschreiben Sie das Problem]. Ber\u00fccksichtigen Sie alle notwendigen Abschnitte nach deutschem Recht.",
  },
};

export const BLOG_COPY: Record<string, { title: string; description: string; subtitle: string; keywords: string }> = {
  IN: { title: "Free Legal Articles for India", description: "Free legal guides covering property disputes, consumer rights, free legal aid, eCourts case tracking, and RERA in India.", subtitle: "Plain-language guides on property law, consumer rights, free legal aid, court procedures, and more \u2014 focused on India.", keywords: "legal guides India, legal articles, property law guide, consumer rights India, free legal aid guide, eCourts how to" },
  US: { title: "Free Legal Articles for the US", description: "Free legal guides covering property disputes, consumer rights, employment law, immigration, and civil procedures in the United States.", subtitle: "Plain-language guides on property law, consumer rights, employment law, immigration, and more \u2014 focused on the United States.", keywords: "legal guides US, legal articles, property law guide, consumer rights US, employment law, immigration guide" },
  GB: { title: "Free Legal Articles for the UK", description: "Free legal guides covering property disputes, consumer rights, employment law, immigration, and civil procedures in the United Kingdom.", subtitle: "Plain-language guides on property law, consumer rights, employment law, and more \u2014 focused on the United Kingdom.", keywords: "legal guides UK, legal articles, property law guide, consumer rights UK, employment law" },
  AE: { title: "Free Legal Articles for the UAE", description: "Free legal guides covering property disputes, tenancy law, employment law, business setup, and civil procedures in the UAE.", subtitle: "Plain-language guides on property law, tenancy, employment law, and more \u2014 focused on the UAE.", keywords: "legal guides UAE, legal articles, property law guide, tenancy law UAE, employment law UAE" },
  AU: { title: "Free Legal Articles for Australia", description: "Free legal guides covering property disputes, consumer rights, employment law, family law, and civil procedures in Australia.", subtitle: "Plain-language guides on property law, consumer rights, employment law, and more \u2014 focused on Australia.", keywords: "legal guides Australia, legal articles, property law guide, consumer rights Australia, employment law" },
  CA: { title: "Free Legal Articles for Canada", description: "Free legal guides covering property disputes, consumer rights, immigration, employment law, and civil procedures in Canada.", subtitle: "Plain-language guides on property law, consumer rights, immigration, and more \u2014 focused on Canada.", keywords: "legal guides Canada, legal articles, property law guide, consumer rights Canada, immigration law" },
  SG: { title: "Free Legal Articles for Singapore", description: "Free legal guides covering property disputes, employment law, business law, family law, and civil procedures in Singapore.", subtitle: "Plain-language guides on property law, employment law, business law, and more \u2014 focused on Singapore.", keywords: "legal guides Singapore, legal articles, property law guide, employment law Singapore, business law" },
  DE: { title: "Kostenlose Rechtsartikel f\u00fcr Deutschland", description: "Kostenlose Rechtsratgeber zu Mietrecht, Verbraucherrechten, Arbeitsrecht, Familienrecht und Zivilverfahren in Deutschland.", subtitle: "Leicht verst\u00e4ndliche Ratgeber zu Mietrecht, Verbraucherrechten, Arbeitsrecht und mehr \u2014 fokussiert auf Deutschland.", keywords: "Rechtsratgeber Deutschland, Rechtsartikel, Mietrecht Guide, Verbraucherrechte Deutschland, Arbeitsrecht" },
};

export const TERMS_COPY: Record<string, { description: string; about: string; jurisdiction: string }> = {
  IN: {
    description: "LitigaForge AI Terms of Service \u2014 the rules and conditions for using our platform to connect with verified advocates in India.",
    about: "LitigaForge AI is a legal-technology marketplace that connects clients with verified advocates registered with the Bar Councils of India. We also provide AI-assisted legal information tools.",
    jurisdiction: "Any disputes shall be subject to the exclusive jurisdiction of the courts at Hyderabad, Telangana.",
  },
  US: {
    description: "LitigaForge AI Terms of Service \u2014 the rules and conditions for using our platform to connect with verified attorneys in the United States.",
    about: "LitigaForge AI is a legal-technology marketplace that connects clients with verified attorneys licensed in the United States. We also provide AI-assisted legal information tools.",
    jurisdiction: "Any disputes shall be subject to the exclusive jurisdiction of the courts in the State of California.",
  },
  GB: {
    description: "LitigaForge AI Terms of Service \u2014 the rules and conditions for using our platform to connect with verified solicitors in the United Kingdom.",
    about: "LitigaForge AI is a legal-technology marketplace that connects clients with verified solicitors and barristers in the United Kingdom. We also provide AI-assisted legal information tools.",
    jurisdiction: "Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.",
  },
  AE: {
    description: "LitigaForge AI Terms of Service \u2014 the rules and conditions for using our platform to connect with verified legal consultants in the UAE.",
    about: "LitigaForge AI is a legal-technology marketplace that connects clients with verified legal consultants and advocates in the UAE. We also provide AI-assisted legal information tools.",
    jurisdiction: "Any disputes shall be subject to the exclusive jurisdiction of the courts of Dubai, UAE.",
  },
  AU: {
    description: "LitigaForge AI Terms of Service \u2014 the rules and conditions for using our platform to connect with verified solicitors in Australia.",
    about: "LitigaForge AI is a legal-technology marketplace that connects clients with verified solicitors in Australia. We also provide AI-assisted legal information tools.",
    jurisdiction: "Any disputes shall be subject to the exclusive jurisdiction of the courts of New South Wales, Australia.",
  },
  CA: {
    description: "LitigaForge AI Terms of Service \u2014 the rules and conditions for using our platform to connect with verified lawyers in Canada.",
    about: "LitigaForge AI is a legal-technology marketplace that connects clients with verified lawyers in Canada. We also provide AI-assisted legal information tools.",
    jurisdiction: "Any disputes shall be subject to the exclusive jurisdiction of the courts of Ontario, Canada.",
  },
  SG: {
    description: "LitigaForge AI Terms of Service \u2014 the rules and conditions for using our platform to connect with verified advocates in Singapore.",
    about: "LitigaForge AI is a legal-technology marketplace that connects clients with verified advocates in Singapore. We also provide AI-assisted legal information tools.",
    jurisdiction: "Any disputes shall be subject to the exclusive jurisdiction of the courts of Singapore.",
  },
  DE: {
    description: "LitigaForge AI Nutzungsbedingungen \u2014 die Regeln und Bedingungen f\u00fcr die Nutzung unserer Plattform zur Verbindung mit verifizierten Anw\u00e4lten in Deutschland.",
    about: "LitigaForge AI ist ein Rechtstechnologie-Marktplatz, der Mandanten mit verifizierten Anw\u00e4lten in Deutschland verbindet. Wir bieten auch KI-gest\u00fctzte Rechtsinformationstools.",
    jurisdiction: "Streitigkeiten unterliegen der ausschlie\u00dflichen Zust\u00e4ndigkeit der Gerichte in Berlin, Deutschland.",
  },
};

export const PRIVACY_COPY: Record<string, { description: string; about: string }> = {
  IN: {
    description: "LitigaForge AI Privacy Policy \u2014 how we collect, use and protect your personal data under the Digital Personal Data Protection Act 2023.",
    about: "LitigaForge AI is a legal-technology platform connecting clients with verified advocates in India. We are the Data Fiduciary under the DPDP Act 2023 for all personal data processed on this platform.",
  },
  US: {
    description: "LitigaForge AI Privacy Policy \u2014 how we collect, use and protect your personal data.",
    about: "LitigaForge AI is a legal-technology platform connecting clients with verified attorneys in the United States. We are committed to protecting your privacy in accordance with applicable US data protection laws.",
  },
  GB: {
    description: "LitigaForge AI Privacy Policy \u2014 how we collect, use and protect your personal data under the UK GDPR and Data Protection Act 2018.",
    about: "LitigaForge AI is a legal-technology platform connecting clients with verified solicitors in the United Kingdom. We are the Data Controller under UK GDPR for all personal data processed on this platform.",
  },
  AE: {
    description: "LitigaForge AI Privacy Policy \u2014 how we collect, use and protect your personal data.",
    about: "LitigaForge AI is a legal-technology platform connecting clients with verified legal consultants in the UAE. We are committed to protecting your personal data in accordance with UAE data protection regulations.",
  },
  AU: {
    description: "LitigaForge AI Privacy Policy \u2014 how we collect, use and protect your personal data under the Privacy Act 1988.",
    about: "LitigaForge AI is a legal-technology platform connecting clients with verified solicitors in Australia. We are committed to protecting your privacy in accordance with the Australian Privacy Act 1988.",
  },
  CA: {
    description: "LitigaForge AI Privacy Policy \u2014 how we collect, use and protect your personal data under PIPEDA.",
    about: "LitigaForge AI is a legal-technology platform connecting clients with verified lawyers in Canada. We are committed to protecting your privacy in accordance with PIPEDA and provincial privacy laws.",
  },
  SG: {
    description: "LitigaForge AI Privacy Policy \u2014 how we collect, use and protect your personal data under the Personal Data Protection Act 2012.",
    about: "LitigaForge AI is a legal-technology platform connecting clients with verified advocates in Singapore. We are the Data Protection Officer under the PDPA for all personal data processed on this platform.",
  },
  DE: {
    description: "LitigaForge AI Datenschutzerkl\u00e4rung \u2014 wie wir Ihre pers\u00f6nlichen Daten erheben, verwenden und sch\u00fctzen gem\u00e4\u00df DSGVO.",
    about: "LitigaForge AI ist eine Rechtstechnologie-Plattform, die Mandanten mit verifizierten Anw\u00e4lten in Deutschland verbindet. Wir sind der Verantwortliche gem\u00e4\u00df DSGVO f\u00fcr alle auf dieser Plattform verarbeiteten personenbezogenen Daten.",
  },
};

export const POST_CASE_COPY: Record<string, { locationPlaceholder: string; pageTitle: string; pageSubtitle: string }> = {
  IN: { locationPlaceholder: "e.g., Hyderabad, Telangana", pageTitle: "Post a Case", pageSubtitle: "Describe your legal matter and get matched with verified advocates" },
  US: { locationPlaceholder: "e.g., Los Angeles, California", pageTitle: "Post a Case", pageSubtitle: "Describe your legal matter and get matched with verified attorneys" },
  GB: { locationPlaceholder: "e.g., London, England", pageTitle: "Post a Case", pageSubtitle: "Describe your legal matter and get matched with verified solicitors" },
  AE: { locationPlaceholder: "e.g., Dubai, UAE", pageTitle: "Post a Case", pageSubtitle: "Describe your legal matter and get matched with verified legal consultants" },
  AU: { locationPlaceholder: "e.g., Sydney, New South Wales", pageTitle: "Post a Case", pageSubtitle: "Describe your legal matter and get matched with verified solicitors" },
  CA: { locationPlaceholder: "e.g., Toronto, Ontario", pageTitle: "Post a Case", pageSubtitle: "Describe your legal matter and get matched with verified lawyers" },
  SG: { locationPlaceholder: "e.g., Singapore", pageTitle: "Post a Case", pageSubtitle: "Describe your legal matter and get matched with verified advocates" },
  DE: { locationPlaceholder: "z.B. Berlin, Deutschland", pageTitle: "Rechtssache einreichen", pageSubtitle: "Beschreiben Sie Ihr Rechtsanliegen und werden Sie mit verifizierten Anw\u00e4lten vermittelt" },
};

export const REVIEW_COPY: Record<string, { pageTitle: string; pageSubtitle: string }> = {
  IN: { pageTitle: "Document Analyzer", pageSubtitle: "Paste or upload a legal document. AI flags risks, missing clauses, and recommends improvements under Indian law." },
  US: { pageTitle: "Document Analyzer", pageSubtitle: "Paste or upload a legal document. AI flags risks, missing clauses, and recommends improvements under US law." },
  GB: { pageTitle: "Document Analyzer", pageSubtitle: "Paste or upload a legal document. AI flags risks, missing clauses, and recommends improvements under UK law." },
  AE: { pageTitle: "Document Analyzer", pageSubtitle: "Paste or upload a legal document. AI flags risks, missing clauses, and recommends improvements under UAE law." },
  AU: { pageTitle: "Document Analyzer", pageSubtitle: "Paste or upload a legal document. AI flags risks, missing clauses, and recommends improvements under Australian law." },
  CA: { pageTitle: "Document Analyzer", pageSubtitle: "Paste or upload a legal document. AI flags risks, missing clauses, and recommends improvements under Canadian law." },
  SG: { pageTitle: "Document Analyzer", pageSubtitle: "Paste or upload a legal document. AI flags risks, missing clauses, and recommends improvements under Singapore law." },
  DE: { pageTitle: "Dokumentenanalyse", pageSubtitle: "F\u00fcgen Sie ein Rechtsdokument ein oder laden Sie es hoch. Die KI markiert Risiken, fehlende Klauseln und empfiehlt Verbesserungen nach deutschem Recht." },
};

export const JUDGMENTS_COPY: Record<string, { pageTitle: string; pageSubtitle: string }> = {
  IN: { pageTitle: "Judgment Finder", pageSubtitle: "Search case law and precedents from Indian courts. AI returns relevant judgments with citations and IndianKanoon links." },
  US: { pageTitle: "Case Law Finder", pageSubtitle: "Search case law and precedents from US courts. AI returns relevant judgments with citations." },
  GB: { pageTitle: "Case Law Finder", pageSubtitle: "Search case law and precedents from UK courts. AI returns relevant judgments with citations." },
  AE: { pageTitle: "Judgment Finder", pageSubtitle: "Search case law and precedents from UAE courts. AI returns relevant judgments with citations." },
  AU: { pageTitle: "Case Law Finder", pageSubtitle: "Search case law and precedents from Australian courts. AI returns relevant judgments with citations." },
  CA: { pageTitle: "Case Law Finder", pageSubtitle: "Search case law and precedents from Canadian courts. AI returns relevant judgments with citations." },
  SG: { pageTitle: "Judgment Finder", pageSubtitle: "Search case law and precedents from Singapore courts. AI returns relevant judgments with citations." },
  DE: { pageTitle: "Urteilsfinder", pageSubtitle: "Durchsuchen Sie Rechtsprechung und Pr\u00e4zedenzf\u00e4lle aus deutschen Gerichten. Die KI liefert relevante Urteile mit Zitaten." },
};

export const LEGAL_AID_COPY: Record<string, { pageTitle: string; pageSubtitle: string }> = {
  IN: { pageTitle: "Free Legal Aid", pageSubtitle: "Check your eligibility and find free legal aid contacts. NALSA, TSLSA, DLSA, and state helplines." },
  US: { pageTitle: "Free Legal Aid", pageSubtitle: "Check your eligibility and find free legal aid contacts. Legal Aid Societies, pro bono clinics, and state helplines." },
  GB: { pageTitle: "Free Legal Aid", pageSubtitle: "Check your eligibility and find free legal aid contacts. Legal Aid Agency, Citizens Advice, and pro bono services." },
  AE: { pageTitle: "Free Legal Aid", pageSubtitle: "Check your eligibility and find free legal aid contacts. Legal aid and pro bono services in the UAE." },
  AU: { pageTitle: "Free Legal Aid", pageSubtitle: "Check your eligibility and find free legal aid contacts. National Legal Aid, community legal centres, and state helplines." },
  CA: { pageTitle: "Free Legal Aid", pageSubtitle: "Check your eligibility and find free legal aid contacts. Provincial legal aid programs and community legal clinics." },
  SG: { pageTitle: "Free Legal Aid", pageSubtitle: "Check your eligibility and find free legal aid contacts. Legal Aid Bureau, CLAS, and pro bono services." },
  DE: { pageTitle: "Kostenlose Rechtshilfe", pageSubtitle: "Pr\u00fcfen Sie Ihre Berechtigung und finden Sie Kontakte zur kostenlosen Rechtshilfe. Beratungshilfe und Prozesskostenhilfe." },
};

export const LAWYERS_COPY: Record<string, { pageTitle: string; pageSubtitle: string }> = {
  IN: { pageTitle: "Lawyer Directory", pageSubtitle: "Browse verified advocates across India. Filter by city, practice area, language, and rating." },
  US: { pageTitle: "Attorney Directory", pageSubtitle: "Browse verified attorneys across the United States. Filter by state, practice area, and rating." },
  GB: { pageTitle: "Solicitor Directory", pageSubtitle: "Browse verified solicitors across the United Kingdom. Filter by city, practice area, and rating." },
  AE: { pageTitle: "Legal Consultant Directory", pageSubtitle: "Browse verified legal consultants across the UAE. Filter by emirate, practice area, and rating." },
  AU: { pageTitle: "Solicitor Directory", pageSubtitle: "Browse verified solicitors across Australia. Filter by state, practice area, and rating." },
  CA: { pageTitle: "Lawyer Directory", pageSubtitle: "Browse verified lawyers across Canada. Filter by province, practice area, and rating." },
  SG: { pageTitle: "Advocate Directory", pageSubtitle: "Browse verified advocates across Singapore. Filter by practice area, language, and rating." },
  DE: { pageTitle: "Anwaltsverzeichnis", pageSubtitle: "Durchsuchen Sie verifizierte Anw\u00e4lte in Deutschland. Filtern nach Stadt, Rechtsgebiet und Bewertung." },
};

export const CLIENT_DASHBOARD_COPY: Record<string, { pageTitle: string; pageSubtitle: string }> = {
  IN: { pageTitle: "Client Dashboard", pageSubtitle: "Your legal matters, matched advocates, and case documents \u2014 all in one place." },
  US: { pageTitle: "Client Dashboard", pageSubtitle: "Your legal matters, matched attorneys, and case documents \u2014 all in one place." },
  GB: { pageTitle: "Client Dashboard", pageSubtitle: "Your legal matters, matched solicitors, and case documents \u2014 all in one place." },
  AE: { pageTitle: "Client Dashboard", pageSubtitle: "Your legal matters, matched consultants, and case documents \u2014 all in one place." },
  AU: { pageTitle: "Client Dashboard", pageSubtitle: "Your legal matters, matched solicitors, and case documents \u2014 all in one place." },
  CA: { pageTitle: "Client Dashboard", pageSubtitle: "Your legal matters, matched lawyers, and case documents \u2014 all in one place." },
  SG: { pageTitle: "Client Dashboard", pageSubtitle: "Your legal matters, matched advocates, and case documents \u2014 all in one place." },
  DE: { pageTitle: "Mandanten-Dashboard", pageSubtitle: "Ihre Rechtsangelegenheiten, vermittelte Anw\u00e4lte und Falldokumente \u2014 alles an einem Ort." },
};

export const LAWYER_DASHBOARD_COPY: Record<string, { pageTitle: string; pageSubtitle: string; verifiedBy: string }> = {
  IN: { pageTitle: "Advocate Dashboard", pageSubtitle: "Your AI-powered legal practice dashboard", verifiedBy: "Your profile is verified by the Bar Council of India." },
  US: { pageTitle: "Attorney Dashboard", pageSubtitle: "Your AI-powered legal practice dashboard", verifiedBy: "Your profile is verified by your State Bar." },
  GB: { pageTitle: "Solicitor Dashboard", pageSubtitle: "Your AI-powered legal practice dashboard", verifiedBy: "Your profile is verified by the SRA." },
  AE: { pageTitle: "Legal Consultant Dashboard", pageSubtitle: "Your AI-powered legal practice dashboard", verifiedBy: "Your profile is verified by the UAE Ministry of Justice." },
  AU: { pageTitle: "Solicitor Dashboard", pageSubtitle: "Your AI-powered legal practice dashboard", verifiedBy: "Your profile is verified by your State Law Society." },
  CA: { pageTitle: "Lawyer Dashboard", pageSubtitle: "Your AI-powered legal practice dashboard", verifiedBy: "Your profile is verified by your Provincial Law Society." },
  SG: { pageTitle: "Advocate Dashboard", pageSubtitle: "Your AI-powered legal practice dashboard", verifiedBy: "Your profile is verified by the Singapore Bar." },
  DE: { pageTitle: "Anwalts-Dashboard", pageSubtitle: "Ihr KI-gest\u00fctztes Rechtspraxis-Dashboard", verifiedBy: "Ihr Profil ist von der Rechtsanwaltskammer verifiziert." },
};
