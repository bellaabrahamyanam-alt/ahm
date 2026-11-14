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
renderRoute();
Promise.all([loadPlaces(), loadNotesIndex(), loadLanguages(), loadLayers(), loadLayerNotes(), loadCategories(), loadShapes(), loadTypes()])
  .then(([p, n, l, ly, ln, cs, sp, ty]) => {
    languages = l;
    renderLangs();
    types = ty;
    AHM.map.setTypes(types);
    renderTypes();
    setData(p, n);
    shSet(sp);
    lySet(ly, ln, cs);
    update();
    if (location.hash.startsWith("#place-")) show(location.hash.slice(7));
    else if (location.hash.startsWith("#layer-")) lyOpen(location.hash.slice(7));
    else if (location.hash.startsWith("#border-")) shOpen(location.hash.slice(8), true);
    else if (location.hash.startsWith("#route-")) rtOpen(location.hash.slice(7), true);
  })
  .catch(
    (e) =>
      ($("#count").textContent = "Could not load data (" + e.message + ")."),
  );
