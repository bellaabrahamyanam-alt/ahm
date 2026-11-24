# 01 Design system

Source: the 19 frames in `docs/prototype/png/` (all viewed) + `docs/prototype/sidebar.css` (165 lines, 6 custom properties). Rule: the prototype decides appearance, the app decides behaviour. daisyUI 5.8.2 from CDN, themed to these tokens (F1, built).

## Tokens (prototype `:root` vs app `base.css`)
| Token | Value | Status |
|---|---|---|
| page bg | `#f4f0d9` | in `base.css` (`--base-bg`) |
| card surface | `#f8f5e4` | in `base.css` |
| sunk / input bg | `#edeada` | in `base.css` |
| line | `#e3dec4` | prototype only; app has `--li-row-border-bottom-color #edeada` |
| ink / ink2 / muted | `#333c43` / `#5c6a72` / `#7b858b` | first two in app; muted app = `#666666` |
| blue / blue-hover | `#115098` / `#3a94c5` | in app |
| danger | `#bc2a4d` | in app (`--error-color`) |
| input border | `#d6d2ba` | prototype only |
| select bg / border | `#e9e9e9` / `#dadada` | bg in app, border differs |
| card radius / control radius | 12px / 8px | in app (`--r-card`, `--r-ctl`) |
| shadow | `0 2px 8px rgba(0,0,0,.18)` | in app (`--shadow-card`) |
| transition | 150ms ease-out | in app (`--transition`) |
| UI font | system-ui stack | in app (`--font-ui`) |
| serif font | Georgia stack | in app (`--font-serif`) |
Gap: prototype line colour and input border not yet tokens in the app (F1 follow-up, in `base.css` only).
Skill rule: sizes in rem, px only for hairlines. App tokens are px (12px, 8px); convert when touched.

## Type
Serif (`--font-serif`): brand title, place/note titles, section titles ("Edit place"), Moment date, date preview line. Sans (`--font-ui`): everything else. Small-caps labels: uppercase, letter-spaced, `muted`, ~0.75rem (NAMES, TYPE, BEGAN / FOUNDED, PERIOD, NOTES · 2). Hint text: `muted`, ~0.8rem.

## Surfaces and shape
- Compact sidebar, mobile-width frames (~365 px at 1x). Header: blue rounded-square logo + serif title + uppercase subtitle, collapse chevron right.
- Tab bar: icon over label, active = blue with 2px underline, divider line below.
- **Card** = radius 12, 1px `line` border, `surface` bg. **Open card** (place, accordion fold, new-version banner): 3px blue left edge, header and body one continuous card (s3, s19, s21, s33).
- Accordion card (More): icon tile (rounded, sunk), title, grey subtitle, chevron; open = blue edge.
- Sticky action bar at the bottom of every form: primary (filled blue, white text) + secondary (grey `#e9e9e9`, blue text); optional full-width primary above (s34).
- Footer slot (Period/Moment): fixed under the list on every tab, top hairline.

## Components (look)
| Component | Look |
|---|---|
| Search field | sunk bg, magnifier, placeholder muted, filter button right (grey; blue + red count badge when filters active, s2) |
| Chips | pill, surface bg, 1px line; selected = blue fill white text; count as small superscript; type chips carry the symbol (s2). Active-filter chips: light blue bg, ✕, "Clear all" link |
| Language pills | small grey pills, selected = blue fill (hy en la ru tr xur) |
| Segmented control | 4 equal segments (Unknown, Exact, Approx., Range) in a sunk track; selected = raised surface, blue bold text |
| Format chip | grey pill, calendar icon, label, chevron; opens grouped menu (Full date / Month / Year and coarser) with example per row, current ticked (s47) |
| Era toggle | two-segment CE / BCE box beside the input; selected = blue fill |
| Date preview | serif, right-aligned, bold ("c. 16th century CE") |
| Inputs | sunk bg, 1px input border, radius 8; focus state not drawn |
| Add-another | dashed border pill, blue text, plus icon ("Add another name", "Add language", "Add category", "Add image overlay", "Add to a layer") |
| Name card | card with language pills over input, ✕ remove, ↑ reorder; Period row (clock, "Period: unknown" + "Set", or "Period: 176 BCE – 370 CE" + "Edit"; editing = blue outline + "Done") |
| Type pills | grey pills with the type symbol; selected = blue fill |
| Symbol grid | 5 per row tiles; selected = blue outline; "SVG" corner tag on uploaded; dashed upload tile |
| Colour row | round swatches, selected = blue ring, last = rainbow custom |
| Slider | blue track + white round handle, value right ("8.5", "2.5 px", "85%") |
| Pattern tiles | 4 tiles: solid, dashed, dotted, dash-dot; selected = blue outline |
| Switch | blue pill, white knob ("Usable both ways", "Arrow shows the direction", "Show undated places") |
| Note | timeline: blue ring marker on a vertical line; serif title; `en` badge · clock · date; clamp 3 lines + "Show more/less"; edit (blue) + delete (red) icons |
| Histogram | bars of objects per step; selected range solid blue-grey, outside paler; handles = white circle blue ring |
| Footer Period | clock, "Period **Any**", time-travel icon, ✕; histogram + 2 handles; axis 1200 BCE / 0 / 1500 CE |
| Footer Moment | round blue play, "MOMENT" label, serif date, ✕, speed segmented (1× 10× 50× 100× 500×), histogram + 1 handle, undated switch |
| List row | symbol tile, serif name, grey date line, note-count icon+number right |
| Destructive | red trash icon (`danger`); never a filled red button in the frames |

## Missing in the prototype (extend in the same style; list in 03-work-plan)
Hover/focus/disabled states (only disabled Save in s41 is drawn: grey fill, pale text); loading, empty, error, offline, read-only; tooltips; confirm dialogs; toasts; desktop width and the 3 resize/collapse states; dark mode (none, not needed).

## Full design (2026-11-24): what the Layers frames add
Read from `docs/prototype/full/s85` to `s88` (400 px). Other new frames are indexed in `docs/prototype/full/README.md`, not yet extracted here.
- **Info banner** at the top of a tab: cream card, blue "i" icon, one short text with **Only** and **Hide** in bold (s85).
- **Search + category select side by side** in one row (s85); count line "3 layers" under it, count in bold.
- **Layer card** (s85): 3 px left edge in the layer's colour, bold title, small-caps category line, meta line ("3 places · 1 border"), and on the right a **three-state segmented control**: eye = shown (default), dot = Only, eye-off = Hide. The chosen state is a raised white segment with blue icon. A hidden layer's card is dimmed. Only one state per layer; it replaces the old Only / Hide buttons (same behaviour: Only = OR, Hide = NOT IN, the third state clears both).
- **Add layer** is a full-width primary button **pinned** to the bottom of the panel (s85); the same pinned bar holds Save places / Cancel (s87) and Save / Cancel (s88).
- **Open layer card** (s86): opens in place, edge stays; the same three-state control on top; a row of four icons: pencil (edit), checklist (choose places), frame (fit map), red trash (delete, administrators); description; "PLACES · 7" rows with symbol tile, name and a blue ✕ (remove from the layer), "+ 4 more"; "BORDERS AND ROUTES · 2"; "NOTES ABOUT THIS LAYER · 1" as a timeline note (`en` pill, "No date", pencil and red trash); filled "+ Add note"; lock line "Log in to change layers." for visitors.
- **Delete confirm** is a bar pinned at the bottom with a pink background: "Delete this layer? Places and borders stay on the main map.", red **Delete**, **Cancel** link (s86).
- **Choose places** (s87): banner with a blue left edge, two chips "+3" (filled) and "−1", text "no changes yet when both are 0", search, checkbox rows with an uppercase type tag on the right, "BORDERS" group, "Nothing matches." Save places is primary, Cancel grey, both pinned.
- **Layer form** (s88) is a panel in the tab, not a dialog: serif-less bold title "Add layer", language pills with "+5" picker for names and for descriptions, dashed "Add another name" / "Add a description", category select, dates with Unknown / Exact segmented, format chip and CE / BCE toggle, "use a colour" checkbox with 7 round swatches (selected = ring), error line with a warning icon ("Give the layer at least one name."), pinned Save / Cancel.
- Titles of layers and notes in these frames look **sans-serif bold**, not serif; not checked in the other frames.

## Implementation direction (owner, 2026-11-24)
daisyUI components are used widely; markup is static HTML first and JS does not build HTML strings where it can be avoided. Rules and costs: `03-work-plan.md`, section "Direction". This replaces the earlier line "no daisyUI component classes are applied to app controls" (that was the state of the foundation, not a goal).
