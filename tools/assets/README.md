# tools/assets: one builder for an extension, a style and this repository

`build.js` is ONE file with no dependencies. Copy it into the project to be built (a phpBB extension, a phpBB style) next to an `assets.config.json`.
It joins the listed JS and CSS files in the listed order and minifies them into `<outDir>/<name>.min.js` and `<outDir>/<name>.min.css`, with
`<name>.manifest.json` (a hash of the sources and the sizes). Commit all three: a forum has no Node and no Bun.

```
node build.js                 build every bundle of ./assets.config.json
node build.js --check         exit 1 when a bundle is missing or not built from the current sources (CI; needs no minifier)
node build.js other.json --engine none     only join the files (debugging)
```

## Install the minifiers (once per project)

```
cd <project>
npm i -D terser lightningcss      # or copy tools/assets/package.json next to build.js and run npm i
```

- **terser** minifies the JS. `toplevel` is OFF: names inside functions are shortened, every global name stays, because classic scripts call each other
  by name (the same rule as `tools/build.js`).
- **lightningcss** minifies and merges the CSS. No `targets` are set, so no syntax is lowered and no prefix is added.
- Without them the builder uses Bun (whitespace and syntax only), and without Bun it stops. It never writes a bundle with another engine in silence:
  `engine` in the manifest says what was used. `--engine terser` makes the missing package an error.

## assets.config.json

```json
{ "engine": "auto",
  "bundles": [ { "name": "forum", "outDir": "dist",
                 "js":  ["js/a.js", "js/b.js"],
                 "css": ["css/a.css", "css/b.css"] } ] }
```

One bundle = one JS file and one CSS file. Paths are relative to the config file. The ORDER of the lists is the load order and is never sorted.
Use one bundle for everything that every forum page needs and a second one for a heavy page (for example the map): then the page loads only what it uses.

## Rules for the files

- `@import` in CSS is refused: list the file in `css`.
- A relative `url(...)` is rewritten when the CSS file is in another folder than `outDir`, so fonts and images keep working. `?query` and `#fragment` stay.
- Every script must work as a classic script in one shared global scope (no `import`/`export`).

## phpBB: loading the bundles

- Extension: in `styles/all/template/event/overall_header_head_append.html` use `<!-- INCLUDECSS @vendor_ext/forum.min.css -->` and
  `<!-- INCLUDEJS @vendor_ext/forum.min.js -->` (the built files live in `styles/all/theme/` and `styles/all/template/`), and remove the old tags of the separate files.
- Style: put the built files in `theme/` and list them in `theme/stylesheet.css` or load them from `overall_header.html` the same way.
- After the change, load a forum page, a topic page and the page of the extension with the browser console open: no 404 and no "x is not defined".

## Versioning in a cache

Add `?v=<hash>` (the manifest `hash`, first 8 characters) to the bundle URL in the template, or let phpBB add its own version query: then a rebuilt bundle is
fetched again and an old one can be cached for a year.
