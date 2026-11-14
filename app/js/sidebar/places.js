// Sidebar places: filters and the result list, the selected point, place details and their long notes.
const mark = (t, q) => {
  const i = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return esc(t.slice(0, 100)) + "…";
  const a = Math.max(0, i - 30);
  return (
    (a ? "…" : "") +
    esc(t.slice(a, i)) +
    "<mark>" +
    esc(t.slice(i, i + q.length)) +
    "</mark>" +
    esc(t.slice(i + q.length, i + q.length + 70)) +
    "…"
  );
};
// ---- filters and results ----
function fillLangs() {
  const v = $("#lang").value;
  const langs = [
    ...new Set([
      ...places.flatMap((p) => p.names.map((n) => n.lang)),
      ...notes.map((n) => n.lang),
    ]),
  ].sort();
  $("#lang").innerHTML =
    '<option value="">All languages</option>' +
    langs
      .map((l) => `<option value="${esc(l)}">${esc(langName(l))} (${esc(l)})</option>`)
      .join("");
  $("#lang").value = v;
}
function fillTypes() {
  const c = {},
    l = $("#lang").value;
  places.forEach((p) => (c[p.type] = (c[p.type] || 0) + 1));
  $("#typeChips").innerHTML = Object.keys(c)
    .sort((a, b) => typeLabel(a, l).localeCompare(typeLabel(b, l)))
    .map(
      (t) =>
        `<button class="chip${state.types.has(t) ? " on" : ""}" data-t="${esc(t)}">${typeIcon(t)}${esc(typeLabel(t, l))} <span>${c[t]}</span></button>`,
    )
    .join("");
  renderTypes(); // the list of the Place types fold shows the same names and counts
}
function setData(p, n) {
  places = p;
  notes = n;
  by = {};
  n.forEach((x) => (by[x.place] ??= []).push(x));
  fillLangs();
  fillTypes();
}
function placeRowHTML(p, hits, l, q) {
  return (
    `<li data-id="${p.id}"><div class="t"><span class="tmark" title="${esc(typeLabel(p.type, l))}">${typeIcon(p.type)}</span><b>${esc(label(p, l))}</b></div>` +
    (placeWhen(p) ? `<div class="sn">${esc(placeWhen(p))}</div>` : "") +
    (hits[0] ? `<div class="sn">${mark(hits[0].text, q)}</div>` : "") +
    "</li>"
  );
}
// The details of the open place (#detail) live in the dock under the list; the list keeps all its rows and the open one is marked.
function placeDetail() {
  const d = $("#detail");
  document.querySelectorAll("#list li.on").forEach((x) => x.classList.remove("on"));
  if (!cur) {
    d.hidden = true;
    dockSync();
    return;
  }
  let li = $(`#list li[data-id="${cur.id}"]`);
  if (!li) {
    // the place is filtered out of the list: show its row anyway, so the open place always has a row
    const e = $("#list .empty");
    if (e) e.remove();
    $("#list").insertAdjacentHTML("afterbegin", placeRowHTML(cur, [], $("#lang").value, ""));
    li = $("#list li");
  }
  li.classList.add("on");
  d.hidden = false;
  dockSync();
  revealRow(li);
}
/** What run() needs from the sidebar fields (INTERFACES.md I-3). */
const searchOptions = () => ({ q: $("#q").value, lang: $("#lang").value, sort: $("#sort").value, period: periodBounds() });
function update() {
  const r = run(searchOptions()),
    l = $("#lang").value,
    q = $("#q").value.trim();
  const nf = state.types.size + (l ? 1 : 0) + (periodActive() ? 1 : 0) + lyFilterCount();
  $("#fcount").textContent = nf ? `(${nf})` : "";
  const chip = (k, t) => `<button class="chip on" data-clear="${k}" title="Remove this filter">${t} ✕</button>`;
  // the selected types and the language are shown inside Filters, so only the period is repeated here
  $("#fActive").innerHTML = periodActive() ? chip("period", "period") : "";
  $("#count").textContent = r.length + " of " + places.length + " places";
  $("#list").innerHTML = r.length
    ? r.map(({ p, hits }) => placeRowHTML(p, hits, l, q)).join("")
    : '<li class="empty">No places match. Try fewer filters.</li>';
  placeDetail();
  const fc = {
    type: "FeatureCollection",
    features: r.map(({ p }) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: {
        id: p.id,
        name: label(p, l),
        type: typeLabel(p.type, l),
        type_code: p.type,
        dates: placeWhen(p),
        halo: lyHalo(p.id),
      },
    })),
  };
  AHM.map.setFeatures(fc);
  shRefresh(); // the borders follow the same filters
}
$("#activeBar").addEventListener("click", (e) => {
  const k = e.target.closest("[data-clear]") && e.target.closest("[data-clear]").dataset.clear;
  if (!k) return;
  if (k.startsWith("type:")) state.types.delete(k.slice(5));
  else if (k === "lang") $("#lang").value = "";
  else if (k === "period") initPeriod();
  fillTypes();
  update();
});
["q", "lang", "sort"].forEach((i) =>
  $("#" + i).addEventListener("input", update),
);
// the period filter: two date fields (dfWire first, so a changed format is redrawn before the list is refiltered)
initPeriod();
["#fFrom", "#fTo"].forEach((s) => {
  dfWire($(s));
  ["input", "change"].forEach((ev) => $(s).addEventListener(ev, update));
});
$("#typeChips").addEventListener("click", (e) => {
  const t = e.target.closest(".chip");
  if (!t) return;
  state.types.has(t.dataset.t)
    ? state.types.delete(t.dataset.t)
    : state.types.add(t.dataset.t);
  fillTypes();
  update();
});
$("#reset").onclick = () => {
  ["q", "lang"].forEach((i) => ($("#" + i).value = ""));
  initPeriod();
  state.types.clear();
  lyClearFilters();
  $("#geo").innerHTML = "";
  searchFieldSync();
  fillTypes();
  update();
};
$("#fit").onclick = () => {
  AHM.map.fitTo(run(searchOptions()).map(({ p }) => [p.lon, p.lat]));
};
$("#list").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (!li || e.detail > 1) return; // the second click of a double click is left to the dblclick handler
  if (cur && cur.id === li.dataset.id && !editMk) closeDetail(); // a second click on the open place folds it
  else show(li.dataset.id);
});
// Double click on a place (map or list): open its details if they are not open yet, then move the map to it.
function focusPlace(id) {
  const p = places.find((x) => x.id === id);
  if (!p) return;
  if (!cur || cur.id !== id) show(id);
  AHM.map.focusPlace(id);
}
// A double click zooms; it must not select the name under the pointer (dragging still selects text).
[$("#list"), $("#lyList")].forEach((el) =>
  el.addEventListener("mousedown", (e) => {
    if (e.detail > 1) e.preventDefault();
  }),
);
$("#list").addEventListener("dblclick", (e) => {
  const li = e.target.closest("li[data-id]");
  if (li && !lyState.editing) focusPlace(li.dataset.id);
});
// ---- selected point on the map ----
const edit = (...a) => (AHM_CONFIG.canEdit ? a : []); // add/edit buttons only for people who may change data
const editHint = AHM_CONFIG.canEdit
  ? ""
  : '<div class="sn">' +
    (AHM_CONFIG.loggedIn
      ? "Adding places and notes is limited to administrators."
      : `<a href="${AHM_CONFIG.loginUrl}">Log in</a> to add places and notes.`) +
    "</div>";
const btns = (...a) =>
  a
    .map(([k, t, c]) => `<button data-act="${k}"${c ? ` class="${c}"` : ""}>${t}</button>`)
    .join(" ");
// A click on an empty point of the map opens a small menu at that point (map.js): add place, route from, route to.
const pointActions = (p) => [
  ...(p && p.shapes && p.shapes.length ? [{ id: "border", icon: "area", label: "Open border: " + shapeName(shapeById(p.shapes[0].id), $("#lang").value) }] : []),
  ...(AHM_CONFIG.canEdit ? [{ id: "add", icon: "plus", label: "Add place here" }] : []),
  { id: "from", icon: "route-from", label: "Route from here" },
  { id: "to", icon: "route-to", label: "Route to here" },
];
let pickBusy = false; // "add" opened the dialog: the grey pin stays until the dialog closes
function pickPoint(p) {
  const hint = AHM_CONFIG.canEdit ? "" : AHM_CONFIG.loggedIn ? "Adding places is limited to administrators." : "Log in to add places.";
  AHM.map.showMenu(p, pointActions(p), p.name || "Selected point", hint); // first: it closes the previous menu, which clears the old pin
  pick = p;
  AHM.map.setPick(p);
}
AHM.on("map:menu", ({ action }) => {
  if (!pick) return;
  if (action === "border") {
    const id = pick.shapes[0].id;
    AHM.map.hideMenu();
    return shOpen(id);
  }
  if (action === "add") {
    pickBusy = true;
    openDlg("place", pick);
  } else act(action, pick);
});
AHM.on("map:menu-close", () => {
  if (pickBusy) return;
  pick = null;
  AHM.map.setPick(null);
});
$("#dlg").addEventListener("close", () => {
  pickBusy = false;
  pick = null;
  AHM.map.setPick(null);
});
// ---- place details (open in the list, under the place; the map does not move) ----
const iconBtn = (act, icon, text, extra = "", cls = "") =>
  `<button type="button" class="icon-btn${cls ? " " + cls : ""}" data-act="${act}" ${extra} title="${text}" aria-label="${text}">${AHM.icons.svg(icon, 16)}</button>`;
// The header of the place card: type marker (its title is the type), name, then edit / route from / route to / close.
const placeHeadHTML = (p, l) =>
  `<div class="dock-head"><span class="tmark" title="${esc(typeLabel(p.type, l))}">${typeIcon(p.type)}</span>` +
  `<h3 class="dock-title">${esc(label(p, l))}</h3><span class="dock-btns">` +
  (AHM_CONFIG.canEdit ? iconBtn("editplace", "pencil", "Edit place") : "") +
  iconBtn("from", "route-from", "Route from here") +
  iconBtn("to", "route-to", "Route to here") +
  iconBtn("dockmax", "chevron-down", dockFull ? "Smaller panel" : "Larger panel") +
  iconBtn("closedetail", "close", "Close") +
  "</span></div>";
// The dock can take the whole panel (hiding the list) while a long note is read; the choice is remembered.
// (dockFull, not dockMax: dockMax() is the height limit of the drag-handle above.)
let dockFull = false;
try {
  dockFull = localStorage.getItem("ahm-dock-max") === "1";
} catch (e) {}
$("#dock").classList.toggle("max", dockFull);
function setDockFull(v) {
  dockFull = v;
  $("#dock").classList.toggle("max", v);
  try {
    localStorage.setItem("ahm-dock-max", v ? "1" : "0");
  } catch (e) {}
  const b = $("#detail [data-act=dockmax]");
  if (b) {
    b.title = v ? "Smaller panel" : "Larger panel";
    b.setAttribute("aria-label", b.title);
    requestAnimationFrame(fitNotes);
  }
}
let showSeq = 0;
async function show(id) {
  const p = places.find((x) => x.id === id);
  if (!p) return;
  if (lyState.editing) return lyToggleMember(id); // choosing places for a layer
  if (curTab !== "explore") tab("explore"); // the list lives in the Explore tab
  stopEditPlace();
  AHM.map.hideMenu(); // a chosen place replaces the point menu and its pin
  cur = p;
  const seq = ++showSeq;
  AHM.state.set('selected', p.id);
  const l = $("#lang").value;
  const scope = lyScope(id, true),
    inLang = (by[id] || []).filter((n) => !l || n.lang === l);
  const ns = inLang
    .filter((n) => lyNoteVisible(n, scope))
    .sort((a, b) => byDateKey({ date_from: a.date }, { date_from: b.date }) || a.title.localeCompare(b.title));
  const oldBody = $("#detail .dock-body"),
    keepScroll = oldBody && shownId === p.id ? oldBody.scrollTop : 0; // the same place redrawn: stay where the reader was
  $("#detail").innerHTML = placeHeadHTML(p, l); // the new header at once: no frame shows the previous place
  placeDetail();
  history.replaceState(null, "", "#place-" + id);
  const bodies = await Promise.all(
    ns.map((n) => loadNoteBody(n).catch(() => n.text)),
  );
  if (seq !== showSeq) return; // another place was chosen while the notes were loading
  noteText = {};
  ns.forEach((n, i) => (noteText[n.id] = bodies[i]));
  if (shownId !== p.id) noteOpen.clear(); // another place: its notes start folded
  shownId = p.id;
  $("#detail").innerHTML =
    placeHeadHTML(p, l) +
    `<div class="dock-body"><p class="names">` +
    p.names
      .filter((n) => !l || n.lang === l)
      .map((n) => `<span lang="${esc(n.lang)}">${esc(n.name)}</span> <span class="sn">[${esc(n.lang)}]</span>`)
      .join(" · ") +
    "</p>" +
    lyPlaceHTML(p) +
    rtPlaceHTML(p) +
    lyScopeHTML(scope, ns.length, inLang.length) +
    (ns.length > 1
      ? `<div class="note-tools" hidden><span class="sn">${ns.length} notes</span><button type="button" class="note-all" data-note-all></button></div>`
      : "") +
    (ns.map((n, i) => noteHTML(n, bodies[i])).join("") || '<p class="sn">No notes yet.</p>') +
    editHint +
    `</div><div class="dock-foot">` +
    btns(...edit(["note", "Add note", "primary"])) +
    "</div>";
  fitNotes();
  const body = $("#detail .dock-body");
  if (body && keepScroll) body.scrollTop = keepScroll;
}
// ---- long notes: a folded preview with a "more…" toggle, so one long note never buries the rest of the place ----
const NOTE_LINES = 6; // lines of a folded note
const noteOpen = new Set(); // ids of long notes the reader has opened; kept while the panel is redrawn
let shownId = null; // the place whose details are drawn
// Paragraphs are separated by a blank line; a single line break inside one is kept.
const para = (t) =>
  String(t)
    .trim()
    .split(/\n\s*\n/)
    .filter((x) => x.trim())
    .map((x) => "<p>" + esc(x.trim()).replace(/\n/g, "<br>") + "</p>")
    .join("");
const noteHTML = (n, text) =>
  `<div class="note" data-nid="${esc(n.id)}" lang="${esc(n.lang)}"><div class="note-head"><div class="note-meta"><b>${esc(n.title)}</b> <span class="sn">${n.date ? esc(dateText(n.date)) + " · " : ""}${esc(langName(n.lang))}</span></div>${AHM_CONFIG.canEdit ? iconBtn("editnote", "pencil", "Edit note", `data-id="${esc(n.id)}"`, "sm") : ""}</div><div class="note-body" id="nb-${esc(n.id)}">${para(text)}</div><button type="button" class="note-more" hidden aria-expanded="false" aria-controls="nb-${esc(n.id)}" data-note-toggle></button></div>`;
const reduceMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const lineHeightOf = (el) => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.45;
function noteLabels(note) {
  const open = noteOpen.has(note.dataset.nid),
    btn = note.querySelector(".note-more");
  btn.textContent = open ? "less" : "more…";
  btn.setAttribute("aria-expanded", String(open));
}
// Measure every note: only a note that is really longer than the fold gets the toggle (a short one is shown whole).
function fitNotes() {
  const root = $("#detail");
  if (!root) return;
  let longs = 0;
  root.querySelectorAll(".note").forEach((note) => {
    const body = note.querySelector(".note-body"),
      btn = note.querySelector(".note-more");
    if (!body || !btn) return;
    body.classList.remove("is-clamped");
    body.style.maxHeight = "";
    const long = body.scrollHeight > lineHeightOf(body) * (NOTE_LINES + 2); // folding must hide at least two lines to be worth a toggle
    note.classList.toggle("is-long", long);
    btn.hidden = !long;
    if (long) {
      longs++;
      body.classList.toggle("is-clamped", !noteOpen.has(note.dataset.nid));
      noteLabels(note);
    }
  });
  const tools = root.querySelector(".note-tools");
  if (tools) {
    tools.hidden = longs < 2;
    const all = tools.querySelector("[data-note-all]"),
      anyFolded = [...root.querySelectorAll(".note.is-long")].some((n) => !noteOpen.has(n.dataset.nid));
    all.textContent = anyFolded ? "Expand all" : "Collapse all";
  }
}
// Open or fold one note; animated unless the reader prefers less motion.
function setNote(note, open, animate = true) {
  const id = note.dataset.nid,
    body = note.querySelector(".note-body"),
    foldPx = Math.round(lineHeightOf(body) * NOTE_LINES);
  open ? noteOpen.add(id) : noteOpen.delete(id);
  noteLabels(note);
  const done = () => {
    body.classList.remove("anim");
    body.style.maxHeight = "";
    body.classList.toggle("is-clamped", !open);
  };
  if (!animate || reduceMotion()) return done();
  body.classList.add("anim", "is-clamped");
  if (open) {
    body.style.maxHeight = foldPx + "px";
    void body.offsetHeight; // start from the fold
    body.style.maxHeight = body.scrollHeight + "px";
  } else {
    body.classList.remove("is-clamped");
    body.style.maxHeight = body.scrollHeight + "px";
    body.classList.add("is-clamped");
    void body.offsetHeight;
    body.style.maxHeight = foldPx + "px";
    const scroller = $("#detail .dock-body");
    if (scroller && note.getBoundingClientRect().top < scroller.getBoundingClientRect().top)
      note.scrollIntoView({ block: "start", behavior: "smooth" }); // the head of a note folded from far below is brought back into view
  }
  let ended = false;
  const finish = () => (ended ? 0 : ((ended = true), done()));
  body.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 400); // in case no transition event comes (display change, hidden tab)
}
$("#detail").addEventListener("click", (e) => {
  const t = e.target.closest("[data-note-toggle], [data-note-all]");
  if (!t) return;
  if (t.hasAttribute("data-note-all")) {
    const notesEl = [...$("#detail").querySelectorAll(".note.is-long")],
      open = notesEl.some((n) => !noteOpen.has(n.dataset.nid)); // any folded: open all; else fold all
    notesEl.forEach((n) => setNote(n, open));
    setTimeout(fitNotes, 420);
  } else {
    const note = t.closest(".note");
    setNote(note, !noteOpen.has(note.dataset.nid));
    setTimeout(fitNotes, 420); // refresh the "Expand all / Collapse all" label
  }
});
// A narrower or wider sidebar re-wraps the text: measure the notes again (only when the width really changed).
{
  let lastW = 0,
    raf = 0;
  new ResizeObserver(() => {
    const w = $("#detail").clientWidth;
    if (!w || w === lastW) return;
    lastW = w;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(fitNotes);
  }).observe($("#detail"));
}
function closeDetail() {
  stopEditPlace();
  cur = null;
  AHM.state.set('selected', null);
  update(); // folds the details and removes the highlight of the row
  history.replaceState(null, "", location.pathname + location.search);
}
