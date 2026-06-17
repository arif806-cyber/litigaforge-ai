---
name: Iframe aspect-ratio in Vite+Tailwind
description: Why inline style aspectRatio fails for iframe wrappers and how to fix it
---

## The rule

Never use `style={{ aspectRatio: "16/9" }}` on an iframe wrapper div in this Vite+Tailwind v4 setup. Use Tailwind's `aspect-video` class instead.

**Why:** The inline `style` prop with `aspectRatio` produces a zero-height wrapper in Vite+React 19 builds — the iframe renders but the section appears invisible (0px height). `aspect-video` (`aspect-ratio: 16 / 9`) as a Tailwind utility class is purged-safe and resolves correctly.

**How to apply:** Any time you embed a 16:9 iframe on a landing page or similar:

```tsx
<div className="relative w-full aspect-video rounded-2xl overflow-hidden ...">
  <iframe className="absolute inset-0 w-full h-full border-0" ... />
</div>
```

## Related: `loading="lazy"` on iframes

Do NOT use `loading="lazy"` on iframes that need to be visible at page load (or in screenshots). Lazy loading suppresses the initial render — the iframe wrapper shows the `bg-*` background color but no content loads, and screenshot tools capture a blank dark box. Only use `loading="lazy"` for below-the-fold iframes where the user scrolls to reach them AND where an initial blank state is acceptable.
