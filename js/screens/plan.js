// Plan: the Orem date planner (the center hub tab).
// Builds cheap, close-together plans from data/plan-stops.json + Tim's SSC card deals.
// "We did this" saves a dateLog row and one sscUses row per card deal used.
// Contract: see the top of js/app.js. Styles: css/plan.css. Logic: js/logic/plan.js.
import { esc, svg, topbar, banner, help, flash } from '../ui.js';
import {
  OREM, VIBES, TIM_PLANS, dayName, fmtTime, makePlan, planFromStops, swapStop, weekAhead, defaultDay,
  mapsUrl, appleMapsUrl, logRows, dealLabel, stopPoint,
} from '../logic/plan.js';

const ICON = {
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  shuffle: '<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.6M13 9.6C13.9 8.1 14.9 7 16.5 7H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4zM9 4v14M15 6v14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const ico = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

const BUDGETS = [[10, '$10'], [20, '$20'], [30, '$30'], [50, '$50'], [null, 'Any']];

const st = {
  stops: null, loadErr: false, loading: false,
  ymd: null, start: '18:00', budget: 20, vibe: 'any', origin: OREM, seed: 1,
  preset: null,         // key of one of Tim's plans while it's shown
  plan: null, sig: '', usesSeen: -1,
  swapEx: {},           // stop index -> ids already shown there
  logged: {},           // plan key + date -> true after "We did this"
};

function load(ctx) {
  if (st.stops || st.loading || typeof document === 'undefined') return;   // not in a browser (tests)
  st.loading = true;
  fetch('data/plan-stops.json')
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((j) => { st.stops = j.stops; })
    .catch((err) => { console.warn('plan stops', err); st.loadErr = true; })
    .finally(() => { st.loading = false; ctx.render(); });
}

const byId = (id) => st.stops.find((s) => s.id === id);

function week() { return weekAhead(new Date()); }

function opts(ctx, w) {
  const d = w.find((x) => x.ymd === st.ymd) || w[0];
  return {
    day: d.day, month: d.month, start: st.start, budget: st.budget, vibe: st.vibe,
    origin: st.origin, seed: st.seed, sscUses: ctx.S.sscUses || [],
  };
}

// Tim's plan as a plan, on its own weekday (the next one within the week).
function presetPlan(t, ctx, w) {
  const d = w.find((x) => x.day === t.day) || w[0];
  const p = planFromStops(t.stops.map(byId), { day: t.day, month: d.month, firstAt: t.at, origin: st.origin, sscUses: ctx.S.sscUses || [] });
  return p && { ...p, ymd: d.ymd, name: t.name };
}

function currentPlan(ctx, w) {
  if (st.preset) {
    const t = TIM_PLANS.find((x) => x.key === st.preset);
    return t ? presetPlan(t, ctx, w) : null;
  }
  const o = opts(ctx, w);
  const sig = JSON.stringify([st.ymd, o.start, o.budget, o.vibe, o.origin.lat, o.origin.lng, o.seed]);
  const uses = (ctx.S.sscUses || []).length;
  if (sig !== st.sig) {
    st.sig = sig;
    st.swapEx = {};
    st.plan = makePlan(st.stops, o);
  } else if (uses !== st.usesSeen && st.plan) {
    // A use was logged: keep the same stops, refresh the deals and uses left.
    st.plan = planFromStops(st.plan.items.map((x) => x.stop), o) || makePlan(st.stops, o);
  }
  st.usesSeen = uses;
  return st.plan && { ...st.plan, ymd: st.ymd };
}

/* ---------------- pieces ---------------- */

function dayChips(w, sel) {
  return `<div class="seg pl-days" role="radiogroup" aria-label="Day">${w.map((d) =>
    `<button type="button" role="radio" aria-checked="${d.ymd === sel}" data-day="${d.ymd}"><small>${dayName(d.day)}</small>${d.date}</button>`).join('')}</div>`;
}

function controls() {
  const timeOk = /^\d\d:\d\d$/.test(st.start) ? st.start : '18:00';
  return `<div class="pl-opts">
    <label class="pl-opt"><small>Start</small><input id="pl-start" type="time" value="${esc(timeOk)}"></label>
    <label class="pl-opt"><small>Budget</small><select id="pl-budget">${BUDGETS.map(([v, n]) =>
      `<option value="${v == null ? '' : v}"${v === st.budget ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="pl-opt"><small>Vibe</small><select id="pl-vibe">${VIBES.map(([v, n]) =>
      `<option value="${v}"${v === st.vibe ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <button type="button" class="pl-opt pl-near" id="pl-near" aria-pressed="${st.origin !== OREM}"><small>From</small><span>${svg('plan')}${st.origin === OREM ? 'Orem' : 'Near me'}</span></button>
  </div>`;
}

function timList(ctx, w) {
  return `<div class="pl-tim">
    <span class="sec-head">Tim's plans</span>
    <div class="pl-tim-list">${TIM_PLANS.map((t) => {
      const p = presetPlan(t, ctx, w);
      return `<button type="button" class="pl-chip" data-preset="${t.key}" aria-pressed="${st.preset === t.key}">
        <span class="pl-chip-name">${esc(t.name)}</span><span class="pl-chip-sub">${dayName(t.day)}${p ? ` · $${p.total} · ${p.drive} min` : ''}</span></button>`;
    }).join('')}</div>
  </div>`;
}

function timeline(plan) {
  const from = st.origin === OREM ? 'Orem' : 'start';
  return `<ol class="pl-tl">${plan.items.map((x, i) => {
    const s = x.stop;
    const wait = x.wait > 4 ? ` · ${x.wait} min early` : '';
    const drive = x.drive ? `${x.drive} min drive${i === 0 ? ' from ' + from : ''}${wait}` : (i === 0 ? '' : `Same place${wait}`);
    const left = x.deal && x.deal.left !== Infinity ? ` · ${x.deal.left} left` : '';
    const sub = x.deal ? `${esc(dealLabel(x.deal.text))}${left}` : esc(s.home ? 'At home' : s.city || '');
    const name = s.home ? `<span class="pl-name">${esc(s.short || s.name)}</span>`
      : `<a class="pl-name" href="${esc(appleMapsUrl(s))}" target="_blank" rel="noopener">${esc(s.short || s.name)}</a>`;
    return `${drive ? `<li class="pl-drive">${esc(drive)}</li>` : ''}
      <li class="pl-stop">
        <span class="pl-time">${fmtTime(x.start).replace(' ', '<small>')}</small></span>
        <span class="pl-mid">${name}<span class="pl-sub${x.deal ? ' has-deal' : ''}">${sub}</span></span>
        <span class="pl-cost">$${x.price}</span>
        ${st.preset ? '' : `<button type="button" class="icon-btn small pl-swap" data-swap="${i}" aria-label="Swap ${esc(s.short || s.name)}">${ico('swap')}</button>`}
      </li>`;
  }).join('')}</ol>`;
}

// Laptop: a small sketch of where the stops are (north up), numbered in order.
function miniMap(plan) {
  const pts = [{ ...st.origin, label: st.origin === OREM ? 'Orem' : 'Start', start: true }]
    .concat(plan.items.filter((x) => !x.stop.home).map((x, i) => ({ ...stopPoint(x.stop, st.origin), label: x.stop.short || x.stop.name, n: plan.items.indexOf(x) + 1 })));
  const k = Math.cos(40.3 * Math.PI / 180);
  const xs = pts.map((p) => p.lng * k), ys = pts.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 0.02);
  const W = 320, H = 220, pad = 34;
  const sc = Math.min((W - 2 * pad) / span, (H - 2 * pad) / span);
  const ox = (W - (maxX - minX) * sc) / 2, oy = (H - (maxY - minY) * sc) / 2;
  const P = pts.map((p, i) => ({ ...p, x: ox + (xs[i] - minX) * sc, y: oy + (ys[i] - minY) * sc }));
  // Stops that sit nearly on top of each other: nudge the later dot and its label down so both read.
  P.forEach((p, i) => { while (P.slice(0, i).some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 22)) p.y += 22; });
  const line = P.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return `<svg class="pl-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map sketch of the stops">
    <polyline points="${line}" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" stroke-dasharray="4 4"/>
    ${P.map((p) => p.start
      ? `<rect x="${p.x - 5}" y="${p.y - 5}" width="10" height="10" rx="2" fill="var(--ink-soft)"/><text x="${p.x - 9}" y="${p.y + 4}" text-anchor="end" class="pl-map-t">${esc(p.label)}</text>`
      : `<circle cx="${p.x}" cy="${p.y}" r="10" fill="var(--accent)"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle" class="pl-map-n">${p.n}</text>
         <text x="${p.x + 14}" y="${p.y + 4}" class="pl-map-t">${esc(p.label)}</text>`).join('')}
  </svg>`;
}

function planView(plan, ctx) {
  if (!plan) {
    return `<div class="pl-main"><p class="empty pl-none">No plan fits this day and time. Try another start time or day.</p></div>`;
  }
  const logKey = plan.key + '@' + plan.ymd;
  const done = st.logged[logKey];
  const maps = mapsUrl(plan, st.origin);
  return `<div class="pl-main">
    <div class="pl-sum">
      <span><strong>$${plan.total}</strong> total</span><span class="pl-dot">·</span><span><strong>${plan.drive} min</strong> driving</span>
      ${plan.over ? '<span class="pl-over">over budget</span>' : ''}
      ${help('Estimated for two, after card deals. Drive times are estimates: straight-line distance x 1.3 at city speed, plus parking.')}
      ${st.preset ? `<span class="pl-preset-tag">${esc(plan.name)}</span>` : ''}
    </div>
    <div class="pl-body">${timeline(plan)}${miniMap(plan)}</div>
    <div class="pl-bw">
      <p><span class="pl-k">Bring</span>${esc(plan.bring.length ? plan.bring.join(', ') : 'Nothing special')}</p>
      <p><span class="pl-k">Wear</span>${esc(plan.wear)}</p>
    </div>
    <div class="btn-row pl-actions">
      <button type="button" class="btn" id="pl-shuffle">${ico('shuffle')}${st.preset ? 'New plan' : 'Shuffle'}</button>
      ${maps ? `<a class="btn" href="${esc(maps)}" target="_blank" rel="noopener">${ico('map')}Maps</a>` : ''}
      <button type="button" class="btn btn-primary" id="pl-did"${done ? ' disabled' : ''}>${done ? ico('check') + 'Logged' : 'We did this'}</button>
    </div>
  </div>`;
}

/* ---------------- screen ---------------- */

export default {
  key: 'plan',
  title: 'Plan',
  subscribe(ctx) {
    return [ctx.backend.watchList('sscUses', (list) => { ctx.S.sscUses = list; ctx.render(); })];
  },
  render(ctx) {
    const { S } = ctx;
    load(ctx);
    const w = week();
    if (!st.ymd || !w.find((d) => d.ymd === st.ymd)) st.ymd = defaultDay(w);
    if (!st.stops) {
      return `${topbar('Plan')}${banner(S.info)}<div class="pane"><p class="empty">${st.loadErr ? 'Can\'t load the date spots right now.' : 'Loading…'}</p></div>`;
    }
    const plan = currentPlan(ctx, w);
    const selDay = st.preset && plan ? plan.ymd : st.ymd;
    return `${topbar('Plan')}${banner(S.info)}
      <div class="pane pl-pane">
        <div class="pl-side">
          ${dayChips(w, selDay)}
          ${controls()}
          ${timList(ctx, w)}
        </div>
        ${planView(plan, ctx)}
      </div>`;
  },
  bind(root, ctx) {
    if (!st.stops) return;
    const redraw = () => ctx.render();
    root.querySelectorAll('[data-day]').forEach((b) => {
      b.onclick = () => { st.ymd = b.dataset.day; st.preset = null; redraw(); };
    });
    const start = root.querySelector('#pl-start');
    if (start) start.onchange = () => { if (/^\d\d:\d\d$/.test(start.value)) { st.start = start.value; st.preset = null; redraw(); } };
    const budget = root.querySelector('#pl-budget');
    if (budget) budget.onchange = () => { st.budget = budget.value === '' ? null : +budget.value; st.preset = null; redraw(); };
    const vibe = root.querySelector('#pl-vibe');
    if (vibe) vibe.onchange = () => { st.vibe = vibe.value; st.preset = null; redraw(); };
    const near = root.querySelector('#pl-near');
    if (near) near.onclick = () => {
      if (st.origin !== OREM) { st.origin = OREM; redraw(); return; }
      if (!navigator.geolocation) { flash('Location isn\'t available here.'); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => { st.origin = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Near me' }; st.preset = null; redraw(); },
        () => flash('Location is off, so plans start from Orem.'),
        { timeout: 10000, maximumAge: 600000 });
    };
    root.querySelectorAll('[data-preset]').forEach((b) => {
      b.onclick = () => { st.preset = st.preset === b.dataset.preset ? null : b.dataset.preset; redraw(); };
    });
    const shuffle = root.querySelector('#pl-shuffle');
    if (shuffle) shuffle.onclick = () => {
      if (st.preset) st.preset = null; else st.seed++;
      redraw();
    };
    root.querySelectorAll('[data-swap]').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.swap;
        if (!st.plan) return;
        const ex = st.swapEx[i] || (st.swapEx[i] = []);
        const curId = st.plan.items[i].stop.id;
        if (!ex.includes(curId)) ex.push(curId);
        const w = week();
        let next = swapStop(st.stops, st.plan, i, opts(ctx, w), ex);
        if (!next && ex.length > 1) {          // went through them all: start over
          st.swapEx[i] = [curId];
          next = swapStop(st.stops, st.plan, i, opts(ctx, w), st.swapEx[i]);
        }
        if (!next) { flash('Nothing else fits there.'); return; }
        st.plan = next;
        redraw();
      };
    });
    const did = root.querySelector('#pl-did');
    if (did) did.onclick = () => {
      const w = week();
      const plan = currentPlan(ctx, w);
      if (!plan) return;
      if (!ctx.S.info.uid) { flash('Not connected yet.'); return; }
      const rows = logRows(plan, plan.ymd);
      try {
        ctx.backend.saveListItem('dateLog', { id: ctx.backend.newListId('dateLog'), ...rows.dateLog });
        for (const u of rows.sscUses) ctx.backend.saveListItem('sscUses', { id: ctx.backend.newListId('sscUses'), ...u });
      } catch (err) { flash(ctx.backend.friendlyError(err)); return; }
      st.logged[plan.key + '@' + plan.ymd] = true;
      flash(rows.sscUses.length ? `Logged. ${rows.sscUses.length} card ${rows.sscUses.length === 1 ? 'use' : 'uses'} marked.` : 'Logged.');
      redraw();
    };
  },
};
