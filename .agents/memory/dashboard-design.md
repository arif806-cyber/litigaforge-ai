---
name: Dashboard design system
description: Visual design decisions for client & lawyer dashboards — stat cards, case cards, match cards, banners
---

## Design System (LitigaForge Pro — Pulse+Aurora best-of)

### Stat Cards
- `overflow-hidden relative hover:shadow-md transition-shadow`
- Colored 3px top accent strip: `absolute top-0 left-0 right-0 h-[3px] rounded-t-xl` with `background: accentColor`
- Icon: `w-9 h-9 rounded-xl` square (not round)
- Value: `text-3xl font-bold leading-none`
- Label: `text-[11px] font-medium text-muted-foreground mt-1.5` (below value, not above)

### Case Cards (client & lawyer)
- `bg-white rounded-xl p-4 hover:shadow-md transition-all border border-border`
- Status left border via inline style: `borderLeftColor: active="#10b981" | pending="#f59e0b" | closed="#94a3b8"`, `borderLeftWidth: "3px"`

### Match Proposal Cards (client)
- Same left border treatment, colored by match score: `>=80 → #059669`, `>=60 → #D97706`, else `#EF4444`
- Score progress bar: `flex-1 h-1.5 rounded-full bg-slate-100` with colored fill div

### Greeting Header
- `rounded-2xl px-5 py-4 border border-amber-100 bg-gradient-to-r from-white to-amber-50/60` (client)
- `rounded-2xl px-5 py-4 border border-blue-100 bg-gradient-to-r from-white to-blue-50/60` (lawyer)

### Upgrade Banner
- `rounded-2xl p-4 text-white bg-gradient-to-br from-[#1a2744] to-[#0f1a35] border border-white/10`
- CTA: `bg-amber-400 hover:bg-amber-300 text-[#1a2744]`

### NALSA Widget
- `<a href="tel:15100">` clickable, `bg-emerald-50 border border-emerald-200 hover:bg-emerald-100`
- Icon container: `w-8 h-8 rounded-lg bg-emerald-100`

**Why:** User wanted best-of Aurora (dark accents, glows) and Pulse (bold numbers, color-coded) applied to light-mode dashboards. The 3px border approach adds color coding without breaking the white card aesthetic.
