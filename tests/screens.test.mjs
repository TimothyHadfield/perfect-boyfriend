// Screen registry contract: every js/screens/<key>.js is registered in app.js,
// exports {key, title, render}, has css/<key>.css linked in index.html, and both
// files are in the service worker's offline list.
import { test, eq, ok } from './harness.mjs';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const keys = readdirSync(join(root, 'js/screens')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort();
const appJs = read('js/app.js');
const indexHtml = read('index.html');
const swJs = read('sw.js');

test('the ten screens exist', () => {
  eq(keys, ['account', 'arguments', 'card', 'cycle', 'dates', 'gifts', 'home', 'plan', 'profile', 'settings']);
});

for (const k of keys) {
  test(`screen ${k}: module shape`, async () => {
    const mod = (await import(pathToFileURL(join(root, 'js/screens', k + '.js')).href)).default;
    eq(mod.key, k);
    ok(typeof mod.title === 'string' && mod.title.length > 0, 'title');
    ok(typeof mod.render === 'function', 'render');
  });
  test(`screen ${k}: registered, styled, cached`, () => {
    ok(appJs.includes(`from './screens/${k}.js'`), 'imported in app.js');
    ok(existsSync(join(root, 'css', k + '.css')), 'css file exists');
    ok(indexHtml.includes(`href="css/${k}.css"`), 'css linked in index.html');
    ok(swJs.includes(`'js/screens/${k}.js'`), 'js in sw.js');
    ok(swJs.includes(`'css/${k}.css'`), 'css in sw.js');
  });
}

test('every logic module is in the offline list', () => {
  for (const f of readdirSync(join(root, 'js/logic')).filter((x) => x.endsWith('.js'))) {
    ok(swJs.includes(`'js/logic/${f}'`), f + ' in sw.js');
  }
});
