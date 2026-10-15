// Build an iCalendar (RFC 5545) file for one important date, so iPhone
// Calendar can do the reminding. Pure: tested in Node.
import { parseYMD } from './dates.js';

// TEXT escaping (RFC 5545 3.3.11): backslash, semicolon, comma, newline.
export function escapeText(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// Lines longer than 75 octets are folded: CRLF + one space (RFC 5545 3.1).
// Counts UTF-8 bytes and never splits a character.
export function foldLine(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (bytes + b > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

function dateValue({ y, m, d }) {
  return `${pad(y, 4)}${pad(m)}${pad(d)}`;
}

function utcStamp(t) {
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}Z`;
}

function nextDay({ y, m, d }) {
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

// item: {id, title, date 'YYYY-MM-DD', yearly, notes}. now: Date for DTSTAMP.
export function buildIcs(item, now = new Date()) {
  const p = parseYMD(item.date);
  if (!p) throw new Error('Bad date: ' + item.date);
  const title = item.title || 'Important date';
  const L = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Perfect Boyfriend//Dates//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${item.id || 'date-' + dateValue(p)}@perfect-boyfriend`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;VALUE=DATE:${dateValue(p)}`,
    `DTEND;VALUE=DATE:${dateValue(nextDay(p))}`,
  ];
  if (item.yearly) {
    // A plain yearly rule skips Feb 29 in non-leap years; last-day-of-February
    // keeps it every year (Feb 28, or Feb 29 in leap years).
    L.push(p.m === 2 && p.d === 29 ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY');
  }
  L.push(`SUMMARY:${escapeText(title)}`);
  if (item.notes) L.push(`DESCRIPTION:${escapeText(item.notes)}`);
  L.push('TRANSP:TRANSPARENT');
  // All-day events start at midnight; these fire at 9 AM a week and a day before.
  for (const [trigger, when] of [['-P6DT15H', 'in 1 week'], ['-PT15H', 'tomorrow']]) {
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(title + ' ' + when)}`, `TRIGGER:${trigger}`, 'END:VALARM');
  }
  L.push('END:VEVENT', 'END:VCALENDAR');
  return L.map(foldLine).join('\r\n') + '\r\n';
}

export function icsFileName(item) {
  const slug = String(item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return (slug || 'date') + '.ics';
}
