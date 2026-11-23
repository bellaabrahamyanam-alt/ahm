# 01 Design system

Sources: prototype `docs/prototype/sidebar.css` (the `:root` block and every class), the 19 frames, and the app's `app/css/base.css`. The prototype is a 400 px mock; desktop width and the map overlay are not designed.

## 1. Rule already in the code that governs the palette

`base.css` says its palette block has the SAME NAMES AND VALUES as the forum style (`paper-and-pencil/theme/colours.css`) so the sidebar always matches the forum, and may be deleted if the page is rendered inside the style. Every prototype colour below equals an existing value except the few marked NEW. So the migration can keep forum parity for colour; fonts and radii are the real changes.

## 2. Tokens: prototype → existing → decision

| Role | Prototype | Existing (`base.css`) | Same? | Plan |
|---|---|---|---|---|
| Page / panel bg | `--bg #f4f0d9` | `--base-bg` | yes | keep |
| Card surface | `--surface #f8f5e4` | `--bg2-bg-color`, `--panel-container-panel-bg-color` | yes | keep |
| Sunk (inputs, chips bg) | `--sunk #edeada`, `--inp #edeada` | `--bg1-bg-color` | yes | keep |
| Row hover | `--hover #f6f8e4` | `--li-row-hover` | yes | keep |
| Ink (titles, values) | `--ink #333c43` | `--content-color` | yes | keep |
| Ink 2 (body) | `--ink2 #5c6a72` | `--html-body-color` | yes | keep |
| Accent blue | `--blue #115098` | `--a` / `--base-href-color` | yes | keep |
| Accent hover | `--blue-h #3a94c5` | `--a-hover` | yes | keep |
| Danger | `--danger #bc2a4d` | `--error-color` | yes | keep |
| Select bg / border | `--selbg #e9e9e9`, `--selbd #dadada` | `--select-bg #e9e9e9`, `--select-border-color #edeada` | bg yes, border differs | NEW token for the border |
| Muted text | `--muted #7b858b` | `--muted-color #666666` | no | NEW token `--muted-ui`, old kept for forum parts |
| Hairline | `--line #e3dec4` | `--li-row-border-bottom-color #edeada` | no | NEW `--line-color` |
| Input border | `--inp-bd #d6d2ba` | `--inputbox-border #b4bac0` (inputs are white `#fff`) | no | decision D5 |
| Shadow | `0 2px 8px rgba(0,0,0,.18)` | `--dropdown-shadow 1px 3px 5px …` | no | added as `--shadow-card` (F1) |
| Card radius | `--r-card 12px` | `--radius-m 7px` | no | added (F1) |
| Control radius | `--r-ctl 8px` | `--radius-s 4px` | no | added (F1) |
| Pill radius | 13 px (`.pl`) | `--radius-pill 14px` | ~ | keep 14 |
| Transition | `--t 150ms ease-out` | none | | added `--transition` (F1) |
| UI font | `system-ui, "Segoe UI", "DM Sans", Roboto, Arial` | `--font` Verdana | no | decision D5; `--font-ui` added (F1) |
| Serif (titles, dates, brand) | `Georgia, Gelasio, "Times New Roman"` | none | no | `--font-serif` added (F1) |
| Brand | logo 32 px `--blue` square, r 8; h1 serif 600 17/1.15; sub 11 px upper .06em `--muted` | none | | built in F2 |
| Warning | not in prototype | | | `--warning-color #b7791f` added (F1) for the daisyUI theme |

Prototype type scale: base 13/1.45 `--ui`; section label `.sec` 600 11 px, upper, .08em, `--muted`; hint 11.5/1.5 `--muted`; error line 12 px `--danger`; tab 500 11 px; pill 500 12 px (big 12.5); input 13 px; card title serif 15–17 px; dates in serif 15 px; big moment date serif ~28 px.

Prototype spacing (no scale variables, used inline): 4, 6, 8, 10, 12, 14, 16, 20, 22. Layout: scroll area padding 14/16/0; footer slots `.foot` fixed under the scroll; frame 400 × 860 (desktop sidebar width is not designed).

Breakpoints: none in the prototype. App: `@media (max-width:700px)` (bottom sheet) twice in `sidebar.css`, one `prefers-reduced-motion`. z-index: prototype `.menu` 6 only.

## 3. Components visible in the frames (visual spec)

| Component | Look | Frames |
|---|---|---|
| Header | logo + title/subtitle + `<` collapse icon button (32 px) | all |
| Tabs | icon over label, active = blue text + 2 px bar under (18 % inset) | all |
| Icon button `.ib` | 32 px (sm 28), transparent, blue, hover sunk; `.on` sunk; `.danger` red; filter button with red count badge | s2, s3 |
| Search row | search input (38 px, icon inside) + square filter button (blue and white when filters active) | s1, s2 |
| Chips with ×, "Clear all" | pale-blue pill with ×, blue link | s2 |
| Pills (filter, language, type) | 26 px grey pill, active = blue fill white text; type pill (30 px) has the type symbol; counts as small superscript | s2, s7, s33, s34 |
| Segmented control | sunk track, active white segment with shadow, blue text | s46, s48, s49 |
| Date field | segmented mode, format chip (calendar icon + label + caret) with menu, serif preview right, inputs, CE | BCE toggle (blue active) | s47, s48 |
| Card / accordion `.acc` | surface, border `--line`, r 12, open = 3 px blue left edge; head: symbol tile, serif title (blue when open), date line, note count, caret | s3, s19 |
| Fold card (More) | like accordion; head has 28 px icon tile + title + one-line summary + caret | s19, s21 |
| Names block `.ncard` | pill row of languages, text input, ✕, optional ↑ reorder, "Period: unknown / dates" + Set / Edit / Done; dashed "Add another name" | s7, s28, s33, s41, s43, s44 |
| Dashed add button | dashed blue border, + icon | s3, s7, s19, s21 |
| Notes timeline | vertical rule, blue ring dot, serif title, language tag, clock + date, text clamped with Show more / less, edit and delete icons; language count chips | s3, s45 |
| Form footer `.foot.form` | sticky: primary Save + Cancel (two buttons) | s7, s20, s28, s33, s34, s43, s44, s46, s47 |
| Route footer | primary "Save route" full width + "Back to the map" + "Discard" | s34 |
| Switch | blue pill toggle with label and hint | s22, s34, s43 |
| Slider | blue fill, white knob, value right ("2.5 px", "85 %") | s20, s21, s43, s44 |
| Colour swatches | round swatches + rainbow "custom" | s20, s43, s44 |
| Symbol grid / pattern tiles | 5-column tiles, selected = blue border; uploaded SVG tiles badged "SVG"; dashed upload tile; pattern tiles solid / dashed / dotted / dash-dot | s20, s43, s44 |
| Preview card | inset card with the symbol or shape and the on-map label | s20, s44 |
| Language table | code (mono) / name / native (serif) / edit pencil | s19 |
| Period footer | clock + "Period **800 – 500 BCE**", time-travel icon, ✕; histogram with two-handle range, ticks 1200 BCE · 0 · 1500 CE | s1, s2, s3, s45 |
| Moment footer | big blue play button, "MOMENT" + serif date, ✕; speed segments 1× 10× 50× 100× 500×; one handle; "Show undated places" switch | s22, s49 |
| Place row | 56 px symbol tile, serif name, date line, note icon + count | s1, s22 |
| Error line / bad input | red text; input red border + 3 px 12 % ring | (CSS only, no frame shows it) |

## 4. daisyUI

- Loaded from `https://cdn.jsdelivr.net/npm/daisyui@5.8.2/daisyui.css` (decision D1 = CDN, built in F1) with the theme `paper-and-pencil` at the end of `base.css` mapping `--color-base-*`, `--color-primary…error`, `--radius-*` to the tokens above.
- Role: component classes for new markup only (`btn`, `tabs`, `toggle`, `range`, `input`, `select`, `badge`, `collapse`, `menu`, `table`, …). The prototype's own look (accordion edge, serif titles, segmented controls, timeline) is custom CSS on tokens; daisyUI does not provide it.
- **Collision risk (to verify before any screen uses daisyUI classes).** The file is layered (`@layer base, utilities`, checked in the file head), so our unlayered CSS wins, but daisyUI rules we do not override still apply. Existing app classes that share a daisyUI component name: `.tabs`, `.tab` (verified in the file head: daisyUI defines both), and by name only, not verified (only the first 100 000 of 1 182 278 characters of the file were read): `.label`, `.badge`, `.stack`, `.btn`. Options: (a) rename our legacy classes when a screen is rebuilt; (b) a self-built daisyUI with a prefix (needs npm, not possible in this sandbox); (c) skip daisyUI classes and use only its theme variables. Needs the owner's decision (D1b in 03).
- Never verified in a browser: the CDN is blocked in this sandbox, so no screen has been seen with daisyUI loaded.

## 5. Map-side visual language (also needs the tokens)

`map.css` (173 lines) styles the popup (`.maplibregl-popup-content`, `.ahm-tip`, `.ahm-menu*`), overlay handles `.ovh`, `.ti`, `#base-credit`, and the relief controls of More. Overlay editor, hover tip and point menu are drawn by `map.js` / `overlays.js` with some inline styles. Not covered by the prototype: all of them.

## 6. Open design questions (none answered by the prototype)

1. Forum parity (D5): prototype uses `system-ui` + Georgia, beige sunk inputs with a tan border, 8/12 px radii; the app follows the forum (Verdana, white inputs, 4/7 px). Which wins?
2. Desktop: sidebar width (current `ahm-side-w`, resizable) vs the 400 px frame; frame height 860 px has a fixed footer slot.
3. Dark mode: none in the prototype or the app.
4. Empty, loading, error and read-only states: no frame shows any.
