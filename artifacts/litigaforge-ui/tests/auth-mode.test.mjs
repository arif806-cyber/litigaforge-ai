import test from "node:test";
import assert from "node:assert/strict";
import { initialAuthMode } from "../src/lib/auth-mode.ts";

test("registration URLs open in signup mode with or without trailing slashes", () => {
  for (const path of ["/register", "/register/", "/in/register", "/in/register/"]) {
    assert.equal(initialAuthMode(path), "signup", path);
  }
});

test("login and unrelated URLs open in sign-in mode", () => {
  for (const path of ["/login", "/login/", "/in/login", "/in/login/", "/"]) {
    assert.equal(initialAuthMode(path), "signin", path);
  }
});
