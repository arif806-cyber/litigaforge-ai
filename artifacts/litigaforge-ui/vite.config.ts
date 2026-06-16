import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import compression from "vite-plugin-compression2";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: false,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,png,svg,woff2,html}"],
        cleanupOutdatedCaches: true,
        // Exclude backend/proxied paths from the SPA navigation fallback so the
        // service worker never serves the React shell for non-app URLs:
        //  - /blog + /_astro: reverse-proxied to the Cloudflare Worker (serving
        //    the shell here would cause an infinite redirect loop).
        //  - /api + /litigaforge: backend endpoints (e.g. /api/llm/health). If
        //    the SW served the React shell, the app would prepend the country
        //    prefix (e.g. /in/api/...) and render its own 404 instead of the
        //    JSON response.
        navigateFallbackDenylist: [
          /^\/blog/,
          /^\/_astro/,
          /^\/api/,
          /^\/litigaforge/,
        ],
        runtimeCaching: [
          {
            urlPattern: /\/litigaforge\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 3600,
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      manifest: {
        name: "LitigaForge AI",
        short_name: "LitigaForge",
        description:
          "Global AI legal platform — find verified lawyers, analyze documents, search case law, and get free legal aid worldwide.",
        theme_color: "#1a2744",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        lang: "en",
        categories: ["legal", "productivity", "utilities"],
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "opengraph.jpg",
            sizes: "192x192",
            type: "image/jpeg",
          },
        ],
        shortcuts: [
          {
            name: "Ask a Legal Question",
            short_name: "Q&A",
            url: "/ask",
            description: "Get instant AI-powered answers to legal questions",
          },
          {
            name: "Analyze a Document",
            short_name: "Analyzer",
            url: "/review",
            description: "AI risk analysis for contracts and legal documents",
          },
          {
            name: "Find a Lawyer",
            short_name: "Lawyers",
            url: "/lawyers",
            description: "Browse verified lawyers worldwide",
          },
        ],
      },
    }),
    compression({ algorithm: "gzip" }),
    compression({ algorithm: "brotliCompress", exclude: [/\.(gz|br)$/] }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 500,
    // Split per-route CSS so a chunk only ships the styles it needs.
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          motion: ["framer-motion"],
          query: ["@tanstack/react-query"],
          icons: ["lucide-react"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
