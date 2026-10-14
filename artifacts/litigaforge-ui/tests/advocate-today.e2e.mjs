import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = process.env.LITIGAFORGE_E2E_URL ?? "http://127.0.0.1:23790";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "/repl/tools/bin/chromium",
  args: ["--no-sandbox"],
});
const advocate = {
  id: 19, email: "advocate-today@example.test", name: "Mira Advocate",
  role: "advocate", subscription_tier: "free", is_verified: true,
  has_lawyer_profile: true, lawyer_status: "verified",
};
const dateKey = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

try {
  await mkdir(new URL("../generated-artifacts/", import.meta.url), { recursive: true });
  for (const theme of ["light", "dark"]) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript((savedTheme) => localStorage.setItem("vite-ui-theme", savedTheme), theme);
      await context.route("**/litigaforge/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        if (path.endsWith("/auth/me")) return json(advocate);
        if (path.endsWith("/auth/refresh")) return json({ ok: true });
        if (path.endsWith("/lawyer/cases")) return json({ cases: [
          { id: 101, title: "Today’s hearing — Sharma v State", case_type: "Civil", client_name: "R. Sharma", court_name: "Delhi High Court", cnr_number: "DLHC010000012026", hearing_date: dateKey(0), case_stage: "Arguments", status: "active", created_at: new Date().toISOString() },
          { id: 102, title: "Upcoming hearing — Patel v Union", case_type: "Civil", client_name: "A. Patel", court_name: "Supreme Court", cnr_number: "DLHC010000022026", hearing_date: dateKey(2), case_stage: "Notice", status: "active", created_at: new Date().toISOString() },
        ] });
        if (path.endsWith("/lawyer/documents")) return json({ documents: [] });
        if (path.endsWith("/matches/lawyer")) return json({ matches: [] });
        if (path.endsWith("/authorities/alerts")) return json({ alerts: [] });
        if (path.endsWith("/chat/threads")) return json({ threads: [] });
        return json({});
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/lawyer-dashboard`, { waitUntil: "domcontentloaded" });
      const agenda = page.getByTestId("today-agenda");
      await agenda.waitFor();
      if (viewport.width === 390) {
        await page.locator(".lf-mobile-topbar").getByText("Today", { exact: true }).first().waitFor();
      } else {
        await page.getByTestId("desktop-page-context").getByText("Today", { exact: true }).waitFor();
      }
      await page.getByText("Today’s hearing — Sharma v State", { exact: true }).waitFor();
      await page.getByText("Upcoming hearing — Patel v Union", { exact: true }).waitFor();
      assert.ok(await agenda.getByText("Hearings today", { exact: true }).isVisible());
      assert.ok(await agenda.getByText("Coming up", { exact: true }).isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "dashboard should fit the viewport");
      const suffix = viewport.width === 390 ? "390" : "desktop";
      await page.screenshot({ path: fileURLToPath(new URL(`../generated-artifacts/today-${suffix}-${theme}.png`, import.meta.url)), fullPage: false });
      await page.getByTestId("tab-cases").click();
      await page.waitForURL(/\/lawyer-dashboard\/cases\/?$/);
      if (viewport.width === 390) {
        await page.locator(".lf-mobile-topbar").getByText("Cases", { exact: true }).first().waitFor();
      } else {
        await page.getByTestId("desktop-page-context").getByText("Cases", { exact: true }).waitFor();
      }
      await page.getByRole("heading", { name: "Case Management" }).waitFor();
      await context.close();
    }
  }
  console.log("PASS: Today agenda sorts active hearings and fits mobile/desktop in light and dark themes.");
} finally {
  await browser.close();
}
