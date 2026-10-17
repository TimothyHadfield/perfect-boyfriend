// Build stamp + update path (2026-10-17): new builds must reach phones without a hard refresh.
// BUILD lives in js/version.js; sw.js keeps a copy (its cache name). Bump both on every release.
import { test, eq, ok } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const load = async (p) => import(pathToFileURL(join(root, p)).href);

test('build: js/version.js exports a dated BUILD', async () => {
  const { BUILD } = await load('js/version.js');
  ok(/^\d{4}-\d\d-\d\d\.\d+$/.test(BUILD), 'BUILD looks like 2026-10-17.1, got ' + BUILD);
});

test('build: sw.js carries the same BUILD and names its cache after it', async () => {
  const { BUILD } = await load('js/version.js');
  const sw = read('sw.js');
  const m = /const BUILD = '([^']+)'/.exec(sw);
  ok(m, 'sw.js has const BUILD');
  eq(m[1], BUILD, 'sw.js BUILD');
  ok(/const CACHE = 'pb-' \+ BUILD;/.test(sw), 'CACHE is derived from BUILD');
});

test('build: every ?v= in index.html (if any) matches BUILD', async () => {
  const { BUILD } = await load('js/version.js');
  for (const m of read('index.html').matchAll(/\?v=([^"'&]+)/g)) eq(m[1], BUILD, '?v=');
});

test('build: version.js is in the offline list and the parser reads it', async () => {
  const { BUILD } = await load('js/version.js');
  const { readBuild } = await load('js/logic/update.js');
  ok(read('sw.js').includes(`'js/version.js'`), 'js/version.js in sw.js SHELL');
  eq(readBuild(read('js/version.js')), BUILD);
  eq(readBuild('nothing here'), null);
});

test('build: Settings shows the stamp', async () => {
  const { BUILD } = await load('js/version.js');
  const settings = (await load('js/screens/settings.js')).default;
  const html = settings.render({ S: { settings: {}, info: { uid: 'u', status: 'ready' } } });
  ok(html.includes(BUILD), 'Settings render includes ' + BUILD);
});

test('update: compareBuild orders dated builds numerically', async () => {
  const { compareBuild } = await load('js/logic/update.js');
  ok(compareBuild('2026-10-17.10', '2026-10-17.9') > 0, '.10 is newer than .9');
  ok(compareBuild('2026-10-18.1', '2026-10-17.9') > 0, 'next day');
  eq(compareBuild('2026-10-17.1', '2026-10-17.1'), 0);
  ok(compareBuild('2026-10-16.3', '2026-10-17.1') < 0, 'older');
});

test('update: reload only for a newer build, never mid-edit, once per build', async () => {
  const { shouldReload } = await load('js/logic/update.js');
  const base = { running: '2026-10-17.1', latest: '2026-10-17.2', busy: false, interacted: false, tried: null };
  eq(shouldReload(base), true, 'newer, idle');
  eq(shouldReload({ ...base, latest: '2026-10-17.1' }), false, 'same build');
  eq(shouldReload({ ...base, latest: '2026-10-16.4' }), false, 'older (CDN lag) never downgrades');
  eq(shouldReload({ ...base, latest: null }), false, 'offline / unreadable');
  eq(shouldReload({ ...base, busy: true }), false, 'sheet open or typing');
  eq(shouldReload({ ...base, interacted: true }), false, 'user already tapping');
  eq(shouldReload({ ...base, tried: '2026-10-17.2' }), false, 'already reloaded once for it');
  eq(shouldReload({ ...base, tried: '2026-10-17.0' }), true, 'tried an older one');
});

test('update: app.js registers the worker without the HTTP cache and checks on return', () => {
  const app = read('js/app.js');
  ok(/register\('sw\.js',\s*\{\s*updateViaCache:\s*'none'\s*\}\)/.test(app), "updateViaCache: 'none'");
  ok(app.includes('visibilitychange'), 'checks when the app comes back');
  ok(app.includes("'js/version.js'") && app.includes("cache: 'no-store'"), 'reads the live build past the HTTP cache');
});

test('update: the worker installs fresh copies, not HTTP-cached ones', () => {
  const sw = read('sw.js');
  ok(/cache:\s*'reload'/.test(sw), "install uses cache: 'reload'");
});
