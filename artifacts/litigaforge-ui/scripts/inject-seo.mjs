#!/usr/bin/env node
// Post-build: generate route-specific index.html files in dist/public/ so that
// Replit's production static CDN serves correct <title>, canonical, and OG tags
// for each SPA route — no runtime server required.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist/public');
const SITE = 'https://litigaforge.com';
const OG_IMAGE = `${SITE}/opengraph.jpg`;

// Mirror of _ROUTE_SEO in artifacts/api-server/src/app.ts.
// title   → <title> tag (≤58 decoded chars)
// ogTitle → og:title + twitter:title (shorter variant)
// desc    → meta description + og:description + twitter:description (≤135 chars)
// canonical (optional) → override canonical href (e.g. /privacy-policy → /privacy)
const ROUTES = {
  '/': {
    title: 'LitigaForge AI \u2014 Telangana & Andhra Pradesh Legal Information',
    ogTitle: 'LitigaForge AI \u2014 Legal Information',
    desc: 'AI-assisted legal information, document analysis, judgment research and advocate tools for Telangana and Andhra Pradesh.',
  },
  '/ask': {
    title: 'Free Legal Information Q&amp;A | LitigaForge AI',
    ogTitle: 'Free Legal Information Q&amp;A',
    desc: 'AI-assisted legal information for questions about Telangana and Andhra Pradesh law. AI can be wrong; consult an advocate for representation.',
  },
  '/review': {
    title: 'AI Document Analyzer \u2014 Risk Score | LitigaForge AI',
    ogTitle: 'AI Document Analyzer \u2014 Free Risk Check',
    desc: 'Get an AI risk score (0\u2013100), missing clauses and recommendations for any contract, agreement, FIR or court notice. Free document analysis.',
  },
  '/lawyers': {
    title: 'Advocate Directory | LitigaForge AI',
    ogTitle: 'Advocate Directory',
    desc: 'Browse human-verified advocates when available. If no eligible advocate is available, the directory shows an honest empty state.',
  },
  '/judgments': {
    title: 'Judgment Finder \u2014 Search Case Law | LitigaForge AI',
    ogTitle: 'Judgment Finder \u2014 Search Case Law',
    desc: 'Search judgments by keyword, court or case number. Relevant precedents with citation links \u2014 free case law research.',
  },
  '/legal-aid': {
    title: 'Free Legal Aid Finder \u2014 Eligibility &amp; Helplines | LitigaForge AI',
    ogTitle: 'Free Legal Aid Finder \u2014 Eligibility &amp; Helplines',
    desc: 'Check eligibility for free legal aid and find contacts and helplines for your region. Legal help for everyone, regardless of income.',
  },
  '/free-documents': {
    title: 'Free Legal Document Templates \u2014 AI-Generated | LitigaForge AI',
    ogTitle: 'Free Legal Document Templates \u2014 AI-Generated',
    desc: 'Generate free legal documents instantly \u2014 rental agreements, notices, affidavits, employment letters and NDAs, customized for your jurisdiction.',
  },
  '/subscription': {
    title: 'LitigaForge AI Plans \u2014 Free, Professional &amp; Advocate Pro',
    ogTitle: 'LitigaForge AI Pricing &amp; Plans',
    desc: 'Compare Free, Professional ₹999, and Advocate Pro ₹2,499 plans for legal-information and advocate productivity tools.',
  },
  '/about': {
    title: 'About LitigaForge AI \u2014 Telangana &amp; Andhra Pradesh',
    ogTitle: 'About LitigaForge AI',
    desc: 'LitigaForge AI supports clearer legal information, document analysis, judgment research and advocate tools in Telangana and Andhra Pradesh.',
  },
  '/contact': {
    title: 'Contact LitigaForge AI \u2014 Support &amp; Inquiries',
    ogTitle: 'Contact LitigaForge AI',
    desc: 'Get in touch with LitigaForge AI for support, partnership or media inquiries. We\u2019re here to help with any questions about our legal platform.',
  },
  '/digest': {
    title: 'Daily Judgment Digest \u2014 Top 5 by Email | LitigaForge AI',
    ogTitle: 'Daily Judgment Digest \u2014 Free Email',
    desc: 'Subscribe free \u2014 get the 5 most important new judgments in your inbox each morning, each with a plain-language summary.',
  },
  '/privacy': {
    title: 'Privacy Policy | LitigaForge AI',
    ogTitle: 'Privacy Policy \u2014 LitigaForge AI',
    desc: 'Read the LitigaForge AI privacy policy: data we collect, how we use and protect it, cookies and advertising, and your data rights.',
  },
  '/privacy-policy': {
    title: 'Privacy Policy | LitigaForge AI',
    ogTitle: 'Privacy Policy \u2014 LitigaForge AI',
    desc: 'Read the LitigaForge AI privacy policy: data we collect, how we use and protect it, cookies and advertising, and your data rights.',
    canonical: '/privacy',
  },
  '/terms': {
    title: 'Terms of Service | LitigaForge AI',
    ogTitle: 'Terms of Service \u2014 LitigaForge AI',
    desc: 'Terms governing your use of LitigaForge AI \u2014 acceptable use, disclaimers and the limits of AI-generated legal information.',
  },
  '/refund-policy': {
    title: 'Refund Policy | LitigaForge AI',
    ogTitle: 'Refund Policy \u2014 LitigaForge AI',
    desc: 'LitigaForge AI refund policy for subscription plans \u2014 how billing, cancellations and refunds are handled.',
  },
  '/us-demand-letter': {
    title: 'U.S. Demand Letter \u2014 Draft &amp; Send | LitigaForge AI',
    ogTitle: 'U.S. Demand Letter \u2014 Draft &amp; Send',
    desc: 'Draft a professional, state-specific U.S. demand letter for unpaid debts, broken contracts or damages. AI-drafted, ready to send.',
  },
  '/login': {
    title: 'Sign In | LitigaForge AI',
    ogTitle: 'Sign In \u2014 LitigaForge AI',
    desc: 'Sign in to access legal-information tools, document analysis, judgment research and advocate workspace features.',
  },
  '/register': {
    title: 'Create a Free Account | LitigaForge AI',
    ogTitle: 'Create a Free Account \u2014 LitigaForge AI',
    desc: 'Create a free account for legal-information tools, document analysis and judgment research. No credit card required.',
  },
};

function inject(html, routePath, { title, ogTitle, desc, canonical }) {
  const canonUrl = `${SITE}${canonical ?? routePath}`;
  const ogUrl = `${SITE}${routePath}`;
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${desc}"/>`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonUrl}"/>`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${ogUrl}"/>`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${ogTitle}"/>`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${desc}"/>`)
    .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${OG_IMAGE}"/>`)
    .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${ogTitle}"/>`)
    .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${desc}"/>`)
    .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${OG_IMAGE}"/>`);
}

const raw = readFileSync(resolve(DIST, 'index.html'), 'utf-8');
let count = 0;

for (const [routePath, meta] of Object.entries(ROUTES)) {
  const html = inject(raw, routePath, meta);
  if (routePath === '/') {
    writeFileSync(resolve(DIST, 'index.html'), html);
    console.log('  /  →  dist/public/index.html  (updated in place)');
  } else {
    const dir = resolve(DIST, routePath.replace(/^\//, ''));
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'index.html'), html);
    console.log(`  ${routePath}  →  dist/public${routePath}/index.html`);
  }
  count++;
}

console.log(`\nSEO injection complete: ${count} routes.`);
