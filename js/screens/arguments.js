// Her > Arguments: a private log of arguments (topic, what set it off, what helped,
// what made it worse, how it ended) and a Patterns view built from it.
// Phone: Log · Patterns segmented control. Laptop: side by side.
// Never shown on Home (sensitive).
import { esc, svg, topbar, banner, loadingOr, help, openEditor, closeEditor, editorHead, armDelete, flash } from '../ui.js';
import { todayLocal, toYMD, shortDate, parseYMD } from '../logic/dates.js';
import { OUTCOMES, outcomeName, sortLog, topicList, daysSinceLast, patterns, hasPatterns, PATTERN_MIN, cleanEntry } from '../logic/arguments.js';

// Source for the tips: The Gottman Institute, "The Four Horsemen"
// https://www.gottman.com/blog/the-four-horsemen-recognizing-criticism-contempt-defensiveness-and-stonewalling/
const TIPS = 'Pick a calm time to talk. · Start soft: "I feel… I need…" · Listen first; own your part. · Too heated? Take a 20-minute break. — Source: The Gottman Institute';

const INTENSITY = [[1, 'Mild'], [2, 'Medium'], [3, 'Big']];
let view = 'log';   // phone only: which panel shows

const dots = (n) => `<span class="arg-dots" aria-label="Intensity ${n} of 3">${[1, 2, 3].map((i) => `<i${i <= n ? ' class="on"' : ''}></i>`).join('')}</span>`;
const dateText = (s) => shortDate(parseYMD(s), parseYMD(s) && parseYMD(s).y !== todayLocal().y);

function logRow(e) {
  const sub = [dateText(e.date), e.trigger].filter(Boolean).join(' · ');
  return `<button class="row arg-row" data-edit-arg="${esc(e.id)}">
    <span class="row-main"><span class="row-title">${esc(e.topic || 'Untitled')}</span>
    <span class="row-sub">${esc(sub)}</span></span>
    <span class="arg-end">${dots(e.intensity || 2)}<span class="arg-out is-${esc(e.outcome)}">${esc(outcomeName(e.outcome))}</span></span>
  </button>`;
}

function patternBlock(p) {
  const last = p.last ? `Last ${dateText(p.last)}` : 'Upcoming';
  const line = (label, x) => (x ? `<div class="pat-line"><span class="pat-k">${label}</span><span class="pat-v">${esc(x.phrase)}</span><span class="pat-n">×${x.n}</span></div>` : '');
  return `<section class="pat">
    <div class="pat-head"><span class="row-main"><span class="row-title">${esc(p.topic)}</span><span class="row-sub">${esc(last)}</span></span>
      <span class="pat-num">${p.count90}</span><span class="pat-num all">${p.count}</span></div>
    ${line('Helped', p.helped)}${line('Worse', p.worse)}
    ${p.revisit.map((e) => `<button class="pat-line pat-revisit" data-edit-arg="${esc(e.id)}"><span class="pat-k">Revisit</span><span class="pat-v">${esc(dateText(e.date))}${e.trigger ? ' · ' + esc(e.trigger) : ''}</span></button>`).join('')}
  </section>`;
}

function render({ S, subtabs }) {
  const list = S.arguments || [];
  const today = todayLocal();
  const since = daysSinceLast(list, today);
  const log = sortLog(list);
  const pats = hasPatterns(list) ? patterns(list, today) : [];
  const stats = `<div class="arg-stats">
      <div class="arg-card"><span class="arg-label">Days since last</span><span class="arg-big">${since === null ? '–' : since}</span></div>
      <div class="arg-card"><span class="arg-label">Before you talk${help(TIPS)}</span><span class="arg-tip">Calm time · listen first</span></div>
    </div>`;
  const logPanel = log.length
    ? `<div class="list">${log.map(logRow).join('')}</div>`
    : `<div class="empty-block"><p class="empty">Nothing logged.</p><button class="btn btn-primary" data-new-arg>${svg('plus')}Log one</button></div>`;
  const patPanel = pats.length
    ? `<div class="pat-cols"><span>Topic</span><span class="pat-num">90d</span><span class="pat-num all">All</span></div>${pats.map(patternBlock).join('')}`
    : `<p class="empty">Shows up after ${PATTERN_MIN} logs.</p>`;
  const body = `<div class="arg-wrap" data-view="${view}">
      <div class="seg arg-seg" role="radiogroup" aria-label="View">
        <button type="button" role="radio" data-view-btn="log" aria-checked="${view === 'log'}">Log</button>
        <button type="button" role="radio" data-view-btn="patterns" aria-checked="${view === 'patterns'}">Patterns</button>
      </div>
      <div class="arg-col arg-col-log">${stats}<h2 class="sec-head arg-colhead">Log</h2><div class="arg-scroll">${logPanel}</div></div>
      <div class="arg-col arg-col-pat"><h2 class="sec-head arg-colhead">Patterns${help('Most common in the last 90 days. "Helped" and "Worse" count the phrases you typed (split by commas).')}</h2><div class="arg-scroll">${patPanel}</div></div>
    </div>`;
  const add = `<button class="icon-btn" data-new-arg aria-label="Log an argument">${svg('plus')}</button>`;
  return `${topbar('Her', add)}${subtabs}${banner(S.info)}<div class="pane arg-pane">${loadingOr(S.info, S.argumentsLoaded, body)}</div>`;
}

function openArgEditor(ctx, id) {
  const { S, backend } = ctx;
  if (!S.info.uid) { flash('Not connected yet.'); return; }
  const existing = id ? (S.arguments || []).find((x) => x.id === id) : null;
  let newIdValue;
  try { newIdValue = existing ? existing.id : backend.newListId('arguments'); } catch (err) { flash(backend.friendlyError(err)); return; }
  const e = existing || { id: newIdValue, date: toYMD(todayLocal()), topic: '', trigger: '', helped: '', worse: '', outcome: 'resolved', intensity: 2, notes: '' };
  const topics = topicList(S.arguments);
  const seg = (name, opts, cur) => `<div class="seg" role="radiogroup">${opts.map(([k, n]) =>
    `<button type="button" role="radio" aria-checked="${String(k) === String(cur)}" data-${name}="${k}">${n}</button>`).join('')}</div>`;
  openEditor(`${editorHead(existing ? 'Edit argument' : 'New argument')}
    <form class="form arg-form" id="ed-form">
      <div class="arg-pair">
        <label class="field"><span>Topic</span><input id="ed-topic" maxlength="80" list="ed-topics" placeholder="Chores" value="${esc(e.topic)}" required></label>
        <label class="field"><span>Date</span><input id="ed-date" type="date" value="${esc(e.date)}" required></label>
      </div>
      <datalist id="ed-topics">${topics.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
      <label class="field"><span>Set off by</span><input id="ed-trigger" maxlength="300" value="${esc(e.trigger)}"></label>
      <label class="field"><span>What helped${help('Separate with commas, so Patterns can count each one.')}</span><input id="ed-helped" maxlength="300" placeholder="Listened, took a break" value="${esc(e.helped)}"></label>
      <label class="field"><span>Made it worse</span><input id="ed-worse" maxlength="300" value="${esc(e.worse)}"></label>
      <div class="field"><span>How it ended</span>${seg('outcome', OUTCOMES, e.outcome)}</div>
      <div class="field"><span>Intensity</span>${seg('intensity', INTENSITY, e.intensity)}</div>
      <label class="field"><span>Notes</span><textarea id="ed-notes" rows="2" maxlength="2000">${esc(e.notes)}</textarea></label>
      <p class="form-msg" id="ed-msg" role="status"></p>
      ${existing ? '<div class="btn-col"><button type="button" class="btn btn-danger" id="ed-del">Delete</button></div>' : ''}
    </form>`, (root) => {
    let outcome = e.outcome, intensity = e.intensity;
    const pick = (attr, set) => root.querySelectorAll(`[data-${attr}]`).forEach((b) => {
      b.onclick = () => {
        set(b.dataset[attr]);
        root.querySelectorAll(`[data-${attr}]`).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      };
    });
    pick('outcome', (v) => { outcome = v; });
    pick('intensity', (v) => { intensity = +v; });
    const msg = root.querySelector('#ed-msg');
    const val = (s) => root.querySelector(s).value;
    root.querySelector('#ed-form').onsubmit = (ev) => {
      ev.preventDefault();
      const item = cleanEntry({
        id: e.id, date: val('#ed-date'), topic: val('#ed-topic'), trigger: val('#ed-trigger'),
        helped: val('#ed-helped'), worse: val('#ed-worse'), outcome, intensity, notes: val('#ed-notes'),
      });
      const bad = !item.topic ? 'Add a topic.' : !item.date ? 'Pick a date.' : '';
      if (bad) { msg.textContent = bad; msg.classList.add('is-error'); return; }
      try { backend.saveListItem('arguments', item); closeEditor(); } catch (err) { msg.textContent = backend.friendlyError(err); msg.classList.add('is-error'); }
    };
    armDelete(root.querySelector('#ed-del'), () => {
      try { backend.deleteListItem('arguments', e.id); closeEditor(); } catch (err) { msg.textContent = backend.friendlyError(err); }
    });
  });
}

export default {
  key: 'arguments',
  title: 'Arguments',
  group: 'her',
  render,
  bind(root, ctx) {
    root.addEventListener('click', (ev) => {
      const v = ev.target.closest('[data-view-btn]');
      if (v) {
        // Switch panels in place (no re-render, nothing else moves).
        view = v.dataset.viewBtn;
        root.querySelector('.arg-wrap').dataset.view = view;
        root.querySelectorAll('[data-view-btn]').forEach((b) => b.setAttribute('aria-checked', String(b === v)));
        return;
      }
      const t = ev.target.closest('[data-new-arg],[data-edit-arg]');
      if (t) openArgEditor(ctx, t.dataset.editArg || null);
    });
  },
  subscribe(ctx) {
    const { S, backend } = ctx;
    S.arguments = [];
    S.argumentsLoaded = false;
    return [backend.watchList('arguments', (list) => { S.arguments = list; S.argumentsLoaded = true; ctx.render(); })];
  },
};
