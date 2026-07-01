#!/usr/bin/env node
/**
 * LitigaForge AI — SPA production server with per-route meta injection
 *
 * Replaces `vite preview` so that every route returns a unique <title>,
 * <meta name="description">, <link rel="canonical">, and Open Graph tags
 * before JavaScript runs.  This is what satisfies:
 *   curl -s https://litigaforge.com/lawyers | grep '<title>'
 * returning something different from the homepage title.
 *
 * Zero external dependencies — uses Node.js built-ins only.
 * Run with:  node server.mjs  (PORT and PUBLIC_SITE_URL come from env)
 */

import { createServer } from "node:http";
import { createReadStream, statSync, readFileSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3000", 10);
const DIST = join(__dirname, "dist", "public");
const SITE = (process.env.PUBLIC_SITE_URL || "https://litigaforge.com").replace(/\/$/, "");

// Country-code URL prefixes the SPA prepends to every route (/in/lawyers, /us/ask …)
const COUNTRY_CODES = new Set(["in", "us", "gb", "ae", "au", "ca", "sg", "de"]);

// ─── MIME types ──────────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".gz": "application/gzip",
  ".br": "application/x-br",
  ".webmanifest": "application/manifest+json",
};

// ─── Per-route meta manifest ─────────────────────────────────────────────────
// Keys are bare SPA paths (country prefix stripped).
// title / description / canonical / ogTitle / ogDesc / noIndex / jsonld
const ROUTE_META = {
  "/": {
    title: "LitigaForge AI — AI-Powered Legal Platform | Find Lawyers Worldwide",
    description:
      "LitigaForge AI connects you with verified lawyers and provides instant AI-powered legal guidance, document analysis, and free legal aid — available globally in English, Hindi, and Telugu.",
    canonical: "/",
  },

  "/lawyers": {
    title: "Find Verified Lawyers | AI Lawyer Matching | LitigaForge AI",
    description:
      "Browse AI-verified advocates and get matched with top lawyers for your case — each scored 0–100 for compatibility. Free to search across India, US, UK, UAE, Australia, Canada, Singapore, and Germany.",
    canonical: "/lawyers",
    jsonld: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "AI Lawyer Matching — LitigaForge AI",
      description: "AI-powered lawyer matching — browse verified advocates scored 0–100 for your case type.",
      provider: { "@type": "Organization", name: "LitigaForge AI", url: "https://litigaforge.com" },
      serviceType: "Lawyer Matching Platform",
      areaServed: ["India", "United States", "United Kingdom", "United Arab Emirates", "Australia", "Canada", "Singapore", "Germany"],
    },
  },

  "/ask": {
    title: "Ask Legal Questions — Instant AI Answers | LitigaForge AI",
    description:
      "Ask any legal question and get instant AI-powered answers grounded in your country's law — property, criminal, family, tax, immigration, and more. Free, no signup required.",
    canonical: "/ask",
    jsonld: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Legal Q&A — LitigaForge AI",
      description: "Instant AI answers to legal questions across 20+ categories, grounded in local law.",
      provider: { "@type": "Organization", name: "LitigaForge AI", url: "https://litigaforge.com" },
      serviceType: "Legal Q&A Platform",
    },
  },

  "/review": {
    title: "AI Legal Document Analyzer — Risk Scoring & Contract Review | LitigaForge AI",
    description:
      "Paste any contract or legal document and get an AI-powered risk score, missing-clause detection, and actionable recommendations in seconds. Free, instant, and confidential.",
    canonical: "/review",
    jsonld: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "AI Legal Document Analyzer — LitigaForge AI",
      description: "AI contract review: risk scoring, missing clause detection, actionable recommendations.",
      provider: { "@type": "Organization", name: "LitigaForge AI", url: "https://litigaforge.com" },
      serviceType: "Legal Document Analysis",
    },
  },

  "/judgments": {
    title: "Search Indian Court Judgments & Case Law | LitigaForge AI",
    description:
      "Search Supreme Court, High Court, and Tribunal judgments with AI summaries and IndianKanoon links. Find relevant precedents for property, criminal, family, and civil cases.",
    canonical: "/judgments",
    jsonld: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Judgment Finder — LitigaForge AI",
      description: "Search Indian court judgments and case law with AI summaries and IndianKanoon links.",
      provider: { "@type": "Organization", name: "LitigaForge AI", url: "https://litigaforge.com" },
      serviceType: "Legal Research",
    },
  },

  "/legal-aid": {
    title: "Free Legal Aid Finder — NALSA & TSLSA Contacts | LitigaForge AI",
    description:
      "Check your eligibility for free legal aid in India. Get NALSA, TSLSA, and all 8 DLSA district contacts, helplines, and instant AI guidance — completely free.",
    canonical: "/legal-aid",
  },

  "/subscription": {
    title: "Pricing Plans — Free & Professional Legal AI | LitigaForge AI",
    description:
      "Compare LitigaForge AI plans: Free (5 queries/month), Professional (₹999/month, unlimited queries), and Advocate Pro (₹2,499/month, full practice management). Start free today.",
    canonical: "/subscription",
  },

  "/free-documents": {
    title: "Free Legal Document Templates — AI-Generated | LitigaForge AI",
    description:
      "Download and auto-fill free legal document templates — rental agreements, employment contracts, affidavits, NDAs, and more — AI-generated and customised for India.",
    canonical: "/free-documents",
  },

  "/about": {
    title: "About LitigaForge AI — India's AI Legal Platform",
    description:
      "Learn about LitigaForge AI — our mission to make legal help accessible through AI lawyer matching, document analysis, judgment search, and free legal aid.",
    canonical: "/about",
  },

  "/contact": {
    title: "Contact LitigaForge AI | legal@litigaforge.com",
    description:
      "Contact the LitigaForge AI team for partnership, press, or support enquiries. Email us at legal@litigaforge.com.",
    canonical: "/contact",
  },

  "/privacy": {
    title: "Privacy Policy | LitigaForge AI",
    description: "Read LitigaForge AI's privacy policy — how we collect, use, and protect your personal data.",
    canonical: "/privacy",
  },

  "/privacy-policy": {
    title: "Privacy Policy | LitigaForge AI",
    description: "Read LitigaForge AI's privacy policy — how we collect, use, and protect your personal data.",
    canonical: "/privacy",
  },

  "/terms": {
    title: "Terms of Service | LitigaForge AI",
    description: "Read LitigaForge AI's terms of service — your rights and responsibilities when using our platform.",
    canonical: "/terms",
  },

  "/refund-policy": {
    title: "Refund Policy | LitigaForge AI",
    description: "Read the LitigaForge AI refund policy for Professional and Advocate Pro subscriptions.",
    canonical: "/refund-policy",
  },

  "/blog": {
    title: "Legal News & Insights | LitigaForge AI Blog",
    description:
      "Read the latest legal news, case law analysis, and practical legal guides from LitigaForge AI. Updated daily across India, the US, UK, UAE, and more.",
    canonical: "/blog",
  },

  "/legal-chat": {
    title: "AI Legal Chat — Drafting & Strategy | LitigaForge AI",
    description:
      "Chat with the LitigaForge AI legal assistant to draft documents, plan strategy, and get plain-language explanations of complex legal concepts.",
    canonical: "/legal-chat",
  },

  "/cnr-tracker": {
    title: "CNR Case Status Tracker | LitigaForge AI",
    description:
      "Track your court case status using the CNR number on LitigaForge AI — real-time updates from Indian courts.",
    canonical: "/cnr-tracker",
  },

  "/login": {
    title: "Sign In | LitigaForge AI",
    description: "Sign in to your LitigaForge AI account to access AI legal tools, your case dashboard, and lawyer matching.",
    canonical: "/login",
    noIndex: true,
  },

  "/register": {
    title: "Create Account | LitigaForge AI",
    description:
      "Create a free LitigaForge AI account and access AI-powered legal tools, lawyer matching, and document analysis.",
    canonical: "/register",
    noIndex: true,
  },

  "/forgot-password": {
    title: "Reset Password | LitigaForge AI",
    description: "Reset your LitigaForge AI account password.",
    canonical: "/forgot-password",
    noIndex: true,
  },
};

// Prefix-based matches for dynamic routes (checked after exact match misses)
const PREFIX_META = [
  {
    prefix: "/judgments/",
    meta: {
      title: "Court Judgment | LitigaForge AI",
      description:
        "Read the full text and AI summary of this court judgment on LitigaForge AI — India's AI-powered legal research platform.",
      jsonld: {
        "@context": "https://schema.org",
        "@type": "Article",
        publisher: { "@type": "Organization", name: "LitigaForge AI", url: "https://litigaforge.com" },
      },
    },
  },
  {
    prefix: "/blog/",
    meta: {
      title: "Legal Article | LitigaForge AI Blog",
      description: "Read this legal article on LitigaForge AI — India's AI-powered legal platform.",
    },
  },
  {
    prefix: "/lawyers/",
    meta: {
      title: "Find Lawyers in Your City | LitigaForge AI",
      description:
        "Find verified lawyers in your city — browse by practice area, language, and rating on LitigaForge AI.",
    },
  },
  {
    prefix: "/free-documents/",
    meta: {
      title: "Free Legal Document | LitigaForge AI",
      description: "Download and auto-fill this free AI-generated legal document template on LitigaForge AI.",
    },
  },
];

// ─── Read index.html once at startup ─────────────────────────────────────────
let rawHtml;
try {
  rawHtml = readFileSync(join(DIST, "index.html"), "utf-8");
} catch (err) {
  console.error(`[seo-server] FATAL: cannot read ${join(DIST, "index.html")}`);
  console.error("  Did you run `pnpm --filter @workspace/litigaforge-ui run build` first?");
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripCountry(rawPath) {
  const path = (rawPath || "/").split("?")[0];
  const parts = path.split("/").filter(Boolean);
  if (parts.length > 0 && COUNTRY_CODES.has(parts[0].toLowerCase())) {
    const rest = parts.slice(1).join("/");
    return rest ? `/${rest}` : "/";
  }
  return path || "/";
}

function getMeta(rawPath) {
  const base = stripCountry(rawPath);
  if (ROUTE_META[base]) return { ...ROUTE_META[base], _path: base };
  for (const { prefix, meta } of PREFIX_META) {
    if (base.startsWith(prefix)) return { ...meta, _path: base };
  }
  return { ...ROUTE_META["/"], _path: "/" };
}

function injectMeta(rawPath) {
  const { _path, noIndex, jsonld, canonical, title, description } = getMeta(rawPath);

  const canonicalPath = canonical || _path;
  const canonicalUrl = canonicalPath === "/" ? `${SITE}/` : `${SITE}${canonicalPath}`;
  const pageUrl = _path === "/" ? `${SITE}/` : `${SITE}${_path}`;
  const robots = noIndex ? "noindex, nofollow" : "index, follow";
  const safeTitle = esc(title);
  const safeDesc = esc(description);

  let html = rawHtml
    // <title>
    .replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)
    // <meta name="description">
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${safeDesc}" />`,
    )
    // <meta name="robots">
    .replace(
      /<meta name="robots" content="[^"]*" \/>/,
      `<meta name="robots" content="${robots}" />`,
    )
    // <link rel="canonical">
    .replace(
      /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${canonicalUrl}" />`,
    )
    // Open Graph
    .replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${pageUrl}" />`,
    )
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${safeTitle}" />`,
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${safeDesc}" />`,
    )
    // Twitter
    .replace(
      /<meta name="twitter:title" content="[^"]*" \/>/,
      `<meta name="twitter:title" content="${safeTitle}" />`,
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${safeDesc}" />`,
    );

  // Inject route-specific JSON-LD (appended before </head>)
  if (jsonld) {
    const block = `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 2)}\n</script>\n`;
    html = html.replace("</head>", `${block}</head>`);
  }

  return html;
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
const httpServer = createServer((req, res) => {
  const url = req.url || "/";
  const filePath = url.split("?")[0];
  const ext = extname(filePath);

  // --- Static asset: has a file extension → serve from dist/ ---
  if (ext && ext !== ".html") {
    const absPath = join(DIST, filePath);
    try {
      const stat = statSync(absPath);
      if (!stat.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      const mime = MIME[ext] || "application/octet-stream";
      // Hashed assets get long-lived immutable cache; everything else gets 1h
      const isHashed = /\.[a-f0-9]{8,}\.\w+$/.test(filePath);
      res.writeHead(200, {
        "Content-Type": mime,
        "Cache-Control": isHashed
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600",
        "Content-Length": stat.size,
      });
      createReadStream(absPath).pipe(res);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
    return;
  }

  // --- SPA route: serve meta-injected index.html ---
  try {
    const html = injectMeta(url);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    res.end(html);
  } catch (err) {
    console.error("[seo-server] meta injection error:", err);
    // Fallback: serve raw HTML rather than returning a 500
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(rawHtml);
  }
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[seo-server] ✓ listening on port ${PORT}`);
  console.log(`[seo-server]   dist  = ${DIST}`);
  console.log(`[seo-server]   site  = ${SITE}`);
  console.log(`[seo-server]   routes = ${Object.keys(ROUTE_META).length} exact + ${PREFIX_META.length} prefix patterns`);
});
