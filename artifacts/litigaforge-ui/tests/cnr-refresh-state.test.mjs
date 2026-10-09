import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  currentCnrErrorMessage,
  normalizeCnrRefreshState,
} from "../src/lib/cnr-refresh-state.ts";

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trackerSource = readFileSync(
  path.join(uiRoot, "src/pages/cnr-tracker.tsx"),
  "utf8",
);
const mainSource = readFileSync(path.join(uiRoot, "src/main.tsx"), "utf8");
const legacyMessage =
  "eCourts API unreachable from server — requires an Indian network IP.";
const legacyWording = /(?:eCourts\s+API\s+unreachable\s+from\s+server|requires\s+an\s+Indian\s+network\s+IP|Indian\s+network\s+IP)/i;

function collectBuiltTextFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectBuiltTextFiles(filePath);
    return /\.(?:js|html)$/i.test(entry.name) ? [filePath] : [];
  });
}

test("legacy CNR failures become a current pending Partner API refresh state", () => {
  assert.deepEqual(normalizeCnrRefreshState("failed", legacyMessage), {
    status: "pending",
    error: null,
    legacy: true,
  });
  assert.doesNotMatch(currentCnrErrorMessage(legacyMessage, "fallback"), legacyWording);
});

test("CNR Tracker Retry uses the current refresh route and UI source has no legacy status copy", () => {
  assert.match(trackerSource, /apiFetch\(`\/court-intel\/\$\{id\}\/refresh`/);
  assert.doesNotMatch(trackerSource, legacyWording);
  assert.doesNotMatch(trackerSource, /eCourts India API was unreachable during the last fetch/i);
});

test("service-worker updates use a versioned URL and revalidate without HTTP cache", () => {
  assert.match(mainSource, /serviceWorkerUrl\.searchParams\.set\("v",/);
  assert.match(mainSource, /updateViaCache:\s*"none"/);
  assert.match(mainSource, /controllerchange/);
});

test("built frontend assets do not contain the retired CNR message", () => {
  const assets = collectBuiltTextFiles(path.join(uiRoot, "dist/public"));
  for (const asset of assets) {
    assert.doesNotMatch(readFileSync(asset, "utf8"), legacyWording, asset);
  }
});
