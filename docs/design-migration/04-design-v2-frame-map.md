# 04 Design v2: all 68 frames and who builds them

Source: `docs/prototype/png-v2/` (the complete design supplied 2026-11-24, 68 frames; all viewed). It REPLACES the old prototype (`docs/prototype/png/`, 19 frames, no Layers tab). Where the old files and v2 disagree, v2 wins. File names are `s<NNN>-<slug>.png`, NNN = the number in the supplied file name (the number inside the caption differs for some frames; it is not used).
Sizes: 400x860 phone-width panel unless noted: s049, s069 reference sheets (900 wide); s050-s052, s063 desktop map (760x860); s057 320x860; s070, s071, s074, s081-s083, s086, s090 400x1150; s088, s092 400x1250; s099, s100 390x780.

| Frame | Content | Built by |
|---|---|---|
| `s001-explore-period-footer-with-a-time-travel-button.png` | Explore list; footer = Period|Moment toggle, Any, x, histogram, two handles | foundation |
| `s002-explore-filters-period-from-to-use-the-same-date-field.png` | Filters: Type, Certainty, Language chips + "+7" picker, Period From/To with icons; filter button badge; chips row, Clear all | explore |
| `s003-place-details-header-and-body-are-one-card-one-continuous-bl.png` | Place card inside the list: header and body one card, icons, names, layers, notes | explore |
| `s007-edit-a-place-add-another-name-compact-period-row-new-date-fi.png` | Edit place: names with language pills and "+6" picker, Period row, type pills, Began | explore |
| `s019-more-every-section-is-the-same-accordion-card.png` | More: every section is the same accordion card | more |
| `s020-place-type-editor-add-another-name-symbol-list-uploaded-symb.png` | Place type editor: names, symbol grid, uploaded SVG, colour, size, preview | more |
| `s021-more-historical-maps-and-categories-same-accordion.png` | More: Historical maps (overlay row, opacity) and Categories | more |
| `s022-moment-time-travel-same-footer-slot-replaces-period-while-on.png` | Moment footer: play, speed 1x-500x, histogram, undated switch; list "6 places at c. 85 BCE" | foundation |
| `s028-period-of-a-name-tap-edit-same-date-field-done-folds-it-back.png` | Name Period: Edit opens the same date field, Done folds it back | explore |
| `s033-border-new-version-in-time-add-another-name-new-date-field.png` | Border new version: banner, names, type, Began/Ended | borders |
| `s034-route-form-after-drawing.png` | Route form after drawing: places on the way, names, type, usable both ways, Began, Save route / Back to the map / Discard | routes |
| `s037-more-base-map-and-3d-view-same-accordion.png` | Maps & base map: base map thumbs, 3D view (tilt, rotation, buttons, 3D terrain, height), river size | more |
| `s038-more-show-on-the-map-and-relief-options-icons-for-every-opti.png` | Show on the map toggles, Relief toggles, colour ramp, colour strength | more |
| `s039-more-directions-same-accordion.png` | Directions card | more |
| `s040-edit-image-overlay.png` | Edit image overlay: title, opacity, rotate, scale, zoom range | more |
| `s041-more-add-a-language-rename-a-category-add-another-name.png` | Add a language; rename a category | more |
| `s042-symbol-upload-error-state-save-disabled.png` | Symbol upload: choose/paste SVG, error, advanced path box, Save disabled | more |
| `s043-route-river-type-editor-add-another-name.png` | Route / river type editor: line colour, width, opacity, pattern, arrow | more |
| `s044-area-type-editor-add-another-name.png` | Area type editor: colour, fill opacity, outline width, pattern, preview | more |
| `s045-notes-period-footer-is-the-same-component-everywhere.png` | Place notes list: language filter chips, sort, collapse, pagination, footer | explore |
| `s046-note-edit-date-uses-the-new-date-field.png` | Note edit: language pills, date field, title, text | explore |
| `s047-date-format-menu-grouped-by-precision-current-format-ticked.png` | Date format menu grouped by precision, current ticked | foundation |
| `s048-date-formats-every-layout-ce-bce-as-a-toggle.png` | Date formats: every layout, CE|BCE toggle | foundation |
| `s049-period-vs-moment-two-entities-one-footer-slot.png` | Reference sheet: Period vs Moment (text frame) | foundation |
| `s050-closed-sidebar-60px-rail-the-logo-tile-is-the-one-toggle-ope.png` | Closed sidebar: 60px rail, logo tile is the one toggle | foundation |
| `s051-closed-hover-shows-what-a-click-does-dot-on-the-clock-period.png` | Closed: hover tooltip on a tab, dot on the clock = Period filter active | foundation |
| `s052-closed-tooltip-on-the-toggle.png` | Closed: tooltip on the toggle ("Show panel [") | foundation |
| `s055-language-filter-top-languages-as-chips-the-rest-in-a-separat.png` | Language filter: top languages as chips, the rest in a picker (checkbox list with counts, Clear, Done) | explore |
| `s056-name-language-pills-stay-on-one-line-5-opens-a-picker.png` | Name language: pills stay on one line, "+5" opens a radio picker | foundation |
| `s057-narrow-sidebar-320px-selected-language-replaces-the-last-pil.png` | Narrow sidebar 320px: selected language replaces the last pill, row never wraps | foundation |
| `s058-few-languages-everything-fits-no-n-button.png` | Few languages: everything fits, no "+N" button | foundation |
| `s060-explore-states-no-results-loading-load-error.png` | Explore states: no results (Reset filters), loading skeleton, load error | explore |
| `s061-search-places-of-the-atlas-then-other-places-openstreetmap.png` | Search: atlas results, then "Other places (OpenStreetMap)" rows | explore |
| `s062-other-places-searching-nothing-found-service-down.png` | Other places: searching, nothing found, service down | explore |
| `s063-map-menu-of-a-clicked-point-with-and-without-edit-rights.png` | Map: menu of a clicked point, with and without edit rights | explore |
| `s064-new-place-1-3-position-names-type-dates.png` | New place 1/3: pin hint, names, type, Began/Ended | explore |
| `s065-new-edit-place-2-3-certainty-radius-sources-position-layers.png` | New/edit place 2/3: certainty, radius, sources, new source, position, layers | explore |
| `s066-place-form-3-3-mountain-type-and-errors.png` | Place form 3/3: mountain type, height, validation errors, save failed | explore |
| `s067-new-note-place-layer-or-border-layers-date-errors.png` | New note: language, layers it belongs to, date, title error, text | explore |
| `s068-confirm-delete-border-route-layer-type.png` | Confirm: delete (border, route, layer, type) modal | foundation |
| `s069-confirm-the-other-four-remove-type-delete-layer-import-disca.png` | Confirm: remove type, delete layer, import shapes, discard route (4 variants) | foundation |
| `s070-place-card-without-edit-rights-not-logged-in.png` | Place card without edit rights (not logged in) | explore |
| `s071-place-card-editor-layers-routes-scoped-notes.png` | Place card (editor): layers, routes, scoped notes, Add note | explore |
| `s073-borders-list-hidden-border-add-border-pinned.png` | Borders: intro, search, type chips, list with eye, hidden border, Add border pinned | borders |
| `s074-border-card-actions-are-icons-on-top-of-the-card.png` | Border card: icons on top, versions in time, look, layers, notes | borders |
| `s075-add-a-border-search-results-with-draw-or-import.png` | Add a border: search OSM, results with +, draw or import | borders |
| `s076-drawing-a-border-area-also-editing-the-shape-new-version.png` | Drawing a border area: hints, error, Undo, Finish; editing the shape / new version | borders |
| `s077-drawing-a-line-follow-a-river.png` | Drawing a line: follow a river (checkbox, name, Find) | rivers |
| `s078-rivers-select-rivers-rectangle-area-name-selection-list.png` | Rivers: select by rectangle / by area name; selection list | rivers |
| `s079-rivers-find-and-add.png` | Rivers: find and add (OSM), or draw / upload | rivers |
| `s080-routes-list-and-path-finder-add-route-pinned.png` | Routes: list, path finder card, Add route pinned | routes |
| `s081-path-finder-ways-found-shortest-first.png` | Path finder: ways found, shortest first | routes |
| `s082-path-finder-no-path-and-input-errors.png` | Path finder: no path and input errors | routes |
| `s083-route-card-actions-are-icons-on-top-of-the-card.png` | Route card: icons on top, versions, places on the way, joins, look, layers | routes |
| `s084-drawing-a-route-start-next-point-errors.png` | Drawing a route: live hint, errors (needs 2 points, no road), Undo, Finish | routes |
| `s085-layers-three-state-buttons-colour-edge-add-layer-pinned.png` | Layers: list, three-state buttons (show / only / hide), colour edge, Add layer pinned; inline delete bar | layers |
| `s086-layer-card-icons-on-top-places-with-borders-and-routes-add-n.png` | Layer card: icons, places with x, borders and routes, notes, Add note, login hint | layers |
| `s087-layer-choose-places-and-borders.png` | Layer: choose places and borders (+3 / -1 chips, checkbox list) | layers |
| `s088-layer-form-add-edit.png` | Layer form: names, descriptions per language, category, dates, colour, error | layers |
| `s090-relief-edit-colours-contour-lines-height-profile.png` | Relief: edit colours (ramp rows), contour lines + step, height profile chart | more |
| `s091-historical-maps-empty-uploading-error.png` | Historical maps: empty, uploading (progress), error (20 MB) | more |
| `s092-directions-every-state.png` | Directions: every state (empty, start set, coordinates, routing, result, no route) | more |
| `s093-languages-types-categories-no-admin-rights-and-empty-lists.png` | Languages, Types, Categories without admin rights and with empty lists | more |
| `s094-types-full-list-with-usage-and-the-four-add-buttons.png` | Types: full list with usage counts and four Add buttons | more |
| `s097-panel-and-dock-drag-the-edge-drag-the-grip-larger-panel.png` | Panel and dock: drag the edge, drag the grip, tooltips | foundation |
| `s098-larger-panel-the-card-takes-the-whole-panel.png` | Larger panel: the card takes the whole panel | explore |
| `s099-phone-700px-panel-is-a-bottom-sheet-grab-handle-on-top.png` | Phone (<=700px): panel is a bottom sheet, grab handle on top | foundation |
| `s100-phone-panel-hidden-only-the-handle-tab-and-the-time-button-s.png` | Phone: panel hidden, only the handle tab and the Time button stay | foundation |

## Gaps and contradictions inside the design (owner to decide; default in brackets)
1. Border types: s073 list shows Kingdom / Province / **Territory**; s033 form shows Kingdom / Province / **Country** [use the dictionary; the frames are only examples].
2. Delete a layer: s085/s086 show an inline red bar ("Delete this layer? ... Delete / Cancel"); s068/s069 show a modal [modal for every delete, one component].
3. s049 text says "Time-travel icon in the Period footer", but the footer frames (s001, s022) use a Period | Moment segmented toggle [the toggle].
4. No frame for: hover popup and point card of a place on the map, layer list inside the place form beyond s065, border/route import errors, GeoJSON import result, Types edit for a river type beyond s043, desktop-wide panel, loading states of Borders/Routes/Rivers/Layers/More [extend the same states as s060].
5. Fonts: all titles are sans-serif (the old prototype used a serif for titles). The face looks like Inter; no font file or name was supplied [system-ui stack until the owner names a font].
6. Frame numbers skip (s004-s006, s008-s018, s023-s027, ...): not missing frames, only the numbering of the source.
