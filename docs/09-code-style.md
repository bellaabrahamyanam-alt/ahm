<!-- Section 9 of the project description; index: README.md -->

## 9. Code style

Formatting is automatic and checked into the repository (`.prettierrc.json`, `.prettierignore`, `.editorconfig`), so editors agree.

| Language                               | Tool and settings                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| JavaScript, HTML, JSON, YAML, Markdown | Prettier 3: 120 columns, 2 spaces, single quotes, ES5 trailing commas.                                                        |
| PHP                                    | Prettier with `@prettier/plugin-php`: target PHP 7.1, PSR-2 braces, 4 spaces, single quotes, 120 columns, no trailing commas. |
| Python                                 | `black`, 120 columns.                                                                                                         |
| CSS                                    | **Hand-formatted** on purpose (Prettier skips `app/css/`): compact one-line rules grouped under section comments.    |
| Not formatted                          | `data/` (generated and user data) and `styles/` (phpBB template syntax).                                                      |

### Conventions

**General**

- Every file starts with a comment saying what it is for. Sections inside a file are marked `// ---- name ----` (CSS: `/* ---- name ---- */`).
- Comments explain **why**, not what.
- Names are in English, in `camelCase` for JavaScript, `snake_case` for PHP methods, `kebab-case` for CSS classes. Constant tables are `UPPER_CASE` (`TYPE_STYLE`, `PLACE_TYPES`).
- Functions that can fail with a user-visible problem **throw an `Error` with a readable sentence**, which the interface shows as it is.

**JavaScript**

- Classic `<script>` files sharing one global scope. The load order is fixed in `index.html` and listed in [Project structure](04-project-structure.md). There are no modules on purpose. Production serves a minified concatenation of them (`app/dist/`, `bun tools/build.js`; names are never renamed), so a new script or style file goes inside the marked blocks of `index.html` and `app/dist/` is rebuilt.
- Prefixes keep names apart: `ov…` for overlays, `pf…` for the place form, `df…` for the date field, `ahm-…` for map layer, source and image ids.
- One place knows where data comes from (`data.js` with `config.js`); everything else asks it.
- Browser code never builds markup from strings (owner decision 2026-11-24). Markup is static HTML in `app/index.html` with daisyUI v5 classes; JavaScript clones `<template>` elements and fills them with `textContent`, `value`, `dataset` and attributes, toggles `hidden` and classes, and handles events (`kit.tpl`, `kit.fill`). No `innerHTML` / `insertAdjacentHTML` with markup, no `esc()` in new code. Custom CSS only where daisyUI has no class; never define a class name daisyUI owns, use your own `ahm-` prefix. `tests/js/ui-rules.test.js` checks this.

**PHP**

- Namespace `ahm\map\…`. The controller stays thin; **all** validation and file handling is in `service/store.php`, which must not use phpBB classes.
- Bad input throws `\InvalidArgumentException` (answered as 400); anything else becomes a 500 with a short message.
- phpBB forbids `$_GET`, `$_POST` and `$_REQUEST`. Use its request class or `php://input`.
- Every write takes the lock, archives the old file first, and writes atomically (write a temporary file, then rename).

**CSS**

- Colours come only from variables. The palette is the first `:root` block of `css/base.css` (the same names and values as the forum style `paper-and-pencil`) and map-only values (radii, handle and route colours) are in a second `:root` block. There is no separate `colours.css` file.
- Boxed blocks share one rule (the "cards" section) instead of repeating it.

**Data and tests**

- Data files are never reformatted by tools.
- There is **no automated test suite in the repository** yet. See [Verification status](14-verification-status.md).

---
