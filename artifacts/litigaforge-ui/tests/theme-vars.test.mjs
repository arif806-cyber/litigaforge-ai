import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = fileURLToPath(new URL("../src/", import.meta.url));
const semanticVar = /var\(\s*--(?:primary|foreground|background|secondary|accent)\s*\)/gi;
const validHslVar = /hsl\(\s*var\(\s*--(?:primary|foreground|background|secondary|accent)\s*\)\s*\)/gi;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:css|[jt]sx?)$/.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat();
}

test("semantic HSL variables are never used bare in UI source", async () => {
  const violations = [];
  for (const file of await sourceFiles(srcRoot)) {
    const source = await readFile(file, "utf8");
    const remaining = source.replace(validHslVar, "");
    for (const match of remaining.matchAll(semanticVar)) {
      const line = remaining.slice(0, match.index).split("\n").length;
      violations.push(`${path.relative(srcRoot, file)}:${line}: ${match[0]}`);
    }
  }
  assert.deepEqual(violations, [], `Wrap HSL component variables in hsl(...):\n${violations.join("\n")}`);
});
