---
name: i18n language sync
description: How per-country language switching propagates across components in litigaforge-ui
---

# i18n language sync

The translation system (`src/i18n`, `src/hooks/useLanguage.ts`, `src/components/LanguageSwitcher.tsx`)
syncs the active language across every component instance via a custom
`lf-lang-change` window event (plus the `storage` event for cross-tab), NOT a
React context.

**Why:** the same pattern is already used for country switching
(`lf-country-change`). Each `useLanguage` call keeps its own `useState`, so a
plain per-instance hook (as in the original pasted spec) would change the
switcher but NOT re-render the sidebar/dashboard. The event makes all instances
re-read `localStorage` (`lang_<CC>`) and re-render together.

**How to apply:** when adding new translated surfaces, just call
`useLanguage(countryCode?)` and read `t.*`. Active country is derived from the
URL via `getCountryFromPath` when no arg is passed. Default language per country
lives in `COUNTRY_DEFAULT_LANG` (DE→de, everything else→en). Arabic sets
`<html dir="rtl">` globally.

**data-testid constraint:** sidebar nav testids are English-derived. When
translating a label, pass a stable `testId` built from the English label and
only localize the visible `label` — never let the testid be generated from the
translated string (would break selectors).
