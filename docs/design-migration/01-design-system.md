# 01 Design system (v2)

Source of truth: the 68 frames in `docs/prototype/png-v2/` (all viewed), list in `04-design-v2-frame-map.md`. The look is: warm paper background, blue primary, red for danger, sans-serif everywhere (titles too), rounded cards, one blue left edge on an open card.

## The rule (owner decision, 2026-11-24)
1. **Markup is static HTML** in `app/index.html`, written with **daisyUI components and utility-free class names** (daisyUI v5 classes only; no Tailwind build, no new utility layer).
2. **JS does not build HTML.** JS fetches data, clones `<template>` elements that live in `index.html`, fills them with `textContent`, `value`, `dataset` and attributes, toggles `hidden` and classes, and handles events. No `innerHTML = '<div ...' + esc(x)` strings in new or rewritten code. (Side effect: no `esc()` and no injection class of bugs.)
3. **Custom CSS only where daisyUI has no class** (histogram bars, timeline line, rail, resize grip, drawing hints). Plain CSS in the owner's own file; no class name that daisyUI already owns (`stack`, `label`, `tabs`, `badge`, `sm`, `list`, `toast`, `card`, `menu`, `tab`, `modal`, `table`, `status`, `stat`, `filter`, `dock`, `mask`, `join`, `kbd`, `link`, `toggle`, `range`, `select`, `input`, `radio`, `checkbox`, `btn`, `alert`, `skeleton`, `loading`, `progress`, `tooltip`, `indicator`, `collapse`, `dropdown`, `fieldset`, `validator`, `timeline`, `steps`, `swap`, `hero`, `divider`, `drawer`, `fab`, `footer`, `navbar`, `pagination`, `rating`, `breadcrumbs`, `carousel`, `chat`, `countdown`, `diff`, `dock`). Use daisyUI's, or your own prefix.
4. **No framework.** Solid and friends were considered: they need a build step and a rewrite of every sidebar file; not chosen. Plain HTML + `<template>` + small scripts keeps one page for forum and dev (`docs/03-architecture.md`).
5. One owner per region of `index.html` (see 02): workers edit only their marked regions.
Why this changed: the first foundation pass (v1) kept the inherited pattern of building markup in JS strings and wrote its own CSS for almost everything; that is why it barely used daisyUI. v2 replaces it (see 02, 03).

## Theme
daisyUI theme `paper-and-pencil` (`base.css`, built in F1), to be completed so daisyUI components pick the colours without overrides:
| daisyUI variable | Value from the frames |
|---|---|
| `--color-base-100` (page, panel) | `#f4f0d9` |
| `--color-base-200` (card surface, open card) | `#f8f5e4` |
| `--color-base-300` (inputs, sunk, segmented track) | `#edeada` |
| `--color-primary` / content | `#115098` / white |
| `--color-neutral` (secondary buttons, grey chips) | `#e9e9e9` with `#115098` text; dark tooltips `#333c43` |
| `--color-error` | `#bc2a4d` |
| `--color-base-content` | `#333c43`; muted text `#7b858b` |
| radii | `--radius-box` 12px (cards), `--radius-field` 8px (inputs, buttons), `--radius-selector` full (pills, toggles) |
| font | system-ui stack until the owner names a face (frames look like Inter) |
Colour pickers: six swatches (red, blue, green, gold, purple, slate) + a custom colour (rainbow); the hex values are the existing `UI_SWATCHES` in `components.js`, not measured from the frames.
The colour values in this table come from the v1 prototype CSS (measured); the v2 frames look the same but were not measured pixel by pixel.

## Element -> daisyUI mapping (use these, do not invent classes)
| Frame element | daisyUI |
|---|---|
| Panel header + brand | `navbar`-style flex row; logo tile `btn btn-primary btn-square` (it is the open/close toggle, s050) |
| Tab bar (icon over label) | `tabs tabs-border` + `tab flex-col` |
| Accordion card (More, Filters, path finder, Select rivers) | `collapse collapse-arrow` on `bg-base-200 border border-base-300 rounded-box`; open = left edge `border-l-4 border-primary`-equivalent in own CSS |
| Primary / secondary / destructive buttons, sticky bar | `btn btn-primary`, `btn btn-neutral btn-soft`, `btn btn-error` |
| Icon buttons (edit, fit, sort, delete) | `btn btn-ghost btn-sm btn-square` (delete: `text-error`) |
| "+ Add ..." dashed pill | `btn btn-dash btn-primary btn-sm rounded-full` |
| Segmented (Unknown/Exact/Approx/Range, CE/BCE, Period/Moment, speed, Flat/Tilt) | `join` + `input type=radio class="btn join-item"` (`aria-label`) |
| Chips (types, certainty, languages, filter chips) | `btn btn-sm rounded-full` toggled with `btn-primary`; removable: `badge badge-soft badge-primary` + x; counts: `badge badge-xs` |
| Language pills + "+N" picker | pills as chips; picker `dropdown` + `menu` with radios (names) or checkboxes (filter, with counts, Clear/Done) |
| Text inputs, selects, textareas | `input`, `select`, `textarea`; icon inside: `<label class="input"><svg/><input/></label>` |
| Field group + caption | `fieldset` + `fieldset-legend` (replaces the old `.label`) |
| Inline errors (red border + message) | `validator` + `validator-hint`, or `input-error` + `<p class="text-error">` |
| Banners (info, error) | `alert alert-info alert-soft`, `alert alert-error alert-soft` |
| Toggles, sliders, checkboxes | `toggle toggle-primary`, `range range-primary range-xs`, `checkbox checkbox-primary checkbox-sm` |
| Lists (places, borders, routes, layers, other places) | `list` + `list-row` |
| Notes timeline | `timeline timeline-vertical timeline-compact` (or own CSS if it fights the frame) |
| Tooltips (rail, drag grips, toggle) | `tooltip` + `data-tip` |
| Confirm dialogs (6 variants) | `modal` on `<dialog>`; `modal-box`; buttons `btn btn-error` / `btn btn-primary` |
| Toast | `toast toast-center` + `alert` |
| Loading / empty | `skeleton`, `loading loading-spinner`; empty block = centred icon + text |
| Count badge on filter button, dot on clock | `indicator` + `indicator-item badge badge-error badge-xs` / `status status-primary` |
| Distance / time readout (Directions) | `stats` (small) |
| Upload progress | `progress progress-primary` |
| Key hints (Click, Drag, Enter) | `kbd` or bold link-coloured word as in the frames |
Own CSS (no daisyUI class): histogram bars + range handles (Period/Moment), notes timeline line if needed, 60px rail, resize edge and grip, phone sheet handle, drawing-hint block, colour swatches, symbol grid, pattern tiles.

## Layout (frames s050-s052, s097-s100)
Open panel (default 380px, resizable by dragging the edge, double click resets), closed **60px rail** (logo tile = the one toggle; tab icons with tooltip "<Tab> opens the panel on this tab"; clock icon at the bottom with a dot while a Period filter is on), larger panel (card takes the whole panel, s098), dock grip, phone <=700px bottom sheet with grab handle (s099) and, when hidden, only the handle tab and the Time button (s100), 320px narrow rule for language pills (s057).

## States the frames cover (one pattern each, reused everywhere)
No results + Reset filters; loading skeleton; load error alert; service down alert; nothing found; empty list "(empty list)"; read-only block with lock icon and "Log in"; disabled Save (grey); inline field errors; "Save failed: HTTP 500"; upload progress and error; confirm modals.
Missing in the frames (extend in the same style, do not ask): hover and focus rings (daisyUI defaults), loading states of Borders/Routes/Rivers/Layers/More, desktop-wide panel.
