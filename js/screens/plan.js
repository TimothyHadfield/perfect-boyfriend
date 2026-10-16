// Plan: the Orem date planner (the center hub tab).
// Builds cheap, close-together plans from data/plan-stops.json + Tim's SSC card deals.
// "We did this" saves a dateLog row (with stopIds) and one sscUses row per card deal used.
// Also loads data/drive-times.json (road times) and the Open-Meteo forecast (js/logic/weather.js); both optional.
// Auto plans learn from S.dateLog (skip recent and 'meh' stops, favor 'loved'); Tim's plans are never filtered.
// Save (bookmark) keeps one `savedPlans` row per day; picking that day shows the saved plan until Shuffle.
// The ... menu: Calendar (.ics, one event per stop) and Send (text for her via the share sheet or clipboard).
// Owns the `savedPlans` subscription (S.savedPlans). Contract: see the top of js/app.js. Styles: css/plan.css.
// Logic: js/logic/plan.js, js/logic/share.js.
import { esc, svg, topbar, banner, help, flash } from '../ui.js';
import {
  OREM, VIBES, TIM_PLANS, dayName, fmtTime, makePlan, planFromStops, swapStop, weekAhead, defaultDay,
  mapsUrl, appleMapsUrl, logRows, dealLabel, stopPoint, driveTable, toMin,
} from '../logic/plan.js';
import { getForecast, badWeather, wxKind } from '../logic/weather.js';
import { savedRow, sameStops, savedFor, shareText, buildPlanIcs, planIcsName, hhmm } from '../logic/share.js';

const ICON = {
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  shuffle: '<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.6M13 9.6C13.9 8.1 14.9 7 16.5 7H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>',
  map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4zM9 4v14M15 6v14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  partly: '<path d="M8.5 4.5v1.2M3.8 9.2H5M5.2 5.9l.9.9M12.3 6.6a3.6 3.6 0 0 0-6.1 3.1"/><path d="M8 19.5h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.3A2.9 2.9 0 0 0 8 19.5z"/>',
  cloud: '<path d="M7 18.5h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18.5z"/>',
  fog: '<path d="M7 14.5h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 14.5zM5 18h14M8 21h8"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15zM8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>',
  snow: '<path d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15zM8 19h.01M12 18h.01M16 19h.01M10 21.5h.01M14 21.5h.01"/>',
  storm: '<path d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15zM12.5 15l-2 3.5h3l-2 3.5"/>',
  save: '<path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4.2-6 4.2v-16a1 1 0 0 1 1-1z"/>',
  more: '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="3.2"/>',
  send: '<path d="M12 14.5v-11M8 7.5l4-4 4 4M8.5 10.5H6v10h12v-10h-2.5"/>',
};
const ico = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

// The Starving Student Card screen (#/card). ui.js has no card icon, so it's a text label.
const CARD_LINK = '<a class="link-btn pl-card-link" href="#/card">Card</a>';

const BUDGETS =[[10, '$10'], [20, '$20'], [30, '$30'], [50, '$50'], [null, 'Any']];

const st = {
  stops: null, loadErr: false, loading: false,
  ymd: null, start: '18:00', budget: 20, vibe: 'any', origin: OREM, seed: 1,
  preset: null,         // key of one of Tim's plans while it's shown
  plan: null, sig: '', usesSeen: -1,
  swapEx: {},           // stop index -> ids already shown there
  logged: {},           // plan key + date -> true after "We did this"
  times: null,          // road drive times (data/drive-times.json), or null -> estimates
  wx: null,             // forecast by 'YYYY-MM-DD', or null (offline)
  mine: new Set(),      // dateLog ids saved here this session (so logging doesn't reshuffle the plan)
  pinned: null,         // a fixed plan shown for a day: {ymd, ids, at} (the saved plan, or one just saved)
  pinCheck: null,       // the day whose saved plan was last looked up
  more: false,          // the ... menu is open
};

const getJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });

const RETRY_MS = 30000;   // after a failed load, wait this long before a later render tries again

function load(ctx) {
  if (st.stops || st.loading || typeof document === 'undefined') return;   // not in a browser (tests)
  if (st.loadErr && Date.now() - st.failedAt < RETRY_MS) return;          // the re-render after a failure must not refetch at once
  st.loading = true;
  // The forecast gets a short head start so the first plan can use it; if it's slow, it fills in later.
  const wx = getForecast().then((d) => { st.wx = d; return d; });
  Promise.all([
    getJson('data/plan-stops.json'),
    getJson('data/drive-times.json').then(driveTable).catch((err) => { console.warn('drive times', err); return null; }),
    Promise.race([wx, new Promise((r) => setTimeout(r, 1500))]),
  ])
    .then(([j, times]) => { st.stops = j.stops; st.times = times; })
    .catch((err) => { console.warn('plan stops', err); st.loadErr = true; st.failedAt = Date.now(); })
    .finally(() => { st.loading = false; ctx.render(); wx.then(() => ctx.render()); });
}

const wxFor = (ymd) => (st.wx && st.wx[ymd]) || null;

// dateLog as the planner sees it, plus a short signature of it (rows logged on this screen don't count,
// so "We did this" doesn't swap the plan you just logged).
function history(ctx) {
  const rows = (ctx.S.dateLog || []).filter((r) => !st.mine.has(r.id));
  return { rows, sig: rows.map((r) => `${r.id}:${r.date}:${r.rating || ''}`).join(',') };
}

const byId = (id) => st.stops.find((s) => s.id === id);

function week() { return weekAhead(new Date()); }

function opts(ctx, w) {
  const d = w.find((x) => x.ymd === st.ymd) || w[0];
  return {
    day: d.day, month: d.month, start: st.start, budget: st.budget, vibe: st.vibe,
    origin: st.origin, seed: st.seed, sscUses: ctx.S.sscUses || [],
    times: st.times, weather: wxFor(d.ymd), history: history(ctx).rows, ymd: d.ymd,
  };
}

// Tim's plan as a plan, on its own weekday (the next one within the week). Never filtered by history or weather.
function presetPlan(t, ctx, w) {
  const d = w.find((x) => x.day === t.day) || w[0];
  const p = planFromStops(t.stops.map(byId), {
    day: t.day, month: d.month, firstAt: t.at, origin: st.origin, sscUses: ctx.S.sscUses || [], times: st.times, weather: wxFor(d.ymd),
  });
  return p && { ...p, ymd: d.ymd, name: t.name };
}

function currentPlan(ctx, w) {
  if (st.preset) {
    const t = TIM_PLANS.find((x) => x.key === st.preset);
    return t ? presetPlan(t, ctx, w) : null;
  }
  const o = opts(ctx, w);
  const pin = st.pinned && st.pinned.ymd === st.ymd ? st.pinned : null;
  const pinStops = pin ? pin.ids.map(byId) : [];
  if (pin && pinStops.length && pinStops.every(Boolean)) {
    const p = planFromStops(pinStops, { ...o, firstAt: pin.at });
    if (p) return { ...p, ymd: st.ymd, pinned: true };
  }
  // Weather only reshapes the plan when it turns bad; a nicer forecast just updates what to wear.
  const wet = !!o.weather && badWeather(o.weather, toMin(o.start));
  const sig = JSON.stringify([st.ymd, o.start, o.budget, o.vibe, o.origin.lat, o.origin.lng, o.seed, wet, history(ctx).sig]);
  const uses = (ctx.S.sscUses || []).length;
  if (sig !== st.sig) {
    st.sig = sig;
    st.swapEx = {};
    st.plan = makePlan(st.stops, o);
  } else if (st.plan && (uses !== st.usesSeen || st.plan.weather !== o.weather)) {
    // A use was logged or the forecast came in: keep the same stops, refresh deals, uses left and what to wear.
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

function controls(plan) {
  const t = st.preset && TIM_PLANS.find((x) => x.key === st.preset);
  const shown = t ? t.at : plan && plan.pinned ? hhmm(plan.start) : st.start;   // a saved plan: when you leave
  const timeOk = /^\d\d:\d\d$/.test(shown) ? shown : '18:00';
  return `<div class="pl-opts">
    <label class="pl-opt"><small>Start</small><input id="pl-start" data-nokeep type="time" value="${esc(timeOk)}"></label>
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
  const fixed = st.preset || plan.pinned;
  const from = st.origin === OREM ? 'Orem' : 'start';
  return `<ol class="pl-tl">${plan.items.map((x, i) => {
    const s = x.stop;
    const wait = x.wait > 4 ? ` · ${x.wait} min early` : '';
    const drive = x.drive ? `${x.drive} min drive${x.est ? ' (est.)' : ''}${i === 0 ? ' from ' + from : ''}${wait}` : (i === 0 ? '' : `Same place${wait}`);
    const left = x.deal && x.deal.left !== Infinity ? ` · ${x.deal.left} left` : '';
    const sub = x.deal ? `${esc(dealLabel(x.deal.text))}${left}` : esc(s.home ? 'At home' : s.city || '');
    const name = s.home ? `<span class="pl-name">${esc(s.short || s.name)}</span>`
      : `<a class="pl-name" href="${esc(appleMapsUrl(s))}" target="_blank" rel="noopener">${esc(s.short || s.name)}</a>`;
    return `${drive ? `<li class="pl-drive">${esc(drive)}</li>` : ''}
      <li class="pl-stop">
        <span class="pl-time">${fmtTime(x.start).replace(' ', '<small>')}</small></span>
        <span class="pl-mid">${name}<span class="pl-sub${x.deal ? ' has-deal' : ''}">${sub}</span></span>
        <span class="pl-cost">$${x.price}</span>
        ${fixed ? '' : `<button type="button" class="icon-btn small pl-swap" data-swap="${i}" aria-label="Swap ${esc(s.short || s.name)}">${ico('swap')}</button>`}
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
  const wx = plan.weather;
  const kind = wx && wxKind(wx.code);
  const saved = (ctx.S.savedPlans || []).some((r) => sameStops(r, plan));
  return `<div class="pl-main">
    <div class="pl-sum">
      <span><strong>$${plan.total}</strong> total</span><span class="pl-dot">·</span><span><strong>${plan.drive} min</strong> ${plan.driveEst ? 'est. ' : ''}driving</span>
      ${plan.over ? '<span class="pl-over">over budget</span>' : ''}
      ${help('For two, after card deals. Drives are road routes plus parking; "est." is a straight-line guess. Bad weather favors indoor stops.')}
      ${st.preset ? `<span class="pl-preset-tag">${esc(plan.name)}</span>` : ''}
      ${wx ? `<span class="pl-wx" aria-label="Forecast high ${wx.hi}°, low ${wx.lo}°">${ico(kind)}${wx.hi}°</span>` : ''}
      <button type="button" class="icon-btn small pl-save" id="pl-save" aria-pressed="${saved}" aria-label="${saved ? 'Saved plan' : 'Save plan'}">${ico('save')}</button>
    </div>
    <div class="pl-body">${timeline(plan)}${miniMap(plan)}</div>
    <div class="pl-bw">
      <p><span class="pl-k">Bring</span>${esc(plan.bring.length ? plan.bring.join(', ') : 'Nothing special')}</p>
      <p><span class="pl-k">Wear</span>${esc(plan.wear)}</p>
      ${plan.talk ? `<p class="pl-talk"><span class="pl-k">Talk</span><span>${esc(plan.talk)}</span></p>` : ''}
    </div>
    <div class="btn-row pl-actions">
      <button type="button" class="btn" id="pl-shuffle">${ico('shuffle')}${st.preset ? 'New plan' : 'Shuffle'}</button>
      ${maps ? `<a class="btn" href="${esc(maps)}" target="_blank" rel="noopener">${ico('map')}Maps</a>` : ''}
      <span class="pl-more">
        <button type="button" class="btn pl-more-btn" id="pl-more" aria-label="More" aria-expanded="${st.more}">${ico('more')}</button>
        ${st.more ? `<span class="pl-menu" role="menu">
          <button type="button" role="menuitem" id="pl-ics">${svg('cal')}Add to Calendar</button>
          <button type="button" role="menuitem" id="pl-send">${ico('send')}Send to her</button>
        </span>` : ''}
      </span>
      <button type="button" class="btn btn-primary" id="pl-did"${done ? ' disabled' : ''}>${done ? ico('check') + 'Logged' : 'We did this'}</button>
    </div>
  </div>`;
}

/* ---------------- calendar, send ---------------- */

function downloadPlanIcs(plan) {
  const url = URL.createObjectURL(new Blob([buildPlanIcs(plan, new Date())], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = planIcsName(plan);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// The share sheet when there is one (iPhone); otherwise the clipboard and a toast.
function sendPlan(text) {
  if (navigator.share) {
    navigator.share({ text }).catch((err) => { if (err && err.name !== 'AbortError') copyText(text); });
    return;
  }
  copyText(text);
}

function copyText(text) {
  const done = () => flash('Plan copied. Paste it to her.');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => flash('Can\'t copy here.'));
  } else flash('Can\'t copy here.');
}

// Tapping anywhere outside the ... menu closes it.
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    if (!st.more || (e.target.closest && e.target.closest('.pl-more'))) return;
    st.more = false;
    const m = document.querySelector('.pl-menu');
    if (m) m.remove();
    const b = document.getElementById('pl-more');
    if (b) b.setAttribute('aria-expanded', 'false');
  });
}

/* ---------------- screen ---------------- */

export default {
  key: 'plan',
  title: 'Plan',
  subscribe(ctx) {
    ctx.S.savedPlans = [];
    ctx.S.savedPlansLoaded = false;
    st.pinned = null;
    st.pinCheck = null;
    return [
      ctx.backend.watchList('sscUses', (list) => { ctx.S.sscUses = list; ctx.render(); }),
      ctx.backend.watchList('savedPlans', (list) => { ctx.S.savedPlans = list; ctx.S.savedPlansLoaded = true; ctx.render(); }),
    ];
  },
  render(ctx) {
    const { S } = ctx;
    load(ctx);
    const w = week();
    if (!st.ymd || !w.find((d) => d.ymd === st.ymd)) st.ymd = defaultDay(w);
    // Picking a day (or opening Plan) shows that day's saved plan, if there is one.
    if (S.savedPlansLoaded && st.pinCheck !== st.ymd) {
      st.pinCheck = st.ymd;
      const sv = savedFor(S.savedPlans, st.ymd);
      st.pinned = sv ? { ymd: sv.date, ids: sv.stops.map((s) => s.id), at: sv.at } : null;
    }
    if (!st.stops) {
      return `${topbar('Plan', CARD_LINK)}${banner(S.info)}<div class="pane"><p class="empty">${st.loadErr ? 'Can\'t load the date spots right now.' : 'Loading…'}</p></div>`;
    }
    const plan = currentPlan(ctx, w);
    const selDay = st.preset && plan ? plan.ymd : st.ymd;
    return `${topbar('Plan', CARD_LINK)}${banner(S.info)}
      <div class="pane pl-pane">
        <div class="pl-side">
          ${dayChips(w, selDay)}
          ${controls(plan)}
          ${timList(ctx, w)}
        </div>
        ${planView(plan, ctx)}
      </div>`;
  },
  bind(root, ctx) {
    if (!st.stops) return;
    const redraw = () => ctx.render();
    root.querySelectorAll('[data-day]').forEach((b) => {
      b.onclick = () => { st.ymd = b.dataset.day; st.preset = null; st.pinned = null; st.pinCheck = null; st.more = false; redraw(); };
    });
    const start = root.querySelector('#pl-start');
    if (start) start.onchange = () => { if (/^\d\d:\d\d$/.test(start.value)) { st.start = start.value; st.preset = null; st.pinned = null; redraw(); } };
    const budget = root.querySelector('#pl-budget');
    if (budget) budget.onchange = () => { st.budget = budget.value === '' ? null : +budget.value; st.preset = null; st.pinned = null; redraw(); };
    const vibe = root.querySelector('#pl-vibe');
    if (vibe) vibe.onchange = () => { st.vibe = vibe.value; st.preset = null; st.pinned = null; redraw(); };
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
      st.pinned = null;
      st.more = false;
      redraw();
    };
    const save = root.querySelector('#pl-save');
    if (save) save.onclick = () => {
      const plan = currentPlan(ctx, week());
      if (!plan) return;
      if (!ctx.S.info.uid) { flash('Not connected yet.'); return; }
      const rows = ctx.S.savedPlans || [];
      const mine = rows.find((r) => sameStops(r, plan));
      const ids = plan.items.map((x) => x.stop.id);
      try {
        if (mine) {
          ctx.backend.deleteListItem('savedPlans', mine.id);
          // Keep showing the same stops; Shuffle or another day moves on.
          if (!st.preset) st.pinned = { ymd: plan.ymd, ids, at: savedRow(plan).at };
          flash('Unsaved.');
        } else {
          const old = savedFor(rows, plan.ymd);       // one saved plan per day: replace it
          const id = old ? old.id : ctx.backend.newListId('savedPlans');
          const row = savedRow(plan, st.preset ? plan.name : undefined);
          ctx.backend.saveListItem('savedPlans', { id, ...row });
          if (!st.preset) { st.pinned = { ymd: plan.ymd, ids, at: row.at }; st.pinCheck = plan.ymd; }
          flash(old ? `Saved. Replaces ${dayName(plan.day)}'s other plan.` : 'Saved.');
        }
      } catch (err) { flash(ctx.backend.friendlyError(err)); return; }
      redraw();
    };
    const more = root.querySelector('#pl-more');
    if (more) more.onclick = () => { st.more = !st.more; redraw(); };
    const ics = root.querySelector('#pl-ics');
    if (ics) ics.onclick = () => {
      st.more = false;
      const plan = currentPlan(ctx, week());
      if (plan) downloadPlanIcs(plan);
      redraw();
    };
    const send = root.querySelector('#pl-send');
    if (send) send.onclick = () => {
      st.more = false;
      const plan = currentPlan(ctx, week());
      if (plan) sendPlan(shareText(plan));      // first, while the tap still counts as a user gesture
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
        const id = ctx.backend.newListId('dateLog');
        st.mine.add(id);
        ctx.backend.saveListItem('dateLog', { id, ...rows.dateLog });
        for (const u of rows.sscUses) ctx.backend.saveListItem('sscUses', { id: ctx.backend.newListId('sscUses'), ...u });
      } catch (err) { flash(ctx.backend.friendlyError(err)); return; }
      st.logged[plan.key + '@' + plan.ymd] = true;
      flash(rows.sscUses.length ? `Logged. ${rows.sscUses.length} card ${rows.sscUses.length === 1 ? 'use' : 'uses'} marked.` : 'Logged.');
      redraw();
    };
  },
};
