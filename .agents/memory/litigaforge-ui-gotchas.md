---
name: LitigaForge UI gotchas
description: Non-obvious frontend pitfalls in litigaforge-ui (Tailwind v4, portals, headers) that cost time to rediscover.
---

# Dropdowns/popovers must escape the header's backdrop-filter

The app headers use `backdrop-blur` (e.g. CountryLanding header `sticky z-30 bg-background/85 backdrop-blur`; layout.tsx desktop header `bg-card/80 backdrop-blur-md`). A `backdrop-filter` element creates **both a new stacking context and a containing block** for its positioned descendants.

**Rule:** any dropdown / popover / menu that visually needs to sit *above page content* must be portalled to `document.body` (React `createPortal`), `position: fixed`, anchored to its trigger via `getBoundingClientRect()` (recompute on scroll/resize). If it is rendered inline inside a backdrop-filter header, it gets trapped — it renders **behind or transparently through** page content (filter pills, hero cards, buttons) even with a high `z-index` and an opaque `bg-popover`.

**Why:** the country switcher's mobile bottom-sheet was already portalled "to escape the header's backdrop-filter containing block," but the desktop dropdown was left inline → it appeared transparent / layered under page content. Users reported this repeatedly before it was traced to the stacking-context trap (not a missing theme token — `--popover`/`--card` are defined and opaque).

**How to apply:** when adding/altering header menus, portal to body + fixed + rect-anchor. Make horizontal anchoring direction-aware (RTL flips to left-edge alignment — `document.documentElement.dir === "rtl"`, set by `useLanguage.ts` for Arabic) and clamp within the viewport so it never overflows off-screen.

# Two headers => duplicate testids

`layout.tsx` mounts a mobile header (`md:hidden`) AND a desktop header (`hidden md:flex`); both stay in the DOM (CSS-hidden), so any component rendered in both (e.g. CountrySwitcher) yields **two copies of the same `data-testid`** (e.g. `button-country-switcher`). e2e selectors must target the visible one (by accessible name) or expect 2 matches. Pre-existing and structural.
