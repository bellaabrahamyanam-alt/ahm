// Sidebar layout: the state the sidebar files share, tabs, collapse, the details dock, resizing the sidebar and the dock.
let noteText = {},
  editMk = null,
  cur = null,
  pick = null,
  rt = { a: null, b: null },
  rtInfo = "",
  geoTimer = null,
  geoRes = [],
  dlg = { mode: "place", p: null };
// ---- tabs, collapse ----
// Three tabs: Explore, Layers, More. "More" holds folds: maps, route (directions), lang; tab("route") opens that fold.
let curTab = "explore";
const FOLDS = ["maps", "route", "lang"];
function tab(n) {
  const top = FOLDS.includes(n) ? "more" : n;
  curTab = top;
  document
    .querySelectorAll(".tabs button")
    .forEach((b) => b.classList.toggle("on", b.dataset.tab === top));
  document
    .querySelectorAll("#side section")
    .forEach((s) => (s.hidden = s.id !== "tab-" + top));
  if (FOLDS.includes(n)) {
    FOLDS.forEach((f) => ($("#more-" + f).open = f === n));
    $("#more-" + n).scrollIntoView({ block: "nearest" });
  }
  if (cur && !editMk) closeDetail(); // a tab is navigation: leave the place sheet (but never in the middle of editing)
  lyRenderDetail(); // the layer sheet belongs to the Layers tab
  shRenderView(); // and the border card to the Borders tab
  rtRenderView(); // and the route card to the Routes tab
}
document.querySelector(".tabs").addEventListener("click", (e) => {
  if (e.target.dataset.tab) tab(e.target.dataset.tab);
});
// the handle on the right edge of the sidebar: one button, the icon and the label say what it does now
function sideHandle(h) {
  const b = $("#collapse"),
    t = h ? "Expand sidebar" : "Collapse sidebar";
  b.innerHTML = AHM.icons.svg(h ? "panel-right" : "panel-left", 14);
  b.title = t;
  b.setAttribute("aria-label", t);
}
const toggleSide = (h) => {
  document.body.classList.toggle("collapsed", h);
  sideHandle(h);
  setTimeout(() => AHM.emit("sidebar:resized"), 250);
};
$("#collapse").onclick = () => toggleSide(!document.body.classList.contains("collapsed"));
sideHandle(false);
// ---- the details dock: a pane under the lists; the place details (#detail) and the layer details (#lyDetail) live in it ----
$(".stack").append($("#dock"));
function dockSync() {
  $("#dock").hidden = $("#detail").hidden && $("#lyDetail").hidden && $("#shDetail").hidden && $("#rtDetail").hidden;
}
// The dock covers the lower half of the panel: if a row is hidden behind it, scroll the list just enough to centre the row.
function revealRow(li) {
  const box = li.closest(".body");
  requestAnimationFrame(() => {
    const b = box.getBoundingClientRect(),
      r = li.getBoundingClientRect();
    if (r.top >= b.top && r.bottom <= b.bottom) return;
    box.scrollTop += r.top + r.height / 2 - (b.top + b.height / 2);
  });
}
// ---- resizable sidebar: drag the edge, double-click resets, arrow keys nudge; size is remembered ----
const mobile = () => matchMedia("(max-width:700px)").matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sizeKey = () => (mobile() ? "ahm-side-h" : "ahm-side-w");
function setSize(v, save) {
  // desktop: width in px; mobile: height in vh
  v = mobile()
    ? clamp(v, 25, 85)
    : clamp(v, 280, Math.min(720, innerWidth - 240));
  document.documentElement.style.setProperty(
    mobile() ? "--side-h" : "--side-w",
    v + (mobile() ? "vh" : "px"),
  );
  requestAnimationFrame(() => AHM.emit("sidebar:resized"));
  if (save)
    try {
      localStorage.setItem(sizeKey(), v);
    } catch (e) {}
  return v;
}
const curSize = () =>
  mobile()
    ? ($("#side").offsetHeight / innerHeight) * 100
    : $("#side").offsetWidth;
try {
  ["ahm-side-w", "ahm-side-h"].forEach((k) => {
    const v = localStorage.getItem(k);
    if (v && (k === "ahm-side-h") === mobile()) setSize(+v);
  });
} catch (e) {}
$("#resizer").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  $("#resizer").setPointerCapture(e.pointerId);
  document.body.classList.add("resizing");
});
$("#resizer").addEventListener("pointermove", (e) => {
  if (!document.body.classList.contains("resizing")) return;
  setSize(
    mobile() ? ((innerHeight - e.clientY) / innerHeight) * 100 : e.clientX,
  );
});
$("#resizer").addEventListener("pointerup", () => {
  document.body.classList.remove("resizing");
  setSize(curSize(), true);
});
$("#resizer").addEventListener("dblclick", () => {
  setSize(mobile() ? 52 : 380);
  try {
    localStorage.removeItem(sizeKey());
  } catch (e) {}
});
$("#resizer").addEventListener("keydown", (e) => {
  const d = { ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, ArrowUp: 1 }[e.key];
  if (!d) return;
  e.preventDefault();
  setSize(curSize() + d * (mobile() ? 3 : 20), true);
});
// ---- resizable details dock: drag its top edge, double-click resets, Up/Down arrows nudge; the height is remembered ----
const dockEl = $("#dock"),
  dockGrip = document.createElement("div"),
  dockMax = () => Math.max(160, $(".stack").clientHeight - 120); // always leave 120px of the list
dockGrip.id = "dockResizer";
dockGrip.tabIndex = 0;
dockGrip.setAttribute("role", "separator");
dockGrip.setAttribute("aria-orientation", "horizontal");
dockGrip.setAttribute("aria-label", "Resize details");
dockGrip.title = "Drag to resize (double-click to reset)";
dockEl.prepend(dockGrip);
function setDock(h, save) {
  h = clamp(h, 120, dockMax());
  dockEl.style.setProperty("--dock-h", h + "px");
  if (save)
    try {
      localStorage.setItem("ahm-dock-h", h);
    } catch (e) {}
  return h;
}
try {
  const v = +localStorage.getItem("ahm-dock-h");
  if (v) setDock(v);
} catch (e) {}
let dockDrag = null;
dockGrip.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  dockGrip.setPointerCapture(e.pointerId);
  dockDrag = { y: e.clientY, h: dockEl.offsetHeight };
  document.body.classList.add("dock-resizing");
});
dockGrip.addEventListener("pointermove", (e) => {
  if (dockDrag) setDock(dockDrag.h + dockDrag.y - e.clientY); // dragging up makes the dock taller
});
const dockDragEnd = () => {
  if (!dockDrag) return;
  dockDrag = null;
  document.body.classList.remove("dock-resizing");
  setDock(dockEl.offsetHeight, true);
};
dockGrip.addEventListener("pointerup", dockDragEnd);
dockGrip.addEventListener("pointercancel", dockDragEnd);
dockGrip.addEventListener("dblclick", () => {
  dockEl.style.removeProperty("--dock-h");
  try {
    localStorage.removeItem("ahm-dock-h");
  } catch (e) {}
});
dockGrip.addEventListener("keydown", (e) => {
  const d = { ArrowUp: 24, ArrowDown: -24 }[e.key];
  if (!d) return;
  e.preventDefault();
  setDock(dockEl.offsetHeight + d, true);
});
