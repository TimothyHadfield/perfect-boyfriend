// Plan sharing (pure; no DOM). Tested in tests/share.test.mjs.
// planStops(plan) -> [{id, name, at, end, place, deal?, home}] from a plan (js/logic/plan.js).
// savedRow(plan)  -> a `savedPlans` row: { title, date, at, stops: [{id, name, at, deal?}], total, driveMins }.
// shareText(plan) -> a short text for her: day, times, places, what to wear. No prices, no card.
// buildPlanIcs(plan, now) -> an .ics with one event per stop and one alarm 2 hours before the first.
import { escapeText, foldLine } from './ics.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n, w = 2) => String(n).padStart(w, '0');

// Minutes after midnight -> 'HH:MM' (24 h).
export function hhmm(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function parseYMD(s) {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(s || ''));
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

const cleanDeal = (t) => String(t || '').replace(/!+/g, '').replace(/\s+/g, ' ').trim();

export function planStops(plan) {
  return (plan.items || []).map((x) => {
    const s = x.stop;
    const out = {
      id: s.id, name: s.short || s.name, at: hhmm(x.start), end: hhmm(x.end),
      place: s.home ? 'Home' : [s.name, s.city, 'UT'].filter(Boolean).join(', '), home: !!s.home,
    };
    if (x.deal) out.deal = cleanDeal(x.deal.text).slice(0, 120);
    return out;
  });
}

export function savedRow(plan, title) {
  const stops = planStops(plan).map(({ id, name, at, deal }) => (deal ? { id, name, at, deal } : { id, name, at }));
  const t = String(title || stops.map((s) => s.name).join(' + '));
  return {
    title: t.length > 120 ? t.slice(0, 117) + '…' : t,
    date: plan.ymd,
    at: stops.length ? stops[0].at : '18:00',
    stops, total: plan.total, driveMins: plan.drive,
  };
}

// Same day and same stops in the same order.
export function sameStops(row, plan) {
  if (!row || !plan || row.date !== plan.ymd || !Array.isArray(row.stops)) return false;
  const ids = (plan.items || []).map((x) => x.stop.id);
  return row.stops.length === ids.length && row.stops.every((s, i) => s && s.id === ids[i]);
}

// The saved plan for a day (the newest if there are several).
export function savedFor(rows, ymd) {
  const list = (rows || []).filter((r) => r && r.date === ymd && Array.isArray(r.stops) && r.stops.length);
  return list.length ? list[list.length - 1] : null;
}

// 'h:mm AM' the first time and whenever AM/PM flips; 'h:mm' otherwise.
function clock(min, prev) {
  const h = Math.floor(min / 60) % 24, mm = min % 60;
  const ap = h < 12 ? 'AM' : 'PM';
  const t = `${h % 12 || 12}:${pad(mm)}`;
  return { text: prev === ap ? t : `${t} ${ap}`, ap };
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export function shareText(plan) {
  const p = parseYMD(plan.ymd);
  const day = p ? DAY_NAMES[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()] : '';
  let ap = null;
  const parts = (plan.items || []).map((x, i) => {
    const c = clock(((Math.round(x.start) % 1440) + 1440) % 1440, ap);
    ap = c.ap;
    const s = x.stop;
    let name = String(s.short || s.name || '').replace(/\bSSC\b/gi, '').replace(/\s+/g, ' ').trim();
    if (s.home && !/home/i.test(name)) name += ' at home';
    return i === 0 ? `${day ? day + ' ' : ''}${c.text}: ${name}` : `${c.text} ${name}`;
  });
  let text = parts.join(' → ');
  const wear = String(plan.wear || '').split(' · ').map((w) => w.trim()).filter(Boolean).map(lowerFirst).join(', ');
  if (wear) text += `${text ? '. ' : ''}Wear: ${wear}`;
  return text.replace(/\$\d+/g, '').replace(/\bSSC\b/gi, '').replace(/ {2,}/g, ' ').trim();
}

function utcStamp(t) {
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}Z`;
}

// Local (floating) time on the plan's date; minutes past midnight roll into the next day.
function localStamp(p, min) {
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d) + Math.round(min) * 60000);
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
}

export function buildPlanIcs(plan, now = new Date()) {
  const p = parseYMD(plan.ymd);
  if (!p) throw new Error('Bad date: ' + plan.ymd);
  const stops = planStops(plan);
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Perfect Boyfriend//Plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const base = `${plan.ymd.replace(/-/g, '')}-${String(plan.key || 'plan').replace(/[^a-z0-9>-]/gi, '').replace(/>/g, '.')}`.slice(0, 120);
  stops.forEach((s, i) => {
    const start = plan.items[i].start;
    let end = plan.items[i].end;
    if (!(end > start)) end = start + 30;
    L.push('BEGIN:VEVENT',
      `UID:${base}-${i}@perfect-boyfriend`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${localStamp(p, start)}`,
      `DTEND:${localStamp(p, end)}`,
      `SUMMARY:${escapeText(s.name)}`,
      `LOCATION:${escapeText(s.place)}`);
    if (s.deal) L.push(`DESCRIPTION:${escapeText('Card deal: ' + s.deal)}`);
    if (i === 0) {
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText('Date at ' + clock(start % 1440, null).text + ': ' + s.name)}`,
        'TRIGGER:-PT2H', 'END:VALARM');
    }
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(foldLine).join('\r\n') + '\r\n';
}

export function planIcsName(plan) {
  return `date-${plan.ymd}.ics`;
}
