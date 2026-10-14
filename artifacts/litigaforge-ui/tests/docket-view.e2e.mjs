import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.LITIGAFORGE_E2E_URL ?? "http://127.0.0.1:23790";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "/repl/tools/bin/chromium",
  args: ["--no-sandbox"],
});

const advocate = {
  id: 17,
  email: "advocate-docket@example.test",
  name: "Ada Advocate",
  role: "advocate",
  subscription_tier: "free",
  is_verified: true,
  lawyer_status: "verified",
};
const watchedCourt = JSON.stringify({
  state: "Delhi",
  district_code: "New Delhi",
  complex_code: "Supreme Court",
  court: "Court",
  court_no: "1",
});
const cases = [
  {
    name: "no profile",
    profile: null,
    tracked_cases_count: 0,
    schedule: { fetched_at: null, source_status: "scheduled_refresh_pending", today: { date: "2026-10-14", matters: [] }, tomorrow: { date: "2026-10-15", matters: [] } },
    expectedState: "docket-setup-state",
  },
  {
    name: "incomplete profile",
    profile: { cause_list_name: "Ada Advocate", enrolment_number: "", court_ids: [] },
    tracked_cases_count: 0,
    schedule: { fetched_at: null, source_status: "profile_required", today: { date: "2026-10-14", matters: [] }, tomorrow: { date: "2026-10-15", matters: [] } },
    expectedState: "docket-setup-state",
  },
  {
    name: "complete profile waiting for refresh",
    profile: { cause_list_name: "Ada Advocate", enrolment_number: "BAR-123", court_ids: [watchedCourt] },
    tracked_cases_count: 0,
    schedule: { fetched_at: null, source_status: "scheduled_refresh_pending", today: { date: "2026-10-14", matters: [] }, tomorrow: { date: "2026-10-15", matters: [] } },
    expectedState: "docket-pending-state",
  },
  {
    name: "fetched schedule with no matters",
    profile: { cause_list_name: "Ada Advocate", enrolment_number: "BAR-123", court_ids: [watchedCourt] },
    tracked_cases_count: 0,
    schedule: { fetched_at: "2026-10-14T06:05:00+05:30", source_status: "connected", today: { date: "2026-10-14", matters: [] }, tomorrow: { date: "2026-10-15", matters: [] } },
    expectedState: "docket-empty-state",
  },
];

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let current = cases[0];
  let courtRequests = 0;
  await context.route("**/litigaforge/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(advocate) });
    }
    if (path.endsWith("/auth/refresh")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    if (path.endsWith("/docket/profile")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: current.profile,
          advocate_profile: { name: "Ada Advocate", bar_number: "BAR-123" },
          tracked_cases_count: current.tracked_cases_count,
        }),
      });
    }
    if (path.endsWith("/docket/schedule")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          source_url: "https://services.ecourts.gov.in/ecourtindia_v6/?p=cause_list/index",
          message: "Cause-list results update on the scheduled eCourtsIndia refresh.",
          ...current.schedule,
        }),
      });
    }
    if (path.endsWith("/docket/courts")) {
      courtRequests += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: [] } }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  const page = await context.newPage();
  for (const state of cases) {
    current = state;
    await page.goto(`${baseUrl}/docket`, { waitUntil: "domcontentloaded" });
    await page.getByTestId(state.expectedState).waitFor({ timeout: 15000 });
    assert.equal(await page.getByRole("link", { name: /Open official eCourts cause list/ }).count(), 1, `${state.name}: source link remains visible`);
    const dimensions = await page.evaluate(() => ({
      width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    assert.ok(
      dimensions.documentWidth <= 390 && dimensions.bodyWidth <= 390,
      `${state.name}: horizontal overflow at 390px: ${JSON.stringify(dimensions)}`,
    );
    assert.equal(courtRequests, 0, `${state.name}: opening the page must not call the eCourts court API`);
  }

  current = cases[0];
  await page.goto(`${baseUrl}/docket`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("docket-setup-state").waitFor();
  assert.equal(await page.getByLabel("Name as it appears in cause lists").inputValue(), "Ada Advocate");
  assert.equal(await page.getByLabel("Enrolment number").inputValue(), "BAR-123");
  await page.getByRole("button", { name: "Set up my cause list" }).click();
  assert.equal(await page.locator("#docket-courts select").first().evaluate((el) => el === document.activeElement), true);
  await page.getByRole("button", { name: "Track a case" }).waitFor();
  await page.getByRole("link", { name: /Open official eCourts cause list/ }).waitFor();

  current = cases[2];
  await page.goto(`${baseUrl}/docket`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("docket-pending-state").waitFor();
  await page.getByTestId("docket-pending-state").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/litigaforge-docket-390.jpg", fullPage: true, type: "jpeg", quality: 80 });
  assert.equal(await page.getByText("Your cause list will appear after the next update at 06:00 or 12:00 IST.").count(), 1);
  assert.equal(await page.getByText(/No fetch time yet/).count(), 0);
  assert.equal(await page.getByText(/Supreme Court/).count(), 1);
  await page.getByRole("button", { name: "Edit courts" }).click();
  assert.ok(courtRequests > 0, "the court API starts only after the advocate opens the court picker");

  current = cases[3];
  await page.goto(`${baseUrl}/docket`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("docket-empty-state").waitFor();
  assert.match(await page.getByTestId("docket-empty-state").innerText(), /No listings found for you today · Last updated/);
  assert.equal(await page.getByRole("heading", { name: "Today’s matters" }).count(), 0);
  assert.equal(await page.getByRole("heading", { name: "Tomorrow’s matters" }).count(), 0);

  await context.close();
  console.log("PASS: all four DocketView states render at 390px, setup fields prefill, empty headings are hidden, and court lookup is deferred until interaction.");
} finally {
  await browser.close();
}
