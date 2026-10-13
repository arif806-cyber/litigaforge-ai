import test from "node:test";
import assert from "node:assert/strict";

import {
  clientNavigationActive,
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
