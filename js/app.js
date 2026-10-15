// Perfect Boyfriend shell: screen registry, routing (#/<key>), tabs, shared data.
// SCREEN CONTRACT. Each screen is js/screens/<key>.js + css/<key>.css (linked in index.html, listed in sw.js):
//   export default { key, title, group?: 'her', sub?: true,
//     render(ctx) -> HTML string for the whole screen (start with topbar(...) from ui.js, then a .pane),
//     bind?(root, ctx) -> attach handlers after each render (root = this screen's <main>, rebuilt every render),
//     subscribe?(ctx) -> [unsubscribe fns]: start Firestore watches; called again whenever the user changes }
//   ctx = { S, backend, user, subtabs, render(), go(key), back() }
//     S: shared state (info, dates, profile, settings, gifts, dateLog; screens may add their own keys)
//     backend: js/backend.js · user: S.info ({uid, email, anonymous, status}) · subtabs: Her sub-tab HTML
//     render(): redraw after a data change · go('gifts'): open a screen · back(): previous screen
//   group 'her' = a sub-tab under Her · sub = opened from an icon (Account, Settings), shows a back arrow.
//   Register a screen by importing it into SCREENS below. Shared helpers live in js/ui.js.
import * as backend from './backend.js';
import { svg, closeEditor, showHelp, hideHelp } from './ui.js';
import home from './screens/home.js';
import dates from './screens/dates.js';
import plan from './screens/plan.js';
import gifts from './screens/gifts.js';
import profile from './screens/profile.js';
import cycle from './screens/cycle.js';
import argumentsScreen from './screens/arguments.js';
import account from './screens/account.js';
import settings from './screens/settings.js';

const SCREENS = [home, dates, plan, gifts, profile, cycle, argumentsScreen, account, settings];
const REG = Object.fromEntries(SCREENS.map((s) => [s.key, s]));
const HER = SCREENS.filter((s) => s.group === 'her');

const app = document.getElementById('app');

const S = {
  info: backend.current(),
  dates: [], profile: [], datesLoaded: false, profileLoaded: false,
  gifts: [], dateLog: [], settings: {},
};
let watchingUid = null;
let unsub = [];

function route() {
  const r = location.hash.replace(/^#\/?/, '').split('/')[0];
  if (r === 'about' || r === 'her') return lastHer;   // old link, and the Her tab
  return REG[r] ? r : 'home';
}
let lastHer = 'profile';

/* ---------------- data subscriptions ---------------- */

function resubscribe() {
  const uid = S.info.uid;
  if (uid === watchingUid) return;
  unsub.forEach((u) => { try { u(); } catch (_) {} });
  unsub = [];
  watchingUid = uid;
  Object.assign(S, { dates: [], profile: [], datesLoaded: false, profileLoaded: false, gifts: [], dateLog: [], settings: {} });
  if (!uid) return;
  try {
    unsub.push(backend.watchDates((list) => { S.dates = list; S.datesLoaded = true; render(); }));
    unsub.push(backend.watchProfile((items) => { S.profile = items; S.profileLoaded = true; render(); }));
    unsub.push(backend.watchSettings((s) => { S.settings = s || {}; render(); }));
    unsub.push(backend.watchList('gifts', (list) => { S.gifts = list; render(); }));
    unsub.push(backend.watchList('dateLog', (list) => { S.dateLog = list; render(); }));
  } catch (err) { console.warn(err); }
  for (const s of SCREENS) {
    if (!s.subscribe) continue;
    try { unsub.push(...(s.subscribe(ctx()) || [])); } catch (err) { console.warn(s.key, err); }
  }
}

/* ---------------- shell ---------------- */

const TABS = [['home', 'Home'], ['dates', 'Dates'], ['plan', 'Plan'], ['gifts', 'Gifts'], ['her', 'Her']];

function navbar(cur) {
  const scr = REG[cur];
  const on = (key) => (key === cur || (key === 'her' && scr.group === 'her') ? ' aria-current="page"' : '');
  const tab = ([key, label]) => {
    const href = key === 'her' ? lastHer : key;
    if (key === 'plan') return `<a href="#/plan" class="nav-hub"${on(key)}><span class="hub-ring">${svg(key)}</span><span>${label}</span></a>`;
    return `<a href="#/${href}"${on(key)}>${svg(key)}<span>${label}</span></a>`;
  };
  return `<nav class="navbar">
    <div class="nav-brand"><span class="nav-brand-name">Perfect Boyfriend</span></div>
    ${TABS.map(tab).join('')}
    <a href="#/settings" class="nav-extra nav-first-extra"${on('settings')}>${svg('settings')}<span>Settings</span></a>
    <a href="#/account" class="nav-extra"${on('account')}>${svg('person')}<span>Account</span></a>
  </nav>`;
}

function subtabs(cur) {
  return `<nav class="subtabs">${HER.map((s) =>
    `<a href="#/${s.key}"${s.key === cur ? ' aria-current="page"' : ''}>${s.title}</a>`).join('')}</nav>`;
}

// Back goes to the screen you were on right before (or Home if the app opened here).
let depth = 0;
let backing = false;
function back() {
  if (depth > 0) { backing = true; history.back(); } else location.hash = '#/home';
}

function ctx() {
  const r = route();
  return {
    S, backend, user: S.info,
    subtabs: REG[r].group === 'her' ? subtabs(r) : '',
    render, back, go: (key) => { location.hash = '#/' + key; },
  };
}

let lastRoute = null;

function render() {
  const r = route();
  const scr = REG[r];
  if (scr.group === 'her') lastHer = r;
  // Keep the scroll position and typed text when the same screen re-renders after a data change.
  const pane = app.querySelector('.pane');
  const keep = pane && r === lastRoute ? pane.scrollTop : 0;
  const focusId = document.activeElement && document.activeElement.id;
  const typed = {};
  // A screen that sets an input's value itself marks it data-nokeep.
  if (r === lastRoute) app.querySelectorAll('input[id]:not([data-nokeep]),textarea[id]').forEach((el) => { typed[el.id] = el.value; });
  const c = ctx();
  app.innerHTML = `${navbar(r)}<main class="screen screen-${r}">${scr.render(c)}</main>`;
  for (const [k, v] of Object.entries(typed)) { const el = document.getElementById(k); if (el) el.value = v; }
  const np = app.querySelector('.pane');
  if (np && keep) np.scrollTop = keep;
  if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
  const main = app.querySelector('.screen');
  if (r !== lastRoute) main.classList.add('enter');
  lastRoute = r;
  if (scr.bind) scr.bind(main, c);
}

/* ---------------- events ---------------- */

document.addEventListener('click', (e) => {
  const h = e.target.closest('[data-help]');
  if (h) { e.preventDefault(); showHelp(h); return; }
  hideHelp();
  if (e.target.closest('[data-back]')) { e.preventDefault(); back(); }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideHelp(); closeEditor(); } });

window.addEventListener('hashchange', () => {
  if (backing) { depth = Math.max(0, depth - 1); backing = false; } else depth++;
  hideHelp();
  closeEditor(true);
  render();
});

backend.onChange((info) => {
  S.info = info;
  resubscribe();
  render();
});

render();
backend.start();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW not registered', err));
}
