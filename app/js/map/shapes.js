// Shapes on the map (map domain): borders (areas) and lines, drawn exactly as the sidebar describes them. The map knows nothing about
// border types: every feature arrives with its look (colour, opacity, width, dash) already resolved. Also the drawing tool.
// Commands (AHM.map.*, INTERFACES.md I-2): setShapes(fc), highlightShape(id|null), previewShape(id, {color, opacity}|null),
//   showPreview(geometry|null) (a blue draft outline), profile(id, { from?, to? }), profileMark([lon, lat]|null), drawShape({ kind: 'area'|'line', coords?, ids?, snap? }, onChange), isDrawing(), riverNameAt([lon, lat]).
// Events: shape:click { id } (a click on a line or an outline, 6 px tolerance), map:click now carries shapes: [{ id }] (areas under the
//   cursor), draw:finish (Enter or double click while drawing), draw:cancel (Esc).
// Feature properties: kind ('area' | 'line' | 'label'), id, name, type (text), dates (text), color, ink (label colour), opacity, width,
//   dash (solid | dashed | dotted | dashdot), arrows (boolean: a one-way route, drawn with direction arrows), label (boolean), halo ('' or a colour), size (area of the bounding box: smaller shapes are drawn on top and hit first).
//   A 'label' feature is a Point where an area's name is drawn.
const SHAPE_DASH = { solid: null, dashed: [3, 2], dotted: [0.1, 2.2], dashdot: [4, 1.6, 0.8, 1.6] };
const SHAPE_HIT_PX = 6;
const SHAPE_FILL = 'ahm-shape-fill';
const SHAPE_LINES = Object.keys(SHAPE_DASH).map((d) => 'ahm-shape-line-' + d);
const DRAFT = '#bc2a4d'; // the colour of the shape being drawn
const PREVIEW = '#1d6fd1'; // the colour of a search result shown before it is added
let labelFont = ['Noto Sans Regular']; // map.js sets the font of the base map
let shapesNow = null, // the last collection received (drawn as soon as the map is ready)
  shapeSel = null,
  shapeHover = null,
  shapeTip = null,
  foundNow = null,
  shapeDrawing = null;

function shapesInit() {
  const col = ['coalesce', ['feature-state', 'color'], ['get', 'color']],
    opa = ['coalesce', ['feature-state', 'opacity'], ['get', 'opacity']],
    flag = (k) => ['boolean', ['feature-state', k], false],
    src = 'ahm-shapes',
    add = (l, s) => map.addLayer({ source: s || src, ...l }, 'ahm-route'); // above the base map and the history images, under the route and the places
  map.addSource(src, { type: 'geojson', data: shapesNow || EMPTY, promoteId: 'id' });
  add({
    id: SHAPE_FILL,
    type: 'fill',
    filter: ['==', ['get', 'kind'], 'area'],
    paint: { 'fill-color': col, 'fill-opacity': ['min', 0.85, ['+', opa, ['case', flag('hover'), 0.12, 0]]] },
  });
  const notLabel = ['!=', ['get', 'kind'], 'label'];
  add({
    // a ring in the colour of a layer: the members of the layer being edited
    id: 'ahm-shape-halo',
    type: 'line',
    filter: ['all', notLabel, ['!=', ['coalesce', ['get', 'halo'], ''], '']],
    layout: { 'line-join': 'round' },
    paint: { 'line-color': ['coalesce', ['get', 'halo'], '#000000'], 'line-width': ['+', ['get', 'width'], 8], 'line-opacity': 0.85 },
  });
  add({
    // the selected shape (DESIGN.md): a soft shadow and a white casing under its line
    id: 'ahm-shape-shadow',
    type: 'line',
    filter: notLabel,
    layout: { 'line-join': 'round' },
    paint: { 'line-color': '#000000', 'line-blur': 4, 'line-width': ['+', ['get', 'width'], 9], 'line-opacity': ['case', flag('selected'), 0.28, 0] },
  });
  add({
    id: 'ahm-shape-casing',
    type: 'line',
    filter: notLabel,
    layout: { 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': ['+', ['get', 'width'], 5], 'line-opacity': ['case', flag('selected'), 0.95, 0] },
  });
  Object.entries(SHAPE_DASH).forEach(([d, dash]) =>
    add({
      id: 'ahm-shape-line-' + d,
      type: 'line',
      filter: ['all', notLabel, ['==', ['get', 'dash'], d]],
      layout: { 'line-cap': d === 'dotted' ? 'round' : 'butt', 'line-join': 'round' },
      paint: {
        'line-color': col,
        'line-width': ['+', ['get', 'width'], ['case', flag('hover'), 1, 0]],
        'line-opacity': ['case', ['==', ['get', 'kind'], 'line'], opa, 0.9],
        ...(dash ? { 'line-dasharray': dash } : {}),
      },
    })
  );
  // the path found between two places (sidebar/routes.js): a bold line over the routes, with a white casing
  map.addSource('ahm-found', { type: 'geojson', data: foundNow || EMPTY });
  add({ id: 'ahm-found-casing', type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 } }, 'ahm-found');
  add({ id: 'ahm-found-line', type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#1d6fd1', 'line-width': 5, 'line-opacity': 0.9 } }, 'ahm-found');
  // direction of a one-way route: arrowheads along the line, in the colour of the route (an SDF image, so one picture serves every colour)
  if (!map.hasImage('ahm-arrow')) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d');
    x.fillStyle = '#000';
    x.beginPath();
    x.moveTo(26, 16); // the tip points right: the line direction
    x.lineTo(8, 5);
    x.lineTo(13, 16);
    x.lineTo(8, 27);
    x.closePath();
    x.fill();
    map.addImage('ahm-arrow', x.getImageData(0, 0, 32, 32), { sdf: true, pixelRatio: 2 });
  }
  add({
    id: 'ahm-shape-arrows',
    type: 'symbol',
    filter: ['all', ['==', ['get', 'kind'], 'line'], ['==', ['get', 'arrows'], true]],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 130,
      'icon-image': 'ahm-arrow',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 8, 1.1, 12, 1.4],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-color': col, 'icon-halo-color': '#ffffff', 'icon-halo-width': 1.2, 'icon-opacity': ['coalesce', ['feature-state', 'opacity'], ['get', 'opacity']] },
  });
  if (map.getStyle().glyphs) {
    const text = {
        'text-field': ['get', 'name'],
        'text-font': labelFont,
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 12, 12, 14],
        'text-max-width': 8,
        'text-padding': 4,
      },
      paint = { 'text-color': ['get', 'ink'], 'text-halo-color': '#ffffff', 'text-halo-width': 2 };
    add({
      // the name of an area: at the Point the sidebar chose inside it
      id: 'ahm-shape-label-area',
      type: 'symbol',
      filter: ['all', ['==', ['get', 'kind'], 'label'], ['==', ['get', 'label'], true]],
      layout: { ...text, 'text-letter-spacing': 0.05 },
      paint,
    });
    add({
      id: 'ahm-shape-label-line',
      type: 'symbol',
      filter: ['all', ['==', ['get', 'kind'], 'line'], ['==', ['get', 'label'], true]],
      layout: { ...text, 'symbol-placement': 'line-center' },
      paint,
    });
  }
  // two scratch sources: the shape being drawn (red) and a search result being looked at (blue), both dashed
  [
    ['ahm-draw', DRAFT],
    ['ahm-preview', PREVIEW],
  ].forEach(([id, c]) => {
    map.addSource(id, { type: 'geojson', data: EMPTY });
    add({ id: id + '-fill', type: 'fill', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': c, 'fill-opacity': 0.15 } }, id);
    add({ id: id + '-line', type: 'line', layout: { 'line-join': 'round' }, paint: { 'line-color': c, 'line-width': 2.5, 'line-dasharray': [2, 1.5] } }, id);
  });

  // ---- pointer: hover (lighter, tooltip) ----
  const lineAt = (pt) =>
    map.queryRenderedFeatures([[pt.x - SHAPE_HIT_PX, pt.y - SHAPE_HIT_PX], [pt.x + SHAPE_HIT_PX, pt.y + SHAPE_HIT_PX]], { layers: SHAPE_LINES })[0];
  shapeLineAt = lineAt;
  shapesAt = (pt) => {
    const seen = new Set();
    return map
      .queryRenderedFeatures(pt, { layers: [SHAPE_FILL] })
      .filter((f) => !seen.has(f.properties.id) && seen.add(f.properties.id))
      .sort((x, y) => (x.properties.size || 0) - (y.properties.size || 0)); // the smallest area first: it is drawn on top
  };
  map.on('mousemove', (e) => {
    if (shapeDrawing) return;
    const placeLayers = ['ahm-places', SEL.symbol, 'ahm-clusters'].filter((id) => map.getLayer(id));
    if (map.queryRenderedFeatures(e.point, { layers: placeLayers }).length) return setShapeHover(null); // a place or a bubble has its own hover
    const line = lineAt(e.point),
      f = line || shapesAt(e.point)[0];
    map.getCanvas().style.cursor = line ? 'pointer' : '';
    setShapeHover(f, e.lngLat);
  });
  map.getCanvas().addEventListener('mouseleave', () => setShapeHover(null));
  if (shapeSel) map.setFeatureState({ source: src, id: shapeSel }, { selected: true }); // selected before the map was ready
}
let shapeLineAt = () => null,
  shapesAt = () => [];

function setShapeHover(f, at) {
  const id = f ? f.properties.id : null;
  if (id !== shapeHover) {
    if (shapeHover) map.setFeatureState({ source: 'ahm-shapes', id: shapeHover }, { hover: false });
    if (shapeTip) shapeTip.remove();
    shapeTip = null;
    shapeHover = id;
    if (id) {
      map.setFeatureState({ source: 'ahm-shapes', id }, { hover: true });
      const p = f.properties;
      shapeTip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'ahm-tip', maxWidth: '260px', offset: 14 })
        .setHTML(`<div class="tip-title">${esc(p.name || '')}</div><div class="tip-sub">${[p.type, p.dates].filter(Boolean).map(esc).join(' · ')}</div>`)
        .setLngLat(at)
        .addTo(map);
    }
  } else if (shapeTip && at) shapeTip.setLngLat(at);
}

// ---- drawing: click adds a point, drag moves it, right click removes it, Backspace undoes, Enter or double click finishes, Esc cancels ----
function drawShape(opts, onChange) {
  endDraw();
  setShapeHover(null);
  // opts: kind 'area' | 'line'; coords = the points to start with; ids = for each of them the id of the place it sits on, or null;
  //   snap: a click or a drop on a place marker uses the place's position and remembers its id (routes: the stops);
  //   locate(id): the exact [lon, lat] of that place.
  // A line also gets a small handle at the middle of every segment: drag it to insert a point there.
  //   labels: the first point is marked A and the last B (a route: from A through the points to B).
  //   expand(a, b): async, called for each new point after the first; gives the points to add between a and b (a modern road, say) or nothing.
  //   onNote(text): a short message about what happened (a road that was not found).
  const kind = opts.kind,
    pts = (opts.coords || []).map((c) => c.slice()),
    ids = pts.map((_, i) => (opts.ids && opts.ids[i]) || null),
    flags = pts.map(() => null), // 'road' for a point that only gives a road its course
    groups = pts.map(() => 1), // how many points each click added, so that Undo takes the road of a click away at once
    marks = [],
    mids = [],
    geom = () =>
      kind === 'area'
        ? pts.length >= 3
          ? { type: 'Polygon', coordinates: [[...pts, pts[0]]] }
          : null
        : pts.length >= 2
          ? { type: 'LineString', coordinates: pts.map((p) => p.slice()) }
          : null,
    paint = () => {
      const f = [];
      if (kind === 'area' && pts.length >= 3) f.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] }, properties: {} });
      if (pts.length >= 2) f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: kind === 'area' && pts.length > 2 ? [...pts, pts[0]] : pts }, properties: {} });
      map.getSource('ahm-draw').setData({ type: 'FeatureCollection', features: f });
    },
    // the place marker under a screen point, if any: { id, ll: [lon, lat] }
    snapAt = (pt) => {
      if (!opts.snap) return null;
      const layers = ['ahm-places', SEL.symbol].filter((l) => map.getLayer(l)),
        r = 12,
        hit = layers.length && map.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers }).find((f) => f.properties.id && !f.properties.point_count && f.geometry.type === 'Point');
      // the position of the rendered feature is rounded to the map tile: the caller knows the exact one
      return hit ? { id: hit.properties.id, ll: (opts.locate && opts.locate(hit.properties.id)) || hit.geometry.coordinates.slice(0, 2) } : null;
    },
    decorate = () => {
      const n = pts.length;
      marks.forEach((m, i) => {
        const el = m.getElement();
        el.classList.toggle('first', !!opts.labels && i === 0);
        el.classList.toggle('last', !!opts.labels && n > 1 && i === n - 1);
        el.classList.toggle('road', flags[i] === 'road');
        el.textContent = opts.labels && i === 0 ? 'A' : opts.labels && n > 1 && i === n - 1 ? 'B' : '';
      });
    },
    ungroup = () => groups.splice(0, groups.length, ...pts.map(() => 1)),
    changed = () => {
      paint();
      rebuildMids();
      decorate();
      if (onChange) onChange(geom());
    },
    wire = (m, el) => {
      m.on('drag', () => {
        const l = m.getLngLat();
        pts[marks.indexOf(m)] = [l.lng, l.lat];
        paint();
      });
      m.on('dragend', () => {
        const i = marks.indexOf(m),
          s = snapAt(map.project(m.getLngLat()));
        if (s) {
          pts[i] = s.ll;
          m.setLngLat(s.ll);
        }
        ids[i] = s ? s.id : null;
        flags[i] = null; // a moved point is a point of the person now
        el.classList.toggle('place', !!ids[i]);
        changed();
      });
      ['click', 'dblclick'].forEach((t) => el.addEventListener(t, (ev) => ev.stopPropagation())); // not a new point
      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const i = marks.indexOf(m);
        pts.splice(i, 1);
        ids.splice(i, 1);
        flags.splice(i, 1);
        marks.splice(i, 1);
        m.remove();
        ungroup();
        changed();
      });
    },
    vertex = (ll, id) => {
      const el = document.createElement('div');
      el.className = 'ahm-vtx' + (id ? ' place' : '');
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(ll).addTo(map);
      wire(m, el);
      marks.push(m);
    },
    rebuildMids = () => {
      mids.splice(0).forEach((m) => m.remove());
      if (kind !== 'line') return;
      for (let i = 0; i + 1 < pts.length; i++) {
        const el = document.createElement('div');
        el.className = 'ahm-vtx mid';
        el.title = 'Drag to add a point here';
        const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]).addTo(map);
        ['click', 'dblclick'].forEach((t) => el.addEventListener(t, (ev) => ev.stopPropagation()));
        m.once('dragstart', () => {
          // the handle becomes a real point between the two (its index is the one it was built for)
          const l = m.getLngLat();
          mids.splice(mids.indexOf(m), 1);
          pts.splice(i + 1, 0, [l.lng, l.lat]);
          ids.splice(i + 1, 0, null);
          flags.splice(i + 1, 0, null);
          marks.splice(i + 1, 0, m);
          ungroup();
          el.classList.remove('mid');
          el.title = '';
          wire(m, el);
        });
        mids.push(m);
      }
    },
    undo = () => {
      if (!pts.length) return;
      for (let k = groups.pop() || 1; k > 0 && pts.length; k--) {
        pts.pop();
        ids.pop();
        flags.pop();
        marks.pop().remove();
      }
      changed();
    },
    // a new point: with `expand`, the points of the road between the last point and this one come first
    add = async (ll, id) => {
      let between = [];
      if (opts.expand && pts.length) {
        try {
          between = (await opts.expand(pts[pts.length - 1], ll)) || [];
        } catch (e) {
          between = [];
        }
        if (!shapeDrawing || shapeDrawing.dead) return; // the tool was closed while the road was being asked for
      }
      between.forEach((c) => {
        pts.push(c);
        ids.push(null);
        flags.push('road');
        vertex(c, null);
      });
      pts.push(ll);
      ids.push(id || null);
      flags.push(null);
      groups.push(between.length + 1);
      vertex(ll, id);
      changed();
    };
  let last = { t: 0, x: -99, y: -99 },
    queue = Promise.resolve(); // the points are added in the order of the clicks, also when a road takes a moment
  const onClick = (e) => {
      const now = performance.now();
      if (now - last.t < 400 && Math.hypot(e.point.x - last.x, e.point.y - last.y) < 6) return; // the second click of a double click
      last = { t: now, x: e.point.x, y: e.point.y };
      const s = snapAt(e.point),
        ll = s ? s.ll : [e.lngLat.lng, e.lngLat.lat];
      queue = queue.then(() => add(ll, s && s.id));
    },
    onDbl = (e) => {
      e.preventDefault();
      AHM.emit('draw:finish');
    },
    onKey = (ev) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (ev.key === 'Enter') AHM.emit('draw:finish');
      else if (ev.key === 'Escape') AHM.emit('draw:cancel');
      else if (ev.key === 'Backspace' || (ev.key.toLowerCase() === 'z' && (ev.ctrlKey || ev.metaKey))) {
        ev.preventDefault();
        undo();
      }
    };
  pts.forEach((p, i) => vertex(p, ids[i]));
  decorate();
  map.on('click', onClick);
  map.on('dblclick', onDbl);
  document.addEventListener('keydown', onKey);
  map.doubleClickZoom.disable();
  map.getCanvas().style.cursor = 'crosshair';
  hideMenu();
  paint();
  rebuildMids();
  shapeDrawing = {
    getGeometry: geom,
    count: () => pts.length,
    points: () => pts.map((p) => p.slice()), // the points, also when there are too few for a geometry
    ids: () => ids.slice(), // for each point the place it sits on, or null (a free waypoint)
    flags: () => flags.slice(), // for each point 'road' (it only gives a road its course) or null
    ready: () => queue, // resolves when every click so far has become a point
    undo,
    remove() {
      shapeDrawing.dead = true;
      map.off('click', onClick);
      map.off('dblclick', onDbl);
      document.removeEventListener('keydown', onKey);
      marks.forEach((m) => m.remove());
      mids.forEach((m) => m.remove());
      map.getSource('ahm-draw').setData(EMPTY);
      map.doubleClickZoom.enable();
      map.getCanvas().style.cursor = '';
      shapeDrawing = null;
    },
  };
  return shapeDrawing;
}
const endDraw = () => shapeDrawing && shapeDrawing.remove();

Object.assign(AHM.map, {
  setShapes(fc) {
    shapesNow = fc;
    const s = mapReady && map.getSource('ahm-shapes');
    if (s) s.setData(fc);
  },
  highlightShape(id) {
    if (!mapReady || !map.getSource('ahm-shapes')) {
      shapeSel = id;
      return;
    }
    if (shapeSel) map.setFeatureState({ source: 'ahm-shapes', id: shapeSel }, { selected: false });
    shapeSel = id;
    if (id) map.setFeatureState({ source: 'ahm-shapes', id }, { selected: true });
  },
  /** Shows a colour or an opacity before it is saved; null puts the saved look back. */
  previewShape(id, look) {
    if (!mapReady || !map.getSource('ahm-shapes')) return;
    const t = { source: 'ahm-shapes', id };
    if (look) map.setFeatureState(t, look);
    else map.removeFeatureState(t, 'color'), map.removeFeatureState(t, 'opacity');
  },
  showPreview(geometry) {
    const s = mapReady && map.getSource('ahm-preview');
    if (s) s.setData(geometry ? { type: 'Feature', geometry, properties: {} } : EMPTY);
  },
  /** The path found between two places: a MultiLineString, or null to clear it. */
  showFound(geometry) {
    foundNow = geometry ? { type: 'Feature', geometry, properties: {} } : null;
    const f = mapReady && map.getSource('ahm-found');
    if (f) f.setData(foundNow || EMPTY);
  },
  /** The name of the river of the base map under a point [lon, lat] (the nearest waterway within 10 px that has a name), or ''. */
  riverNameAt(p) {
    if (!mapReady) return '';
    const pt = map.project(p),
      f = map
        .queryRenderedFeatures([[pt.x - 10, pt.y - 10], [pt.x + 10, pt.y + 10]])
        .find((x) => x.sourceLayer === 'waterway' && x.properties && (x.properties.name || x.properties['name:latin']));
    return f ? f.properties.name || f.properties['name:latin'] : '';
  },
  /** The height profile of a shape: a route, a river or the outline of an area (a section of it between the points `from` and `to`
   *  [lon, lat] when both are given). Resolves to { length (km), dist[] (km), pts[] ([lon, lat] of each sample), h[] (m, NaN where
   *  unknown), min, max, up, down, fall, slope } or null: no such shape, or no heights (tiles not available). */
  async profile(id, opts = {}) {
    const lines = [];
    ((shapesNow && shapesNow.features) || []).forEach((f) => {
      const g = f.properties.id === id && (f.properties.kind === 'line' || f.properties.kind === 'area') ? f.geometry : null;
      if (!g) return;
      if (g.type === 'LineString') lines.push(g.coordinates);
      else if (g.type === 'MultiLineString') lines.push(...g.coordinates);
      else if (g.type === 'Polygon') lines.push(g.coordinates[0]);
      else if (g.type === 'MultiPolygon') lines.push(...g.coordinates.map((p) => p[0]));
    });
    if (!lines.length) return null;
    const len = (l) => l.reduce((s, p, i) => (i ? s + terrainKm(l[i - 1], p) : 0), 0);
    const near = (l) => Math.min(...l.map((p) => terrainKm(opts.from, p)));
    let line = opts.from ? lines.reduce((a, b) => (near(b) < near(a) ? b : a)) : lines.reduce((a, b) => (len(b) > len(a) ? b : a));
    if (opts.from && opts.to) line = lineSection(line, opts.from, opts.to);
    if (!line || line.length < 2) return null;
    return profileOf(line).catch(() => null);
  },
  /** A white ring with a red edge at [lon, lat] (the point of the height chart under the cursor); null removes it. */
  profileMark(p) {
    if (!mapReady) return;
    let src = map.getSource('ahm-profile-mark');
    if (!src) {
      map.addSource('ahm-profile-mark', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'ahm-profile-mark', type: 'circle', source: 'ahm-profile-mark', paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': '#d7191c', 'circle-stroke-width': 3 } });
      src = map.getSource('ahm-profile-mark');
    }
    if (src) src.setData(p ? { type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} } : EMPTY);
  },
  drawShape,
  isDrawing: () => !!shapeDrawing,
});
