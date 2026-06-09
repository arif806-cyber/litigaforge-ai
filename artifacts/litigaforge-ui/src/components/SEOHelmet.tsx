import { Helmet } from "react-helmet-async";

const SITE_URL = "https://litigaforge.com";
const DEFAULT_OG_IMAGE = "https://litigaforge.com/og-image.png";

const DEFAULT_KEYWORDS =
  "lawyer in Hyderabad, advocate Telangana, legal help Andhra Pradesh, find lawyer online India, legal AI, case filing help, free legal advice India, eCourts India, NALSA free legal aid, document analyzer";

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
  title = "LitigaForge AI – Find Lawyers & Legal Help in Telangana & Andhra Pradesh",
  description = "AI-powered legal platform connecting clients with verified advocates in Telangana and Andhra Pradesh. Get instant legal advice, document analysis, and case matching.",
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  keywords = DEFAULT_KEYWORDS,
  structuredData,
  noIndex = false,
}: SEOHelmetProps) {
  const fullTitle = title.includes("LitigaForge") ? title : `${title} | LitigaForge AI`;
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : SITE_URL;

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
      <meta property="og:locale" content="en_IN" />

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
