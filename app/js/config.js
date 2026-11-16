// Settings in one place. Later: swap `style` for our own PMTiles style.
const AHM_CONFIG = {
  center: [43.5, 39.8],
  zoom: 5,
  canEdit: window.AHM_BACKEND ? !!window.AHM_BACKEND.canEdit : true, // false for guests: no add/edit buttons
  loggedIn: window.AHM_BACKEND ? !!window.AHM_BACKEND.loggedIn : true,
  loginUrl: window.AHM_BACKEND ? window.AHM_BACKEND.loginUrl : "",
  canOverlay: window.AHM_BACKEND ? !!window.AHM_BACKEND.canOverlay : true, // administrators: manage historical map images
  canLanguage: window.AHM_BACKEND ? !!window.AHM_BACKEND.canLanguage : true, // administrators: add languages to the dictionary
  canTypeAdmin: window.AHM_BACKEND ? !!window.AHM_BACKEND.canTypeAdmin : true, // administrators: add, change and remove place types
  canLayerAdmin: window.AHM_BACKEND ? !!window.AHM_BACKEND.canLayerAdmin : true, // administrators: delete layers, manage categories
  // Optional features (app/features/<name>/, loaded by js/features.js). In the forum: only what the page controller sends in
  // AHM_BACKEND.features (nothing today, so every feature is hidden). In development: the list below; add ?features=a,b to the page
  // URL to choose others, or ?features= to switch all off. Remove a name here to switch that feature off for everyone.
  features: window.AHM_BACKEND
    ? window.AHM_BACKEND.features || []
    : /[?&]features=/.test(location.search)
      ? decodeURIComponent(/[?&]features=([^&]*)/.exec(location.search)[1]).split(",").filter(Boolean)
      : ["campaigns"],
  bbox: [32, 29, 51, 44], // Mesopotamia from the Persian Gulf to the Caucasus, Ankara to Baku (W, S, E, N): biases search, limits relief tiles, sets the terrain build
  // The forum page (controller) sets window.AHM_BACKEND with ready-made URLs; under browser-sync it is undefined.
  url: window.AHM_BACKEND
    ? {
        places: window.AHM_BACKEND.places,
        notesIndex: window.AHM_BACKEND.notesIndex,
        note: (place, id) =>
          window.AHM_BACKEND.note.replace("{place}", place).replace("{id}", id),
        save: window.AHM_BACKEND.save,
        languages: window.AHM_BACKEND.languages,
        languageSave: window.AHM_BACKEND.languageSave,
        types: window.AHM_BACKEND.types,
        typeSave: window.AHM_BACKEND.typeSave,
        typeDelete: window.AHM_BACKEND.typeDelete,
        overlays: window.AHM_BACKEND.overlays,
        overlayImage: (o) =>
          window.AHM_BACKEND.overlayImage.replace("{id}", o.id),
        overlaySave: window.AHM_BACKEND.overlaySave,
        overlayUpload: (id) =>
          window.AHM_BACKEND.overlayUpload.replace("{id}", id),
        overlayDelete: window.AHM_BACKEND.overlayDelete,
        layers: window.AHM_BACKEND.layers,
        layerNotesIndex: window.AHM_BACKEND.layerNotesIndex,
        categories: window.AHM_BACKEND.categories,
        layerSave: window.AHM_BACKEND.layerSave,
        layerDelete: window.AHM_BACKEND.layerDelete,
        categorySave: window.AHM_BACKEND.categorySave,
        shapes: window.AHM_BACKEND.shapes,
        shapeSave: window.AHM_BACKEND.shapeSave,
        shapeDelete: window.AHM_BACKEND.shapeDelete,
      }
    : {
        places: "data/places.geojson",
        notesIndex: "data/notes/index.json",
        note: (place, id) => `data/notes/${place}/${id}.md`,
        save: "/api/save", // dev/save-handler.js (browser-sync middleware)
        languages: "data/languages.json",
        languageSave: "/api/language/save",
        types: "data/types.json",
        typeSave: "/api/type/save",
        typeDelete: "/api/type/delete",
        overlays: "data/overlays.json",
        overlayImage: (o) => "data/overlays/" + o.file,
        overlaySave: "/api/overlay/save",
        overlayUpload: (id) => "/api/overlay/upload/" + id,
        overlayDelete: "/api/overlay/delete",
        layers: "data/layers.json",
        layerNotesIndex: "data/layer-notes/index.json",
        categories: "data/categories.json",
        layerSave: "/api/layer/save",
        layerDelete: "/api/layer/delete",
        categorySave: "/api/category/save",
        shapes: "data/shapes.geojson",
        shapeSave: "/api/shape/save",
        shapeDelete: "/api/shape/delete",
      },
  basemap: {
    style: "https://tiles.openfreemap.org/styles/liberty", // vector tiles
    satellites: [
      // each one becomes an entry in the base-map dropdown
      // Free for NON-COMMERCIAL use only (CC BY-NC-SA 4.0). The attribution wording and links are required by EOX.
      {
        id: "sentinel",
        label: "Satellite (Sentinel-2)",
        maxzoom: 13,
        tiles: [
          "https://tiles.maps.eox.at/wmts/?layer=s2cloudless-2020_3857&style=default&tilematrixset=g&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}",
        ],
        attribution:
          '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by <a href="https://eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2020)',
      },
    ],
    // Relief: hillshade over the vector map. Default: the free AWS terrain tiles (Terrarium, zoom 0-15, worldwide, no hosting by you).
    // The tiles are requested only when "Map + relief" is chosen. Empty `tiles` hides the entry.
    // Own tiles instead (Copernicus GLO-30, docs/10, "Relief layer (optional)"): tiles [".../ahm-terrain/v1/{z}/{x}/{y}.webp"], maxzoom 11, bounds (the same numbers as `bbox`: without it the map asks for tiles you did not build and every miss boots the forum) and the attribution
    // The credit depends on the data the tool used (`terrain.py build` prints the block to paste). GLO-30 only:
    // "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"
    // GLO-90 only:
    // "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"
    // Both (a build that mixes GLO-30 and GLO-90 squares):
    // "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved; produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"
    terrain: {
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 15, // the highest zoom of the AWS tiles; beyond it the map enlarges the last level
      attribution:
        "Terrain tiles: Mapzen/Tilezen on AWS; contain 3DEP, SRTM and GMTED2010 content courtesy of USGS, other sources at github.com/tilezen/joerd/blob/master/docs/attribution.md",
      // Colour by height (MapLibre `color-relief`) under the hillshade. Ramps are [metres above sea level, colour] stops with rising heights;
      // between stops the colour is blended. Add your own ramp here and it appears in the list under the map; `ramp` is the one chosen first.
      color: {
        ramp: "armenia",
        opacity: 0.65, // 0 = no colour, 1 = fully covers the map
        smooth: true, // the colours slide to the new range (about 0.4 s) instead of jumping; false = jump
        adapt: true, // stretch the ramp over the heights in view, so the colours change as you zoom and move; false = the fixed metres of the ramp
        // true = the colour slides from one stop to the next (a gradient). false = flat bands with a sharp edge: from stop i up to the next stop the colour is
        // the one of stop i (500-1000 m with a green stop at 500 is the same green all over); below the first stop the first colour, above the last the last.
        // Not the same as `smooth`, which only animates the slide to a new range.
        blend: true,
        ramps: {
          armenia: {
            label: "Armenia (350-4100 m)",
            stops: [[350, "#3a7f5c"], [800, "#86b36a"], [1300, "#e3dd8c"], [1800, "#d2a860"], [2300, "#b07a48"], [3000, "#8c6552"], [3600, "#c9bcb6"], [4100, "#ffffff"]],
          },
          classic: {
            label: "Classic green-brown-white",
            stops: [[0, "#2e7d4f"], [500, "#7cb45a"], [1000, "#d9d27a"], [1500, "#c9a05a"], [2000, "#a87a4a"], [2800, "#8a6a5a"], [3500, "#cfc4c0"], [4200, "#ffffff"]],
          },
          rainbow: {
            label: "Rainbow",
            stops: [[0, "#2c7bb6"], [1000, "#abd9e9"], [1800, "#ffffbf"], [2600, "#fdae61"], [3400, "#d7191c"], [4100, "#7f0000"]],
          },
          viridis: {
            label: "Viridis",
            stops: [[0, "#440154"], [1000, "#3b528b"], [2000, "#21918c"], [3000, "#5ec962"], [4100, "#fde725"]],
          },
          gray: { label: "Grayscale", stops: [[0, "#000000"], [4100, "#ffffff"]] },
        },
      },
      paint: {
        // MapLibre hillshade paint properties
        "hillshade-exaggeration": 0.5,
        "hillshade-shadow-color": "#4a4a4a",
        "hillshade-highlight-color": "#ffffff",
        "hillshade-accent-color": "#7a7a7a",
        "hillshade-illumination-direction": 335,
      },
    },
  },
  geocodeUrl: "https://nominatim.openstreetmap.org/search",
  routeUrl: "https://router.project-osrm.org/route/v1/driving",
};
