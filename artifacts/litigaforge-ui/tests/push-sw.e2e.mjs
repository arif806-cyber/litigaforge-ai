import assert from "node:assert/strict";
import { chromium } from "playwright";

// The service worker must show pushes (court alerts). Delivers a real push message to the
// production service worker through the DevTools protocol and checks the notification.
const baseUrl = process.env.LITIGAFORGE_E2E_URL ?? "http://127.0.0.1:23790";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "/repl/tools/bin/chromium",
  args: ["--no-sandbox"],
});

async function until(page, fn, label, timeout = 15000) {
  const started = Date.now();
  for (;;) {
    const value = await page.evaluate(fn);
    if (value) return value;
    if (Date.now() - started > timeout) throw new Error(`Timed out waiting for ${label}`);
    await page.waitForTimeout(200);
  }
}

try {
  const context = await browser.newContext();
  await context.grantPermissions(["notifications"], { origin: baseUrl });
  await context.route("**/litigaforge/**", (route) => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const registrations = [];
  cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations: regs }) => registrations.push(...regs));
  await cdp.send("ServiceWorker.enable");

  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await until(page, async () => !!(await navigator.serviceWorker.getRegistration())?.active, "an active service worker", 20000);
  const reg = registrations.find((r) => !r.isDeleted && r.scopeURL.startsWith(baseUrl));
  assert.ok(reg, "service worker registered");

  const payload = { title: "Head to Court 4 — 3 away", body: "Now on item 14. Your matter is item 17.", url: "/lawyer-dashboard", tag: "court-day-101-2026-10-15" };
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: new URL(baseUrl).origin, registrationId: reg.registrationId, data: JSON.stringify(payload),
  });
  const shown = await until(page, async () => {
    const r = await navigator.serviceWorker.getRegistration();
    const list = await r.getNotifications();
    return list.length ? { title: list[0].title, body: list[0].body, tag: list[0].tag, url: list[0].data?.url } : null;
  }, "the first notification");
  assert.deepEqual(shown, { title: payload.title, body: payload.body, tag: payload.tag, url: "/lawyer-dashboard" });

  // A second alert for the same matter replaces the first instead of stacking.
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: new URL(baseUrl).origin, registrationId: reg.registrationId,
    data: JSON.stringify({ ...payload, title: "Your matter is being heard in Court 4" }),
  });
  await until(page, async () => {
    const list = await (await navigator.serviceWorker.getRegistration()).getNotifications();
    return list.length === 1 && list[0].title === "Your matter is being heard in Court 4";
  }, "the replacing notification");
  console.log("PASS: the service worker shows court alerts from push messages and replaces same-matter alerts.");
} finally {
  await browser.close();
}
