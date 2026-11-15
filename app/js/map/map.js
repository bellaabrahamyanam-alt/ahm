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
    bounds: t.bounds || AHM_CONFIG.bbox, // no requests outside the built area (a missing file would reach PHP)
    attribution: t.attribution,
  });
  const layers = map.getStyle().layers;
  const before =
    layers.find((l) => l.type === "symbol" && !l.id.startsWith("ahm-")) ||
    layers.find((l) => l.id.startsWith("ahm-") && !l.id.startsWith("ahm-sat-"));
  map.addLayer(
    { id: "ahm-relief", type: "hillshade", source: "ahm-terrain", paint: { ...t.paint } },
    before && before.id,
  );
}
function applyVis() {
  if (view.relief) ensureRelief();
  if (map.getLayer("ahm-relief"))
    map.setLayoutProperty("ahm-relief", "visibility", view.relief ? "visible" : "none");
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
      if (shapeDrawing) return; // the drawing tool (shapes.js) owns the clicks
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
  });
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
