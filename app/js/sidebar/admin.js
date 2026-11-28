// Sidebar administration (More tab): the dictionaries of languages and of place/line/area/river types (only administrators change them).
// Markup is static in app/index.html (regions tab-more and tpl-more); this file clones templates, fills them and handles events.
// ---- the sheet: a full-width editor that replaces the cards (type editor, overlay editor; frames s020, s040) ----
const mrSheet = {
  open(node) {
    $("#mr-cards").hidden = true;
    $("#mr-sheet").hidden = false;
    $("#mr-sheet").replaceChildren(node);
    $("#tab-more").scrollTop = 0;
  },
  close() {
    $("#mr-sheet").replaceChildren();
    $("#mr-sheet").hidden = true;
    $("#mr-cards").hidden = false;
  },
};
/** The loading / error block of a card (kit.state); kind null clears it. */
function mrState(cardId, kind, text, retry) {
  const slot = $("#" + cardId + " [data-state]");
  if (kind) kit.state(slot, kind, text, retry);
  else slot.replaceChildren();
}
// A canvas symbol (no markup): the type as the map draws it.
const mrCanvas = (type, px = 20) => iconCanvas(type, px, 2);
// ---- languages: the dictionary every name and note language is chosen from (only administrators add or edit) ----
let lgEditing = null; // the code being edited, or null = adding
let lgOpen = false; // the form is shown only while it is open
const lgNewBtn = $("#lgNew");
function renderLangs() {
  if (typeof kit === "undefined") return; // a page without the template kit (a node test) has nothing to draw
  mrState("more-lang", null);
  const can = AHM_CONFIG.canLanguage,
    list = languages.slice().sort((a, b) => a.name.localeCompare(b.name));
  kit.list($("#langList"), list.map((l) => ({ id: l.code, l })), "t-mr-lang", (li, { l }) => {
    kit.fill(li, { code: l.code, name: l.name, native: l.native || "" });
    li.classList.toggle("mr-on", l.code === lgEditing);
    const b = li.querySelector("[data-lgedit]");
    b.hidden = !can;
    b.dataset.lgedit = l.code;
    b.title = b.ariaLabel = "Edit " + l.name;
  });
  $("#lgHead").hidden = !list.length;
  $("#lgEmpty").hidden = !!list.length;
  $("#lgEmpty svg").hidden = can;
  $("#lgIntro").hidden = !can;
  $("#lgRO").hidden = can;
  $("#langAdmin").hidden = !can;
  $("#lgSub").textContent = !can ? "Read only" : lgOpen ? (lgEditing ? "Edit a language" : "Add a language") : list.length + (list.length === 1 ? " language" : " languages");
}
// Save stays off until the code and the English name are filled.
const lgValidate = () => {
  const b = $("#lgAdd");
  if (b) b.disabled = !($("#lgCode").value.trim() && $("#lgName").value.trim());
};
function lgFill(l) {
  lgOpen = true;
  lgEditing = l ? l.code : null;
  const f = kit.tpl("t-mr-lgform");
  kit.fill(f, { caption: l ? "Edit language" : "New language" });
  $("#langAdmin").replaceChildren(f);
  $("#lgCode").value = l ? l.code : "";
  $("#lgCode").readOnly = !!l; // the code is what names and notes refer to, so it never changes
  $("#lgName").value = l ? l.name : "";
  $("#lgNative").value = l ? l.native || "" : "";
  lgValidate();
  renderLangs();
}
function lgClose() {
  lgOpen = false;
  lgEditing = null;
  $("#langAdmin").replaceChildren(lgNewBtn);
  renderLangs();
}
$("#langAdmin").addEventListener("input", lgValidate);
$("#langList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lgedit]");
  if (!b) return;
  lgFill(languages.find((l) => l.code === b.dataset.lgedit));
  $("#lgName").focus();
});
$("#langAdmin").addEventListener("click", async (e) => {
  if (e.target.closest("#lgNew")) {
    lgFill(null);
    return $("#lgCode").focus();
  }
  if (e.target.closest("#lgCancel")) return lgClose();
  if (!e.target.closest("#lgAdd")) return;
  const err = $("#lgErr");
  try {
    err.textContent = "Saving…";
    const r = await fetch(AHM_CONFIG.url.languageSave, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: $("#lgCode").value, name: $("#lgName").value, native: $("#lgNative").value, ...(lgEditing ? { edit: true } : {}) }),
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
// ---- types: the dictionary every place, line, area and river type is chosen from (only administrators add, change or remove) ----
// The code of a new type is made by the server from its English name and never changes; places point to a type by that code.
let tyEditing = null; // the code being edited, or null = adding
let tyGeo = "point"; // point (a place marker), line (a route), area (a border) or river
let tyBad = false; // the last SVG could not be read: Save stays off
const tyOpenGroups = new Set();
const TY_GEO = { point: "place", line: "line", area: "area", river: "river" };
const TY_GROUP = { point: "Places", line: "Routes", area: "Areas", river: "Rivers" };
const TY_KIND = { point: "Point", line: "Line", area: "Area", river: "River" };
const TY_SHOWN = 3; // rows of a group shown before "+ N more"
const TY_DASH = { solid: "", dashed: "6 4", dotted: "1 4", dashdot: "8 3 1 3" };
const typeUsage = () => {
  const n = {};
  places.forEach((p) => (n[p.type] = (n[p.type] || 0) + 1));
  shapes.forEach((s) => (n[s.type] = (n[s.type] || 0) + 1));
  return n;
};
// The small picture of a shape type: the <img> that shapes.js made, taken over as an element.
const mrShapeImg = (code) => {
  const m = /src="([^"]+)"/.exec(shIcon(code)),
    i = document.createElement("img");
  i.alt = "";
  if (m) i.src = m[1];
  return i;
};
function renderTypes() {
  if (typeof kit === "undefined") return;
  mrState("more-types", null);
  const l = $("#lang").value,
    n = typeUsage(),
    can = AHM_CONFIG.canTypeAdmin;
  $("#typeList").replaceChildren(
    ...Object.keys(TY_GEO)
      .map((g) => {
        const rows = types.filter((t) => t.geometry === g).sort((a, b) => typeLabel(a.code, l).localeCompare(typeLabel(b.code, l)));
        if (!rows.length) return null;
        const grp = kit.tpl("t-mr-tgroup"),
          more = grp.querySelector("[data-more]"),
          all = tyOpenGroups.has(g) || rows.length <= TY_SHOWN + 1,
          shown = all ? rows : rows.slice(0, TY_SHOWN);
        kit.fill(grp, { caption: TY_GROUP[g] });
        kit.list(grp.querySelector("[data-rows]"), shown.map((t) => ({ id: t.code, t })), "t-mr-type", (li, { t }) => {
          const name = typeLabel(t.code, l);
          kit.fill(li, { name, kind: TY_KIND[t.geometry], count: n[t.code] || 0 });
          li.classList.toggle("mr-on", t.code === tyEditing);
          li.querySelector("[data-icon]").replaceChildren(t.geometry === "point" ? mrCanvas(t.code) : mrShapeImg(t.code));
          const b = li.querySelector("[data-tyedit]");
          b.hidden = !can;
          b.dataset.tyedit = t.code;
          b.title = b.ariaLabel = "Edit " + name;
        });
        more.hidden = rows.length <= TY_SHOWN + 1;
        more.dataset.more = g;
        more.textContent = all ? "Show fewer" : "+ " + (rows.length - TY_SHOWN) + " more";
        return grp;
      })
      .filter(Boolean),
  );
  $("#tyEmpty").hidden = !!types.length;
  $("#typeAdmin").hidden = !can;
  $("#tyRO").hidden = can;
  $("#tySub").textContent = !can ? "Read only" : types.length + " place, route, area and river types";
}
$("#typeList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-more]");
  if (!b) return;
  const g = b.dataset.more;
  tyOpenGroups.has(g) ? tyOpenGroups.delete(g) : tyOpenGroups.add(g);
  renderTypes();
});
// An SVG (a file the admin chose, or a whole <svg> pasted) becomes the path and the box of the symbol.
function tyUseSvg(text, from) {
  const r = svgToPath(text),
    msg = $("#tySvgMsg"),
    say = (t, bad) => {
      kit.fill(msg, { msg: t });
      msg.hidden = false;
      msg.classList.toggle("mr-ok", !bad);
      msg.querySelector("svg").hidden = !bad;
      tyBad = !!bad;
    };
  if (!r.path) {
    say(
      r.why === "transform"
        ? "This SVG moves or scales its shapes (transform), which is not supported. Export it again without transforms."
        : r.why === "origin"
          ? "The drawing area (viewBox) of this SVG does not start at 0 0, which is not supported. Export it again with a viewBox that starts at 0 0."
          : "Nothing to draw in this file. Use a simple one-colour SVG icon (paths, rectangles, circles).",
      true,
    );
    return tyRefresh();
  }
  $("#tyPath").value = r.path;
  $("#tyBox").value = r.box;
  say(from ? "Loaded " + from + "." : "SVG read.", false);
  tySvgTile(true);
  tyRefresh();
}
// The tile of the uploaded SVG symbol of this type (made on first use); select = make it the chosen symbol.
function tySvgTile(select) {
  const grid = $("#mr-sheet [data-symbols]");
  let t = grid.querySelector('[data-symbol="custom"]');
  if (!t) {
    t = kit.tpl("t-mr-svgsym");
    grid.querySelector("[data-upload]").before(t);
  }
  if (select) grid.querySelectorAll("[data-symbol]").forEach((x) => x.classList.toggle("ahm-on", x === t));
  return t;
}
const tyReadNames = () => fields.readNames($("#mr-sheet [data-names]"));
const tyRead = () => {
  const node = $("#mr-sheet .ahm-style"),
    d = fields.readStyle(node);
  if (tyGeo === "point" && d.style.symbol === "custom") {
    d.style.path = $("#tyPath").value.trim();
    d.style.box = Number($("#tyBox").value);
  }
  return d;
};
// Everything that depends on the draft: the Save button, the symbol tile of the SVG, the preview.
function tyRefresh() {
  const sheet = $("#mr-sheet");
  if (!$("#tyAdd")) return;
  let d;
  try {
    d = tyRead();
  } catch (x) {
    $("#tyAdd").disabled = true;
    return;
  }
  const custom = tyGeo === "point" && d.style.symbol === "custom",
    names = (() => {
      try {
        return tyReadNames();
      } catch (x) {
        return [];
      }
    })();
  $("#tyAdd").disabled =
    !(tyEditing ? names.length : names.some((x) => x.lang === "en")) ||
    tyBad ||
    (custom && (!(/^\s*[Mm]/.test(d.style.path) && /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]{2,20000}$/.test(d.style.path) && d.style.box >= 8 && d.style.box <= 2048)));
  const pv = sheet.querySelector(".mr-prev");
  if (pv) {
    kit.fill(pv, { name: (names[0] && names[0].name) || "Name", where: tyGeo === "point" ? "on the map" : "" });
    if (tyGeo === "point") pv.querySelector("[data-icon]").replaceChildren(mrCanvas({ color: d.color, ...d.style, size: d.style.size }, 28));
    else {
      const poly = pv.querySelector("polygon"),
        o = d.style.outline;
      poly.setAttribute("fill", d.color);
      poly.setAttribute("fill-opacity", d.style.fill_opacity);
      poly.setAttribute("stroke", d.color);
      poly.setAttribute("stroke-width", o.width);
      poly.setAttribute("stroke-dasharray", TY_DASH[o.pattern] || "");
      poly.setAttribute("stroke-linecap", o.pattern === "dotted" ? "round" : "butt");
    }
  }
  sheet.querySelectorAll("[data-symbol]").forEach((b) => {
    if (b.dataset.symbol === "custom") b.querySelector("[data-icon]").replaceChildren(mrCanvas({ color: "#425067", symbol: "custom", path: $("#tyPath").value.trim(), box: Number($("#tyBox").value) || 24, size: 8 }, 24));
    else if (!b.dataset.drawn) {
      b.dataset.drawn = "1"; // the tiles are drawn once, in the neutral colour of the frames
      b.querySelector("[data-bind=\"name\"]").replaceChildren(mrCanvas({ color: "#425067", symbol: b.dataset.symbol, size: 8 }, 24));
    }
  });
}
function tyOpenEditor(t, geo) {
  tyGeo = geo;
  tyEditing = t ? t.code : null;
  tyBad = false;
  const name = t ? typeLabel(t.code, $("#lang").value) : "";
  const f = fields.form(t ? "Edit type · " + name : "New " + TY_GEO[geo] + " type"),
    body = f.querySelector("[data-body]");
  mrSheet.open(f); // in the page first: the parts below look each other up by id
  // names
  const names = kit.tpl("t-mr-names"),
    list = names.querySelector("[data-names]");
  fields.nameList(list, languages, t && t.names.length ? t.names : [{ lang: "en", name: "" }]);
  names.querySelector('[data-act="addname"]').addEventListener("click", () => {
    fields.nameAdd(list);
    tyRefresh();
  });
  kit.fill(names, { codeNote: t ? "The code " + t.code + " never changes." : "The code is made from the English name." });
  // symbol / colour / size / line / area
  const st = (t && t.style) || (geo === "point" ? { symbol: "circle", size: 8 } : geo === "area" ? { fill_opacity: 0.15, outline: { width: 2, pattern: "solid", opacity: 1 } } : geo === "river" ? { width: 3, pattern: "solid", opacity: 1 } : { width: 2.5, pattern: "solid", opacity: 1, arrow: false });
  const syms = geo === "point" ? AHM.map.getSymbols().map((y) => ({ name: y.name })) : [],
    style = fields.styleEditor(geo, (t && t.color) || "#8d6e63", st, syms);
  const cap = kit.tpl("t-mr-cap");
  kit.fill(cap, { text: { point: "Colour and size", line: "Line", area: "Area", river: "Line" }[geo] });
  style.prepend(cap);
  body.append(names, style);
  if (geo === "point") {
    const grid = style.querySelector("[data-symbols]");
    grid.append(kit.tpl("t-mr-upsym"));
    const hint = kit.tpl("t-mr-hint");
    kit.fill(hint, { text: "Built-in symbols, then your uploaded SVG ones. Upload a simple one-colour SVG; it is drawn in the colour below." });
    grid.after(hint);
    const zone = kit.tpl("t-mr-svgzone");
    zone.hidden = !(st.path || st.symbol === "custom");
    grid.parentElement.append(zone);
    if (st.path) {
      $("#tyPath").value = st.path;
      $("#tyBox").value = Number(st.box) || 24;
      kit.fill(zone, {});
      tySvgTile(st.symbol === "custom");
    }
    kit.on(grid, "click", "[data-upload]", () => (zone.hidden = !zone.hidden));
    kit.on(grid, "click", "[data-symbol]", () => (tyBad = false));
    zone.addEventListener("change", (e) => {
      const file = e.target.id === "tyFile" && e.target.files[0];
      if (file) file.text().then((x) => tyUseSvg(x, file.name));
    });
    zone.addEventListener("paste", (e) => {
      const x = e.clipboardData && e.clipboardData.getData("text");
      if (x && /<svg/i.test(x)) {
        e.preventDefault();
        tyUseSvg(x);
      }
    });
    zone.querySelector("#tyPath").addEventListener("input", (e) => {
      if (/<svg/i.test(e.target.value)) tyUseSvg(e.target.value);
      else {
        tyBad = false;
        if (e.target.value.trim()) tySvgTile(true);
        tyRefresh();
      }
    });
  }
  if (geo === "point" || geo === "area") {
    const pv = kit.tpl("t-mr-prev");
    pv.querySelectorAll("[data-prev]").forEach((x) => (x.hidden = x.dataset.prev !== geo));
    body.append(pv);
  }
  const err = kit.tpl("t-mr-err");
  err.id = "tyErr";
  body.append(err);
  f.querySelector('[data-act="save"]').id = "tyAdd";
  f.querySelector('[data-act="cancel"]').id = "tyCancel";
  if (t) {
    const del = kit.tpl("t-mr-trash"),
      used = typeUsage()[t.code] || 0;
    del.title = del.ariaLabel = used ? "Used by " + used + " places and shapes: change them first." : "Remove this type";
    del.disabled = !!used;
    f.append(del);
  }
  f.addEventListener("input", tyRefresh);
  f.addEventListener("change", tyRefresh);
  f.addEventListener("click", () => setTimeout(tyRefresh));
  f.addEventListener("submit", (e) => e.preventDefault());
  tyRefresh();
  renderTypes();
}
function tyCloseEditor() {
  tyEditing = null;
  mrSheet.close();
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
const tyShowErr = (msg) => kit.fill($("#tyErr"), { msg });
$("#typeList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tyedit]");
  if (!b) return;
  const t = types.find((x) => x.code === b.dataset.tyedit);
  tyOpenEditor(t, t.geometry);
});
$("#typeAdmin").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tynew]");
  if (b) tyOpenEditor(null, b.dataset.tynew);
});
$("#mr-sheet").addEventListener("click", async (e) => {
  if (!$("#tyAdd")) return; // another sheet (the overlay editor) is open
  if (e.target.closest("#tyCancel")) return tyCloseEditor();
  try {
    if (e.target.closest("[data-del]")) {
      if (!(await dialogs.confirm("remove-type", { name: typeLabel(tyEditing, $("#lang").value) }))) return;
      tyShowErr("Removing…");
      await tyPost(AHM_CONFIG.url.typeDelete, { code: tyEditing });
    } else if (e.target.closest("#tyAdd")) {
      tyShowErr("Saving…");
      const d = tyRead(),
        old = types.find((x) => x.code === tyEditing);
      if (tyGeo === "area" && old && old.style && old.style.outline && old.style.outline.opacity != null) d.style.outline.opacity = old.style.outline.opacity;
      await tyPost(AHM_CONFIG.url.typeSave, { ...(tyEditing ? { code: tyEditing, edit: true } : {}), geometry: tyGeo, names: tyReadNames(), color: d.color, style: d.style });
    } else return;
    tySet(await loadTypes());
    tyCloseEditor();
  } catch (x) {
    tyShowErr(x.message);
  }
});

// A range is blue up to its thumb: --mr-fill follows the value (typed here; set by the code of the 3D view and overlays too).
const mrFill = (r) => r.style.setProperty("--mr-fill", ((r.value - r.min) / (r.max - r.min)) * 100 + "%");
$("#tab-more").addEventListener("input", (e) => e.target.type === "range" && mrFill(e.target));
$("#tab-more").addEventListener("toggle", () => $("#tab-more").querySelectorAll("input[type=range]").forEach(mrFill), true); // a card that opens: its sliders were set while it was closed
