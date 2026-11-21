// Single-choice selects shown as pills (sidebar domain, design v3, T-079).
// The <select> stays in the page and stays the source of the value (forms and tests read and set it as before); the pills only show it and set it.
// A language select shows at most PL_MAX pills (the chosen one always); the others are behind a "+N" button that opens a list with the code and the name.
const PL_SEL = "select.nl, select.pf-type, select.pf-cert, #nLang, #basemap";
const PL_MAX = 5;
const PL_CHEV = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const plIsLang = (sel) => sel.matches(".nl, #nLang");
// the base map choice shows cards with a small colour sample (T-080): plain map, satellite pictures, relief
const plSample = (o) => (o.value === "" ? "#e6e1c6" : /relief/i.test(o.value + o.textContent) ? "linear-gradient(135deg,#a8c98b,#e9dfa8 55%,#a58a6a)" : "linear-gradient(135deg,#4d6b4a,#8a8f5a 60%,#6b5a43)");

/** Redraw the pills of one select from its options and its value. */
function plRender(sel) {
  const box = sel.nextElementSibling;
  if (!box || !box.classList.contains("pills")) return;
  const opts = [...sel.options];
  const cur = sel.value;
  const lang = plIsLang(sel);
  const card = sel.id === "basemap";
  box.classList.toggle("cards", card);
  const label = (o) => (lang ? o.value : o.textContent.trim());
  const max = lang ? PL_MAX : opts.length; // languages: the first few and "+N"; types and certainty: all of them
  let shown = opts.slice(0, max);
  const chosen = opts.find((o) => o.value === cur);
  if (chosen && !shown.includes(chosen)) shown = [...shown.slice(0, max - 1), chosen];
  const rest = opts.length - shown.length;
  box.innerHTML =
    shown
      .map((o) => (card ? `<button type="button" class="pl card${o.value === cur ? " on" : ""}" data-v="${esc(o.value)}" aria-pressed="${o.value === cur}"><i style="background:${plSample(o)}"></i><span>${esc(o.textContent.trim())}</span></button>` : `<button type="button" class="pl${o.value === cur ? " on" : ""}" data-v="${esc(o.value)}" aria-pressed="${o.value === cur}" title="${esc(o.textContent.trim())}">${esc(label(o) || "Not stated")}</button>`))
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
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
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

new MutationObserver((muts) => {
  for (const m of muts) {
    if (m.target.nodeName === "SELECT" && m.target.dataset.pl) plRender(m.target); // options added or replaced
    m.addedNodes.forEach((n) => n.nodeType === 1 && plScan(n));
  }
}).observe(document.body, { childList: true, subtree: true });
plScan(document.body);
