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

    const _buildSitemap = async (): Promise<string> => {
      const base = _readStaticSitemap();
      let paths: string[] = [];
      try {
        paths = await _fetchBlogArticlePaths();
      } catch {
        paths = [];
      }
      if (paths.length === 0 || !base.includes("</urlset>")) return base;
      const blogUrls = paths
        .map(
          (p) =>
            `  <url>\n    <loc>https://litigaforge.com${p}</loc>\n` +
            "    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>",
        )
        .join("\n");
      return base.replace(
        "</urlset>",
        `\n  <!-- Blog articles (auto-generated from the content pipeline) -->\n${blogUrls}\n</urlset>`,
      );
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
          "<title>LitigaForge AI \u2014 Global AI Legal Platform | Legal Help Worldwide</title>",
        )
        .replace(
          /<meta name="description"[^>]*>/,
          '<meta name="description" content="LitigaForge AI provides instant AI-powered legal guidance, document analysis, lawyer matching and free legal aid \u2014 available globally in English, Hindi and Telugu. Trusted across India, USA, UK, UAE and worldwide." />',
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
    const _botPattern = /GPTBot|ClaudeBot|Claude-Web|PerplexityBot|Googlebot|bingbot|Applebot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|WhatsApp|Discord|AhrefsBot|SEMrushBot|MJ12bot|YandexBot|DuckDuckBot/i;

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
    }

    const _ROUTE_SEO: Record<string, RouteSeoEntry> = {
      "/ask": {
        title: "Free Legal Q&amp;A — Ask AI Legal Questions Instantly | LitigaForge AI",
        ogTitle: "Free Legal Q&amp;A — Ask AI Legal Questions Instantly",
        description:
          "Ask any legal question and get an instant, plain-language AI answer grounded in your country's laws. Free legal Q&amp;A across property, family, criminal, consumer and employment law.",
        h1: "Ask a Legal Question — Get an Instant AI Answer",
        intro:
          "Type any legal question and LitigaForge AI gives you a clear, plain-language answer grounded in your jurisdiction's laws — free and instant. Browse a growing knowledge base of answered questions across property, family, criminal, consumer and employment law.",
      },
      "/review": {
        title: "AI Legal Document Analyzer — Risk Score &amp; Missing Clauses | LitigaForge AI",
        ogTitle: "AI Legal Document Analyzer — Free Risk Check",
        description:
          "Paste any contract, agreement, FIR or court notice and get an instant AI risk score (0–100), a list of missing clauses, and actionable recommendations. Free document analysis.",
        h1: "Analyze a Legal Document with AI",
        intro:
          "Upload or paste any legal document — rental agreement, employment contract, FIR, court notice or sale deed — and receive an AI risk score (0–100), a list of missing clauses, and clear recommendations. Free and instant.",
      },
      "/lawyers": {
        title: "Find &amp; Hire Verified Lawyers — AI Lawyer Matching | LitigaForge AI",
        ogTitle: "Find Verified Lawyers — AI Lawyer Matching",
        description:
          "Search verified, rated lawyers and get matched with the right advocate for your case. AI lawyer matching with transparent 0–100 match scores and plain-language explanations.",
        h1: "Find a Verified Lawyer for Your Case",
        intro:
          "Browse verified, rated advocates or post your case and let LitigaForge AI match you with the right lawyer — each scored 0–100 with a plain-language explanation of why they fit your legal issue, location and budget.",
      },
      "/judgments": {
        title: "Judgment Finder — Search Case Law &amp; Court Precedents | LitigaForge AI",
        ogTitle: "Judgment Finder — Search Case Law",
        description:
          "Search court judgments and case law by keyword, court name or case number. LitigaForge AI returns the most relevant precedents with citation links for your jurisdiction.",
        h1: "Search Judgments &amp; Case Law",
        intro:
          "Find relevant court judgments and precedents by keyword, court name or case number. LitigaForge AI surfaces the most relevant case law with citation links so you can research your matter quickly.",
      },
      "/legal-aid": {
        title: "Free Legal Aid Finder — Check Eligibility &amp; Helplines | LitigaForge AI",
        ogTitle: "Free Legal Aid Finder — Eligibility &amp; Helplines",
        description:
          "Check your eligibility for free legal aid and find legal aid contacts and toll-free helplines for your region. Legal help for everyone, regardless of income.",
        h1: "Find Free Legal Aid Near You",
        intro:
          "Check whether you qualify for free legal aid and get contact details and toll-free helplines for legal aid services in your region. Everyone deserves legal help, regardless of income.",
      },
      "/free-documents": {
        title: "Free Legal Document Templates — AI-Generated | LitigaForge AI",
        ogTitle: "Free Legal Document Templates — AI-Generated",
        description:
          "Generate free legal documents instantly — rental agreements, legal notices, affidavits, employment letters and NDAs — each customized for your jurisdiction with AI.",
        h1: "Free Legal Document Templates",
        intro:
          "Generate 10+ legal document templates instantly — rental agreements, legal notices, affidavits, employment letters and NDAs — each AI-generated and customized for your jurisdiction. Free to download, share and print.",
      },
      "/subscription": {
        title: "Pricing &amp; Plans — Free, Professional &amp; Advocate Pro | LitigaForge AI",
        ogTitle: "LitigaForge AI Pricing &amp; Plans",
        description:
          "Compare LitigaForge AI plans: free legal tools to start, Professional for unlimited AI and priority lawyer matching, and Advocate Pro for full practice management.",
        h1: "Plans &amp; Pricing",
        intro:
          "Start free with legal Q&amp;A, document analysis and judgment search. Upgrade to Professional for unlimited AI and priority lawyer matching, or Advocate Pro for full practice and case management.",
      },
      "/about": {
        title: "About LitigaForge AI — Our Mission &amp; Global Legal Platform",
        ogTitle: "About LitigaForge AI",
        description:
          "Learn about LitigaForge AI — an AI-powered legal platform making legal help affordable and accessible worldwide through lawyer matching, document analysis and free legal aid.",
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
          "The terms of service governing your use of LitigaForge AI, including acceptable use, disclaimers, and the limits of the AI-generated legal information we provide.",
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
        title: "U.S. Demand Letter — Draft &amp; Send in Minutes | LitigaForge AI",
        ogTitle: "U.S. Demand Letter — Draft &amp; Send in Minutes",
        description:
          "Create a professional, state-specific U.S. demand letter for unpaid debts, broken contracts, deposits, or damages. AI-drafted, ready to send. Pay only when you're happy.",
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
      if (direct) return { ...direct, canonicalPath: direct.canonical ?? bare };
      const m = bare.match(/^\/lawyers\/([a-z][a-z-]*)$/);
      if (m) {
        const city = _titleCase(m[1] ?? "");
        return {
          title: `Lawyers in ${city} — Verified Advocates | LitigaForge AI`,
          ogTitle: `Lawyers in ${city} | LitigaForge AI`,
          description: `Find and connect with verified, rated lawyers in ${city}. AI-powered lawyer matching with transparent 0–100 match scores. Free to start.`,
          h1: `Verified Lawyers in ${city}`,
          intro: `Connect with experienced, verified advocates in ${city}. LitigaForge AI matches you with the right lawyer for your case — each scored 0–100 with a plain-language explanation of the fit.`,
          canonicalPath: bare,
        };
      }
      return null;
    };

    const _botHtmlForPath = (reqPath: string): string => {
      if (!_staticBotHtml) return _indexHtml;
      let bare = _stripCountry(reqPath);
      if (bare.length > 1) bare = bare.replace(/\/+$/, "");
      const meta = _routeSeo(bare);
      if (!meta) return _staticBotHtml; // homepage / unmapped routes
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
        .replace(/<h1>[\s\S]*?<\/h1>/, () => `<h1>${meta.h1}</h1>`)
        .replace(/<p>[\s\S]*?<\/p>/, () => `<p>${meta.intro}</p>`);
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
        res.send(_indexHtml);
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
