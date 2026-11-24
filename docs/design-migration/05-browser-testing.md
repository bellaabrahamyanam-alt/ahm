# 05 Browser testing (how to run the real-browser tests and take screenshots without installing a browser)

Why: the stand-in DOM of the unit tests cannot test templates, daisyUI layout or events. UI work is tested in a real Chromium through the existing Playwright tests (`tests/js/browser.test.js` pattern). In a sandbox without a browser, use the Chromium that ships inside an npm package (verified 2026-11-24 in a Linux sandbox; needs only registry.npmjs.org):

```
mkdir -p /tmp/br && cd /tmp/br && npm init -y && npm i @sparticuz/chromium playwright-core daisyui@5.8.2 maplibre-gl@5.24.1
mkdir -p /tmp/shim/playwright && cat > /tmp/shim/playwright/index.js <<'JS'
const r = (m) => require(require.resolve(m, { paths: ['/tmp/br'] }));
const core = r('playwright-core'); const sp = r('@sparticuz/chromium'); const chromium = sp.default || sp;
const orig = core.chromium.launch.bind(core.chromium);
core.chromium.launch = async (o = {}) => orig({ ...o, executablePath: await chromium.executablePath(), args: [...(o.args || []), ...chromium.args], headless: true });
module.exports = core;
JS
cd <repo> && NODE_PATH=/tmp/shim node tests/js/run.js            # all tests, browser ones included
NODE_PATH=/tmp/shim node tests/js/run.js "foundation: the Period"   # one test by name
```
The CDN is blocked in sandboxes: route `cdn.jsdelivr.net/npm/daisyui@.../*` and `maplibre-gl@.../*` to `/tmp/br/node_modules/...` with `page.route` (the existing browser tests already stub the map). Screenshots: `page.screenshot({path})`, viewport 400x860 for the panel frames; compare with `docs/prototype/png-v2/` by eye and say so in the report; do not claim a pixel match.
Known: tests without a browser: `node tests/js/run.js --no-browser`. A worker who cannot get a browser must say so and list what was not verified.
