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

    if (_indexHtml) {
      const _sendIndex = (req: express.Request, res: express.Response): void => {
        const ua = req.headers["user-agent"] ?? "";
        if (_staticBotHtml && _botPattern.test(ua)) {
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.send(_staticBotHtml);
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
