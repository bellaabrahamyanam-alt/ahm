// The shared search field (sidebar domain).
// One search field used everywhere: an input plus a clear (✕) button that shows while there is text.
function searchFieldHTML(id, placeholder, label) {
  return (
    `<div class="field input input-sm"><input class="grow" id="${id}" type="search" placeholder="${esc(placeholder)}" autocomplete="off" aria-label="${esc(label || placeholder)}">` +
    `<button type="button" class="clear" data-clearfor="${id}" title="Clear" aria-label="Clear" hidden>✕</button></div>`
  );
}
/** Shows the ✕ only for fields that have text. Call it after changing a field's value from code. */
function searchFieldSync() {
  document.querySelectorAll('.clear[data-clearfor]').forEach((b) => {
    const i = document.getElementById(b.dataset.clearfor);
    b.hidden = !i || i.value === '';
  });
}
// static fields are written in index.html as <div data-searchfield="id" data-placeholder="…"></div>
document.querySelectorAll('[data-searchfield]').forEach((el) => {
  el.outerHTML = searchFieldHTML(el.dataset.searchfield, el.dataset.placeholder);
});
document.addEventListener('input', (e) => {
  if (e.target.matches && e.target.matches('.field input[type="search"]')) searchFieldSync();
});
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.clear[data-clearfor]'),
    i = b && document.getElementById(b.dataset.clearfor);
  if (!i) return;
  i.value = '';
  i.dispatchEvent(new Event('input', { bubbles: true })); // the field's own handlers refilter
  i.focus();
});
