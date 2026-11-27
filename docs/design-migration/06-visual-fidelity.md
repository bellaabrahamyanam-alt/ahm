# 06 Visual fidelity: how to build a screen that looks like the frame (mandatory for every worker)

The common failure is a generic, "bootstrap-looking" panel that has the right words but the wrong spacing, sizes, icons, weights and colours. The cure is to work from the frame, one frame at a time, and to LOOK at a side-by-side picture after every change. "Matches by eye" is only allowed after you have looked at the comparison image and listed the differences you found.

## Tools (one file, `tools/ui.js`; no dependency in the app)
```
node tools/ui.js setup                       # once: Chromium + daisyUI + MapLibre into /tmp/ahm-ui (needs registry.npmjs.org)
node tools/ui.js shot /tmp/x.png --panel --tab more      # the panel only, 400px wide, like the frames (desktop layout, clipped)
node tools/ui.js shot /tmp/x.png --w 390 --h 780         # the phone bottom sheet
node tools/ui.js shot /tmp/x.png --panel --tab layers --js "document.querySelector('#some').click()"   # reach a state first
node tools/ui.js compare docs/prototype/png-v2/<frame>.png /tmp/x.png /tmp/cmp.png   # frame | shot | difference
node tools/ui.js crop /tmp/cmp.png /tmp/z.png 0,120,400,200 --zoom 3     # enlarge a region to see details
node tools/ui.js probe <frame.png> 40,300 200,520        # exact colours of pixels
node tools/ui.js runs <frame.png> --col 100              # sizes (px) of bars, rows and gaps down a column; --row Y across
```
- **daisyUI is applied only if the page can load it.** In a sandbox the CDN is blocked; `tools/ui.js shot` serves daisyUI and MapLibre from the local npm copies and STOPS with an error if daisyUI is not really applied (it tests that `.btn` has a style). If you see that error: run `node tools/ui.js setup`, then retry. Never continue with an unstyled page and never replace daisyUI with your own CSS to "fix" it.
- Real-browser tests: `NODE_PATH=/tmp/ahm-ui/shim node tests/js/run.js` (the setup writes the shim).
- To reach a state for a frame, use `--js` (call the app's own functions, click the real buttons); do not add test-only code to the app.
- Use the real viewer tool to open the PNGs (`view`). Open the frame first, read it, then the comparison.

## Measured from the frames (2026-11-27, with `probe`/`runs`; re-measure anything you rely on)
Page `#f4f0d9`; open card / card surface `#f8f5e4`; input and segmented-track fill `#edeada`; hairlines (card border, tab-bar line) `#ebe7ce`; secondary button `#e9e9e9` with blue text; disabled primary `#cacdc5` with pale text; primary `#115098`; text `#333c43`; inputs 33px high; panel width 400px; the frames are at 1x.

## The loop, per frame (do not skip a step; do not batch frames)
1. **Transcribe the frame** in your notes before coding: every visible text (exactly as written), the order of elements top to bottom, counts (how many rows/chips), which icon is where, which texts are bold/muted/blue/red, what is aligned left/right, what is a button vs text. Zoom with `crop` for small details (icons, badges, tags such as POINT or SVG).
2. **Build it** from static HTML with daisyUI classes (01 mapping), using the shared templates; copy the frame's text exactly, including punctuation and capital letters.
3. **Screenshot** with `shot` in the right state, then **compare** with `compare`, then **LOOK** at the result (and crop into areas that look off).
4. **Write the differences list** (at least 5 concrete items if any exist; "none" only after a real look): e.g. "title 2px too small", "gap between chips 4px not 8px", "icon missing left of Save", "row height 48 not 56", "label should be muted grey not black", "count badge missing".
5. **Fix, re-shoot, re-compare.** Repeat 3-5 until the differences are only sub-pixel/anti-aliasing. Maximum 4 rounds per frame; if still different, list what remains in the report; do not hide it.
6. Only then take the next frame.

## Things that make output look wrong (check each on every frame)
- Spacing rhythm (the frames use small, consistent gaps: compare gaps with `runs`), padding inside cards, the 3px blue left edge of an open card.
- Type: sizes and weights (titles bold, captions small and muted uppercase with letter-spacing, hints small grey), no serif anywhere.
- Radii (cards ~12px, controls ~8px, pills fully round), borders (1px hairline, none on buttons).
- Colour use: blue only for primary actions, links, selected states; red only for delete/errors; muted grey for hints; no extra shadows, gradients or default browser blue.
- Icons: the same icon set and size as the frame (tab icons, edit pencil, trash, chevrons, eye, lock); never emoji, never missing.
- Controls: segmented controls look like the frame's tracks; toggles blue when on; sliders blue with a white round handle; chips pills; the dashed "+ Add ..." pills.
- Real data and real states, not lorem ipsum; list and empty variants as in the frames.
- Do not add anything the frame does not show (extra headings, borders, helper text, buttons).

## What the report must contain (otherwise the work is not accepted)
For every frame in your task: the frame file name; the screenshot path; the comparison path; the differences you found in the first comparison and what you fixed; the differences that remain; "built / partly / not". And the list of texts or elements you could not reach (and why).
