<!-- Section 12 of the project description; index: README.md -->

## 12. Licences of the data and services

This is a summary for planning and **not legal advice**. Terms change; check each provider before a public launch.

| Part                            | Used for                      | Terms in short                                                                                                                                                                                                            |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MapLibre GL JS                  | Drawing the map               | Open source, free.                                                                                                                                                                                                        |
| OpenFreeMap                     | Base map (OpenStreetMap data) | Free, commercial use allowed, **attribution required** (shown automatically). No guarantee of availability. Map data: ODbL, "© OpenStreetMap contributors".                                                               |
| Sentinel-2 cloudless 2020 (EOX) | Satellite layer               | **Non-commercial use only** (CC BY-NC-SA 4.0) with EOX's attribution wording and links (already set in `config.js`). Commercial use needs a licence from EOX.                                                             |
| Copernicus DEM GLO-30 / GLO-90 | Relief tiles (self-hosted)   | GLO-30 does not cover Armenia and Azerbaijan (GLO-90 does; docs/10, "The area"). Free, also for commercial use, with **required attribution for adapted data** (shown on the map, repeated in `NOTICE.txt`), a no-liability disclaimer, no suggestion of EU/ESA endorsement, and the same duties passed on to users of the tiles. Wording: docs/10, "Relief layer". Not re-read against the original licence here. |
| Nominatim (public server)       | Search for other places       | Maximum **1 request per second** for the whole site, no search-as-you-type, results should be cached (the application searches only on Enter, caches, and throttles each visitor). A busy site should use its own server. |
| OSRM demo server                | Car directions                | Reasonable non-commercial use, about 1 request per second, no guarantees, not for production. Credit to OSRM and OpenStreetMap (shown in the Directions tab).                                                             |
| Data you enter                  | Places, notes, images         | Yours. Copying text or images from other works (for example Wikipedia, books, old maps) brings the licence of those works.                                                                                                |

If you import OpenStreetMap data into your own place data in bulk, the ODbL share-alike rule applies to that database. The sample places were typed by hand and contain no OSM import.

---
| AWS Terrain Tiles (Mapzen/Tilezen) | Relief tiles (default, from the browser) | Public dataset; attribution shown on the map (`basemap.terrain.attribution`). Wording and terms taken from memory, NOT checked against the dataset page. | https://github.com/tilezen/joerd/blob/master/docs/attribution.md |
