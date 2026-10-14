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
        if (path.endsWith("/docket/schedule")) return json({ courts: [
          { court: { court: "Delhi High Court", court_no: "4" }, today: { matters: [{ cnr: "DLHC010000012026", itemNo: 17 }] }, tomorrow: { matters: [] } },
        ] });
        if (path.endsWith("/docket/profile")) return json({ profile: null, advocate_profile: { name: "Mira Advocate", bar_number: "BAR-789" }, tracked_cases_count: 2 });
        if (path.endsWith("/judgments")) return json({ judgments: [], courts: [] });
        if (path.endsWith("/chat/threads")) return json({ threads: [] });
        return json({});
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/advocate-dashboard`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/lawyer-dashboard\/?$/);
      const agenda = page.getByTestId("today-agenda");
      await agenda.waitFor();
      await page.waitForTimeout(450);
      await page.getByRole("heading", { level: 1, name: "Today", exact: true }).waitFor();
      assert.equal(await page.locator("h1").count(), 1, "Today should have a single h1");
      assert.equal(await page.getByText("Welcome back, Mira!", { exact: false }).count(), 0);
      await page.getByText("Today’s hearing — Sharma v State", { exact: true }).waitFor();
      await page.getByText(/Item 17/).waitFor();
      await page.getByTestId("today-cause-lists-link").getByText("Cause lists", { exact: true }).waitFor();
      await page.getByTestId("client-requests-summary").getByText("Client requests: 0 pending", { exact: false }).waitFor();
      assert.equal(await page.getByText("Quick Actions", { exact: true }).isVisible().catch(() => false), false);
      const agendaGap = await page.evaluate(() => {
        const title = document.querySelector('[data-testid="today-hearing-title"]')?.getBoundingClientRect();
        const meta = document.querySelector('[data-testid="today-hearing-meta"]')?.getBoundingClientRect();
        return title && meta ? meta.top - title.bottom : null;
      });
      assert.ok(agendaGap !== null && agendaGap <= 6, `hearing court line should sit close to its title (gap=${agendaGap})`);
      const causeLinkGap = await page.evaluate(() => {
        const heading = document.querySelector('[data-testid="today-agenda-heading"] h3')?.getBoundingClientRect();
        const link = document.querySelector('[data-testid="today-cause-lists-link"]')?.getBoundingClientRect();
        return heading && link ? Math.abs(heading.top - link.top) : null;
      });
      assert.ok(causeLinkGap !== null && causeLinkGap <= 8, `Cause lists link should share the hearings heading row (gap=${causeLinkGap})`);
      if (viewport.width === 390) {
        const mobileNav = page.locator(".lf-konsta-tabbar");
        for (const label of ["Today", "Cases", "Cause lists", "Research", "More"]) {
          await mobileNav.getByText(label, { exact: true }).waitFor();
        }
        assert.equal(await mobileNav.locator("a,button").count(), 5, "mobile advocate navigation should have five destinations");
      } else {
        await page.getByTestId("desktop-page-context").getByText("Today", { exact: true }).waitFor();
        const nav = page.getByTestId("advocate-group-navigation");
        const expected = ["Today", "Cases", "Cause lists", "Clients", "Documents", "Research", "Earnings", "Settings"];
        assert.equal(await nav.locator("a").count(), expected.length, "desktop advocate navigation should have eight groups");
        for (const label of expected) await nav.getByText(label, { exact: true }).waitFor();
        assert.equal(await page.locator("header").getByText("Sign Out", { exact: true }).count(), 0, "sign out belongs in the account menu only");
        await page.locator("header").getByText("Free plan · Upgrade", { exact: true }).waitFor();
        assert.equal(await page.locator("aside nav").getByText("Legal Tools", { exact: true }).count(), 0, "advocate sidebar should not show an empty Legal Tools label");
      }
      await page.getByText("Upcoming hearing — Patel v Union", { exact: true }).waitFor();
      assert.ok(await agenda.getByText("Hearings today", { exact: true }).isVisible());
      assert.ok(await agenda.getByText("Coming up", { exact: true }).isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "dashboard should fit the viewport");
      const suffix = viewport.width === 390 ? "390" : "desktop";
      await page.screenshot({ path: fileURLToPath(new URL(`../generated-artifacts/today-${suffix}-${theme}.png`, import.meta.url)), fullPage: false });
      const casesLink = viewport.width === 390
        ? page.locator(".lf-konsta-tabbar").getByText("Cases", { exact: true })
        : page.getByTestId("advocate-group-navigation").getByText("Cases", { exact: true });
      await casesLink.click();
      await page.waitForURL(/\/lawyer-dashboard\/cases\/?$/);
      await page.waitForTimeout(450);
      if (viewport.width === 390) {
        await page.getByRole("heading", { level: 1, name: "Cases", exact: true }).waitFor();
      } else {
        await page.getByTestId("desktop-page-context").getByText("Cases", { exact: true }).waitFor();
      }
      assert.equal(await page.locator("h1").count(), 1, "Cases should have one title");
      assert.equal(await page.getByTestId("add-case-btn").isVisible().catch(() => false), false);
      await page.getByTestId("cases-add-case-btn").waitFor();
      if (viewport.width === 390) {
        assert.equal(await page.getByTestId("cases-add-case-btn").evaluate(el => getComputedStyle(el).position), "fixed");
        assert.ok(await page.getByRole("button", { name: /^Active/ }).isVisible());
        assert.ok(await page.getByRole("button", { name: /^Pending/ }).isVisible());
        assert.ok(await page.getByRole("button", { name: /^Closed/ }).isVisible());
      }
      await page.screenshot({ path: fileURLToPath(new URL(`../generated-artifacts/cases-${suffix}-${theme}.png`, import.meta.url)), fullPage: false });
      await page.goto(`${baseUrl}/docket`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/cause-lists\/?$/);
      await page.getByTestId("docket-view").waitFor();
      await page.waitForTimeout(450);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "cause lists should fit the viewport");
      await page.screenshot({ path: fileURLToPath(new URL(`../generated-artifacts/cause-lists-${suffix}-${theme}.png`, import.meta.url)), fullPage: false });
      await page.goto(`${baseUrl}/judgments`, { waitUntil: "domcontentloaded" });
      await page.getByText("Search all case law with AI", { exact: true }).waitFor();
      await page.waitForTimeout(450);
      if (viewport.width === 390) {
        await page.locator(".lf-mobile-research-header [data-title-align=left]").getByText("Research", { exact: true }).first().waitFor();
        const researchTabs = page.getByTestId("advocate-tabs-research");
        for (const label of ["Judgments", "AI drafting", "Q&A", "Workspace"]) await researchTabs.getByText(label, { exact: true }).waitFor();
        const tabsGeometry = await page.evaluate(() => {
          const header = document.querySelector(".lf-mobile-research-header")?.getBoundingClientRect();
          const tabs = document.querySelector('[data-testid="advocate-tabs-research"]')?.getBoundingClientRect();
          return header && tabs ? { headerBottom: header.bottom, tabsTop: tabs.top, tabsHeight: tabs.height } : null;
        });
        assert.ok(tabsGeometry && tabsGeometry.tabsHeight >= 40 && Math.abs(tabsGeometry.tabsTop - tabsGeometry.headerBottom) <= 1, `Research tabs should sit directly below the title (geometry=${JSON.stringify(tabsGeometry)})`);
        const promoBelowContent = await page.evaluate(() => {
          const content = document.querySelector('[data-testid="section-search"]')?.getBoundingClientRect();
          const promo = document.querySelector('[data-testid="forge-workspace-promo"]')?.getBoundingClientRect();
          return !!content && !!promo && promo.top >= content.bottom;
        });
        assert.equal(promoBelowContent, true, "Forge Workspace promo should follow research content on mobile");
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "research should fit the viewport");
      await page.screenshot({ path: fileURLToPath(new URL(`../generated-artifacts/research-${suffix}-${theme}.png`, import.meta.url)), fullPage: false });
      await context.close();
    }
  }
  console.log("PASS: Today agenda sorts active hearings and fits mobile/desktop in light and dark themes.");
} finally {
  await browser.close();
}
