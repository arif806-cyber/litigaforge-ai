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
        const radiusCheck = await page.getByTestId("cases-add-case-btn").evaluate((button) => ({
          radius: getComputedStyle(document.documentElement).getPropertyValue("--radius").trim(),
          borderRadius: getComputedStyle(button).borderRadius,
        }));
        assert.ok(parseFloat(radiusCheck.radius) > 0, `${theme}: --radius should be defined and positive`);
        assert.ok(parseFloat(radiusCheck.borderRadius) > 0, `${theme}: Add Case border-radius should be non-zero`);
        const cnrTile = page.getByTestId("cnr-tracker-icon-tile");
        await cnrTile.waitFor();
        assert.ok(await cnrTile.evaluate(el => el.classList.contains("bg-primary/10")),
          "CNR Case Tracker should use the brand tile, not purple");
      if (viewport.width === 390) {
        assert.equal(await page.getByTestId("cases-add-case-btn").evaluate(el => getComputedStyle(el).position), "fixed");
        assert.ok(await page.getByRole("button", { name: /^Active/ }).isVisible());
        assert.ok(await page.getByRole("button", { name: /^Pending/ }).isVisible());
        assert.ok(await page.getByRole("button", { name: /^Closed/ }).isVisible());
          const casesGap = await page.evaluate(() => {
            const title = document.querySelector("h1")?.getBoundingClientRect();
            const tabs = [...document.querySelectorAll("button")].find(button => button.textContent.trim().startsWith("Active"))?.getBoundingClientRect();
            return title && tabs ? tabs.top - title.bottom : null;
          });
          assert.ok(casesGap !== null && casesGap <= 16, `Cases tabs should sit close under the title (gap=${casesGap})`);
      }
        const caseCard = page.getByTestId("lawyer-case-card-101");
        await caseCard.waitFor();
        assert.equal(await caseCard.locator('[data-testid="case-status-stripe"]').count(), 0, "case cards should not show a decorative status stripe");
        const caseCnr = page.getByTestId("lawyer-case-cnr-101");
        await caseCnr.waitFor();
        assert.match(await caseCnr.evaluate(el => getComputedStyle(el).fontVariantNumeric), /\btabular-nums\b/);
        assert.equal(await caseCnr.locator("svg").count(), 0, "CNR should be plain text without a shield icon");
        assert.equal(
          await caseCnr.evaluate(el => getComputedStyle(el).color),
          await page.locator(".text-muted-foreground").first().evaluate(el => getComputedStyle(el).color),
          "CNR should use the muted text color",
        );
      await page.screenshot({ path: fileURLToPath(new URL(`../generated-artifacts/cases-${suffix}-${theme}.png`, import.meta.url)), fullPage: false });
      await page.goto(`${baseUrl}/docket`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/cause-lists\/?$/);
      await page.getByTestId("docket-view").waitFor();
      await page.waitForTimeout(450);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "cause lists should fit the viewport");
        if (viewport.width === 390) {
          const title = page.locator(".lf-mobile-topbar [data-title-align=left]");
          await title.getByText("Cause lists", { exact: true }).first().waitFor();
          const titleAlignment = await title.evaluateAll(groups => {
            const el = groups.find(node => {
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden";
            });
            if (!el) return null;
            const [heading, subtitle] = [...el.children].map(child => child.getBoundingClientRect());
            return heading && subtitle ? Math.abs(heading.left - subtitle.left) : null;
          });
          assert.ok(titleAlignment !== null && titleAlignment <= 1, `Cause lists title and subtitle should align left (difference=${titleAlignment})`);
        }
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
          const pageShellSpacing = await page.evaluate(() => {
            const tabs = document.querySelector('[data-testid="advocate-tabs-research"]')?.getBoundingClientRect();
            const shell = document.querySelector('[data-testid="page-shell"]')?.getBoundingClientRect();
            const header = document.querySelector('[data-testid="page-shell-header"]');
            return tabs && shell && header ? {
              gap: shell.top - tabs.bottom,
              headerHeight: header.getBoundingClientRect().height,
              borderBottomWidth: getComputedStyle(header).borderBottomWidth,
              paddingBottom: getComputedStyle(header).paddingBottom,
            } : null;
          });
          assert.ok(pageShellSpacing && pageShellSpacing.gap <= 1 && pageShellSpacing.headerHeight === 0
            && pageShellSpacing.borderBottomWidth === "0px" && pageShellSpacing.paddingBottom === "0px",
          `Research should not add a line or gap below tabs (spacing=${JSON.stringify(pageShellSpacing)})`);
        const promoBelowContent = await page.evaluate(() => {
          const content = document.querySelector('[data-testid="section-search"]')?.getBoundingClientRect();
          const promo = document.querySelector('[data-testid="forge-workspace-promo"]')?.getBoundingClientRect();
          return !!content && !!promo && promo.top >= content.bottom;
        });
        assert.equal(promoBelowContent, true, "Forge Workspace promo should follow research content on mobile");
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "research should fit the viewport");
      await page.screenshot({ path: fileURLToPath(new URL(`../generated-artifacts/research-${suffix}-${theme}.png`, import.meta.url)), fullPage: false });
        if (viewport.width === 390) {
          const nav = page.locator(".lf-konsta-tabbar.lf-mobile-bottom-nav");
          const navStyle = await nav.evaluate(el => {
            const style = getComputedStyle(el);
            const opaqueBackground = [...el.children].map(child => getComputedStyle(child).backgroundColor).find(color => {
              const alpha = color.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
              return color !== "rgba(0, 0, 0, 0)" && (!alpha || Number(alpha[1]) >= 1);
            });
            return { background: style.backgroundColor, borderTopWidth: style.borderTopWidth, opacity: style.opacity, height: el.getBoundingClientRect().height, opaqueBackground };
          });
          assert.equal(navStyle.borderTopWidth, "1px", "mobile tab bar should have a top hairline");
          assert.equal(navStyle.opacity, "1", "mobile tab bar should be fully opaque");
          assert.ok(navStyle.opaqueBackground, `tab bar needs a solid background layer (style=${JSON.stringify(navStyle)})`);
          const bottomClearance = await page.locator(".lf-app-layout main").evaluate((main, navHeight) => parseFloat(getComputedStyle(main).paddingBottom) - navHeight, navStyle.height);
          assert.ok(bottomClearance >= 8, `scroll content should clear the tab bar by at least 8px (clearance=${bottomClearance})`);
        }
      await context.close();
    }
  }
  console.log("PASS: Today agenda sorts active hearings and fits mobile/desktop in light and dark themes.");
} finally {
  await browser.close();
}
