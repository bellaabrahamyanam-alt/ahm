// Single-choice selects shown as pills (sidebar domain, design v3, T-079).
// The <select> stays in the page and stays the source of the value (forms and tests read and set it as before); the pills only show it and set it.
// A language select shows at most PL_MAX pills (the chosen one always); the others are behind a "+N" button that opens a list with the code and the name.
const PL_SEL = "select.nl, select.pf-type, select.pf-cert, #nLang, #lang, #basemap, #tbSpeed";
const PL_MAX = 5;
const PL_CHEV = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const plIsLang = (sel) => sel.matches(".nl, #nLang, #lang");
// the base map choice shows cards with a small colour sample (T-080): plain map, satellite pictures, relief
const plSample = (o) => {
  const t = (o.value + " " + o.textContent).toLowerCase();
  if (/relief/.test(t)) return "linear-gradient(135deg,#c9a77a,#a8855c 55%,#6f4f33)";
  if (/satellite|aerial|photo|sat\b/.test(t)) return "linear-gradient(135deg,#4d6b4a,#8a8f5a 60%,#6b5a43)";
  if (/terrain/.test(t)) return "linear-gradient(135deg,#a8c98b,#d8dfae 55%,#e9e2b5)";
  return "#e6e1c6";
};

/** Redraw the pills of one select from its options and its value. */
function plRender(sel) {
  const box = sel.nextElementSibling;
  if (!box || !box.classList.contains("pills")) return;
  const opts = [...sel.options];
  const cur = sel.value;
  const lang = plIsLang(sel);
  const card = sel.id === "basemap";
  box.classList.toggle("cards", card);
  const label = (o) => (lang ? o.value || (sel.id === "lang" ? "All" : "") : sel.id === "tbSpeed" ? o.value + "×" : o.textContent.trim());
  const max = lang ? PL_MAX : opts.length; // languages: the first few and "+N"; types and certainty: all of them
  let shown = opts.slice(0, max);
  const chosen = opts.find((o) => o.value === cur);
  if (chosen && !shown.includes(chosen)) shown = [...shown.slice(0, max - 1), chosen];
  const rest = opts.length - shown.length;
  box.innerHTML =
    shown
      .map((o) => (card ? `<button type="button" class="pl card${o.value === cur ? " on" : ""}" data-v="${esc(o.value)}" aria-pressed="${o.value === cur}"><i style="background:${plSample(o)}"></i><span>${esc(o.textContent.trim())}</span></button>` : `<button type="button" class="pl${o.value === cur ? " on" : ""}" data-v="${esc(o.value)}" aria-pressed="${o.value === cur}" title="${esc(o.textContent.trim())}">${!lang && sel.matches(".pf-type") && typeof typeIcon === "function" ? typeIcon(o.value) : ""}${esc(label(o) || "Not stated")}${sel.id === "lang" && o.value && typeof places !== "undefined" ? `<span class="cn">${places.filter((p) => p.names.some((n) => n.lang === o.value)).length}</span>` : ""}</button>`))
      .join("") +
    (rest > 0 ? `<button type="button" class="pl more" aria-haspopup="listbox" aria-expanded="false" title="All choices"><span class="n">+${rest}</span>${PL_CHEV}</button>` : "") +
    `<div class="menu" role="listbox" hidden>${opts
      .map((o) => `<button type="button" class="mi${o.value === cur ? " on" : ""}" role="option" data-v="${esc(o.value)}" aria-selected="${o.value === cur}">${lang ? `<code>${esc(o.value)}</code><span class="nmx">${esc(o.textContent.replace(/\s*\([^)]*\)\s*$/, ""))}</span>` : `<span class="nmx">${esc(o.textContent.trim() || "Not stated")}</span>`}</button>`)
      .join("")}</div>`;
}

/** Hide one select behind its pills; a value set from code (select.value = ...) redraws them too. */
function plEnhance(sel) {
  if (sel.dataset.pl) return;
  sel.dataset.pl = "1";
  sel.classList.add("seg-src");
  sel.insertAdjacentHTML("afterend", '<div class="pills"></div>');
  const desc = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
  Object.defineProperty(sel, "value", {
    configurable: true,
    get() {
      return desc.get.call(sel);
    },
    set(v) {
      desc.set.call(sel, v);
      plRender(sel);
    },
  });
  plRender(sel);
}

function plScan(root) {
  if (root.matches && root.matches(PL_SEL)) plEnhance(root);
  if (root.querySelectorAll) root.querySelectorAll(PL_SEL).forEach(plEnhance);
}

document.addEventListener("click", (e) => {
  const b = e.target.closest(".pills button");
  document.querySelectorAll(".pills .menu:not([hidden])").forEach((m) => {
    if (!b || !m.contains(b)) {
      if (!(b && b.classList.contains("more") && b.parentElement === m.parentElement)) m.hidden = true;
    }
  });
  if (!b) return;
  const box = b.parentElement.classList.contains("menu") ? b.parentElement.parentElement : b.parentElement;
  const sel = box.previousElementSibling;
  if (b.classList.contains("more")) {
    const m = box.querySelector(".menu");
    m.hidden = !m.hidden;
    b.setAttribute("aria-expanded", String(!m.hidden));
    return;
  }
  if (!sel || !sel.dataset.pl || sel.value === b.dataset.v) return;
  sel.value = b.dataset.v; // redraws the pills
  sel.dispatchEvent(new Event("change", { bubbles: true }));
});

// a change made by anything else (the select itself, a test, an autofill) redraws the pills as well
document.addEventListener("change", (e) => e.target.dataset && e.target.dataset.pl && plRender(e.target));

new window.MutationObserver((muts) => {
  for (const m of muts) {
    if (m.target.nodeName === "SELECT" && m.target.dataset.pl) plRender(m.target); // options added or replaced
    m.addedNodes.forEach((n) => n.nodeType === 1 && plScan(n));
  }
}).observe(document.body, { childList: true, subtree: true });
plScan(document.body);

// Colour inputs show a row of round swatches (design v3.1, s74): six colours and a ring that opens the colour picker.
// The <input type=color> stays in the page, hidden, and stays the source of the value.
const SW_COLORS = ["#9a3b2e", "#2f5f8a", "#4f7a3a", "#d4a017", "#7b2d8e", "#3d4f5c"];
function swRender(inp) {
  const box = inp.nextElementSibling;
  if (!box || !box.classList.contains("swatches")) return;
  const cur = (inp.value || "").toLowerCase();
  box.innerHTML =
    SW_COLORS.map((c) => `<button type="button" class="sw${c === cur ? " on" : ""}" data-c="${c}" style="background:${c}" title="${c}" aria-label="Colour ${c}"></button>`).join("") +
    `<button type="button" class="sw custom${SW_COLORS.includes(cur) ? "" : " on"}" title="Other colour" aria-label="Other colour"${SW_COLORS.includes(cur) ? "" : ` style="--c:${cur}"`}></button>`;
}
function swEnhance(inp) {
  if (inp.dataset.sw || inp.closest("#ovEditPanel")) return;
  inp.dataset.sw = "1";
  inp.classList.add("seg-src");
  inp.insertAdjacentHTML("afterend", '<div class="swatches"></div>');
  const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  Object.defineProperty(inp, "value", { configurable: true, get() { return desc.get.call(inp); }, set(v) { desc.set.call(inp, v); swRender(inp); } });
  swRender(inp);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest(".swatches button");
  if (!b) return;
  const inp = b.parentElement.previousElementSibling;
  if (b.classList.contains("custom")) return inp.showPicker ? inp.showPicker() : inp.click();
  inp.value = b.dataset.c;
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  inp.dispatchEvent(new Event("change", { bubbles: true }));
});
document.addEventListener("input", (e) => e.target.dataset && e.target.dataset.sw && swRender(e.target));
const swScan = (root) => {
  if (root.matches && root.matches('input[type="color"]')) swEnhance(root);
  if (root.querySelectorAll) root.querySelectorAll('input[type="color"]').forEach(swEnhance);
};
new window.MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && swScan(n)))).observe(document.body, { childList: true, subtree: true });
swScan(document.body);
