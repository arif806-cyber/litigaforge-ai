import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { logger } from "./lib/logger";
import { BLOG_REDIRECTS } from "./lib/blogRedirects";

const app: Express = express();

// ── Domain canonicalization ────────────────────────────────────────────────
// Redirect www.litigaforge.com → litigaforge.com (301, permanent) so Google
// never indexes both variants. Replit's TLS proxy sets X-Forwarded-Host;
// the virtual hostname lives there, not in the bare Host header.
app.use((req, res, next) => {
  const fwd = req.headers["x-forwarded-host"];
  const host = (Array.isArray(fwd) ? fwd[0] : fwd) ?? "";
  if (host.startsWith("www.")) {
    res.redirect(301, `https://litigaforge.com${req.originalUrl}`);
    return;
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Compress all responses (HTML, JS, CSS, JSON). The render-critical CSS bundle
// is ~195 KiB uncompressed and shrinks to ~28 KiB gzipped — a major LCP win.
app.use(compression());

app.use(cors());

// ── Stripe webhook ────────────────────────────────────────────────────────
// MUST be registered with the raw body parser BEFORE express.json(), otherwise
// signature verification fails because the body is already parsed.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res): Promise<void> => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0]! : signature;
      if (!Buffer.isBuffer(req.body)) {
        logger.error(
          "STRIPE WEBHOOK ERROR: req.body is not a Buffer — express.json() ran first.",
        );
        res.status(500).json({ error: "Webhook processing error" });
        return;
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", router);

// ── Explicit verification / well-known files ──────────────────────────────
// These must be served before any bot-detection or SPA fallback logic so
// that crawlers requesting them never receive HTML by mistake.
app.get("/BingSiteAuth.xml", (_req, res) => {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(
    '<?xml version="1.0"?>\n<users>\n  <user>1CB9D2C4A5C0F3AA292F4831C19291EE</user>\n</users>\n'
  );
});

// ── Blog reverse-proxy ───────────────────────────────────────────────────
// The blog is an autonomous Astro site that the content pipeline deploys to a
// Cloudflare Worker every 2 hours. We serve it under litigaforge.com/blog (and
// its root-level /_astro asset bundle) by transparently proxying to the Worker.
// This keeps the public URL on the apex domain while the Cloudflare pipeline
// stays untouched. Registered BEFORE the static/SPA handlers so /blog and
// /_astro are intercepted instead of falling through to the React app.
const BLOG_ORIGIN = "https://litigaforge-blog.arif-806.workers.dev";
const _blogProxy = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    // redirect:"follow" so the Worker's /blog -> /blog/ trailing-slash redirect
    // is resolved server-side and the browser gets a single 200 response.
    const upstream = await fetch(BLOG_ORIGIN + req.originalUrl, {
      method: "GET",
      headers: {
        "user-agent": req.headers["user-agent"] ?? "",
        accept: req.headers["accept"] ?? "*/*",
        "accept-language": req.headers["accept-language"] ?? "",
      },
      redirect: "follow",
    });
    res.status(upstream.status);
    for (const h of ["content-type", "cache-control", "etag", "last-modified"]) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    logger.error({ err }, "blog proxy failed");
    res.status(502).send("Blog temporarily unavailable");
  }
};
// ── Blog 301 redirects (retired / deduplicated slugs) ─────────────────────
// Must run BEFORE the reverse-proxy: the proxy uses redirect:"follow", so a
// Worker-side _redirects rule would be flattened to a 200 at the old apex URL.
// Single-segment match only (/blog/:slug); the index (/blog) and asset paths
// fall through untouched. Destinations are always internal /blog paths.
app.get("/blog/:slug", (req, res, next) => {
  const dest = BLOG_REDIRECTS[req.params.slug];
  if (dest !== undefined) {
    res.redirect(301, dest ? `/blog/${dest}` : "/blog");
    return;
  }
  next();
});
app.get("/blog", _blogProxy);
app.get("/blog/{*splat}", _blogProxy);
app.get("/_astro/{*splat}", _blogProxy);

// ── LLM health proxy ──────────────────────────────────────────────────────
// The LiteLLM health/diagnostics endpoint lives in the Python (litigaforge-ai)
// service at {BASE_PATH}/llm/health. Mirror it under the conventional /api/llm/*
// namespace so /api/llm/health and /api/llm/health?probe=true behave exactly
// like /litigaforge/llm/health. ?probe=true runs a live LLM call (~48s, cached
// 5min server-side), hence the generous timeout. Registered after
// app.use("/api", router), which falls through for the otherwise-unhandled
// /api/llm/* paths.
const _LLM_ORIGIN = process.env.LITIGAFORGE_API_ORIGIN ?? "http://localhost:5000";
const _LLM_BASE =
  (process.env.BASE_PATH ?? "/litigaforge").replace(/\/+$/, "") || "/litigaforge";
const _llmProxy = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  const target =
    _LLM_ORIGIN + req.originalUrl.replace(/^\/api\//, _LLM_BASE + "/");
  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers: { accept: req.headers["accept"] ?? "application/json" },
      signal: AbortSignal.timeout(90_000),
    });
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    logger.error({ err }, "llm proxy failed");
    res
      .status(502)
      .json({ status: "error", detail: "LLM service temporarily unavailable" });
  }
};
app.get("/api/llm/health", _llmProxy);
app.get("/api/llm/{*splat}", _llmProxy);

// ── Frontend serving (production only) ───────────────────────────────────
// Node.js injects the correct meta tags so the CDN/static layer cannot
// override them. Only active when NODE_ENV=production and dist exists.
if (true) { // serve frontend in both dev and production when dist exists
  const _candidates = [
    resolve(process.cwd(), "artifacts/litigaforge-ui/dist/public"),
    resolve(process.cwd(), "../litigaforge-ui/dist/public"),
  ];
  const _frontendDist = _candidates.find(existsSync) ?? null;

  if (_frontendDist) {
    // Internal origin of the Python (litigaforge-ai) service for server-side
    // data fetches (judgment SEO + sitemap). Reached directly, NOT via proxy.
    const LF_API_ORIGIN = process.env.LITIGAFORGE_API_ORIGIN ?? "http://localhost:5000";
    const LF_API_BASE =
      (process.env.BASE_PATH ?? "/litigaforge").replace(/\/+$/, "") || "/litigaforge";

    // ── Dynamic sitemap.xml ────────────────────────────────────────────────
    // The static sitemap built into the UI covers the app pages. Blog articles
    // are auto-published to the Cloudflare Worker every 2 hours, so we enumerate
    // them at request time (crawling the blog index + any pagination) and merge
    // them into the static sitemap. Result is cached in-memory for 1h. If the
    // Worker can't be reached we fall back to the static file, so we never serve
    // an empty or broken sitemap. Registered BEFORE express.static so it wins
    // over the static sitemap.xml on disk.
    const _staticSitemapPath = resolve(_frontendDist, "sitemap.xml");
    const SITEMAP_TTL_MS = 60 * 60 * 1000;
    let _sitemapCache: { xml: string; at: number } | null = null;

    const _readStaticSitemap = (): string => {
      try {
        return readFileSync(_staticSitemapPath, "utf-8");
      } catch {
        return (
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          "  <url><loc>https://litigaforge.com/</loc></url>\n</urlset>\n"
        );
      }
    };

    // Crawl the blog index (and its pagination, whatever URL scheme it uses)
    // to collect every published article path. Scheme-agnostic: it follows any
    // /blog/<n> or /blog/page/<n> link it finds, so it stays complete as the
    // blog grows past a single index page. Bounded to 50 pages for safety.
    const _fetchBlogArticlePaths = async (): Promise<string[]> => {
      const found = new Set<string>();
      const visited = new Set<string>();
      const queue: string[] = ["/blog/"];
      const skipSeg = new Set([
        "page",
        "tag",
        "tags",
        "category",
        "categories",
        "author",
        "authors",
      ]);
      let pages = 0;
      while (queue.length > 0 && pages < 50) {
        const path = queue.shift()!;
        if (visited.has(path)) continue;
        visited.add(path);
        pages++;
        let html: string;
        try {
          const r = await fetch(BLOG_ORIGIN + path, {
            headers: { accept: "text/html" },
            redirect: "follow",
          });
          if (!r.ok) continue;
          html = await r.text();
        } catch {
          continue;
        }
        const hrefs = html.match(/href="([^"]+)"/g) ?? [];
        for (const raw of hrefs) {
          let p = raw.slice(6, -1);
          if (p.startsWith(BLOG_ORIGIN)) p = p.slice(BLOG_ORIGIN.length);
          if (p.startsWith("https://litigaforge.com"))
            p = p.slice("https://litigaforge.com".length);
          if (!p.startsWith("/blog/")) continue;
          p = (p.split("#")[0] ?? "").split("?")[0] ?? "";
          const article = p.match(/^\/blog\/([a-z0-9][a-z0-9-]*)\/?$/i);
          if (article) {
            const seg = article[1]!.toLowerCase();
            if (/^\d+$/.test(seg)) {
              const norm = `/blog/${seg}/`;
              if (!visited.has(norm)) queue.push(norm);
            } else if (!skipSeg.has(seg)) {
              found.add(`/blog/${seg}`);
            }
            continue;
          }
          const paged = p.match(/^\/blog\/page\/(\d+)\/?$/i);
          if (paged) {
            const norm = `/blog/page/${paged[1]}/`;
            if (!visited.has(norm)) queue.push(norm);
          }
        }
      }
      return [...found].sort();
    };

    // Pull the published judgment URLs (path + lastmod) from the Python service.
    interface JudgmentSitemapItem { path: string; lastmod?: string | null }
    const _fetchJudgmentSitemap = async (): Promise<JudgmentSitemapItem[]> => {
      try {
        const r = await fetch(`${LF_API_ORIGIN}${LF_API_BASE}/judgments/sitemap-data`, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(4000),
        });
        if (!r.ok) return [];
        const j = (await r.json()) as { items?: JudgmentSitemapItem[] };
        return Array.isArray(j.items) ? j.items : [];
      } catch {
        return [];
      }
    };

    const _buildSitemap = async (): Promise<string> => {
      const base = _readStaticSitemap();
      if (!base.includes("</urlset>")) return base;
      let blogPaths: string[] = [];
      let judgmentItems: JudgmentSitemapItem[] = [];
      try { blogPaths = await _fetchBlogArticlePaths(); } catch { blogPaths = []; }
      try { judgmentItems = await _fetchJudgmentSitemap(); } catch { judgmentItems = []; }

      const blogUrls = blogPaths
        .map(
          (p) =>
            `  <url>\n    <loc>https://litigaforge.com${p}</loc>\n` +
            "    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>",
        )
        .join("\n");
      const judgmentUrls = judgmentItems
        .map(
          (it) =>
            `  <url>\n    <loc>https://litigaforge.com${it.path}</loc>\n` +
            (it.lastmod ? `    <lastmod>${it.lastmod}</lastmod>\n` : "") +
            "    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>",
        )
        .join("\n");

      let inject = "";
      if (blogUrls)
        inject += `\n  <!-- Blog articles (auto-generated from the content pipeline) -->\n${blogUrls}`;
      if (judgmentUrls)
        inject += `\n  <!-- Daily Judgment Digest -->\n${judgmentUrls}`;
      if (!inject) return base;
      return base.replace("</urlset>", `${inject}\n</urlset>`);
    };

    app.get("/sitemap.xml", async (_req, res): Promise<void> => {
      try {
        const now = Date.now();
        if (!_sitemapCache || now - _sitemapCache.at > SITEMAP_TTL_MS) {
          _sitemapCache = { xml: await _buildSitemap(), at: now };
        }
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.send(_sitemapCache.xml);
      } catch (err) {
        logger.error({ err }, "sitemap generation failed — serving static");
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.send(_readStaticSitemap());
      }
    });

    // Read index.html once at startup and inject correct meta tags
    let _indexHtml: string;
    try {
      const _raw = readFileSync(resolve(_frontendDist, "index.html"), "utf-8");
      _indexHtml = _raw
        .replace(
          /<title>.*?<\/title>/,
          "<title>LitigaForge AI \u2014 Global Legal Platform</title>",
        )
        .replace(
          /<meta name="description"[^>]*>/,
          '<meta name="description" content="AI-powered lawyer matching, legal Q&amp;A, document analysis and free legal aid \u2014 available globally across India, US, UK, UAE, Australia and more." />',
        )
        .replace(
          /<meta property="og:image"[^>]*>/,
          '<meta property="og:image" content="https://litigaforge.com/opengraph.jpg" />',
        )
        .replace(
          /<meta name="twitter:image"[^>]*>/,
          '<meta name="twitter:image" content="https://litigaforge.com/opengraph.jpg" />',
        );
      logger.info({ path: _frontendDist }, "Frontend dist found — serving with meta injection");
    } catch (err) {
      logger.error({ err }, "Failed to read frontend index.html — skipping frontend serving");
      _indexHtml = "";
    }

    // Read bot-friendly static HTML once at startup
    let _staticBotHtml = "";
    try {
      _staticBotHtml = readFileSync(resolve(_frontendDist, "index-static.html"), "utf-8");
      logger.info("Bot-friendly index-static.html loaded");
    } catch {
      logger.warn("index-static.html not found — bots will receive the React app");
    }

    // Bot user-agents that should receive plain HTML instead of the React SPA
    const _botPattern = /Mediapartners-Google|AdsBot-Google|GPTBot|ClaudeBot|Claude-Web|PerplexityBot|Googlebot|bingbot|Applebot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|WhatsApp|Discord|AhrefsBot|SEMrushBot|MJ12bot|YandexBot|DuckDuckBot/i;

    // --- Per-route SEO for bot-facing static HTML ----------------------------
    // Crawlers receive a route-specific <title>, description, canonical and
    // <h1>/intro so each public page reads as its own page rather than a
    // duplicate of the homepage. Canonicals always resolve to the bare
    // (non-country-prefixed) URL listed in the sitemap, consolidating the
    // /in, /us, ... country variants onto a single canonical page.
    const _SITE_URL = "https://litigaforge.com";
    const _VALID_CC = new Set(["in", "us", "gb", "ae", "au", "ca", "sg", "de"]);
    const _CC_ALIASES = new Set([
      "uae", "emirates", "dubai", "usa", "america", "uk", "britain", "england",
      "india", "bharat", "australia", "aus", "canada", "can", "singapore",
      "sgp", "germany", "deutschland", "ger",
    ]);

    interface RouteSeoEntry {
      title: string;
      ogTitle: string;
      description: string;
      h1: string;
      intro: string;
      canonical?: string;
      bodyHtml?: string;
    }

    const _ROUTE_SEO: Record<string, RouteSeoEntry> = {
      "/ask": {
        title: "Free Legal Q&amp;A — Instant AI Answers | LitigaForge AI",
        ogTitle: "Free Legal Q&amp;A — Instant AI Answers",
        description:
          "Instant AI answers to legal questions, grounded in your laws. Free Q&amp;A — property, family, criminal, consumer and employment.",
        h1: "Ask a Legal Question — Get an Instant AI Answer",
        intro:
          "Type any legal question and LitigaForge AI gives you a clear, plain-language answer grounded in your jurisdiction's laws — free and instant. Browse a growing knowledge base of answered questions across property, family, criminal, consumer and employment law.",
      },
      "/review": {
        title: "AI Document Analyzer — Risk Score | LitigaForge AI",
        ogTitle: "AI Document Analyzer — Free Risk Check",
        description:
          "Get an AI risk score (0–100), missing clauses and recommendations for any contract, agreement, FIR or court notice. Free document analysis.",
        h1: "Analyze a Legal Document with AI",
        intro:
          "Upload or paste any legal document — rental agreement, employment contract, FIR, court notice or sale deed — and receive an AI risk score (0–100), a list of missing clauses, and clear recommendations. Free and instant.",
      },
      "/lawyers": {
        title: "Verified Lawyers — AI Lawyer Matching | LitigaForge AI",
        ogTitle: "Verified Lawyers — AI Lawyer Matching",
        description:
          "Verified lawyers matched by AI — 0–100 scores, plain-language explanations. Property, family, criminal, consumer and employment.",
        h1: "Find a Verified Lawyer for Your Case",
        intro:
          "Browse verified, rated advocates or post your case and let LitigaForge AI match you with the right lawyer — each scored 0–100 with a plain-language explanation of why they fit your legal issue, location and budget.",
      },
      "/judgments": {
        title: "Judgment Finder — Search Case Law | LitigaForge AI",
        ogTitle: "Judgment Finder — Search Case Law",
        description:
          "Search judgments by keyword, court or case number. Relevant precedents with citation links — free case law research.",
        h1: "Search Judgments &amp; Case Law",
        intro:
          "Find relevant court judgments and precedents by keyword, court name or case number. LitigaForge AI surfaces the most relevant case law with citation links so you can research your matter quickly.",
      },
      "/legal-aid": {
        title: "Free Legal Aid Finder — Eligibility &amp; Helplines | LitigaForge AI",
        ogTitle: "Free Legal Aid Finder — Eligibility &amp; Helplines",
        description:
          "Check eligibility for free legal aid and find contacts and helplines for your region. Legal help for everyone, regardless of income.",
        h1: "Find Free Legal Aid Near You",
        intro:
          "Check whether you qualify for free legal aid and get contact details and toll-free helplines for legal aid services in your region. Everyone deserves legal help, regardless of income.",
      },
      "/free-documents": {
        title: "Free Legal Document Templates — AI-Generated | LitigaForge AI",
        ogTitle: "Free Legal Document Templates — AI-Generated",
        description:
          "Generate free legal documents instantly — rental agreements, notices, affidavits, employment letters and NDAs, customized for your jurisdiction.",
        h1: "Free Legal Document Templates",
        intro:
          "Generate 10+ legal document templates instantly — rental agreements, legal notices, affidavits, employment letters and NDAs — each AI-generated and customized for your jurisdiction. Free to download, share and print.",
      },
      "/subscription": {
        title: "LitigaForge AI Plans — Free, Professional &amp; Advocate Pro",
        ogTitle: "LitigaForge AI Pricing &amp; Plans",
        description:
          "Compare plans: free legal tools, Professional for unlimited AI and priority matching, Advocate Pro for full lawyer practice management.",
        h1: "Plans &amp; Pricing",
        intro:
          "Start free with legal Q&amp;A, document analysis and judgment search. Upgrade to Professional for unlimited AI and priority lawyer matching, or Advocate Pro for full practice and case management.",
      },
      "/about": {
        title: "About LitigaForge AI — Our Mission &amp; Global Legal Platform",
        ogTitle: "About LitigaForge AI",
        description:
          "LitigaForge AI makes legal help affordable worldwide — AI lawyer matching, document analysis, instant Q&amp;A and free legal aid.",
        h1: "About LitigaForge AI",
        intro:
          "LitigaForge AI is on a mission to make legal help affordable and accessible to everyone. We combine AI with verified lawyers to deliver instant guidance, document analysis, case-law search and free legal aid worldwide.",
      },
      "/contact": {
        title: "Contact LitigaForge AI — Support &amp; Inquiries",
        ogTitle: "Contact LitigaForge AI",
        description:
          "Get in touch with the LitigaForge AI team for support, partnership or media inquiries. We are here to help with any questions about our legal platform.",
        h1: "Contact LitigaForge AI",
        intro:
          "Have a question, partnership idea or support request? Reach out to the LitigaForge AI team and we will get back to you. We are here to help you get the legal support you need.",
      },
      "/digest": {
        title: "Daily Judgment Digest — Top 5 by Email | LitigaForge AI",
        ogTitle: "Daily Judgment Digest — Free Email",
        description:
          "Subscribe free — get the 5 most important new judgments in your inbox each morning, each with a plain-language summary.",
        h1: "Get the Top 5 Judgments in Your Inbox Daily",
        intro:
          "Subscribe to the free daily judgment digest and receive the 5 most important new Supreme Court and High Court judgments every morning — each with a concise, plain-language summary and a link to the full analysis.",
      },
      "/privacy": {
        title: "Privacy Policy | LitigaForge AI",
        ogTitle: "Privacy Policy — LitigaForge AI",
        description:
          "Read the LitigaForge AI privacy policy: what data we collect, how we use and protect it, cookies and advertising, and the rights you have over your data.",
        h1: "Privacy Policy",
        intro:
          "This page explains what information LitigaForge AI collects, how we use and safeguard it, our use of cookies and advertising, and the rights you have over your data.",
      },
      "/privacy-policy": {
        title: "Privacy Policy | LitigaForge AI",
        ogTitle: "Privacy Policy — LitigaForge AI",
        description:
          "Read the LitigaForge AI privacy policy: what data we collect, how we use and protect it, cookies and advertising, and the rights you have over your data.",
        h1: "Privacy Policy",
        intro:
          "This page explains what information LitigaForge AI collects, how we use and safeguard it, our use of cookies and advertising, and the rights you have over your data.",
        canonical: "/privacy",
      },
      "/terms": {
        title: "Terms of Service | LitigaForge AI",
        ogTitle: "Terms of Service — LitigaForge AI",
        description:
          "Terms governing your use of LitigaForge AI — acceptable use, disclaimers and the limits of AI-generated legal information.",
        h1: "Terms of Service",
        intro:
          "These terms govern your use of LitigaForge AI. They cover acceptable use, important disclaimers, and the limits of the AI-generated legal information provided on this platform.",
      },
      "/refund-policy": {
        title: "Refund Policy | LitigaForge AI",
        ogTitle: "Refund Policy — LitigaForge AI",
        description:
          "LitigaForge AI refund policy for subscription plans — how billing, cancellations and refunds are handled.",
        h1: "Refund Policy",
        intro:
          "This page explains how LitigaForge AI handles subscription billing, cancellations and refunds for our Professional and Advocate Pro plans.",
      },
      "/us-demand-letter": {
        title: "U.S. Demand Letter — Draft &amp; Send | LitigaForge AI",
        ogTitle: "U.S. Demand Letter — Draft &amp; Send",
        description:
          "Draft a professional, state-specific U.S. demand letter for unpaid debts, broken contracts or damages. AI-drafted, ready to send.",
        h1: "U.S. Demand Letter",
        intro:
          "Owed money or wronged? Generate a firm, professional, state-specific demand letter that gets results — often resolving disputes before you ever go to court. Preview free, pay only when you're happy.",
      },
      "/login": {
        title: "Sign In | LitigaForge AI",
        ogTitle: "Sign In — LitigaForge AI",
        description:
          "Sign in to your LitigaForge AI account to access lawyer matching, your cases, AI legal tools and document analysis.",
        h1: "Sign In to LitigaForge AI",
        intro:
          "Log in to your LitigaForge AI account to manage your cases, message matched lawyers, and use our AI-powered legal tools.",
      },
      "/register": {
        title: "Create a Free Account | LitigaForge AI",
        ogTitle: "Create a Free Account — LitigaForge AI",
        description:
          "Create a free LitigaForge AI account to ask legal questions, analyze documents, and get matched with verified lawyers. No credit card required.",
        h1: "Create Your Free LitigaForge AI Account",
        intro:
          "Sign up free to ask legal questions, analyze documents, find verified lawyers, and access AI-powered legal tools. No credit card required to start.",
      },
    };

    // Route-specific body content injected after the intro paragraph so each
    // crawler-facing page leads with substantial unique content instead of the
    // shared homepage feature directory. Keyed by the bare (non-country) path.
    // Keeps the shared <nav>/footer links below for crawl depth, but the
    // primary content of each page is now distinct, fixing the "every page
    // reads like the homepage" duplication problem for no-JS crawlers.
    const _ROUTE_BODY: Record<string, string> = {
      "/ask":
        "<h2>How AI Legal Q&amp;A works</h2>" +
        "<p>Describe your situation in plain language and LitigaForge AI returns a structured answer: the legal principles that apply, the practical steps you can take, and when you should speak to a lawyer. Every answer is tailored to your jurisdiction and written so a non-lawyer can act on it.</p>" +
        "<p>Questions our community has already answered include wrongful termination and notice periods, security-deposit and rent disputes, refunds for defective goods, child-custody factors, and how to respond to a legal notice. Browse the knowledge base by category or ask your own question free — no account needed to start.</p>",
      "/review":
        "<h2>What the document analyzer checks</h2>" +
        "<p>Paste a contract, agreement, notice or court document and LitigaForge AI returns an overall risk score from 0 to 100, a list of clauses that are missing or one-sided, and specific recommendations to act on before you sign or reply.</p>" +
        "<p>It works on rental and lease agreements, employment contracts and offer letters, non-disclosure agreements, sale deeds, loan and service agreements, FIRs and court notices — analyzed instantly and free.</p>",
      "/lawyers":
        "<h2>How lawyer matching works</h2>" +
        "<p>Tell us your case type, location and budget and LitigaForge AI ranks verified advocates from 0 to 100, with a plain-language explanation of why each lawyer fits your matter. You stay in control — review profiles, ratings and practice areas before you connect.</p>" +
        "<p>Every advocate carries a verification status, so you can see who has confirmed Bar credentials. Browse by practice area — property, family, criminal, consumer, employment, corporate — or post your case and let qualified lawyers come to you.</p>",
      "/judgments":
        "<h2>Research case law faster</h2>" +
        "<p>Search reported judgments by keyword, party name, court or citation and LitigaForge AI surfaces the most relevant precedents with links to the full text. Each result includes a concise, plain-language summary so you can decide quickly whether a case is on point.</p>" +
        "<p>Use it to find Supreme Court and High Court authority for an argument, to track how courts treat a particular issue, or to prepare for a hearing. Save the judgments you care about to build a research portfolio you can revisit.</p>",
      "/legal-aid":
        "<h2>Free and low-cost legal help</h2>" +
        "<p>Answer a few questions about your income, circumstances and case type, and the Free Legal Aid finder tells you whether you are likely to qualify for state-funded or pro-bono assistance in your region.</p>" +
        "<p>You also get direct contact details and toll-free helplines for legal-aid authorities near you. Everyone deserves access to justice, regardless of their ability to pay.</p>",
      "/free-documents":
        "<h2>Ready-to-file legal templates</h2>" +
        "<p>Choose a template, answer a short guided form, and LitigaForge AI generates a complete, jurisdiction-aware legal document you can download, share or print — no subscription required for the free templates.</p>" +
        "<p>Available documents include rental and lease agreements, legal notices, affidavits, employment and appointment letters, non-disclosure agreements and demand letters — each drafted in clear language and customized to the details you provide.</p>",
      "/subscription":
        "<h2>Plans for every need</h2>" +
        "<p>Start free with legal Q&amp;A, document analysis, judgment search, the free legal-aid finder and the advocate directory. Upgrade only when you need more.</p>" +
        "<p>Professional unlocks unlimited AI queries and priority lawyer matching for individuals and small businesses. Advocate Pro adds full practice management — client and case tracking, a document workspace and hearing reminders — for working lawyers. Prices are shown in your local currency at checkout.</p>",
      "/digest":
        "<h2>Stay current in five minutes a day</h2>" +
        "<p>Each morning the daily judgment digest delivers the five most important new Supreme Court and High Court decisions to your inbox, each with a concise summary and a link to the full analysis. It is free, and you can unsubscribe at any time.</p>",
      "/us-demand-letter":
        "<h2>Send a demand letter that gets results</h2>" +
        "<p>Answer a few questions about what you are owed and LitigaForge AI drafts a firm, professional, state-specific demand letter — the kind that often resolves a dispute before it ever reaches court. Preview the full letter free and pay only when you are happy with it.</p>" +
        "<p>Use it for unpaid invoices and debts, broken contracts, withheld security deposits, or property and service damages. A clear, well-structured demand shows the other side you are serious.</p>",
      "/about":
        "<h2>Why we built LitigaForge AI</h2>" +
        "<p>Legal help is too expensive and too confusing for most people. LitigaForge AI combines artificial intelligence with verified human lawyers to give individuals and small businesses instant, affordable, plain-language guidance — and a clear path to a professional when they need one.</p>" +
        "<p>The platform spans eight countries and multiple languages, offering legal Q&amp;A, document analysis, case-law research, ready-to-file documents and a free legal-aid finder in one place.</p>",
      "/contact":
        "<h2>We&apos;re here to help</h2>" +
        "<p>Whether you have a support question, a partnership proposal or a media request, the LitigaForge AI team is glad to hear from you. Send us a message and we will get back to you as soon as we can.</p>",
    };

    // ─── Per-route JSON-LD ────────────────────────────────────────────────────
    // _jld: serialise an object as a <script type="application/ld+json"> block
    // with < escaped so it is safe inside HTML.
    const _jld = (obj: object): string =>
      `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

    // _bc2: BreadcrumbList for a two-level path (Home > Label)
    const _bc2 = (path: string, label: string): string =>
      _jld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: _SITE_URL },
          { "@type": "ListItem", position: 2, name: label, item: `${_SITE_URL}${path}` },
        ],
      });

    // Each value is raw HTML (<script> blocks) injected before </head> for bots.
    const _ROUTE_JSONLD: Record<string, string> = {

      "/ask": [
        _jld({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "What should I do if someone files a false FIR against me in India?", acceptedAnswer: { "@type": "Answer", text: "Immediately apply for anticipatory bail under Section 438 CrPC before arrest. File a complaint under Section 182 IPC (false information to a public servant) or Section 211 IPC (false charge of offence) against the complainant. Petition the relevant High Court under Section 482 CrPC to quash the FIR. Collect evidence disproving the allegations — CCTV footage, witnesses, phone records — and consult a criminal lawyer immediately." } },
            { "@type": "Question", name: "How do I file a cheque bounce case under Section 138 of the Negotiable Instruments Act?", acceptedAnswer: { "@type": "Answer", text: "After receiving the bank's dishonour memo, send a legal demand notice to the drawer within 30 days. If the drawer does not pay within 15 days of receiving your notice, file a complaint in the Magistrate Court (where the cheque was drawn or presented) within 30 days of the 15-day deadline. Attach the original cheque, dishonour memo, demand notice, and proof of service. The drawer faces imprisonment up to 2 years or a fine up to twice the cheque amount. Settlement is possible at any stage." } },
            { "@type": "Question", name: "How do I file a consumer complaint in India?", acceptedAnswer: { "@type": "Answer", text: "File with the Consumer Disputes Redressal Commission: District Commission for claims up to ₹50 lakh, State Commission for ₹50 lakh–₹2 crore, and NCDRC for claims above ₹2 crore. File online at edaakhil.nic.in within 2 years of the deficiency or defect. Attach purchase receipts, warranty documents, company correspondence, and evidence of loss." } },
            { "@type": "Question", name: "Can I get a stay order to stop a property demolition in India?", acceptedAnswer: { "@type": "Answer", text: "Yes. File a writ petition or civil suit in the High Court or relevant civil court seeking a temporary injunction under Order 39 Rules 1 and 2 of CPC. You need to show a prima facie case, balance of convenience in your favour, and that irreparable harm will result without a stay. Courts can grant an ex parte interim stay immediately if urgency is shown. File within days of receiving a demolition notice — delay defeats the relief." } },
            { "@type": "Question", name: "What are my rights if my employer does not pay my salary in India?", acceptedAnswer: { "@type": "Answer", text: "If your employer withholds salary: (1) send a legal demand notice, (2) file a complaint under the Payment of Wages Act with the Payment of Wages Authority (for salaries up to ₹24,000/month), (3) file a Labour Court application under Section 33C(2) of the Industrial Disputes Act, or (4) approach the State Labour Commissioner. You are entitled to payment with compensation for delay. Senior employees can file a civil suit for recovery of dues." } },
            { "@type": "Question", name: "How do I respond to an income tax notice in India?", acceptedAnswer: { "@type": "Answer", text: "Identify the section: 143(1) (intimation), 143(2) (scrutiny), 148 (income escaping assessment), or 156 (demand). Respond by the due date — extensions can be requested. Attach all supporting documents: ITR, Form 16, bank statements, investment proofs. For complex cases, engage a CA or tax lawyer. Ignoring a notice can result in best judgment assessment, penalties, and prosecution." } },
            { "@type": "Question", name: "How do I register a cybercrime complaint in India?", acceptedAnswer: { "@type": "Answer", text: "File online at cybercrime.gov.in (National Cybercrime Reporting Portal) or visit your nearest Cyber Crime Police Station. For financial fraud, call the National Cyber Crime Helpline 1930 immediately — early reporting can freeze fraudulent transactions. Preserve all evidence: screenshots, emails, transaction IDs, phone numbers. For hacking or data theft, also file an FIR under the Information Technology Act 2000." } },
            { "@type": "Question", name: "What are the grounds for divorce in India under Hindu law?", acceptedAnswer: { "@type": "Answer", text: "Under the Hindu Marriage Act 1955, grounds include: cruelty (physical or mental), desertion for 2+ years, conversion to another religion, unsoundness of mind, virulent and incurable leprosy, venereal disease, renunciation of the world, and presumption of death (missing 7+ years). For mutual consent divorce under Section 13B, both parties must have lived separately for at least 1 year and agree on all terms including property, maintenance, and custody." } },
            { "@type": "Question", name: "What happens if I ignore a legal notice sent to me?", acceptedAnswer: { "@type": "Answer", text: "Ignoring a legal notice typically leads to the sender filing a lawsuit. For cheque bounce notices, failing to respond within 15 days allows the sender to file a criminal complaint. For consumer disputes and employment claims, the other party can obtain an ex parte court order in your absence. Silence can be treated as admission in some contexts. Always consult a lawyer and send a formal reply within the specified time." } },
            { "@type": "Question", name: "How do I claim compensation after a road accident in India?", acceptedAnswer: { "@type": "Answer", text: "File a claim petition with the Motor Accidents Claims Tribunal (MACT) in the jurisdiction where the accident occurred or where the claimant resides. Attach the FIR, medical reports, disability certificate, proof of income, and insurance details. Third-party insurance is mandatory under the Motor Vehicles Act — the insurer of the at-fault vehicle is liable. There is no limitation period for MACT claims but early filing is advisable." } },
          ],
        }),
        _bc2("/ask", "Free Legal Q&A"),
      ].join("\n"),

      "/lawyers": [
        _jld({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "LegalService",
              name: "LitigaForge AI — Verified Lawyer Directory & AI Matching",
              url: `${_SITE_URL}/lawyers`,
              description: "Find and connect with verified, rated advocates across India, the US, UK, UAE, Australia, Canada, Singapore and Germany. AI lawyer matching with transparent 0–100 match scores and plain-language explanations.",
              serviceType: ["Lawyer Matching", "Legal Consultation", "Advocate Directory"],
              areaServed: ["India","United States","United Kingdom","Australia","Canada","Singapore","United Arab Emirates","Germany"],
              provider: { "@type": "Organization", name: "LitigaForge AI", url: _SITE_URL },
              availableChannel: { "@type": "ServiceChannel", serviceUrl: `${_SITE_URL}/lawyers`, serviceType: "Online", availableLanguage: ["English","Hindi","Telugu"] },
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "How much does a lawyer cost in India?", acceptedAnswer: { "@type": "Answer", text: "Lawyer fees in India vary by city, specialization, and experience. Junior advocates charge ₹500–₹2,000 per consultation. Senior and specialist advocates charge ₹2,000–₹15,000 per hour. For full case representation, fees range from ₹10,000 to several lakhs depending on court level and complexity. High Court and Supreme Court advocates typically charge more. LitigaForge shows each lawyer's hourly rate so you can match within your budget." } },
                { "@type": "Question", name: "What type of lawyer do I need for a property dispute in India?", acceptedAnswer: { "@type": "Answer", text: "For property disputes in India, you need a civil lawyer specializing in property law or real estate litigation. For RERA disputes (developer delays or defects), find a RERA specialist. For landlord-tenant disputes, a civil or rent control specialist is appropriate. For title fraud, a criminal lawyer with property experience may also be needed. LitigaForge AI automatically recommends the right specialization when you describe your case." } },
                { "@type": "Question", name: "How do I verify a lawyer's credentials before hiring in India?", acceptedAnswer: { "@type": "Answer", text: "Verify a lawyer's Bar Council enrollment number on the State Bar Council website (e.g., barcouncilofap.org for Telangana and AP). On LitigaForge AI, every listed advocate displays their Bar enrollment number and a verification badge after our credential check — you see their practice areas, experience, client ratings and consultation fee before connecting." } },
                { "@type": "Question", name: "Can I consult a lawyer online in India?", acceptedAnswer: { "@type": "Answer", text: "Yes. Online consultations are widely accepted in India. On LitigaForge AI, post your case, get matched with verified advocates, and communicate via secure in-platform chat. For initial advice, document review and legal notices, online consultations are fully effective. Physical court appearances by the lawyer are required for representation, but case strategy can be handled remotely." } },
              ],
            },
          ],
        }),
        _bc2("/lawyers", "Find a Verified Lawyer"),
      ].join("\n"),

      "/judgments": [
        _jld({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Dataset",
              name: "LitigaForge AI — Indian Court Judgment Database",
              url: `${_SITE_URL}/judgments`,
              description: "Searchable database of Supreme Court of India and High Court judgments with AI-generated plain-language summaries. Updated daily via official legal databases.",
              creator: { "@type": "Organization", name: "LitigaForge AI", url: _SITE_URL },
              inLanguage: ["en", "hi"],
              keywords: ["Indian case law", "Supreme Court judgments", "High Court judgments", "legal precedents", "court decisions India"],
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "How do I find a Supreme Court judgment in India by keyword?", acceptedAnswer: { "@type": "Answer", text: "On LitigaForge AI's Judgment Finder, type the keyword, party names, legal principle or case number. The AI returns the most relevant Supreme Court and High Court judgments with plain-language summaries and citation links to IndianKanoon and the Supreme Court's official website (sci.gov.in). You can filter by court and year, and save results to your research portfolio." } },
                { "@type": "Question", name: "Is a High Court judgment binding on lower courts in India?", acceptedAnswer: { "@type": "Answer", text: "Yes. A High Court judgment is binding on all subordinate courts within its jurisdiction under Article 227 of the Constitution. A Supreme Court judgment under Article 141 is binding on all courts in India. Judgments of coordinate benches (same court, same number of judges) are persuasive. High Court judgments from other states are persuasive authority only." } },
                { "@type": "Question", name: "How do I cite an Indian court judgment correctly?", acceptedAnswer: { "@type": "Answer", text: "Standard Indian citation format: Party v. Party, (Year) Volume Reporter Page (Court). Example: Maneka Gandhi v. Union of India, (1978) 1 SCC 248 (SC). For AIR citations: Party v. Party, AIR Year Court Page. For unreported judgments, cite the case number and date. LitigaForge AI's Judgment Finder shows the correct citation for each case in the summary panel." } },
              ],
            },
          ],
        }),
        _bc2("/judgments", "Judgment Finder"),
      ].join("\n"),

      "/legal-aid": [
        _jld({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "GovernmentService",
              name: "Free Legal Aid Finder — India & Worldwide",
              url: `${_SITE_URL}/legal-aid`,
              description: "Check eligibility for free legal aid under the Legal Services Authorities Act 1987 and find NALSA, TSLSA, DLSA contacts and toll-free helplines for your region.",
              provider: { "@type": "Organization", name: "LitigaForge AI", url: _SITE_URL },
              serviceType: "Legal Aid",
              areaServed: [{ "@type": "Country", name: "India" }],
              serviceChannel: { "@type": "ServiceChannel", serviceUrl: `${_SITE_URL}/legal-aid`, serviceType: "Online" },
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "Who is eligible for free legal aid in India under NALSA?", acceptedAnswer: { "@type": "Answer", text: "Under the Legal Services Authorities Act 1987, free legal aid is available to: (1) Scheduled Caste and Scheduled Tribe members, (2) victims of trafficking or beggars, (3) women and children, (4) persons with disabilities, (5) persons in custody, (6) victims of mass disasters, caste atrocity, flood, or industrial disaster, (7) industrial workmen, and (8) persons with annual income below ₹1 lakh (limit varies by state). Call NALSA helpline 15100 (toll-free) to apply." } },
                { "@type": "Question", name: "How do I apply for free legal aid in Telangana?", acceptedAnswer: { "@type": "Answer", text: "Contact the Telangana State Legal Services Authority (TSLSA) at 040-23450039 or visit your nearest District Legal Services Authority (DLSA) office. Submit an application with proof of identity, an income certificate, and case details. Legal aid includes court representation, document drafting, and legal advice. You can also apply through the NALSA mobile app or call 15100." } },
                { "@type": "Question", name: "Is there free legal aid for domestic violence cases in India?", acceptedAnswer: { "@type": "Answer", text: "Yes. Under the Protection of Women from Domestic Violence Act 2005, victims are entitled to free legal services. The Protection Officer in your district is required to help you access legal aid. NALSA has dedicated schemes for women victims. All DLSAs provide free lawyers for DV cases. Call 15100 to be connected with the nearest domestic violence legal aid service." } },
                { "@type": "Question", name: "What is Lok Adalat and how does it settle disputes faster?", acceptedAnswer: { "@type": "Answer", text: "Lok Adalat (People's Court) is a form of alternative dispute resolution under the Legal Services Authorities Act. Awards are treated as civil court decrees and are final — no appeal lies. No court fees are charged, and fees already paid are refunded if the case is settled. Lok Adalats are ideal for motor accident claims, matrimonial disputes (except divorce), labour disputes, and pre-litigation settlements. Contact your DLSA to schedule a Lok Adalat." } },
              ],
            },
          ],
        }),
        _bc2("/legal-aid", "Free Legal Aid"),
      ].join("\n"),

      "/free-documents": [
        _jld({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "ItemList",
              name: "Free AI-Generated Legal Document Templates",
              url: `${_SITE_URL}/free-documents`,
              description: "10+ free legal document templates generated instantly by AI — rental agreements, legal notices, affidavits, employment letters, NDAs — customized for your jurisdiction.",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Rental Agreement", url: `${_SITE_URL}/free-documents` },
                { "@type": "ListItem", position: 2, name: "Legal Notice", url: `${_SITE_URL}/free-documents` },
                { "@type": "ListItem", position: 3, name: "Affidavit", url: `${_SITE_URL}/free-documents` },
                { "@type": "ListItem", position: 4, name: "Non-Disclosure Agreement (NDA)", url: `${_SITE_URL}/free-documents` },
                { "@type": "ListItem", position: 5, name: "Employment Appointment Letter", url: `${_SITE_URL}/free-documents` },
                { "@type": "ListItem", position: 6, name: "Sale Agreement", url: `${_SITE_URL}/free-documents` },
                { "@type": "ListItem", position: 7, name: "Demand Letter", url: `${_SITE_URL}/free-documents` },
                { "@type": "ListItem", position: 8, name: "Partnership Agreement", url: `${_SITE_URL}/free-documents` },
                { "@type": "ListItem", position: 9, name: "Power of Attorney", url: `${_SITE_URL}/free-documents` },
                { "@type": "ListItem", position: 10, name: "Divorce Settlement Agreement", url: `${_SITE_URL}/free-documents` },
              ],
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "Is a rental agreement on plain paper legally valid in India?", acceptedAnswer: { "@type": "Answer", text: "A rental agreement on plain paper is valid for tenancies up to 11 months — such agreements are not required to be registered and are enforceable. For tenancies of 12 months or more, the agreement must be on stamp paper of the appropriate denomination (varies by state) and registered with the Sub-Registrar's office to be admissible as evidence in court. LitigaForge AI generates correctly valued and formatted agreements for your state." } },
                { "@type": "Question", name: "How do I write a valid legal notice in India?", acceptedAnswer: { "@type": "Answer", text: "A valid legal notice must include: (1) full names and addresses of sender and recipient, (2) facts giving rise to the cause of action, (3) the specific legal right violated or relief claimed, (4) the amount or action demanded, (5) a clear compliance deadline (typically 15–30 days), and (6) a statement that legal proceedings will follow if not complied with. For cheque bounce and consumer disputes, there are additional statutory requirements. Notices sent by a lawyer carry greater evidential weight." } },
                { "@type": "Question", name: "What is the difference between an affidavit and a declaration?", acceptedAnswer: { "@type": "Answer", text: "An affidavit is a sworn written statement made on oath before a notary public or magistrate — it can be used as evidence in court proceedings. A declaration is a self-attested statement without an oath — it carries less legal weight and is typically used for administrative purposes such as government applications. For court use, probate, property disputes, and customs declarations, always use a notarized affidavit on the correct denomination of stamp paper." } },
              ],
            },
          ],
        }),
        _bc2("/free-documents", "Free Legal Document Templates"),
      ].join("\n"),

      "/review": [
        _jld({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              name: "LitigaForge AI Document Analyzer",
              url: `${_SITE_URL}/review`,
              applicationCategory: "LegalService",
              operatingSystem: "Web",
              description: "AI-powered legal document analysis tool. Paste any contract, agreement, FIR or court notice and receive an instant risk score (0–100), missing clause detection, and actionable recommendations. Free.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "INR", description: "Free document analysis — no account required" },
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "What makes a rental agreement risky in India?", acceptedAnswer: { "@type": "Answer", text: "High-risk clauses include: unlimited rent increases without notice, no termination notice period for the landlord, blanket permission for entry at any time, liability for pre-existing structural damage, forfeiture of full security deposit for any breach, and 'deemed renewal' lock-in clauses. Missing clauses that increase risk: no maintenance responsibility allocation, no definition of normal wear and tear, no dispute resolution mechanism." } },
                { "@type": "Question", name: "What clauses should be in an employment contract in India?", acceptedAnswer: { "@type": "Answer", text: "A legally sound Indian employment contract must include: job title and responsibilities, full CTC breakup (fixed and variable), probation period, notice period (30–90 days), confidentiality and IP assignment clause, leave entitlement per the Shops and Establishments Act, grounds for termination, governing law, and dispute resolution. Watch for: unenforceable overly broad non-compete clauses, vague 'at will' termination, and missing gratuity or PF references." } },
                { "@type": "Question", name: "What should I check before signing a property sale deed in India?", acceptedAnswer: { "@type": "Answer", text: "Before signing: (1) verify clear title chain for at least 30 years, (2) obtain an encumbrance certificate from the Sub-Registrar showing no mortgages or liens, (3) confirm property tax is up to date, (4) check RERA registration for under-construction property, (5) verify building plan sanction and occupancy certificate, (6) confirm correct stamp duty at state circle rate, (7) check mutation in local body records. A property lawyer's due-diligence report is essential." } },
              ],
            },
          ],
        }),
        _bc2("/review", "AI Document Analyzer"),
      ].join("\n"),

      "/subscription": [
        _jld({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "What is included in the free plan on LitigaForge AI?", acceptedAnswer: { "@type": "Answer", text: "The free plan includes: 5 AI legal Q&A queries per month, document analysis (risk scoring and missing clause detection), judgment search, the free legal aid finder, full access to the verified lawyer directory, and free legal document templates. No credit card required. The free plan is permanent — upgrade only when you need more AI queries or priority matching." } },
            { "@type": "Question", name: "What does the Professional plan include?", acceptedAnswer: { "@type": "Answer", text: "Professional includes: unlimited AI legal Q&A queries, unlimited document analysis, priority lawyer matching (your case is shown to more advocates faster), document upload and management, and all free plan features. Pricing is in your local currency — INR, USD, GBP, EUR, AED, AUD, CAD, or SGD — shown at checkout." } },
            { "@type": "Question", name: "What is the Advocate Pro plan and who needs it?", acceptedAnswer: { "@type": "Answer", text: "Advocate Pro is designed for practicing lawyers. It includes everything in Professional plus: full case management (CNR integration, hearing dates, case stage tracking), client document workspace, billing tools, hearing date reminders, and a public verified advocate profile visible to potential clients." } },
            { "@type": "Question", name: "Can I get a refund if I cancel my LitigaForge AI subscription?", acceptedAnswer: { "@type": "Answer", text: "LitigaForge AI offers a prorated refund for unused days if you cancel within the first 7 days of a billing period. After 7 days, the subscription continues until the end of the cycle and is not refunded. To cancel or request a refund, email support@litigaforge.com." } },
          ],
        }),
        _bc2("/subscription", "Pricing & Plans"),
      ].join("\n"),

      "/about": [
        _jld({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          url: `${_SITE_URL}/about`,
          name: "About LitigaForge AI",
          description: "LitigaForge AI is an AI-powered legal platform founded in 2024. Our mission: make legal help affordable and accessible worldwide through AI lawyer matching, document analysis, free legal Q&A, and a free legal aid finder.",
          mainEntity: {
            "@type": "Organization",
            name: "LitigaForge AI",
            url: _SITE_URL,
            foundingDate: "2024",
            description: "LitigaForge AI combines artificial intelligence with verified lawyers to deliver instant, affordable legal guidance to individuals and businesses worldwide — spanning 8 countries and multiple languages.",
            areaServed: ["India","United States","United Kingdom","Australia","Canada","Singapore","United Arab Emirates","Germany"],
          },
        }),
        _bc2("/about", "About LitigaForge AI"),
      ].join("\n"),

      "/digest": [
        _jld({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "What is the LitigaForge AI Daily Judgment Digest?", acceptedAnswer: { "@type": "Answer", text: "The Daily Judgment Digest is a free email newsletter delivering the 5 most important new Supreme Court and High Court judgments to your inbox every morning. Each judgment includes a concise plain-language summary and a link to the full analysis. It is free and you can unsubscribe at any time." } },
            { "@type": "Question", name: "When is the daily judgment digest delivered?", acceptedAnswer: { "@type": "Answer", text: "The digest is delivered daily at approximately 7:00 AM IST. It covers significant judgments published by the Supreme Court of India, all High Courts, and key tribunals from the previous working day." } },
            { "@type": "Question", name: "How do I subscribe to the free legal judgment digest?", acceptedAnswer: { "@type": "Answer", text: "Visit litigaforge.com/digest, enter your email address and confirm via the verification link sent to your inbox. No credit card or account required. Unsubscribe at any time using the one-click link in any digest email." } },
          ],
        }),
        _bc2("/digest", "Daily Judgment Digest"),
      ].join("\n"),

      "/us-demand-letter": [
        _jld({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "HowTo",
              name: "How to Write and Send a Demand Letter in the United States",
              description: "Step-by-step guide to drafting and sending an effective demand letter to resolve a U.S. dispute before court.",
              totalTime: "PT20M",
              step: [
                { "@type": "HowToStep", position: 1, name: "Identify your legal claim", text: "State the specific legal basis — breach of contract, unpaid debt, security deposit withholding, or property damage. Include dates, amounts owed, and relevant contract clauses." },
                { "@type": "HowToStep", position: 2, name: "Calculate the exact amount owed", text: "Add the principal amount, applicable interest per your contract or state law, late fees, and any provable consequential damages. Attach supporting documents." },
                { "@type": "HowToStep", position: 3, name: "Draft the demand letter", text: "Use LitigaForge AI's demand letter generator — answer a short form about your claim, state, and recipient. The AI drafts a professional, state-specific letter with correct legal references and a firm tone." },
                { "@type": "HowToStep", position: 4, name: "Set a firm deadline", text: "Give the recipient 10–30 days to comply. State that failure will result in legal action including small claims court or civil lawsuit, and that you will seek attorney fees where allowed by state law." },
                { "@type": "HowToStep", position: 5, name: "Send by certified mail and preserve proof", text: "Send via USPS Certified Mail with return receipt, or by email with read receipt if specified in the contract. Keep all delivery proof for court filings." },
              ],
            },
            {
              "@type": "LegalService",
              name: "U.S. Demand Letter Drafting — LitigaForge AI",
              url: `${_SITE_URL}/us-demand-letter`,
              description: "AI-drafted, state-specific U.S. demand letters for unpaid debts, contract breaches, security deposit disputes, and property damage claims. Preview free, pay on approval.",
              serviceType: "Demand Letter Drafting",
              areaServed: { "@type": "Country", name: "United States" },
              provider: { "@type": "Organization", name: "LitigaForge AI", url: _SITE_URL },
            },
          ],
        }),
        _bc2("/us-demand-letter", "U.S. Demand Letter"),
      ].join("\n"),

      "/register":    _bc2("/register", "Create Free Account"),
      "/login":       _bc2("/login", "Sign In"),
      "/contact":     _bc2("/contact", "Contact Us"),
      "/privacy":     _bc2("/privacy", "Privacy Policy"),
      "/privacy-policy": _bc2("/privacy-policy", "Privacy Policy"),
      "/terms":       _bc2("/terms", "Terms of Service"),
      "/refund-policy": _bc2("/refund-policy", "Refund Policy"),
    };

    const _stripCountry = (p: string): string => {
      const parts = p.replace(/^\/+/, "").split("/");
      const first = (parts[0] ?? "").toLowerCase();
      if (
        first &&
        (_VALID_CC.has(first) || _CC_ALIASES.has(first) || /^[a-z]{2}$/.test(first))
      ) {
        parts.shift();
      }
      return "/" + parts.join("/");
    };

    const _titleCase = (s: string): string =>
      s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const _routeSeo = (
      bare: string,
    ): (RouteSeoEntry & { canonicalPath: string }) | null => {
      if (bare === "/" || bare === "") return null;
      const direct = _ROUTE_SEO[bare];
      if (direct)
        return {
          ...direct,
          canonicalPath: direct.canonical ?? bare,
          bodyHtml: _ROUTE_BODY[bare],
        };
      const m = bare.match(/^\/lawyers\/([a-z][a-z-]*)$/);
      if (m) {
        const city = _titleCase(m[1] ?? "");
        return {
          title: `Lawyers in ${city} — Verified Advocates | LitigaForge AI`,
          ogTitle: `Lawyers in ${city} | LitigaForge AI`,
          description: `Find and connect with verified, rated lawyers in ${city}. AI-powered lawyer matching with transparent 0–100 match scores. Free to start.`,
          h1: `Verified Lawyers in ${city}`,
          intro: `Connect with experienced, verified advocates in ${city}. LitigaForge AI matches you with the right lawyer for your case — each scored 0–100 with a plain-language explanation of the fit.`,
          bodyHtml:
            `<h2>Legal help in ${city}</h2>` +
            `<p>LitigaForge AI connects you with verified, rated advocates practising in ${city} across property, family, criminal, consumer, employment and corporate law. Describe your case and get matched in minutes — each lawyer scored 0–100 for fit, with a plain-language explanation. Prefer to browse first? Review profiles, credentials and ratings before you reach out.</p>`,
          canonicalPath: bare,
        };
      }
      const p = bare.match(/^\/profile\/([a-z][a-z0-9_]{2,29})\/research$/);
      if (p) {
        const handle = p[1] ?? "";
        return {
          title: `@${handle}'s Legal Research Portfolio | LitigaForge AI`,
          ogTitle: `@${handle}'s Legal Research Portfolio`,
          description: `Browse the legal research portfolio of @${handle} on LitigaForge AI — saved court judgments and case-law notes, with a running count of cases researched.`,
          h1: `@${handle}'s Legal Research Portfolio`,
          intro: `A public collection of court judgments and case law saved by @${handle} on LitigaForge AI, each with personal research notes. Explore the precedents they're studying and the cases they've researched.`,
          canonicalPath: bare,
        };
      }
      return null;
    };

    // ── hreflang helper ───────────────────────────────────────────────────────
    // Generates <link rel="alternate" hreflang="..."> tags for all country
    // variants so Google treats /in/ask, /us/ask etc. as region-targeted
    // pages rather than duplicate content.
    const _CC_HREFLANG: [string, string][] = [
      ["in", "en-IN"], ["us", "en-US"], ["gb", "en-GB"], ["ae", "en-AE"],
      ["au", "en-AU"], ["ca", "en-CA"], ["sg", "en-SG"], ["de", "en-DE"],
    ];
    const _hreflangTags = (bare: string): string => {
      // Skip per-judgment detail pages; they are India-specific and don't
      // have meaningful country variants.
      if (/^\/judgments\/[^/]+\/\d{4}\/[^/]+$/.test(bare)) return "";
      const barePath = bare === "/" ? "" : bare;
      const base = `${_SITE_URL}${barePath}`;
      return [
        `<link rel="alternate" hreflang="en" href="${base}"/>`,
        ..._CC_HREFLANG.map(
          ([cc, lang]) =>
            `<link rel="alternate" hreflang="${lang}" href="${_SITE_URL}/${cc}${barePath}"/>`,
        ),
        `<link rel="alternate" hreflang="x-default" href="${base}"/>`,
      ].join("\n");
    };

    const _botHtmlForPath = (reqPath: string): string => {
      if (!_staticBotHtml) return _indexHtml;
      let bare = _stripCountry(reqPath);
      if (bare.length > 1) bare = bare.replace(/\/+$/, "");
      const meta = _routeSeo(bare);
      if (!meta) return _staticBotHtml; // homepage — hreflang in static HTML is already correct
      const canonical = `${_SITE_URL}${meta.canonicalPath}`;
      // Function replacers (not string replacers) so that any `$` in the copy
      // is treated literally and never interpreted as a replacement pattern.
      return _staticBotHtml
        .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${meta.title}</title>`)
        .replace(
          /<meta name="description"[^>]*>/,
          () => `<meta name="description" content="${meta.description}"/>`,
        )
        .replace(
          /<link rel="canonical"[^>]*>/,
          () => `<link rel="canonical" href="${canonical}"/>`,
        )
        .replace(
          /<meta property="og:url"[^>]*>/,
          () => `<meta property="og:url" content="${canonical}"/>`,
        )
        .replace(
          /<meta property="og:title"[^>]*>/,
          () => `<meta property="og:title" content="${meta.ogTitle}"/>`,
        )
        .replace(
          /<meta property="og:description"[^>]*>/,
          () => `<meta property="og:description" content="${meta.description}"/>`,
        )
        .replace(
          /<meta name="twitter:title"[^>]*>/,
          () => `<meta name="twitter:title" content="${meta.ogTitle}"/>`,
        )
        .replace(
          /<meta name="twitter:description"[^>]*>/,
          () => `<meta name="twitter:description" content="${meta.description}"/>`,
        )
        // Replace the homepage hreflang block (comment + link tags) baked into
        // index-static.html with route-specific ones. Pattern matches the
        // comment line followed by any number of consecutive hreflang link lines.
        .replace(
          /<!-- hreflang[^\n]*\n(?:<link rel="alternate" hreflang="[^"]*"[^\n]*\n)*/,
          () => _hreflangTags(bare) + "\n",
        )
        .replace(/<h1>[\s\S]*?<\/h1>/, () => `<h1>${meta.h1}</h1>`)
        .replace(
          /<p>[\s\S]*?<\/p>/,
          () => `<p>${meta.intro}</p>${meta.bodyHtml ? `\n${meta.bodyHtml}` : ""}`,
        )
        .replace(/<\/head>/, () => {
          const jsonld = _ROUTE_JSONLD[bare];
          return jsonld ? `${jsonld}\n</head>` : "</head>";
        });
    };

    const _esc = (s: unknown): string =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    // Per-judgment bot HTML: fetch the judgment from the Python service and
    // inject case-specific <title>, description, canonical, OG/Twitter tags
    // (incl. the dynamic OG card image) and BlogPosting + LegalCase JSON-LD.
    // Returns null for non-judgment paths or when the judgment can't be found,
    // so callers fall back to the generic bot/index HTML.
    const _judgmentBotHtml = async (reqPath: string): Promise<string | null> => {
      if (!_staticBotHtml) return null;
      let bare = _stripCountry(reqPath);
      if (bare.length > 1) bare = bare.replace(/\/+$/, "");
      const m = bare.match(/^\/judgments\/([^/]+)\/(\d{4})\/([^/]+)$/);
      if (!m) return null;
      const [, court, year, slug] = m;
      interface JudgmentData {
        case_name: string; court: string; year: number; citation?: string;
        summary_en?: string; judgment_date?: string | null;
        og_image_url?: string; path?: string; url?: string;
      }
      let data: JudgmentData;
      try {
        const r = await fetch(
          `${LF_API_ORIGIN}${LF_API_BASE}/judgments/item/${court}/${year}/${slug}`,
          { headers: { accept: "application/json" }, signal: AbortSignal.timeout(4000) },
        );
        if (!r.ok) return null;
        data = (await r.json()) as JudgmentData;
      } catch {
        return null;
      }

      const canonical = `${_SITE_URL}${data.path ?? bare}`;
      const title = `${data.case_name} (${data.year}) — ${data.court} | LitigaForge AI`;
      const ogTitle = `${data.case_name} (${data.year})`;
      const desc = (data.summary_en ?? "").slice(0, 200);
      const ogImage = data.og_image_url ?? `${_SITE_URL}/og-image.png`;

      const jsonld = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BlogPosting",
            headline: data.case_name,
            description: desc,
            datePublished: data.judgment_date || undefined,
            dateModified: data.judgment_date || undefined,
            image: ogImage,
            inLanguage: "en",
            author: { "@type": "Organization", name: "LitigaForge AI", url: _SITE_URL },
            publisher: {
              "@type": "Organization",
              name: "LitigaForge AI",
              logo: { "@type": "ImageObject", url: `${_SITE_URL}/og-image.png` },
            },
            mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
          },
          {
            "@type": "LegalCase",
            name: data.case_name,
            url: canonical,
            ...(data.citation ? { alternateName: data.citation } : {}),
            ...(data.court ? { about: data.court } : {}),
          },
        ],
      }).replace(/</g, "\\u003c");

      return _staticBotHtml
        .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${_esc(title)}</title>`)
        .replace(
          /<meta name="description"[^>]*>/,
          () => `<meta name="description" content="${_esc(desc)}"/>`,
        )
        .replace(
          /<link rel="canonical"[^>]*>/,
          () => `<link rel="canonical" href="${canonical}"/>`,
        )
        .replace(
          /<meta property="og:url"[^>]*>/,
          () => `<meta property="og:url" content="${canonical}"/>`,
        )
        .replace(
          /<meta property="og:title"[^>]*>/,
          () => `<meta property="og:title" content="${_esc(ogTitle)}"/>`,
        )
        .replace(
          /<meta property="og:description"[^>]*>/,
          () => `<meta property="og:description" content="${_esc(desc)}"/>`,
        )
        .replace(
          /<meta property="og:image"[^>]*>/,
          () => `<meta property="og:image" content="${_esc(ogImage)}"/>`,
        )
        .replace(
          /<meta name="twitter:title"[^>]*>/,
          () => `<meta name="twitter:title" content="${_esc(ogTitle)}"/>`,
        )
        .replace(
          /<meta name="twitter:description"[^>]*>/,
          () => `<meta name="twitter:description" content="${_esc(desc)}"/>`,
        )
        .replace(
          /<meta name="twitter:image"[^>]*>/,
          () => `<meta name="twitter:image" content="${_esc(ogImage)}"/>`,
        )
        .replace(/<h1>[\s\S]*?<\/h1>/, () => `<h1>${_esc(data.case_name)}</h1>`)
        .replace(/<p>[\s\S]*?<\/p>/, () => `<p>${_esc(data.summary_en ?? "")}</p>`)
        .replace(
          /<\/head>/,
          () => `<script type="application/ld+json">${jsonld}</script>\n</head>`,
        );
    };

    // Per-route SPA meta injection for ALL user agents (not just bots).
    // Reuses the _routeSeo manifest so every request — curl, unfurlers,
    // JS-disabled crawlers — gets route-specific title/description/canonical/OG
    // tags in the initial HTML, not just the cached homepage defaults.
    const _spaHtmlForPath = (reqPath: string): string => {
      let bare = _stripCountry(reqPath);
      if (bare.length > 1) bare = bare.replace(/\/+$/, "");
      const meta = _routeSeo(bare);
      if (!meta) return _indexHtml; // homepage or unrecognised path — already correct
      const canonical = `${_SITE_URL}${meta.canonicalPath}`;
      const ogUrl = `${_SITE_URL}${bare}`;
      return _indexHtml
        .replace(/<title>[^<]*<\/title>/, () => `<title>${meta.title}</title>`)
        .replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${meta.description}"/>`)
        .replace(/<link rel="canonical"[^>]*>/, () => `<link rel="canonical" href="${canonical}"/>`)
        .replace(/<meta property="og:url"[^>]*>/, () => `<meta property="og:url" content="${ogUrl}"/>`)
        .replace(/<meta property="og:title"[^>]*>/, () => `<meta property="og:title" content="${meta.ogTitle}"/>`)
        .replace(/<meta property="og:description"[^>]*>/, () => `<meta property="og:description" content="${meta.description}"/>`)
        .replace(/<meta name="twitter:title"[^>]*>/, () => `<meta name="twitter:title" content="${meta.ogTitle}"/>`)
        .replace(/<meta name="twitter:description"[^>]*>/, () => `<meta name="twitter:description" content="${meta.description}"/>`);
    };

    if (_indexHtml) {
      const _sendIndex = (req: express.Request, res: express.Response): void => {
        const ua = req.headers["user-agent"] ?? "";
        if (_staticBotHtml && _botPattern.test(ua)) {
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.send(_botHtmlForPath(req.path));
          return;
        }
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(_spaHtmlForPath(req.path));
      };

      // Serve static assets (JS, CSS, fonts, images) — index:false so we
      // control index.html ourselves via the routes below. Hashed assets under
      // /assets/ are content-addressed, so they can be cached forever.
      app.use(
        express.static(_frontendDist, {
          index: false,
          setHeaders: (res, filePath) => {
            if (/[\\/]assets[\\/]/.test(filePath)) {
              res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            }
          },
        }),
      );

      // Root: serve meta-injected HTML
      app.get("/", _sendIndex);

      // Judgment detail: bots get per-judgment meta + OG card + JSON-LD fetched
      // from the Python service; humans get the SPA shell (react-helmet sets
      // meta client-side). Registered BEFORE the SPA catch-all. Matches both the
      // bare and country-prefixed (/in/judgments/...) forms.
      // Tolerant judgment URLs: truncated, wrong-court or stray-keyword slugs
      // 301 → the canonical judgment URL. Existing slugs are NEVER renamed —
      // resolution is delegated to the Python service and cached briefly so an
      // already-canonical URL (the common case) costs nothing after the first
      // hit. Any country prefix on the request is preserved on the redirect.
      const _JUDG_REDIR_TTL_MS = 10 * 60 * 1000;
      const _judgRedirCache = new Map<string, { to: string | null; at: number }>();
      const _judgmentRedirectTarget = async (
        reqPath: string,
      ): Promise<string | null> => {
        let bare = _stripCountry(reqPath);
        if (bare.length > 1) bare = bare.replace(/\/+$/, "");
        const m = bare.match(/^\/judgments\/([^/]+)\/(\d{4})\/([^/]+)$/);
        if (!m) return null;
        const [, court, year, slug] = m;
        const prefix =
          _stripCountry(reqPath) === reqPath
            ? ""
            : `/${reqPath.replace(/^\/+/, "").split("/")[0]?.toLowerCase() ?? ""}`;

        const now = Date.now();
        const cached = _judgRedirCache.get(bare);
        let to: string | null;
        if (cached && now - cached.at < _JUDG_REDIR_TTL_MS) {
          to = cached.to;
        } else {
          to = null;
          try {
            const r = await fetch(
              `${LF_API_ORIGIN}${LF_API_BASE}/judgments/resolve/${court}/${year}/${slug}`,
              {
                headers: { accept: "application/json" },
                signal: AbortSignal.timeout(4000),
              },
            );
            if (r.ok) {
              const data = (await r.json()) as { exact?: boolean; path?: string };
              if (data && data.exact === false && data.path && data.path !== bare) {
                to = data.path;
              }
            }
          } catch {
            to = null;
          }
          _judgRedirCache.set(bare, { to, at: now });
        }
        return to ? `${prefix}${to}` : null;
      };

      const _judgmentRoute = async (
        req: express.Request,
        res: express.Response,
      ): Promise<void> => {
        try {
          const redirectTo = await _judgmentRedirectTarget(req.path);
          if (redirectTo) {
            res.redirect(301, redirectTo);
            return;
          }
        } catch (err) {
          logger.error({ err }, "judgment redirect resolve failed");
        }
        const ua = req.headers["user-agent"] ?? "";
        if (_staticBotHtml && _botPattern.test(ua)) {
          try {
            const html = await _judgmentBotHtml(req.path);
            res.setHeader("Cache-Control", "public, max-age=3600");
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.send(html ?? _botHtmlForPath(req.path));
            return;
          } catch (err) {
            logger.error({ err }, "judgment bot html failed — serving generic");
          }
        }
        _sendIndex(req, res);
      };
      app.get("/judgments/:court/:year/:slug", _judgmentRoute);
      app.get("/:cc/judgments/:court/:year/:slug", _judgmentRoute);

      // SPA fallback: any path not under /api or /litigaforge returns the
      // React app so client-side routing works (/ask, /login, /forge, etc.)
      // Paths with a file extension (e.g. .xml, .txt, .json) are skipped —
      // they are static assets and should 404 rather than receive bot HTML.
      app.get("/{*splat}", (req, res, next) => {
        if (
          req.path.startsWith("/api") ||
          req.path.startsWith("/litigaforge") ||
          /\.[a-zA-Z0-9]+$/.test(req.path)
        ) {
          return next();
        }
        _sendIndex(req, res);
      });
    }
  } else {
    logger.warn("Frontend dist not found — only /api routes will be served");
  }
}

export default app;
