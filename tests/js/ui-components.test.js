// Tests for the shared UI foundation (task F0, tasks/foundation.md): design tokens and the daisyUI theme.
const { test, ok, eq } = require('./lib/harness');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib/ctx');

const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const HTML = read('app', 'index.html');
const BASE = read('app', 'css', 'base.css');
const THEME = read('app', 'css', 'theme.css');

test('foundation F1: daisyUI comes from the CDN with an exact version, before our own css block', () => {
  const m = HTML.match(/href="(https:\/\/cdn\.jsdelivr\.net\/npm\/daisyui@\d+\.\d+\.\d+\/daisyui\.css)"/);
  ok(m, 'index.html links daisyui.css with an exact version');
  ok(HTML.indexOf(m[1]) < HTML.indexOf('<!-- ahm:css -->'), 'the CDN link is outside the bundled css block and comes before it');
});

test('foundation F1: the theme is applied and linked after base.css; colours.css never exists', () => {
  ok(/<html [^>]*data-theme="paper-and-pencil"/.test(HTML), 'html has data-theme="paper-and-pencil"');
  ok(HTML.indexOf('css/base.css') < HTML.indexOf('css/theme.css'), 'theme.css comes after base.css');
  ok(HTML.indexOf('css/theme.css') < HTML.indexOf('<!-- /ahm:css -->'), 'theme.css is inside the css block');
  ok(!HTML.includes('colours.css'), 'index.html does not mention colours.css');
  ok(!fs.existsSync(path.join(ROOT, 'app', 'css', 'colours.css')), 'app/css/colours.css does not exist');
});

test('foundation F1: theme.css defines no colour of its own and every token it uses exists in base.css', () => {
  ok(/:root\[data-theme='paper-and-pencil'\]/.test(THEME), 'one theme selector');
  ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/.test(THEME.replace(/\/\*[\s\S]*?\*\//g, '')), 'no literal colour');
  const used = [...new Set([...THEME.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))];
  const defined = new Set([...BASE.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
  const missing = used.filter((t) => !defined.has(t));
  eq([], missing, 'tokens used in theme.css but not defined in base.css');
});

test('foundation F1: theme.css sets every daisyUI colour and radius variable', () => {
  const need = ['base-100', 'base-200', 'base-300', 'base-content', 'primary', 'primary-content', 'secondary', 'secondary-content', 'accent', 'accent-content', 'neutral', 'neutral-content', 'info', 'info-content', 'success', 'success-content', 'warning', 'warning-content', 'error', 'error-content']
    .map((n) => '--color-' + n)
    .concat(['--radius-selector', '--radius-field', '--radius-box', '--size-selector', '--size-field', '--border', '--depth', '--noise']);
  eq([], need.filter((v) => !new RegExp(v + '\\s*:').test(THEME)), 'daisyUI variables missing from theme.css');
});
