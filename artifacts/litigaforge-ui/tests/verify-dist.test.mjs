import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { verifyFrontendDist } from "../scripts/verify-dist.mjs";

test("production frontend build rejects a non-root base path", () => {
  assert.throws(
    () => verifyFrontendDist({ distDir: tmpdir(), basePath: "/litigaforge-ui/", nodeEnv: "production" }),
    /must use BASE_PATH=\/ because the API server serves it at \//,
  );
});

test("frontend build rejects missing index and referenced JS/CSS assets", () => {
  const root = mkdtempSync(join(tmpdir(), "litigaforge-dist-"));
  try {
    assert.throws(() => verifyFrontendDist({ distDir: root }), /missing .*index\.html/);

    mkdirSync(join(root, "assets"));
    writeFileSync(join(root, "index.html"), '<script src="/assets/app.js"></script><link href="/assets/app.css" rel="stylesheet">');
    writeFileSync(join(root, "assets/app.js"), "console.log('ok')");
    assert.throws(() => verifyFrontendDist({ distDir: root }), /missing assets.*app\.css/i);
    writeFileSync(join(root, "assets/app.css"), "body{}");
    assert.doesNotThrow(() => verifyFrontendDist({ distDir: root }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
