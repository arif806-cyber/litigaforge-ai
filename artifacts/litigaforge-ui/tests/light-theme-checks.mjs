import assert from "node:assert/strict";

export async function seedLegacyDarkPreference(context) {
  await context.addInitScript(() => localStorage.setItem("vite-ui-theme", "dark"));
}

export async function assertAlwaysLight(page, label = "page") {
  const state = await page.evaluate(() => {
    const root = document.documentElement;
    const background = getComputedStyle(root).getPropertyValue("--background").trim();
    const button = document.querySelector(".lf-app-layout button.rounded-xl, .lf-app-layout button.rounded-lg, .lf-app-layout button.rounded-md");
    return {
      theme: root.dataset.theme,
      darkClass: root.classList.contains("dark"),
      storedTheme: localStorage.getItem("vite-ui-theme"),
      colorScheme: root.style.colorScheme,
      backgroundLightness: Number(background.split(/\s+/)[2]?.replace("%", "")),
      radiusToken: getComputedStyle(root).getPropertyValue("--radius").trim(),
      buttonRadius: button ? getComputedStyle(button).borderRadius : "",
      themeColor: document.querySelector('meta[name="theme-color"]')?.content ?? "",
    };
  });
  assert.equal(state.theme, "light", `${label}: root theme should be light`);
  assert.equal(state.darkClass, false, `${label}: root must not have a dark class`);
  assert.equal(state.storedTheme, null, `${label}: stale saved theme should be removed`);
  assert.equal(state.colorScheme, "light", `${label}: browser controls should use light color scheme`);
  assert.ok(state.backgroundLightness > 50, `${label}: background should be light`);
  assert.ok(parseFloat(state.radiusToken) > 0, `${label}: --radius should be positive`);
  assert.ok(parseFloat(state.buttonRadius) > 0, `${label}: a rounded button should have non-zero radius`);
  assert.equal(state.themeColor.toLowerCase(), "#f5f3ed", `${label}: address-bar color should stay light`);
}
