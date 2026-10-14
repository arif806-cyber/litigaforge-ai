import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Court Day end to end: court board, crowd update with no layout jump, trust rule for big jumps,
// hearing brief, client message in Telugu, week navigation and private-matter masking.
const baseUrl = process.env.LITIGAFORGE_E2E_URL ?? "http://127.0.0.1:23790";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "/repl/tools/bin/chromium",
  args: ["--no-sandbox"],
});
const advocate = {
  id: 19, email: "court-day@example.test", name: "Mira Advocate", role: "advocate",
  subscription_tier: "free", is_verified: true, has_lawyer_profile: true, lawyer_status: "verified",
};
const dateKey = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const mondayOffset = -((new Date().getDay() + 6) % 7);
const week = Array.from({ length: 7 }, (_, i) => ({ date: dateKey(mondayOffset + i), count: 0 }));
const todayIndex = -mondayOffset;
week[todayIndex].count = 2;
const otherIndex = todayIndex === 6 ? 5 : todayIndex + 1;
week[otherIndex].count = 1;
const KEY_4 = "TELANGANA|HYDERABAD|HIGH COURT|4";
const KEY_21 = "TELANGANA|HYDERABAD|HIGH COURT|21";
const shot = (name) => fileURLToPath(new URL(`../generated-artifacts/${name}.png`, import.meta.url));

try {
  await mkdir(new URL("../generated-artifacts/", import.meta.url), { recursive: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    const suffix = viewport.width === 390 ? "390" : "desktop";
    const boards = {
      [KEY_4]: { now_item: 9, updated_at: new Date().toISOString(), minutes_ago: 2, advocates: 3, stale: false, minutes_per_item: 5, source: "advocates_in_court" },
      [KEY_21]: null,
    };
    const posts = [];
    const alertPuts = [];
    const alertPrefs = { enabled: true, devices: 1, push_configured: true };
    const context = await browser.newContext({ viewport, colorScheme: "light", hasTouch: viewport.width === 390 });
    await context.route("**/litigaforge/**", async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (path.endsWith("/auth/me")) return json(advocate);
      if (path.endsWith("/auth/refresh")) return json({ ok: true });
      if (path.endsWith("/lawyer/cases")) return json({ cases: [
        { id: 101, title: "Sharma v. State of Telangana", case_type: "Criminal", client_name: "R. Sharma", court_name: "Telangana HC", cnr_number: "TSHC010000172025", hearing_date: dateKey(0), case_stage: "Arguments", status: "active", created_at: new Date().toISOString() },
        { id: 103, title: "Reddy Constructions v. HMDA", case_type: "Writ", client_name: "V. Reddy", court_name: "Telangana HC", cnr_number: "TSHC010000322024", hearing_date: dateKey(0), case_stage: "Admission", status: "active", created_at: new Date().toISOString() },
        { id: 104, title: "K. Lakshmi v. K. Ramesh", case_type: "Family Law", client_name: "K. Lakshmi", court_name: "Family Court, Hyderabad", cnr_number: "", hearing_date: dateKey(otherIndex - todayIndex), case_stage: "Counselling", status: "active", created_at: new Date().toISOString() },
      ] });
      if (path.endsWith("/court-day/today")) {
        const day = url.searchParams.get("day");
        if (day && day !== dateKey(0)) {
          return json({ date: day, today: dateKey(0), week, notice: "", matters: day === week[otherIndex].date ? [
            { case_id: 104, title: "K. Lakshmi v. K. Ramesh", cnr: null, case_type: "Family Law", client_name: "K. Lakshmi", stage: "Counselling", sensitive: true, court: "Family Court, Hyderabad", hall: null, item: null, list_size: null, court_key: null, place_source: "case", board: null },
          ] : [] });
        }
        return json({ date: dateKey(0), today: dateKey(0), week, notice: "Court, hall and item come from cause lists you have loaded. Board positions are shared by advocates in court, not an official court feed.", matters: [
          { case_id: 101, title: "Sharma v. State of Telangana", cnr: "TSHC010000172025", case_type: "Criminal", client_name: "R. Sharma", stage: "Arguments", sensitive: false, court: "Telangana HC", hall: "4", item: "17", list_size: 45, court_key: KEY_4, place_source: "cause_list", board: boards[KEY_4] },
          { case_id: 103, title: "Reddy Constructions v. HMDA", cnr: "TSHC010000322024", case_type: "Writ", client_name: "V. Reddy", stage: "Admission", sensitive: false, court: "Telangana HC", hall: "21", item: "32", list_size: 60, court_key: KEY_21, place_source: "cause_list", board: boards[KEY_21] },
        ] });
      }
      if (path.endsWith("/court-day/board") && route.request().method() === "POST") {
        const body = JSON.parse(route.request().postData() || "{}");
        posts.push(body);
        const current = boards[body.court_key]?.now_item ?? null;
        if (current !== null && (body.item_no > current + 30 || body.item_no < current - 2)) {
          return json({ status: "pending", message: "That is a big jump. It will show once another advocate confirms it.", board: boards[body.court_key] });
        }
        boards[body.court_key] = { now_item: body.item_no, updated_at: new Date().toISOString(), minutes_ago: 0, advocates: 1, stale: false, minutes_per_item: 5, source: "advocates_in_court" };
        return json({ status: "accepted", message: "Board updated.", board: boards[body.court_key] });
      }
      if (path.endsWith("/court-day/alerts")) {
        if (route.request().method() === "PUT") {
          const body = JSON.parse(route.request().postData() || "{}");
          alertPuts.push(body.enabled);
          alertPrefs.enabled = body.enabled;
          return json({ enabled: body.enabled });
        }
        return json(alertPrefs);
      }
      if (path.endsWith("/court-day/brief/101")) return json({
        case_id: 101, title: "Sharma v. State of Telangana", cnr: "TSHC010000172025", court: "Telangana High Court",
        judge: "Hon'ble Justice A", stage: "Arguments", status: "Pending", next_date: dateKey(4),
        last_orders: [{ date: dateKey(-13), text: "Counter filed by the State. Listed for arguments." }, { date: dateKey(-27), text: "Notice served." }],
        checklist: ["Confirm hearing listing and appearance requirements", "Check filed pleadings and authorities"],
        law: [{ old: "CrPC s.439", new: "BNSS s.483", note: "pre-1 July 2024 offences may continue under the old code" }],
        sensitive: false, data_as_of: new Date().toISOString(), source: "stored", verify_notice: "Built from stored court data. Check the latest order before relying on it.",
      });
      if (path.endsWith("/lawyer/documents")) return json({ documents: [] });
      if (path.endsWith("/matches/lawyer")) return json({ matches: [] });
      if (path.endsWith("/authorities/alerts")) return json({ alerts: [] });
      if (path.endsWith("/chat/threads")) return json({ threads: [] });
      return json({});
    });

    const page = await context.newPage();
    await page.goto(`${baseUrl}/advocate-dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/lawyer-dashboard\/?$/);
    const board = page.getByTestId("court-board");
    await board.waitFor();
    await page.waitForTimeout(500);

    // 1. Board: now 9 vs my 17, honest pace-based estimate, source shown.
    assert.equal(await page.getByTestId("board-now").innerText(), "9");
    assert.equal(await page.getByTestId("board-mine").innerText(), "17");
    const status = page.getByTestId("board-status");
    assert.match(await status.innerText(), /8 matters ahead of you/);
    assert.match(await status.innerText(), /About 40 min at this court's pace today/);
    assert.match(await board.innerText(), /Updated 2 min ago/);
    assert.match(await board.innerText(), /by 3 advocates in court/);
    assert.match(await board.innerText(), /Your item · of 45/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "fits the viewport");
    await page.screenshot({ path: shot(`court-day-${suffix}-board`) });

    // 2. Advocate in court updates to 14: board moves, turns red "near", and nothing below shifts.
    const statusBox = await status.boundingBox();
    const cardBox = await page.getByTestId("court-day-matter-101").boundingBox();
    await page.getByTestId("board-update-open").click();
    const sheet = page.getByTestId("board-update-sheet");
    await sheet.waitFor();
    await page.getByTestId("board-item-input").fill("14");
    await page.waitForTimeout(350);
    await page.screenshot({ path: shot(`court-day-${suffix}-update-sheet`) });
    await page.getByTestId("board-update-submit").click();
    await sheet.waitFor({ state: "detached" });
    await page.waitForFunction(() => document.querySelector('[data-testid="board-now"]')?.textContent === "14");
    await page.waitForTimeout(700);
    assert.deepEqual(posts.at(-1), { court_key: KEY_4, item_no: 14 });
    assert.equal(await status.getAttribute("data-tone"), "near");
    assert.match(await status.innerText(), /3 matters ahead of you/);
    assert.match(await status.innerText(), /Head to Court 4 now/);
    const statusAfter = await status.boundingBox();
    const cardAfter = await page.getByTestId("court-day-matter-101").boundingBox();
    assert.equal(Math.round(statusAfter.height), Math.round(statusBox.height), "status row keeps its height");
    assert.equal(Math.round(cardAfter.y), Math.round(cardBox.y), "matter cards do not jump when the alert appears");
    await page.screenshot({ path: shot(`court-day-${suffix}-near`) });

    // 3. An implausible jump is held, not shown.
    await page.getByTestId("board-update-open").click();
    await sheet.waitFor();
    await page.getByTestId("board-item-input").fill("80");
    await page.getByTestId("board-update-submit").click();
    await sheet.getByText(/another advocate confirms/).waitFor();
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached" });
    assert.equal(await page.getByTestId("board-now").innerText(), "14");

    // 4. Follow another court's board: no updates yet → honest empty board with cause-list position.
    await page.getByRole("button", { name: "Court 21 · Item 32" }).click();
    await page.getByText("No update from this court yet").waitFor();
    assert.match(await board.innerText(), /Cause list: your matter is item 32 of 60/);
    await page.getByRole("button", { name: "Court 4 · Item 17" }).click();

    // 5. Hearing brief from stored data, with the new-law crosswalk.
    await page.getByTestId("court-day-matter-101").getByTestId("matter-brief").click();
    const brief = page.getByTestId("brief-sheet");
    await brief.getByTestId("brief-body").waitFor();
    const briefText = await brief.innerText();
    assert.match(briefText, /BNSS s\.483/);
    assert.match(briefText, /formerly CrPC s\.439/);
    assert.match(briefText, /Counter filed by the State/);
    assert.match(briefText, /Hon'ble Justice A/);
    await page.waitForTimeout(350);
    await page.screenshot({ path: shot(`court-day-${suffix}-brief`) });

    // 6. Share the next date with the client in Telugu.
    await brief.getByTestId("brief-share").click();
    const share = page.getByTestId("share-sheet");
    await share.waitFor();
    await share.getByTestId("share-lang-te").click();
    const preview = await share.getByTestId("share-preview").innerText();
    assert.match(preview, /నమస్కారం R\. Sharma గారు/);
    assert.match(preview, /తదుపరి విచారణ తేదీ/);
    const wa = await share.getByTestId("share-whatsapp").getAttribute("href");
    assert.ok(wa.startsWith("https://wa.me/?text=") && decodeURIComponent(wa).includes("తదుపరి"));
    await page.waitForTimeout(350);
    await page.screenshot({ path: shot(`court-day-${suffix}-share-te`) });
    await page.keyboard.press("Escape");
    await share.waitFor({ state: "detached" });

    // 7. Tell the client about today's listing (language choice is remembered).
    await page.getByTestId("court-day-matter-101").getByTestId("matter-share").click();
    await share.waitFor();
    assert.match(await share.getByTestId("share-preview").innerText(), /ఈ రోజు విచారణకు ఉంది/);
    await share.getByTestId("share-lang-en").click();
    const todayMsg = await share.getByTestId("share-preview").innerText();
    assert.match(todayMsg, /listed for hearing today/);
    assert.match(todayMsg, /Court Hall 4, Item 17/);
    await page.keyboard.press("Escape");
    await share.waitFor({ state: "detached" });

    // 8. Alert bell: the choice is saved on the server (so pushes respect it with the app closed).
    await page.getByRole("button", { name: "Turn off the near-turn alert" }).click();
    await page.getByText("Court alerts off", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Alert me when my turn is near" }).click();
    await page.getByText("Court alerts on", { exact: true }).waitFor();
    assert.deepEqual(alertPuts, [false, true]);

    // 9. Losing the connection keeps the last board on screen with a quiet note.
    await context.setOffline(true);
    await page.getByTestId("court-day-offline").waitFor();
    assert.equal(await page.getByTestId("board-now").innerText(), "14", "last known board stays visible offline");
    await context.setOffline(false);
    await page.getByTestId("court-day-offline").waitFor({ state: "detached" });

    // 10. Another day: private family matter, no board, no item.
    await page.getByTestId("court-day-week").locator("button").nth(otherIndex).click();
    await page.getByTestId("court-day-matter-104").waitFor();
    assert.equal(await board.count(), 0, "board only shows on today");
    assert.match(await page.getByTestId("court-day-matter-104").innerText(), /Private/);
    assert.match(await page.getByTestId("court-day-matter-104").innerText(), /Find item in cause list/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "fits the viewport");
    await page.screenshot({ path: shot(`court-day-${suffix}-week`) });

    await context.close();
  }
  console.log("PASS: Court Day board, crowd update without layout jump, trust rule, brief, Telugu share, week view and private matters.");
} finally {
  await browser.close();
}
