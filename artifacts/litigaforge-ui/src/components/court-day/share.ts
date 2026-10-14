export type ShareLang = "en" | "te" | "hi";

export const SHARE_LANGS: { id: ShareLang; label: string; locale: string }[] = [
  { id: "en", label: "English", locale: "en-IN" },
  { id: "te", label: "తెలుగు", locale: "te-IN" },
  { id: "hi", label: "हिंदी", locale: "hi-IN" },
];

export interface ShareInput {
  lang: ShareLang;
  /** "today": listed today; "next": the next hearing date. */
  mode: "today" | "next";
  clientName?: string | null;
  title: string;
  court?: string | null;
  hall?: string | null;
  item?: string | null;
  /** ISO date (YYYY-MM-DD) for mode "next". */
  date?: string | null;
}

const localeOf = (lang: ShareLang) => SHARE_LANGS.find((l) => l.id === lang)?.locale ?? "en-IN";

export function formatHearingDate(iso: string, lang: ShareLang): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString(localeOf(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const hasText = (value?: string | null) => !!value && value.trim().length > 0;

/** Client message in the client's language. Plain text, ready for WhatsApp or SMS. */
export function buildShareMessage(input: ShareInput): string {
  const { lang, mode, clientName, title, court, hall, item, date } = input;
  const name = hasText(clientName) ? clientName!.trim() : "";
  const dateText = date ? formatHearingDate(date, lang) : "";

  if (lang === "te") {
    const where = [court, hasText(hall) ? `కోర్ట్ హాల్ ${hall}` : "", hasText(item) ? `ఐటమ్ ${item}` : ""]
      .filter(hasText).join(", ");
    const greeting = name ? `నమస్కారం ${name} గారు,` : "నమస్కారం,";
    const body = mode === "today"
      ? `మీ కేసు (${title}) ఈ రోజు విచారణకు ఉంది.${where ? `\n${where}.` : ""}`
      : `మీ కేసు (${title}) తదుపరి విచారణ తేదీ: ${dateText}.${where ? `\n${where}.` : ""}`;
    return `${greeting}\n${body}\n— మీ న్యాయవాది కార్యాలయం`;
  }

  if (lang === "hi") {
    const where = [court, hasText(hall) ? `कोर्ट हॉल ${hall}` : "", hasText(item) ? `आइटम ${item}` : ""]
      .filter(hasText).join(", ");
    const greeting = name ? `नमस्ते ${name} जी,` : "नमस्ते,";
    const body = mode === "today"
      ? `आपका मामला (${title}) आज सुनवाई के लिए सूचीबद्ध है।${where ? `\n${where}।` : ""}`
      : `आपके मामले (${title}) की अगली सुनवाई की तारीख: ${dateText}।${where ? `\n${where}।` : ""}`;
    return `${greeting}\n${body}\n— आपके अधिवक्ता का कार्यालय`;
  }

  const where = [court, hasText(hall) ? `Court Hall ${hall}` : "", hasText(item) ? `Item ${item}` : ""]
    .filter(hasText).join(", ");
  const greeting = name ? `Hello ${name},` : "Hello,";
  const body = mode === "today"
    ? `Your case (${title}) is listed for hearing today.${where ? `\n${where}.` : ""}`
    : `The next hearing in your case (${title}) is on ${dateText}.${where ? `\n${where}.` : ""}`;
  return `${greeting}\n${body}\n— Your advocate’s office`;
}

export const whatsappLink = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;
