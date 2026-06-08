export const VALID_COUNTRIES = ["in", "us", "gb", "ae", "au", "ca", "sg", "de"] as const;
export type CountryCode = (typeof VALID_COUNTRIES)[number];

const VALID = VALID_COUNTRIES as readonly string[];

// Common country names / abbreviations that should resolve to a canonical
// 2-letter code, so URLs like /uae or /usa work and redirect to /ae, /us.
const COUNTRY_ALIASES: Record<string, CountryCode> = {
  uae: "ae",
  emirates: "ae",
  dubai: "ae",
  usa: "us",
  america: "us",
  uk: "gb",
  britain: "gb",
  england: "gb",
  india: "in",
  bharat: "in",
  australia: "au",
  aus: "au",
  canada: "ca",
  can: "ca",
  singapore: "sg",
  sgp: "sg",
  germany: "de",
  deutschland: "de",
  ger: "de",
};

export function isValidCountry(code: string | null | undefined): boolean {
  return !!code && VALID.includes(code.toLowerCase());
}

export function resolveCountryAlias(seg: string | null | undefined): CountryCode | null {
  if (!seg) return null;
  const key = seg.toLowerCase();
  if (VALID.includes(key)) return key as CountryCode;
  return COUNTRY_ALIASES[key] ?? null;
}

export function getAppBase(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function relAfterBase(): string {
  const base = getAppBase();
  let rel = window.location.pathname;
  if (base && rel.startsWith(base)) rel = rel.slice(base.length);
  return rel.replace(/^\//, "");
}

export function getCountryFromPath(): CountryCode | null {
  const seg = relAfterBase().split("/")[0]?.toLowerCase();
  return seg && VALID.includes(seg) ? (seg as CountryCode) : null;
}

export function getCountryAliasFromPath(): CountryCode | null {
  const seg = relAfterBase().split("/")[0]?.toLowerCase();
  if (!seg || VALID.includes(seg)) return null;
  return resolveCountryAlias(seg);
}

export function getPathWithoutCountry(): string {
  const parts = relAfterBase().split("/");
  const first = parts[0]?.toLowerCase() ?? "";
  // Drop a leading country code, a known alias (e.g. /uae, /usa), or a
  // country-code-like 2-letter prefix that is invalid (e.g. /xx/login) so it
  // normalizes to /in/login, not /in/xx/login.
  if (
    first &&
    (VALID.includes(first) || resolveCountryAlias(first) || /^[a-z]{2}$/.test(first))
  )
    parts.shift();
  return parts.join("/");
}

export function buildCountryUrl(code: string, rel = ""): string {
  const base = getAppBase();
  const clean = rel.replace(/^\//, "");
  return `${base}/${code.toLowerCase()}${clean ? "/" + clean : ""}`;
}
