import { execFileSync } from "node:child_process";

const root = new URL("../../../", import.meta.url);
let diff = "";
try {
  diff = execFileSync("git", ["diff", "--unified=0", "HEAD", "--", "artifacts/litigaforge-ui/src"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
} catch {
  console.log("Color lint skipped: git diff is unavailable in this checkout.");
  process.exit(0);
}

const violations = [];
let currentFile = "";
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ b/")) currentFile = line.slice(6);
  if (!line.startsWith("+") || line.startsWith("+++")) continue;
  if (/^diff --git/.test(line)) continue;
  if (currentFile.endsWith("/index.css")) continue;
  const addedSource = line
    .slice(1)
    .replace(/hsl\(\s*var\(\s*--[\w-]+\s*\)\s*\)/gi, "");
  if (/(?:#[\da-f]{3,8}\b|rgba?\s*\(|hsla?\s*\()/i.test(addedSource)) {
    violations.push(line.slice(1).trim());
  }
}

if (violations.length) {
  console.error("New hard-coded colors found outside the token source:");
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log("Visual color lint passed: no newly added literal colors in application source.");
