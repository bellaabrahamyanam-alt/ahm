#!/usr/bin/env node
// UI verification helper for agents and people (shared domain). One file, no dependency in the app.
//   node tools/ui.js setup                         install Chromium + daisyUI + MapLibre copies once (needs registry.npmjs.org)
//   node tools/ui.js shot out.png [--panel] [--tab more] [--h 860] [--js "code"] [--wait 400]   screenshot the app (dev server started for you)
//        --panel = the side panel only, 400px wide like the design frames (desktop layout, clipped); without it: --w 400 is the PHONE bottom sheet
//   node tools/ui.js compare frame.png shot.png out.png   frame | shot | difference, side by side, to LOOK at
//   node tools/ui.js probe image.png x,y [x,y ...]        colour of single pixels
//   node tools/ui.js runs image.png --col X | --row Y     colour runs along a line: sizes of bars, rows, gaps (px)
//   node tools/ui.js crop image.png out.png x,y,w,h [--zoom 3]   cut and enlarge a region
// Everything lives in $AHM_UI_HOME (default /tmp/ahm-ui). The CDN is blocked in sandboxes: daisyUI and MapLibre are served from the
// local npm copies; if daisyUI is not really applied the screenshot command STOPS with an error instead of giving a wrong picture.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'), { createRequire } = require('module');
const HOME = process.env.AHM_UI_HOME || '/tmp/ahm-ui';
const ROOT = path.resolve(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const need = (m) => { try { return createRequire(HOME + '/')(m); } catch { console.error(`Missing ${m}. Run: node tools/ui.js setup`); process.exit(2); } };
async function browser() {
  const core = need('playwright-core'), sp = need('@sparticuz/chromium'), chromium = sp.default || sp;
  return core.chromium.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
}
const mime = (f) => ({ '.png': 'image/png', '.jpg': 'image/jpeg' }[path.extname(f)] || 'image/png');
const dataUrl = (f) => `data:${mime(f)};base64,${fs.readFileSync(f).toString('base64')}`;
async function withImage(file, fn) { // run fn(page) with the image drawn on a canvas `c`
  const b = await browser(), p = await b.newPage();
  await p.setContent(`<canvas id=c></canvas><script>window.load=(u)=>new Promise(r=>{const i=new Image();i.onload=()=>{const c=document.getElementById('c');c.width=i.width;c.height=i.height;c.getContext('2d').drawImage(i,0,0);r([i.width,i.height])};i.src=u})</script>`);
  const size = await p.evaluate((u) => window.load(u), dataUrl(file));
  try { return await fn(p, size); } finally { await b.close(); }
}
const hex = (a) => '#' + a.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
(async () => {
  const cmd = process.argv[2];
  if (cmd === 'setup') {
    fs.mkdirSync(HOME, { recursive: true });
    if (!fs.existsSync(HOME + '/package.json')) execSync('npm init -y', { cwd: HOME, stdio: 'ignore' });
    execSync('npm i @sparticuz/chromium playwright-core daisyui@5.8.2 maplibre-gl@5.24.1', { cwd: HOME, stdio: 'inherit' });
    const shim = HOME + '/shim/playwright';
    fs.mkdirSync(shim, { recursive: true });
    fs.writeFileSync(shim + '/index.js', `const r=(m)=>require(require.resolve(m,{paths:['${HOME}']}));const core=r('playwright-core');const sp=r('@sparticuz/chromium');const chromium=sp.default||sp;const orig=core.chromium.launch.bind(core.chromium);core.chromium.launch=async(o={})=>orig({...o,executablePath:await chromium.executablePath(),args:[...(o.args||[]),...chromium.args],headless:true});module.exports=core;\n`);
    console.log(`\nDone. Real-browser tests: NODE_PATH=${HOME}/shim node tests/js/run.js\nScreenshots: node tools/ui.js shot /tmp/a.png --w 400 --h 860`);
  } else if (cmd === 'shot') {
    const out = process.argv[3], panel = process.argv.includes('--panel'), W = panel ? 1100 : +arg('w', 400), H = +arg('h', 860), js = arg('js', ''), wait = +arg('wait', 400), tabName = arg('tab', '');
    const css = HOME + '/node_modules/daisyui/daisyui.css';
    if (!fs.existsSync(css)) { console.error('daisyui.css not found at ' + css + '. Run: node tools/ui.js setup'); process.exit(2); }
    const { start } = require(ROOT + '/tests/js/lib/devserver');
    const srv = await start(), b = await browser(), p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push('console: ' + m.text().slice(0, 200)));
    await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await p.route(/cdn\.jsdelivr\.net\/npm\/(daisyui|maplibre-gl)@[^/]+\/(.*)$/, (r) => {
      const m = r.request().url().match(/npm\/(daisyui|maplibre-gl)@[^/]+\/(.*)$/), f = `${HOME}/node_modules/${m[1]}/${m[2]}`;
      fs.existsSync(f) ? r.fulfill({ path: f }) : r.abort();
    });
    await p.goto(srv.base + '/', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const applied = await p.evaluate(() => { const e = document.createElement('button'); e.className = 'btn btn-primary'; document.body.append(e); const ok = getComputedStyle(e).minHeight !== '0px' && getComputedStyle(e).borderRadius !== '0px'; e.remove(); return ok; });
    if (!applied) { console.error('daisyUI is NOT applied on the page (the .btn class has no style). The screenshot would be wrong. Check the CDN route / index.html link.'); await b.close(); process.exit(3); }
    if (panel) await p.evaluate(() => { const a = document.querySelector('aside'); if (a) a.style.width = '400px'; });
    if (tabName) await p.evaluate((n) => tab(n), tabName);
    if (js) await p.evaluate(js);
    await p.waitForTimeout(wait);
    await p.screenshot(panel ? { path: out, clip: { x: 0, y: 0, width: 400, height: H } } : { path: out });
    console.log('saved ' + out + (errs.length ? '\npage errors:\n  ' + errs.join('\n  ') : '\nno page errors'));
    await b.close(); process.exit(0);
  } else if (cmd === 'compare') {
    const [fa, sa, out] = process.argv.slice(3), b = await browser(), p = await b.newPage();
    await p.setContent('<body style="margin:0;background:#fff"></body>');
    const png = await p.evaluate(async ([A, B]) => {
      const L = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
      const [a, s] = [await L(A), await L(B)], w = Math.max(a.width, s.width), h = Math.max(a.height, s.height), c = document.createElement('canvas');
      c.width = w * 3 + 40; c.height = h + 24; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#000'; x.font = '14px sans-serif'; x.fillText('FRAME (design)', 4, 16); x.fillText('SHOT (app)', w + 24, 16); x.fillText('DIFFERENCE (bright = differs)', 2 * w + 44, 16);
      x.drawImage(a, 0, 24); x.drawImage(s, w + 20, 24);
      const t = document.createElement('canvas'); t.width = w; t.height = h; const tx = t.getContext('2d'); tx.drawImage(a, 0, 0); const da = tx.getImageData(0, 0, w, h);
      tx.clearRect(0, 0, w, h); tx.drawImage(s, 0, 0); const db = tx.getImageData(0, 0, w, h), o = tx.createImageData(w, h);
      for (let i = 0; i < o.data.length; i += 4) { const d = (Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2])) / 3; const v = Math.min(255, d * 4); o.data[i] = o.data[i + 1] = o.data[i + 2] = 255 - v; o.data[i + 3] = 255; }
      tx.putImageData(o, 0, 0); x.drawImage(t, 2 * w + 40, 24);
      return c.toDataURL('image/png').split(',')[1];
    }, [dataUrl(fa), dataUrl(sa)]);
    fs.writeFileSync(out, Buffer.from(png, 'base64')); console.log('saved ' + out + '  (open it with your image viewer tool and LOOK)'); await b.close();
  } else if (cmd === 'probe') {
    const f = process.argv[3], pts = process.argv.slice(4).map((s) => s.split(',').map(Number));
    await withImage(f, async (p, size) => { for (const [x, y] of pts) console.log(`${x},${y}`, hex(await p.evaluate(([x, y]) => [...document.getElementById('c').getContext('2d').getImageData(x, y, 1, 1).data], [x, y])), `(image ${size.join('x')})`); });
  } else if (cmd === 'runs') {
    const f = process.argv[3], col = arg('col'), row = arg('row');
    await withImage(f, async (p) => {
      const runs = await p.evaluate(([col, row]) => { const c = document.getElementById('c'), x = c.getContext('2d'), v = col !== undefined ? 1 : 0, n = v ? c.height : c.width,
        d = v ? x.getImageData(+col, 0, 1, n).data : x.getImageData(0, +row, n, 1).data, out = []; let s = 0, cur = null;
        for (let i = 0; i <= n; i++) { const k = i < n ? [...d.slice(i * 4, i * 4 + 3)].map((q) => Math.round(q / 6)).join() : 'end'; if (k !== cur) { if (cur !== null && cur !== 'end') out.push([s, i - s, d.slice(s * 4, s * 4 + 3)]); s = i; cur = k; } } return out.filter((r) => r[1] >= 2).map((r) => [r[0], r[1], [...r[2]]]); }, [col, row]);
      for (const [s, n, c] of runs) console.log(`${s}\t${n}px\t${hex(c)}`);
    });
  } else if (cmd === 'crop') {
    const [f, out, box] = process.argv.slice(3), [x, y, w, h] = box.split(',').map(Number), z = +arg('zoom', 3);
    await withImage(f, async (p) => { const d = await p.evaluate(([x, y, w, h, z]) => { const s = document.getElementById('c'), c = document.createElement('canvas'); c.width = w * z; c.height = h * z; const q = c.getContext('2d'); q.imageSmoothingEnabled = false; q.drawImage(s, x, y, w, h, 0, 0, w * z, h * z); return c.toDataURL('image/png').split(',')[1]; }, [x, y, w, h, z]); fs.writeFileSync(out, Buffer.from(d, 'base64')); console.log('saved ' + out); });
  } else { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 12).join('\n')); }
})().catch((e) => { console.error(e.message); process.exit(1); });
