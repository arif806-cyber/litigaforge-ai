import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

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