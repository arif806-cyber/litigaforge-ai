"use client";

import { Helmet } from "react-helmet-async";

interface SEOHelmetProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  structuredData?: Record<string, any>;
}

export function SEOHelmet({
  title = "LitigaForge AI — Legal Intelligence Platform",
  description = "AI-powered legal intelligence for Telangana & AP advocates. Entity extraction, API chains, legal strategy, document analysis, judgment finder, and lawyer matching.",
  canonical,
  ogImage = "/opengraph.jpg",
  structuredData,
}: SEOHelmetProps) {
  const base = import.meta.env.BASE_URL || "/";
  const fullTitle = title.includes("LitigaForge AI") ? title : `${title} — LitigaForge AI`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {canonical && <link rel="canonical" href={`https://litigaforge.replit.app${canonical}`} />}

      {/* OpenGraph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="LitigaForge AI" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
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
