import assert from "node:assert/strict";
import test from "node:test";
import {
  readWorkspaceGuideProgress,
  workspaceGuideStorageKey,
  writeWorkspaceGuideProgress,
} from "../src/components/workspace/workspaceOnboardingProgress.ts";

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("workspace guide progress persists independently for each user", () => {
  const storage = memoryStorage();
  writeWorkspaceGuideProgress(storage, 17, ["matter", "canvas"]);
  writeWorkspaceGuideProgress(storage, 24, ["search"]);

  assert.deepEqual(readWorkspaceGuideProgress(storage, 17, ["matter", "canvas", "search"]), ["matter", "canvas"]);
  assert.deepEqual(readWorkspaceGuideProgress(storage, 24, ["matter", "canvas", "search"]), ["search"]);
  assert.notEqual(workspaceGuideStorageKey(17), workspaceGuideStorageKey(24));
});

test("guide progress ignores unknown lessons and safely handles corrupt storage", () => {
  const storage = memoryStorage();
  storage.setItem(workspaceGuideStorageKey(17), JSON.stringify(["matter", "removed-lesson", 4]));
  assert.deepEqual(readWorkspaceGuideProgress(storage, 17, ["matter", "canvas"]), ["matter"]);
  storage.setItem(workspaceGuideStorageKey(17), "{broken");
  assert.deepEqual(readWorkspaceGuideProgress(storage, 17, ["matter"]), []);
});
