import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiRequestError } from "../src/lib/api.ts";
import { loadAuthorityTrackerData } from "../src/lib/authority-tracker.ts";

const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json" },
});

test("authority panel loading uses parsed JSON from all four endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    const path = String(url).replace("/litigaforge", "");
    requested.push(path);
    const responses = {
      "/authorities/saved-searches": { searches: [{ id: 1, query: "injunction" }] },
      "/authorities/citation-watches": { watches: [{ id: 2, citation: "AIR 2020 SC 1" }] },
      "/authorities/alerts": { alerts: [{ id: 3, case_name: "A v B", citation: "", source_url: "/", created_at: "today" }] },
      "/authorities": { authorities: [{ id: 1 }, { id: 2 }] },
    };
    return jsonResponse(responses[path]);
  };

  try {
    const data = await loadAuthorityTrackerData();
    assert.deepEqual(data.searches, [{ id: 1, query: "injunction" }]);
    assert.deepEqual(data.watches, [{ id: 2, citation: "AIR 2020 SC 1" }]);
    assert.equal(data.alerts[0].case_name, "A v B");
    assert.equal(data.referenceCount, 2);
    assert.equal(requested.length, 4);
    assert.equal(data.error, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("authority panel preserves successful data and reports API errors for failed endpoints", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("saved-searches")
    ? jsonResponse({ detail: "Searches unavailable" }, 503)
    : jsonResponse({});

  try {
    const data = await loadAuthorityTrackerData();
    assert.deepEqual(data.searches, []);
    assert.equal(data.error, "Searches unavailable");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("authority panel rethrows ApiRequestError when every endpoint fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ detail: "Not authorized" }, 403);
  try {
    await assert.rejects(loadAuthorityTrackerData(), (error) =>
      error instanceof ApiRequestError && error.status === 403);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
