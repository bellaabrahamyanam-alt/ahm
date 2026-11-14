// Sidebar actions: directions, the actions of the point card, the geocoder search, add / edit a place or a note.
// ---- directions ----
const ptName = (p) =>
  p
    ? p.name || p.lat.toFixed(4) + ", " + p.lon.toFixed(4)
    : "—  choose on the map";
function renderRoute() {
  $("#rFrom").textContent = ptName(rt.a);
  $("#rTo").textContent = ptName(rt.b);
  $("#rInfo").textContent = rtInfo;
}
function markers() {
  AHM.map.setRouteMarkers(rt);
}
function setPt(k, p) {
  rt[k] = p;
  markers();
  tab("route");
  if (rt.a && rt.b) doRoute();
  else {
    rtInfo =
      "Now choose the " +
      (k === "a" ? "destination" : "start") +
      " on the map.";
    renderRoute();
  }
}
function doRoute() {
  rtInfo = "Routing…";
  renderRoute();
  route(rt.a, rt.b)
    .then((r) => {
      AHM.map.setRoute(r.geometry);
      rtInfo = `${r.km.toFixed(1)} km · ${Math.round(r.min)} min by car`;
      renderRoute();
      AHM.map.fitRoute(r.geometry.coordinates);
    })
    .catch((e) => {
      rtInfo = "No route found (" + e.message + ")";
      renderRoute();
    });
}
$("#rSwap").onclick = () => {
  [rt.a, rt.b] = [rt.b, rt.a];
  markers();
  rt.a && rt.b ? doRoute() : renderRoute();
};
$("#rClear").onclick = () => {
  rt = { a: null, b: null };
  rtInfo = "";
  markers();
  AHM.map.setRoute(null);
  renderRoute();
};
// ---- actions from the point card and the detail view ----
function act(a, p) {
  if (a === "from") setPt("a", p);
  else if (a === "to") setPt("b", p);
  else if (a === "add") openDlg("place", p);
  else if (a === "note") openDlg("note", p);
  else if (a === "editplace") editPlace(p);
}
$("#detail").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"), // an icon button: the click lands on its svg
    a = b && b.dataset.act;
  if (!a) return;
  if (a === "canceledit") show(cur.id);
  else if (a === "saveedit") saveEditPlace();
  else if (a === "closedetail") closeDetail();
  else if (a === "dockmax") setDockFull(!dockFull);
  else if (a === "editnote")
    openDlg(
      "note",
      cur,
      notes.find((n) => n.id === b.dataset.id),
    );
  else if (cur)
    act(
      a,
      a === "note" || a === "editplace"
        ? cur
        : { lon: cur.lon, lat: cur.lat, name: label(cur, $("#lang").value) },
    );
});
// ---- search: Enter looks for other places in the geocoder, Esc clears ----
$("#q").addEventListener("input", () => {
  if ($("#q").value === "") $("#geo").innerHTML = ""; // the ✕ (or Esc) also drops the other-places results
  // searching is navigation too: go back to the results (and to the Explore tab)
  if (cur && !editMk) closeDetail();
  if (curTab !== "explore" && $("#q").value) tab("explore");
});
$("#q").addEventListener("keydown", (e) => {
  // Enter searches other places (OpenStreetMap); typing never does (public-server policy)
  if (e.key === "Enter") doGeo();
  if (e.key === "Escape") {
    $("#q").value = "";
    $("#geo").innerHTML = "";
    searchFieldSync();
    update();
  }
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    cur &&
    !$("#dlg").open &&
    !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)
  )
    closeDetail();
});
const OSM_CREDIT =
  '<div class="sn">Search: Nominatim · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></div>';
function doGeo() {
  const q = $("#q").value.trim();
  if (q.length < 3) return;
  $("#geo").innerHTML = '<div class="sn">Searching…</div>';
  geocode(q, $("#lang").value || "en")
    .then((rs) => {
      geoRes = rs;
      $("#geo").innerHTML =
        (rs.length
          ? '<div class="label">Other places (OpenStreetMap)</div><ul>' +
            rs.map((r, i) => `<li data-i="${i}">${esc(r.name)}</li>`).join("") +
            "</ul>"
          : '<div class="sn">No other places found.</div>') + OSM_CREDIT;
    })
    .catch(() => {
      $("#geo").innerHTML =
        '<div class="sn">The search service is not available right now.</div>';
    });
}
$("#geo").addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  const r = geoRes[li.dataset.i];
  AHM.map.focusPoint(r, 11);
  pickPoint({ lon: r.lon, lat: r.lat, name: r.name.split(",")[0] });
});
// ---- add place / add note / edit place ----
placeFormWire($("#dPlaceForm"));
placeFormWire($("#detail"));
dfWire($("#nDate"));

function openDlg(mode, p, note) {
  dlg = { mode, p, note };
  $("#dErr").textContent = "";
  $("#dPlace").style.display = mode === "place" ? "" : "none";
  $("#dTitle").textContent =
    mode === "place"
      ? "New place"
      : (note ? "Edit note" : "New note") + " · " + label(p, $("#lang").value);
  if (mode === "place")
    $("#dPlaceForm").innerHTML = placeFormHTML({
      lat: p.lat.toFixed(6),
      lon: p.lon.toFixed(6),
      type: "settlement",
      date_from: null,
      date_to: null,
      height_m: null,
      names: [{ lang: $("#lang").value || "en", name: p.name || "" }],
    });
  lyDlgLayers(mode, p, note);
  $("#nLang").innerHTML = langOptions(note ? note.lang : $("#lang").value || "en");
  $("#nDate").innerHTML = dfHTML("n-date", note ? note.date : null);
  $("#nTitle").value = note ? note.title : "";
  $("#nText").value = note ? (noteText[note.id] || note.text).trim() : "";
  $("#dlg").showModal();
}
$("#dCancel").onclick = () => $("#dlg").close();

// Sends one change to the server, reloads the data and shows the place.
async function saveAndShow(body) {
  const r = await fetch(AHM_CONFIG.url.save, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Error("Save failed: " + (j.error || r.status));
  const [p, n] = await Promise.all([loadPlaces(), loadNotesIndex()]);
  setData(p, n);
  await lyReload(); // layers changed too (a new place may have joined some)
  show(j.id);
}
$("#dSave").onclick = async () => {
  if (dlg.mode === "lnote") return lyDlgSave(); // a note of a layer
  const body = {},
    text = $("#nText").value.trim(),
    tagged = lyDlgChecked();
  try {
    if (dlg.mode === "place") {
      body.place = readPlaceForm($("#dPlaceForm"));
      if (tagged.length) body.layer_ids = tagged;
    } else body.place_id = dlg.p.id;
    if (text) {
      if (!$("#nTitle").value.trim()) throw Error("A note needs a title.");
      body.note = {
        id: dlg.note && dlg.note.id,
        lang: $("#nLang").value,
        title: $("#nTitle").value.trim(),
        date: dfRead($("#nDate .df"), "Note date"), // optional: null when the date is unknown
        text,
      };
      if (tagged.length || dlg.mode === "note") body.note.layers = tagged;
    } else if (dlg.mode === "note") throw Error("Write the note text.");
    await saveAndShow(body);
    $("#dlg").close();
    AHM.map.setPick(null);
    $("#pick").innerHTML = "";
  } catch (e) {
    $("#dErr").textContent = e.message;
  }
};

// ---- edit a place in the sidebar: drag the pin (or type the coordinates), change names, type, dates ----
function editPlace(p) {
  stopEditPlace();
  cur = p;
  AHM.state.set('selected', p.id);
  placeDetail();
  $("#detail").innerHTML =
    '<div class="dock-head"><h3 class="dock-title">Edit place</h3></div>' +
    '<div class="dock-body"><div class="sn">Drag the red pin on the map to move the place, or type the coordinates.</div>' +
    placeFormHTML(p) +
    '</div><div class="dock-foot"><div id="pfErr" class="sn err-line"></div><button class="primary" data-act="saveedit">Save</button><button data-act="canceledit">Cancel</button></div>';
  AHM.map.hidePlace(p.id); // hide the old symbol so the pin does not leave a ghost behind
  editMk = AHM.map.editPin(p, (l) => {
    $("#detail .pf-lat").value = l.lat.toFixed(6);
    $("#detail .pf-lon").value = l.lon.toFixed(6);
  });
}
function stopEditPlace() {
  if (!editMk) return;
  editMk.remove();
  editMk = null;
  AHM.map.hidePlace(null);
}
async function saveEditPlace() {
  const err = $("#pfErr");
  try {
    const v = readPlaceForm($("#detail"));
    err.textContent = "Saving…";
    await saveAndShow({ place_update: { id: cur.id, ...v } });
  } catch (e) {
    err.textContent = e.message;
  }
}
$("#detail").addEventListener("input", (e) => {
  // typing coordinates moves the pin
  if (!editMk || !e.target.matches(".pf-lat, .pf-lon")) return;
  const lat = parseFloat($("#detail .pf-lat").value),
    lon = parseFloat($("#detail .pf-lon").value);
  if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
    editMk.setPosition({ lon, lat });
});
