<!-- Section 10 of the project description; index: README.md -->

## 10. Deployment instructions

### Requirements

- phpBB **3.2 or 3.3** (the extension declares `>=3.2.0,<4.0.0`) and PHP **7.1.3 or newer**.
- The web server user can **write** to the forum's `store/` folder (phpBB already needs this).
- Visitors' browsers can reach the outside services: the base map and fonts (OpenFreeMap), the satellite tiles (EOX), directions (OSRM), place search (Nominatim) and the MapLibre library from the jsDelivr CDN.

### First installation

1. **Copy** the repository contents (everything except `.git` and `node_modules`) so that they end up as `<forum>/ext/ahm/map/` (folder names in lower case, exactly `ahm` and `map`).
2. In the forum's admin panel (ACP): **Customise → Manage extensions**, find **Armenian Highlands Map**, click **Enable**.
   On enabling, the sample data (10 places, 20 notes) is copied to `<forum>/store/ahm_map/`.
3. **Purge the cache:** ACP → General → _Purge the cache_.
4. Open `https://your-forum/app.php/map`. A **Map** entry also appears in the **Quick links** menu.
5. Choose who may edit: open `config/services.yml` and set `ahm.map.editors` to `members` (every logged-in user) or `admins`. Purge the cache again after changing it.

### Updating

1. Replace the extension files.
2. Purge the cache. (The routes are cached by phpBB; skipping this gives errors such as _"Some mandatory parameters are missing … to generate a URL for route"_.)
3. If the notice for a release says the data format changed, **disable and re-enable** the extension. The conversion also runs by itself on the next save. Your data in `store/ahm_map/` is kept, and every file that is converted is copied to `archive/` first. The browser also understands the old format, so the map keeps working until the conversion has run.

**Update to the date model and the language dictionary (this release):** the conversion turns year numbers into dates (`approx` becomes mode `approx`, a typed century such as "12th century BCE" becomes a century date), creates `languages.json` from the languages already in use, and gives every place a `height_m`. Things to know: an old `date_to: null` ("still exists") becomes "unknown"; a **mountain loses its dates** (the old file is in `archive/`); "early / mid / late" century wording becomes an approximate century.

**Update to ISO 8601 time stamps (this release):** dates saved by the previous release have `ts` as whole seconds. They are converted to ISO 8601 / RFC 3339 text when the extension is enabled, on the next save, when the development server starts, and also on the fly when the page reads old data. The old file is copied to `archive/` first. `places.geojson` becomes `"version": 3`.

### Renaming the extension

Needed only to use another vendor or name. Names may contain letters, digits and underscores, **not hyphens** (they become a PHP namespace). Disable the extension in the ACP first, then from the forum root:

```sh
NEW_VENDOR=qartez; NEW_NAME=haykakan_lernashxarh
mkdir -p ext/$NEW_VENDOR && mv ext/ahm/map ext/$NEW_VENDOR/$NEW_NAME && rmdir ext/ahm
cd ext/$NEW_VENDOR/$NEW_NAME
grep -rIl --exclude-dir=data --exclude-dir=node_modules --exclude-dir=archive -e 'ahm\\map' -e 'ahm/map' -e 'ahm\.map\.' . \
  | xargs sed -i -e "s#ahm\\\\map#$NEW_VENDOR\\\\$NEW_NAME#g" -e "s#ahm/map#$NEW_VENDOR/$NEW_NAME#g" -e "s#ahm\.map\.#$NEW_VENDOR.$NEW_NAME.#g"
```

Then purge the cache and enable the new extension. The live data in `store/ahm_map/` is not tied to the name and keeps working. After any later update, run the `grep … | xargs sed …` lines again on the new files.

### Backups

Copy the whole **`store/ahm_map/`** folder. It holds the places, the notes, the overlays and the `archive/` history. To restore, put it back.

### Web server notes

- `store/` is blocked from the web by phpBB's own rules on Apache. On **Nginx** make sure your configuration also denies `store/`, as in phpBB's sample configuration.
- **Image uploads** are limited by PHP (`post_max_size`, default 8 MB) and by the web server (Nginx `client_max_body_size`). The application allows 12 MB; raise the server limits if bigger images should work. The browser already shrinks scans larger than 4096 px.
- For URLs without `app.php`, enable phpBB's URL rewriting.

### Configuration reference

| Setting                  | Where                 | Meaning                                                       |
| ------------------------ | --------------------- | ------------------------------------------------------------- |
| `ahm.map.editors`        | `config/services.yml` | `members` or `admins`: who may add and edit places and notes. |
| `center`, `zoom`, `bbox` | `app/js/config.js`    | Start view, and the area `[W, S, E, N]` = `[32, 29, 51, 44]` (Mesopotamia from the Persian Gulf to the Caucasus, Ankara to Baku): it bounds the place search (Nominatim `viewbox` with `bounded=1`: places outside are not found), the relief tile requests, and what the terrain tool downloads and builds. |
| `basemap.style`          | `app/js/config.js`    | Style address of the vector base map.                         |
| `basemap.satellites[]`   | `app/js/config.js`    | Satellite sources (each is an entry in the base-map list).    |
| `basemap.terrain`        | `app/js/config.js`    | Optional relief (hillshade): `tiles` (address of the terrain tiles; empty = no entry), `encoding`, `tileSize`, `maxzoom`, `bounds` (only for your own tiles: the built area, same numbers as `bbox`; leave it out for the worldwide AWS tiles, otherwise relief stops at the edge of the box), `attribution` (licence wording, do not change; shown as plain text under the base-map list while relief is on, and in the map's own credits), `color.adapt` (ramp follows the heights in view, default true), `color.blend` (true = colours slide from one stop to the next, default; false = flat bands: from a stop up to the next one the colour of that stop, sharp edges; not the same as `color.smooth`, the 0.4 s slide to a new range), `paint` (hillshade look). Area = `bbox`. See "Relief layer (optional)". |
| `geocodeUrl`, `routeUrl` | `app/js/config.js`    | Place search and directions servers.                          |
| `features`               | `app/js/config.js`    | Optional features (`app/features/<name>/`) that are switched on: in development the list in the file (`?features=` in the URL hides all); in the forum only what the controller sends (nothing today, so they are hidden). See `DOMAINS.md`, "Features". |

### Relief layer (optional)

An extra entry **Map + relief** in the base-map list: shaded relief (hillshade) over the normal vector map, labels and markers stay on top. It is **off until you build elevation tiles and put their address in `config.js`**; without that nothing changes and nothing is requested. Everything is yours: free data (Copernicus DEM), tiles you build once on your own computer, served from your own forum domain. No new outside service.

**What was and was not checked** (so you know how far to trust this guide):

- Checked in the development sandbox: the tile maths, Terrarium encoding, resampling, the pyramid, WebP writing, resuming, `NOTICE.txt`, `.htaccess` text, the zip, the preview, and the dropdown entry, the source and layer settings of the map (with a stand-in for MapLibre).
- **Not checked** (no network, no real data, no browser map there): reading the real GeoTIFF files (`tools/terrain/geotiff_source.py`, the first real run is its test), the real file names in the AWS buckets, the real size of the tiles, the Apache directives, the Cloudflare dashboard wording, how the relief looks on a real map, speed on weak phones.

#### What you need

- A computer (not the forum server) with about **20 GB free** for the downloaded squares, the tiles and the zip (a guess from the table below: the real sizes are unknown, the tool prints them) and a good connection. The download is several GB (resumable). The tile build takes hours, not minutes (estimate below; it is resumable).
- Memory: **about 1 GB is enough** (an estimate, not measured). The mosaic of the whole area is virtual (about 68,400 x 54,000 pixels, 3.7 billion): nothing is held in memory in that size. The tool reads one small window per tile, keeps at most 64 files open and works one tile at a time.
- Access to the forum's files by SFTP or the hosting file manager. Nothing goes through the forum, the administration panel or PHP, so PHP upload limits do not matter for these static files.

#### The area, the numbers, and a caveat for Armenia and Azerbaijan

The area is `bbox` in `app/js/config.js`: **west 32, south 29, east 51, north 44** (Ankara 32.9 E to Baku 49.9 E and the Absheron tip 50.4 E; the head of the Persian Gulf, Kuwait 29.4 N, to the Greater Caucasus ridge 43.0-43.4 N with Elbrus at 43.35 N). South 30 would cut off Kuwait and the Gulf head, south 28 only adds sea and desert (19 more squares, 5% more tiles), so 29 stays. The tool reads this one line; to change the area change it there and build again (into a new version folder).

| | Count (computed with the tile maths of `core.py`, the same as the tool) |
| --- | --- |
| Squares of 1 by 1 degree | **285** |
| Tiles, zoom 0 to 10 (`--maxzoom 10`) | **4,040** |
| Tiles, zoom 0 to 11 (default) | **15,812** |
| Tiles, zoom 0 to 12 (`--maxzoom 12`) | **62,250** |

Size, time and memory are **estimates, not measurements** (the real tiles were never built; only synthetic data was used). The size of a tile is unknown: assume 50-150 KB for a mountain tile (lossless WebP, 256 x 256, 3 channels), a few KB for sea and flat plains. Without that knowledge the honest upper bound is the plain tile count times a guessed average: **zoom 0-10 about 0.2-0.6 GB, zoom 0-11 about 0.8-2.4 GB, zoom 0-12 about 3-9 GB**. Sea (Persian Gulf, Black Sea coast, Caspian) and the flat plains of Mesopotamia are much smaller, but the area also holds the Zagros, Taurus, Alborz, the Greater and Lesser Caucasus and the Armenian Highlands, so no factor below the tile count is promised. The area is 4.0 times the old Armenian-Highlands area in tiles; take 4 times as the upper estimate of the old numbers. Build time scales the same way: the old guess of about 30 minutes becomes about **2 hours** at zoom 11 (about 8 hours at zoom 12). Download: 285 squares at a guessed 20-30 MB each for GLO-30 is **several GB** (about 3-8 GB; fewer when sea squares have no file; the GLO-90 squares are small). Interrupted? The download is resumable.

**Files and hosting.** 62,250 files at zoom 12 may exceed the file (inode) limit of a shared hosting plan; 15,812 files (zoom 11) are usually fine but **ask the host for the limit** before the upload. If the limit is a problem, build `--maxzoom 10` (4,040 files) or upload to a sub-domain or a host without that limit. Keep the default **maxzoom 11**; zoom 12 is for later and needs a new version folder (see "Later changes").

**Armenia and Azerbaijan are only in 90 m resolution.** Verified in this project's research (not by running the tool): the Google Earth Engine catalog page for `COPERNICUS/DEM/GLO30` says "The GLO-30 dataset is available worldwide with a free license with the exception of two countries (Armenia and Azerbaijan)"; the ASF HyP3 documentation (https://hyp3-docs.asf.alaska.edu/dems/) says its GLO-30 "does not provide coverage over Armenia and Azerbaijan" and fills these with GLO-90; the AWS open-data registry says GLO-30 Public omits the tiles of countries it does not cover and "ocean areas do not have tiles, assume height equal to zero". What this means for the map:

- Relief in **Armenia and Azerbaijan, the core of this map, comes from GLO-90 (90 m)**, coarser than the rest of the area (30 m). At zoom 10 and 11 the difference is visible: softer, blockier ridges.
- The tool tries GLO-30 first for every square and falls back to GLO-90 when the server says 404; `terrain.py squares` marks the squares where it expects this (about 32, from approximate boxes).
- **A seam along the borders is possible** where a GLO-30 square meets a GLO-90 square (Armenia and Azerbaijan with Georgia, Turkey, Iran, Russia): they are different products, so heights may differ by a few metres or the sharpness changes along a straight line. The tool places the 90 m grid on the 30 m grid without an offset (tested with a stand-in; real files not tested). `check` lists some borders and prints the `preview --at LON LAT` command to look at them (zoom 10, 3 x 3 tiles). If a **GLO-30 square that straddles the border has void parts** (the missing country cut out), `check` shows `void=...%` and a warning, because such parts are built as 0 m (a hole). That case is not handled automatically yet (follow-up in `TODO.md`).
- Honest alternatives for 30 m there are NASADEM and SRTM-derived data (such as the AWS Terrain Tiles); neither is implemented. Licences: see docs/12 (AWS Terrain Tiles need attribution, and the SRTM copyright wording outside the US is unresolved there).

#### Steps

1. **Install Python 3.10 or newer and the packages.** Windows: install from python.org (tick "Add Python to PATH"), then in a terminal (PowerShell). macOS: `brew install python`. Linux: your package manager (`python3`, `python3-pip`). Then:
   `pip install numpy pillow rasterio`
   (On Windows, macOS and Linux `rasterio` normally installs as a ready-made wheel. If it fails, use conda: `conda install -c conda-forge rasterio numpy pillow`.) Use `python3` instead of `python` on macOS and Linux below.
2. **Get the code.** `git clone https://github.com/bellaabrahamyanam-alt/ahm.git` and `cd ahm`. (Or download the repository as a zip.) The tool is in `tools/terrain/`.
3. **Check the list of squares.** `python tools/terrain/terrain.py squares | head -3` prints the first download addresses (for the area `bbox` in `app/js/config.js`; today 285 squares of 1 by 1 degree). Every line is an address, then `#` and a note: which dataset is tried first and, for about 32 squares in Armenia and Azerbaijan, that GLO-90 is expected. A summary line goes to the terminal at the end; which squares are sea cannot be known before the download. The file names are written from memory and are **unverified**: open one printed address in the browser; it should start a download. If it says "Not Found", list the bucket and tell the developer the real names:
   `curl "https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/?list-type=2&prefix=Copernicus_DSM_COG_10_N40_00_E044&max-keys=5"` (or, with the AWS command line, `aws s3 ls --no-sign-request s3://copernicus-dem-30m/ | head`). The buckets are public, no account needed.
4. **Download.** `python tools/terrain/terrain.py download --dem dem`
   It prints each address it tries. By default (`--dataset auto`) it asks GLO-30 (30 m) first and, for a square the server answers 404 for, GLO-90 (90 m). `--dataset glo90` asks only the 90 m bucket and never GLO-30; `--dataset glo30` only GLO-30 (see "Which dataset"). Use the same `--dataset` in `squares`, `download`, `check` and `build`. Only an HTTP 404 means "no tile": the square is taken as sea (0 m) and noted in a `NO_TILE_<square>.txt` file in `dem` (it names the datasets that were asked). Any other answer (403, 5xx, a network error, a timeout) stops the run with a message and writes nothing, so a mountain is never flattened to sea; run the same command again, finished files are skipped. At the end it prints how many squares came from GLO-30, from GLO-90 and without a tile. **That summary is the truth about your area**: the list `squares` prints for Armenia and Azerbaijan ("expect GLO-90") is only a prediction from older sources, which conflict (some say GLO-30 leaves these countries out, the Copernicus Data Space page says release 2023_1 opened them); whether the public bucket has those squares is unverified.
5. **Check the files (dry run, writes nothing).** `python tools/terrain/terrain.py check --dem dem`
   It opens every square and stops with a clear message for a wrong coordinate system, wrong data type, wrong bounds or missing rasterio. It prints per square the dataset, the share of void pixels (`void=`) and of exact zeros, the totals (GLO-30, GLO-90, no tile), the credit text your data needs (GLO-30, GLO-90 or both), and the borders between GLO-30 and GLO-90 squares with a ready `preview --at` command for each of the first three. A square marked `VOID PART` has a country cut out and would be built as 0 m there. It refuses a square that was not downloaded.
6. **Try a small build first** (a minute or two): `python tools/terrain/terrain.py build --dem dem --out try --maxzoom 7`, then `python tools/terrain/terrain.py preview --out try --zoom 7 --png try.png` and open `try.png`. **Look for:** mountains and valleys lit from the top left, flat grey for the sea, no seams between the nine tiles, no stripes or blocks. Fix problems here, not after the long run. Then delete the folder `try`.
7. **Build.** `python tools/terrain/terrain.py build --dem dem --out ahm-terrain`
   Zooms 0 to 11 (15,812 tiles for the current area; allow a couple of hours). Elevation is rounded to 1 m. For very flat land (Mesopotamia, the Kura and Araks plains) a finer step helps the shading: add `--step 0.5` (bigger files). At the end it prints the number of tiles and the **real total size**; if it is more than your web space or file limit allows, build with `--maxzoom 10` (4,040 files, a quarter) and set the same number in `basemap.terrain.maxzoom`. Interrupted? Run the same command again: only missing tiles are made (`--force` rewrites everything; `--version v2` writes into another version folder).
8. **Preview the real result.** `python tools/terrain/terrain.py preview --out ahm-terrain --zoom 8 --png preview.png` and look at it as in step 6.
9. **Pack for upload.** `python tools/terrain/terrain.py pack --out ahm-terrain --archive terrain.zip` (one file; thousands of small files are very slow over FTP).
10. **Upload outside `ext/`.** Extension updates replace the whole `ext/ahm/map/` folder, so the tiles live in `<forum>/ahm-terrain/`, next to `config.php` and `viewtopic.php`. Never use `files/`, `store/` or `cache/`: phpBB blocks them. Upload `terrain.zip` to the forum folder with SFTP or the file manager, and unpack it there (file manager "Extract", or `unzip terrain.zip` over SSH). It creates `ahm-terrain/` with `.htaccess`, `NOTICE.txt` and `v1/`. Delete `terrain.zip` from the server afterwards. The file `.htaccess` starts with a dot: switch on "show hidden files" in your FTP client and check that it is there. It is generated by the tool and **not tested on a real server**: it turns phpBB's rewrite rules off in this folder (so a missing tile can never start the whole forum through `app.php`), forbids folder listings and sets a one-year cache.
11. **Test the address in the browser.** `https://<your-forum-domain>/ahm-terrain/v1/0/0/0.webp` shows an image; `https://<your-forum-domain>/ahm-terrain/NOTICE.txt` shows text. A tile that does not exist, such as `/ahm-terrain/v1/5/1/1.webp`, must give a plain "Not Found" page, **not** a page in the forum's design (that would mean PHP is answering, see the troubleshooting table).
12. **Cloudflare cache rule** (only if the forum is behind Cloudflare; the wording of the dashboard is from general knowledge and **untested**). Dashboard, your domain, Caching, Cache Rules, Create rule:
    - If: URI Path, *starts with*, `/ahm-terrain/`
    - Then: Cache eligibility = **Eligible for cache**; Edge TTL = **respect origin** (use the `Cache-Control` header of the `.htaccess`; the alternative "override: 1 month" also works and does not depend on the `.htaccess` headers; tiles never change inside a version folder, so a long time is harmless); Browser TTL = **respect origin**.
    - Verify: open the map, choose Map + relief, open the browser developer tools, tab Network, click a `.webp` request, look at the response headers. After a reload the same tile shows `cf-cache-status: HIT` (the first request is MISS or similar). `DYNAMIC` means the rule does not match.
    - Facts: `immutable` has no effect on Cloudflare's own cache, only on browsers. A change of tiles is done with a new version folder (`v2`), never by overwriting `v1`.
    - **Terms caveat.** Cloudflare's Service-Specific Terms for the CDN say that without paid services you must not use it "to serve video or a disproportionate percentage of pictures, audio files, or other large files". Tiles are small images, the term "disproportionate" is not defined, and the risk is judged small but not zero. If you want no risk: serve the tiles from a separate sub-domain (for example `tiles.<your-domain>`) whose DNS records are **DNS only** (grey cloud, not proxied) and change only `basemap.terrain.tiles`. A second fallback is Cloudflare R2 (not verified here: pricing and sign-up requirements).
13. **Switch it on in `config.js`.** In `app/js/config.js` set
    `tiles: ["https://<your-forum-domain>/ahm-terrain/v1/{z}/{x}/{y}.webp"],` in `basemap.terrain` (a full address; a relative one is untested). If you built with `--maxzoom 10`, set `maxzoom: 10`. **Also set `bounds`** to the same numbers as `bbox` (for example `bounds: [37, 37, 49, 42.5],`) and `attribution` to the text of your build: without `bounds` the map asks for tiles outside the built area and every missing file starts the forum's PHP. `terrain.py build` and `terrain.py pack` print the whole block to paste (tiles with `YOUR-FORUM` to replace, maxzoom, bounds, attribution). The default AWS tiles need no `bounds`: they cover the world. The forum serves a minified bundle, which contains `config.js`, so there are two ways: (a) on your computer run `bun tools/build.js` (needs [Bun](https://bun.sh)) and upload `app/js/config.js` and the folder `app/dist/` to `ext/ahm/map/app/`; or (b) on the server edit `ext/ahm/map/app/js/config.js` and delete `ext/ahm/map/app/dist/` (the forum then loads the plain files, a little slower). An extension update overwrites `config.js`: repeat this step after each update.
14. **Purge the forum cache** (administration panel, General, "Purge the cache"), then reload the map with Ctrl+F5.
15. **Verify.** The base-map list has **Map + relief**. Choose it: the shading appears and the credit text of your data ("produced using Copernicus WorldDEM-30 ..." or "-90") shows as plain text under the base-map list (**More**, Maps & base map) and disappears when you choose another base map. Network tab: requests go to `.../ahm-terrain/v1/z/x/y.webp`, status 200 (or 304), nothing outside the area; no request returns forum HTML. Zoom in beyond the last built zoom: the relief gets softer, that is expected.

#### Troubleshooting

| Symptom | Likely cause and remedy |
| --- | --- |
| No "Map + relief" entry | `tiles` is empty, or the old bundle is served (step 13, purge the cache, hard reload). |
| Status line "Relief tiles failed to load" | Wrong `tiles` address, or the folder is not uploaded; open one tile address in the browser. |
| A missing tile returns a page in the forum's design | `.htaccess` missing or not read: show hidden files, check that the host allows `AllowOverride` for `FileInfo` and `Options`. If the host forbids it, ask the host or put the tiles on a sub-domain with its own document root. |
| Error 500 for every tile | A directive of `.htaccess` is not allowed (often `Options -Indexes`): delete that line. |
| `download` stops with `HTTP 403` or a network error | Nothing was taken as sea. Check the address in a browser (see step 4), the connection, and run the same command again. |
| Tiles load but nothing is shaded | Terrarium encoding is wrong or the tiles are all 0: look at `preview.png`; check `encoding` is `terrarium`. |
| `cf-cache-status` is always `DYNAMIC` or `MISS` | The cache rule does not match (path) or the response has cookies; check step 12. |
| Tiles do not change after a rebuild | They are cached for a year: build into a new version folder (`v2`) and change `tiles`. |

#### Later changes

- **More detail (zoom 12), or new data or a different step:** build into a **new version folder** next to the old one: `python tools/terrain/terrain.py build --dem dem --out ahm-terrain --maxzoom 12 --version v2` (62,250 tiles, four times the files and size; check the file limit of the host first; the whole build is made again, it does not extend `v1`). Upload and unpack it (`terrain.zip` from `pack` holds both versions; pack a folder that has only `v2` to upload less), set `tiles` to `.../v2/...` and `maxzoom: 12`, and delete `v1` when nothing uses it. Never overwrite a version: browsers and Cloudflare keep tiles for a year.
- **Backup:** keep `terrain.zip` (or the `ahm-terrain` folder) on your computer; the whole thing can be rebuilt from the downloaded squares in `dem`.

#### Which dataset: GLO-30 first, or GLO-90 only

`--dataset auto` (default): GLO-30, and GLO-90 for squares GLO-30 does not have. `--dataset glo90`: GLO-90 for every square. A decision aid, neutral:

- **GLO-90 everywhere:** one uniform product (no 30 m / 90 m seam along the Armenia/Azerbaijan borders, T-061), about 9 times less source data to download (1200 x 1200 samples per square instead of 3600 x 3600), a lower build time and memory use (not measured). Cost: no 30 m detail anywhere.
- **Zoom against resolution** (256 px tiles, 40 N): z10 about 117 m per pixel, z11 about 58.6 m, z12 about 29.3 m. GLO-90 is 90 m, so z10 is about its own resolution, z11 enlarges it about 1.5 times and z12 about 3 times. **Recommended with GLO-90: `--maxzoom 11`.** `--maxzoom 12` is allowed but not recommended: 4 times the files, inode limits on shared hosting, and no new detail (the same elevation, only smoother).
- **Credit:** one licence for both ("The GLO-30 and GLO-90 datasets are available worldwide with a free license"), but the wording names the product: GLO-90 data needs "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved". A build that mixes both products names both. The tool writes the right text into `NOTICE.txt` and into the config block. Source of the GLO-90 text: the Copernicus Data Space page of COP-DEM and the ESA licence PDF (Art. 6(b)), read through a summarising fetch tool, **not as raw text**; the PDF is said to write "WorldDEM(TM)-90" with a trademark sign, the page without. Read the licence before you publish. The 90 m file names (`Copernicus_DSM_COG_30_...`, bucket `copernicus-dem-90m`) are from memory and unverified; the tool prints every address it tries.

Size of the tiles (zoom 0 up to the zoom shown; all numbers come from SYNTHETIC fractal terrain, not real data: real sizes are unmeasured and may differ a lot). Kilobytes per tile, rugged / moderate / plain, lossless WebP: z10 42 / 27 / 12 (1 m step), 55 / 40 / 19 (0.5 m); z11 30 / 18 / 10 and 43 / 30 / 15; z12 18 / 14 / 6 and 29 / 23 / 10 (zooms below 10 are counted with the z10 figures). Totals for the area `bbox` [32, 29, 51, 44] (the area of the pending change to the Mesopotamia and Caucasus box; recomputed with the tile maths of the tool): tiles 4,040 (z0-10), 15,812 (z0-11), 62,250 (z0-12). Range = all tiles plain to all tiles rugged; "mix" = 25 % rugged, 35 % moderate, 40 % plain or sea (an assumption).

| Zoom | Tiles | 1 m step: range (mix) | 0.5 m step: range (mix) |
| --- | --- | --- | --- |
| 0-10 | 4,040 | 0.05-0.16 GB (0.10) | 0.07-0.21 GB (0.14) |
| 0-11 | 15,812 | 0.16-0.50 GB (0.30) | 0.24-0.69 GB (0.44) |
| 0-12 | 62,250 | 0.42-1.30 GB (0.82) | 0.68-1.98 GB (1.30) |

For the current area [37, 37, 49, 42.5] (3,921 tiles at z0-11, 15,375 at z0-12): z0-11 about 0.04-0.12 GB at 1 m (mix 0.07), z0-12 about 0.10-0.32 GB (mix 0.20). The GLO-90 download for 285 squares (the 19 x 15 degree area): raw 1200 x 1200 float32 is 5.8 MB per square (1.6 GB if uncompressed); compressed perhaps 2-4 MB each, so about 0.6-1.1 GB (unmeasured). For 72 squares (the current area) about 0.14-0.28 GB.

#### Licence and duty

The elevation data is Copernicus DEM GLO-30 (GLO-90 for squares the server does not have, or everywhere with `--dataset glo90`). Our tiles are **adapted** data (resampled and encoded), so the licence requires this wording, which the map shows and `NOTICE.txt` repeats: "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved". Also: the licence says the providers do not incur any liability for any use of the Copernicus WorldDEM-30; never suggest that the European Union or ESA endorse your forum or map; and pass these obligations on to anyone you give the tiles to, which is why `NOTICE.txt` must stay next to the tiles. Do not change the attribution text. The licence link in `NOTICE.txt` and the wording above come from the project notes and were **not re-read against the original licence** in this environment: read it once before a public launch.

### Troubleshooting

| Symptom                                                        | Likely cause and remedy                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Error about a missing route parameter, or a new feature absent | phpBB's cache is old. Purge the cache; if needed disable and re-enable the extension.                       |
| The page opens but the sidebar says it could not load data     | The data folder is missing or unreadable: check `store/ahm_map/` exists and the web server can read it.     |
| "Save failed" with a permission message                        | `store/ahm_map/` is not writable by the web server, or the user may not edit (see `ahm.map.editors`).       |
| "Save failed: only administrators can …"                       | The action is for administrators (overlays), or `ahm.map.editors` is `admins`.                              |
| Image upload fails                                             | The image is over a server limit (see above) or is not PNG, JPEG or WebP.                                   |
| "Language … is not in the list"                                | The language is not in the dictionary. An administrator adds it in the **Languages** tab.                   |
| An overlay does not show                                       | It is hidden at the current zoom: the Layers list says "Hidden at this zoom" and gives the zoom range.      |
| The base map is blank                                          | The browser cannot reach the map style or tiles (blocked, offline, or the provider is down).                |
| Armenian place names show as empty boxes on the map            | The base map's fonts lack Armenian letters. Names are still correct in the list. See the limitations below. |

---
