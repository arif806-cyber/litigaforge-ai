# Mobile responsive and theme check

Checked 2026-10-13 at viewport widths **360px** and **390px**, in both **light** and **dark** themes.

Routes checked:

- `/client-dashboard` — case-journey progress rail, mobile role badge, bottom-tab active state, and center action button.
- `/cnr-tracker` — add form, tracked-case card, expanded current status and event log, plus the “More” tab state.
- `/free-documents` — category-chip horizontal scrolling and hidden scrollbar.
- `/login` — public sign-in layout and theme colors.

The page document did not overflow horizontally at any checked width. The free-document category row intentionally scrolls horizontally inside its own container. Browser checks used synthetic account/API responses intercepted by the test browser; no real account or case data was changed.
