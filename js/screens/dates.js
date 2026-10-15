// Dates screen: every saved date, plus the date editor (Home uses it too).
import { esc, svg, topbar, banner, loadingOr, help, openEditor, closeEditor, editorHead, armDelete, flash } from '../ui.js';
import { todayLocal, allSorted, countdownLabel, shortDate, parseYMD } from '../logic/dates.js';
import { buildIcs, icsFileName } from '../logic/ics.js';

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

export default {
  key: 'dates',
  title: 'Dates',
  render({ S }) {
    const list = allSorted(S.dates, todayLocal());
    const body = list.length
      ? `<div class="list dates-list">${list.map(dateRow).join('')}</div>`
      : `<div class="empty-block"><p class="empty">No dates yet.</p><button class="btn btn-primary" data-new-date>${svg('plus')}Add a date</button></div>`;
    return `${topbar('Dates', addDateBtn)}${banner(S.info)}
      <div class="pane">${loadingOr(S.info, S.datesLoaded, body)}</div>`;
  },
  bind: bindDateTaps,
};
