// Template kit (foundation v2, docs/design-migration/02): the only way shared code touches markup.
// Markup lives in <template> elements of index.html; these functions clone them and fill them with text, values and attributes.
// Nothing here builds HTML from strings.
const kit = {
  /** A clone of the first element of <template id="id">. */
  tpl(id) {
    const t = document.getElementById(id);
    if (!t || !t.content) throw new Error('template not found: ' + id);
    return t.content.firstElementChild.cloneNode(true);
  },
  /** Sets [data-bind] by textContent and [data-value] by .value inside `el` (and on `el` itself). */
  fill(el, map) {
    for (const k of Object.keys(map)) {
      const v = map[k] === null || map[k] === undefined ? '' : String(map[k]);
      const hit = (attr, fn) => [...(el.matches(`[${attr}="${k}"]`) ? [el] : []), ...el.querySelectorAll(`[${attr}="${k}"]`)].forEach(fn);
      hit('data-bind', (n) => (n.textContent = v));
      hit('data-value', (n) => (n.value = v));
    }
    return el;
  },
  show(el, on) {
    el.hidden = !on;
    return el;
  },
  /** Delegated event: fn(event, matchedElement) when `selector` matches the target or an ancestor inside `root`. */
  on(root, event, selector, fn) {
    root.addEventListener(event, (e) => {
      const t = e.target.closest && e.target.closest(selector);
      if (t && root.contains(t)) fn(e, t);
    });
  },
  /** Makes the children of `container` match `items` (each { id, ... }): rows are cloned from template `tplId`, kept by data-id, reordered, and filled by fn(node, item). */
  list(container, items, tplId, fn) {
    const old = new Map([...container.children].filter((c) => c.dataset.id !== undefined).map((c) => [c.dataset.id, c]));
    const keep = new Set();
    for (const it of items) {
      const id = String(it.id);
      const node = old.get(id) || kit.tpl(tplId);
      node.dataset.id = id;
      fn(node, it);
      container.append(node); // appending an attached node moves it: the order follows `items`
      keep.add(id);
    }
    for (const [id, node] of old) if (!keep.has(id)) node.remove();
    return container;
  },
  /** The state block of a list or sheet: kind = empty | loading | error | down | readonly. retry (a function) adds the Retry button. */
  state(container, kind, text, retry) {
    const node = kit.tpl('t-state-' + kind);
    kit.fill(node, { text });
    const btn = node.querySelector('[data-retry]');
    if (btn) {
      btn.hidden = typeof retry !== 'function';
      if (typeof retry === 'function') btn.addEventListener('click', retry);
    }
    container.replaceChildren(node);
    return node;
  },
  /** Marks a field invalid with a message under it. */
  invalid(el, msg) {
    kit.clearField(el);
    el.classList.add(el.tagName === 'SELECT' ? 'select-error' : el.tagName === 'TEXTAREA' ? 'textarea-error' : 'input-error');
    el.setAttribute('aria-invalid', 'true');
    const p = kit.tpl('t-field-error');
    kit.fill(p, { msg });
    (el.closest('label.input, label.select') || el).after(p);
    return p;
  },
  clearField(el) {
    el.classList.remove('input-error', 'select-error', 'textarea-error');
    el.removeAttribute('aria-invalid');
    const n = (el.closest('label.input, label.select') || el).nextElementSibling;
    if (n && n.hasAttribute('data-field-error')) n.remove();
  },
  /** Removes every inline error inside `form`. */
  clear(form) {
    form.querySelectorAll('[aria-invalid]').forEach((el) => kit.clearField(el));
    form.querySelectorAll('[data-field-error]').forEach((n) => n.remove());
  },
};
