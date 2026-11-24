// Sidebar start-up: events from the map, then the data is loaded and the lists are drawn. Loaded last of the sidebar files.
// ---- events from the map (INTERFACES.md, I-2) ----
AHM.on("place:click", ({ id }) => (lyState.editing ? lyToggleMember(id) : show(id)));
// the map moves by itself (AHM.map.focusPlace, the move the list row uses); the sidebar only opens the place
AHM.on("place:dblclick", ({ id }) => {
  if (!lyState.editing && (!cur || cur.id !== id)) show(id);
});
AHM.on("map:show-controls", () => tab("maps"));
AHM.on("map:click", (p) => {
  if (!lyState.editing) return pickPoint(p);
  if (p.shapes && p.shapes.length) lyToggleMember(p.shapes[0].id); // choosing members: a click inside a border picks it
});
// ---- start ----
// offline / back online: said once, as a toast (a save that fails shows its own error in its form)
if (typeof window !== "undefined" && window.addEventListener && typeof uiToast === "function") {
  window.addEventListener("offline", () => uiToast("You are offline: changes cannot be saved.", "error"));
  window.addEventListener("online", () => uiToast("Back online.", "ok"));
}
const stateHtml = (kind, msg, retry) => (typeof uiState === "undefined" ? esc(msg) : uiState.html(kind, msg, retry)); // components.js is not loaded in every test page
renderRoute();
$("#list").innerHTML = stateHtml("loading", "Loading places…");
Promise.all([loadPlaces(), loadNotesIndex(), loadLanguages(), loadLayers(), loadLayerNotes(), loadCategories(), loadShapes(), loadTypes(), loadSources()])
  .then(([p, n, l, ly, ln, cs, sp, ty, so]) => {
    languages = l;
    sources = so;
    renderLangs();
    types = ty;
    setShapeTypes(types);
    AHM.map.setTypes(types);
    renderTypes();
    setData(p, n);
    shSet(sp);
    lySet(ly, ln, cs);
    update();
    ftRender();
    if (location.hash.startsWith("#place-")) show(location.hash.slice(7));
    else if (location.hash.startsWith("#layer-")) lyOpen(location.hash.slice(7));
    else if (location.hash.startsWith("#border-")) shOpen(location.hash.slice(8), true);
    else if (location.hash.startsWith("#route-")) rtOpen(location.hash.slice(7), true);
  })
  .catch(
    (e) =>
      (($("#count").textContent = "Could not load data (" + e.message + ")."), ($("#list").innerHTML = stateHtml("error", "Could not load the data (" + e.message + ").", true))),
  );
