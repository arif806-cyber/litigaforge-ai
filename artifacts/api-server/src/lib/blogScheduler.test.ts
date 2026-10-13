import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchRollingArticleQuota } from "./blogQuota.ts";

test("blog scheduler computes the recent article count from GitHub commits", async () => {
  let requestedUrl = "";
  const fetcher: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-token");
    return new Response(JSON.stringify([{ sha: "a" }, { sha: "b" }]), { status: 200 });
  };
  const now = Date.parse("2026-10-13T12:00:00Z");
  assert.equal(await fetchRollingArticleQuota("test-token", now, fetcher), 2);
  assert.match(requestedUrl, /path=src\/content\/blog/);
  assert.match(requestedUrl, /since=2026-10-06T12%3A00%3A00\.000Z/);
});

test("blog scheduler fails closed when GitHub cannot supply the quota", async () => {
  const fetcher: typeof fetch = async () => new Response("unauthorized", { status: 401 });
  assert.equal(await fetchRollingArticleQuota("bad-token", Date.now(), fetcher), null);
});
