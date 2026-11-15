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
  bbox: [37, 37, 49, 42.5], // Armenian Highlands (W, S, E, N), biases search
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
    // Relief: hillshade over the vector map from terrain tiles you build and host yourself (docs/10, "Relief layer (optional)").
    // With empty `tiles` the entry "Map + relief" is not shown and nothing is requested. The area is `bbox` above (the tiles are built for it).
    terrain: {
      tiles: [], // e.g. ["https://your-forum.example/ahm-terrain/v1/{z}/{x}/{y}.webp"] (a version folder: a new build goes to v2)
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 11, // the zoom the tiles were built to; beyond it the map enlarges the last level
      // Required wording of the licence for adapted data; the same text is in the NOTICE.txt that the build tool writes. Do not change it.
      attribution:
        "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved",
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
