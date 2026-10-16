// Card: browse every Starving Student Card deal, with uses left. Opened from Plan.
// Loads data/ssc-deals.json once. Uses left = printed - punched on paper - S.sscUses rows (Plan subscribes them).
// "Used one" saves an sscUses row {dealId, date} (same shape as Plan's "We did this"); "Undo last use" deletes the newest.
// Phone: one column, tapping a deal opens the shared editor. Laptop: the list beside a detail panel.
// Contract: see the top of js/app.js. Styles: css/card.css. Logic: js/logic/card.js.
import { esc, topbar, banner, help, flash, openEditor, closeEditor } from '../ui.js';
import { usesLeft, leftLabel, sections, filterDeals, totals, lastUse, useRow, todayYMD } from '../logic/card.js';

const st = {
  deals: null, loading: false, loadErr: false,
  q: '', section: null, hideUsed: true,
  sel: null,          // laptop: the deal shown in the side panel
  scroll: 0,          // list scroll, kept across data re-renders
};

const wide = () => typeof matchMedia === 'function' && matchMedia('(min-width: 860px)').matches;

function load(ctx) {
  if (st.deals || st.loading || typeof document === 'undefined') return;
  st.loading = true;
  fetch('data/ssc-deals.json')
    .then((r) => { if (!r.ok) throw new Error('ssc-deals ' + r.status); return r.json(); })
    .then((j) => { st.deals = j.deals || []; })
    .catch((err) => { console.warn('card deals', err); st.loadErr = true; })
    .finally(() => { st.loading = false; ctx.render(); });
}

const uses = (ctx) => ctx.S.sscUses || [];
const rows = (ctx) => filterDeals(st.deals, { q: st.q, section: st.section, hideUsed: st.hideUsed, sscUses: uses(ctx) });

/* ---------------- pieces ---------------- */

function rowHtml({ deal, left }, selId) {
  return `<button type="button" class="row cd-row${left <= 0 ? ' is-out' : ''}" data-id="${esc(deal.id)}"${deal.id === selId ? ' aria-current="true"' : ''}>
    <span class="row-main">
      <span class="cd-r1"><span class="row-title">${esc(deal.business)}</span>${deal.where ? `<span class="cd-where">${esc(deal.where)}</span>` : ''}</span>
      <span class="row-sub">${esc(deal.deal)}</span>
    </span>
    <span class="cd-right"><span class="count">${leftLabel(left)}</span>${deal.code ? `<span class="cd-code">${esc(deal.code)}</span>` : ''}</span>
  </button>`;
}

function listHtml(list, selId) {
  if (!list.length) return `<p class="empty">${st.q ? 'No deals match.' : 'Nothing left here.'}</p>`;
  return list.map((r) => rowHtml(r, selId)).join('');
}

function detailHtml(deal, ctx) {
  if (!deal) return '';
  const left = usesLeft(deal, uses(ctx));
  const undo = lastUse(deal.id, uses(ctx));
  const fact = (k, v, cls = '') => (v ? `<p class="cd-fact${cls}"><span class="cd-k">${k}</span><span>${esc(v)}</span></p>` : '');
  return `<div class="cd-d">
    <span class="sec-head">${esc(deal.section)}</span>
    <h2 class="cd-biz">${esc(deal.business)}</h2>
    <p class="cd-deal">${esc(deal.deal)}${deal.confidence === 'low' ? help('Hard to read on the paper card; this is the best guess.') : ''}</p>
    <div class="cd-facts">
      <p class="cd-fact"><span class="cd-k">Left</span><span class="cd-left${left <= 0 ? ' is-out' : ''}">${leftLabel(left)}</span></p>
      ${fact('Code', deal.code, ' is-code')}
      ${fact('Limits', deal.limits)}
      ${fact('Where', deal.where)}
    </div>
    <div class="btn-col">
      <button type="button" class="btn btn-primary" data-use="${esc(deal.id)}"${left <= 0 ? ' disabled' : ''}>Used one</button>
      ${undo ? `<button type="button" class="btn" data-undo="${esc(deal.id)}">Undo last use</button>` : ''}
    </div>
  </div>`;
}

/* ---------------- actions ---------------- */

function markUsed(ctx, deal) {
  if (!ctx.S.info.uid) { flash('Not connected yet.'); return false; }
  const left = usesLeft(deal, uses(ctx)) - 1;      // before saving: the watch may update S.sscUses right away
  if (left < 0) return false;
  try {
    ctx.backend.saveListItem('sscUses', { id: ctx.backend.newListId('sscUses'), ...useRow(deal.id, todayYMD()) });
  } catch (err) { flash(ctx.backend.friendlyError(err)); return false; }
  flash(left === Infinity ? 'Marked used.' : `Marked used. ${leftLabel(left)}.`);
  return true;
}

function undoUse(ctx, deal) {
  if (!ctx.S.info.uid) { flash('Not connected yet.'); return false; }
  const u = lastUse(deal.id, uses(ctx));
  if (!u) return false;
  try { ctx.backend.deleteListItem('sscUses', u.id); } catch (err) { flash(ctx.backend.friendlyError(err)); return false; }
  flash('Use undone.');
  return true;
}

function bindDetail(el, ctx, after) {
  const find = (id) => st.deals.find((d) => d.id === id);
  el.querySelectorAll('[data-use]').forEach((b) => { b.onclick = () => { if (markUsed(ctx, find(b.dataset.use))) after(); }; });
  el.querySelectorAll('[data-undo]').forEach((b) => { b.onclick = () => { if (undoUse(ctx, find(b.dataset.undo))) after(); }; });
}

// Phone: the shared editor shows the whole deal.
function openDeal(ctx, deal) {
  openEditor(`<header class="editor-head">
      <span class="cd-head-gap"></span>
      <h2>Card deal</h2>
      <button type="button" class="link-btn strong" data-cancel>Done</button>
    </header>
    <div class="form narrow cd-ed">${detailHtml(deal, ctx)}</div>`, (wrap) => {
    bindDetail(wrap, ctx, () => closeEditor());
  });
}

/* ---------------- screen ---------------- */

// Fills the list (and, on a laptop, the side panel). Typing calls this directly so the search box never re-renders.
function paint(root, ctx) {
  const list = rows(ctx);
  const known = st.sel && st.deals.find((d) => d.id === st.sel);
  const shown = known || (list[0] && list[0].deal) || null;
  root.querySelector('.cd-list').innerHTML = listHtml(list, wide() && shown ? shown.id : null);
  const panel = root.querySelector('.cd-detail');
  panel.innerHTML = detailHtml(shown, ctx);
  bindDetail(panel, ctx, () => {});
  root.querySelectorAll('.cd-row').forEach((b) => {
    b.onclick = () => {
      const deal = st.deals.find((d) => d.id === b.dataset.id);
      if (!deal) return;
      if (wide()) { st.sel = deal.id; paint(root, ctx); } else openDeal(ctx, deal);
    };
  });
}

export default {
  key: 'card',
  title: 'Card',
  sub: true,
  render(ctx) {
    const { S } = ctx;
    load(ctx);
    if (!st.deals) {
      return `${topbar('Card', '', true)}${banner(S.info)}<div class="pane"><p class="empty">${st.loadErr ? 'Can\'t load the card right now.' : 'Loading…'}</p></div>`;
    }
    const t = totals(st.deals, uses(ctx));
    const chip = (v, label) => `<button type="button" class="cd-chip" data-sec="${esc(v || '')}" aria-pressed="${st.section === v}">${esc(label)}</button>`;
    return `${topbar('Card', '', true)}${banner(S.info)}
      <div class="pane cd-pane">
        <div class="cd-browse">
          <div class="cd-top">
            <span class="cd-count">${t.deals} deals · ${t.uses} uses left</span>
            <label class="cd-hide"><span>Hide used</span><input type="checkbox" class="switch" id="cd-hide" data-nokeep${st.hideUsed ? ' checked' : ''}></label>
          </div>
          <input type="search" class="cd-q" id="cd-q" data-nokeep placeholder="Search" aria-label="Search deals" value="${esc(st.q)}" autocomplete="off">
          <div class="cd-chips">${chip(null, 'All')}${sections(st.deals).map((s) => chip(s, s)).join('')}</div>
          <div class="cd-list list"></div>
        </div>
        <aside class="cd-detail"></aside>
      </div>`;
  },
  bind(root, ctx) {
    if (!st.deals) return;
    paint(root, ctx);
    const list = root.querySelector('.cd-list');
    list.scrollTop = st.scroll;
    list.onscroll = () => { st.scroll = list.scrollTop; };
    const top = () => { st.scroll = 0; list.scrollTop = 0; };
    const q = root.querySelector('#cd-q');
    q.oninput = () => { st.q = q.value; paint(root, ctx); top(); };
    root.querySelector('#cd-hide').onchange = (e) => { st.hideUsed = e.target.checked; paint(root, ctx); top(); };
    root.querySelectorAll('[data-sec]').forEach((b) => {
      b.onclick = () => {
        st.section = b.dataset.sec || null;
        root.querySelectorAll('[data-sec]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        paint(root, ctx);
        top();
      };
    });
  },
};
