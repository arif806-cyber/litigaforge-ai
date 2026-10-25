import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readSubscriptionIntent, subscriptionIntentPath } from "../src/lib/subscription-intent.ts";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the public advocate route uses its own page outside the authenticated app layout", async () => {
  const app = await source("../src/App.tsx");
  assert.match(app, /const ForLawyersPage\s*= lazy\(\(\) => import\("@\/pages\/for-lawyers"\)\)/);
  assert.match(app, /const ForLawyersRoute = errorRoute\("for-lawyers", ForLawyersPage\)/);
  assert.doesNotMatch(app, /function ForLawyersRoute\(\)\s*\{\s*return <CountryLanding/);

  const advocateRoute = app.indexOf('<Route path="/for-lawyers" component={ForLawyersRoute} />');
  const authenticatedLayout = app.indexOf("<Layout>");
  assert.ok(advocateRoute > 0, "the dedicated public route must exist");
  assert.ok(advocateRoute < authenticatedLayout, "the acquisition page must render before the app-layout catch-all");
});

test("advocate acquisition prices come only from the shared advocate catalog", async () => {
  const page = await source("../src/pages/for-lawyers.tsx");
  assert.match(page, /import sharedPlanPrices from "\.\.\/\.\.\/\.\.\/\.\.\/shared-plan-prices\.json"/);
  assert.match(page, /const advocatePrices = sharedPlanPrices\.advocate/);
  assert.match(page, /advocatePrices\.professional\.monthly/);
  assert.match(page, /advocatePrices\.advocate_pro\.monthly/);
  assert.doesNotMatch(page, /PricingSection|CountryLanding|sharedPlanPrices\.public/);
  assert.doesNotMatch(page, /₹999|₹2,499|monthly:\s*999|monthly:\s*2499/);
});

test("advocate CTAs preserve role and paid-plan intent without confusing consumer plan ids", async () => {
  const page = await source("../src/pages/for-lawyers.tsx");
  assert.match(page, /\/register\?role=advocate&plan=professional&billing=monthly/);
  assert.match(page, /\/register\?role=advocate&plan=advocate_pro&billing=monthly/);
  assert.doesNotMatch(page, /\/register\?plan=(?:basic|pro)(?:&|"|')/);
  assert.match(page, /data-testid="button-hero-advocate-start"/);
  assert.match(page, /data-testid=\{`button-plan-\$\{plan\.id\}`\}/);
  assert.match(page, /trackEvent\("advocate_acquisition_cta"/);
});

test("subscription intent accepts only paid advocate plans and safe billing periods", () => {
  assert.deepEqual(
    readSubscriptionIntent("?plan=professional&billing=annual"),
    { plan: "professional", billing: "annual" },
  );
  assert.deepEqual(
    readSubscriptionIntent("?plan=advocate_pro"),
    { plan: "advocate_pro", billing: "monthly" },
  );
  for (const query of ["?plan=pro", "?plan=basic", "?plan=free", "?plan=unknown", ""]) {
    assert.equal(readSubscriptionIntent(query).plan, null, query);
  }
  assert.equal(readSubscriptionIntent("?plan=professional&billing=weekly").billing, "monthly");
});

test("subscription intent serializes monthly and annual paths and rejects other catalogs", () => {
  assert.equal(
    subscriptionIntentPath("?plan=professional&billing=annual"),
    "/subscription?plan=professional&billing=annual",
  );
  assert.equal(
    subscriptionIntentPath("?plan=advocate_pro"),
    "/subscription?plan=advocate_pro&billing=monthly",
  );
  assert.equal(
    subscriptionIntentPath("?plan=professional&billing=weekly"),
    "/subscription?plan=professional&billing=monthly",
  );
  for (const query of ["?plan=pro", "?plan=basic", "?plan=free", "?plan=unknown", ""]) {
    assert.equal(subscriptionIntentPath(query), null, query);
  }
});

test("registration persists the validated destination and profile completion consumes it", async () => {
  const [login, lawyers] = await Promise.all([
    source("../src/pages/login.tsx"),
    source("../src/pages/lawyers.tsx"),
  ]);
  assert.match(login, /const intendedDestination = next \?\? subscriptionIntentPath\(window\.location\.search\)/);
  assert.match(login, /sessionStorage\.setItem\("lf_return_to", intendedDestination\)/);
  assert.match(login, /if \(next\) return next;\s*return subscriptionIntentPath\(window\.location\.search\)/);
  assert.doesNotMatch(login, /if \(plan && plan !== "free"\)/);
  assert.match(lawyers, /safeAuthNext\(sessionStorage\.getItem\("lf_return_to"\)\)/);
  assert.match(lawyers, /sessionStorage\.removeItem\("lf_return_to"\)/);
  assert.match(lawyers, /window\.location\.href = next/);
});

test("plan handoff is explicit and never starts a trial or payment automatically", async () => {
  const subscription = await source("../src/pages/subscription.tsx");
  assert.match(subscription, /readSubscriptionIntent\(window\.location\.search\)/);
  assert.match(subscription, /useState\(subscriptionIntent\.billing === "annual"\)/);
  assert.match(subscription, /data-testid="selected-plan-intent"/);
  assert.match(subscription, /Start the 30-day free trial below—no payment is required—or review paid checkout\./);
  assert.match(subscription, /onClick=\{\(\) => void handleTrial\(\)\}/);
  assert.doesNotMatch(subscription, /useEffect\([^)]*handleTrial|useEffect\([^)]*handleRazorpayUpgrade/);
});

test("advocate marketing discloses fictional previews and legal-data limitations", async () => {
  const page = await source("../src/pages/for-lawyers.tsx");
  assert.match(page, /Illustrative preview/);
  assert.match(page, /FICTIONAL DATA/);
  assert.match(page, /not an official court display board/);
  assert.match(page, /does not use court live streams or scrape display boards/);
  assert.match(page, /not legal advice/);
  assert.match(page, /unverified or unavailable/);
});

test("route metadata and sitemap include the dedicated advocate acquisition page", async () => {
  const [injectSeo, apiSeo, standaloneSeo, sitemap, landing] = await Promise.all([
    source("../scripts/inject-seo.mjs"),
    source("../../api-server/src/app.ts"),
    source("../server.mjs"),
    source("../public/sitemap.xml"),
    source("../src/pages/landing.tsx"),
  ]);
  for (const manifest of [injectSeo, apiSeo, standaloneSeo]) {
    assert.match(manifest, /["']\/for-lawyers["']:\s*\{/);
    assert.match(manifest, /LitigaForge for Advocates/);
  }
  assert.match(sitemap, /https:\/\/litigaforge\.com\/for-lawyers<\/loc>/);
  assert.match(landing, /\{ label: "For advocates", href: "\/for-lawyers" \}/);
  assert.match(landing, /href="\/for-lawyers" className="lf-workflow-link"/);
});
