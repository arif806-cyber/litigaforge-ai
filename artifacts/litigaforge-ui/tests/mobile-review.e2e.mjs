import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.LITIGAFORGE_E2E_URL ?? "http://127.0.0.1:23790";
const outputDir = process.env.MOBILE_SCREENSHOT_DIR ?? "/tmp/litigaforge-mobile-review";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "/repl/tools/bin/chromium",
  args: ["--no-sandbox"],
});
const user = {
  id: "mobile-review-client",
  email: "mobile-review@example.test",
  name: "Mobile Review",
  role: "client",
  subscription_tier: "free",
  has_lawyer_profile: false,
};

try {
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
  });
  await context.addInitScript(() => localStorage.setItem("lf_onboarded", "1"));
  await context.route("**/litigaforge/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
    }
    if (path.endsWith("/auth/refresh")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  const page = await context.newPage();

  const paths = ["/in/client-dashboard", "/in/judgments", "/in/subscription", "/in/settings"];
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of paths) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
      await page.locator(".lf-app-layout").waitFor({ timeout: 15000 });
      const dimensions = await page.evaluate(() => ({
        width: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      }));
      assert.ok(
        dimensions.documentWidth <= dimensions.width && dimensions.bodyWidth <= dimensions.width,
        `Horizontal overflow at ${width}px on ${path}: ${JSON.stringify(dimensions)}`,
      );
      if (width === 360 && path.endsWith("/settings")) {
        await page.locator('[data-testid="pwa-install-card"]').waitFor({ timeout: 5000 });
      }
      if (width === 390 && path.endsWith("/settings")) {
        assert.equal(await page.locator('[data-testid="pwa-install-card"]').count(), 0, "Install prompt should appear only once per user/device");
      }
    }
  }

  await page.goto(`${baseUrl}/in/login`, { waitUntil: "networkidle" });
  assert.equal(await page.locator('[data-testid="pwa-install-card"]').count(), 0, "Install prompt must not appear on login");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => localStorage.setItem("vite-ui-theme", "light"));
  await page.goto(`${baseUrl}/in/client-dashboard`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${outputDir}/client-dashboard-light-390.jpg`, fullPage: true, type: "jpeg", quality: 78 });
  await page.evaluate(() => {
    localStorage.setItem("vite-ui-theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: `${outputDir}/client-dashboard-dark-390.jpg`, fullPage: true, type: "jpeg", quality: 78 });

  await page.locator(".lf-konsta-tabbar button").last().click();
  await page.getByRole("heading", { name: "More" }).waitFor();
  await page.waitForFunction(
    () => (document.querySelector(".lf-konsta-sheet")?.getBoundingClientRect().top ?? Infinity) < 200,
    null,
    { timeout: 5000 },
  );
  const sheetBounds = await page.locator(".lf-konsta-sheet").evaluate((element) => {
    const { top, height } = element.getBoundingClientRect();
    return { top, height };
  });
  assert.ok(sheetBounds.height >= 650 && sheetBounds.top <= 200, `More sheet should expose the full grid on mobile, got ${JSON.stringify(sheetBounds)}`);
  await page.screenshot({ path: `${outputDir}/more-sheet-390.jpg`, fullPage: false, type: "jpeg", quality: 82 });
  assert.equal(await page.locator('[aria-label="More tools"] a').count() > 0, true, "More sheet grid should be present");
  await context.close();
  console.log(`PASS: no document/body horizontal overflow at 360px and 390px across ${paths.length} mobile routes; captured three 390px screenshots.`);
} finally {
  await browser.close();
}
