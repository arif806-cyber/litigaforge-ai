import { Helmet } from "react-helmet-async";
import { getPathWithoutCountry } from "@/lib/country";
import { truncateTitle } from "@/lib/title";

const SITE_URL = "https://litigaforge.com";
const DEFAULT_OG_IMAGE = "https://litigaforge.com/og-image.png";

const POSITIONING = "LitigaForge — AI legal tools for advocates and clients";
const DEFAULT_KEYWORDS = "advocate tools, case tracking, legal research, legal tools";

const OG_LOCALE: Record<string, string> = {
  IN: "en_IN", US: "en_US", GB: "en_GB", AE: "en_AE",
  AU: "en_AU", CA: "en_CA", SG: "en_SG", DE: "de_DE",
};

interface SEOHelmetProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  keywords?: string;
  structuredData?: Record<string, unknown>;
  noIndex?: boolean;
}

export function SEOHelmet({
  title: _title,
  description: _description,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  keywords: _keywords,
  structuredData,
  noIndex = false,
}: SEOHelmetProps) {
  const urlCode = (typeof window !== "undefined" ? window.location.pathname.split("/")[1] : "in").toUpperCase();
  const isIndia = urlCode === "IN" || !urlCode;
  const title = _title ?? POSITIONING;
  const description = _description ?? "Case tracking, legal research, and practical tools for advocates and clients.";
  const keywords = _keywords ?? DEFAULT_KEYWORDS;
  const fullTitle = truncateTitle(title.includes("LitigaForge") ? title : `${title} | LitigaForge`);
  // Self-referencing canonical: use the explicit prop when given, otherwise
  // derive it from the current path stripped of its country prefix so every
  // page canonicalizes to its bare URL (e.g. /in/ask and /us/ask -> /ask)
  // instead of defaulting to the site root.
  const canonicalPath =
    canonical ??
    (typeof window !== "undefined"
      ? (() => {
          const p = getPathWithoutCountry().replace(/\/+$/, "");
          return p ? `/${p}` : "/";
        })()
      : "/");
  const canonicalUrl = `${SITE_URL}${canonicalPath === "/" ? "/" : canonicalPath}`;
  const ogLocale = OG_LOCALE[urlCode] ?? "en_US";

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow"} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="canonical" href={canonicalUrl} />

      {/* OpenGraph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="LitigaForge AI" />
      <meta property="og:locale" content={ogLocale} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@litigaforge" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}
