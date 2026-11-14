// Sidebar administration: the dictionaries of languages and of place types (only administrators change them).
// ---- languages: the dictionary every name and note language is chosen from (only administrators add or edit) ----
// One table-like layout without lines: [button] [code] [English name] [name in the language itself].
// Rows: pencil = edit. The last row is the add/edit row (plus = add, pencil = editing); Save and Cancel sit below it.
let lgEditing = null; // the code being edited, or null = adding
let lgOpen = false; // the form is shown only while it is open
function renderLangs() {
  $("#langList").innerHTML =
    languages
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(
        (l) =>
          `<li class="tr${l.code === lgEditing ? " on" : ""}"><span class="tc-btn">${
            AHM_CONFIG.canLanguage
              ? `<button type="button" class="icon-btn" data-lgedit="${esc(l.code)}" title="Edit ${esc(l.name)}" aria-label="Edit ${esc(l.name)}">${ICON_PENCIL}</button>`
              : ""
          }</span><b class="tc-code">${esc(l.code)}</b><span>${esc(l.name)}</span><span>${esc(l.native || "")}</span></li>`,
      )
      .join("") || '<li class="sn">No languages yet.</li>';
}
// Save stays off until the code and the English name are filled.
const lgValidate = () => {
  const b = $("#lgAdd");
  if (b) b.disabled = !($("#lgCode").value.trim() && $("#lgName").value.trim());
};
// The form is shown only while it is open: "+ Add language" opens it empty, the pencil of a row opens it filled.
function lgRenderAdmin() {
  $("#langAdmin").innerHTML = !AHM_CONFIG.canLanguage
    ? '<div class="sn">Only administrators can add a language. Missing one? Ask an administrator.</div>'
    : lgOpen
      ? '<div class="tr tr-edit"><span class="tc-btn"><span class="tc-mode" id="lgMode"></span></span>' +
        '<input id="lgCode" maxlength="8" placeholder="code, e.g. hy" aria-label="Language code">' +
        '<input id="lgName" placeholder="Name in English" aria-label="Name in English">' +
        '<input id="lgNative" placeholder="Name in the language" aria-label="Name in the language itself"></div>' +
        '<div class="btn-pair"><button id="lgAdd" class="primary" disabled>Save</button><button id="lgCancel">Cancel</button></div><div id="lgErr" class="sn err-line"></div>'
      : '<button id="lgNew" class="wide">+ Add language</button>';
}
function lgFill(l) {
  lgOpen = true;
  lgEditing = l ? l.code : null;
  lgRenderAdmin();
  renderLangs();
  $("#lgCode").value = l ? l.code : "";
  $("#lgCode").readOnly = !!l; // the code is what names and notes refer to, so it never changes
  $("#lgName").value = l ? l.name : "";
  $("#lgNative").value = l ? l.native || "" : "";
  $("#lgMode").innerHTML = l ? ICON_PENCIL : ICON_PLUS;
  $("#lgErr").textContent = "";
  lgValidate();
}
function lgClose() {
  lgOpen = false;
  lgEditing = null;
  lgRenderAdmin();
  renderLangs();
}
lgRenderAdmin();
$("#langAdmin").addEventListener("input", lgValidate);
$("#langList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lgedit]");
  if (!b) return;
  lgFill(languages.find((l) => l.code === b.dataset.lgedit));
  $("#lgName").focus();
});
$("#langAdmin").addEventListener("click", async (e) => {
  if (e.target.id === "lgNew") {
    lgFill(null);
    return $("#lgCode").focus();
  }
  if (e.target.id === "lgCancel") return lgClose();
  if (e.target.id !== "lgAdd") return;
  const err = $("#lgErr");
  try {
    err.textContent = "Saving…";
    const r = await fetch(AHM_CONFIG.url.languageSave, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: $("#lgCode").value,
        name: $("#lgName").value,
        native: $("#lgNative").value,
        ...(lgEditing ? { edit: true } : {}),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Error("Save failed: " + (j.error || r.status));
    languages = await loadLanguages();
    fillLangs();
    lgClose();
  } catch (x) {
    err.textContent = x.message;
  }
});
// ---- place types: the dictionary every place type is chosen from (only administrators add, change or remove) ----
// Same layout as languages: [buttons] [marker] [name] [code]. The form is shown only while it is open. The code of a
// new type is made by the server from its English name and never changes; places point to a type by that code.
let tyEditing = null; // the code being edited, or null = adding
let tyOpen = false;
let tyGeo = "point"; // the geometry of the type being added or edited: point (a place marker), line (a route) or area (a border)
const TY_GEO = { point: "place", line: "line", area: "area" };
const TY_PATTERNS = ["solid", "dashed", "dotted", "dashdot"]; // the patterns the map draws
function renderTypes() {
  const l = $("#lang").value,
    n = {};
  places.forEach((p) => (n[p.type] = (n[p.type] || 0) + 1));
  shapes.forEach((s) => (n[s.type] = (n[s.type] || 0) + 1));
  $("#typeList").innerHTML =
    [...types]
      .sort((a, b) => Object.keys(TY_GEO).indexOf(a.geometry) - Object.keys(TY_GEO).indexOf(b.geometry) || typeLabel(a.code, l).localeCompare(typeLabel(b.code, l)))
      .map(
        (t) =>
          `<li class="tr${t.code === tyEditing ? " on" : ""}"><span class="tc-btn">${
            AHM_CONFIG.canTypeAdmin
              ? `<button type="button" class="icon-btn" data-tyedit="${esc(t.code)}" title="Edit ${esc(typeLabel(t.code, l))}" aria-label="Edit ${esc(typeLabel(t.code, l))}">${ICON_PENCIL}</button>`
              : ""
          }</span><b class="tc-code">${t.geometry === "point" ? typeIcon(t.code) : shIcon(t.code)}</b><span>${esc(typeLabel(t.code, l))} <span class="sn">${TY_GEO[t.geometry] || ""}</span></span><span class="sn">${n[t.code] || 0}</span></li>`,
      )
      .join("") || '<li class="sn">No types yet.</li>';
}
const tyDraft = () => {
  const d = { color: $("#tyColor").value };
  if (tyGeo === "point") {
    d.symbol = $("#tySym").value;
    d.size = Number($("#tySize").value);
    if (d.symbol === "custom") {
      d.path = $("#tyPath").value.trim();
      d.box = Number($("#tyBox").value);
    }
    return d;
  }
  d.pattern = $("#tyPat").value;
  d.width = Number($("#tyWid").value);
  d.opacity = Number($("#tyOpa").value);
  if (tyGeo === "line") d.arrow = $("#tyArrow").checked;
  else d.fill = Number($("#tyFill").value);
  return d;
};
// The style the server stores: a place marker { symbol, size }, a line { width, pattern, opacity, arrow }, an area { fill_opacity, outline }.
const tyStyle = (d) =>
  tyGeo === "point"
    ? { symbol: d.symbol, size: d.size, ...(d.symbol === "custom" ? { path: d.path, box: d.box } : {}) }
    : tyGeo === "line"
      ? { width: d.width, pattern: d.pattern, opacity: d.opacity, arrow: d.arrow }
      : { fill_opacity: d.fill, outline: { width: d.width, pattern: d.pattern, opacity: d.opacity } };
// An SVG (a file the admin chose, or a whole <svg> pasted into the path box) becomes the path and the box of the symbol.
function tyUseSvg(text, from) {
  const r = svgToPath(text),
    msg = $("#tySvgMsg");
  if (!r.path) {
    msg.textContent =
      r.why === "transform"
        ? "This SVG moves or scales its shapes (transform), which is not supported. Export it again without transforms."
        : r.why === "origin"
          ? "The drawing area (viewBox) of this SVG does not start at 0 0, which is not supported. Export it again with a viewBox that starts at 0 0."
          : "Nothing to draw in this file. Use a simple one-colour SVG icon (paths, rectangles, circles).";
    return;
  }
  $("#tyPath").value = r.path;
  $("#tyBox").value = r.box;
  msg.textContent = from ? "Loaded " + from + "." : "SVG read.";
  tyValidate();
}
const tyNames = () =>
  [...$("#typeAdmin").querySelectorAll(".pf-name")]
    .map((r) => ({ lang: r.querySelector(".nl").value, name: r.querySelector(".nn").value.trim() }))
    .filter((x) => x.name);
// Save stays off until there is an English name (the code is made from it) when adding, or any name when editing.
const tyValidate = () => {
  if (!$("#tyColor")) return; // the form is closed
  const b = $("#tyAdd");
  const custom = tyGeo === "point" && $("#tySym").value === "custom";
  if ($("#tyCustom")) $("#tyCustom").hidden = !custom;
  if (b) {
    const d = tyDraft();
    b.disabled =
      !(tyEditing ? tyNames().length : tyNames().some((x) => x.lang === "en")) ||
      (tyGeo !== "point" && !(d.width >= 1 && d.width <= 12 && d.opacity >= 0.1 && d.opacity <= 1)) ||
      (custom && !(/^\s*[Mm]/.test(d.path) && /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]{2,20000}$/.test(d.path) && d.box >= 8 && d.box <= 2048));
  }
  const pv = $("#tyPrev");
  if (pv && tyGeo === "point") pv.innerHTML = typeIcon(tyDraft()) + " " + esc($("#tySize").value);
};
function tyRenderAdmin(t) {
  const el = $("#typeAdmin");
  if (!AHM_CONFIG.canTypeAdmin) {
    el.innerHTML = '<div class="sn">Only administrators can add a type. Missing one? Ask an administrator.</div>';
    return;
  }
  if (!tyOpen) {
    el.innerHTML = Object.keys(TY_GEO)
      .map((g) => `<button data-tynew="${g}" class="wide">+ Add ${TY_GEO[g]} type</button>`)
      .join("");
    return;
  }
  const names = t && t.names.length ? t.names : [{ lang: "en", name: "" }],
    st = (t && t.style) || (tyGeo === "point" ? { symbol: "circle", size: 8 } : tyGeo === "line" ? { width: 2.5, pattern: "solid", opacity: 1, arrow: false } : { fill_opacity: 0.15, outline: { width: 2, pattern: "solid", opacity: 1 } }),
    ol = tyGeo === "area" ? st.outline || {} : st,
    pats = `<select id="tyPat" aria-label="Pattern">${TY_PATTERNS.map((p) => `<option${p === (ol.pattern || "solid") ? " selected" : ""}>${p}</option>`).join("")}</select>`,
    shapeFields =
      `<div class="label">Pattern</div>${pats}` +
      `<div class="label">Width</div><input id="tyWid" type="number" min="1" max="12" step="0.5" value="${Number(ol.width) || 2}" aria-label="Width">` +
      `<div class="label">Opacity</div><input id="tyOpa" type="range" min="0.1" max="1" step="0.05" value="${ol.opacity == null ? 1 : ol.opacity}" aria-label="Opacity">` +
      (tyGeo === "line"
        ? `<label class="sh-check"><input type="checkbox" id="tyArrow"${st.arrow ? " checked" : ""}> One way (drawn with arrows)</label>`
        : `<div class="label">Fill</div><input id="tyFill" type="range" min="0" max="0.8" step="0.05" value="${st.fill_opacity == null ? 0.15 : st.fill_opacity}" aria-label="Fill opacity">`);
  el.innerHTML =
    `<div class="label">Names</div><div class="pf-names">${names.map((n) => pfRow(n)).join("")}</div>` +
    `<button type="button" class="pf-add">+ Add another name</button>` +
    `<div class="sn">${t ? "The code <b>" + esc(t.code) + "</b> never changes." : "The code is made from the English name."}</div>` +
    (tyGeo !== "point" ? "" : `<div class="label">Symbol</div><select id="tySym">${AHM.map
      .getSymbols()
      .map((y) => `<option value="${esc(y.name)}"${y.name === st.symbol ? " selected" : ""}>${esc(y.label)}</option>`)
      .join("")}<option value="custom"${st.symbol === "custom" ? " selected" : ""}>Custom (SVG path)…</option></select>` +
    `<div id="tyCustom" hidden><div class="sn">Choose an SVG icon file. It is drawn in the colour above. Simple one-colour icons work best (free ones: game-icons.net, lucide.dev).</div>` +
    `<input id="tyFile" type="file" accept=".svg,image/svg+xml" aria-label="SVG file"><div id="tySvgMsg" class="sn">${st.path ? "Current symbol kept; choose a file to replace it." : ""}</div>` +
    `<details><summary>Advanced: path and box</summary><textarea id="tyPath" rows="3" maxlength="60000" spellcheck="false" aria-label="SVG path">${esc(st.path || "")}</textarea>` +
    `<div class="label">Box</div><input id="tyBox" type="number" min="8" max="2048" step="1" value="${Number(st.box) || 24}" aria-label="Box size"></details></div>`) +
    `<div class="label">Colour</div><input id="tyColor" type="color" value="${esc((t && t.color) || "#8d6e63").toLowerCase()}" aria-label="Colour">` +
    (tyGeo === "point" ? `<div class="label">Size</div><input id="tySize" type="range" min="4" max="14" step="0.5" value="${Number(st.size) || 8}" aria-label="Size"> <span id="tyPrev"></span>` : shapeFields) +
    '<div class="btn-pair"><button id="tyAdd" class="primary" disabled>Save</button><button id="tyCancel">Cancel</button>' +
    (t ? '<button id="tyDel" title="Remove this type (only when no place or shape uses it)">Remove</button>' : "") +
    '</div><div id="tyErr" class="sn err-line"></div>';
  tyValidate();
}
function tyFill(t) {
  tyOpen = true;
  tyEditing = t ? t.code : null;
  if (t) tyGeo = t.geometry;
  tyRenderAdmin(t);
  renderTypes();
}
function tyClose() {
  tyOpen = false;
  tyEditing = null;
  tyRenderAdmin();
  renderTypes();
}
// The dictionary changed (or was loaded): the map draws from it, the filters, lists and the place form follow.
function tySet(list) {
  types = list;
  setShapeTypes(types); // lines and areas: the lists, the forms and the map follow
  Object.keys(shIcons).forEach((k) => delete shIcons[k]);
  AHM.map.setTypes(types);
  renderTypes();
  fillTypes();
  if (typeof update === "function") update();
}
async function tyPost(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Error("Save failed: " + (j.error || r.status));
  return j;
}
tyRenderAdmin();
placeFormWire($("#typeAdmin")); // the add / move up / remove buttons of the name rows
$("#typeAdmin").addEventListener("input", (e) => {
  if (e.target.id === "tyPath" && /<svg/i.test(e.target.value)) tyUseSvg(e.target.value);
  else tyValidate();
});
$("#typeAdmin").addEventListener("change", (e) => {
  const f = e.target.id === "tyFile" && e.target.files[0];
  if (f) f.text().then((t) => tyUseSvg(t, f.name));
});
$("#typeAdmin").addEventListener("change", tyValidate);
$("#typeAdmin").addEventListener("click", tyValidate);
$("#typeList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tyedit]");
  if (b) tyFill(types.find((t) => t.code === b.dataset.tyedit));
});
$("#typeAdmin").addEventListener("click", async (e) => {
  const nb = e.target.closest("[data-tynew]");
  if (nb) {
    tyGeo = nb.dataset.tynew;
    return tyFill(null);
  }
  if (e.target.id === "tyCancel") return tyClose();
  const err = $("#tyErr");
  try {
    if (e.target.id === "tyDel") {
      if (!confirm("Remove the type “" + typeLabel(tyEditing, $("#lang").value) + "”?")) return;
      err.textContent = "Removing…";
      await tyPost(AHM_CONFIG.url.typeDelete, { code: tyEditing });
    } else if (e.target.id === "tyAdd") {
      err.textContent = "Saving…";
      const d = tyDraft();
      await tyPost(AHM_CONFIG.url.typeSave, {
        ...(tyEditing ? { code: tyEditing, edit: true } : {}),
        geometry: tyGeo,
        names: tyNames(),
        color: d.color,
        style: tyStyle(d),
      });
    } else return;
    tySet(await loadTypes());
    tyClose();
  } catch (x) {
    err.textContent = x.message;
  }
});
