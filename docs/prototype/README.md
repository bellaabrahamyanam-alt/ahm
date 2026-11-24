# Sidebar prototype (owner's design, v3, 2026-11-23)

Static mock: open `sidebar.html` (it draws every frame from `sidebar.js` and `sidebar.css`); `png/sN.png` are the 19 frames at 2x. It is the visual reference for the tasks in `tasks/`; it is not shipped. Frame titles: `grep -o "F('s[0-9]*','[^']*'" sidebar.js`.

| Frame | Shows |
|---|---|
| s1 | Explore list, Period footer with histogram and time-travel button |
| s2 | Explore filters (Period From / To use the same date field) |
| s3 | Place details (header and body one card, blue edge) |
| s7 | Edit a place (Add another name, Period row, date field) |
| s19 | More: every section is the same accordion card |
| s20 | Place type editor (Add another name, symbol list, uploaded symbols) |
| s21 | More: historical maps and categories |
| s22 | Moment (time travel), replaces the Period footer while on |
| s28 | Period of a name (Edit, same date field, Done) |
| s33 | Border: new version in time |
| s34 | Route form after drawing |
| s41 | More: add a language, rename a category |
| s43 | Route / river type editor |
| s44 | Area type editor |
| s45 | Notes (Period footer is the same component everywhere) |
| s46 | Note edit (date uses the new date field) |
| s47 | Date format menu (grouped by precision) |
| s48 | Date formats: every layout, CE / BCE toggle |
| s49 | Period vs Moment: two entities, one footer slot |

**Update 2026-11-24:** the owner delivered the full design, 68 frames in `full/` (index and task mapping: `full/README.md`). It covers Layers, Borders, Rivers, Routes, Directions, More, confirms, states and the panel sizes. The list above is the first set. Which items are still not drawn was not checked.
