import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { assertAlwaysLight, seedLegacyDarkPreference } from "./light-theme-checks.mjs";

const baseUrl = process.env.LITIGAFORGE_E2E_URL ?? "http://127.0.0.1:23790/litigaforge-ui";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "/repl/tools/bin/chromium",
  args: ["--no-sandbox"],
});

const client = {
  id: 21,
  email: "client-home@example.test",
  name: "Asha Client",
  role: "client",
  subscription_tier: "free",
  is_verified: true,
  has_lawyer_profile: false,
};

try {
  await mkdir(new URL("../generated-artifacts/", import.meta.url), { recursive: true });
  const renderedThemeBackgrounds = new Set();
  for (const theme of ["light"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
    await seedLegacyDarkPreference(context);
    await context.route("**/litigaforge/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const json = (body) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
      if (path.endsWith("/auth/me")) return json(client);
      if (path.endsWith("/auth/refresh")) return json({ ok: true });
      if (path.endsWith("/client/cases")) return json({ cases: [] });
      if (path.endsWith("/cases/requirements/mine")) return json({ requirements: [] });
      if (path.endsWith("/matches/client")) return json({ matches: [] });
      if (path.endsWith("/chat/threads")) return json({ threads: [] });
      if (path.endsWith("/alerts/config")) return json({});
      return json({});
    });

    const page = await context.newPage();
    await page.goto(`${baseUrl}/client-dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/client-dashboard\/?$/);
    await page.getByTestId("client-case-journey").waitFor();
    await page.waitForFunction((expectedTheme) =>
      document.documentElement.dataset.theme === expectedTheme, theme);
    await assertAlwaysLight(page, "Client Home 390px");
    renderedThemeBackgrounds.add(await page.locator(".lf-app-layout").evaluate((layout) =>
      getComputedStyle(layout).backgroundColor));
    assert.equal(await page.locator("h1").count(), 1, "client Home should have one page heading");
    await page.locator(".lf-mobile-topbar").getByText("Home", { exact: true }).first().waitFor();
    assert.equal(await page.getByText("AI Protected", { exact: true }).count(), 0,
      "the old AI Protected badge should not appear");

    const titleAlignment = await page.locator('.lf-mobile-topbar [data-title-align="left"]').evaluateAll((groups) => {
      const group = groups.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden";
      });
      if (!group) return null;
      const [title, subtitle] = [...group.children].map((node) => node.getBoundingClientRect());
      return title && subtitle ? Math.abs(title.left - subtitle.left) : null;
    });
    assert.ok(titleAlignment !== null && titleAlignment <= 1,
      `Home title and subtitle should align on the same left edge (difference=${titleAlignment})`);

    const visualTokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const button = document.querySelector('[data-testid="client-new-case-button"]');
      return {
        radius: root.getPropertyValue("--radius").trim(),
        shadowSoft: root.getPropertyValue("--shadow-soft").trim(),
        borderRadius: button ? getComputedStyle(button).borderRadius : "",
        whiteSpace: button ? getComputedStyle(button).whiteSpace : "",
        buttonText: button?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      };
    });
    assert.ok(parseFloat(visualTokens.radius) > 0, `${theme}: --radius should be defined and positive`);
    assert.ok(parseFloat(visualTokens.borderRadius) > 0, `${theme}: button border-radius should be non-zero`);
    assert.ok(visualTokens.shadowSoft.length > 0, `${theme}: shared shadow token should be defined`);
    assert.equal(visualTokens.whiteSpace, "nowrap", "New case should stay on one line at 390px");
    assert.match(visualTokens.buttonText, /New case$/);

    const bottomNav = page.locator(".lf-mobile-bottom-nav");
    for (const label of ["Home", "Messages", "Post", "Cases", "More"]) {
      await bottomNav.getByText(label, { exact: true }).waitFor();
    }
    const navLayout = await bottomNav.evaluate((nav) => ({
      background: getComputedStyle(nav).backgroundColor,
      borderTopWidth: getComputedStyle(nav).borderTopWidth,
      controls: [...nav.querySelectorAll("a,button")].map((control) => {
        const rect = control.getBoundingClientRect();
        return {
          text: control.innerText,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          clientWidth: control.clientWidth,
          scrollWidth: control.scrollWidth,
        };
      }),
    }));
    assert.notEqual(navLayout.background, "rgba(0, 0, 0, 0)", "bottom navigation should have an opaque background");
    assert.equal(navLayout.borderTopWidth, "1px", "bottom navigation should have a top hairline");
    assert.equal(navLayout.controls.length, 5, "client bottom navigation should have five destinations");
    for (const control of navLayout.controls) {
      assert.ok(control.left >= 0 && control.right <= 390, `tab is clipped by the viewport: ${JSON.stringify(control)}`);
      assert.ok(control.scrollWidth <= control.clientWidth + 1, `tab content is clipped: ${JSON.stringify(control)}`);
    }

    const stepLayout = await page.locator('[data-testid="case-progress-step-label"]').evaluateAll((labels) =>
      labels.map((label) => ({
        text: label.textContent.trim(),
        whiteSpace: getComputedStyle(label).whiteSpace,
        clientWidth: label.clientWidth,
        scrollWidth: label.scrollWidth,
      })));
    assert.deepEqual(stepLayout.map(({ text }) => text), ["Posted", "Matched", "Request", "Proposal", "Hired", "Done"]);
    for (const step of stepLayout) {
      assert.equal(step.whiteSpace, "nowrap", `${step.text} should not wrap within a word`);
      assert.ok(step.scrollWidth <= step.clientWidth, `${step.text} is clipped in the case journey`);
    }

    await page.screenshot({
      path: fileURLToPath(new URL(`../generated-artifacts/client-home-390-${theme}.png`, import.meta.url)),
      fullPage: false,
    });
    await context.close();
  }
  assert.equal(renderedThemeBackgrounds.size, 1, "dark device preference must still render the light palette");
  console.log("PASS: Client Home stays light with a dark device preference and preserves mobile layout.");
} finally {
  await browser.close();
}
