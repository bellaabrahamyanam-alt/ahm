// Confirm dialog and toast (foundation v2). Markup: <dialog id="ahm-confirm"> and #ahm-toasts in the dialogs region of index.html.
// dialogs.confirm(kind, vars) -> Promise<boolean>; dialogs.toast(message, kind)
const DIALOG_TEXTS = {
  // the texts of frames s068 and s069; vars = { name, count, type }
  delete: { title: (v) => `Delete “${v.name}”?`, body: () => 'It also leaves its layers. A copy of the old file stays in the archive on the server.', ok: 'Delete', danger: true },
  'remove-type': { title: (v) => `Remove the type “${v.name}”?`, body: () => 'Only possible when no place or shape uses it.', ok: 'Remove', danger: true },
  'delete-layer': { title: (v) => `Delete the layer “${v.name}”?`, body: () => 'Its places and their notes stay on the map. A copy is archived.', ok: 'Delete', danger: true },
  import: { title: (v) => `Import ${v.count} shapes as borders?`, body: (v) => `They get the type “${v.type}”. You can change the type afterwards.`, ok: 'Import', danger: false },
  'discard-route': { title: () => 'Discard this route?', body: () => 'The points you clicked are lost.', ok: 'Discard', danger: true },
};
const dialogs = {
  texts: DIALOG_TEXTS,
  confirm(kind, vars = {}) {
    const t = DIALOG_TEXTS[kind];
    if (!t) return Promise.reject(new Error('unknown confirm kind: ' + kind));
    const d = document.getElementById('ahm-confirm'),
      ok = d.querySelector('[data-ok]');
    kit.fill(d, { title: t.title(vars), body: t.body(vars), ok: t.ok });
    ok.classList.toggle('btn-error', t.danger);
    ok.classList.toggle('btn-primary', !t.danger);
    return new Promise((resolve) => {
      d.returnValue = 'cancel';
      d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true }); // Escape, backdrop and Cancel all close with 'cancel'
      d.showModal();
    });
  },
  /** A short message that goes away by itself; kind = info | ok | error (an error stays 3 times longer). */
  toast(message, kind = 'info', ms = 4000) {
    const box = document.getElementById('ahm-toasts'),
      n = kit.tpl('t-toast');
    kit.fill(n, { text: message });
    n.classList.add({ ok: 'alert-success', error: 'alert-error', info: 'alert-info' }[kind] || 'alert-info');
    box.append(n);
    setTimeout(() => n.remove(), kind === 'error' ? ms * 3 : ms);
    return n;
  },
};
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('offline', () => dialogs.toast('You are offline: changes cannot be saved.', 'error'));
  window.addEventListener('online', () => dialogs.toast('Back online.', 'ok'));
}
