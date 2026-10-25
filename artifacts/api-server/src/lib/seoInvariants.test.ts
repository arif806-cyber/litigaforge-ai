import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { subscriptionPlanCopy } from "./subscriptionPlanCopy.ts";

const root = resolve(import.meta.dirname, "../../..");

test("bot homepage has current positioning and indexable metadata", () => {
  const html = readFileSync(resolve(root, "litigaforge-ui/public/index-static.html"), "utf8");
  assert.match(html, /<title>LitigaForge — AI legal tools for advocates and clients<\/title>/);
  assert.match(html, /<meta name="robots" content="index, follow"\/>/);
  assert.match(html, /<h1>LitigaForge — AI legal tools for advocates and clients<\/h1>/);
});

test("static sitemap excludes authentication and US-only routes", () => {
  const sitemap = readFileSync(resolve(root, "litigaforge-ui/public/sitemap.xml"), "utf8");
  assert.doesNotMatch(sitemap, /\/(?:login|register|us-demand-letter)(?:<|\/)/);
  assert.match(sitemap, /https:\/\/litigaforge\.com\/ask<\/loc>/);
  assert.match(sitemap, /https:\/\/litigaforge\.com\/review<\/loc>/);
  assert.match(sitemap, /https:\/\/litigaforge\.com\/subscription<\/loc>/);
  assert.match(sitemap, /https:\/\/litigaforge\.com\/for-lawyers<\/loc>/);
});

test("API SEO manifest marks only account/private routes noindex", () => {
  const source = readFileSync(resolve(root, "api-server/src/app.ts"), "utf8");
  assert.match(source, /noIndex: true/);
  assert.match(source, /<meta name="robots"/);
  assert.match(source, /\/ask/);
  assert.match(source, /\/review/);
  assert.match(source, /CNR Case Status Tracker/);
  assert.match(source, /"\/mcp-docs":\s*\{\s*title: "LitigaForge MCP Connector"/);
});

test("subscription SEO uses the shared advocate plan names and prices", () => {
  assert.deepEqual(subscriptionPlanCopy, {
    freeName: "Free",
    advocateProName: "Advocate Pro",
    advocateProMonthly: 999,
    advocateProMonthlyDisplay: "999",
    chamberName: "Chamber",
    chamberMonthly: 2499,
    chamberMonthlyDisplay: "2,499",
  });
  const appSource = readFileSync(resolve(root, "api-server/src/app.ts"), "utf8");
  assert.match(appSource, /subscriptionPlanCopy\.advocateProName/);
  assert.match(appSource, /subscriptionPlanCopy\.chamberName/);
  assert.doesNotMatch(appSource, /Professional for unlimited AI|What does the Professional plan include/);

  const uiMeta = [
    readFileSync(resolve(root, "litigaforge-ui/server.mjs"), "utf8"),
    readFileSync(resolve(root, "litigaforge-ui/scripts/inject-seo.mjs"), "utf8"),
    readFileSync(resolve(root, "litigaforge-ui/public/llms.txt"), "utf8"),
    readFileSync(resolve(root, "litigaforge-ui/src/pages/terms.tsx"), "utf8"),
    readFileSync(resolve(root, "litigaforge-ui/src/pages/ask.tsx"), "utf8"),
    readFileSync(resolve(root, "litigaforge-ui/src/pages/client-dashboard.tsx"), "utf8"),
  ].join("\n");
  assert.doesNotMatch(
    uiMeta,
    /Professional \(₹999|Professional ₹999|Professional &amp; Advocate Pro|Professional and Advocate Pro|Upgrade to Professional/,
  );
  assert.match(uiMeta, /Advocate Pro/);
  assert.match(uiMeta, /Chamber/);
});

test("prerendered pricing metadata contains only the current plan names", () => {
  const publicDir = resolve(root, "litigaforge-ui/dist/public");
  const subscription = readFileSync(
    resolve(publicDir, "subscription/index.html"),
    "utf8",
  );
  assert.match(subscription, /<title>LitigaForge AI Plans — Free, Advocate Pro &amp; Chamber<\/title>/);
  assert.match(subscription, /name="description" content="Compare Free, Advocate Pro \(₹999\/month\), and Chamber \(₹2,499\/month\)/);
  assert.match(subscription, /property="og:description" content="Compare Free, Advocate Pro/);
  assert.match(subscription, /name="twitter:description" content="Compare Free, Advocate Pro/);

  const htmlFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory()
      ? htmlFiles(resolve(directory, entry.name))
      : entry.name.endsWith(".html") ? [resolve(directory, entry.name)] : []);
  for (const file of htmlFiles(publicDir)) {
    const html = readFileSync(file, "utf8");
    assert.doesNotMatch(html, /Professional for unlimited AI|Compare plans: free legal tools/i, file);
  }
});