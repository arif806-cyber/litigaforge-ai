import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { missingFrontendAssets } from "./frontendAssets.ts";

test("accepts a root-based index only when its referenced bundles exist", () => {
  const dist = mkdtempSync(resolve(tmpdir(), "litigaforge-assets-"));
  try {
    mkdirSync(resolve(dist, "assets"));
    writeFileSync(resolve(dist, "assets/app.js"), "export {};");
    writeFileSync(resolve(dist, "assets/app.css"), "body {}");
    const html = '<script type="module" src="/assets/app.js"></script><link href="/assets/app.css" rel="stylesheet">';
    assert.deepEqual(missingFrontendAssets(html, dist), []);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test("rejects stale or mis-prefixed index asset URLs", () => {
  const dist = mkdtempSync(resolve(tmpdir(), "litigaforge-assets-"));
  try {
    mkdirSync(resolve(dist, "assets"));
    writeFileSync(resolve(dist, "assets/current.js"), "export {};");
    const html = '<script src="/litigaforge/assets/stale.js"></script><script src="/assets/current.js"></script>';
    assert.deepEqual(missingFrontendAssets(html, dist), ["/litigaforge/assets/stale.js"]);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
