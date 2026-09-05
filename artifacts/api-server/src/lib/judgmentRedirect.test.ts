import assert from "node:assert/strict";
import test from "node:test";

import { judgmentRedirectTarget } from "./judgmentRedirect.ts";

const canonical =
  "/judgments/supreme-court-of-india/1973/kesavananda-bharati-v-state-of-kerala-basic-structure";
const stripCountry = (path: string): string =>
  path.replace(/^\/(?:in|us|gb)(?=\/)/, "");

test("canonical judgment URL is not redirected, preventing a loop", async () => {
  const target = await judgmentRedirectTarget(
    canonical,
    stripCountry,
    async () => ({ exact: true, path: canonical }),
  );
  assert.equal(target, null);
});

test("tolerant judgment URL redirects to the canonical URL", async () => {
  const target = await judgmentRedirectTarget(
    "/judgments/wrong-court/1973/kesavananda-bharati",
    stripCountry,
    async () => ({ exact: false, path: canonical }),
  );
  assert.equal(target, canonical);
});

test("country prefix is preserved on a tolerant redirect", async () => {
  const target = await judgmentRedirectTarget(
    "/in/judgments/wrong-court/1973/kesavananda-bharati",
    stripCountry,
    async () => ({ exact: false, path: canonical }),
  );
  assert.equal(target, `/in${canonical}`);
});

test("not-found or ambiguous resolver result does not redirect", async () => {
  const target = await judgmentRedirectTarget(
    "/judgments/supreme-court/1973/kesavananda-bharati",
    stripCountry,
    async () => null,
  );
  assert.equal(target, null);
});