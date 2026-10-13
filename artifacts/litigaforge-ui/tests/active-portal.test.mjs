import test from "node:test";
import assert from "node:assert/strict";

import {
  clientNavigationActive,
  portalForRoute,
  portalDashboardPath,
  portalFromRole,
  portalStorageKey,
  postAuthDestination,
} from "../src/lib/active-portal.ts";

test("client tab routes advocate accounts to the client dashboard without changing account role", () => {
  const selectedPortal = portalFromRole("client");
  assert.equal(selectedPortal, "client");
  assert.equal(portalDashboardPath(selectedPortal), "/client-dashboard");
  assert.equal(postAuthDestination(selectedPortal, true, null), "/client-dashboard");
});

test("advocate tab requires profile setup and then honors a safe next destination", () => {
  assert.equal(postAuthDestination("advocate", false, "/my-cases"), "/lawyers/register?setup=advocate");
  assert.equal(postAuthDestination("advocate", true, "/my-cases"), "/my-cases");
});

test("client portal keeps client navigation on client pages independent of URL", () => {
  for (const path of ["/post-case", "/my-cases"]) {
    assert.equal(clientNavigationActive("client", path), true);
  }
  assert.equal(clientNavigationActive("advocate", "/my-cases"), false);
});

test("active portal storage is isolated by user id", () => {
  assert.equal(portalStorageKey(17), "lf_active_portal:17");
  assert.notEqual(portalStorageKey(17), portalStorageKey(18));
});

test("direct client-only routes select the client portal", () => {
  for (const path of ["/client-dashboard", "/post-case/new", "/my-cases/123", "/documents"]) {
    assert.equal(portalForRoute(path, true), "client");
  }
});

test("direct advocate routes select advocate only when the account has a profile", () => {
  for (const path of ["/lawyer-dashboard/cases", "/advocate-dashboard", "/advocate/cases/12", "/requests"]) {
    assert.equal(portalForRoute(path, true), "advocate");
    assert.equal(portalForRoute(path, false), null);
  }
});

test("shared and public routes do not override the user's selected portal", () => {
  assert.equal(portalForRoute("/matches", true), null);
  assert.equal(portalForRoute("/judgments", true), null);
});
