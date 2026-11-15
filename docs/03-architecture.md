<!-- Section 3 of the project description; index: README.md -->

## 3. Architecture

### The idea in one picture

```
            VISITORS (browser)
                  │
   ┌──────────────┴───────────────┐
   │  Front-end: plain HTML/CSS/JS │   no framework; minified bundle
   │  (MapLibre GL JS draws the map)│
   └───────┬───────────────┬──────┘
           │ reads         │ writes (editors / admins)
           ▼               ▼
   ┌─────────────────────────────────────────┐
   │  Back-end                               │
   │   in the forum:  phpBB extension        │
   │     controller (login, permissions)     │
   │        └── service/store.php  (all data │
   │            rules, no phpBB inside)      │
   │   in development: browser-sync          │
   │        └── dev/save-handler.js (same    │
   │            rules, written in Node)      │
   └──────────────────┬──────────────────────┘
                      ▼
        FILES (no database): places.geojson,
        notes/<place>/<note>.md, notes/index.json,
        overlays.json, overlays/<id>.png, archive/

   Outside services used by the browser, all behind js/config.js:
   base-map tiles · satellite tiles · place search · directions
   (the optional relief tiles are NOT an outside service: static files on the forum's own domain, `basemap.terrain.tiles`)
```

### Layers and responsibilities

| Layer                | Files                             | Responsibility                                                                        |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| Page                 | `app/index.html`                  | The whole interface. Identical for the forum and for development.                     |
| Settings             | `app/js/config.js`                | The only place that knows addresses of data and outside services.                     |
| Data access          | `app/js/core/data.js`                | Loads places, notes and note text; small shared helpers.                              |
| Behaviour            | `search.js`, `ui.js`, `map.js`, … | Search and filters, the sidebar, the map, editing.                                    |
| Back-end entry       | `controller/main.php`             | Login and permission checks, HTTP responses. Thin.                                    |
| **Data rules**       | `service/store.php`               | Validation, saving, archiving, search index, migration. **Does not depend on phpBB.** |
| Forum glue           | `ext.php`, `event/listener.php`   | First-enable setup, language, Quick links entry.                                      |
| Development back-end | `dev/save-handler.js`             | The same rules as `store.php`, as browser-sync middleware.                            |

### How the same front-end runs in two places

`config.js` looks for `window.AHM_BACKEND`.

- **In the forum**, the controller serves `app/index.html` and inserts a small script with ready-made addresses for the data and save routes, plus the user's rights (`canEdit`, `canOverlay`, `loggedIn`). It also rewrites the asset links so they work from the forum's URL.
- **In development**, nothing is inserted, so `config.js` falls back to plain files under `/data/` and the `/api/…` endpoints of the development server.

The front-end therefore never changes between the two. Only `config.js` knows which one it is in.

### Data flow of a typical edit

1. The editor changes something in the browser (for example moves a place).
2. The browser sends **one JSON request** to the save route.
3. The controller checks the login and the right to edit, then passes the body to `store.php`.
4. `store.php` validates everything, copies the old file to `archive/`, writes the new file atomically, and rebuilds the notes search index when notes changed.
5. The browser reloads the data (the server answers with `no-cache` and an ETag, so the new data is shown at once) and shows the place.

### Where the live data lives

In the forum, live data is **not inside the extension**. On first enable, the sample data in `ext/ahm/map/data/` is copied to the forum's `store/ahm_map/`. `store/` is writable, is blocked from direct web access by phpBB, and survives extension updates.

---
