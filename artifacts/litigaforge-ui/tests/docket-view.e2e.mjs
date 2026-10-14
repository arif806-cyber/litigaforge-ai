import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.LITIGAFORGE_E2E_URL ?? "http://127.0.0.1:23790";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "/repl/tools/bin/chromium",
  args: ["--no-sandbox"],
});

const advocate = { id: 17, email: "advocate-docket@example.test", name: "Ada Advocate", role: "advocate", subscription_tier: "free", is_verified: true };
const court = { state: "Delhi", district_code: "New Delhi", complex_code: "Supreme Court", court: "Court", court_no: "1" };
const matters = [
  { itemNo: 1, caseNo: "CS/1/2026", petitioner: "Ada Advocate", respondent: "Ravi Kumar", stage: "Arguments", cnr: "DLHC010000012026" },
  { itemNo: 2, caseNo: "CS/2/2026", petitioner: "Other Party", respondent: "State of Delhi", stage: "Evidence", cnr: "DLHC010000022026" },
];

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let profile = null;
  let courtRequests = 0;
  let loads = 0;
  let saves = 0;
  await context.route("**/litigaforge/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/auth/me")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(advocate) });
    if (path.endsWith("/auth/refresh")) return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    if (path.endsWith("/docket/profile") && route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile, advocate_profile: { name: "Ada Advocate", bar_number: "BAR-123" }, tracked_cases_count: 0 }) });
    }
    if (path.endsWith("/docket/profile") && route.request().method() === "PUT") {
      saves += 1;
      profile = JSON.parse(route.request().postData());
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile }) });
    }
    if (path.endsWith("/docket/schedule")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ courts: [], source_url: "https://services.ecourts.gov.in/ecourtindia_v6/?p=cause_list/index" }) });
    if (path.endsWith("/docket/courts")) {
      courtRequests += 1;
      const requested = url.searchParams.get("path");
      const data = requested === "states" ? [{ state: "Delhi", stateName: "Delhi" }]
        : requested.endsWith("/districts") ? [{ districtCode: "New Delhi", districtName: "New Delhi" }]
        : requested.endsWith("/complexes") ? [{ courtComplexCode: "Supreme Court", courtComplexName: "Supreme Court" }]
        : [{ court: "Court", courtNo: "1", judgeName: "Justice Sample" }];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: data } }) });
    }
    if (path.endsWith("/docket/load")) {
      loads += 1;
      const date = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        source_url: "https://services.ecourts.gov.in/ecourtindia_v6/?p=cause_list/index",
        courts: [{ court, today: { date, status: "ok", matters, fetched_at: new Date().toISOString(), source_url: "https://services.ecourts.gov.in/ecourtindia_v6/?p=cause_list/index" }, tomorrow: { date: tomorrow, status: "no_sitting", matters: [], fetched_at: new Date().toISOString() } }],
      }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  const page = await context.newPage();
  await page.goto(`${baseUrl}/docket`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "DocketView" }).waitFor();
  assert.equal(courtRequests, 0, "opening DocketView must not call the eCourts court API");
  assert.equal(loads, 0, "opening DocketView must not load cause-list matters");
  assert.equal(await page.getByLabel(/Name as it appears in cause lists/).getAttribute("required"), null);
  assert.equal(await page.getByLabel(/Enrolment number/).getAttribute("required"), null);
  await page.getByLabel(/Name as it appears in cause lists/).fill("");
  await page.getByLabel(/Enrolment number/).fill("");
  assert.match(await page.getByText(/Add your name as it appears/).innerText(), /highlight your matters/);
  await page.getByLabel(/Name as it appears in cause lists/).fill("Ada Advocate");
  await page.getByLabel(/Enrolment number/).fill("BAR-123");

  await page.getByLabel("State").focus();
  await page.getByRole("option", { name: "Delhi" }).waitFor({ state: "attached" });
  await page.getByLabel("State").selectOption("Delhi");
  await page.getByRole("option", { name: "New Delhi" }).waitFor({ state: "attached" });
  await page.getByLabel("District").selectOption("New Delhi");
  await page.getByRole("option", { name: "Supreme Court" }).waitFor({ state: "attached" });
  await page.getByLabel("Court complex").selectOption("Supreme Court");
  await page.getByRole("button", { name: /Choose courts/ }).click();
  const dialog = page.getByRole("dialog", { name: "Choose courts" });
  await dialog.getByLabel("Search courts by judge or court number").fill("Justice Sample");
  const courtOption = dialog.getByLabel(/Justice Sample/);
  await courtOption.waitFor();
  assert.equal(await courtOption.isChecked(), false, "court picker starts with no courts checked");
  await courtOption.check();
  await dialog.getByRole("button", { name: /Done/ }).click();
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByText("Ada Advocate vs Ravi Kumar").waitFor();
  assert.equal(saves, 1);
  assert.equal(loads, 1, "saving the profile triggers one on-demand load");
  assert.equal(profile.cause_list_name, "Ada Advocate");
  assert.equal(profile.enrolment_number, "BAR-123");
  assert.equal(await page.getByRole("link", { name: "CNR DLHC010000012026" }).count(), 1);
  await page.getByRole("button", { name: "My matters" }).click();
  assert.equal(await page.getByText("Ada Advocate vs Ravi Kumar").count(), 1);
  assert.equal(await page.getByText("Other Party vs State of Delhi").count(), 0);
  await page.getByRole("button", { name: "All matters" }).click();
  assert.equal(await page.getByText("Other Party vs State of Delhi").count(), 1);

  const dimensions = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(dimensions.document <= 390 && dimensions.body <= 390, `no horizontal overflow at 390px: ${JSON.stringify(dimensions)}`);
  await page.screenshot({ path: "/tmp/litigaforge-docket-390.jpg", fullPage: true, type: "jpeg", quality: 80 });
  await context.close();
  console.log("PASS: DocketView does no page-open vendor fetch, saves with optional details, loads once after save, filters matters, and fits 390px.");
} finally {
  await browser.close();
}
