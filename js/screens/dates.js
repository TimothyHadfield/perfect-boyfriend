// Dates screen: Upcoming (every saved date, plus the date editor Home uses too)
// and Past (the dateLog with rating/note, manual entries, this month's spending).
import { esc, svg, topbar, banner, loadingOr, help, openEditor, closeEditor, editorHead, armDelete, flash } from '../ui.js';
import { todayLocal, allSorted, countdownLabel, shortDate, parseYMD } from '../logic/dates.js';
import { buildIcs, icsFileName } from '../logic/ics.js';
import { RATINGS, NOTE_MAX, ratingName, pastSorted, monthSpend, budgetOf, spendHue, dollars, parseCost, editedRow } from '../logic/history.js';

const TYPES = [['birthday', 'Birthday'], ['anniversary', 'Anniversary'], ['other', 'Other']];
export const typeName = (t) => (t === 'holiday' ? 'Holiday' : (TYPES.find((x) => x[0] === t) || TYPES[2])[1]);

export const addDateBtn = `<button class="icon-btn" data-new-date aria-label="Add date">${svg('plus')}</button>`;

export function dateRow(x) {
  const today = x.days === 0;
  const tag = x.holiday ? 'div' : 'button';
  const open = x.holiday ? '' : ` data-edit-date="${esc(x.id)}"`;
  return `<${tag} class="row${x.holiday ? ' is-holiday' : ''}"${open}>
    <span class="row-main"><span class="row-title">${esc(x.title || 'Untitled')}</span>
    <span class="row-sub">${esc(shortDate(x.next, !x.yearly && !x.holiday))} · ${esc(typeName(x.type))}</span></span>
    <span class="count${today ? ' is-today' : ''}${x.days < 0 ? ' is-past' : ''}">${esc(countdownLabel(x.days))}</span>
  </${tag}>`;
}

// Taps on [data-new-date] / [data-edit-date] inside root open the editor.
export function bindDateTaps(root, ctx) {
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-new-date],[data-edit-date]');
    if (!t) return;
    openDateEditor(ctx, t.dataset.editDate || null);
  });
}

export function openDateEditor(ctx, id) {
  const { S, backend } = ctx;
  const existing = id ? S.dates.find((d) => d.id === id) : null;
  if (!S.info.uid) { flash('Not connected yet.'); return; }
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
        <div class="btn-help"><button type="button" class="btn" id="ed-ics">${svg('cal')}Add to Calendar</button>${help('Saves a calendar file, so iPhone Calendar reminds you ahead of time.')}</div>
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

/* ---------------- Past: the date log + this month's spending ---------------- */

const VIEWS = [['upcoming', 'Upcoming'], ['past', 'Past']];
let view = 'upcoming';

const fmtDay = (ymd) => { const p = parseYMD(ymd); return p ? shortDate(p, p.y !== new Date().getFullYear()) : ''; };

function pastRow(x) {
  const sub = [fmtDay(x.date), dollars(x.cost)].filter(Boolean).map(esc).join(' · ');
  return `<button class="row dt-past-row" data-edit-past="${esc(x.id)}">
    <span class="row-main"><span class="row-title">${esc(x.title || 'Untitled')}</span><span class="row-sub">${sub}</span></span>
    ${ratingName(x.rating) ? `<span class="count dt-rate r-${esc(x.rating)}">${esc(ratingName(x.rating))}</span>` : ''}
  </button>`;
}

function spendLine(S) {
  const s = monthSpend(S.dateLog, S.gifts, todayLocal());
  const budget = budgetOf(S.settings);
  const hue = spendHue(s.total, budget);
  return `<div class="dt-spend"><span class="sec-head">This month</span>${help('Dates plus gifts given this month, so the whole spend is in one place.')}
    <span class="dt-spend-val"${hue === null ? '' : ` style="color:hsl(${hue} 62% 56%)"`}>${dollars(s.total)}</span>${budget ? `<span class="dt-spend-of">of ${dollars(budget)}</span>` : ''}</div>`;
}

function pastBody(S) {
  const list = pastSorted(S.dateLog);
  return `${spendLine(S)}${list.length
    ? `<div class="list dates-list dt-past-list">${list.map(pastRow).join('')}</div>`
    : `<div class="empty-block"><p class="empty">No past dates yet.</p><button class="btn btn-primary" data-new-past>${svg('plus')}Add a past date</button></div>`}`;
}

function rateSeg(value) {
  return `<div class="seg dt-rate-seg" role="radiogroup">${RATINGS.map(([k, n]) =>
    `<button type="button" role="radio" aria-checked="${value === k}" data-rate="${k}">${n}</button>`).join('')}</div>`;
}

// Edit a logged date (rating, note, delete) or add one by hand. Keeps every field Plan wrote.
function openPastEditor(ctx, id) {
  const { S, backend } = ctx;
  if (!S.info.uid) { flash('Not connected yet.'); return; }
  const existing = id ? (S.dateLog || []).find((x) => x.id === id) : null;
  if (id && !existing) return;
  let newId;
  try { newId = existing ? existing.id : backend.newListId('dateLog'); } catch (err) { flash(backend.friendlyError(err)); return; }
  const d = existing || { id: newId, title: '', date: '', cost: 0, manual: true };
  const stops = Array.isArray(d.stops) ? d.stops.filter(Boolean) : [];
  openEditor(`${editorHead(existing ? 'Past date' : 'New past date')}
    <form class="form" id="ed-form">
      <label class="field"><span>Title</span><input id="ed-title" maxlength="200" placeholder="Picnic at the park" value="${esc(d.title)}" required></label>
      ${stops.length ? `<p class="dt-stops">${esc(stops.join(' · '))}</p>` : ''}
      <div class="dt-two">
        <label class="field"><span>Date</span><input id="ed-date" type="date" value="${esc(d.date)}" required></label>
        <label class="field"><span>Cost</span><input id="ed-cost" inputmode="decimal" maxlength="12" placeholder="$" value="${existing && d.cost != null ? esc(d.cost) : ''}"></label>
      </div>
      <div class="field"><span>Rating</span>${rateSeg(d.rating || '')}</div>
      <label class="field"><span>Note</span><textarea id="ed-note" rows="3" maxlength="${NOTE_MAX}" placeholder="What she liked">${esc(d.note)}</textarea></label>
      <p class="form-msg" id="ed-msg" role="status"></p>
      ${existing ? '<div class="btn-col"><button type="button" class="btn btn-danger" id="ed-del">Delete</button></div>' : ''}
    </form>`, (root) => {
    let rating = d.rating || '';
    const btns = root.querySelectorAll('[data-rate]');
    btns.forEach((b) => {
      b.onclick = () => {
        rating = rating === b.dataset.rate ? '' : b.dataset.rate;
        btns.forEach((x) => x.setAttribute('aria-checked', String(x.dataset.rate === rating)));
      };
    });
    const msg = root.querySelector('#ed-msg');
    const fail = (t) => { msg.textContent = t; msg.classList.add('is-error'); };
    root.querySelector('#ed-form').onsubmit = (e) => {
      e.preventDefault();
      const title = root.querySelector('#ed-title').value.trim();
      const date = root.querySelector('#ed-date').value;
      const cost = parseCost(root.querySelector('#ed-cost').value);
      if (!title) return fail('Add a title.');
      if (!parseYMD(date)) return fail('Pick a date.');
      if (Number.isNaN(cost)) return fail('Cost must be a number.');
      const item = editedRow(d, { title, date, cost, rating, note: root.querySelector('#ed-note').value });
      try { backend.saveListItem('dateLog', item); closeEditor(); } catch (err) { fail(backend.friendlyError(err)); }
    };
    armDelete(root.querySelector('#ed-del'), () => {
      try { backend.deleteListItem('dateLog', d.id); closeEditor(); } catch (err) { fail(backend.friendlyError(err)); }
    });
  });
}

export default {
  key: 'dates',
  title: 'Dates',
  render({ S }) {
    const seg = `<div class="seg dt-seg" role="tablist">${VIEWS.map(([k, n]) =>
      `<button type="button" role="tab" aria-checked="${view === k}" data-view="${k}">${n}</button>`).join('')}</div>`;
    if (view === 'past') {
      const add = `<button class="icon-btn" data-new-past aria-label="Add past date">${svg('plus')}</button>`;
      return `${topbar('Dates', add)}${banner(S.info)}${seg}
        <div class="pane dt-past">${loadingOr(S.info, S.datesLoaded, pastBody(S))}</div>`;
    }
    const list = allSorted(S.dates, todayLocal());
    const body = list.length
      ? `<div class="list dates-list">${list.map(dateRow).join('')}</div>`
      : `<div class="empty-block"><p class="empty">No dates yet.</p><button class="btn btn-primary" data-new-date>${svg('plus')}Add a date</button></div>`;
    return `${topbar('Dates', addDateBtn)}${banner(S.info)}${seg}
      <div class="pane">${loadingOr(S.info, S.datesLoaded, body)}</div>`;
  },
  bind(root, ctx) {
    bindDateTaps(root, ctx);
    root.querySelectorAll('.dt-seg [data-view]').forEach((b) => {
      b.onclick = () => {
        if (view === b.dataset.view) return;
        view = b.dataset.view;
        const pane = root.querySelector('.pane');
        if (pane) pane.scrollTop = 0;
        ctx.render();
      };
    });
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-new-past],[data-edit-past]');
      if (t) openPastEditor(ctx, t.dataset.editPast || null);
    });
  },
};
