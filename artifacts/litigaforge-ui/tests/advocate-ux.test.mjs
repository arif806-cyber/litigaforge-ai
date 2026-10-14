import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("CNR tracker renders one input and uses an unmistakably fake example", async () => {
  const page = await source("../src/pages/cnr-tracker.tsx");
  assert.equal((page.match(/data-testid="cnr-input"/g) ?? []).length, 1);
  assert.doesNotMatch(page, /cnr-input-mobile|e\.g\. TLHC010012342023/);
  assert.match(page, /16 characters, e\.g\. TSHC01XXXXXX2024/);
  assert.doesNotMatch(page, /TLHC010012342023/);
});

test("nested advocate cases route does not also activate the dashboard nav item", async () => {
  const layout = await source("../src/components/layout.tsx");
  assert.match(layout, /href === "\/lawyer-dashboard"[\s\S]*?location === href \|\| location === "\/advocate-dashboard"/);
  assert.match(layout, /location === href \|\| location\.startsWith\(`\$\{href\}\/`\)/);
});

test("AI welcome markdown uses compact paragraph and list spacing", async () => {
  const chat = await source("../src/pages/legal-chat.tsx");
  assert.match(chat, /prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0\.5/);
  assert.match(chat, /\[&_\.prose\]:whitespace-normal/);
});

test("page titles stay above section headings and page transitions avoid the full-screen splash", async () => {
  const shell = await source("../src/components/PageShell.tsx");
  const docket = await source("../src/pages/docket-view.tsx");
  const judgments = await source("../src/pages/judgments.tsx");
  const auth = await source("../src/lib/auth-context.tsx");
  const app = await source("../src/App.tsx");
  assert.match(shell, /md:text-\[30px\]/);
  assert.match(docket, /text-lg font-semibold">Your courts and optional matching details/);
  assert.match(docket, /text-lg font-semibold">Court results/);
  assert.match(judgments, /text-lg font-semibold flex items-center gap-2"><LibraryBig/);
  assert.doesNotMatch(`${auth}\n${app}`, /Starting LitigaForge AI/);
  assert.match(app, /aria-label="Loading page"/);
});
