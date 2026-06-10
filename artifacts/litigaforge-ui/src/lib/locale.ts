// Shared locale + legal terminology helpers for country localization.
// Keeps date formatting and case-number wording out of India-only hardcodes.

export const COUNTRY_LOCALE: Record<string, string> = {
  IN: "en-IN",
  US: "en-US",
  GB: "en-GB",
  AE: "en-AE",
  AU: "en-AU",
  CA: "en-CA",
  SG: "en-SG",
  DE: "de-DE",
};

export function localeFor(countryCode?: string): string {
  if (!countryCode) return "en-US";
  return COUNTRY_LOCALE[countryCode.toUpperCase()] ?? "en-US";
}

export function formatDate(
  date: string | number | Date | null | undefined,
  countryCode?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (date === null || date === undefined || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(localeFor(countryCode), options);
}

// Per-country case-number terminology. India uses CNR; other jurisdictions
// have their own court file / docket conventions.
export interface CaseNumberTerms {
  label: string; // form field label
  short: string; // compact chip label
  placeholder: string; // input example
}

const DEFAULT_TERMS: CaseNumberTerms = {
  label: "Case Number",
  short: "Case No.",
  placeholder: "e.g., case / docket number",
};

export const COUNTRY_TERMS: Record<string, CaseNumberTerms> = {
  IN: { label: "CNR Number", short: "CNR", placeholder: "e.g., AP0101234567890" },
  US: { label: "Case / Docket Number", short: "Docket", placeholder: "e.g., 1:21-cv-01234" },
  GB: { label: "Case Number", short: "Case No.", placeholder: "e.g., HQ21X01234" },
  AE: { label: "Case Number", short: "Case No.", placeholder: "e.g., 1234/2024" },
  AU: { label: "Case / Proceeding Number", short: "Case No.", placeholder: "e.g., NSD1234/2024" },
  CA: { label: "Court File Number", short: "File No.", placeholder: "e.g., CV-24-001234" },
  SG: { label: "Case Number", short: "Case No.", placeholder: "e.g., HC/S 123/2024" },
  DE: { label: "Aktenzeichen", short: "Az.", placeholder: "e.g., 1 BvR 1234/24" },
};

export function caseTerms(countryCode?: string): CaseNumberTerms {
  if (!countryCode) return DEFAULT_TERMS;
  return COUNTRY_TERMS[countryCode.toUpperCase()] ?? DEFAULT_TERMS;
}
