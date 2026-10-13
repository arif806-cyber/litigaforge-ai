import test from "node:test";
import assert from "node:assert/strict";

import { canShowMcpConnector } from "../src/lib/mcp-connector-visibility.ts";

const advocate = {
  enabled: true,
  role: "advocate",
  hasAdvocateProfile: true,
  isAdmin: false,
  activePortal: "advocate",
};

test("disabled MCP v2 hides the connector card", () => {
  assert.equal(canShowMcpConnector({ ...advocate, enabled: false }), false);
});

test("client-only accounts do not see the connector card", () => {
  assert.equal(canShowMcpConnector({
    enabled: true,
    role: "client",
    hasAdvocateProfile: false,
    isAdmin: false,
    activePortal: "client",
  }), false);
});

test("enabled MCP v2 shows the card to advocates with a profile", () => {
  assert.equal(canShowMcpConnector(advocate), true);
});

test("the client portal hides the connector card even for an advocate account", () => {
  assert.equal(canShowMcpConnector({ ...advocate, activePortal: "client" }), false);
});

test("admins retain connector access without an advocate profile", () => {
  assert.equal(canShowMcpConnector({
    enabled: true,
    role: "client",
    hasAdvocateProfile: false,
    isAdmin: true,
    activePortal: "client",
  }), true);
});
