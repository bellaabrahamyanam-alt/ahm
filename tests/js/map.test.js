// Tests of the map domain (DOMAINS.md; owner: map), written first (TDD) from tasks/004-map-highlight.md.
// They are red until `map-dev: task 004` is done. Real MapLibre is not available here: map.js is loaded into the vm
// context of lib/ctx.js and `maplibregl` is a recording stand-in (makeMapLibre below).
//
// What these tests fix (the spec leaves the drawing to the implementer; this is what a test can observe):
//   - the highlight is the symbol layer `ahm-highlight-symbol` (the marker of the place with a white border, since 2026-11-09;
//     it was a `circle` ring before) over its own GeoJSON source `ahm-highlight`;
//   - that source holds one Point feature (properties.id = the selected id) at the place's coordinates, and no feature
//     when nothing is selected or the id is not among the features last given to AHM.map.setFeatures;
//   - the selection is remembered: the ring follows the place when setFeatures moves it, appears when the place (or the
//     map) arrives after the selection, and stays through base-map switches;
//   - the map listens to AHM.on('state:selected', ({ value }) => ...) and reads AHM.state for nothing else
//     (AHM.state.get('selected') at most), emits no event of its own and adds no AHM.map command.
const { test, ok, eq, J } = require('./lib/harness');
const { load } = require('./lib/ctx');

const HL = 'ahm-highlight';
const CONFIG = {
  center: [44.5, 40],
  zoom: 7,
  basemap: { style: 'stub', satellites: [{ id: 'sat1', label: 'Satellite', tiles: [], maxzoom: 18, attribution: '' }] },
};
const P1 = ['p1', 44.5, 39.9];
const P2 = ['p2', 44.5, 40.1];
const P3 = ['p3', 44.3, 39.7];

/** A feature collection in the shape of INTERFACES.md I-2 (`setFeatures`). Each place is [id, lon, lat]. */
const fc = (...places) => ({
  type: 'FeatureCollection',
  features: places.map(([id, lon, lat]) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { id, name: id, type: 'City', type_code: 'city', dates: '', halo: '' },
  })),
});

/** A recording stand-in for the parts of MapLibre that map.js uses. Like the real one it refuses sources and layers
 *  before the style has loaded. `fire('load')` plays the map's load event. */
function makeMapLibre() {
  const rec = { loaded: false, layers: [], sources: {}, handlers: {}, before: {} };
  const base = [
    { id: 'base-bg', type: 'background' },
    { id: 'base-water', type: 'fill', 'source-layer': 'water' },
    { id: 'base-label', type: 'symbol', 'source-layer': 'place' },
  ];
  const own = (id) => rec.layers.find((l) => l.id === id);
  const any = (id) => own(id) || base.find((l) => l.id === id);
  const needStyle = () => {
    if (!rec.loaded) throw new Error('Style is not done loading');
  };
  const map = {
    on(name, a, b) {
      const key = b ? name + ':' + a : name;
      (rec.handlers[key] ||= []).push(b || a);
    },
    addControl() {},
    addSource(id, def) {
      needStyle();
      rec.sources[id] = {
        def,
        type: def.type,
        data: def.data,
        setData(d) {
          this.data = d;
        },
      };
    },
    getSource: (id) => rec.sources[id],
    removeSource(id) {
      delete rec.sources[id];
    },
    addLayer(def, beforeId) {
      needStyle();
      rec.before[def.id] = beforeId;
      rec.layers.push({ ...def });
    },
    getLayer: any,
    removeLayer(id) {
      rec.layers = rec.layers.filter((l) => l.id !== id);
    },
    setFilter(id, f) {
      const l = any(id);
      if (l) l.filter = f;
    },
    setLayoutProperty(id, k, v) {
      const l = any(id);
      if (l) (l.layout ||= {})[k] = v;
    },
    setPaintProperty(id, k, v) {
      const l = any(id);
      if (l) (l.paint ||= {})[k] = v;
    },
    getStyle: () => ({ layers: [...base, ...rec.layers] }),
    queryRenderedFeatures: () => [],
    getCanvas: () => ({ style: {} }),
    resize() {},
    flyTo() {},
    fitBounds() {},
    getZoom: () => 7,
    getBounds: () => ({ getWest: () => 43, getEast: () => 44.5, getSouth: () => 40, getNorth: () => 40.5 }),
  };
  const fire = (name, arg) => {
    if (name === 'load') rec.loaded = true;
    (rec.handlers[name] || []).forEach((fn) => fn(arg));
  };
  const maplibregl = {
    Map: function () {
      return map;
    },
    NavigationControl: function () {},
    Popup: function () {
      return {
        setLngLat() {
          return this;
        },
        setHTML() {
          return this;
        },
        addTo() {
          return this;
        },
        remove() {},
      };
    },
  };
  return { rec, fire, maplibregl };
}

/** map.js in a page of its own. `ready: false` leaves the map before its load event; `before(p)` runs before initMap().
 *  Handler errors of AHM.emit are only logged, so they are collected in `errors`. */
function boot({ ready = true, before } = {}) {
  const p = load(['typeicons.js', 'map.js']);
  const ml = makeMapLibre();
  const errors = [];
  Object.assign(p.ctx, {
    maplibregl: ml.maplibregl,
    AHM_CONFIG: CONFIG,
    esc: String,
    registerTypeIcons() {},
    overlaysInit() {},
    syncOverlays() {},
    shapesInit() {}, // shapes.js is not loaded here: no borders to draw
    shapeLineAt: () => null,
    shapesAt: () => [],
    shapeDrawing: null,
    console: { log() {}, warn() {}, error: (...a) => errors.push(a.map(String).join(' ')) },
  });
  let onBasemap = null;
  p.el('#basemap').addEventListener = (name, fn) => {
    if (name === 'change') onBasemap = fn;
  };
  if (before) before(p);
  p.X('initMap()');
  if (ready) ml.fire('load');
  return { p, ml, errors, switchBasemap: (value) => onBasemap({ target: { value } }) };
}

const setFeatures = (p, collection) => p.X('AHM.map.setFeatures(__0)', collection);
const select = (p, value, old = null) => p.X("AHM.emit('state:selected', { value: __0, old: __1 })", value, old);
/** The Point features the highlight layer draws now (none when the layer or its source is missing or hidden). */
const ring = (ml) => {
  const layer = ml.rec.layers.find((l) => l.source === HL);
  const src = layer && ml.rec.sources[layer.source];
  if (!src || (layer.layout && layer.layout.visibility === 'none')) return [];
  const d = src.data || {};
  return d.type === 'FeatureCollection' ? d.features : d.type === 'Feature' ? [d] : [];
};
const drawn = (ml) => ring(ml).map((f) => f.geometry.coordinates);

test('map: highlight: state:selected draws the selected symbol (layer ahm-highlight-symbol) at the place and moves with the selection', () => {
  const { p, ml, errors } = boot();
  setFeatures(p, fc(P1, P2, P3));
  select(p, 'p2');
  const layer = ml.rec.layers.find((l) => l.id === 'ahm-highlight-symbol');
  ok(layer && layer.type === 'symbol', 'a symbol layer ahm-highlight-symbol exists');
  eq(HL, layer.source, 'it has its own source ahm-highlight');
  eq([[44.5, 40.1]], drawn(ml), 'one ring at p2');
  eq(['p2'], ring(ml).map((f) => f.properties.id));
  select(p, 'p1', 'p2');
  eq([[44.5, 39.9]], drawn(ml), 'the ring moved to p1 and p2 has none');
  eq([], errors);
});

test('map: highlight: a null value removes the ring, and a later selection draws it again', () => {
  const { p, ml, errors } = boot();
  setFeatures(p, fc(P1, P2));
  select(p, 'p1');
  eq([[44.5, 39.9]], drawn(ml), 'drawn first');
  select(p, null, 'p1');
  eq([], drawn(ml), 'removed');
  select(p, 'p2');
  eq([[44.5, 40.1]], drawn(ml), 'drawn again');
  eq([], errors);
});

test('map: highlight: survives setFeatures re-draws (place moved, place gone and back)', () => {
  const { p, ml } = boot();
  setFeatures(p, fc(P1, P2));
  select(p, 'p1');
  eq([[44.5, 39.9]], drawn(ml), 'drawn');
  setFeatures(p, fc(['p1', 44.6, 39.95], P3));
  eq([[44.6, 39.95]], drawn(ml), 'follows the place after a re-draw that moved it');
  setFeatures(p, fc(P2));
  eq([], drawn(ml), 'the place is not among the features any more: nothing is drawn');
  setFeatures(p, fc(P1));
  eq([[44.5, 39.9]], drawn(ml), 'the selection is kept: the ring is back when the place is');
});

test('map: highlight: survives base-map switches (Map to satellite and back)', () => {
  const { p, ml, switchBasemap } = boot();
  setFeatures(p, fc(P1, P2));
  select(p, 'p1');
  eq([[44.5, 39.9]], drawn(ml), 'drawn');
  switchBasemap('sat1');
  eq([[44.5, 39.9]], drawn(ml), 'still drawn on the satellite map');
  setFeatures(p, fc(P1, P3));
  eq([[44.5, 39.9]], drawn(ml), 'and after a re-draw on the satellite map');
  switchBasemap('');
  eq([[44.5, 39.9]], drawn(ml), 'still drawn back on the vector map');
});

test('map: highlight: an id that is not among the features draws nothing and does not throw', () => {
  const { p, ml, errors } = boot();
  select(p, 'ghost');
  eq([], drawn(ml), 'no features at all yet');
  setFeatures(p, fc(P1));
  eq([], drawn(ml), 'features without that id');
  select(p, 'p1', 'ghost');
  eq([[44.5, 39.9]], drawn(ml), 'a known id draws');
  select(p, 'ghost', 'p1');
  eq([], drawn(ml), 'an unknown id removes the previous ring and draws nothing');
  eq([], errors, 'no handler threw');
});

test('map: highlight: a selection made before the features or before the map is ready is drawn when they arrive', () => {
  const a = boot();
  select(a.p, 'p1');
  eq([], drawn(a.ml), 'selected, no features yet');
  setFeatures(a.p, fc(P1, P2));
  eq([[44.5, 39.9]], drawn(a.ml), 'drawn when the features arrive');
  eq([], a.errors);
  const b = boot({ ready: false });
  setFeatures(b.p, fc(P1, P2));
  select(b.p, 'p2');
  b.ml.fire('load');
  eq([[44.5, 40.1]], drawn(b.ml), 'drawn when the map has loaded');
  eq([], b.errors, 'nothing touched the map before its style was loaded');
});

test('map: highlight: reads AHM.state only for the selection, calls no sidebar code and emits nothing of its own', () => {
  const { p, ml, errors, switchBasemap } = boot({
    before: (page) =>
      page.X(`
        globalThis.__reads = [];
        globalThis.__emitted = [];
        AHM.state = {
          get: (k) => (__reads.push(['get', k]), null),
          set: (k) => __reads.push(['set', k]),
          patch: (k) => __reads.push(['patch', k]),
        };
        const __emit = AHM.emit.bind(AHM);
        AHM.emit = (n, d) => (__emitted.push(n), __emit(n, d));
      `),
  });
  setFeatures(p, fc(P1, P2));
  select(p, 'p1');
  eq([[44.5, 39.9]], drawn(ml), 'the highlight works');
  select(p, 'ghost', 'p1');
  select(p, null, 'ghost');
  switchBasemap('sat1');
  setFeatures(p, fc(P2));
  const reads = p.X('__reads');
  ok(reads.every(([how, key]) => how === 'get' && key === 'selected'), 'AHM.state used: ' + JSON.stringify(reads));
  eq([], p.X('__emitted').filter((n) => n !== 'state:selected' && n !== 'map:ready'), 'no event of its own');
  eq([], errors, 'no call to a name that does not exist in a map-only page (the sidebar)');
});

test('map: highlight: adds no AHM.map command (INTERFACES.md I-2 stays as it is)', () => {
  const { p } = boot();
  eq(
    ['editPin', 'fitRoute', 'fitTo', 'focusPlace', 'focusPoint', 'getSymbols', 'getZoom', 'hideMenu', 'hidePlace', 'resize', 'setFeatures', 'setPick', 'setRoute', 'setRouteMarkers', 'setTypes', 'showMenu'], // getSymbols and setTypes: I-8, types dictionary
    p.X('Object.keys(AHM.map).sort()'),
  );
});

// ====================================================================================================================
// Task 008: map markers (selected look, hover, tooltip, double click, clusters), written first (TDD) from
// tasks/008-map-marker-ux.md. Red until `map-dev: task 008` is done. Real MapLibre is not available here, so the
// tests use a richer recording stand-in (makeUx, built on makeMapLibre) and a fake clock. Where the spec leaves the
// drawing to the implementer, this is what a test can observe (the dev may pick any look inside these limits):
//   Selected look (point 5; as built on 2026-11-09): every layer whose source is `ahm-highlight` belongs to it. It is one
//     symbol layer that draws the place's own type symbol in its `-hl` variant (the white border and the hair-line dark
//     edge are part of the icon, see typeicons.js; icon-image from properties.type_code), about 25% larger (icon-size
//     SEL_SCALE, with the zoom steps of the other symbols), icon-allow-overlap and icon-ignore-placement. The source's
//     Point feature carries the properties of the place. Only neutral colours (no accent, no #ff9f1c); one paint
//     `*-transition` of 100-200 ms; the layer is added after every layer of the sources `ahm-places` and `ahm-label-src`;
//     its id starts with `ahm-`.
//   Clusters (point 21): the source `ahm-places` has cluster true, clusterRadius 50, clusterMaxZoom 11; both numbers are
//     constants in the first 40 lines of map.js (names contain CLUSTER and RADIUS / ZOOM). The selected place is NOT in
//     that source's data (so it is never inside a bubble; it is drawn from `ahm-highlight`); `ahm-label-src` keeps all
//     places. Layers: `ahm-clusters` (circle, filter on point_count, radius = a 3-step `step` expression, neutral dark
//     circle-color) and `ahm-cluster-count` (symbol, text-field from point_count, white text). `ahm-places` and
//     `ahm-halo` get a filter that excludes clusters (point_count); hidePlace keeps its filter on top of that.
//   Hover (point 6): events are the layer events `mouseenter` / `mouseleave` of `ahm-places`, `ahm-clusters` and of the
//     selected symbol layer. A hovered place is redrawn by the layer `ahm-hover-symbol` (source `ahm-hover`, one Point;
//     the `-hl` symbol: a larger marker with a white border), a hovered bubble gets a lighter `circle-color` expression
//     that names its cluster_id; both are restored on leave; the cursor is 'pointer' on the canvas. The selected place
//     is never lifted.
//   Tooltip (point 7): a Popup at the place's coordinates (not at the mouse) with no fixed `anchor` (the library picks
//     the side that keeps it inside the map) and `offset` = symbol radius of TYPE_STYLE[type_code or settlement] x the
//     zoom scale of the symbols (x SEL_SCALE for the selected place) + TIP_GAP + 4 px; one active popup at a time;
//     removed on leave and on the map event `movestart`.
//   Clicks: the map's generic `click` and `dblclick` events. A click on a place emits place:click only after the
//     double-click window (setTimeout), a double click cancels it. A bubble click zooms to getClusterExpansionZoom of
//     the source `ahm-places` (easeTo / flyTo with center and that zoom) and emits neither place:* nor map:click.
//     The selected symbol layer answers clicks, double clicks and hover like `ahm-places` does.
const fs = require('fs');
const path = require('path');
const MAP_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'js', 'map', 'map.js'), 'utf8');
const SPLIT_ZOOM = 9; // what the stand-in's getClusterExpansionZoom answers
const PLACES = 'ahm-places';
const CLUSTERS = 'ahm-clusters';
const CLUSTER_COUNT = 'ahm-cluster-count';

const json = (x) => JSON.stringify(x === undefined ? null : x);
const NAMED = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };
/** '#abc', '#aabbcc', 'rgb(...)', 'rgba(...)', 'white' ... -> [r, g, b, a] (null when it is not a plain colour). */
function rgba(c) {
  if (typeof c !== 'string') return null;
  const s = c.trim().toLowerCase();
  if (NAMED[s]) return NAMED[s];
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16)).concat(1);
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const v = m[1].split(',').map(Number);
    return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
  }
  return null;
}
const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const neutral = (c) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) <= 30;
/** Every plain colour that appears anywhere in x (a layer, a paint value, an expression). */
const colorsIn = (x) =>
  (json(x).match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|"(?:white|black)"/gi) || []).map((s) => rgba(s.replace(/"/g, ''))).filter(Boolean);

const layer = (rec, id) => rec.layers.find((l) => l.id === id);
const orderOf = (rec, id) => rec.layers.findIndex((l) => l.id === id);
const selLayers = (rec) => rec.layers.filter((l) => l.source === HL);
const selSymbol = (rec) => selLayers(rec).find((l) => l.type === 'symbol');
const active = (rec) => rec.popups.filter((x) => x.added);
const lngLatOf = (x) => (Array.isArray(x) ? x : [x.lng !== undefined ? x.lng : x.lon, x.lat]);
/** The popup's offset as {x, y} (distance away from the bullet), whatever form of MapLibre's `offset` option was used. */
function offsetOf(pop) {
  let o = pop.options.offset;
  if (o && typeof o === 'object' && !Array.isArray(o)) o = o[pop.options.anchor];
  if (Array.isArray(o)) return { x: o[0], y: Math.abs(o[1]) };
  return { x: 0, y: Math.abs(o) };
}
/** The ids of the places the hover look draws now (source ahm-hover). */
const lifted = (rec) => ((rec.sources['ahm-hover'].data || {}).features || []).map((f) => f.properties.id);
const flush = () => new Promise((r) => setTimeout(r, 0));

function makeClock() {
  let now = 0;
  let seq = 0;
  const q = [];
  return {
    now: () => now,
    setTimeout(fn, ms = 0) {
      const id = ++seq;
      q.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimeout(id) {
      const i = q.findIndex((t) => t.id === id);
      if (i >= 0) q.splice(i, 1);
    },
    tick(ms) {
      const end = now + ms;
      for (;;) {
        q.sort((a, b) => a.at - b.at || a.id - b.id);
        if (!q.length || q[0].at > end) break;
        const t = q.shift();
        now = Math.max(now, t.at);
        t.fn();
      }
      now = end;
    },
  };
}

/** makeMapLibre plus what task 008 needs: layer order with beforeId, source definitions, cluster zoom, popups that
 *  record their options, a canvas that keeps its cursor, hits for queryRenderedFeatures, recorded camera moves. */
function makeUx(glyphs) {
  const ml = makeMapLibre();
  const { rec } = ml;
  Object.assign(rec, { popups: [], hits: [], moves: [], zoomCalls: [], projectY: 300, canvas: { style: {}, clientWidth: 900, clientHeight: 700 } });
  const map = ml.maplibregl.Map();
  const addLayer0 = map.addLayer;
  const addSource0 = map.addSource;
  const getStyle0 = map.getStyle;
  Object.assign(map, {
    addLayer(def, before) {
      const at = before ? rec.layers.findIndex((l) => l.id === before) : -1;
      addLayer0(def);
      if (at >= 0) rec.layers.splice(at, 0, rec.layers.pop());
    },
    addSource(id, def) {
      addSource0(id, def);
      Object.assign(rec.sources[id], {
        def,
        getClusterExpansionZoom(cid, cb) {
          rec.zoomCalls.push(cid);
          if (typeof cb === 'function') cb(null, SPLIT_ZOOM);
          return Promise.resolve(SPLIT_ZOOM);
        },
      });
    },
    getStyle: () => (glyphs ? { ...getStyle0(), glyphs: 'stub://{fontstack}/{range}.pbf' } : getStyle0()),
    getCanvas: () => rec.canvas,
    getContainer: () => rec.canvas,
    queryRenderedFeatures: (pt, o) => rec.hits.filter((f) => !(o && o.layers) || o.layers.includes(f.layer.id)),
    project: () => ({ x: 300, y: rec.projectY }),
    easeTo: (o) => rec.moves.push({ how: 'easeTo', ...o }),
    flyTo: (o) => rec.moves.push({ how: 'flyTo', ...o }),
    jumpTo: (o) => rec.moves.push({ how: 'jumpTo', ...o }),
    zoomTo: (z, o) => rec.moves.push({ how: 'zoomTo', zoom: z, ...o }),
    fitBounds: (b, o) => rec.moves.push({ how: 'fitBounds', bounds: b, ...o }),
    isMoving: () => false,
  });
  ml.maplibregl.LngLatBounds = function (a, b) {
    const pts = [a, b].filter(Boolean);
    return { pts, extend(x) { pts.push(x); return this; } };
  };
  ml.maplibregl.Popup = function (options) {
    const pop = {
      options: { ...(options || {}) },
      added: false,
      html: '',
      lngLat: null,
      setLngLat(ll) { this.lngLat = ll; return this; },
      setHTML(h) { this.html = h; return this; },
      setText(t) { this.html = t; return this; },
      setOffset(o) { this.options.offset = o; return this; },
      setMaxWidth() { return this; },
      addClassName() { return this; },
      removeClassName() { return this; },
      trackPointer() { return this; },
      getLngLat() { return this.lngLat; },
      addTo() { this.added = true; return this; },
      remove() { this.added = false; return this; },
      isOpen() { return this.added; },
      getElement: () => ({ offsetHeight: 40, offsetWidth: 120 }),
    };
    rec.popups.push(pop);
    return pop;
  };
  return ml;
}

/** map.js (with typeicons.js, for TYPE_STYLE) in a page of its own, on the richer stand-in and a fake clock. */
function bootUx({ ready = true, glyphs = true } = {}) {
  const p = load(['typeicons.js', 'map.js']);
  const ml = makeUx(glyphs);
  const clock = makeClock();
  const errors = [];
  const events = [];
  Object.assign(p.ctx, {
    maplibregl: ml.maplibregl,
    AHM_CONFIG: CONFIG,
    esc: String,
    registerTypeIcons() {},
    overlaysInit() {},
    syncOverlays() {},
    shapesInit() {}, // shapes.js is not loaded here: no borders to draw
    shapeLineAt: () => null,
    shapesAt: () => [],
    shapeDrawing: null,
    performance: { now: () => 100000 + clock.now() }, // map.js times double clicks with it; a large start: lastDblAt = 0 means long ago
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    console: { log() {}, warn() {}, error: (...a) => errors.push(a.map(String).join(' ')) },
    __events: events,
  });
  p.X('{ const real = AHM.emit.bind(AHM); AHM.emit = (n, d) => (__events.push([n, JSON.parse(JSON.stringify(d === undefined ? null : d))]), real(n, d)); }');
  let onBasemap = null;
  p.el('#basemap').addEventListener = (name, fn) => {
    if (name === 'change') onBasemap = fn;
  };
  p.X('initMap()');
  if (ready) ml.fire('load');
  return {
    p,
    ml,
    rec: ml.rec,
    clock,
    errors,
    evs: (name) => events.filter(([n]) => n === name).map(([, d]) => d),
    switchBasemap: (value) => onBasemap({ target: { value } }),
  };
}

const hitPlace = (id, lon, lat, extra = {}, layerId = PLACES) => ({
  layer: { id: layerId },
  properties: { id, name: id, type: 'City', type_code: 'city', dates: '', halo: '', ...extra },
  geometry: { type: 'Point', coordinates: [lon, lat] },
});
const hitBubble = (cid, n, lon, lat) => ({
  id: cid,
  layer: { id: CLUSTERS },
  properties: { cluster: true, cluster_id: cid, point_count: n, point_count_abbreviated: String(n) },
  geometry: { type: 'Point', coordinates: [lon, lat] },
});
/** A map mouse event; the mouse is a little beside the bullet on purpose. */
const mouse = (f, y = 300) => {
  const c = f ? f.geometry.coordinates : [44.5, 40];
  return {
    features: f ? [f] : [],
    point: { x: 300, y },
    lngLat: { lng: c[0] + 0.02, lat: c[1] + 0.02 },
    prevented: 0,
    preventDefault() {
      this.prevented++;
    },
  };
};
const clickAt = (u, f) => {
  u.rec.hits = f ? [f] : [];
  const e = mouse(f);
  u.ml.fire('click', e);
  return e;
};
const dblAt = (u, f) => {
  u.rec.hits = f ? [f] : [];
  const e = mouse(f);
  u.ml.fire('dblclick', e);
  return e;
};
const enter = (u, layerId, f, y) => u.ml.fire('mouseenter:' + layerId, mouse(f, y));
const leave = (u, layerId) => u.ml.fire('mouseleave:' + layerId);

// ---- selected look (point 5) ------------------------------------------------------------------------------------

test('map: selected look: no orange ring and no accent colour; one symbol layer on ahm-highlight (the border is part of its icon)', () => {
  const { p, rec, errors } = bootUx();
  setFeatures(p, fc(P1, P2));
  select(p, 'p1');
  const mine = selLayers(rec);
  eq(['ahm-highlight-symbol'], mine.map((l) => l.id), 'the marker with its white border is the only layer of the selected look');
  ok(mine.every((l) => l.id.startsWith('ahm-')), 'ids start with ahm- (applyVis leaves them alone)');
  ok(!/ff9f1c/i.test(json(mine)), 'the orange stroke #ff9f1c is gone');
  ok(colorsIn(mine).every(neutral), 'no accent colour: ' + json(colorsIn(mine)));
  eq([], errors);
});

test('map: selected look: the place symbol is drawn about 25% larger, in a layer that never drops it', () => {
  const { p, rec, ml } = bootUx();
  const c = fc(P1, P3);
  c.features[1].properties.type_code = 'mountain';
  setFeatures(p, c);
  select(p, 'p3');
  const sym = selSymbol(rec);
  ok(sym, 'a symbol layer on the ahm-highlight source');
  const size = sym.layout && sym.layout['icon-size'];
  const full = Array.isArray(size) ? size[size.length - 1] : size; // the size at the last zoom step = full size
  ok(typeof full === 'number' && full >= 1.2 && full <= 1.35, 'icon-size about 1.25 at full size, got ' + json(size));
  const img = json(sym.layout['icon-image']);
  ok(img.includes('ahm-type-') && img.includes('type_code'), 'the place type symbol: ' + img);
  ok(img.includes('-hl'), 'the variant with the white border: ' + img);
  eq(true, sym.layout['icon-allow-overlap'], 'no gaps from collisions');
  eq(true, sym.layout['icon-ignore-placement'], 'no gaps from collisions');
  const f = ring(ml)[0];
  eq('p3', f.properties.id);
  eq('mountain', f.properties.type_code, 'the feature carries the type of the place');
});

test('map: selected look: drawn above labels and all other symbols, at every zoom', () => {
  const { p, rec } = bootUx();
  setFeatures(p, fc(P1, P2));
  select(p, 'p1');
  const lowest = Math.min(...selLayers(rec).map((l) => orderOf(rec, l.id)));
  const below = rec.layers.filter((l) => l.source === PLACES || l.source === 'ahm-label-src');
  ok(below.length >= 3, 'halo, symbols and labels exist: ' + below.map((l) => l.id));
  ok(
    below.every((l) => orderOf(rec, l.id) < lowest),
    'the selected look is above ' + below.map((l) => l.id + '@' + orderOf(rec, l.id)) + ' (lowest of its own: ' + lowest + ')',
  );
});

test('map: selected look: the white border and the dark edge come with the icon (-hl variant of the type symbol), no extra circle layers', () => {
  const { p, rec } = bootUx();
  setFeatures(p, fc(P1, P2));
  select(p, 'p1');
  const mine = selLayers(rec);
  ok(mine.every((l) => l.type === 'symbol'), 'symbol layers only: ' + mine.map((l) => l.id + ':' + l.type));
  ok(json(selSymbol(rec).layout['icon-image']).includes('-hl'), 'icon-image is the -hl variant');
});

test('map: selected look: changes with a short transition of about 150 ms', () => {
  const { rec } = bootUx();
  const fades = selLayers(rec).filter((l) =>
    Object.entries(l.paint || {}).some(([k, v]) => /-transition$/.test(k) && v && v.duration >= 100 && v.duration <= 200),
  );
  ok(fades.length, 'a paint property of the selected look has a transition of 100-200 ms');
});

test('map: selected look: the new layers survive base-map switches and re-draws (none is hidden)', () => {
  const { p, rec, ml, switchBasemap } = bootUx();
  setFeatures(p, fc(P1, P2));
  select(p, 'p1');
  const visible = () =>
    rec.layers.filter((l) => [PLACES, 'ahm-label-src', HL].includes(l.source)).every((l) => !(l.layout && l.layout.visibility === 'none'));
  switchBasemap('sat1');
  ok(visible(), 'visible on the satellite map');
  setFeatures(p, fc(P1, P3));
  switchBasemap('');
  ok(visible(), 'visible after a re-draw and back on the vector map');
  eq([[44.5, 39.9]], ring(ml).map((f) => f.geometry.coordinates));
});

// ---- clusters (point 21) ----------------------------------------------------------------------------------------

test('map: clusters: ahm-places is a clustered GeoJSON source (radius 50, none from zoom 12); labels and selection are not', () => {
  const { rec } = bootUx();
  const def = rec.sources[PLACES].def;
  eq('geojson', def.type);
  eq(true, def.cluster, 'cluster: true');
  eq(50, def.clusterRadius);
  eq(11, def.clusterMaxZoom, 'clusters up to zoom 11, none from zoom 12');
  ok(!rec.sources['ahm-label-src'].def.cluster, 'labels are not clustered');
  ok(!rec.sources[HL].def.cluster, 'the selected place is not clustered');
});

test('map: clusters: radius and last clustered zoom are named constants at the top of map.js', () => {
  const top = MAP_SRC.split('\n').slice(0, 40).join('\n');
  ok(/^\s*(const|let)\s+\w*CLUSTER\w*RADIUS\w*\s*=\s*50\b/im.test(top), 'const ...CLUSTER...RADIUS... = 50 in the first 40 lines');
  ok(/^\s*(const|let)\s+\w*CLUSTER\w*ZOOM\w*\s*=\s*(11|12)\b/im.test(top), 'const ...CLUSTER...ZOOM... = 11 (or 12) in the first 40 lines');
  ok(!/clusterRadius\s*:\s*\d/.test(MAP_SRC), 'clusterRadius is given by the constant, not a literal');
  ok(!/clusterMaxZoom\s*:\s*\d/.test(MAP_SRC), 'clusterMaxZoom is given by the constant, not a literal');
});

test('map: clusters: the selected place is never inside a bubble (it leaves the clustered data, labels keep all)', () => {
  const { p, rec, errors } = bootUx();
  const ids = (src) => ((rec.sources[src].data || {}).features || []).map((f) => f.properties.id).sort();
  setFeatures(p, fc(P1, P2, P3));
  eq(['p1', 'p2', 'p3'], ids(PLACES), 'nothing selected: all places are clustered');
  select(p, 'p2');
  eq(['p1', 'p3'], ids(PLACES), 'p2 is drawn by the selected look, not by the cluster source');
  eq(['p1', 'p2', 'p3'], ids('ahm-label-src'), 'the labels keep every place');
  select(p, 'p1', 'p2');
  eq(['p2', 'p3'], ids(PLACES), 'the selection moved: p2 is back, p1 is out');
  select(p, 'ghost', 'p1');
  eq(['p1', 'p2', 'p3'], ids(PLACES), 'an unknown id removes nothing');
  select(p, null, 'ghost');
  eq(['p1', 'p2', 'p3'], ids(PLACES));
  select(p, 'p3');
  setFeatures(p, fc(P1, P2, P3));
  eq(['p1', 'p2'], ids(PLACES), 'a re-draw keeps the selected place out');
  eq([], errors);
});

test('map: clusters: bubbles are 3 size steps, neutral dark, with a white count; halos and symbols leave clusters alone', () => {
  const { rec } = bootUx();
  const b = layer(rec, CLUSTERS);
  ok(b && b.type === 'circle', 'a circle layer ahm-clusters');
  eq(PLACES, b.source);
  ok(json(b.filter).includes('point_count'), 'only clusters: ' + json(b.filter));
  const r = b.paint['circle-radius'];
  ok(Array.isArray(r) && r[0] === 'step', 'circle-radius is a step expression: ' + json(r));
  eq(7, r.length, 'three sizes: step, input, size, stop, size, stop, size');
  ok(typeof r[2] === 'number' && r[2] < r[4] && r[4] < r[6], 'sizes grow: ' + json([r[2], r[4], r[6]]));
  ok(r[3] < r[5], 'the stops grow too');
  const cols = colorsIn(b.paint['circle-color']);
  ok(cols.length && cols.every(neutral) && cols.some((c) => lum(c) < 0.4), 'neutral dark colour: ' + json(b.paint['circle-color']));
  const n = layer(rec, CLUSTER_COUNT);
  ok(n && n.type === 'symbol', 'a symbol layer ahm-cluster-count');
  eq(PLACES, n.source);
  ok(json(n.layout['text-field']).includes('point_count'), 'the count: ' + json(n.layout['text-field']));
  const tc = rgba((n.paint || {})['text-color']);
  ok(tc && tc[0] === 255 && tc[1] === 255 && tc[2] === 255, 'white count');
  ok(orderOf(rec, CLUSTER_COUNT) > orderOf(rec, CLUSTERS), 'the count is above the bubble');
  ok(json(layer(rec, PLACES).filter).includes('point_count'), 'ahm-places draws no cluster: ' + json(layer(rec, PLACES).filter));
  ok(json(layer(rec, 'ahm-halo').filter).includes('point_count'), 'ahm-halo draws no cluster: ' + json(layer(rec, 'ahm-halo').filter));
});

test('map: clusters: hidePlace, focusPlace and fitTo keep working', () => {
  const { p, rec } = bootUx();
  setFeatures(p, fc(P1, P2, P3));
  select(p, 'p2');
  p.X("AHM.map.hidePlace('p1')");
  ok(json(layer(rec, PLACES).filter).includes('"p1"'), 'hidden in the symbols');
  ok(json(layer(rec, PLACES).filter).includes('point_count'), 'and still no clusters among the symbols');
  ok(json(layer(rec, 'ahm-labels').filter).includes('"p1"'), 'hidden in the labels');
  p.X('AHM.map.hidePlace(null)');
  ok(!json(layer(rec, PLACES).filter).includes('p1'), 'shown again');
  ok(json(layer(rec, PLACES).filter).includes('point_count'), 'cluster filter stays');
  ok(!json(layer(rec, 'ahm-labels').filter).includes('p1'), 'labels shown again');
  p.X("AHM.map.focusPlace('p2')");
  const fly = rec.moves.filter((m) => m.how === 'flyTo');
  eq(1, fly.length, 'focusPlace of the selected place (it is not in the cluster data)');
  eq([44.5, 40.1], lngLatOf(fly[0].center));
  eq(7, fly[0].zoom, 'a double click only moves the map: the zoom stays');
  p.X('AHM.map.fitTo(__0)', [[44.1, 39.5], [44.9, 40.5]]);
  eq(1, rec.moves.filter((m) => m.how === 'fitBounds').length);
});

test('map: clusters: hovering a bubble makes it lighter and the cursor a pointer; restored on leave; no tooltip', () => {
  const u = bootUx();
  const { rec } = u;
  setFeatures(u.p, fc(P1, P2));
  const rest = json(layer(rec, CLUSTERS).paint['circle-color']);
  enter(u, CLUSTERS, hitBubble(31337, 5, 44.5, 40));
  eq('pointer', rec.canvas.style.cursor);
  const hov = json(layer(rec, CLUSTERS).paint['circle-color']);
  ok(hov.includes('31337'), 'the colour expression names the hovered cluster_id: ' + hov);
  const top = (s) => Math.max(...colorsIn(s).map(lum));
  ok(top(hov) > top(rest), 'lighter: ' + top(hov) + ' vs ' + top(rest));
  eq(0, active(rec).length, 'a bubble has no tooltip');
  leave(u, CLUSTERS);
  eq(rest, json(layer(rec, CLUSTERS).paint['circle-color']), 'restored');
  eq('', rec.canvas.style.cursor);
});

test('map: clusters: click on a bubble zooms to where it splits; no place:click, no map:click', async () => {
  const u = bootUx();
  const { rec } = u;
  setFeatures(u.p, fc(P1, P2));
  clickAt(u, hitBubble(31337, 5, 44.5, 40));
  await flush();
  u.clock.tick(1000);
  eq([31337], rec.zoomCalls, 'getClusterExpansionZoom of the clicked cluster');
  const mv = rec.moves.filter((m) => m.center);
  ok(mv.length >= 1, 'the camera moved');
  eq(SPLIT_ZOOM, mv[mv.length - 1].zoom);
  eq([44.5, 40], lngLatOf(mv[mv.length - 1].center));
  eq([], u.evs('place:click'));
  eq([], u.evs('place:dblclick'));
  eq([], u.evs('map:click'), 'a bubble is not empty map');
});

test('map: clusters: double click on a bubble zooms too and cancels the map zoom; no place events', async () => {
  const u = bootUx();
  const { rec } = u;
  setFeatures(u.p, fc(P1, P2));
  const b = hitBubble(31337, 5, 44.5, 40);
  clickAt(u, b);
  u.clock.tick(100);
  clickAt(u, b);
  const e = dblAt(u, b);
  await flush();
  u.clock.tick(1000);
  eq(1, e.prevented, 'the default double-click zoom is cancelled');
  ok(rec.moves.some((m) => m.center && m.zoom === SPLIT_ZOOM), 'zoomed to where the bubble splits');
  eq([], u.evs('place:click'));
  eq([], u.evs('place:dblclick'));
});

// ---- hover (point 6) --------------------------------------------------------------------------------------------

test('map: hover: a hovered place is redrawn larger with its white border (layer ahm-hover-symbol), the cursor a pointer; restored on leave', () => {
  const u = bootUx();
  const { rec } = u;
  setFeatures(u.p, fc(P1, P2));
  const sym = layer(rec, 'ahm-hover-symbol');
  ok(sym && sym.type === 'symbol' && sym.source === 'ahm-hover', 'a symbol layer ahm-hover-symbol on its own source');
  ok(json(sym.layout['icon-image']).includes('-hl'), 'the variant with the white border');
  eq([], lifted(rec), 'nothing lifted at rest');
  enter(u, PLACES, hitPlace('p1', 44.5, 39.9));
  eq('pointer', rec.canvas.style.cursor);
  eq(['p1'], lifted(rec), 'p1 lifted');
  enter(u, PLACES, hitPlace('p2', 44.5, 40.1));
  eq(['p2'], lifted(rec), 'only the place under the mouse is lifted');
  leave(u, PLACES);
  eq([], lifted(rec), 'restored');
  eq('', rec.canvas.style.cursor);
});

test('map: hover: not applied on top of the selected look (hover the selected place, or select the hovered one)', () => {
  const u = bootUx();
  const { p, rec } = u;
  setFeatures(p, fc(P1, P2));
  select(p, 'p1');
  const sym = selSymbol(rec);
  ok(sym, 'the selected symbol layer');
  enter(u, sym.id, hitPlace('p1', 44.5, 39.9, {}, sym.id));
  eq('pointer', rec.canvas.style.cursor, 'the selected place still shows the pointer');
  eq([], lifted(rec), 'but it is not lifted');
  leave(u, sym.id);
  eq('', rec.canvas.style.cursor);
  enter(u, PLACES, hitPlace('p2', 44.5, 40.1));
  eq(['p2'], lifted(rec), 'p2 hovered and lifted');
  select(p, 'p2', 'p1');
  eq([], lifted(rec), 'p2 got selected under the mouse: no lift on top of the selected look');
});

test('map: hover: still right after setFeatures', () => {
  const u = bootUx();
  const { p, rec } = u;
  setFeatures(p, fc(P1, P2));
  enter(u, PLACES, hitPlace('p1', 44.5, 39.9));
  setFeatures(p, fc(['p1', 44.6, 39.95], P3));
  eq(['p1'], lifted(rec), 'p1 is still the lifted place after the re-draw');
  leave(u, PLACES);
  eq([], lifted(rec), 'restored');
  eq('', rec.canvas.style.cursor);
});

// ---- tooltip (point 7) ------------------------------------------------------------------------------------------

test('map: tooltip: name and type of the place, at the place and not at the mouse, no fixed side', () => {
  const u = bootUx();
  const { rec } = u;
  setFeatures(u.p, fc(P1, P2));
  enter(u, PLACES, hitPlace('p1', 44.5, 39.9));
  const pop = active(rec);
  eq(1, pop.length, 'one popup');
  ok(pop[0].html.includes('p1') && pop[0].html.includes('City'), 'name and type: ' + pop[0].html);
  eq([44.5, 39.9], lngLatOf(pop[0].lngLat), 'anchored at the place, not at the mouse');
  eq(undefined, pop[0].options.anchor, 'no fixed anchor: the library picks the side that keeps the tooltip inside the map');
  eq(0, offsetOf(pop[0]).x, 'centred');
});

test('map: tooltip: offset is the marker radius of the place type, scaled like the symbol, plus the gap (it never covers the bullet)', () => {
  const u = bootUx();
  const { p, rec } = u;
  setFeatures(p, fc(P1));
  const seen = new Set();
  for (const code of ['city', 'village', 'mountain', 'zzz']) {
    const want = p.X("(TYPE_STYLE['" + code + "'] || TYPE_STYLE.settlement).r * zoomScale(map.getZoom()) + TIP_GAP + 4");
    enter(u, PLACES, hitPlace('p1', 44.5, 39.9, { type_code: code }));
    const pop = active(rec);
    eq(1, pop.length, code);
    eq(want, offsetOf(pop[0]).y, 'offset for type ' + code);
    seen.add(want);
    leave(u, PLACES);
  }
  ok(seen.size >= 3, 'the offsets differ between types, so the offset cannot be one constant');
});

test('map: tooltip: no fixed anchor, so the library keeps it inside the map (above, below or beside the bullet)', () => {
  const u = bootUx();
  const { rec } = u;
  setFeatures(u.p, fc(P1));
  enter(u, PLACES, hitPlace('p1', 44.5, 39.9), 4);
  eq(undefined, active(rec)[0].options.anchor, 'bullet at the top edge');
  leave(u, PLACES);
  enter(u, PLACES, hitPlace('p1', 44.5, 39.9), 500);
  eq(undefined, active(rec)[0].options.anchor, 'room above');
});

test('map: tooltip: one popup at a time; it closes on leave and when the map starts moving', () => {
  const u = bootUx();
  const { rec, ml } = u;
  setFeatures(u.p, fc(P1, P2));
  enter(u, PLACES, hitPlace('p1', 44.5, 39.9));
  enter(u, PLACES, hitPlace('p2', 44.5, 40.1));
  eq(1, active(rec).length, 'entering another place without leaving: still one popup');
  eq([44.5, 40.1], lngLatOf(active(rec)[0].lngLat), 'and it is the new one');
  leave(u, PLACES);
  eq(0, active(rec).length, 'closed on leave');
  leave(u, PLACES);
  enter(u, PLACES, hitPlace('p1', 44.5, 39.9));
  eq(1, active(rec).length);
  ml.fire('movestart');
  eq(0, active(rec).length, 'closed when the map starts moving');
});

// ---- double click (point 4, map half) ---------------------------------------------------------------------------

test('map: double click: a single click on a place emits place:click once, after the double-click window', () => {
  const u = bootUx();
  setFeatures(u.p, fc(P1, P2));
  const f = hitPlace('p1', 44.5, 39.9);
  clickAt(u, f);
  u.clock.tick(1000);
  eq([{ id: 'p1' }], u.evs('place:click'));
  clickAt(u, f);
  u.clock.tick(1000);
  eq(2, u.evs('place:click').length, 'two slow clicks are two clicks');
  eq([], u.evs('place:dblclick'));
});

test('map: double click: on a place symbol or label: place:dblclick once, no place:click, the map zoom is cancelled', () => {
  for (const layerId of [PLACES, 'ahm-labels']) {
    const u = bootUx();
    setFeatures(u.p, fc(P1, P2));
    const f = hitPlace('p1', 44.5, 39.9, {}, layerId);
    clickAt(u, f);
    u.clock.tick(100);
    clickAt(u, f);
    const e = dblAt(u, f);
    u.clock.tick(1000);
    eq([{ id: 'p1' }], u.evs('place:dblclick'), 'emitted exactly once (' + layerId + ')');
    eq([], u.evs('place:click'), 'no place:click for the two clicks of a double click (' + layerId + ')');
    eq(1, e.prevented, 'the default double-click zoom is cancelled (' + layerId + ')');
    eq([], u.errors);
  }
});

test('map: double click: on empty map the normal zoom stays; a single click is still map:click', () => {
  const u = bootUx();
  setFeatures(u.p, fc(P1));
  clickAt(u, null);
  u.clock.tick(1000);
  const one = u.evs('map:click');
  eq(1, one.length, 'one click on empty map, one map:click');
  ok(Math.abs(one[0].lon - 44.52) < 1e-9 && Math.abs(one[0].lat - 40.02) < 1e-9, 'with the position: ' + json(one[0]));
  clickAt(u, null);
  u.clock.tick(100);
  clickAt(u, null);
  const e = dblAt(u, null);
  u.clock.tick(1000);
  eq(0, e.prevented, 'the default zoom is not cancelled on empty map');
  eq([], u.evs('place:dblclick'));
  eq([], u.evs('place:click'));
});

test('map: selected place: its own layer answers click, double click and hover (it is not in the cluster source)', () => {
  const u = bootUx();
  const { p, rec } = u;
  setFeatures(p, fc(P1, P2));
  select(p, 'p2');
  const sym = selSymbol(rec);
  ok(sym, 'the selected symbol layer');
  const f = hitPlace('p2', 44.5, 40.1, {}, sym.id);
  clickAt(u, f);
  u.clock.tick(1000);
  eq([{ id: 'p2' }], u.evs('place:click'), 'click on the selected place');
  clickAt(u, f);
  u.clock.tick(100);
  clickAt(u, f);
  const e = dblAt(u, f);
  u.clock.tick(1000);
  eq([{ id: 'p2' }], u.evs('place:dblclick'), 'double click on the selected place');
  eq(1, e.prevented);
  eq(1, u.evs('place:click').length, 'still only the first single click');
  enter(u, sym.id, f);
  eq('pointer', rec.canvas.style.cursor);
  eq(1, active(rec).length, 'tooltip on the selected place');
  eq(p.X('(TYPE_STYLE.city || TYPE_STYLE.settlement).r * SEL_SCALE * zoomScale(map.getZoom()) + TIP_GAP + 4'), offsetOf(active(rec)[0]).y, 'clear of the (larger) selected symbol');
});

// ---- types dictionary (INTERFACES.md I-8) ----
const TYPES_DICT = [
  { code: 'city', geometry: 'point', names: [{ lang: 'en', name: 'City' }, { lang: 'ru', name: 'Город' }], color: '#b3261e', style: { symbol: 'circle', size: 10 } },
  { code: 'iron-mine', geometry: 'point', names: [{ lang: 'ru', name: 'Рудник' }, { lang: 'hy', name: 'Հանք' }], color: '#a0522d', style: { symbol: 'pickaxe', size: 9 } },
  { code: 'odd', geometry: 'point', names: [{ lang: 'en', name: 'Odd' }], color: 'red', style: { symbol: 'no-such-symbol', size: 99 } },
  { code: 'border', geometry: 'line', names: [{ lang: 'en', name: 'Border' }], color: '#000000', style: {} },
];

test('types: setTypeStyles rebuilds the table from point types; bad symbol, colour and size fall back, settlement stays', () => {
  const p = load(['typeicons.js']);
  p.X('setTypeStyles(__0)', TYPES_DICT);
  const st = J(p.X('TYPE_STYLE'));
  eq(['city', 'iron-mine', 'odd', 'settlement'], Object.keys(st).sort(), 'line types are not markers');
  eq({ shape: 'pickaxe', color: '#a0522d', r: 9 }, st['iron-mine']);
  eq('circle', st.odd.shape, 'unknown symbol is drawn as a circle');
  ok(/^#[0-9a-f]{6}$/i.test(st.odd.color), 'bad colour replaced');
  ok(st.odd.r >= 4 && st.odd.r <= 14, 'bad size replaced');
  p.X('setTypeStyles(__0)', [TYPES_DICT[1]]);
  eq(['iron-mine', 'settlement'], Object.keys(J(p.X('TYPE_STYLE'))).sort(), 'settlement is always there as the fallback');
});

test('types: getSymbols lists the symbols the map can draw, every one has a shape', () => {
  const p = load(['typeicons.js', 'map.js']);
  const syms = J(p.X('AHM.map.getSymbols()'));
  const names = syms.map((s) => s.name);
  for (const n of ['circle', 'tree', 'sword', 'pickaxe', 'flag', 'star']) ok(names.includes(n), n);
  ok(syms.every((s) => s.label && p.X('typeof SHAPES[__0]', s.name) === 'function'), 'label and shape for each');
});

test('types: AHM.map.setTypes before the map is ready only updates the table (icons are made on load)', () => {
  const p = load(['typeicons.js', 'map.js']);
  p.X('AHM.map.setTypes(__0)', TYPES_DICT);
  ok(p.X('"iron-mine" in TYPE_STYLE'));
});

test('types: a custom symbol keeps its SVG path and box; a bad path or box falls back (circle, box 24)', () => {
  const p = load(['typeicons.js']);
  const mk = (code, st) => ({ code, geometry: 'point', names: [{ lang: 'en', name: code }], color: '#2e7d32', style: { size: 9, ...st } });
  p.X('setTypeStyles(__0)', [
    mk('cedar', { symbol: 'custom', path: 'M256 10 L500 500 H10 z', box: 512 }),
    mk('nobox', { symbol: 'custom', path: 'M0 0 L5 5 Z' }),
    mk('evil', { symbol: 'custom', path: 'M0 0 <script>alert(1)</script>' }),
    mk('plain', { symbol: 'star', path: 'M0 0 L5 5 Z' }),
  ]);
  const st = J(p.X('TYPE_STYLE'));
  eq({ shape: 'circle', color: '#2e7d32', r: 9, path: 'M256 10 L500 500 H10 z', box: 512 }, st.cedar);
  eq(24, st.nobox.box, 'box defaults to 24');
  ok(!('path' in st.evil) && st.evil.shape === 'circle', 'markup in a path is never used');
  ok(!('path' in st.plain), 'a path of a type that is not custom is ignored');
});

// ---- the drawing of types: a canvas, Path2D and DOMMatrix of the page are stood in for ----
function iconPage(withPath2D = true) {
  const p = load(['typeicons.js']),
    log = [];
  p.ctx.document = {
    createElement() {
      const c = {
        width: 0,
        height: 0,
        toDataURL: () => 'data:image/png;base64,FAKE' + log.length,
        getContext: () =>
          new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => log.push([k, ...a])), set: (t, k, v) => ((t[k] = v), true) }),
      };
      log.push(['canvas']);
      return c;
    },
  };
  if (withPath2D) {
    p.ctx.Path2D = class {
      constructor(d) {
        this.d = d;
        this.added = [];
      }
      addPath(path, m) {
        this.added.push([path, m]);
      }
    };
    p.ctx.DOMMatrix = class {
      constructor(a) {
        this.a = a;
      }
    };
  }
  return { p, log };
}
const CEDAR = { code: 'cedar', geometry: 'point', names: [{ lang: 'en', name: 'Cedar' }], color: '#2e7d32', style: { symbol: 'custom', size: 9, path: 'M256 10 L500 500 H10 z', box: 512 } };

test('types: a custom symbol is stroked and filled as one Path2D of its path, scaled from its box and centred', () => {
  const { p, log } = iconPage();
  p.X('setTypeStyles(__0)', [CEDAR]);
  p.X('iconCanvas("cedar", 28, 2)');
  const drawn = log.filter((l) => (l[0] === 'stroke' || l[0] === 'fill') && l[1]);
  ok(drawn.length >= 3, 'stroke twice and fill once with a path: ' + drawn.length);
  const path = drawn[0][1];
  eq('object', typeof path);
  const [inner, m] = path.added[0];
  eq('M256 10 L500 500 H10 z', inner.d, 'the path of the type');
  const k = (9 * 1 * 2.3) / 512; // r 9, f = px / 28 = 1
  eq([k, 0, 0, k, -256 * k, -256 * k], m.a, 'scaled so the box fills about 2.3 radii, centred on 0,0');
  ok(drawn.every((l) => l[1] === path), 'every stroke and the fill use the same path');
});

test('types: without Path2D a custom symbol is a circle (stroke and fill without a path)', () => {
  const { p, log } = iconPage(false);
  p.X('setTypeStyles(__0)', [CEDAR]);
  p.X('iconCanvas("cedar", 28, 2)');
  ok(log.some((l) => l[0] === 'arc'), 'a circle is drawn');
  ok(log.filter((l) => l[0] === 'stroke' || l[0] === 'fill').every((l) => l.length === 1), 'no path argument');
});

test('types: a type that is not custom is drawn from its shape, never from a path', () => {
  const { p, log } = iconPage();
  p.X('setTypeStyles(__0)', [{ ...CEDAR, style: { symbol: 'star', size: 9, path: 'M0 0 L1 1' } }]);
  p.X('iconCanvas("cedar", 28, 2)');
  ok(log.filter((l) => l[0] === 'stroke' || l[0] === 'fill').every((l) => l.length === 1), 'no path argument');
});

test('types: typeIcon gives an <img> with a data URL; it is made once per type, again after the dictionary changed; a draft is never cached', () => {
  const { p, log } = iconPage();
  const canvases = () => log.filter((l) => l[0] === 'canvas').length;
  p.X('setTypeStyles(__0)', [CEDAR]);
  const a = p.X('typeIcon("cedar")');
  ok(/^<img class="ti" alt="" src="data:image\/png;base64,FAKE\d+">$/.test(a), a);
  p.X('typeIcon("cedar")');
  eq(1, canvases(), 'second call: from the cache');
  p.X('setTypeStyles(__0)', [CEDAR]);
  p.X('typeIcon("cedar")');
  eq(2, canvases(), 'the dictionary changed: drawn again');
  const d1 = p.X('typeIcon(__0)', { symbol: 'star', color: '#112233', size: 7 });
  p.X('typeIcon(__0)', { symbol: 'star', color: '#112233', size: 7 });
  eq(4, canvases(), 'a draft is drawn each time');
  ok(d1.startsWith('<img'));
  ok(/^<img/.test(p.X('typeIcon("nobody")')), 'an unknown type is drawn like settlement');
});

test('types: registerTypeIcons adds a normal and a highlighted image per type, and replaces the ones that exist', () => {
  const { p } = iconPage();
  p.X('setTypeStyles(__0)', [CEDAR, { ...CEDAR, code: 'tower', style: { symbol: 'flag', size: 8 } }]);
  const calls = [],
    have = new Set(['ahm-type-tower']);
  const map = {
    hasImage: (n) => have.has(n),
    removeImage: (n) => (calls.push(['remove', n]), have.delete(n)),
    addImage: (n) => (calls.push(['add', n]), have.add(n)),
  };
  p.X('registerTypeIcons(__0)', map);
  eq(['add:ahm-type-cedar', 'add:ahm-type-cedar-hl', 'remove:ahm-type-tower', 'add:ahm-type-tower', 'add:ahm-type-tower-hl', 'add:ahm-type-settlement', 'add:ahm-type-settlement-hl'].sort(), calls.map((c) => c.join(':')).sort(), 'settlement is always there as the fallback');
  // a map that cannot say which images it has (older stand-ins) still works
  p.X('registerTypeIcons(__0)', { addImage() {} });
});

test('map: AHM.map.setTypes after the map is ready makes the images of every type again and keeps the places drawn', () => {
  const calls = [];
  const { p, errors } = boot({ before: (pg) => (pg.ctx.registerTypeIcons = (m) => calls.push(m)) });
  eq(1, calls.length, 'once on load');
  setFeatures(p, fc(P1, P2));
  p.X('AHM.map.setTypes(__0)', [CEDAR]);
  eq(2, calls.length, 'again for the new dictionary');
  ok(p.X('"cedar" in TYPE_STYLE') && !p.X('"city" in TYPE_STYLE'), 'the table follows the dictionary');
  eq([], errors);
});

test('map: AHM.map.setTypes before the map is ready only updates the table; the images are made on load', () => {
  const calls = [];
  const { p, ml } = boot({ ready: false, before: (pg) => (pg.ctx.registerTypeIcons = (m) => calls.push(m)) });
  p.X('AHM.map.setTypes(__0)', [CEDAR]);
  eq(0, calls.length, 'nothing yet');
  ok(p.X('"cedar" in TYPE_STYLE'));
  ml.fire('load');
  eq(1, calls.length, 'on load, from the new table');
});

// ---- relief layer (T-053): hillshade from self-hosted terrain tiles, optional entry of the base-map dropdown ----
const TERRAIN = {
  tiles: ['https://forum.example/ahm-terrain/v1/{z}/{x}/{y}.webp'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 11,
  attribution: 'produced using Copernicus WorldDEM-30 test',
  paint: { 'hillshade-exaggeration': 0.5 },
};
const withTerrain = (terrain) => (p) => {
  p.ctx.AHM_CONFIG = { ...CONFIG, bbox: [37, 37, 49, 42.5], basemap: { ...CONFIG.basemap, terrain } };
};

test('map: relief: without terrain tiles in the config there is no relief entry and nothing is added', () => {
  for (const terrain of [undefined, { ...TERRAIN, tiles: [] }]) {
    const { p, ml, switchBasemap } = boot({ before: withTerrain(terrain) });
    ok(!/relief/i.test(p.el('#basemap').innerHTML), 'no entry in the dropdown');
    switchBasemap('@relief');
    ok(!ml.rec.sources['ahm-terrain'] && !ml.rec.layers.some((l) => l.id === 'ahm-relief'), 'no source, no layer');
  }
});

test('map: relief: with tiles the dropdown has "Map + relief"; the source and layer appear only when chosen', () => {
  const { p, ml, switchBasemap } = boot({ before: withTerrain(TERRAIN) });
  ok(p.el('#basemap').innerHTML.includes('<option value="@relief">Map + relief</option>'), p.el('#basemap').innerHTML);
  ok(p.el('#basemap').innerHTML.includes('value="sat1"'), 'the satellite entry stays');
  ok(!ml.rec.sources['ahm-terrain'], 'no source before the choice (no tile request)');
  switchBasemap('@relief');
  const src = ml.rec.sources['ahm-terrain'].def;
  eq('raster-dem', src.type);
  eq('terrarium', src.encoding);
  eq(256, src.tileSize);
  eq(11, src.maxzoom);
  eq(TERRAIN.tiles, src.tiles);
  ok(!('bounds' in src), 'no bounds in the config: the source has none (the AWS tiles cover the world, relief must not stop at bbox)');
  ok(src.attribution.includes('produced using Copernicus WorldDEM-30'), 'attribution');
  const l = ml.rec.layers.find((x) => x.id === 'ahm-relief');
  eq('hillshade', l.type);
  eq('ahm-terrain', l.source);
  eq('base-label', ml.rec.before['ahm-relief'], 'below the first base symbol layer');
  eq(0.5, l.paint['hillshade-exaggeration']);
  eq('visible', l.layout.visibility);
});

test('map: relief: Map and satellite hide it, labels keep dark text, and the source is added once', () => {
  const { p, ml, switchBasemap } = boot({ before: withTerrain(TERRAIN) });
  const labels = { id: 'ahm-labels', type: 'symbol', paint: {} }; // the real one needs the glyphs of a real style
  ml.rec.layers.push(labels);
  switchBasemap('sat1');
  eq('#ffffff', labels.paint['text-color'], 'satellite: light text');
  switchBasemap('@relief');
  eq('#333C43', labels.paint['text-color'], 'relief is not the satellite look: dark text');
  const l = () => ml.rec.layers.find((x) => x.id === 'ahm-relief');
  switchBasemap('@relief');
  eq(1, ml.rec.layers.filter((x) => x.id === 'ahm-relief').length, 'one layer');
  switchBasemap('');
  eq('none', l().layout.visibility);
  switchBasemap('sat1');
  eq('none', l().layout.visibility);
  switchBasemap('@relief');
  eq('visible', l().layout.visibility);
});

test('map: relief: a tile error shows a message in #status', () => {
  const { p, ml, switchBasemap } = boot({ before: withTerrain(TERRAIN) });
  switchBasemap('@relief');
  ml.fire('error', { sourceId: 'ahm-terrain', error: { message: 'Failed to fetch' } });
  ok(/Relief tiles failed to load: Failed to fetch/.test(p.el('#status').textContent), p.el('#status').textContent);
});

test('map: relief: the shipped config uses the AWS terrarium tiles (no own hosting needed)', () => {
  const t = load(['config.js']).X('AHM_CONFIG.basemap.terrain');
  eq(['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], t.tiles);
  eq('terrarium', t.encoding);
  eq(256, t.tileSize);
  eq(15, t.maxzoom, 'the AWS tiles go up to zoom 15');
  ok(/Mapzen|Tilezen/.test(t.attribution) && /USGS/.test(t.attribution), t.attribution);
  const { p, switchBasemap, ml } = boot({ before: withTerrain(t) });
  ok(p.el('#basemap').innerHTML.includes('Map + relief'), 'the entry is there by default');
  ok(!ml.rec.sources['ahm-terrain'], 'but nothing is requested before it is chosen');
  switchBasemap('@relief');
  eq(t.tiles, ml.rec.sources['ahm-terrain'].def.tiles);
});

// ---- relief colours by height, controls, legend and height readout (T-039) ----
const RAMPS = {
  low: { label: 'Low', stops: [[0, '#00ff00'], [1000, '#ffff00'], [3000, '#ffffff']] },
  alt: { label: 'Alt', stops: [[500, '#000000'], [500, '#ff0000'], [100, '#0000ff']] }, // unsorted and with a repeated height
};
const COLOR_TERRAIN = { ...TERRAIN, color: { opacity: 0.6, ramp: 'low', adapt: true, smooth: true, ramps: RAMPS } };
/** A page with the colour terrain chosen, and the handlers of the relief controls captured by their selector. */
/** A Terrarium tile of w x 1 pixels: each pixel is [R, G, B]; 129,244,0 = 500 m and 137,0,0 = 2304 m (R*256 + G + B/256 - 32768). */
const tileMock = (pixels) => ({
  fetch: async () => ({ blob: async () => ({}) }),
  createImageBitmap: async () => ({ width: pixels.length, height: 1 }),
  OffscreenCanvas: function () {
    return {
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ width: pixels.length, height: 1, data: new Uint8ClampedArray(pixels.flatMap((q) => [...q, 255])) }),
      }),
    };
  },
});
const idle = () => new Promise((r) => setTimeout(r, 20));
function bootRelief(terrain = COLOR_TERRAIN, tile = null) {
  const handlers = {};
  const b = boot({
    before: (p) => {
      withTerrain(terrain)(p);
      Object.assign(p.ctx, tile ? tileMock(tile) : {}, { setTimeout: (f) => (Promise.resolve().then(f), 1), clearTimeout() {} }); // no 250 ms wait
      p.el('#relief-color').checked = p.el('#relief-shade').checked = p.el('#relief-adapt').checked = p.el('#relief-smooth').checked = p.el('#relief-blend').checked = true; // checked in index.html
      p.el('#relief-contours').checked = false; // off in index.html
      ['#relief-color', '#relief-shade', '#relief-adapt', '#relief-smooth', '#relief-blend', '#relief-ramp', '#relief-opacity', '#relief-strength', '#relief-contours', '#relief-interval', '#relief-stops', '#relief-add', '#relief-reset', '#relief-profile-btn', '#relief-profile-clear'].forEach((sel) => {
        p.el(sel).addEventListener = (name, fn) => (handlers[sel] = handlers[sel + ':' + name] = fn);
      });
    },
  });
  b.switchBasemap('@relief');
  const layer = (id) => b.ml.rec.layers.find((l) => l.id === id);
  const change = (sel, props) => {
    Object.assign(b.p.el(sel), props);
    handlers[sel]({ target: b.p.el(sel) });
  };
  return { ...b, layer, change, handlers };
}

test('map: relief colours: the shipped config has ramps in metres with rising stops and a valid default', () => {
  const t = load(['config.js']).X('AHM_CONFIG.basemap.terrain');
  const ramps = Object.entries(t.color.ramps);
  ok(ramps.length >= 4, 'several ramps to choose from: ' + ramps.length);
  ok(t.color.ramps[t.color.ramp], 'the default ramp exists: ' + t.color.ramp);
  ok(t.color.opacity > 0 && t.color.opacity <= 1, 'opacity ' + t.color.opacity);
  for (const [id, r] of ramps) {
    ok(r.label && r.stops.length >= 2, id);
    r.stops.forEach(([m, c], i) => {
      ok(Number.isFinite(m) && /^#[0-9a-f]{6}$/i.test(c), id + ' stop ' + i + ': ' + m + ' ' + c);
      ok(i === 0 || m > r.stops[i - 1][0], id + ': heights rise');
    });
  }
});

test('map: relief colours: the colour layer is a color-relief layer under the hillshade, with the ramp as an elevation expression', () => {
  const { ml, layer } = bootRelief();
  const c = layer('ahm-relief-color');
  eq('color-relief', c.type);
  eq('ahm-terrain', c.source);
  eq('base-label', ml.rec.before['ahm-relief-color'], 'below the first base symbol layer, like the hillshade');
  ok(ml.rec.layers.indexOf(c) < ml.rec.layers.indexOf(layer('ahm-relief')), 'the shading stays above the colours');
  eq(['interpolate', ['linear'], ['elevation'], 0, '#00ff00', 1000, '#ffff00', 3000, '#ffffff'], c.paint['color-relief-color']);
  eq(0.6, c.paint['color-relief-opacity']);
});

test('map: relief colours: stops are sorted and a repeated height is nudged up (MapLibre needs rising stops)', () => {
  const { layer, change } = bootRelief();
  change('#relief-ramp', { value: 'alt' });
  const e = layer('ahm-relief-color').paint['color-relief-color'];
  eq(['interpolate', ['linear'], ['elevation'], 100, '#0000ff', 500, '#000000', 500.1, '#ff0000'], e);
});

test('map: relief colours: without a color section in the config only the hillshade exists (nothing changes)', () => {
  const { ml, layer, p } = bootRelief(TERRAIN);
  ok(layer('ahm-relief'), 'hillshade');
  ok(!layer('ahm-relief-color'), 'no colour layer');
  ok(p.el('#relief-opts').hidden, 'no controls');
  ok(!ml.rec.handlers.mousemove, 'no height readout');
});

test('map: relief colours: the controls switch colour and shading, set the strengths and follow the base-map choice', () => {
  const { p, layer, change, switchBasemap } = bootRelief();
  ok(!p.el('#relief-opts').hidden, 'controls are shown with the relief');
  change('#relief-color', { checked: false });
  eq('none', layer('ahm-relief-color').layout.visibility);
  eq('visible', layer('ahm-relief').layout.visibility);
  change('#relief-color', { checked: true });
  change('#relief-shade', { checked: false });
  eq('visible', layer('ahm-relief-color').layout.visibility);
  eq('none', layer('ahm-relief').layout.visibility);
  change('#relief-shade', { checked: true });
  change('#relief-opacity', { value: '0.3' });
  eq(0.3, layer('ahm-relief-color').paint['color-relief-opacity']);
  change('#relief-strength', { value: '0.8' });
  eq(0.8, layer('ahm-relief').paint['hillshade-exaggeration']);
  switchBasemap('');
  ok(p.el('#relief-opts').hidden, 'hidden on the plain map');
  eq('none', layer('ahm-relief-color').layout.visibility);
  eq('none', layer('ahm-relief').layout.visibility);
});

test('map: relief colours: the legend shows the ramp in metres and the ramp list comes from the config', () => {
  const { p, change } = bootRelief();
  ok(/Low/.test(p.el('#relief-ramp').innerHTML) && /Alt/.test(p.el('#relief-ramp').innerHTML), p.el('#relief-ramp').innerHTML);
  eq('low', p.el('#relief-ramp').value);
  ok(/linear-gradient/.test(p.el('#relief-legend').style.background), p.el('#relief-legend').style.background);
  ok(/0 m|>0</.test(p.el('#relief-ticks').innerHTML) && /3000/.test(p.el('#relief-ticks').innerHTML), p.el('#relief-ticks').innerHTML);
  change('#relief-ramp', { value: 'alt' });
  ok(/>100</.test(p.el('#relief-ticks').innerHTML), 'the legend follows the ramp: ' + p.el('#relief-ticks').innerHTML);
});

test('map: relief colours: moving the mouse shows the height in metres read from the Terrarium tile', async () => {
  const urls = [];
  const { p, ml } = bootRelief();
  // a 2x2 tile whose pixels are all R=131 G=232 B=0: 131*256 + 232 - 32768 = 1000 m
  Object.assign(p.ctx, {
    fetch: async (u) => (urls.push(u), { blob: async () => ({}) }),
    createImageBitmap: async () => ({ width: 2, height: 2 }),
    OffscreenCanvas: function () {
      return {
        getContext: () => ({ drawImage() {}, getImageData: () => ({ width: 2, height: 2, data: new Uint8ClampedArray([131, 232, 0, 255].concat([131, 232, 0, 255], [131, 232, 0, 255], [131, 232, 0, 255])) }) }),
      };
    },
  });
  ml.fire('mousemove', { lngLat: { lng: 44.5, lat: 40 } });
  await new Promise((r) => setTimeout(r, 0));
  eq(['https://forum.example/ahm-terrain/v1/7/79/48.webp'], urls, 'tile of lng 44.5, lat 40 at zoom 7');
  eq('Height: 1,000 m', p.el('#relief-height').textContent);
  ml.fire('mousemove', { lngLat: { lng: 44.51, lat: 40.01 } });
  await new Promise((r) => setTimeout(r, 0));
  eq(1, urls.length, 'the same tile is not fetched twice');
});

test('map: relief: bounds are passed to the source only when terrain.bounds is set (own tiles)', () => {
  const { ml, switchBasemap } = boot({ before: withTerrain({ ...TERRAIN, bounds: [37, 37, 49, 42.5] }) });
  switchBasemap('@relief');
  eq([37, 37, 49, 42.5], ml.rec.sources['ahm-terrain'].def.bounds, 'terrain.bounds = the built area');
  const shipped = load(['config.js']).X('AHM_CONFIG.basemap.terrain');
  ok(!shipped.bounds, 'the shipped config (AWS tiles) sets no bounds');
});

test('map: relief credit: the terrain attribution is plain visible text while relief is chosen, and gone otherwise', () => {
  const { p, ml, switchBasemap } = boot({ before: withTerrain(TERRAIN) });
  eq('', p.el('#base-credit').textContent || '', 'nothing before relief is chosen');
  ok(p.el('#base-credit').hidden, 'hidden');
  switchBasemap('@relief');
  eq(TERRAIN.attribution, p.el('#base-credit').textContent, 'the text of AHM_CONFIG.basemap.terrain.attribution');
  ok(!p.el('#base-credit').hidden, 'shown');
  ok(ml.rec.sources['ahm-terrain'].def.attribution, 'the MapLibre source keeps its attribution too');
  switchBasemap('sat1');
  ok(p.el('#base-credit').hidden && !p.el('#base-credit').textContent, 'hidden again when relief is off');
  switchBasemap('');
  ok(p.el('#base-credit').hidden, 'and on the plain map');
});

test('map: relief credit: the element sits in the page under the base-map select and wraps on a phone (index.html, map.css)', () => {
  const fs = require('fs');
  const html = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app', 'index.html'), 'utf8');
  ok(/<select id="basemap"><\/select>\s*<div id="base-credit" hidden><\/div>/.test(html), 'under the select, hidden at first');
  const css = fs.readFileSync(require('path').join(__dirname, '..', '..', 'app', 'css', 'map.css'), 'utf8');
  ok(/#base-credit\s*\{[^}]*overflow-wrap:\s*anywhere/.test(css), 'long words and URLs wrap');
  ok(!/#base-credit\s*\{[^}]*(white-space:\s*nowrap|width:\s*\d+px)/.test(css), 'no fixed width, no nowrap');
});

test('map: relief colours: the shipped config says whether the colours adapt to the view', () => {
  eq(true, load(['config.js']).X('AHM_CONFIG.basemap.terrain.color.adapt'), 'default: the ramp follows the view');
  eq(true, load(['config.js']).X('AHM_CONFIG.basemap.terrain.color.blend'), 'default: smooth transitions');
  eq('boolean', typeof load(['config.js']).X('AHM_CONFIG.basemap.terrain.color.adapt'));
  eq('boolean', typeof load(['config.js']).X('AHM_CONFIG.basemap.terrain.color.smooth'));
});

test('map: relief colours: the ramp is stretched over the heights in view (2nd to 98th percentile) and follows the map when it moves', async () => {
  // a 2 pixel tile, 500 m and 2304 m: the view (43-44.5 E, 40-40.5 N at zoom 7) lies in tile x=79 (42.19-45 E) and covers both of its halves
  const { ml, layer, p } = bootRelief(COLOR_TERRAIN, [[129, 244, 0], [137, 0, 0]]);
  await idle();
  const e = layer('ahm-relief-color').paint['color-relief-color'];
  eq(500, e[3], 'lowest stop at the lowest height in view');
  eq(2304, e[7], 'highest stop at the highest height in view');
  ok(Math.abs(e[5] - (500 + (1000 / 3000) * 1804)) < 0.01, 'the middle stop keeps its relative place: ' + e[5]);
  eq('#00ff00', e[4]);
  ok(/>500</.test(p.el('#relief-ticks').innerHTML) && />2304</.test(p.el('#relief-ticks').innerHTML), p.el('#relief-ticks').innerHTML);
  ok(ml.rec.handlers.moveend && ml.rec.handlers.moveend.length, 'the map listens to moveend');
});

test('map: relief colours: a flat view gets at least 20 m of range, and "adapt" off brings the fixed ramp back', async () => {
  const { layer, change, ml } = bootRelief(COLOR_TERRAIN, [[131, 232, 0]]); // 1000 m everywhere
  await idle();
  const e = layer('ahm-relief-color').paint['color-relief-color'];
  eq([1000, 1020], [e[3], e[7]]);
  change('#relief-adapt', { checked: false });
  eq(['interpolate', ['linear'], ['elevation'], 0, '#00ff00', 1000, '#ffff00', 3000, '#ffffff'], layer('ahm-relief-color').paint['color-relief-color']);
  ml.fire('moveend');
  await idle();
  eq(0, layer('ahm-relief-color').paint['color-relief-color'][3], 'no stretching while "adapt" is off');
});

// ---- ramp editor, contour lines, height profile, saved settings (T-039, second part) ----
const lastColor = (layer) => layer('ahm-relief-color').paint['color-relief-color'];

test('map: ramp editor: editing a stop makes a "custom" ramp, adding and removing stops works, reset goes back', () => {
  const { p, layer, handlers, change } = bootRelief();
  ok(/data-k="m"[^>]*value="0"/.test(p.el('#relief-stops').innerHTML) && /value="#00ff00"/.test(p.el('#relief-stops').innerHTML), p.el('#relief-stops').innerHTML);
  handlers['#relief-stops:input']({ target: { dataset: { i: '1', k: 'm' }, value: '1200' } });
  eq('__custom', p.el('#relief-ramp').value);
  ok(/Custom/.test(p.el('#relief-ramp').innerHTML), 'the list has the custom entry');
  eq(['interpolate', ['linear'], ['elevation'], 0, '#00ff00', 1200, '#ffff00', 3000, '#ffffff'], lastColor(layer), 'the edited height is used');
  handlers['#relief-stops:input']({ target: { dataset: { i: '1', k: 'c' }, value: '#123456' } });
  eq('#123456', lastColor(layer)[6]);
  handlers['#relief-add']({});
  eq(4, (p.el('#relief-stops').innerHTML.match(/data-k="m"/g) || []).length, 'a stop was added');
  handlers['#relief-stops:click']({ target: { dataset: { act: 'del', i: '3' } } });
  handlers['#relief-stops:click']({ target: { dataset: { act: 'del', i: '2' } } });
  handlers['#relief-stops:click']({ target: { dataset: { act: 'del', i: '1' } } });
  eq(2, (p.el('#relief-stops').innerHTML.match(/data-k="m"/g) || []).length, 'two stops stay: no deleting below two');
  handlers['#relief-reset']({});
  eq('low', p.el('#relief-ramp').value);
  eq(3, (p.el('#relief-stops').innerHTML.match(/data-k="m"/g) || []).length);
  ok(!/Custom/.test(p.el('#relief-ramp').innerHTML));
  change('#relief-ramp', { value: 'alt' });
  ok(/value="100"/.test(p.el('#relief-stops').innerHTML), 'the editor shows the chosen ramp');
});

test('map: settings are saved in localStorage and read again at the start', () => {
  const saved = [];
  const a = bootRelief();
  a.p.ctx.localStorage = { getItem: () => null, setItem: (k, v) => saved.push([k, v]) };
  a.change('#relief-opacity', { value: '0.2' });
  const [key, json] = saved.at(-1);
  eq('ahm-relief', key);
  eq(0.2, JSON.parse(json).opacity);
  const b = boot({
    before: (p) => {
      withTerrain(COLOR_TERRAIN)(p);
      p.ctx.localStorage = { getItem: () => JSON.stringify({ ramp: 'alt', opacity: 0.2, strength: 0.9, contours: true }), setItem() {} };
    },
  });
  eq('alt', b.p.el('#relief-ramp').value);
  eq(0.2, b.p.el('#relief-opacity').value);
  eq(0.9, b.p.el('#relief-strength').value);
  eq(true, b.p.el('#relief-contours').checked);
});

test('map: relief colours: flat bands: the expression has a hard edge at every boundary, smooth stays as it was', () => {
  const p = load(['typeicons.js', 'map.js']);
  const st = [[0, '#00ff00'], [1000, '#ffff00'], [3000, '#ffffff']];
  eq(['interpolate', ['linear'], ['elevation'], 0, '#00ff00', 1000, '#ffff00', 3000, '#ffffff'], p.X('rampExpression(__0, true)', st), 'smooth = today');
  const f = p.X('rampExpression(__0, false)', st);
  eq(['interpolate', ['linear'], ['elevation'], 0, '#00ff00', 999.99, '#00ff00', 1000, '#ffff00', 2999.99, '#ffff00', 3000, '#ffffff'], f);
  const ins = f.slice(3).filter((_, k) => k % 2 === 0);
  ok(ins.every((v, k) => !k || v > ins[k - 1]), 'strictly increasing: ' + ins);
  const g = p.X('rampExpression(__0, false)', [[500, '#111111'], [500, '#222222'], [500.05, '#333333']]); // repeated and nearly equal heights
  const gi = g.slice(3).filter((_, k) => k % 2 === 0);
  ok(gi.every((v, k) => !k || v > gi[k - 1]), 'still strictly increasing: ' + gi);
});

test('map: relief colours: flat bands are applied after "adapt" (edges move with the stretched ramp), checkbox, legend, saving', async () => {
  const { layer, change, p, ml } = bootRelief({ ...COLOR_TERRAIN, color: { ...COLOR_TERRAIN.color, blend: true } }, [[129, 244, 0], [137, 0, 0]]);
  await idle();
  ok(p.el('#relief-blend').checked, 'checked by default (smooth)');
  eq(9, layer('ahm-relief-color').paint['color-relief-color'].length, 'smooth: 3 stops');
  change('#relief-blend', { checked: false });
  const e = layer('ahm-relief-color').paint['color-relief-color'];
  eq(500, e[3], 'first stop at the lowest height in view (adapt)');
  eq(2304, e[e.length - 2], 'last stop at the highest height in view');
  ok(Math.abs(e[5] - (500 + (1000 / 3000) * 1804 - 0.01)) < 0.01, 'the band edge follows the stretched ramp: ' + e[5]);
  eq(e[4], e[6], 'the same colour right up to the edge');
  ok(/#00ff00 0\.0%, #00ff00 33\.3%, #ffff00 33\.3%/.test(p.el('#relief-legend').style.background), p.el('#relief-legend').style.background);
  const saved = [];
  p.ctx.localStorage = { getItem: () => null, setItem: (k, v) => saved.push(v) };
  change('#relief-blend', { checked: false });
  eq(false, JSON.parse(saved.at(-1)).blend, 'saved with the other relief settings');
  const b = boot({ before: (q) => { withTerrain(COLOR_TERRAIN)(q); q.ctx.localStorage = { getItem: () => JSON.stringify({ blend: false }), setItem() {} }; } });
  eq(false, b.p.el('#relief-blend').checked, 'restored');
  const c2 = boot({ before: (q) => { withTerrain({ ...COLOR_TERRAIN, color: { ...COLOR_TERRAIN.color, blend: false } })(q); } });
  eq(false, c2.p.el('#relief-blend').checked, 'config blend false starts flat');
});

test('map: relief colours: the saved "adapt" is read as it always was', () => {
  const mk = (saved) => boot({ before: (q) => { withTerrain(COLOR_TERRAIN)(q); q.ctx.localStorage = { getItem: () => JSON.stringify(saved), setItem() {} }; } });
  eq(true, mk({}).p.el('#relief-adapt').checked);
  eq(false, mk({ adapt: false }).p.el('#relief-adapt').checked);
});

test('map: contours: marching squares gives one closed line around a cone, and nothing for a flat or missing grid', () => {
  const p = load(['typeicons.js', 'map.js']);
  const n = 21;
  const cone = Array.from({ length: n * n }, (_, k) => 100 - Math.hypot((k % n) - 10, Math.floor(k / n) - 10));
  const lines = p.X('contourLines(__0, 21, 21, 95)', cone);
  eq(1, lines.length);
  const l = lines[0];
  eq(l[0], l[l.length - 1], 'closed');
  ok(l.length > 12, 'points: ' + l.length);
  ok(l.every(([x, y]) => Math.abs(Math.hypot(x - 10, y - 10) - 5) < 0.05), 'all points lie on the circle of radius 5');
  eq(0, p.X('contourLines(__0, 21, 21, 50)', cone).length, 'a level below the whole grid has no line');
  eq(0, p.X('contourLines(__0, 21, 21, 100.5)', cone).length, 'a level above the whole grid has no line');
  const holes = cone.map((v, k) => (k === 10 * 21 + 10 ? NaN : v));
  ok(p.X('contourLines(__0, 21, 21, 99.5)', holes).length === 0, 'a cell with a missing corner makes no line');
  // a ridge: the left half is high, the right half low -> one open line through the middle of the grid
  const ridge = Array.from({ length: 6 * 4 }, (_, k) => ((k % 6) < 3 ? 10 : 0));
  const r = p.X('contourLines(__0, 6, 4, 5)', ridge);
  eq(1, r.length);
  ok(r[0].every(([x]) => x === 2.5) && r[0].length === 4, JSON.stringify(r));
});

test('map: contours: lines are drawn for the heights in view with a step from the zoom, as GeoJSON with height and major flag', async () => {
  // tile x=79: left half 500 m, right half 2304 m, the boundary at 43.59 E lies in the view (43-44.5 E)
  const { ml, layer, change } = bootRelief(COLOR_TERRAIN, [[129, 244, 0], [137, 0, 0]]);
  change('#relief-contours', { checked: true });
  await idle();
  const src = ml.rec.sources['ahm-contours'];
  ok(src, 'source');
  const f = src.data.features;
  const hs = [...new Set(f.map((x) => x.properties.h))].sort((a, b) => a - b);
  eq([1000, 1500, 2000], hs, 'every 500 m at zoom 7 (heights between 500 and 2304)');
  ok(f.every((x) => x.geometry.type === 'LineString' && x.geometry.coordinates.length >= 2), 'lines');
  ok(f.filter((x) => x.properties.h === 2500 || x.properties.h === 1000).every((x) => x.properties.major === (x.properties.h % 2500 === 0)), 'major every 5th step');
  ok(layer('ahm-contour') && layer('ahm-contour-label'), 'line layer and label layer');
  eq('line', layer('ahm-contour-label').layout['symbol-placement']);
  ok(f[0].geometry.coordinates.every(([lng]) => lng > 43.5 && lng < 43.7), 'the line runs along the 500/2304 boundary: ' + f[0].geometry.coordinates[0]);
});

test('map: contours: off by default, the checkbox and the step list control them, and no lines outside the relief', async () => {
  const { ml, layer, change, p, switchBasemap } = bootRelief(COLOR_TERRAIN, [[129, 244, 0], [137, 0, 0]]);
  await idle();
  ok(!ml.rec.sources['ahm-contours'] || ml.rec.sources['ahm-contours'].data.features.length === 0, 'nothing computed while off');
  change('#relief-contours', { checked: true });
  await idle();
  ok(ml.rec.sources['ahm-contours'].data.features.length > 0, 'lines after switching on');
  change('#relief-interval', { value: '1000' });
  await idle();
  eq([1000, 2000], [...new Set(ml.rec.sources['ahm-contours'].data.features.map((x) => x.properties.h))].sort((a, b) => a - b), 'a fixed 1000 m step');
  change('#relief-contours', { checked: false });
  eq('none', layer('ahm-contour').layout.visibility);
  change('#relief-contours', { checked: true });
  switchBasemap('');
  eq('none', layer('ahm-contour').layout.visibility, 'hidden with the plain map');
});

test('map: height profile: clicks on the map add points, the length and heights are shown, clear removes them', async () => {
  const { ml, handlers, p } = bootRelief(COLOR_TERRAIN, [[131, 232, 0]]); // 1000 m everywhere
  handlers['#relief-profile-btn']({});
  const click = (lng, lat) => ml.fire('click', { lngLat: { lng, lat }, point: { x: 0, y: 0 } });
  click(44.0, 40.0);
  click(44.0, 40.1);
  click(44.1, 40.1);
  await idle();
  const info = p.el('#relief-profile-info').textContent;
  ok(/19\.\d km/.test(info) || /18\.\d km/.test(info), 'length of two legs of ~11.1 km and ~8.5 km: ' + info);
  ok(/min 1,000 m/.test(info) && /max 1,000 m/.test(info), info);
  eq(3, ml.rec.sources['ahm-profile'].data.features.filter((f) => f.geometry.type === 'Point').length, 'three points');
  handlers['#relief-profile-clear']({});
  eq('', p.el('#relief-profile-info').textContent);
  eq(0, ml.rec.sources['ahm-profile'].data.features.length);
  eq('Draw height profile', p.el('#relief-profile-btn').textContent, 'clear also leaves the drawing mode');
});

// ---- relief polish (T-048): rounder contour lines, smooth colour changes ----
const turnDeg = (l) => {
  let m = 0;
  for (let i = 1; i < l.length - 1; i++) {
    const a = Math.atan2(l[i][1] - l[i - 1][1], l[i][0] - l[i - 1][0]);
    const b = Math.atan2(l[i + 1][1] - l[i][1], l[i + 1][0] - l[i][0]);
    m = Math.max(m, Math.abs(((((b - a) * 180) / Math.PI + 540) % 360) - 180));
  }
  return m;
};

test('map: contours: cutting the corners (Chaikin) makes a ring rounder and keeps it closed; an open line keeps its ends', () => {
  const p = load(['typeicons.js', 'map.js']);
  const n = 21;
  const cone = Array.from({ length: n * n }, (_, k) => 100 - Math.hypot((k % n) - 10, Math.floor(k / n) - 10) + 0.3 * Math.sin(k));
  const raw = p.X('contourLines(__0, 21, 21, 94)', cone)[0];
  const sm = p.X('chaikin(__0, 2)', raw);
  eq(sm[0], sm[sm.length - 1], 'still closed');
  ok(turnDeg(sm) < turnDeg(raw) * 0.6, 'sharpest turn ' + turnDeg(raw).toFixed(0) + ' -> ' + turnDeg(sm).toFixed(0) + ' degrees');
  ok(sm.length > raw.length, 'more points');
  const open = [[0, 0], [4, 0], [4, 4]];
  const o = p.X('chaikin(__0, 2)', open);
  eq([0, 0], o[0]);
  eq([4, 4], o[o.length - 1]);
  ok(turnDeg(o) < 90, 'the right angle is cut');
});

test('map: contours: the grid blur lowers a spike (1 2 1 / 2 4 2 / 1 2 1 over 16), renormalises at the edge and keeps missing cells missing', () => {
  const p = load(['typeicons.js', 'map.js']);
  const g = Array(25).fill(0);
  g[12] = 100;
  const b = p.X('smoothGrid(__0, 5, 5)', g);
  eq(25, b[12]);
  eq(12.5, b[11]);
  eq(6.25, b[6]);
  const flat = p.X('smoothGrid(__0, 5, 5)', Array(25).fill(7));
  ok(flat.every((v) => Math.abs(v - 7) < 1e-9), 'a flat grid stays flat, also at the edges');
  const hole = Array(25).fill(7);
  hole[12] = NaN;
  const h2 = p.X('smoothGrid(__0, 5, 5)', hole);
  ok(Number.isNaN(h2[12]) && h2[11] === 7, 'a missing cell stays missing and does not spoil the neighbours');
});

test('map: relief colours: "Smooth colours" slides the range to the new one in 400 ms; off jumps', () => {
  const { p, change } = bootRelief();
  let now = 0;
  const frames = [];
  Object.assign(p.ctx, { performance: { now: () => now }, requestAnimationFrame: (f) => frames.push(f) });
  const range = () => p.X('relief.range');
  p.X('relief.range = [500, 2000]; setRange([1000, 3000])');
  eq([500, 2000], range(), 'nothing moves before the first frame');
  now = 200;
  frames.shift()(now);
  const mid = range();
  ok(mid[0] > 500 && mid[0] < 1000 && mid[1] > 2000 && mid[1] < 3000, 'half way: ' + mid);
  now = 400;
  frames.shift()(now);
  eq([1000, 3000], range());
  eq(0, frames.length, 'the animation stops at the end');
  p.X('setRange([1000, 3000])');
  eq(0, frames.length, 'no animation for the same range');
  change('#relief-smooth', { checked: false });
  p.X('setRange([2000, 4000])');
  eq([2000, 4000], range(), 'off: the range jumps');
  eq(0, frames.length);
  p.X('relief.smooth = true; relief.range = null; setRange([10, 30])');
  eq([10, 30], range(), 'the first range is set at once');
});
