import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.LITIGAFORGE_E2E_URL ?? "http://127.0.0.1:23790";
const accounts = new Map();
let sessionUser = null;
const subscriptionMutations = [];
const subscriptionPlans = [
  { id: "free", name: "Free", price_inr: 0, monthly_price_inr: 0, annual_price_inr: 0, gst_percent: 18, gst_label: "+ 18% GST", cases_per_month: 5, ai_label: "Standard AI", features: ["5 cases per month"] },
  { id: "professional", name: "Advocate Pro", price_inr: 999, monthly_price_inr: 999, annual_price_inr: 9999, gst_percent: 18, gst_label: "+ 18% GST", annual_savings_label: "Save annually", trial_days: 30, cases_per_month: 50, ai_label: "Advanced AI", features: ["50 cases per month"] },
  { id: "advocate_pro", name: "Chamber", price_inr: 2499, monthly_price_inr: 2499, annual_price_inr: 24999, gst_percent: 18, gst_label: "+ 18% GST", chamber_advocates: 5, cases_per_month: -1, ai_label: "Multi-model AI", features: ["Unlimited cases"] },
];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH ?? "/repl/tools/bin/chromium",
  args: ["--no-sandbox"],
});

function response(route, status, body) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem("lf_onboarded", "1");
    localStorage.setItem("lf_disclaimer_seen", "1");
  });
  await context.route("**/litigaforge/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    let body = {};
    if (method === "POST") {
      try { body = request.postDataJSON() ?? {}; } catch { /* no JSON body */ }
    }

    if (path.endsWith("/auth/me")) {
      return sessionUser ? response(route, 200, sessionUser) : response(route, 401, { detail: "Authentication required" });
    }
    if (path.endsWith("/auth/refresh")) {
      return sessionUser ? response(route, 200, { ok: true }) : response(route, 401, { detail: "No refresh token" });
    }
    if (path.endsWith("/auth/register") && method === "POST") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (accounts.has(email)) return response(route, 409, { detail: "Email already registered" });
      const user = {
        id: accounts.size + 1,
        email,
        name: body.name,
        role: body.role,
        subscription_tier: "free",
        has_lawyer_profile: false,
      };
      accounts.set(email, { user, password: body.password });
      sessionUser = user;
      await context.addCookies([
        { name: "lf_token", value: "local-test-access", url: baseUrl, httpOnly: true, sameSite: "Lax" },
        { name: "lf_refresh", value: "local-test-refresh", url: baseUrl, httpOnly: true, sameSite: "Lax" },
      ]);
      return response(route, 200, { user });
    }
    if (path.endsWith("/auth/login") && method === "POST") {
      const account = accounts.get(String(body.email ?? "").trim().toLowerCase());
      if (!account || account.password !== body.password) {
        return response(route, 401, { detail: "Incorrect email or password" });
      }
      sessionUser = account.user;
      return response(route, 200, { user: sessionUser });
    }
    if (path.endsWith("/auth/logout") && method === "POST") {
      sessionUser = null;
      await context.clearCookies();
      return response(route, 200, { message: "Logged out successfully" });
    }
    if (path.endsWith("/lawyers/register") && method === "POST") {
      if (sessionUser) {
        sessionUser.has_lawyer_profile = true;
        accounts.get(sessionUser.email).user = sessionUser;
      }
      return response(route, 200, { ok: true });
    }
    if (path.endsWith("/subscription/plans")) {
      return response(route, 200, subscriptionPlans);
    }
    if (path.endsWith("/subscription/invoices")) {
      return response(route, 200, { invoices: [] });
    }
    if (["/subscription/start-trial", "/subscription/create-order", "/subscription/verify"].some((suffix) => path.endsWith(suffix))) {
      subscriptionMutations.push(`${method} ${path}`);
      return response(route, 500, { detail: "Unexpected subscription mutation in browser test" });
    }
    return response(route, 200, {});
  });

  const page = await context.newPage();

  async function completeAdvocateProfile(email) {
    await page.getByTestId("advocate-email-verification").waitFor();
    sessionUser.email_verified = true;
    accounts.get(email).user.email_verified = true;
    await page.getByTestId("button-check-verification").click();
    await page.getByPlaceholder("Phone number").waitFor();
    await page.getByPlaceholder("Phone number").fill("5550100");
    await page.getByTestId("button-registration-next").click();
    await page.getByTestId("button-registration-next").click();
    await page.getByRole("button", { name: "Civil Matters", exact: true }).click();
    await page.getByTestId("button-submit-advocate-profile").click();
  }

  // An explicit safe next URL wins over plan intent and is stored before any
  // full-page registration redirect.
  await page.goto(`${baseUrl}/register?role=advocate&plan=professional&billing=annual&next=%2Fworkspace`);
  await page.waitForFunction(() => sessionStorage.getItem("lf_return_to") === "/workspace");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("lf_return_to")), "/workspace");
  await page.evaluate(() => sessionStorage.removeItem("lf_return_to"));

  for (const role of ["client", "advocate"]) {
    const email = `${role}-flow-${Date.now()}@litigaforge.test`;
    const roleLabel = role === "client" ? "Client" : "Advocate";
    await page.goto(`${baseUrl}/register/`);
    await page.getByRole("button", { name: roleLabel, exact: true }).click();
    const nameInput = page.getByPlaceholder(role === "client" ? "Ravi Kumar" : "Adv. Ramesh Kumar");
    await nameInput.fill("A");
    await page.getByPlaceholder("you@example.com").fill("invalid");
    await page.getByPlaceholder("Minimum 8 characters").fill("short");
    await page.getByRole("checkbox").check();
    await page.getByTestId("create-account-btn").click();
    assert.equal(await page.getByPlaceholder("you@example.com").evaluate((input) => input.validity.typeMismatch), true);
    await page.getByPlaceholder("you@example.com").fill(`${role}-validation@litigaforge.test`);
    await page.getByTestId("create-account-btn").click();
    await page.getByText("Name must be at least 2 characters").waitFor();
    await page.getByText("Password must be at least 8 characters").waitFor();

    await nameInput.fill(`E2E ${roleLabel}`);
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("Minimum 8 characters").fill("LocalTest123!");
    await page.getByTestId("create-account-btn").click();
    if (role === "client") {
      await page.waitForURL(/\/client-dashboard\/?$/);
    } else {
      await page.waitForURL(/\/in\/lawyers\/register\/?$/);
      await completeAdvocateProfile(email);
      await page.getByText("Profile Submitted!").waitFor();
      await page.getByRole("button", { name: "Close", exact: true }).click();
    }
    assert.equal(accounts.get(email).user.role, role);
    assert.equal((await context.cookies()).some((cookie) => cookie.name === "lf_refresh"), true);

    await page.evaluate(async () => {
      await fetch("/litigaforge/auth/logout", { method: "POST", credentials: "include" });
    });
    assert.equal(sessionUser, null);
    assert.equal((await context.cookies()).some((cookie) => cookie.name === "lf_refresh"), false);
    await page.goto(`${baseUrl}/login/`);
    await page.getByRole("button", { name: roleLabel, exact: true }).click();
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("Minimum 8 characters").fill("LocalTest123!");
    await page.getByTestId("create-account-btn").click();
    await page.waitForURL(role === "client" ? /\/(?:in\/)?client-dashboard\/?$/ : /\/(?:in\/)?lawyer-dashboard\/?$/);
    assert.equal(sessionUser.email, email);

    await page.evaluate(async () => {
      await fetch("/litigaforge/auth/logout", { method: "POST", credentials: "include" });
    });
    await page.goto(`${baseUrl}/register/`);
    await page.getByRole("button", { name: roleLabel, exact: true }).click();
    await page.getByPlaceholder(role === "client" ? "Ravi Kumar" : "Adv. Ramesh Kumar").fill(`Duplicate ${roleLabel}`);
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("Minimum 8 characters").fill("LocalTest123!");
    await page.getByRole("checkbox").check();
    await page.getByTestId("create-account-btn").click();
    await page.getByText("Email already registered").waitFor();
  }

  // Paid advocate intent must survive the mandatory profile full-page redirect,
  // then land on an explicit review screen without starting a trial or payment.
  const paidEmail = `paid-advocate-${Date.now()}@litigaforge.test`;
  await page.evaluate(() => sessionStorage.removeItem("lf_return_to"));
  await page.goto(`${baseUrl}/register?role=advocate&plan=professional&billing=annual`);
  await page.waitForFunction(() => sessionStorage.getItem("lf_return_to") === "/subscription?plan=professional&billing=annual");
  await page.getByPlaceholder("Adv. Ramesh Kumar").fill("E2E Paid Advocate");
  await page.getByPlaceholder("you@example.com").fill(paidEmail);
  await page.getByPlaceholder("Minimum 8 characters").fill("LocalTest123!");
  await page.getByRole("checkbox").check();
  await page.getByTestId("create-account-btn").click();
  await page.waitForURL(/\/in\/lawyers\/register\/?$/);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("lf_return_to")), "/subscription?plan=professional&billing=annual");
  await completeAdvocateProfile(paidEmail);
  await page.waitForURL(/\/(?:in\/)?subscription\?plan=professional&billing=annual$/);
  const selectedPlan = page.getByTestId("selected-plan-intent");
  await selectedPlan.waitFor();
  assert.match(await selectedPlan.innerText(), /Advocate Pro selected/);
  assert.match(await selectedPlan.innerText(), /30-day free trial/);
  assert.equal(await page.getByTestId("subscription-plan-professional").count(), 1);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("lf_return_to")), null);
  assert.equal(accounts.get(paidEmail).user.has_lawyer_profile, true);
  assert.deepEqual(subscriptionMutations, []);

  console.log("PASS: registration trailing-slash route, both role selections, validation, test-only accounts, cookie sessions, logout/login redirects, duplicate-email handling, next precedence, and paid advocate intent through profile completion with no trial/payment mutation.");
  await context.close();
} finally {
  await browser.close();
}
