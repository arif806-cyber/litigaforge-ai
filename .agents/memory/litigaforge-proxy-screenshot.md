---
name: Screenshotting litigaforge-ui dev-only routes
description: Why the screenshot tool can't reach the Vite dev server for litigaforge-ui, and the workaround.
---

The shared proxy (localhost:80, which the `screenshot` app_preview tool and `curl` go through) routes `/` to the **api-server** artifact, NOT the litigaforge-ui Vite dev server. `api-server`'s `artifact.toml` claims `paths = ["/api", "/"]` and serves the **built** `litigaforge-ui/dist/public` (in dev and prod). litigaforge-ui also claims `/`, but api-server wins the tie. So:

- If api-server is stopped, `localhost:80/` returns **502** even when Vite is up (proxy still routes `/` to the down api-server port).
- The Vite dev server answers on its own port directly (e.g. `localhost:23790/...` → 200), but the screenshot tool only hits `localhost:80{previewPath}` so it never reaches Vite.

**How to apply:** To screenshot/verify anything in litigaforge-ui through the tool, the change must be in the **built dist** that api-server serves: run `PORT=23790 BASE_PATH=/ pnpm --filter @workspace/litigaforge-ui run build`, ensure the `api-server: API Server` workflow is running, then screenshot `localhost:80/<country>/...` (e.g. `/in/...`). For a route that is intentionally **DEV-only** (gated by `import.meta.env.DEV`, e.g. `/design-system`), temporarily flip the gate to `true`, build, screenshot, then revert and rebuild clean (verify the dev route is tree-shaken back out of `dist/public/assets`).

**This applies to the e2e/`runTest` testing tool too, not just the `screenshot` tool** — it also drives a browser against `localhost:80`/the public dev domain, so a stale build serves stale JS/CSS with the wrong asset-path prefix (browser shows a blank page, console 404s on `/litigaforge/assets/*`). After any litigaforge-ui source change you intend to e2e-test, rebuild AND restart the `api-server: API Server` workflow (it caches/reads the built `index.html` at startup, so a rebuild alone without a restart still serves the old file) before running `runTest`.

**Why:** This cost real time during the Case File OS work — a dev-only gallery looked unreachable (502s) until realizing the proxy `/` ownership belongs to api-server's served dist, not Vite. It recurred during the ForgeOS Command Center work as an e2e test failure that looked like a broken app but was just a stale build.
