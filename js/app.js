// Perfect Boyfriend: screens, routing and editors. Data lives in Firebase
// (js/backend.js); date math and .ics building are pure modules in js/logic/.
import * as backend from './backend.js';
import { todayLocal, upcoming, allSorted, countdownLabel, shortDate, parseYMD } from './logic/dates.js';
import { buildIcs, icsFileName } from './logic/ics.js';
import { SECTIONS, sectionName, groupBySection, upsertItem, removeItem, newId } from './logic/profile.js';
import { HOLIDAYS, holidayPrefs, upcomingHolidays } from './logic/holidays.js';
import { latestEntry, ideaFor } from './logic/home.js';

const app = document.getElementById('app');

const S = {
  info: backend.current(),
  dates: [],
  profile: [],
  datesLoaded: false,
  profileLoaded: false,
  gifts: [],
  dateLog: [],
  settings: {},
  ideaOffset: 0,
  watchingUid: null,
  unsub: [],
};

/* ---------------- helpers ---------------- */

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  dates: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  about: '<path d="M12 20.5s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z"/>',
  person: '<path d="M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

const TYPES = [['birthday', 'Birthday'], ['anniversary', 'Anniversary'], ['other', 'Other']];
const typeName = (t) => (t === 'holiday' ? 'Holiday' : (TYPES.find((x) => x[0] === t) || TYPES[2])[1]);

function route() {
  const r = location.hash.replace(/^#\/?/, '').split('/')[0];
  return ['home', 'dates', 'about', 'account'].includes(r) ? r : 'home';
}

/* ---------------- data subscriptions ---------------- */

function resubscribe() {
  const uid = S.info.uid;
  if (uid === S.watchingUid) return;
  S.unsub.forEach((u) => { try { u(); } catch (_) {} });
  S.unsub = [];
  S.watchingUid = uid;
  S.dates = []; S.profile = []; S.datesLoaded = false; S.profileLoaded = false;
  S.gifts = []; S.dateLog = []; S.settings = {};
  if (!uid) return;
  try {
    S.unsub.push(backend.watchDates((list) => { S.dates = list; S.datesLoaded = true; render(); }));
    S.unsub.push(backend.watchProfile((items) => { S.profile = items; S.profileLoaded = true; render(); }));
    S.unsub.push(backend.watchSettings((s) => { S.settings = s || {}; render(); }));
    S.unsub.push(backend.watchList('gifts', (list) => { S.gifts = list; render(); }));
    S.unsub.push(backend.watchList('dateLog', (list) => { S.dateLog = list; render(); }));
  } catch (err) { console.warn(err); }
}

/* ---------------- shell ---------------- */

function navbar(cur) {
  const tab = (key, label) => `<a href="#/${key}"${cur === key ? ' aria-current="page"' : ''}>${svg(key)}<span>${label}</span></a>`;
  return `<nav class="navbar">
    <div class="nav-brand"><span class="nav-brand-name">Perfect Boyfriend</span></div>
    ${tab('home', 'Home')}${tab('dates', 'Dates')}${tab('about', 'About her')}
    <a href="#/account" class="nav-account"${cur === 'account' ? ' aria-current="page"' : ''}>${svg('person')}<span>Account</span></a>
  </nav>`;
}

function topbar(title, actions = '', back = false) {
  return `<header class="topbar">
    ${back ? `<a class="icon-btn" href="#/home" data-back aria-label="Back">${svg('back')}</a>` : ''}
    <h1>${esc(title)}</h1>
    ${actions}
    ${back ? '' : `<a class="icon-btn avatar-btn" href="#/account" aria-label="Account">${svg('person')}</a>`}
  </header>`;
}

function banner() {
  const i = S.info;
  if (i.status === 'error') return `<div class="banner" role="status">${esc(i.error)}</div>`;
  return '';
}

let lastRoute = 'home';

function render() {
  const r = route();
  const views = { home: viewHome, dates: viewDates, about: viewAbout, account: viewAccount };
  // Keep the scroll position when the same screen re-renders after a data change.
  const pane = app.querySelector('.pane');
  const keep = pane && r === lastRoute ? pane.scrollTop : 0;
  const focusId = document.activeElement && document.activeElement.id;
  const typed = {};
  if (r === lastRoute) app.querySelectorAll('input[id],textarea[id]').forEach((el) => { typed[el.id] = el.value; });
  app.innerHTML = `${navbar(r)}<main class="screen${r === 'account' ? ' screen-account' : ''}">${views[r]()}</main>`;
  for (const [k, v] of Object.entries(typed)) { const el = document.getElementById(k); if (el) el.value = v; }
  const np = app.querySelector('.pane');
  if (np && keep) np.scrollTop = keep;
  if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
  if (r !== lastRoute) app.querySelector('.screen').classList.add('enter');
  lastRoute = r;
  if (r === 'account') bindAccount();
}

function loadingOr(loaded, html) {
  if (S.info.status === 'error' && !loaded) return '<p class="empty">Can\'t load right now.</p>';
  if (!loaded) return '<p class="empty">Loading…</p>';
  return html;
}

/* ---------------- Home ---------------- */

function dateRow(x) {
  const today = x.days === 0;
  const tag = x.holiday ? 'div' : 'button';
  const open = x.holiday ? '' : ` data-edit-date="${esc(x.id)}"`;
  return `<${tag} class="row${x.holiday ? ' is-holiday' : ''}"${open}>
    <span class="row-main"><span class="row-title">${esc(x.title || 'Untitled')}</span>
    <span class="row-sub">${esc(shortDate(x.next, !x.yearly && !x.holiday))} · ${esc(typeName(x.type))}</span></span>
    <span class="count${today ? ' is-today' : ''}${x.days < 0 ? ' is-past' : ''}">${esc(countdownLabel(x.days))}</span>
  </${tag}>`;
}

// One-line summary of a logged gift or date (their screens come later).
function entryLine(e) {
  if (!e) return '<span class="card-empty">None logged yet</span>';
  const name = e.title || e.name || e.what || e.place || 'Untitled';
  return `<span class="card-value">${esc(name)}</span><span class="card-sub">${esc(shortDate(parseYMD(e.day), true))}</span>`;
}

function viewHome() {
  const today = todayLocal();
  const holidays = upcomingHolidays(today, holidayPrefs(S.settings.holidays))
    .map((h) => ({ ...h, next: parseYMD(h.date) }));
  const list = [...upcoming(S.dates, today), ...holidays]
    .sort((a, b) => a.days - b.days || String(a.title).localeCompare(String(b.title)));
  if (!list.length) {
    return `${topbar('Home', `<button class="icon-btn" data-new-date aria-label="Add date">${svg('plus')}</button>`)}${banner()}
      <div class="pane"><div class="empty-block"><p class="empty">No dates yet.</p>
      <button class="btn btn-primary" data-new-date>${svg('plus')}Add a date</button></div></div>`;
  }
  const [next, ...rest] = list;
  const big = next.days === 0 ? 'Today!' : String(next.days);
  const heroTag = next.holiday ? 'div' : 'button';
  const body = `<section class="home-grid">
      <${heroTag} class="hero${next.holiday ? ' is-holiday' : ''}"${next.holiday ? '' : ` data-edit-date="${esc(next.id)}"`}>
        <span class="hero-text">
          <span class="hero-label">Next up</span>
          <span class="hero-title">${esc(next.title || 'Untitled')}</span>
          <span class="hero-sub">${esc(shortDate(next.next, true))} · ${esc(typeName(next.type))}</span>
        </span>
        <span class="hero-num${next.days === 0 ? ' is-today' : ''}">${esc(big)}${next.days === 0 ? '' : `<small>${next.days === 1 ? 'day' : 'days'}</small>`}</span>
      </${heroTag}>
      <div class="home-list">
        <h2 class="sec-head">Coming up</h2>
        <div class="list">${rest.slice(0, 8).map(dateRow).join('')}</div>
        ${S.datesLoaded && !S.dates.length ? `<button class="btn btn-add" data-new-date>${svg('plus')}Add her birthday</button>` : ''}
      </div>
      <div class="home-cards">
        <div class="card"><span class="card-label">Last date</span>${entryLine(latestEntry(S.dateLog, today))}</div>
        <div class="card"><span class="card-label">Last gift</span>${entryLine(latestEntry(S.gifts, today))}</div>
        <button class="card card-wide" data-next-idea><span class="card-label">Suggested idea</span>
          <span class="card-idea">${esc(ideaFor(today, S.ideaOffset))}</span></button>
      </div>
    </section>`;
  return `${topbar('Home', `<button class="icon-btn" data-new-date aria-label="Add date">${svg('plus')}</button>`)}${banner()}
    <div class="pane">${body}</div>`;
}

/* ---------------- Dates ---------------- */

function viewDates() {
  const list = allSorted(S.dates, todayLocal());
  const body = list.length
    ? `<div class="list list-wide">${list.map(dateRow).join('')}</div>`
    : `<div class="empty-block"><p class="empty">No dates yet.</p><button class="btn btn-primary" data-new-date>${svg('plus')}Add a date</button></div>`;
  return `${topbar('Dates', `<button class="icon-btn" data-new-date aria-label="Add date">${svg('plus')}</button>`)}${banner()}
    <div class="pane">${loadingOr(S.datesLoaded, body)}</div>`;
}

/* ---------------- About her ---------------- */

function viewAbout() {
  const g = groupBySection(S.profile);
  const body = `<div class="about-grid">${SECTIONS.map((s) => `
    <section class="about-sec">
      <div class="sec-row"><h2 class="sec-head">${esc(s.name)}</h2>
        <button class="icon-btn small" data-new-item="${s.key}" aria-label="Add to ${esc(s.name)}">${svg('plus')}</button></div>
      <div class="list">${g[s.key].map((it) => `
        <button class="row kv" data-edit-item="${esc(it.id)}">
          <span class="kv-label${it.value ? '' : ' solo'}">${esc(it.label)}</span><span class="kv-value">${esc(it.value)}</span>
        </button>`).join('')}</div>
    </section>`).join('')}</div>`;
  return `${topbar('About her')}${banner()}<div class="pane">${loadingOr(S.profileLoaded, body)}</div>`;
}

/* ---------------- Account ---------------- */

function viewAccount() {
  const i = S.info;
  let status;
  if (i.status === 'connecting') status = 'Connecting…';
  else if (!i.uid) status = 'Not connected.';
  else if (i.anonymous) status = 'Guest. Sign up to keep your data safe.';
  else status = `Signed in as <b>${esc(i.email)}</b>`;
  const form = i.uid && !i.anonymous
    ? `<button class="btn" id="acct-signout">Sign out</button>`
    : `<form class="form" id="acct-form" autocomplete="on">
        <label class="field"><span>Email</span><input id="acct-email" type="email" autocomplete="username" inputmode="email" required></label>
        <label class="field"><span>Password</span><input id="acct-pass" type="password" autocomplete="current-password" minlength="6" required></label>
        <div class="btn-row">
          <button class="btn btn-primary" type="submit" data-mode="up">Sign up</button>
          <button class="btn" type="submit" data-mode="in">Sign in</button>
        </div>
      </form>`;
  return `${topbar('Account', '', true)}${banner()}
    <div class="pane"><div class="narrow">
      <p class="acct-status">${status}</p>
      ${form}
      <p class="form-msg" id="acct-msg" role="status"></p>
      <h2 class="sec-head settings-head">Holidays on Home</h2>
      <div class="list">${HOLIDAYS.map((h) => {
        const on = holidayPrefs(S.settings.holidays)[h.key];
        return `<label class="switch-row row-line"><span>${esc(h.name)}</span>
          <input type="checkbox" class="switch" data-holiday="${h.key}"${on ? ' checked' : ''}${i.uid ? '' : ' disabled'}></label>`;
      }).join('')}</div>
    </div></div>`;
}

function bindAccount() {
  const msg = document.getElementById('acct-msg');
  const out = document.getElementById('acct-signout');
  if (out) out.onclick = async () => {
    try { await backend.signOut(); } catch (err) { msg.textContent = backend.friendlyError(err); }
  };
  const form = document.getElementById('acct-form');
  if (!form) return;
  let mode = 'up';
  form.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { mode = b.dataset.mode; }; });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('acct-email').value.trim();
    const pass = document.getElementById('acct-pass').value;
    msg.textContent = mode === 'up' ? 'Signing up…' : 'Signing in…';
    msg.classList.remove('is-error');
    try {
      if (mode === 'up') await backend.signUp(email, pass);
      else await backend.signIn(email, pass);
      // render() via onChange replaces this screen with the signed-in state
    } catch (err) {
      const m = document.getElementById('acct-msg');
      if (m) { m.textContent = backend.friendlyError(err); m.classList.add('is-error'); }
    }
  };
}

/* ---------------- editors (full screen on phone, a panel on laptop) ---------------- */

let editorEl = null;

function openEditor(html, bind) {
  closeEditor(true);
  const wrap = document.createElement('div');
  wrap.className = 'editor-backdrop';
  wrap.innerHTML = `<div class="editor" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  editorEl = wrap;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeEditor(); });
  wrap.querySelector('[data-cancel]').onclick = () => closeEditor();
  bind(wrap);
}

function closeEditor(instant) {
  if (!editorEl) return;
  const el = editorEl;
  editorEl = null;
  if (instant) { el.remove(); return; }
  // While it fades out it must not catch taps or share field ids with the next editor.
  el.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  el.classList.add('leaving');
  setTimeout(() => el.remove(), 160);
}

function editorHead(title) {
  return `<header class="editor-head">
    <button type="button" class="link-btn" data-cancel>Cancel</button>
    <h2>${esc(title)}</h2>
    <button type="submit" class="link-btn strong" form="ed-form">Save</button>
  </header>`;
}

// Two taps to delete; the button keeps its size.
function armDelete(btn, onConfirm) {
  if (!btn) return;
  let armed = false;
  btn.onclick = () => {
    if (armed) return onConfirm();
    armed = true;
    btn.textContent = 'Tap again to delete';
    btn.classList.add('armed');
    setTimeout(() => { armed = false; btn.textContent = 'Delete'; btn.classList.remove('armed'); }, 3000);
  };
}

function openDateEditor(id) {
  const existing = id ? S.dates.find((d) => d.id === id) : null;
  if (!S.info.uid) { flash('Not connected to the cloud yet.'); return; }
  let newIdValue;
  try { newIdValue = existing ? existing.id : backend.newDateId(); } catch (err) { flash(backend.friendlyError(err)); return; }
  const d = existing || { id: newIdValue, title: '', date: '', type: 'birthday', yearly: true, notes: '' };
  openEditor(`${editorHead(existing ? 'Edit date' : 'New date')}
    <form class="form" id="ed-form">
      <label class="field"><span>Title</span><input id="ed-title" maxlength="200" placeholder="Her birthday" value="${esc(d.title)}" required></label>
      <label class="field"><span>Date</span><input id="ed-date" type="date" value="${esc(d.date)}" required></label>
      <div class="field"><span>Type</span><div class="seg" role="radiogroup">${TYPES.map(([k, n]) =>
        `<button type="button" role="radio" aria-checked="${d.type === k}" data-type="${k}">${n}</button>`).join('')}</div></div>
      <label class="switch-row"><span>Repeats yearly</span><input id="ed-yearly" type="checkbox" class="switch"${d.yearly ? ' checked' : ''}></label>
      <label class="field"><span>Notes</span><textarea id="ed-notes" rows="3" maxlength="2000">${esc(d.notes)}</textarea></label>
      <p class="form-msg" id="ed-msg" role="status"></p>
      <div class="btn-col">
        <button type="button" class="btn" id="ed-ics">${svg('cal')}Add to iPhone Calendar</button>
        ${existing ? '<button type="button" class="btn btn-danger" id="ed-del">Delete</button>' : ''}
      </div>
    </form>`, (root) => {
    let type = d.type;
    const yearly = root.querySelector('#ed-yearly');
    root.querySelectorAll('[data-type]').forEach((b) => {
      b.onclick = () => {
        type = b.dataset.type;
        root.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        if (!existing && (type === 'birthday' || type === 'anniversary')) yearly.checked = true;
      };
    });
    const read = () => ({
      id: d.id,
      title: root.querySelector('#ed-title').value.trim(),
      date: root.querySelector('#ed-date').value,
      type,
      yearly: yearly.checked,
      notes: root.querySelector('#ed-notes').value.trim(),
    });
    const msg = root.querySelector('#ed-msg');
    const check = (item) => {
      if (!item.title) return 'Add a title.';
      if (!parseYMD(item.date)) return 'Pick a date.';
      return '';
    };
    root.querySelector('#ed-form').onsubmit = (e) => {
      e.preventDefault();
      const item = read();
      const bad = check(item);
      if (bad) { msg.textContent = bad; msg.classList.add('is-error'); return; }
      try { backend.saveDate(item); closeEditor(); } catch (err) { msg.textContent = backend.friendlyError(err); msg.classList.add('is-error'); }
    };
    root.querySelector('#ed-ics').onclick = () => {
      const item = read();
      const bad = check(item);
      if (bad) { msg.textContent = bad; msg.classList.add('is-error'); return; }
      downloadIcs(item);
    };
    armDelete(root.querySelector('#ed-del'), () => {
      try { backend.deleteDate(d.id); closeEditor(); } catch (err) { msg.textContent = backend.friendlyError(err); }
    });
  });
}

function openItemEditor(sectionKey, id) {
  if (!S.info.uid) { flash('Not connected to the cloud yet.'); return; }
  const existing = id ? S.profile.find((x) => x.id === id) : null;
  const sec = existing ? existing.section : sectionKey;
  const hints = (SECTIONS.find((s) => s.key === sec) || { hints: [] }).hints;
  const it = existing || { id: newId(), section: sec, label: '', value: '' };
  openEditor(`${editorHead(sectionName(sec))}
    <form class="form" id="ed-form">
      <label class="field"><span>Label</span><input id="ed-label" maxlength="100" list="ed-hints" value="${esc(it.label)}" required></label>
      <datalist id="ed-hints">${hints.map((h) => `<option value="${esc(h)}">`).join('')}</datalist>
      <label class="field"><span>Details</span><textarea id="ed-value" rows="3" maxlength="1000">${esc(it.value)}</textarea></label>
      <p class="form-msg" id="ed-msg" role="status"></p>
      ${existing ? '<div class="btn-col"><button type="button" class="btn btn-danger" id="ed-del">Delete</button></div>' : ''}
    </form>`, (root) => {
    const msg = root.querySelector('#ed-msg');
    root.querySelector('#ed-form').onsubmit = (e) => {
      e.preventDefault();
      const label = root.querySelector('#ed-label').value.trim();
      const value = root.querySelector('#ed-value').value.trim();
      if (!label) { msg.textContent = 'Add a label.'; msg.classList.add('is-error'); return; }
      try { backend.saveProfile(upsertItem(S.profile, { ...it, label, value })); closeEditor(); }
      catch (err) { msg.textContent = backend.friendlyError(err); msg.classList.add('is-error'); }
    };
    armDelete(root.querySelector('#ed-del'), () => {
      try { backend.saveProfile(removeItem(S.profile, it.id)); closeEditor(); } catch (err) { msg.textContent = backend.friendlyError(err); }
    });
  });
}

/* ---------------- calendar file ---------------- */

function downloadIcs(item) {
  const text = buildIcs(item, new Date());
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = icsFileName(item);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------------- small toast ---------------- */

function flash(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* ---------------- events ---------------- */

app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-new-date],[data-edit-date],[data-new-item],[data-edit-item],[data-back],[data-next-idea],[data-holiday]');
  if (!t) return;
  if (t.hasAttribute('data-next-idea')) { S.ideaOffset++; render(); return; }
  if (t.dataset.holiday) {
    if (!S.info.uid) return;
    const prefs = holidayPrefs(S.settings.holidays);
    prefs[t.dataset.holiday] = t.checked;
    try { backend.saveHolidaySettings(prefs); } catch (err) { flash(backend.friendlyError(err)); }
    return;
  }
  if (t.hasAttribute('data-back')) {
    e.preventDefault();
    location.hash = '#/' + (backTarget || 'home');
    return;
  }
  if (t.hasAttribute('data-new-date')) openDateEditor(null);
  else if (t.dataset.editDate) openDateEditor(t.dataset.editDate);
  else if (t.dataset.newItem) openItemEditor(t.dataset.newItem, null);
  else if (t.dataset.editItem) openItemEditor(null, t.dataset.editItem);
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEditor(); });

// Back from Account goes to the screen you came from.
let backTarget = null;
let prevRoute = route();
window.addEventListener('hashchange', () => {
  const r = route();
  if (r === 'account' && prevRoute !== 'account') backTarget = prevRoute;
  prevRoute = r;
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
