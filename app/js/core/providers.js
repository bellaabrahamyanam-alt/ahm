// Outside services: place search and directions. Replace the bodies to change provider.
// Public Nominatim policy: at most 1 request per second, cache results, no search-as-you-type (callers search on Enter / button only).
const geoCache = new Map();
let geoLast = 0;
const geocode = async (q, lang) => {
  const key = lang + "|" + q.toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key);
  const wait = geoLast + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  geoLast = Date.now();
  const rs = await fetch(
    AHM_CONFIG.geocodeUrl +
      "?format=jsonv2&limit=6&bounded=1&accept-language=" +
      lang +
      "&viewbox=" +
      [
        AHM_CONFIG.bbox[0],
        AHM_CONFIG.bbox[3],
        AHM_CONFIG.bbox[2],
        AHM_CONFIG.bbox[1],
      ].join(",") +
      "&q=" +
      encodeURIComponent(q),
  )
    .then((r) => r.json())
    .then((a) =>
      a.map((x) => ({ name: x.display_name, lon: +x.lon, lat: +x.lat })),
    );
  geoCache.set(key, rs);
  return rs;
};
const route = (a, b) =>
  fetch(
    `${AHM_CONFIG.routeUrl}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`,
  )
    .then((r) => r.json())
    .then((j) => {
      if (!j.routes || !j.routes.length) throw Error("none");
      const r = j.routes[0];
      return {
        geometry: r.geometry,
        km: r.distance / 1000,
        min: r.duration / 60,
      };
    });
// Borders of places, countries and regions from OpenStreetMap (same service, same policy: user-started, 1 request per second, cached).
// Not limited to the study area. Returns [{ name, osm, kind, rank, addresstype, names: { code: name }, geometry }] for results that have an outline.
const geoShapeCache = new Map();
const geocodeShapes = async (q, lang, threshold = 0.004) => {
  const key = lang + '|' + threshold + '|' + q.toLowerCase();
  if (geoShapeCache.has(key)) return geoShapeCache.get(key);
  const wait = geoLast + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  geoLast = Date.now();
  const r = await fetch(
    AHM_CONFIG.geocodeUrl +
      '?format=jsonv2&limit=8&polygon_geojson=1&polygon_threshold=' +
      threshold +
      '&namedetails=1&accept-language=' +
      encodeURIComponent(lang || 'en') +
      '&q=' +
      encodeURIComponent(q)
  );
  if (!r.ok) throw Error('The search service answered ' + r.status);
  const rs = (await r.json())
    .filter((x) => x.geojson && /^(Multi)?(Polygon|LineString)$/.test(x.geojson.type))
    .map((x) => ({
      name: x.display_name,
      osm: x.osm_type + '/' + x.osm_id,
      kind: x.type,
      rank: x.place_rank,
      addresstype: x.addresstype,
      names: Object.fromEntries(Object.entries(x.namedetails || {}).filter(([k]) => k === 'name' || k.startsWith('name:'))),
      geometry: x.geojson,
    }));
  geoShapeCache.set(key, rs);
  return rs;
};
