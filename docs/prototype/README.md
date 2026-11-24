# Design reference

**Current (v2, complete, 2026-11-24):** `png-v2/` = 68 frames, mapped to screens and workers in `docs/design-migration/04-design-v2-frame-map.md`. These PNGs are the only visual source of truth. There is no HTML/CSS for v2.

**Old (v1, incomplete, 2026-11-23, superseded):** `sidebar.html`, `sidebar.css`, `sidebar.js`, `render.py` = the first prototype (19 frames, no Layers tab, serif titles). Kept only because older commits and docs mention them. Do not copy styles from it; where it disagrees with `png-v2/`, `png-v2/` wins. Its 19 PNGs were removed (git history has them).
