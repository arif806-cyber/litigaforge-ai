import express, { type Express } from "express";
import cors from "cors";
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
      // control index.html ourselves via the routes below
      app.use(express.static(_frontendDist, { index: false }));

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
