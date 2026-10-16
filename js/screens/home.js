// Home: next date (big), what's coming up (+ anniversary milestones, saved plans), last date,
// last gift, and one smart suggestion that links to the right screen (js/logic/suggest.js).
// The + opens "She mentioned…": a quick sheet for a gift idea, a follow-up or a fact about her
// (js/logic/capture.js); Important date is one tap from there. Home owns the followUps watch.
import { esc, svg, topbar, banner, openEditor, closeEditor, editorHead, flash } from '../ui.js';
import { todayLocal, upcoming, shortDate, parseYMD, countdownLabel } from '../logic/dates.js';
import { holidayPrefs, upcomingHolidays } from '../logic/holidays.js';
import { latestEntry, milestones, planRows } from '../logic/home.js';
import { suggest } from '../logic/suggest.js';
import { SECTIONS, newId } from '../logic/profile.js';
import { KINDS, TEXT_MAX, tomorrowYMD, checkCapture, giftIdeaRow, followUpRow, profileItem } from '../logic/capture.js';
import { dateRow, typeName, bindDateTaps, openDateEditor } from './dates.js';

let ideaOffset = 0;
let capKind = 'gift';

const captureBtn = `<button class="icon-btn" data-capture aria-label="Add">${svg('plus')}</button>`;

// One-line summary of a logged gift or date (their screens come later).
function entryLine(e) {
  if (!e) return '<span class="card-empty">None yet</span>';
  const name = e.title || e.name || e.what || e.place || 'Untitled';
  return `<span class="card-value">${esc(name)}</span><span class="card-sub">${esc(shortDate(parseYMD(e.day), true))}</span>`;
}

// A saved plan in Coming up: opens Plan.
function planRow(x) {
  return `<a class="row hm-plan-row" href="#/plan">
    <span class="row-main"><span class="row-title">${esc(x.title)}</span>
    <span class="row-sub">${esc(shortDate(x.next))} · Date</span></span>
    <span class="count${x.days === 0 ? ' is-today' : ''}">${esc(countdownLabel(x.days))}</span>
  </a>`;
}
const comingRow = (x) => (x.plan ? planRow(x) : dateRow(x));

// The one suggestion: taps open its screen, or show the next nudge. A due follow-up gets Done.
function suggestCard(S, today) {
  const s = suggest({ today, dates: S.dates, giftReminders: S.giftReminders, dateLog: S.dateLog, cycles: S.cycles, profile: S.profile, followUps: S.followUps }, ideaOffset);
  const inner = `<span class="card-label">${esc(s.label)}</span><span class="card-idea">${esc(s.text)}</span>`;
  let main, link = '';
  if (s.done) {
    main = `<div class="sugg-main">${inner}</div>`;
    link = `<button class="sugg-link" data-fu-done="${esc(s.done)}">Done</button>`;
  } else {
    main = s.go
      ? `<a class="sugg-main" href="#/${esc(s.go)}">${inner}</a>`
      : `<button class="sugg-main" data-next-idea>${inner}</button>`;
    if (s.link) link = `<a class="sugg-link" href="#/${esc(s.link[0])}">${esc(s.link[1])}</a>`;
  }
  return `<div class="card card-wide sugg${link ? ' has-link' : ''}">${main}${link}</div>`;
}

/* ---------------- "She mentioned…" quick capture ---------------- */

const PLACEHOLDER = { gift: 'Gift she wants', follow: 'Ask how her interview went', about: 'Flower: tulips' };
const SAVED = { gift: 'Gift idea saved', follow: 'Follow-up saved', about: 'Saved to her profile' };

// One text field plus at most one extra (a date for Follow up, a section for About her).
function openCapture(ctx) {
  const { S, backend } = ctx;
  if (!S.info.uid) { flash('Not connected yet.'); return; }
  const tomorrow = tomorrowYMD(todayLocal());
  openEditor(`${editorHead('She mentioned…')}
    <form class="form cap-form" id="ed-form">
      <div class="seg" role="radiogroup">${KINDS.map(([k, n]) =>
        `<button type="button" role="radio" aria-checked="${capKind === k}" data-cap-kind="${k}">${esc(n)}</button>`).join('')}</div>
      <label class="field"><input id="cap-text" maxlength="${TEXT_MAX}" autocomplete="off" aria-label="What she said" placeholder="${esc(PLACEHOLDER[capKind])}"></label>
      <div class="cap-extra">
        <label class="field cap-x" data-for="follow"><span>When</span><input id="cap-date" type="date" value="${esc(tomorrow)}"></label>
        <label class="field cap-x" data-for="about"><span>Section</span><select id="cap-sec">${SECTIONS.map((x) =>
          `<option value="${esc(x.key)}"${x.key === 'notes' ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      </div>
      <p class="form-msg" id="ed-msg" role="status"></p>
      <button type="button" class="btn" id="cap-imp">${svg('cal')}Important date</button>
    </form>`, (root) => {
    root.classList.add('cap-sheet');
    const text = root.querySelector('#cap-text');
    const msg = root.querySelector('#ed-msg');
    const show = () => {
      root.querySelectorAll('[data-cap-kind]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.capKind === capKind)));
      root.querySelectorAll('.cap-x').forEach((x) => { x.hidden = x.dataset.for !== capKind; });
      text.placeholder = PLACEHOLDER[capKind];
      msg.textContent = '';
      msg.classList.remove('is-error');
    };
    root.querySelectorAll('[data-cap-kind]').forEach((b) => {
      b.onclick = () => { capKind = b.dataset.capKind; show(); text.focus(); };
    });
    show();
    root.querySelector('#cap-imp').onclick = () => { closeEditor(true); openDateEditor(ctx, null); };
    root.querySelector('#ed-form').onsubmit = (e) => {
      e.preventDefault();
      const kind = capKind;
      const extra = kind === 'follow' ? root.querySelector('#cap-date').value : kind === 'about' ? root.querySelector('#cap-sec').value : '';
      const bad = checkCapture(kind, text.value, extra, S.profileLoaded);
      if (bad) { msg.textContent = bad; msg.classList.add('is-error'); return; }
      try {
        if (kind === 'gift') backend.saveListItem('gifts', giftIdeaRow(backend.newListId('gifts'), text.value));
        else if (kind === 'follow') backend.saveListItem('followUps', followUpRow(backend.newListId('followUps'), text.value, extra));
        else backend.saveProfile([...S.profile, profileItem(newId(), extra, text.value)]);
        closeEditor();
        flash(SAVED[kind]);
      } catch (err) { msg.textContent = backend.friendlyError(err); msg.classList.add('is-error'); }
    };
    text.focus();
  });
}

function markDone(ctx, id) {
  const f = (ctx.S.followUps || []).find((x) => x.id === id);
  if (!f) return;
  const row = { ...f, done: true };
  delete row.updatedAt;
  try { ctx.backend.saveListItem('followUps', row); flash('Done'); } catch (err) { flash(ctx.backend.friendlyError(err)); }
}

function render({ S }) {
  const today = todayLocal();
  const holidays = upcomingHolidays(today, holidayPrefs(S.settings.holidays))
    .map((h) => ({ ...h, next: parseYMD(h.date) }));
  const list = [...upcoming(S.dates, today), ...milestones(S.dates, today), ...planRows(S.savedPlans, today), ...holidays]
    .sort((a, b) => a.days - b.days || String(a.title).localeCompare(String(b.title)));
  const head = `${topbar('Home', captureBtn)}${banner(S.info)}`;
  if (!list.length) {
    return `${head}<div class="pane"><div class="empty-block"><p class="empty">No dates yet.</p>
      <button class="btn btn-primary" data-new-date>${svg('plus')}Add a date</button></div></div>`;
  }
  const [next, ...rest] = list;
  const big = next.days === 0 ? 'Today!' : String(next.days);
  const heroTag = next.holiday ? 'div' : next.plan ? 'a' : 'button';
  const heroOpen = next.holiday ? '' : next.plan ? ' href="#/plan"' : ` data-edit-date="${esc(next.id)}"`;
  return `${head}<div class="pane"><section class="home-grid">
      <${heroTag} class="hero${next.holiday ? ' is-holiday' : ''}"${heroOpen}>
        <span class="hero-text">
          <span class="hero-label">Next up</span>
          <span class="hero-title">${esc(next.title || 'Untitled')}</span>
          <span class="hero-sub">${esc(shortDate(next.next, true))} · ${esc(next.plan ? 'Date' : typeName(next.type))}</span>
        </span>
        <span class="hero-num${next.days === 0 ? ' is-today' : ''}">${esc(big)}${next.days === 0 ? '' : `<small>${next.days === 1 ? 'day' : 'days'}</small>`}</span>
      </${heroTag}>
      <div class="home-list">
        <h2 class="sec-head">Coming up</h2>
        <div class="list">${rest.slice(0, 8).map(comingRow).join('')}</div>
        ${S.datesLoaded && !S.dates.length ? `<button class="btn btn-add" data-new-date>${svg('plus')}Add her birthday</button>` : ''}
      </div>
      <div class="home-cards">
        <div class="card"><span class="card-label">Last date</span>${entryLine(latestEntry(S.dateLog, today))}</div>
        <div class="card"><span class="card-label">Last gift</span>${entryLine(latestEntry(S.gifts, today))}</div>
        ${suggestCard(S, today)}
      </div>
    </section></div>`;
}

export default {
  key: 'home',
  title: 'Home',
  render,
  bind(root, ctx) {
    bindDateTaps(root, ctx);
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-next-idea]')) { ideaOffset++; ctx.render(); return; }
      if (e.target.closest('[data-capture]')) { openCapture(ctx); return; }
      const done = e.target.closest('[data-fu-done]');
      if (done) markDone(ctx, done.dataset.fuDone);
    });
  },
  subscribe(ctx) {
    ctx.S.followUps = [];
    if (!ctx.S.info.uid) return [];
    return [ctx.backend.watchList('followUps', (list) => { ctx.S.followUps = list; ctx.render(); })];
  },
};
