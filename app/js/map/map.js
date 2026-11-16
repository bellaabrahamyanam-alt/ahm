// Map rendering: vector base map, satellite, toggles, our markers, route line (map domain).
// The map knows nothing about the sidebar. It receives commands through AHM.map.* and reports clicks through AHM.emit
// (INTERFACES.md, I-2). It starts itself at the end of this file.
let map, tip;
let mapReady = false,
  featuresNow = null, // the last feature collection received (drawn as soon as the map is ready)
  hiddenId = null,
  selectedId = null, // id of the selected place (event state:selected), drawn by the selected look
  hoverId = null, // the place whose symbol is lifted under the mouse
  hoverCluster = null, // the bubble under the mouse
  pendingClick = null, // timer of a single click on a place: a double click cancels it
  lastHit = null, // the last click on a place: {id, at, x, y, t}; a second click near it within DBL_WINDOW_MS is a double click
  lastDblAt = 0, // when the last double click on a place was handled (the click path and the dblclick event must not both move the map)
  pickMarker = null,
  menu = null, // the popup with the actions for a clicked empty point
  routeMarkers = {};
const CLUSTER_RADIUS = 50; // px: places this close together become one bubble
const CLUSTER_MAX_ZOOM = 11; // from zoom 12 on every place is drawn on its own
const DBL_CLICK_MS = 300; // a single click on a place waits this long, in case a double click follows
const DBL_WINDOW_MS = 600; // two clicks on the same spot within this time are a double click
const TIP_GAP = 6; // px between the bullet's edge and the tooltip
const BUBBLE = "#3a3f44";
const BUBBLE_HOVER = "#5a6168";
const SEL_SCALE = 1.25; // the selected symbol is this much larger than the others
const SIZE_STOPS = [
  [4, 0.55],
  [8, 0.8],
  [11, 1],
]; // [zoom, symbol size]: small when the map is zoomed out, full size from zoom 11
const sizeByZoom = (k) => ["interpolate", ["linear"], ["zoom"], ...SIZE_STOPS.flatMap(([z, s]) => [z, s * k])];
function zoomScale(z) {
  if (z <= SIZE_STOPS[0][0]) return SIZE_STOPS[0][1];
  for (let i = 1; i < SIZE_STOPS.length; i++) {
    const [z0, s0] = SIZE_STOPS[i - 1],
      [z1, s1] = SIZE_STOPS[i];
    if (z <= z1) return s0 + ((s1 - s0) * (z - z0)) / (z1 - z0);
  }
  return SIZE_STOPS[SIZE_STOPS.length - 1][1];
}
// where the point menu sits relative to the clicked point, for every side the library may choose (the grey pin is about 40px high)
const MENU_OFFSET = {
  center: [0, 0],
  top: [0, 12],
  "top-left": [0, 12],
  "top-right": [0, 12],
  bottom: [0, -40],
  "bottom-left": [0, -40],
  "bottom-right": [0, -40],
  left: [14, -20],
  right: [-14, -20],
};
const SEL = {
  symbol: "ahm-highlight-symbol", // the selected place: its marker with a white border, a little larger
};
const EMPTY = { type: "FeatureCollection", features: [] };
const GROUPS = {
  Water: ["water", "waterway"],
  Roads: ["transportation", "transportation_name"],
  Places: ["place"],
  Boundaries: ["boundary"],
};
const view = { sat: null, relief: false, off: new Set() }; // sat = id of the active satellite source, or null
const RELIEF = "@relief"; // value of the dropdown entry (a satellite id never starts with @)
const terrainOn = () => {
  const t = AHM_CONFIG.basemap.terrain;
  return !!(t && t.tiles && t.tiles.length);
};
// Relief settings the controls change. `color` exists only when the config has a `terrain.color` section.
const relief = { color: true, shade: true, ramp: null, custom: null, opacity: 0.65, strength: 0.5, adapt: true, smooth: true, blend: true, range: null, contours: false, interval: "auto" }; // range = [low, high] metres in view; custom = the stops edited by the user
const prof = { on: false, pts: [] }; // the height profile: drawing mode and clicked points [lng, lat]
const colorOn = () => !!(terrainOn() && AHM_CONFIG.basemap.terrain.color && AHM_CONFIG.basemap.terrain.color.ramps);
// MapLibre needs strictly rising stops: sort by height, and nudge a repeated height up by 0.1 m.
// blend true: the colour slides from one stop to the next (the look so far). blend false: flat bands, [stop i, stop i+1) has the colour of stop i,
// below the first stop the first colour, above the last the last one. Done with the same `interpolate`: before every boundary the colour of
// the band below is repeated at boundary - BAND_EDGE, so the slide between the two inputs is only 0.01 m wide (the Terrarium step is 1/256 m = 0.004 m).
// (A `step` expression would be cleaner, but whether color-relief-color accepts it in MapLibre 5.24.1 could not be checked here.) The ONE place to swap.
const BAND_EDGE = 0.01;
function rampExpression(stops, blend = relief.blend) {
  const s = stops.map(([m, c]) => [Number(m), c]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < s.length; i++) if (s[i][0] <= s[i - 1][0]) s[i][0] = s[i - 1][0] + 0.1; // after this the gaps are >= 0.1 > BAND_EDGE
  const out = blend ? s : s.flatMap(([m, c], i) => (i ? [[m - BAND_EDGE, s[i - 1][1]], [m, c]] : [[m, c]]));
  return ["interpolate", ["linear"], ["elevation"], ...out.flat()];
}
const baseStops = () => {
  const r = AHM_CONFIG.basemap.terrain.color.ramps;
  const st = relief.ramp === "__custom" && relief.custom ? relief.custom : (r[relief.ramp] || r[Object.keys(r)[0]]).stops;
  return st.map(([m, c]) => [Number(m), c]).sort((a, b) => a[0] - b[0]);
};
// With "adapt" the ramp is stretched so that its first stop is the lowest and its last stop the highest height in view.
const rampStops = () => {
  const b = baseStops();
  if (!relief.adapt || !relief.range) return b;
  const [lo, hi] = relief.range;
  const m0 = b[0][0];
  const span = b[b.length - 1][0] - m0 || 1;
  return b.map(([m, c]) => [lo + ((m - m0) / span) * (hi - lo), c]);
};
// Hillshade from our own terrain tiles. Added when first chosen, so nothing is requested until then. It goes below the first base-map
// symbol layer: labels, markers and our own layers stay above it.
function ensureRelief() {
  if (map.getLayer("ahm-relief")) return;
  const t = AHM_CONFIG.basemap.terrain;
  map.addSource("ahm-terrain", {
    type: "raster-dem",
    tiles: t.tiles,
    encoding: t.encoding,
    tileSize: t.tileSize,
    maxzoom: t.maxzoom,
    ...(t.bounds ? { bounds: t.bounds } : {}), // only for OWN tiles: no requests outside the built area (a missing file would reach PHP). The AWS tiles cover the world
    attribution: t.attribution,
  });
  const layers = map.getStyle().layers;
  const before =
    layers.find((l) => l.type === "symbol" && !l.id.startsWith("ahm-")) ||
    layers.find((l) => l.id.startsWith("ahm-") && !l.id.startsWith("ahm-sat-"));
  if (colorOn())
    map.addLayer(
      {
        id: "ahm-relief-color",
        type: "color-relief",
        source: "ahm-terrain",
        paint: { "color-relief-color": rampExpression(rampStops()), "color-relief-opacity": relief.opacity },
      },
      before && before.id,
    );
  map.addLayer(
    { id: "ahm-relief", type: "hillshade", source: "ahm-terrain", paint: { ...t.paint, "hillshade-exaggeration": relief.strength } },
    before && before.id,
  );
}
function applyVis() {
  if (view.relief) ensureRelief();
  if (map.getLayer("ahm-relief"))
    map.setLayoutProperty("ahm-relief", "visibility", view.relief && relief.shade ? "visible" : "none");
  if (map.getLayer("ahm-relief-color"))
    map.setLayoutProperty("ahm-relief-color", "visibility", view.relief && relief.color ? "visible" : "none");
  ["ahm-contour", "ahm-contour-label"].forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", view.relief && relief.contours ? "visible" : "none");
  });
  $("#relief-opts").hidden = !(view.relief && colorOn());
  // the credit of the terrain data as plain text in the page: MapLibre's own control may be collapsed to "(i)" or skip a source
  const credit = view.relief && terrainOn() ? AHM_CONFIG.basemap.terrain.attribution || "" : "";
  $("#base-credit").textContent = credit;
  $("#base-credit").hidden = !credit;
  map.getStyle().layers.forEach((l) => {
    if (l.id.startsWith("ahm-")) return;
    const g = Object.keys(GROUPS).find((k) =>
      GROUPS[k].includes(l["source-layer"]),
    );
    const hide =
      (g && view.off.has(g)) ||
      (view.sat && ["background", "fill", "fill-extrusion"].includes(l.type));
    map.setLayoutProperty(l.id, "visibility", hide ? "none" : "visible");
  });
  AHM_CONFIG.basemap.satellites.forEach((s) =>
    map.setLayoutProperty(
      "ahm-sat-" + s.id,
      "visibility",
      view.sat === s.id ? "visible" : "none",
    ),
  );
  if (map.getLayer("ahm-labels")) {
    // dark text on the light map, light text on satellite imagery
    map.setPaintProperty(
      "ahm-labels",
      "text-color",
      view.sat ? "#ffffff" : "#333C43",
    );
    map.setPaintProperty(
      "ahm-labels",
      "text-halo-color",
      view.sat ? "#000000" : "#ffffff",
    );
  }
}
function initMap() {
  const b = AHM_CONFIG.basemap;
  map = new maplibregl.Map({
    container: "map",
    style: b.style,
    center: AHM_CONFIG.center,
    zoom: AHM_CONFIG.zoom,
  });
  $("#basemap").innerHTML =
    '<option value="">Map</option>' +
    b.satellites
      .map((s) => `<option value="${s.id}">${s.label}</option>`)
      .join("") +
    (terrainOn() ? `<option value="${RELIEF}">Map + relief</option>` : "");
  initReliefControls();
  map.on("error", (e) => {
    if (e.sourceId === "ahm-terrain")
      $("#status").textContent =
        "Relief tiles failed to load: " +
        ((e.error && e.error.message) || "unknown error");
    if ((e.sourceId || "").startsWith("ahm-sat-"))
      $("#status").textContent =
        "Satellite tiles failed to load: " +
        ((e.error && e.error.message) || "unknown error");
  });
  map.addControl(new maplibregl.NavigationControl(), "top-right");
  if (map.setPadding) map.setPadding(viewPad(0)); // the first view is centred beside the open panel
  map.on("load", () => {
    const first = map.getStyle().layers[1];
    b.satellites.forEach((s) => {
      map.addSource("ahm-sat-" + s.id, {
        type: "raster",
        tiles: s.tiles,
        tileSize: 256,
        maxzoom: s.maxzoom,
        attribution: s.attribution,
      });
      map.addLayer(
        {
          id: "ahm-sat-" + s.id,
          type: "raster",
          source: "ahm-sat-" + s.id,
          layout: { visibility: "none" },
        },
        first && first.id,
      );
    });
    map.addSource("ahm-route", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "ahm-route",
      type: "line",
      source: "ahm-route",
      paint: { "line-color": "#1d6fd1", "line-width": 5, "line-opacity": 0.8 },
    });
    map.addSource("ahm-places", {
      type: "geojson",
      data: EMPTY,
      cluster: true,
      clusterRadius: CLUSTER_RADIUS,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
    });
    map.addSource("ahm-label-src", { type: "geojson", data: EMPTY }); // separate source: a font problem can never hide the markers
    registerTypeIcons(map); // one symbol per place type (shape + colour), see typeicons.js
    map.addLayer({
      // a ring under the marker: the members of the layer being edited, or the colour of an "only" layer
      id: "ahm-halo",
      type: "circle",
      source: "ahm-places",
      filter: ["all", ["!=", ["get", "halo"], ""], ["!", ["has", "point_count"]]],
      paint: {
        "circle-radius": 17,
        "circle-color": "rgba(255,255,255,0)",
        "circle-stroke-width": 3,
        "circle-stroke-color": ["get", "halo"],
      },
    });
    map.addLayer({
      // a bubble for places close together (zoom 11 and less); the count is drawn on top
      id: "ahm-clusters",
      type: "circle",
      source: "ahm-places",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": BUBBLE,
        "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 30, 22],
      },
    });
    map.addLayer({
      id: "ahm-places",
      type: "symbol",
      source: "ahm-places",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": [
          "coalesce",
          ["image", ["concat", "ahm-type-", ["get", "type_code"]]],
          ["image", "ahm-type-settlement"],
        ],
        "icon-size": sizeByZoom(1),
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
    if (map.getStyle().glyphs) {
      // name labels next to the markers, using a font the base map already provides
      const ops = [
        "step",
        "case",
        "match",
        "get",
        "literal",
        "interpolate",
        "coalesce",
      ];
      const fl = map
        .getStyle()
        .layers.find(
          (l) =>
            l.type === "symbol" &&
            l.layout &&
            Array.isArray(l.layout["text-font"]) &&
            l.layout["text-font"].every((x) => typeof x === "string") &&
            !ops.includes(l.layout["text-font"][0]),
        );
      const font = fl ? fl.layout["text-font"] : ["Noto Sans Regular"];
      labelFont = font; // the border names (shapes.js) use it too
      map.addLayer({
        id: "ahm-labels",
        type: "symbol",
        source: "ahm-label-src",
        layout: {
          "text-field": ["get", "name"],
          "text-font": font,
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 10, 14],
          "text-anchor": "top",
          "text-offset": [0, 1.3],
          "text-optional": true,
          "text-padding": 3,
        },
        paint: {
          "text-color": "#333C43",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });
      map.addLayer({
        id: "ahm-cluster-count",
        type: "symbol",
        source: "ahm-places",
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": font,
          "text-size": 13,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
      });
    }
    // the place under the mouse: a larger symbol in a soft ring (own source and layers, so the symbols underneath never change)
    map.addSource("ahm-hover", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "ahm-hover-symbol",
      type: "symbol",
      source: "ahm-hover",
      layout: {
        "icon-image": [
          "coalesce",
          ["image", ["concat", "ahm-type-", ["get", "type_code"], "-hl"]],
          ["image", "ahm-type-settlement-hl"],
        ],
        "icon-size": sizeByZoom(1),
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
    // the selected place: drawn last, so it is above labels and every other symbol at every zoom
    map.addSource("ahm-highlight", { type: "geojson", data: EMPTY }); // one Point: the selected place, never clustered
    map.addLayer({
      id: SEL.symbol,
      type: "symbol",
      source: "ahm-highlight",
      layout: {
        "icon-image": [
          "coalesce",
          ["image", ["concat", "ahm-type-", ["get", "type_code"], "-hl"]],
          ["image", "ahm-type-settlement-hl"],
        ],
        "icon-size": sizeByZoom(SEL_SCALE),
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity-transition": { duration: 150 } },
    });

    // ---- pointer events -------------------------------------------------------------------------------------
    const hitAt = (e, ids) =>
      map.queryRenderedFeatures(e.point, {
        layers: ids.filter((id) => map.getLayer(id)),
      })[0];
    const placeAt = (e) => hitAt(e, ["ahm-places", "ahm-labels", SEL.symbol]);
    const bubbleAt = (e) => hitAt(e, ["ahm-clusters"]);
    const zoomToBubble = (f) => {
      // zoom to the level where this bubble splits
      const src = map.getSource("ahm-places");
      if (!src) return;
      src
        .getClusterExpansionZoom(f.properties.cluster_id)
        .then((zoom) => map.easeTo({ center: f.geometry.coordinates, zoom }))
        .catch(() => {});
    };
    map.on("click", (e) => {
      if (shapeDrawing || prof.on) return; // the drawing tool (shapes.js) and the height profile own the clicks
      const bubble = bubbleAt(e);
      if (bubble) {
        hideMenu();
        return zoomToBubble(bubble);
      }
      const ours = placeAt(e);
      // the second click of a double click: the same spot within the window, even if the symbol can not be queried at that instant
      const again =
        lastHit && performance.now() - lastHit.t < DBL_WINDOW_MS && Math.hypot(e.point.x - lastHit.x, e.point.y - lastHit.y) < 12
          ? lastHit
          : null;
      if (ours || again) {
        hideMenu();
        const id = ours ? ours.properties.id : again.id;
        const at = ours ? ours.geometry.coordinates : again.at;
        if (again && again.id === id) {
          lastHit = null;
          return placeDblClick(id, at);
        }
        lastHit = { id, at, x: e.point.x, y: e.point.y, t: performance.now() };
        clearTimeout(pendingClick);
        pendingClick = setTimeout(() => {
          pendingClick = null;
          AHM.emit("place:click", { id });
        }, DBL_CLICK_MS);
        return;
      }
      const line = shapeLineAt(e.point); // a click on the line or the outline of a border (shapes.js)
      if (line) {
        hideMenu();
        return AHM.emit("shape:click", { id: line.properties.id });
      }
      const base = map
        .queryRenderedFeatures(e.point)
        .find(
          (f) =>
            !f.layer.id.startsWith("ahm-") && f.properties && f.properties.name,
        );
      AHM.emit("map:click", {
        lon: e.lngLat.lng,
        lat: e.lngLat.lat,
        name: base && base.properties.name,
        shapes: shapesAt(e.point).map((f) => ({ id: f.properties.id })), // the areas under the click, the top one first
      });
    });
    map.on("dblclick", (e) => {
      if (prof.on) return;
      const bubble = bubbleAt(e);
      if (bubble) {
        e.preventDefault();
        return zoomToBubble(bubble);
      }
      const ours = placeAt(e);
      if (!ours && performance.now() - lastDblAt > 500) return; // not on a place
      e.preventDefault(); // no default double-click zoom (also when the click path has just handled this double click)
      if (ours) placeDblClick(ours.properties.id, ours.geometry.coordinates);
    });
    map.on("mouseenter", "ahm-places", (e) => {
      const f = e.features[0];
      map.getCanvas().style.cursor = "pointer";
      liftPlace(f);
      showTip(f.properties, f.geometry.coordinates);
    });
    map.on("mouseleave", "ahm-places", () => {
      map.getCanvas().style.cursor = "";
      liftPlace(null);
      hideTip();
    });
    map.on("mouseenter", SEL.symbol, (e) => {
      // the selected place is not lifted, but it shows the pointer and its tooltip
      const f = e.features[0];
      map.getCanvas().style.cursor = "pointer";
      showTip(f.properties, f.geometry.coordinates, SEL_SCALE);
    });
    map.on("mouseleave", SEL.symbol, () => {
      map.getCanvas().style.cursor = "";
      hideTip();
    });
    map.on("mouseenter", "ahm-clusters", (e) => {
      map.getCanvas().style.cursor = "pointer";
      hoverCluster = e.features[0].properties.cluster_id;
      paintBubbles();
    });
    map.on("mouseleave", "ahm-clusters", () => {
      map.getCanvas().style.cursor = "";
      hoverCluster = null;
      paintBubbles();
    });
    map.on("movestart", hideTip); // the tooltip is anchored to a bullet; a moving map moves the bullet
    $("#groups").innerHTML = Object.keys(GROUPS)
      .map(
        (g) =>
          `<label><input type="checkbox" data-g="${g}" checked> ${g}</label>`,
      )
      .join(" ");
    shapesInit();
    overlaysInit();
    syncOverlays();
    applyVis();
    mapReady = true;
    applyFeatures();
    applyHidden();
    applyHighlight();
    AHM.emit("map:ready");
  });
  AHM.on("sidebar:resized", fitCanvas); // the panel lies on top of the map: normally nothing to do
  AHM.on("state:selected", ({ value }) => {
    selectedId = value == null ? null : value;
    if (mapReady && hoverId != null && hoverId === selectedId) liftPlace(null); // no lift on top of the selected look
    applyFeatures();
    applyHighlight();
  });
  $("#groups").addEventListener("change", (e) => {
    e.target.checked
      ? view.off.delete(e.target.dataset.g)
      : view.off.add(e.target.dataset.g);
    applyVis();
  });
  $("#basemap").addEventListener("change", (e) => {
    const v = e.target.value;
    view.relief = v === RELIEF && terrainOn();
    view.sat = v && v !== RELIEF ? v : null;
    $("#status").textContent = "";
    applyVis();
    scheduleAdapt();
  });
}

// ---- relief colours, controls, contour lines, height profile and height readout (T-039) ----
const SAVE_KEY = "ahm-relief";
function loadSettings() {
  try {
    const o = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    return o && typeof o === "object" ? o : {};
  } catch (e) {
    return {};
  }
}
function saveSettings() {
  try {
    const { ramp, custom, opacity, strength, adapt, smooth, blend, color, shade, contours, interval } = relief;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ramp, custom, opacity, strength, adapt, smooth, blend, color, shade, contours, interval }));
  } catch (e) {
    // private mode or no storage: the settings are just not kept
  }
}
const goodStops = (a) =>
  Array.isArray(a) && a.length >= 2 && a.every((x) => Array.isArray(x) && Number.isFinite(Number(x[0])) && /^#[0-9a-f]{6}$/i.test(x[1]));
function drawReliefLegend() {
  const st = rampStops();
  const lo = st[0][0];
  const span = st[st.length - 1][0] - lo || 1;
  const pc = (m) => (((m - lo) / span) * 100).toFixed(1) + "%";
  // flat bands: the colour of stop i holds up to stop i+1 (two colour stops at the same place give a hard edge)
  $("#relief-legend").style.background =
    "linear-gradient(to right, " +
    (relief.blend
      ? st.map(([m, c]) => c + " " + pc(m))
      : st.flatMap(([m, c], i) => [c + " " + pc(m), c + " " + pc(i + 1 < st.length ? st[i + 1][0] : m)])
    ).join(", ") +
    ")";
  $("#relief-ticks").innerHTML = st.map(([m]) => "<span>" + Math.round(m) + "</span>").join("");
  $("#relief-ticks").title = "metres above sea level";
}
function drawRampList() {
  const c = AHM_CONFIG.basemap.terrain.color;
  $("#relief-ramp").innerHTML =
    Object.keys(c.ramps)
      .map((id) => `<option value="${id}">${esc(c.ramps[id].label)}</option>`)
      .join("") + (relief.custom ? '<option value="__custom">Custom (edited)</option>' : "");
  $("#relief-ramp").value = relief.ramp;
}
// The editor rows show the stops of the chosen ramp as they are (not stretched to the view).
function drawStops() {
  $("#relief-stops").innerHTML = (relief.ramp === "__custom" && relief.custom ? relief.custom : baseStops())
    .map(
      ([m, c], i) =>
        `<div class="rrow"><input type="number" step="50" data-i="${i}" data-k="m" value="${esc(m)}" aria-label="Height in metres"> m ` +
        `<input type="color" data-i="${i}" data-k="c" value="${esc(c)}" aria-label="Colour"><button type="button" data-act="del" data-i="${i}" title="Remove">&times;</button></div>`,
    )
    .join("");
}
// Editing a stop of a built-in ramp first copies that ramp into "Custom".
function ensureCustom() {
  if (relief.ramp === "__custom" && relief.custom) return;
  relief.custom = baseStops().map(([m, c]) => [m, c]);
  relief.ramp = "__custom";
  drawRampList();
}
function paintRamp() {
  if (map.getLayer("ahm-relief-color")) map.setPaintProperty("ahm-relief-color", "color-relief-color", rampExpression(rampStops()));
  drawReliefLegend();
}
function initReliefControls() {
  if (!colorOn()) return;
  const c = AHM_CONFIG.basemap.terrain.color;
  const sv = loadSettings();
  relief.ramp = c.ramps[c.ramp] ? c.ramp : Object.keys(c.ramps)[0];
  relief.opacity = c.opacity;
  relief.adapt = c.adapt !== false;
  relief.blend = c.blend !== false;
  relief.smooth = c.smooth !== false;
  relief.strength = AHM_CONFIG.basemap.terrain.paint["hillshade-exaggeration"];
  // saved settings of the user win over the config, when they are still valid
  if (goodStops(sv.custom)) relief.custom = sv.custom;
  if (c.ramps[sv.ramp] || (sv.ramp === "__custom" && relief.custom)) relief.ramp = sv.ramp;
  if (typeof sv.opacity === "number" && sv.opacity >= 0 && sv.opacity <= 1) relief.opacity = sv.opacity;
  if (typeof sv.strength === "number" && sv.strength >= 0 && sv.strength <= 1) relief.strength = sv.strength;
  ["adapt", "smooth", "blend", "color", "shade", "contours"].forEach((k) => {
    if (typeof sv[k] === "boolean") relief[k] = sv[k];
  });
  if (sv.interval === "auto" || [10, 20, 50, 100, 200, 500, 1000].includes(Number(sv.interval))) relief.interval = String(sv.interval);
  drawRampList();
  drawStops();
  $("#relief-color").checked = relief.color;
  $("#relief-shade").checked = relief.shade;
  $("#relief-adapt").checked = relief.adapt;
  $("#relief-smooth").checked = relief.smooth;
  $("#relief-blend").checked = relief.blend;
  $("#relief-contours").checked = relief.contours;
  $("#relief-interval").value = relief.interval;
  $("#relief-opacity").value = relief.opacity;
  $("#relief-strength").value = relief.strength;
  drawReliefLegend();
  const onChange = () => {
    const rampChanged = relief.ramp !== $("#relief-ramp").value;
    relief.color = $("#relief-color").checked;
    relief.shade = $("#relief-shade").checked;
    relief.adapt = $("#relief-adapt").checked;
    relief.smooth = $("#relief-smooth").checked;
    relief.blend = $("#relief-blend").checked;
    relief.contours = $("#relief-contours").checked;
    relief.interval = $("#relief-interval").value;
    relief.ramp = $("#relief-ramp").value;
    relief.opacity = Number($("#relief-opacity").value);
    relief.strength = Number($("#relief-strength").value);
    if (rampChanged) drawStops();
    if (map.getLayer("ahm-relief-color")) map.setPaintProperty("ahm-relief-color", "color-relief-opacity", relief.opacity);
    if (map.getLayer("ahm-relief")) map.setPaintProperty("ahm-relief", "hillshade-exaggeration", relief.strength);
    paintRamp();
    applyVis();
    scheduleAdapt();
    saveSettings();
  };
  ["#relief-color", "#relief-shade", "#relief-adapt", "#relief-smooth", "#relief-blend", "#relief-ramp", "#relief-contours", "#relief-interval"].forEach((id) =>
    $(id).addEventListener("change", onChange),
  );
  ["#relief-opacity", "#relief-strength"].forEach((id) => $(id).addEventListener("input", onChange));
  // ramp editor (the rows are redrawn only when a stop is added or removed, so typing keeps its focus)
  $("#relief-stops").addEventListener("input", (e) => {
    const t = e.target;
    if (!t.dataset || t.dataset.k == null) return;
    ensureCustom();
    const st = relief.custom[Number(t.dataset.i)];
    if (!st) return;
    if (t.dataset.k === "m") st[0] = Number(t.value);
    else st[1] = t.value;
    paintRamp();
    scheduleAdapt();
    saveSettings();
  });
  $("#relief-stops").addEventListener("click", (e) => {
    const t = e.target;
    if (!t.dataset || t.dataset.act !== "del") return;
    ensureCustom();
    if (relief.custom.length > 2) relief.custom.splice(Number(t.dataset.i), 1);
    drawStops();
    paintRamp();
    saveSettings();
  });
  $("#relief-add").addEventListener("click", () => {
    ensureCustom();
    const last = relief.custom[relief.custom.length - 1];
    relief.custom.push([Number(last[0]) + 200, last[1]]);
    drawStops();
    paintRamp();
    saveSettings();
  });
  $("#relief-reset").addEventListener("click", () => {
    relief.custom = null;
    relief.ramp = c.ramps[c.ramp] ? c.ramp : Object.keys(c.ramps)[0];
    drawRampList();
    drawStops();
    paintRamp();
    saveSettings();
  });
  $("#relief-profile-btn").addEventListener("click", () => {
    prof.on = !prof.on;
    $("#relief-profile-btn").textContent = prof.on ? "Stop drawing" : "Draw height profile";
    map.getCanvas().style.cursor = prof.on ? "crosshair" : "";
  });
  $("#relief-profile-clear").addEventListener("click", clearProfile);
  map.on("click", onProfileClick);
  map.on("mousemove", showHeight);
  map.on("moveend", scheduleAdapt);
}

// ---- heights from the Terrarium tiles: the reader is in terrain.js; here the zoom of the map decides the tile level ----
const sampleAt = (points) => terrainSample(points, map.getZoom());
const fmtM = (m) => Math.round(m).toLocaleString("en");
let heightBusy = false;
async function showHeight(e) {
  if (!view.relief || heightBusy) return;
  heightBusy = true;
  try {
    const [h] = await sampleAt([[e.lngLat.lng, e.lngLat.lat]]);
    $("#relief-height").textContent = Number.isNaN(h) ? "" : "Height: " + fmtM(h) + " m";
  } catch (err) {
    $("#relief-height").textContent = "";
  }
  heightBusy = false;
}

// ---- what is in view: the adaptive colour range and the contour lines (one 96 x 72 grid of heights, read after the map stops moving) ----
const GRID = [128, 96];
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latOfY = (y) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
// "Smooth colours": the stretched range slides from the old to the new one in 400 ms (ease out) instead of jumping. The first range, a switch
// that is off and a range that did not change are applied at once. A new range cancels the animation that is running.
let rangeAnim = 0;
function setRange(to) {
  const from = relief.range;
  const token = ++rangeAnim;
  if (!from || !relief.smooth) {
    relief.range = to;
    return paintRamp();
  }
  if (Math.abs(from[0] - to[0]) < 0.5 && Math.abs(from[1] - to[1]) < 0.5) return;
  const t0 = performance.now();
  const step = (now) => {
    if (token !== rangeAnim) return;
    const k = Math.min(1, (now - t0) / 400);
    const e = 1 - (1 - k) ** 3;
    relief.range = k >= 1 ? to : [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
    paintRamp();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
let adaptTimer = 0;
let viewToken = 0;
function scheduleAdapt() {
  if (!view.relief || !colorOn() || (!relief.adapt && !relief.contours)) return;
  clearTimeout(adaptTimer);
  adaptTimer = setTimeout(viewNow, 250);
}
async function viewNow() {
  const my = ++viewToken;
  const b = map.getBounds();
  const [w, e, yS, yN] = [b.getWest(), b.getEast(), mercY(b.getSouth()), mercY(b.getNorth())];
  const [nx, ny] = GRID;
  const pts = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push([w + ((e - w) * i) / (nx - 1), latOfY(yS + ((yN - yS) * j) / (ny - 1))]);
  const h = await sampleAt(pts).catch(() => null);
  if (!h || my !== viewToken || !view.relief) return;
  const ok = Array.from(h).filter((v) => !Number.isNaN(v)).sort((a, c) => a - c);
  if (ok.length < 8) return;
  if (relief.adapt) {
    // the 2nd and 98th percentile, so that one peak or one gorge does not flatten the rest; at least 20 m apart
    const lo = ok[Math.floor(0.02 * (ok.length - 1))];
    setRange([lo, Math.max(ok[Math.ceil(0.98 * (ok.length - 1))], lo + 20)]);
  }
  if (relief.contours) drawContours(h, ok[0], ok[ok.length - 1], [w, e, yS, yN]);
}
function contourStep() {
  if (relief.interval !== "auto") return Number(relief.interval);
  const z = map.getZoom();
  return z < 7.5 ? 500 : z < 9 ? 200 : z < 10.5 ? 100 : z < 11.5 ? 50 : z < 12.5 ? 20 : 10;
}
function ensureContours() {
  if (map.getSource("ahm-contours")) return;
  const before = map.getStyle().layers.find((l) => l.type === "symbol" && !l.id.startsWith("ahm-"));
  map.addSource("ahm-contours", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer(
    {
      id: "ahm-contour",
      type: "line",
      source: "ahm-contours",
      paint: { "line-color": "#6b4a2b", "line-opacity": 0.7, "line-width": ["case", ["get", "major"], 1.4, 0.6] },
    },
    before && before.id,
  );
  map.addLayer(
    {
      id: "ahm-contour-label",
      type: "symbol",
      source: "ahm-contours",
      filter: ["get", "major"],
      layout: {
        "symbol-placement": "line",
        "text-field": ["concat", ["to-string", ["get", "h"]], " m"],
        "text-font": typeof labelFont !== "undefined" && labelFont ? labelFont : ["Noto Sans Regular"], // labelFont is set by the base-map labels
        "text-size": 10,
      },
      paint: { "text-color": "#5a3f25", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
    },
    before && before.id,
  );
}
function drawContours(h, lo, hi, [w, e, yS, yN]) {
  ensureContours();
  applyVis();
  let step = contourStep();
  while ((hi - lo) / step > 60) step *= 2; // never more than ~60 levels
  const [nx, ny] = GRID;
  const features = [];
  const hs = smoothGrid(h, nx, ny);
  for (let L = Math.ceil(lo / step) * step; L <= hi; L += step)
    for (const line0 of contourLines(hs, nx, ny, L)) {
      const line = chaikin(line0, 2);
      features.push({
        type: "Feature",
        properties: { h: L, major: Math.round(L / step) % 5 === 0 },
        geometry: { type: "LineString", coordinates: line.map(([x, y]) => [w + ((e - w) * x) / (nx - 1), latOfY(yS + ((yN - yS) * y) / (ny - 1))]) },
      });
    }
  map.getSource("ahm-contours").setData({ type: "FeatureCollection", features });
}
// A light blur of the grid (1 2 1 / 2 4 2 / 1 2 1 over 16; at the edge and next to a missing cell the weights are renormalised): it takes the
// stair steps out of the lines. A missing (NaN) cell stays missing.
function smoothGrid(h, nx, ny) {
  const out = new Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      if (Number.isNaN(h[j * nx + i])) {
        out[j * nx + i] = NaN;
        continue;
      }
      let sum = 0;
      let wt = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const x = i + di;
          const y = j + dj;
          if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
          const v = h[y * nx + x];
          if (Number.isNaN(v)) continue;
          const k = (di ? 1 : 2) * (dj ? 1 : 2);
          sum += v * k;
          wt += k;
        }
      out[j * nx + i] = sum / wt;
    }
  return out;
}
// Corner cutting (Chaikin): each round replaces every corner by two points at 1/4 and 3/4 of its segments. A closed line (first point = last
// point) stays closed; an open line keeps its two ends.
function chaikin(line, rounds) {
  let pts = line;
  for (let r = 0; r < rounds; r++) {
    const closed = pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
    const out = closed ? [] : [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    out.push(closed ? out[0] : pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}
// Marching squares on a grid of nx * ny heights (row by row): the lines of height L as arrays of [x, y] in grid units. A cell with a missing
// (NaN) corner has no line. Lines are joined into polylines (closed ones end where they start).
function contourLines(h, nx, ny, L) {
  const segs = [];
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = h[j * nx + i];
      const b = h[j * nx + i + 1];
      const c = h[(j + 1) * nx + i + 1];
      const d = h[(j + 1) * nx + i];
      if (!(a === a && b === b && c === c && d === d)) continue;
      const k = (a >= L ? 8 : 0) | (b >= L ? 4 : 0) | (c >= L ? 2 : 0) | (d >= L ? 1 : 0);
      if (k === 0 || k === 15) continue;
      const E = {
        T: ["h" + i + "," + j, [i + (L - a) / (b - a), j]],
        R: ["v" + (i + 1) + "," + j, [i + 1, j + (L - b) / (c - b)]],
        B: ["h" + i + "," + (j + 1), [i + (L - d) / (c - d), j + 1]],
        Lf: ["v" + i + "," + j, [i, j + (L - a) / (d - a)]],
      };
      const centerHigh = (a + b + c + d) / 4 >= L;
      const pairs = {
        1: [["Lf", "B"]], 2: [["B", "R"]], 3: [["Lf", "R"]], 4: [["T", "R"]],
        5: centerHigh ? [["T", "Lf"], ["B", "R"]] : [["T", "R"], ["Lf", "B"]],
        6: [["T", "B"]], 7: [["T", "Lf"]], 8: [["T", "Lf"]], 9: [["T", "B"]],
        10: centerHigh ? [["T", "R"], ["Lf", "B"]] : [["T", "Lf"], ["B", "R"]],
        11: [["T", "R"]], 12: [["Lf", "R"]], 13: [["B", "R"]], 14: [["Lf", "B"]],
      }[k];
      for (const [p, q] of pairs) segs.push({ a: E[p][0], pa: E[p][1], b: E[q][0], pb: E[q][1] });
    }
  const ends = new Map();
  segs.forEach((sg, n) => [sg.a, sg.b].forEach((key) => (ends.has(key) ? ends.get(key).push(n) : ends.set(key, [n]))));
  const used = new Uint8Array(segs.length);
  const other = (key, from) => (ends.get(key).find((n) => n !== from && !used[n]) ?? -1);
  const lines = [];
  for (let n = 0; n < segs.length; n++) {
    if (used[n]) continue;
    used[n] = 1;
    const pts = [segs[n].pa, segs[n].pb];
    let endKey = segs[n].b;
    let startKey = segs[n].a;
    for (let m = other(endKey, n); m >= 0; m = other(endKey, m)) {
      used[m] = 1;
      const sg = segs[m];
      if (sg.a === endKey) { pts.push(sg.pb); endKey = sg.b; } else { pts.push(sg.pa); endKey = sg.a; }
    }
    for (let m = other(startKey, n); m >= 0; m = other(startKey, m)) {
      used[m] = 1;
      const sg = segs[m];
      if (sg.a === startKey) { pts.unshift(sg.pb); startKey = sg.b; } else { pts.unshift(sg.pa); startKey = sg.a; }
    }
    lines.push(pts);
  }
  return lines;
}

// ---- height profile: click points on the map, the heights along the line are drawn as a chart ----
let profToken = 0;
function ensureProfile() {
  if (map.getSource("ahm-profile")) return;
  const before = map.getStyle().layers.find((l) => l.type === "symbol" && !l.id.startsWith("ahm-"));
  map.addSource("ahm-profile", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "ahm-profile-line", type: "line", source: "ahm-profile", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#d7191c", "line-width": 3 } }, before && before.id);
  map.addLayer({ id: "ahm-profile-pt", type: "circle", source: "ahm-profile", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": "#d7191c", "circle-stroke-width": 2 } }, before && before.id);
}
function onProfileClick(e) {
  if (!prof.on) return;
  prof.pts.push([e.lngLat.lng, e.lngLat.lat]);
  ensureProfile();
  map.getSource("ahm-profile").setData({
    type: "FeatureCollection",
    features: [
      ...(prof.pts.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: prof.pts } }] : []),
      ...prof.pts.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } })),
    ],
  });
  profileNow();
}
async function profileNow() {
  if (prof.pts.length < 2) return;
  const my = ++profToken;
  const r = resampleLine(prof.pts, 120);
  const hs = await sampleAt(r.pts).catch(() => null);
  if (!hs || my !== profToken) return;
  const s = profileStats(Array.from(hs), r.total);
  if (!s) return void ($("#relief-profile-info").textContent = "No heights (tiles not available)");
  $("#relief-profile-info").textContent =
    s.length.toFixed(1) + " km \u00b7 min " + fmtM(s.min) + " m \u00b7 max " + fmtM(s.max) + " m \u00b7 +" + fmtM(s.up) + " m / \u2212" + fmtM(s.down) + " m";
  drawChart(Array.from(hs).filter((x) => !Number.isNaN(x)));
}
function drawChart(v) {
  const cv = $("#relief-profile");
  const cx = typeof cv.getContext === "function" ? cv.getContext("2d") : null;
  if (!cx) return;
  const [W, H] = [cv.width, cv.height];
  const lo = Math.min(...v);
  const hi = Math.max(...v, lo + 1);
  cx.clearRect(0, 0, W, H);
  cx.beginPath();
  cx.moveTo(0, H);
  v.forEach((x, i) => cx.lineTo((i / (v.length - 1)) * W, H - 4 - ((x - lo) / (hi - lo)) * (H - 12)));
  cx.lineTo(W, H);
  cx.closePath();
  cx.fillStyle = "rgba(215,25,28,0.25)";
  cx.fill();
  cx.strokeStyle = "#d7191c";
  cx.stroke();
}
function clearProfile() {
  prof.on = false;
  prof.pts = [];
  profToken++;
  $("#relief-profile-btn").textContent = "Draw height profile";
  $("#relief-profile-info").textContent = "";
  map.getCanvas().style.cursor = "";
  if (map.getSource("ahm-profile")) map.getSource("ahm-profile").setData({ type: "FeatureCollection", features: [] });
  const cv = $("#relief-profile");
  const cx = typeof cv.getContext === "function" ? cv.getContext("2d") : null;
  if (cx) cx.clearRect(0, 0, cv.width, cv.height);
}

// ---- hover and tooltip (task 008) ----
// One Point for the hover and selected layers: it carries the type (symbol) and the symbol radius r (ring sizes).
const pointOf = (coords, props) => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: coords },
      properties: { ...props, r: (TYPE_STYLE[props.type_code] || TYPE_STYLE.settlement).r },
    },
  ],
});
// The place under the mouse is redrawn a little larger inside a soft ring; the symbol never turns transparent.
function liftPlace(f) {
  hoverId = f ? f.properties.id : null;
  const src = map.getSource("ahm-hover");
  if (src) src.setData(f ? pointOf(f.geometry.coordinates, { id: f.properties.id, type_code: f.properties.type_code }) : EMPTY);
}
function paintBubbles() {
  map.setPaintProperty(
    "ahm-clusters",
    "circle-color",
    hoverCluster == null
      ? BUBBLE
      : ["case", ["==", ["get", "cluster_id"], hoverCluster], BUBBLE_HOVER, BUBBLE],
  );
}
function showTip(props, coords, scale = 1) {
  hideTip();
  const style = TYPE_STYLE[props.type_code] || TYPE_STYLE.settlement;
  const sub = [props.type, props.dates].filter(Boolean).map(esc).join(" · ");
  const html = `<div class="tip-title">${esc(props.name || "")}</div><div class="tip-sub">${typeIcon(props.type_code)}${sub}</div>`;
  // no fixed anchor: the library picks the side that keeps the tooltip inside the map (near the sidebar edge it opens to the right)
  tip = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: "ahm-tip",
    maxWidth: "260px",
    offset: style.r * scale * zoomScale(map.getZoom()) + TIP_GAP + 4, // the symbol is smaller when zoomed out; 4px for the border
  })
    .setLngLat(coords)
    .setHTML(html)
    .addTo(map);
}
function hideTip() {
  if (tip) tip.remove();
  tip = null;
}

// A double click on a place: no pending single click, move the map as the list row does, tell the sidebar (it opens the place).
function placeDblClick(id, at) {
  clearTimeout(pendingClick);
  pendingClick = null;
  if (performance.now() - lastDblAt < 500) return; // already handled by the other path
  lastDblAt = performance.now();
  AHM.emit("place:dblclick", { id }); // the sidebar opens the place
  // the move starts after the sidebar has finished its own changes and after the browser's own dblclick event, so nothing can cancel it
  setTimeout(() => AHM.map.focusPlace(id, at), 100);
}
// ---- the menu of a clicked empty point: icon buttons for the actions the sidebar offers (AHM.map.showMenu, event map:menu) ----
function hideMenu() {
  if (!menu) return;
  const m = menu;
  menu = null;
  m.remove(); // fires "close" -> map:menu-close
}
function showMenu(p, actions, title, hint) {
  hideMenu();
  hideTip();
  const el = document.createElement("div");
  el.className = "ahm-menu";
  el.innerHTML =
    `<div class="ahm-menu-title">${esc(title || "")}</div><div class="ahm-menu-sub">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</div>` +
    '<div class="ahm-menu-btns">' +
    actions
      .map(
        (a) =>
          `<button type="button" class="ahm-menu-btn${a.id === "add" ? " primary" : ""}" data-id="${esc(a.id)}" title="${esc(a.label)}" aria-label="${esc(a.label)}">${AHM.icons.svg(a.icon, 20)}</button>`,
      )
      .join("") +
    "</div>" +
    (hint ? `<div class="ahm-menu-hint">${esc(hint)}</div>` : "");
  const pop = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: "ahm-menu-popup",
    maxWidth: "none",
    offset: MENU_OFFSET,
  })
    .setLngLat([p.lon, p.lat])
    .setDOMContent(el)
    .addTo(map);
  pop.on("close", () => {
    if (menu === pop) menu = null;
    AHM.emit("map:menu-close");
  });
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    if (!b) return;
    AHM.emit("map:menu", { action: b.dataset.id, lon: p.lon, lat: p.lat, name: p.name });
    hideMenu();
  });
  menu = pop;
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideMenu();
});

// ---- the selected place (task 004 and 008) ----
const featureSources = ["ahm-places", "ahm-label-src"];
function applyFeatures() {
  if (!mapReady || !featuresNow) return;
  // the selected place is drawn by its own look, so it is never inside a bubble
  const places = map.getSource("ahm-places");
  if (places)
    places.setData(
      selectedId == null
        ? featuresNow
        : {
            type: "FeatureCollection",
            features: featuresNow.features.filter(
              (f) => f.properties.id !== selectedId,
            ),
          },
    );
  const labels = map.getSource("ahm-label-src");
  if (labels) labels.setData(featuresNow);
}
function applyHidden() {
  if (!mapReady) return;
  const hide = hiddenId ? ["!=", ["get", "id"], hiddenId] : null; // hide the old symbol while its pin is edited
  const places = ["all", ["!", ["has", "point_count"]]];
  if (hide) places.push(hide);
  if (map.getLayer("ahm-places")) map.setFilter("ahm-places", places);
  if (map.getLayer("ahm-labels")) map.setFilter("ahm-labels", hide);
}
function applyHighlight() {
  // the selected place is redrawn after every setFeatures and once the map is ready
  const src = mapReady && map.getSource("ahm-highlight");
  if (!src) return;
  const f =
    selectedId != null && featuresNow && featuresNow.features.find((x) => x.properties.id === selectedId);
  // all properties of the place travel with the highlight: its tooltip needs the name, the type and the dates
  src.setData(f ? pointOf(f.geometry.coordinates, f.properties) : EMPTY);
}
// ---- commands for the sidebar: AHM.map.* (INTERFACES.md, I-2) ----
const lngLatOf = (p) => [p.lon, p.lat];
// The sidebar lies on top of the map (the map keeps its size), so a view is centred in the part of the map that stays visible.
function viewPad(base) {
  const p = { top: base, right: base, bottom: base, left: base },
    side = typeof document !== "undefined" && document.getElementById ? document.getElementById("side") : null;
  if (!side || document.body.classList.contains("collapsed")) return p;
  if (typeof matchMedia === "function" && matchMedia("(max-width:700px)").matches) p.bottom = Math.min(base + side.offsetHeight, innerHeight - 160);
  else p.left = Math.min(base + side.offsetWidth, innerWidth - 160);
  return p;
}
// map.resize() empties the canvas until the next paint: call it only when the box of the map really changed.
let canvasW = 0,
  canvasH = 0;
function fitCanvas() {
  const el = map.getContainer ? map.getContainer() : null;
  if (el) {
    if (el.clientWidth === canvasW && el.clientHeight === canvasH) return;
    canvasW = el.clientWidth;
    canvasH = el.clientHeight;
  }
  map.resize();
}
Object.assign(AHM.map, {
  // The types dictionary (I-8). Before the map is ready the table is only updated (the icons are made on load);
  // afterwards the images of every type are made again and the places are redrawn.
  setTypes(list) {
    setTypeStyles(list);
    if (!mapReady) return;
    registerTypeIcons(map);
    applyFeatures();
    applyHighlight();
  },
  getSymbols: getSymbolList,
  setFeatures(fc) {
    featuresNow = fc;
    applyFeatures();
    applyHighlight();
  },
  hidePlace(id) {
    hiddenId = id;
    applyHidden();
  },
  focusPlace(id, at) {
    const f = featuresNow && featuresNow.features.find((x) => x.properties.id === id);
    const center = f ? f.geometry.coordinates : at; // `at` = where the symbol was clicked, if the place is not in the list any more
    // a double click only moves the map to the place: the reader's zoom stays as it is
    if (center) map.flyTo({ center, zoom: map.getZoom(), essential: true, padding: viewPad(0) });
  },
  focusPoint(p, zoom) {
    map.flyTo({ center: lngLatOf(p), zoom, padding: viewPad(0) });
  },
  fitTo(points) {
    if (!points.length) return;
    const b = new maplibregl.LngLatBounds();
    points.forEach((x) => b.extend(x));
    map.fitBounds(b, { padding: viewPad(60), maxZoom: 10 });
  },
  fitRoute(coords) {
    const b = coords.reduce((x, c) => x.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    map.fitBounds(b, { padding: viewPad(60) });
  },
  setRoute(geometry) {
    const s = map.getSource("ahm-route");
    if (s) s.setData(geometry ? { type: "Feature", geometry } : EMPTY);
  },
  setRouteMarkers(m) {
    Object.values(routeMarkers).forEach((x) => x.remove());
    routeMarkers = {};
    ["a", "b"].forEach((k) => {
      if (m[k])
        routeMarkers[k] = new maplibregl.Marker({ color: k === "a" ? "#2a8f4f" : "#1d6fd1" })
          .setLngLat(lngLatOf(m[k]))
          .addTo(map);
    });
  },
  showMenu,
  hideMenu,
  setPick(p) {
    pickMarker && pickMarker.remove();
    pickMarker = p ? new maplibregl.Marker({ color: "#666" }).setLngLat(lngLatOf(p)).addTo(map) : null;
  },
  editPin(p, onMove) {
    const m = new maplibregl.Marker({ draggable: true, color: "#BC2A4D" }).setLngLat(lngLatOf(p)).addTo(map);
    m.on("drag", () => {
      const l = m.getLngLat();
      onMove({ lon: l.lng, lat: l.lat });
    });
    return {
      getPosition() {
        const l = m.getLngLat();
        return { lon: l.lng, lat: l.lat };
      },
      setPosition(q) {
        m.setLngLat(lngLatOf(q));
      },
      remove() {
        m.remove();
      },
    };
  },
  resize() {
    fitCanvas();
  },
  getZoom() {
    return map.getZoom();
  },
});
// start once every script has been loaded (the load handler uses overlays.js)
document.addEventListener("DOMContentLoaded", initMap);
