// Her > Cycle: he logs her period; it predicts the next one (80% range), phases,
// fertile days (labeled not birth control) and shows "how to help" for today.
// Math lives in js/logic/cycle.js. Rows: `cycles` list ({kind:'period'|'settings'}).
import { esc, svg, topbar, banner, loadingOr, help, openEditor, closeEditor, editorHead, armDelete, flash } from '../ui.js';
import { todayLocal, toYMD } from '../logic/dates.js';
import {
  cycleStatus, nextSettings, dayMarks, monthCells, accuracyText, TIPS, buildCycleIcs, fmtDay, fmtRange, toDay, toStr, isYMD,
} from '../logic/cycle.js';

const LIST = 'cycles';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ic = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I_PREV = ic('<path d="M15 5l-7 7 7 7"/>');
const I_NEXT = ic('<path d="M9 5l7 7-7 7"/>');
const I_LIST = ic('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>');

const HELP_EVIDENCE = 'Evidence on cycle phases is limited and varies a lot between people. Go by what she tells you.';
const HELP_FERTILE = 'Fertile days are a rough estimate. Not birth control.';
const HELP_LEGEND = 'Filled: logged period. Shaded: likely period. Dashed: likely range. Gold: fertile days (estimate, not birth control).';
const HELP_ROUGH = 'Rough estimate: few periods logged, or her cycles vary a lot. It gets sharper as you log.';
const HELP_ACC = 'Each past period was predicted from the ones before it.';
const HELP_MODE = {
  'birth-control': 'Hormonal birth control stops ovulation, so nothing is predicted. Change it in History.',
  pregnant: 'Predictions restart from her first period after. Change it in History.',
};
const MODE_NAMES = [['natural', 'Natural'], ['birth-control', 'Birth control'], ['pregnant', 'Pregnant']];

// The month on screen, as an offset from this month (kept across re-renders).
let monthOffset = 0;

const today = () => toYMD(todayLocal());

function settingsRow(st) {
  return { id: 'settings', kind: 'settings', ...st.settings };
}

/* ---------------- render ---------------- */

function statusHtml(st) {
  const p = st.pred;
  const rough = p && !p.veryLate && (p.cyclesUsed < 3 || p.irregular);
  const subHelp = HELP_MODE[st.settings.mode] ? help(HELP_MODE[st.settings.mode]) : rough ? help(HELP_ROUGH) : '';
  const fertile = st.fertileToday ? ` · <span class="cy-fert-tag">Fertile</span>${help(HELP_FERTILE)}` : '';
  const acc = st.prompt ? '' : accuracyText(st.accuracy); // a question takes this line's place
  const canIcs = p && !p.veryLate;
  return `<section class="cy-status">
    <div class="cy-status-top">
      <h2 class="cy-big">${esc(st.headline)}</h2>
      ${canIcs ? `<button class="icon-btn small cy-ics" id="cy-ics" aria-label="Add next period to Calendar">${svg('cal')}</button>` : ''}
    </div>
    <p class="cy-sub">${esc(st.sub)}${subHelp}${fertile}</p>
    ${acc ? `<p class="cy-acc">${esc(acc)}${help(HELP_ACC)}</p>` : ''}
  </section>`;
}

function promptHtml(st) {
  const q = st.prompt;
  if (!q) return '';
  const btns = q.kind === 'short'
    ? '<button class="btn cy-q-btn" data-q="merge">Same</button><button class="btn cy-q-btn" data-q="keep">No</button>'
    : q.kind === 'gap'
      ? '<button class="btn cy-q-btn" data-q="add">Add it</button><button class="btn cy-q-btn" data-q="keep">No</button>'
      : '<button class="btn cy-q-btn" data-q="add">Log it</button>';
  return `<div class="cy-q" role="status"><span class="cy-q-text">${esc(q.text)}</span>${btns}</div>`;
}

function calendarHtml(st) {
  const now = todayLocal();
  const base = now.y * 12 + (now.m - 1) + monthOffset;
  const y = Math.floor(base / 12), m = (base % 12) + 1;
  const cells = monthCells(y, m, dayMarks(st), st.today);
  const cls = (c) => ['cy-day', c.inMonth ? '' : 'out', c.logged ? 'logged' : '', c.likely ? 'likely' : '', c.range ? 'range' : '',
    c.fertile ? 'fertile' : '', c.today ? 'today' : ''].filter(Boolean).join(' ');
  return `<section class="cy-cal" id="cy-cal">
    <div class="cy-cal-head">
      <button class="icon-btn small" data-month="-1" aria-label="Previous month">${I_PREV}</button>
      <span class="cy-month">${MONTHS[m - 1]} ${y}${help(HELP_LEGEND)}</span>
      <button class="icon-btn small" data-month="1" aria-label="Next month">${I_NEXT}</button>
    </div>
    <div class="cy-grid cy-wd">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cy-grid">${cells.map((c) => `<span class="${cls(c)}"><b>${c.day}</b></span>`).join('')}</div>
  </section>`;
}

function actionsHtml(st) {
  return `<div class="cy-actions">
    <button class="btn btn-primary" id="cy-start">Period started</button>
    <button class="btn" id="cy-end"${st.openPeriod ? '' : ' disabled'}>Period ended</button>
    <button class="btn cy-hist" id="cy-hist" aria-label="History">${I_LIST}</button>
  </div>`;
}

function helpCardHtml(st) {
  const tips = st.helpKey ? TIPS[st.helpKey] : null;
  return `<section class="cy-help">
    <h2 class="sec-head">How to help${help(HELP_EVIDENCE)}</h2>
    ${tips ? `<ul class="cy-tips">${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="empty">Log her period to see tips.</p>'}
  </section>`;
}

/* ---------------- editors ---------------- */

function needUser(ctx) {
  if (!ctx.S.info.uid) { flash('Not connected yet.'); return false; }
  return true;
}

function fail(msg, text) { msg.textContent = text; msg.classList.add('is-error'); }

// One date (Period started / Period ended).
function openDayEditor(ctx, title, value, min, onSave) {
  if (!needUser(ctx)) return;
  const t = today();
  openEditor(`${editorHead(title)}
    <form class="form narrow" id="ed-form">
      <label class="field"><span>Date</span><input id="cy-date" type="date" value="${esc(value)}" max="${t}"${min ? ` min="${esc(min)}"` : ''} required></label>
      <p class="form-msg" id="ed-msg" role="status"></p>
    </form>`, (root) => {
    const msg = root.querySelector('#ed-msg');
    root.querySelector('#ed-form').onsubmit = (e) => {
      e.preventDefault();
      const d = root.querySelector('#cy-date').value;
      if (!isYMD(d)) return fail(msg, 'Pick a date.');
      if (d > t) return fail(msg, 'That\'s in the future.');
      if (min && d < min) return fail(msg, 'Before it started.');
      try { const bad = onSave(d); if (bad) return fail(msg, bad); closeEditor(); }
      catch (err) { fail(msg, ctx.backend.friendlyError(err)); }
    };
  });
}

function startPeriod(ctx, day) {
  const st = ctx.S.cycleSt;
  openDayEditor(ctx, 'Period started', day || today(), null, (d) => {
    if (st.periods.some((p) => p.start === d)) return 'Already logged.';
    ctx.backend.saveListItem(LIST, { id: ctx.backend.newListId(LIST), kind: 'period', start: d, end: null });
    return '';
  });
}

function endPeriod(ctx) {
  const open = ctx.S.cycleSt.openPeriod;
  if (!open) return;
  openDayEditor(ctx, 'Period ended', today(), open.start, (d) => {
    ctx.backend.saveListItem(LIST, { id: open.id, kind: 'period', start: open.start, end: d });
    return '';
  });
}

// Add or edit one logged period (start, optional end), with delete.
function openPeriodEditor(ctx, id, preset) {
  if (!needUser(ctx)) return;
  const st = ctx.S.cycleSt;
  const existing = id ? st.periods.find((p) => p.id === id) : null;
  const p = existing || { id: null, start: preset || '', end: null };
  const t = today();
  openEditor(`${editorHead(existing ? 'Edit period' : 'Add period')}
    <form class="form narrow" id="ed-form">
      <label class="field"><span>Started</span><input id="cy-s" type="date" value="${esc(p.start)}" max="${t}" required></label>
      <label class="field"><span>Ended</span><input id="cy-e" type="date" value="${esc(p.end || '')}" max="${t}"></label>
      <p class="form-msg" id="ed-msg" role="status"></p>
      ${existing ? '<div class="btn-col"><button type="button" class="btn btn-danger" id="ed-del">Delete</button></div>' : ''}
    </form>`, (root) => {
    const msg = root.querySelector('#ed-msg');
    root.querySelector('#ed-form').onsubmit = (e) => {
      e.preventDefault();
      const s = root.querySelector('#cy-s').value, en = root.querySelector('#cy-e').value || null;
      if (!isYMD(s)) return fail(msg, 'Pick a start date.');
      if (s > t || (en && en > t)) return fail(msg, 'That\'s in the future.');
      if (en && en < s) return fail(msg, 'Ends before it starts.');
      if (st.periods.some((x) => x.start === s && x.id !== p.id)) return fail(msg, 'Already logged.');
      try {
        ctx.backend.saveListItem(LIST, { id: p.id || ctx.backend.newListId(LIST), kind: 'period', start: s, end: en });
        closeEditor();
      } catch (err) { fail(msg, ctx.backend.friendlyError(err)); }
    };
    armDelete(root.querySelector('#ed-del'), () => {
      try {
        (ctx.S.cycles || []).filter((r) => r.kind === 'period' && r.start === p.start).forEach((r) => ctx.backend.deleteListItem(LIST, r.id));
        closeEditor();
      } catch (err) { fail(msg, ctx.backend.friendlyError(err)); }
    });
  });
}

// History: mode, usual cycle length, and every logged period (tap to edit).
function openHistory(ctx) {
  if (!needUser(ctx)) return;
  const st = ctx.S.cycleSt;
  let mode = st.settings.mode;
  const list = [...st.periods].reverse();
  const rowHtml = (p) => {
    const days = p.end ? toDay(p.end) - toDay(p.start) + 1 : null;
    const yr = p.start.slice(0, 4) !== st.today.slice(0, 4) ? `, ${p.start.slice(0, 4)}` : '';
    return `<button type="button" class="row" data-period="${esc(p.id)}"><span class="row-main">
      <span class="row-title">${esc(p.end ? fmtRange(p.start, p.end) : fmtDay(p.start))}${yr}</span></span>
      <span class="count is-past">${days ? `${days} day${days === 1 ? '' : 's'}` : 'no end'}</span></button>`;
  };
  openEditor(`${editorHead('History')}
    <form class="form narrow" id="ed-form">
      <div class="field"><span>Mode${help('Birth control and pregnancy stop ovulation, so predictions turn off.')}</span>
        <div class="seg" role="radiogroup">${MODE_NAMES.map(([k, n]) =>
          `<button type="button" role="radio" aria-checked="${mode === k}" data-mode="${k}">${n}</button>`).join('')}</div></div>
      <label class="field"><span>Usual cycle, days (optional)</span><input id="cy-usual" type="number" inputmode="numeric" min="15" max="90" value="${st.settings.usualLength || ''}" placeholder="29"></label>
      <p class="form-msg" id="ed-msg" role="status"></p>
      <div class="sec-row"><h2 class="sec-head">Periods</h2><button type="button" class="icon-btn small" id="cy-add" aria-label="Add period">${svg('plus')}</button></div>
      <div class="list">${list.length ? list.map(rowHtml).join('') : '<p class="empty">None yet.</p>'}</div>
    </form>`, (root) => {
    const msg = root.querySelector('#ed-msg');
    root.querySelectorAll('[data-mode]').forEach((b) => {
      b.onclick = () => {
        mode = b.dataset.mode;
        root.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      };
    });
    root.querySelector('#cy-add').onclick = () => openPeriodEditor(ctx, null, '');
    root.querySelectorAll('[data-period]').forEach((b) => { b.onclick = () => openPeriodEditor(ctx, b.dataset.period); });
    root.querySelector('#ed-form').onsubmit = (e) => {
      e.preventDefault();
      const raw = root.querySelector('#cy-usual').value.trim();
      const usual = raw ? Math.round(+raw) : null;
      if (raw && !(usual >= 15 && usual <= 90)) return fail(msg, 'Use 15 to 90 days.');
      const row = { id: 'settings', kind: 'settings', ...nextSettings(st.settings, mode, usual, st.today) };
      try { ctx.backend.saveListItem(LIST, row); closeEditor(); } catch (err) { fail(msg, ctx.backend.friendlyError(err)); }
    };
  });
}

function answerPrompt(ctx, what) {
  const st = ctx.S.cycleSt, q = st.prompt;
  if (!q || !needUser(ctx)) return;
  try {
    if (what === 'add') {
      const guess = q.guess || (st.pred ? toStr(toDay(st.pred.lastStart) + st.pred.cycleLength) : today());
      return openPeriodEditor(ctx, null, guess > st.today ? st.today : guess);
    }
    if (what === 'keep') {
      ctx.backend.saveListItem(LIST, { ...settingsRow(st), okGaps: [...st.settings.okGaps, q.from].slice(-24) });
      return;
    }
    if (what === 'merge') { // the later start was the same period: fold it into the earlier one
      const a = st.periods.find((p) => p.start === q.from);
      // every raw row with the later start (offline sync can leave duplicates)
      const later = (ctx.S.cycles || []).filter((r) => r.kind === 'period' && r.start === q.to);
      if (!a || !later.length) return;
      const end = [a.end, ...later.map((r) => (isYMD(r.end) ? r.end : null))].filter(Boolean).sort().pop() || null;
      if (end !== a.end) ctx.backend.saveListItem(LIST, { id: a.id, kind: 'period', start: a.start, end });
      later.forEach((r) => ctx.backend.deleteListItem(LIST, r.id));
      flash('Merged.');
    }
  } catch (err) { flash(ctx.backend.friendlyError(err)); }
}

function downloadIcs(st) {
  const text = buildCycleIcs(st.pred.nextStart, new Date());
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'her-next-period.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------------- screen ---------------- */

export default {
  key: 'cycle',
  title: 'Cycle',
  group: 'her',
  subscribe({ S, backend, render }) {
    S.cycles = [];
    S.cyclesLoaded = false;
    return [backend.watchList(LIST, (list) => { S.cycles = list; S.cyclesLoaded = true; render(); })];
  },
  render({ S, subtabs }) {
    const st = cycleStatus(S.cycles || [], today());
    S.cycleSt = st;
    const body = `<div class="cy">
      ${statusHtml(st)}${promptHtml(st)}${calendarHtml(st)}${actionsHtml(st)}${helpCardHtml(st)}
    </div>`;
    return `${topbar('Her')}${subtabs}${banner(S.info)}<div class="pane cy-pane">${loadingOr(S.info, S.cyclesLoaded, body)}</div>`;
  },
  bind(root, ctx) {
    const on = (id, fn) => { const el = root.querySelector('#' + id); if (el) el.onclick = fn; };
    on('cy-start', () => startPeriod(ctx));
    on('cy-end', () => endPeriod(ctx));
    on('cy-hist', () => openHistory(ctx));
    on('cy-ics', () => downloadIcs(ctx.S.cycleSt));
    root.querySelectorAll('[data-q]').forEach((b) => { b.onclick = () => answerPrompt(ctx, b.dataset.q); });
    root.querySelectorAll('[data-month]').forEach((b) => { b.onclick = () => { monthOffset += +b.dataset.month; ctx.render(); }; });
    const cal = root.querySelector('#cy-cal');
    if (cal) {
      let x0 = null, y0 = null;
      cal.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      cal.addEventListener('touchend', (e) => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) { monthOffset += dx < 0 ? 1 : -1; ctx.render(); }
      });
    }
  },
};
