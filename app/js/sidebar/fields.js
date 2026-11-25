// Shared form fields (foundation v2, docs/design-migration/02). Markup = <template>s in the templates region of index.html (daisyUI classes);
// this file clones them and fills them with text, values and attributes. It never builds markup from strings.
// Values are the same as before: dates are the date object of core/dates.js, names are [{lang,name,date_from,date_to}], styles are {color, style}.
let fieldsSeq = 0;
const fieldsEl = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** Which pills fit in a row. widths = natural width of each pill, avail = row width, plusW = width of the "+N" button, sel = index that must stay visible (or -1).
 *  All fit -> no "+N". Otherwise as many as fit beside "+N"; the selected one replaces the last visible pill. Pure: tested in node. */
function pillFit(widths, avail, plusW, sel, gap = 6) {
  const n = widths.length,
    all = widths.reduce((a, w) => a + w, 0) + gap * Math.max(0, n - 1);
  if (all <= avail) return { shown: widths.map((_, i) => i), more: 0 };
  let used = plusW;
  const shown = [];
  for (let i = 0; i < n; i++) {
    if (used + gap + widths[i] > avail) break;
    used += gap + widths[i];
    shown.push(i);
  }
  if (sel >= 0 && !shown.includes(sel)) {
    while (shown.length && used + gap + widths[sel] > avail) used -= gap + widths[shown.pop()];
    shown.push(sel);
  }
  return { shown, more: n - shown.length };
}

const fields = {
  // ---------- date field (s047, s048) ----------
  /** date = null (unknown) or { fmt, ts, mode, ts_to }; opts { modes, names, fmt, label }. */
  date(date, opts = {}) {
    const node = kit.tpl('t-date'),
      modes = opts.modes || ['none', 'exact', 'approx', 'range'],
      names = Object.assign({}, DF_MODES, opts.names),
      id = ++fieldsSeq;
    node.dataset.mode = date ? date.mode : 'none';
    node.dataset.fmt = date ? date.fmt : opts.fmt || 'y';
    const box = node.querySelector('[data-modes]');
    for (const m of modes) {
      const r = kit.tpl('t-date-mode');
      r.name = 'dm' + id;
      r.value = m;
      r.checked = m === node.dataset.mode;
      r.setAttribute('aria-label', names[m]);
      box.append(r);
    }
    const menu = node.querySelector('[data-menu]');
    for (const [title, ids] of DF_FORMAT_GROUPS) {
      menu.append(kit.fill(kit.tpl('t-menu-title'), { title }));
      for (const f of ids) {
        const li = kit.tpl('t-fmt-item');
        kit.fill(li, { label: dateFormat(f).label, example: dateFormat(f).example });
        li.querySelector('[data-fmt]').dataset.fmt = f;
        menu.append(li);
      }
    }
    fields._dateBody(node, date && date.ts, date && date.ts_to);
    fields._dateSync(node);
    node.addEventListener('change', (e) => {
      if (e.target.name === 'dm' + id) {
        const keep = fields._dateTry(node);
        node.dataset.mode = e.target.value;
        fields._dateBody(node, keep && keep.ts, keep && keep.mode === 'range' ? keep.ts_to : null);
      }
      fields._dateSync(node);
    });
    node.addEventListener('input', () => fields._dateSync(node));
    node.addEventListener('click', (e) => {
      const f = e.target.closest('[data-fmt]');
      if (f) {
        const keep = fields._dateTry(node);
        node.dataset.fmt = f.dataset.fmt;
        node.querySelector('details').open = false;
        fields._dateBody(node, keep && keep.ts, keep && keep.mode === 'range' ? keep.ts_to : null);
        fields._dateSync(node);
        node.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      const era = e.target.closest('[data-era]');
      if (era) fields._dateSync(node);
    });
    return node;
  },
  /** What was typed, in the format it was typed in; null when unreadable or Unknown. */
  _dateTry(node) {
    try {
      return fields.dateRead(node, 'Date');
    } catch (e) {
      return null;
    }
  },
  _dateBody(node, ts, tsTo) {
    const body = node.querySelector('[data-body]'),
      mode = node.dataset.mode,
      fmt = node.dataset.fmt,
      F = dateFormat(fmt);
    body.replaceChildren();
    if (mode === 'none') return;
    const one = (t, label) => {
      const g = kit.tpl('t-date-group'),
        f = t === null || t === undefined ? {} : dateFromTs(fmt, t),
        q = (k) => g.querySelector(`[data-f="${k}"]`);
      kit.fill(g, { label: label || '', word: F.word || '' });
      kit.show(g.querySelector('.ahm-hint'), !!label);
      q('d').hidden = !F.fields.includes('d');
      q('y').hidden = !F.fields.includes('y');
      q('n').hidden = !F.fields.includes('n');
      q('m').hidden = !(F.fields.includes('m') && !F.monthName);
      q('mname').hidden = !(F.fields.includes('m') && F.monthName);
      MONTHS.forEach((n, i) => {
        const o = fieldsEl('option', '', n);
        o.value = String(i + 1);
        q('mname').append(o);
      });
      if (F.fields.includes('n')) q('n').max = fmt === 'c' ? 1000 : 100;
      for (const k of ['d', 'y', 'n']) q(k).value = f[k] ?? '';
      q('m').value = f.m ?? '';
      q('mname').value = String(f.m ?? 1);
      const idn = 'era' + ++fieldsSeq;
      g.querySelectorAll('[data-era]').forEach((r) => {
        r.name = idn;
        r.checked = r.dataset.era === (f.era || 'CE');
      });
      return g;
    };
    if (mode === 'range') body.append(one(ts, 'From'), one(tsTo, 'To'));
    else body.append(one(ts));
  },
  /** Mode and format pieces that follow the state: the format label, the ticked format, the preview line (red when unreadable). */
  _dateSync(node) {
    kit.fill(node, { fmt: dateFormat(node.dataset.fmt).label });
    node.querySelectorAll('[data-fmt]').forEach((b) => b.classList.toggle('menu-active', b.dataset.fmt === node.dataset.fmt));
    let text = '',
      bad = false;
    try {
      const d = fields.dateRead(node, 'Date');
      text = d ? dateText(d) : '';
    } catch (e) {
      text = node.querySelector('[data-body] input:not(:placeholder-shown)') ? e.message : '';
      bad = !!text;
    }
    const p = node.querySelector('[data-bind="preview"]');
    p.textContent = text;
    p.classList.toggle('text-error', bad);
  },
  /** The date object, or null when Unknown; throws a readable Error. */
  dateRead(node, what = 'Date') {
    const mode = node.dataset.mode,
      fmt = node.dataset.fmt;
    if (mode === 'none') return null;
    const ts = (g) => {
      const v = (k) => {
        const e = g.querySelector(`[data-f="${k}"]`);
        return e && !e.hidden ? e.value : undefined;
      };
      const era = g.querySelector('[data-era]:checked');
      try {
        return dateToTs(fmt, { era: era ? era.dataset.era : 'CE', y: v('y'), m: v('m') ?? v('mname'), d: v('d'), n: v('n') });
      } catch (e) {
        throw Error(`${what}: ${e.message}`);
      }
    };
    const g = node.querySelectorAll('.ahm-date-g');
    return dateClean({ fmt, mode, ts: ts(g[0]), ts_to: mode === 'range' ? ts(g[1]) : null }, what);
  },
  /** Like dateRead, never throws: an unreadable field is marked and counts as Unknown. */
  dateSafe(node) {
    try {
      const d = fields.dateRead(node, 'Date');
      node.classList.remove('ahm-bad');
      return d;
    } catch (e) {
      node.classList.add('ahm-bad');
      return null;
    }
  },

  // ---------- pills: one value, "+N" picker (s056-s058) ----------
  /** items [{code, name}], cur = the chosen code. The node's dataset.value holds the value; a click sends `change`. */
  pills(items, cur, opts = {}) {
    const node = kit.tpl('t-pills'),
      row = node.querySelector('[data-pills]'),
      more = node.querySelector('.ahm-more'),
      menu = node.querySelector('[data-menu]'),
      list = items.slice();
    if (cur && !list.some((i) => i.code === cur)) list.push({ code: cur, name: cur });
    node.dataset.value = cur || '';
    const name = `pl${++fieldsSeq}`;
    const pillEls = list.map((it) => {
      const b = kit.tpl('t-pill');
      kit.fill(b, { code: opts.label ? opts.label(it) : it.code });
      b.dataset.code = it.code;
      b.title = it.name;
      row.append(b);
      return b;
    });
    list.forEach((it) => {
      const li = kit.tpl('t-pill-opt'),
        r = li.querySelector('input');
      r.name = name;
      r.value = it.code;
      kit.fill(li, { name: it.name });
      menu.append(li);
    });
    const set = (code) => {
      node.dataset.value = code;
      pillEls.forEach((b) => {
        b.classList.toggle('btn-primary', b.dataset.code === code);
        b.setAttribute('aria-pressed', String(b.dataset.code === code));
      });
      menu.querySelectorAll('input').forEach((r) => (r.checked = r.value === code));
      fields.fit(node);
    };
    kit.on(row, 'click', '[data-code]', (e, b) => {
      set(b.dataset.code);
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    menu.addEventListener('change', (e) => {
      e.stopPropagation();
      more.open = false;
      set(e.target.value);
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    node._set = set;
    node._pills = pillEls;
    set(cur || '');
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fields.fit(node)).observe(node);
    return node;
  },
  /** Shows as many pills as fit; the "+N" button lists the others. Needs the node to be in the page. */
  fit(node) {
    const pills = node._pills,
      more = node.querySelector('.ahm-more'),
      avail = node.clientWidth;
    if (!avail) return;
    pills.forEach((b) => (b.hidden = false));
    kit.show(more, true);
    const plusW = (kit.fill(more, { more: '+' + pills.length }), more.offsetWidth);
    const r = pillFit(pills.map((b) => b.offsetWidth), avail, plusW, pills.findIndex((b) => b.dataset.code === node.dataset.value));
    pills.forEach((b, i) => (b.hidden = !r.shown.includes(i)));
    kit.show(more, r.more > 0);
    kit.fill(more, { more: '+' + r.more });
    node.querySelectorAll('[data-menu] li').forEach((li, i) => (li.hidden = r.shown.includes(i)));
  },
  /** Type pills: items [{code, name}] -> the same node as pills. */
  typePills: (items, cur) => fields.pills(items, cur, { label: (i) => i.name }),

  // ---------- language filter (s055) ----------
  /** items [{code, name, count}], selected = array of codes. Top languages are chips, the rest are in a checkbox picker with Clear and Done. Sends `change`; node.selected() gives the codes. */
  langFilter(items, selected, top = 4) {
    const node = kit.tpl('t-lang-filter'),
      row = node.querySelector('[data-pills]'),
      more = node.querySelector('.ahm-more'),
      menu = node.querySelector('[data-menu]'),
      sel = new Set(selected),
      ranked = items.slice().sort((a, b) => b.count - a.count),
      chips = ranked.slice(0, top),
      rest = ranked.slice(top);
    const draw = () => {
      row.querySelectorAll('[data-code]').forEach((b) => b.classList.toggle('btn-primary', sel.has(b.dataset.code)));
      menu.querySelectorAll('input').forEach((c) => (c.checked = sel.has(c.value)));
      kit.fill(more, { more: sel.size && rest.some((r) => sel.has(r.code)) ? `+${rest.length} · ${[...sel].filter((c) => rest.some((r) => r.code === c)).length}` : '+' + rest.length });
    };
    for (const it of chips) {
      const b = kit.tpl('t-pill');
      kit.fill(b, { code: `${it.name} ${it.count}` });
      b.dataset.code = it.code;
      row.append(b);
    }
    for (const it of rest) {
      const li = kit.tpl('t-pill-check');
      li.querySelector('input').value = it.code;
      kit.fill(li, { name: it.name, count: it.count });
      menu.append(li);
    }
    kit.show(more, rest.length > 0);
    const fire = () => (draw(), node.dispatchEvent(new Event('change', { bubbles: true })));
    kit.on(row, 'click', '[data-code]', (e, b) => (sel.has(b.dataset.code) ? sel.delete(b.dataset.code) : sel.add(b.dataset.code), fire()));
    menu.addEventListener('change', (e) => {
      e.stopPropagation();
      e.target.checked ? sel.add(e.target.value) : sel.delete(e.target.value);
      fire();
    });
    node.querySelector('[data-act="clear"]').addEventListener('click', () => (sel.clear(), fire()));
    node.querySelector('[data-act="done"]').addEventListener('click', () => (more.open = false));
    node.selected = () => [...sel];
    draw();
    return node;
  },

  // ---------- name editor (s007, s028) ----------
  /** langs [{code,name}], names [{lang,name,date_from,date_to}]; fills `root` with one name card per name. */
  nameList(root, langs, names) {
    root.replaceChildren();
    root._langs = langs;
    for (const n of names) root.append(fields.nameRow(langs, n));
    if (!root._wired) {
      root._wired = true;
      kit.on(root, 'click', '[data-act]', (e, b) => {
        const row = b.closest('.ahm-name');
        if (b.dataset.act === 'del') row.remove();
        else if (b.dataset.act === 'up' && row.previousElementSibling) row.previousElementSibling.before(row);
        else if (b.dataset.act === 'period') fields._periodToggle(row);
      });
    }
    return root;
  },
  /** One more empty name (the "Add another name" button). */
  nameAdd(root, lang) {
    const r = fields.nameRow(root._langs, { lang: lang || (root._langs[0] || {}).code || '', name: '' });
    root.append(r);
    return r;
  },
  nameRow(langs, n) {
    const row = kit.tpl('t-name'),
      pills = fields.pills(langs, n.lang);
    row.querySelector('[data-lang]').append(pills);
    kit.fill(row, { name: n.name || '' });
    row._pills = pills;
    const has = !!(n.date_from || n.date_to);
    kit.fill(row, { period: has ? spanText(n.date_from || null, n.date_to || null) : 'unknown', periodBtn: has ? 'Edit' : 'Set' });
    row._period = { from: n.date_from || null, to: n.date_to || null };
    return row;
  },
  _periodToggle(row) {
    const body = row.querySelector('[data-period-body]'),
      open = body.hidden;
    if (open) {
      const o = { modes: ['none', 'exact'], names: { none: 'Any' } };
      body.replaceChildren(fields.date(row._period.from, o), fields.date(row._period.to, o));
      kit.show(body, true);
      kit.fill(row, { periodBtn: 'Done' });
    } else {
      const [a, b] = [...body.children].map((d) => fields.dateRead(d, 'Name period'));
      dateOrderCheck(a, b);
      row._period = { from: a, to: b };
      body.replaceChildren();
      kit.show(body, false);
      kit.fill(row, { period: a || b ? spanText(a, b) : 'unknown', periodBtn: a || b ? 'Edit' : 'Set' });
    }
  },
  /** [{lang, name, date_from?, date_to?}] of the cards in `root`; empty names are dropped; throws the readable error of a bad date. */
  readNames(root) {
    return [...root.querySelectorAll('.ahm-name')]
      .map((r) => {
        if (!r.querySelector('[data-period-body]').hidden) fields._periodToggle(r); // an open Period row counts as Done
        const n = { lang: r._pills.dataset.value, name: r.querySelector('[data-value="name"]').value.trim() };
        if (n.name && r._period.from) n.date_from = r._period.from;
        if (n.name && r._period.to) n.date_to = r._period.to;
        return n;
      })
      .filter((n) => n.name);
  },

  // ---------- style editor (s020, s042-s044) ----------
  /** kind = point | line | area | river; symbols [{name}] for points. */
  styleEditor(kind, color, style, symbols = []) {
    const node = kit.tpl('t-style'),
      st = style || {},
      ol = kind === 'area' ? st.outline || {} : st,
      c = String(color || UI_SWATCHES[0]).toLowerCase(),
      q = (k) => node.querySelector(`[data-st="${k}"]`),
      sec = (k) => node.querySelector(`[data-sec="${k}"]`),
      show = { point: ['point', 'size'], area: ['fill', 'width', 'pattern'], line: ['width', 'opacity', 'pattern', 'arrow'], river: ['width', 'opacity', 'pattern'] }[kind === 'river' ? 'river' : kind];
    node.dataset.kind = kind;
    node.querySelectorAll('[data-sec]').forEach((s) => kit.show(s, show.includes(s.dataset.sec)));
    q('color').value = c;
    const sw = node.querySelector('[data-swatches]');
    for (const x of UI_SWATCHES) {
      const b = kit.tpl('t-swatch');
      b.dataset.swatch = x;
      b.style.background = x;
      b.setAttribute('aria-label', 'Colour ' + x);
      sw.append(b);
    }
    const syms = node.querySelector('[data-symbols]');
    for (const y of symbols) {
      const b = kit.tpl('t-sym');
      kit.fill(b, { name: y.name });
      b.dataset.symbol = y.name;
      b.classList.toggle('ahm-on', y.name === st.symbol);
      syms.append(b);
    }
    const pats = node.querySelector('[data-patterns]');
    for (const p of UI_PATTERNS) {
      const r = kit.tpl('t-pattern');
      r.value = p;
      r.setAttribute('aria-label', p);
      r.checked = p === (ol.pattern || 'solid');
      pats.append(r);
    }
    kit.fill(node, { widthLabel: kind === 'area' ? 'Outline width' : 'Width', patternLabel: kind === 'area' ? 'Outline pattern' : 'Pattern' });
    q('size').value = Number(st.size) || 8;
    q('fill_opacity').value = st.fill_opacity == null ? 0.15 : st.fill_opacity;
    q('width').value = Number(ol.width) || (kind === 'area' ? 2 : 2.5);
    q('opacity').value = ol.opacity == null ? 1 : ol.opacity;
    q('arrow').checked = !!st.arrow;
    const out = () => {
      node.querySelectorAll('input[type=range]').forEach((r) => (r.parentElement.querySelector('[data-out]').value = r.value + (r.dataset.st === 'width' ? ' px' : '')));
      sw.querySelectorAll('[data-swatch]').forEach((b) => b.classList.toggle('ahm-on', b.dataset.swatch === q('color').value.toLowerCase()));
    };
    kit.on(node, 'click', '[data-swatch]', (e, b) => {
      q('color').value = b.dataset.swatch;
      out();
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    kit.on(node, 'click', '[data-symbol]', (e, b) => {
      syms.querySelectorAll('[data-symbol]').forEach((x) => x.classList.toggle('ahm-on', x === b));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    node.addEventListener('input', out);
    out();
    return node;
  },
  /** { color, style } as the server stores them; throws a readable Error. */
  readStyle(node) {
    const kind = node.dataset.kind,
      q = (k) => node.querySelector(`[data-st="${k}"]`),
      num = (k) => Number(q(k).value),
      color = q('color').value.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) throw Error('Choose a colour.');
    if (kind === 'point') {
      const y = node.querySelector('[data-symbol].ahm-on');
      return { color, style: { ...(y ? { symbol: y.dataset.symbol } : {}), size: num('size') } };
    }
    const p = node.querySelector('[data-patterns] :checked'),
      line = { width: num('width'), pattern: p ? p.value : 'solid' };
    if (kind === 'area') return { color, style: { fill_opacity: num('fill_opacity'), outline: { ...line, opacity: 1 } } };
    return { color, style: { ...line, opacity: num('opacity'), ...(kind === 'line' ? { arrow: q('arrow').checked } : {}) } };
  },

  // ---------- form frame, note, list row ----------
  /** The form with a sticky Save / Cancel bar; returns the node, put your fields into node.querySelector('[data-body]'). */
  form(title, o = {}) {
    const f = kit.tpl('t-form');
    kit.fill(f, { title, save: o.save || 'Save', cancel: o.cancel || 'Cancel' });
    if (o.danger) f.querySelector('[data-act="save"]').classList.replace('btn-primary', 'btn-error');
    return f;
  },
  /** One note of a timeline: n = { title, lang, when, text }. Long text is clamped with Show more / Show less. */
  note(n) {
    const a = kit.tpl('t-note'),
      text = a.querySelector('.ahm-text'),
      more = a.querySelector('[data-more]');
    kit.fill(a, { title: n.title, lang: n.lang, when: n.when || 'No date', text: n.text });
    kit.show(more, (n.text || '').length > 140);
    more.addEventListener('click', () => {
      const open = text.classList.toggle('ahm-clamp') === false;
      more.textContent = open ? 'Show less' : 'Show more';
    });
    return a;
  },
  /** One list row: { id, title, sub, count, icon (a node or null) }. */
  row(r) {
    const li = kit.tpl('t-row');
    kit.fill(li, { title: r.title, sub: r.sub || '', count: r.count == null ? '' : r.count });
    li.dataset.id = r.id;
    if (r.icon) li.querySelector('[data-icon]').append(r.icon);
    return li;
  },
};
