---
name: mockup-sandbox canvas previews
description: Timing + SVG gotchas when verifying mockup-sandbox component previews via app_preview screenshots and embedding them as canvas iframes.
---

# mockup-sandbox canvas previews

## Screenshot timing vs Framer Motion intros
`app_preview` screenshots of a mockup-sandbox `/preview/...` route capture roughly
**~0.6s after mount**, and every screenshot is a fresh navigation (the intro
animation replays from t=0). So any Framer Motion intro whose stagger/delay finishes
later than ~0.6s gets caught **mid-animation** — nodes/cards look missing or faded,
which reads as a layout bug but is just timing.

**How to apply:** for canvas-mockup intro reveals, keep the whole sequence settling
by ~0.55–0.6s (small stagger like `0.08 + i*0.04`, duration ~0.38) so static
verification screenshots show the finished state. The live iframe still animates
nicely on load. Don't chase a "missing element" by reworking layout before checking
whether it's just the animation not yet settled.

## Reusable SVG atoms need unique ids
A design-system atom that defines an SVG `<linearGradient>`/filter and is rendered
multiple times on one page (e.g. ScoreRing in a lookbook) must give the def a
**`useId()`-based unique id** and reference it via `url(#${id})`. Hardcoded ids
produce duplicate DOM ids; browsers resolve `url(#x)` to the first match, so it
"looks fine" until variants diverge — fragile. Caught by architect review.

**Why:** these are presentational mockups today but graduate into litigaforge-ui
later, where multiple instances on one screen is the norm.
