// Gifts: ideas, given history, recurring reminders (.ics). Phone: one column at a
// time picked by a segmented control; laptop: three columns side by side.
// Contract: see the top of js/app.js. Styles: css/gifts.css. Logic: js/logic/gifts.js.
import { esc, svg, topbar, banner, help, openEditor, closeEditor, editorHead, armDelete, flash } from '../ui.js';
import { todayLocal, shortDate, parseYMD } from '../logic/dates.js';
import { icsFileName } from '../logic/ics.js';
import {
  OCCASIONS, REACTIONS, UNITS, PRESETS, occasionName, reactionName, ideasOf, givenOf, givenBefore,
  priceLabel, parsePrice, validReminder, remindersSorted, nextLabel, everyLabel, timeLabel, profileHint,
  buildReminderIcs, todayYMD, profileSuggestions, conflictOf, reminderSeed,
} from '../logic/gifts.js';

const TABS = [['ideas', 'Ideas'], ['given', 'Given'], ['reminders', 'Reminders']];
let tab = 'ideas';
let sugg = [];   // profile suggestions from the last render (chips refer to them by index)

const fmtDay = (ymd) => { const p = parseYMD(ymd); return p ? shortDate(p, p.y !== new Date().getFullYear()) : ''; };

/* ---------------- rows ---------------- */

function ideaRow(g, all, profile) {
  const before = givenBefore(g, all);
  const bad = conflictOf(g.title, profile);
  const sub = [priceLabel(g.price), occasionName(g.occasion), g.where].filter(Boolean).map(esc).join(' · ');
  const lead = [
    bad ? `<span class="gf-warn">${bad.kind === 'allergy' ? 'Allergy' : 'Dislikes'}: ${esc(bad.term)}</span>` : '',
    before ? `<span class="gf-before">gave ${esc(fmtDay(before.date))}</span>` : '',
  ].filter(Boolean).join(' · ');
  return `<div class="row gf-row">
    <button class="row-main" data-edit-idea="${esc(g.id)}">
      <span class="row-title">${esc(g.title || 'Untitled')}</span>
      ${sub || lead ? `<span class="row-sub">${lead}${lead && sub ? ' · ' : ''}${sub}</span>` : ''}
    </button>
    <button class="gf-give" data-give="${esc(g.id)}">Given</button>
  </div>`;
}

function givenRow(g) {
  const sub = [fmtDay(g.date), reactionName(g.reaction), priceLabel(g.price)].filter(Boolean).map(esc).join(' · ');
  return `<button class="row gf-row" data-edit-given="${esc(g.id)}">
    <span class="row-main"><span class="row-title">${esc(g.title || 'Untitled')}</span><span class="row-sub">${sub}</span></span>
    ${g.reaction ? `<span class="gf-react r${Number(g.reaction)}" aria-hidden="true">${'●'.repeat(Number(g.reaction))}</span>` : ''}
  </button>`;
}

function reminderRow(r, profile, today) {
  const hint = profileHint(r.what, profile);
  const sub = [everyLabel(r), timeLabel(r.time), hint].filter(Boolean).map(esc).join(' · ');
  return `<div class="row gf-row">
    <button class="row-main" data-edit-rem="${esc(r.id)}">
      <span class="row-title">${esc(r.what || 'Reminder')}</span><span class="row-sub">${sub}</span>
    </button>
    <span class="count${r.days === 0 ? ' is-today' : ''}">${validReminder(r) ? (r.days <= 1 ? '' : 'next ') + esc(nextLabel(r, today)) : ''}</span>
    <button class="icon-btn small" data-ics="${esc(r.id)}" aria-label="Add to Calendar">${svg('cal')}</button>
  </div>`;
}

/* ---------------- render ---------------- */

function render({ S }) {
  const today = todayLocal();
  const all = S.gifts || [];
  const ideas = ideasOf(all);
  const given = givenOf(all);
  const rems = S.info.uid ? remindersSorted(S.giftReminders || [], today) : [];
  const profile = S.profile || [];
  sugg = profileSuggestions(profile, all);

  // From her profile: one line of chips; + adds an idea, the calendar makes a reminder.
  const suggStrip = sugg.length ? `<div class="gf-sugg">
      <span class="gf-sugg-k">From her profile${help('Her Favorites, minus her allergies and dislikes.')}</span>
      <div class="gf-sugg-row">${sugg.map((s, i) => `<span class="gf-sg">
        <button class="gf-sg-add" data-sugg-add="${i}" aria-label="Add ${esc(s.title)} to ideas">${svg('plus')}${esc(s.title)}</button>
        <button class="gf-sg-rem" data-sugg-rem="${i}" aria-label="Remind me: ${esc(s.title)}">${svg('cal')}</button></span>`).join('')}</div>
    </div>` : '';

  const ideasCol = `<section class="gf-col" data-col="ideas">
    <h2 class="sec-head gf-head">Ideas</h2>
    <form class="gf-quick" id="gf-quick-form" autocomplete="off">
      <input id="gf-quick" maxlength="200" placeholder="Add an idea" aria-label="Gift idea">
      <button class="icon-btn" aria-label="Add idea">${svg('plus')}</button>
    </form>
    ${suggStrip}
    ${ideas.length ? `<div class="list">${ideas.map((g) => ideaRow(g, all, profile)).join('')}</div>` : '<p class="empty">No ideas yet.</p>'}
  </section>`;

  const givenCol = `<section class="gf-col" data-col="given">
    <div class="gf-head-row"><h2 class="sec-head gf-head">Given</h2>
      <button class="gf-link" data-new-given>${svg('plus')}Log a gift</button></div>
    ${given.length ? `<div class="list">${given.map(givenRow).join('')}</div>` : '<p class="empty">Nothing given yet.</p>'}
  </section>`;

  const remCol = `<section class="gf-col" data-col="reminders">
    <h2 class="sec-head gf-head">Reminders</h2>
    <div class="gf-presets">${PRESETS.map((p) =>
      `<button class="gf-chip" data-preset="${p.key}">${svg('plus')}${esc(p.what)}</button>`).join('')}
      <button class="gf-chip" data-preset="">${svg('plus')}Custom</button>${help('Tap one, then Add to Calendar. iPhone Calendar alerts you each time.')}</div>
    ${rems.length ? `<div class="list">${rems.map((r) => reminderRow(r, profile, today)).join('')}</div>` : '<p class="empty">No reminders yet.</p>'}
  </section>`;

  const seg = `<div class="seg gf-seg" role="tablist">${TABS.map(([k, n]) =>
    `<button type="button" role="tab" aria-checked="${tab === k}" data-tab="${k}">${n}</button>`).join('')}</div>`;

  return `${topbar('Gifts')}${banner(S.info)}${seg}
    <div class="pane gf" data-tab="${tab}">${ideasCol}${givenCol}${remCol}</div>`;
}

/* ---------------- editors ---------------- */

function canWrite(ctx) {
  if (!ctx.S.info.uid) { flash('Not connected yet.'); return false; }
  return true;
}

function segHtml(name, options, value) {
  return `<div class="seg" role="radiogroup">${options.map(([k, n]) =>
    `<button type="button" role="radio" aria-checked="${String(value) === String(k)}" data-${name}="${k}">${esc(n)}</button>`).join('')}</div>`;
}

// Single-choice seg. `optional` lets a second tap clear it.
function bindSeg(root, name, value, optional) {
  let v = value;
  const btns = root.querySelectorAll(`[data-${name}]`);
  btns.forEach((b) => {
    b.onclick = () => {
      const k = b.dataset[name];
      v = optional && String(v) === k ? '' : k;
      btns.forEach((x) => x.setAttribute('aria-checked', String(String(v) === x.dataset[name])));
    };
  });
  return () => v;
}

function showErr(root, text) {
  const m = root.querySelector('#ed-msg');
  m.textContent = text;
  m.classList.add('is-error');
}

function save(ctx, root, list, item) {
  try { ctx.backend.saveListItem(list, item); closeEditor(); } catch (err) { showErr(root, ctx.backend.friendlyError(err)); }
}

function bindDelete(ctx, root, list, id) {
  armDelete(root.querySelector('#ed-del'), () => {
    try { ctx.backend.deleteListItem(list, id); closeEditor(); } catch (err) { showErr(root, ctx.backend.friendlyError(err)); }
  });
}

function openIdeaEditor(ctx, id) {
  if (!canWrite(ctx)) return;
  const g = (ctx.S.gifts || []).find((x) => x.id === id);
  if (!g) return;
  openEditor(`${editorHead('Gift idea')}
    <form class="form" id="ed-form">
      <label class="field"><span>Gift</span><input id="ed-title" maxlength="200" value="${esc(g.title)}" required></label>
      <div class="gf-two">
        <label class="field"><span>Price</span><input id="ed-price" inputmode="decimal" maxlength="12" placeholder="$" value="${esc(g.price ?? '')}"></label>
        <label class="field"><span>Where</span><input id="ed-where" maxlength="500" placeholder="Store or link" value="${esc(g.where)}"></label>
      </div>
      <div class="field"><span>Occasion</span>${segHtml('occ', OCCASIONS, g.occasion || '')}</div>
      <label class="field"><span>Notes</span><textarea id="ed-notes" rows="3" maxlength="2000">${esc(g.notes)}</textarea></label>
      <p class="form-msg" id="ed-msg" role="status"></p>
      <div class="btn-col">
        <button type="button" class="btn" id="ed-give">Mark given</button>
        <button type="button" class="btn btn-danger" id="ed-del">Delete</button>
      </div>
    </form>`, (root) => {
    const occ = bindSeg(root, 'occ', g.occasion || '', true);
    const read = () => {
      const item = { ...g,
        title: root.querySelector('#ed-title').value.trim(),
        where: root.querySelector('#ed-where').value.trim(),
        occasion: occ(),
        notes: root.querySelector('#ed-notes').value.trim() };
      const price = parsePrice(root.querySelector('#ed-price').value);
      if (price === null) delete item.price; else item.price = price;
      delete item.updatedAt;
      return item;
    };
    const check = (item) => (!item.title ? 'Add a gift.' : root.querySelector('#ed-price').value.trim() && item.price === undefined ? 'Price must be a number.' : '');
    root.querySelector('#ed-form').onsubmit = (e) => {
      e.preventDefault();
      const item = read();
      const bad = check(item);
      if (bad) return showErr(root, bad);
      save(ctx, root, 'gifts', item);
    };
    root.querySelector('#ed-give').onclick = () => {
      const item = read();
      const bad = check(item);
      if (bad) return showErr(root, bad);
      openGivenEditor(ctx, item);
    };
    bindDelete(ctx, root, 'gifts', g.id);
  });
}

// g: an existing given gift, an idea being marked given, or null for a new log entry.
function openGivenEditor(ctx, g) {
  if (!canWrite(ctx)) return;
  const existing = g && parseYMD(g.date) ? g : null;
  let id;
  try { id = g ? g.id : ctx.backend.newListId('gifts'); } catch (err) { flash(ctx.backend.friendlyError(err)); return; }
  const d = { ...(g || { title: '', added: todayYMD() }), id };
  openEditor(`${editorHead(existing ? 'Given gift' : 'Mark given')}
    <form class="form" id="ed-form">
      <label class="field"><span>Gift</span><input id="ed-title" maxlength="200" value="${esc(d.title)}" required></label>
      <label class="field"><span>Date given</span><input id="ed-date" type="date" value="${esc(existing ? d.date : todayYMD())}" required></label>
      <div class="field"><span>Her reaction</span>${segHtml('react', REACTIONS, d.reaction || '')}</div>
      <label class="field"><span>Notes</span><textarea id="ed-notes" rows="3" maxlength="2000" placeholder="How it went">${esc(d.notes)}</textarea></label>
      <p class="form-msg" id="ed-msg" role="status"></p>
      ${existing ? `<div class="btn-col">
        <button type="button" class="btn" id="ed-undo">Back to ideas</button>
        <button type="button" class="btn btn-danger" id="ed-del">Delete</button></div>` : ''}
    </form>`, (root) => {
    const react = bindSeg(root, 'react', d.reaction || '', true);
    root.querySelector('#ed-form').onsubmit = (e) => {
      e.preventDefault();
      const item = { ...d,
        title: root.querySelector('#ed-title').value.trim(),
        date: root.querySelector('#ed-date').value,
        notes: root.querySelector('#ed-notes').value.trim() };
      const r = Number(react());
      if (r) item.reaction = r; else delete item.reaction;
      delete item.updatedAt;
      if (!item.title) return showErr(root, 'Add a gift.');
      if (!parseYMD(item.date)) return showErr(root, 'Pick a date.');
      save(ctx, root, 'gifts', item);
    };
    if (existing) {
      root.querySelector('#ed-undo').onclick = () => {
        const item = { ...d };
        delete item.date; delete item.reaction; delete item.updatedAt;
        save(ctx, root, 'gifts', item);
      };
      bindDelete(ctx, root, 'gifts', d.id);
    }
  });
}

// seed: optional {what, every, unit} for a new reminder (from a profile suggestion).
function openReminderEditor(ctx, id, presetKey, seed) {
  if (!canWrite(ctx)) return;
  const existing = id ? (ctx.S.giftReminders || []).find((x) => x.id === id) : null;
  let newId;
  try { newId = existing ? existing.id : ctx.backend.newListId('giftReminders'); } catch (err) { flash(ctx.backend.friendlyError(err)); return; }
  const p = PRESETS.find((x) => x.key === presetKey);
  const r = existing || { id: newId, what: p ? p.what : '', every: p ? p.every : 1, unit: p ? p.unit : 'week', start: todayYMD(), time: '17:00', ...(seed || {}) };
  const hint = profileHint(r.what, ctx.S.profile);
  openEditor(`${editorHead(existing ? 'Reminder' : 'New reminder')}
    <form class="form" id="ed-form">
      <label class="field"><span>What</span><input id="ed-what" maxlength="200" placeholder="Flowers" value="${esc(r.what)}" required></label>
      <p class="gf-hint" id="ed-hint">${hint ? `Her favorite: ${esc(hint)}` : ''}</p>
      <div class="field"><span>Repeat every</span><div class="gf-every">
        <input id="ed-every" type="number" inputmode="numeric" min="1" max="999" value="${esc(r.every)}" aria-label="How many">
        ${segHtml('unit', UNITS, r.unit)}</div></div>
      <div class="gf-two">
        <label class="field"><span>Starts</span><input id="ed-start" type="date" value="${esc(r.start)}" required></label>
        <label class="field"><span>Time</span><input id="ed-time" type="time" value="${esc(r.time)}" required></label>
      </div>
      <p class="form-msg" id="ed-msg" role="status"></p>
      <div class="btn-col">
        <div class="btn-help"><button type="button" class="btn" id="ed-ics">${svg('cal')}Add to Calendar</button>${help('Saves a repeating calendar event. iPhone Calendar alerts you each time.')}</div>
        ${existing ? '<button type="button" class="btn btn-danger" id="ed-del">Delete</button>' : ''}
      </div>
    </form>`, (root) => {
    const unit = bindSeg(root, 'unit', r.unit, false);
    const whatEl = root.querySelector('#ed-what');
    whatEl.oninput = () => {
      const h = profileHint(whatEl.value, ctx.S.profile);
      root.querySelector('#ed-hint').textContent = h ? `Her favorite: ${h}` : '';
    };
    const read = () => ({
      id: r.id,
      what: whatEl.value.trim(),
      every: Number(root.querySelector('#ed-every').value),
      unit: unit(),
      start: root.querySelector('#ed-start').value,
      time: root.querySelector('#ed-time').value || '17:00',
    });
    const check = (item) => (!item.what ? 'Add what to get.' : !validReminder(item) ? (parseYMD(item.start) ? 'Repeat must be 1 to 999.' : 'Pick a start date.') : '');
    root.querySelector('#ed-form').onsubmit = (e) => {
      e.preventDefault();
      const item = read();
      const bad = check(item);
      if (bad) return showErr(root, bad);
      save(ctx, root, 'giftReminders', item);
    };
    root.querySelector('#ed-ics').onclick = () => {
      const item = read();
      const bad = check(item);
      if (bad) return showErr(root, bad);
      downloadReminder(item, ctx.S.profile);
    };
    if (existing) bindDelete(ctx, root, 'giftReminders', r.id);
  });
}

function downloadReminder(r, profile) {
  const text = buildReminderIcs({ ...r, hint: profileHint(r.what, profile) }, new Date());
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = icsFileName({ title: r.what });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------------- bind ---------------- */

function bind(root, ctx) {
  const pane = root.querySelector('.gf');
  root.querySelectorAll('.gf-seg [data-tab]').forEach((b) => {
    b.onclick = () => {
      if (tab === b.dataset.tab) return;
      tab = b.dataset.tab;
      pane.dataset.tab = tab;
      pane.scrollTop = 0;
      root.querySelectorAll('.gf-seg [data-tab]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    };
  });

  const quick = root.querySelector('#gf-quick');
  root.querySelector('#gf-quick-form').onsubmit = (e) => {
    e.preventDefault();
    const title = quick.value.trim();
    if (!title || !canWrite(ctx)) return;
    try {
      const id = ctx.backend.newListId('gifts');
      quick.value = '';
      ctx.backend.saveListItem('gifts', { id, title: title.slice(0, 200), added: new Date().toISOString() });
    } catch (err) { flash(ctx.backend.friendlyError(err)); }
  };

  pane.addEventListener('click', (e) => {
    const t = e.target.closest('[data-edit-idea],[data-give],[data-edit-given],[data-new-given],[data-edit-rem],[data-preset],[data-ics],[data-sugg-add],[data-sugg-rem]');
    if (!t) return;
    const ds = t.dataset;
    if (ds.suggAdd || ds.suggRem) {
      const s = sugg[Number(ds.suggAdd || ds.suggRem)];
      if (!s) return;
      if (ds.suggRem) { openReminderEditor(ctx, null, null, reminderSeed(s)); return; }
      if (!canWrite(ctx)) return;
      try {
        ctx.backend.saveListItem('gifts', { id: ctx.backend.newListId('gifts'), title: s.title, added: new Date().toISOString() });
      } catch (err) { flash(ctx.backend.friendlyError(err)); }
      return;
    }
    const find = (id) => (ctx.S.gifts || []).find((x) => x.id === id);
    if (ds.editIdea) openIdeaEditor(ctx, ds.editIdea);
    else if (ds.give) { const g = find(ds.give); if (g) openGivenEditor(ctx, g); }
    else if (ds.editGiven) { const g = find(ds.editGiven); if (g) openGivenEditor(ctx, g); }
    else if ('newGiven' in ds) openGivenEditor(ctx, null);
    else if (ds.editRem) openReminderEditor(ctx, ds.editRem);
    else if ('preset' in ds) openReminderEditor(ctx, null, ds.preset);
    else if (ds.ics) {
      const r = (ctx.S.giftReminders || []).find((x) => x.id === ds.ics);
      if (r && validReminder(r)) downloadReminder(r, ctx.S.profile);
    }
  });
}

export default {
  key: 'gifts',
  title: 'Gifts',
  render,
  bind,
  subscribe(ctx) {
    ctx.S.giftReminders = [];
    if (!ctx.S.info.uid) return [];
    return [ctx.backend.watchList('giftReminders', (list) => { ctx.S.giftReminders = list; ctx.render(); })];
  },
};
