import { Helmet } from "react-helmet-async";
import { getCountryName } from "@/lib/country-copy";

const SITE_URL = "https://litigaforge.com";
const DEFAULT_OG_IMAGE = "https://litigaforge.com/og-image.png";

const DEFAULT_KEYWORDS =
  "find a lawyer online, legal AI assistant, legal advice, legal document analyzer, case law search, free legal aid, lawyer matching, AI legal help";

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
  const title = _title ?? (isIndia
    ? "LitigaForge AI – Find Lawyers & Legal Help in India"
    : `LitigaForge AI – AI Legal Help for ${getCountryName(urlCode)}`);
  const description = _description ?? (isIndia
    ? "AI-powered legal platform connecting clients with verified advocates in India. Get instant legal advice, document analysis, and case matching."
    : `AI-powered legal platform for ${getCountryName(urlCode)}. Connect with verified lawyers, analyze documents, and get instant legal guidance.`);
  const keywords = _keywords ?? DEFAULT_KEYWORDS;
  const fullTitle = title.includes("LitigaForge") ? title : `${title} | LitigaForge AI`;
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : SITE_URL;
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
