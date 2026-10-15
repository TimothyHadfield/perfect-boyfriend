import { test, eq, ok } from './harness.mjs';
import { buildIcs, escapeText, foldLine, icsFileName } from '../js/logic/ics.js';

const NOW = new Date(Date.UTC(2026, 9, 15, 8, 5, 9)); // 2026-10-15T08:05:09Z

function lines(ics) { return ics.split('\r\n'); }
function unfold(ics) { return ics.replace(/\r\n[ \t]/g, ''); }

test('uses CRLF everywhere and ends with CRLF', () => {
  const ics = buildIcs({ id: 'abc', title: 'Birthday', date: '1999-10-20', yearly: true }, NOW);
  ok(ics.endsWith('\r\n'), 'ends with CRLF');
  ok(!/[^\r]\n/.test(ics), 'no bare LF');
  eq(lines(ics)[0], 'BEGIN:VCALENDAR');
});

test('has the required calendar and event properties', () => {
  const ics = unfold(buildIcs({ id: 'abc', title: 'Birthday', date: '1999-10-20', yearly: true }, NOW));
  for (const must of ['VERSION:2.0', 'PRODID:', 'BEGIN:VEVENT', 'END:VEVENT', 'END:VCALENDAR',
    'UID:abc@perfect-boyfriend', 'DTSTAMP:20261015T080509Z', 'SUMMARY:Birthday']) {
    ok(ics.includes(must), 'missing ' + must);
  }
});

test('all-day event: DATE values and DTEND the next day', () => {
  const ics = buildIcs({ id: 'x', title: 'T', date: '2026-12-31', yearly: false }, NOW);
  ok(ics.includes('DTSTART;VALUE=DATE:20261231\r\n'), 'dtstart');
  ok(ics.includes('DTEND;VALUE=DATE:20270101\r\n'), 'dtend rolls the year');
});

test('yearly repeat only when asked', () => {
  ok(buildIcs({ id: 'x', title: 'T', date: '2020-05-05', yearly: true }, NOW).includes('RRULE:FREQ=YEARLY\r\n'));
  ok(!buildIcs({ id: 'x', title: 'T', date: '2020-05-05', yearly: false }, NOW).includes('RRULE'));
});

test('Feb 29 yearly uses the last day of February so it fires every year', () => {
  const ics = buildIcs({ id: 'x', title: 'Leap', date: '2004-02-29', yearly: true }, NOW);
  ok(ics.includes('RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1\r\n'), ics);
});

test('two alarms: a week before and a day before', () => {
  const ics = buildIcs({ id: 'x', title: 'T', date: '2020-05-05', yearly: true }, NOW);
  eq((ics.match(/BEGIN:VALARM/g) || []).length, 2, 'alarm count');
  eq((ics.match(/END:VALARM/g) || []).length, 2);
  ok(ics.includes('TRIGGER:-P6DT15H\r\n'), '7 days before at 9 AM');
  ok(ics.includes('TRIGGER:-PT15H\r\n'), '1 day before at 9 AM');
  eq((ics.match(/ACTION:DISPLAY/g) || []).length, 2);
});

test('escapes text per RFC 5545', () => {
  eq(escapeText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  eq(escapeText('x\r\ny'), 'x\\ny');
  const ics = unfold(buildIcs({ id: 'x', title: 'Mom, Dad; & me', date: '2020-05-05', yearly: false, notes: 'line1\nline2' }, NOW));
  ok(ics.includes('SUMMARY:Mom\\, Dad\\; & me'), 'summary escaped');
  ok(ics.includes('DESCRIPTION:line1\\nline2'), 'description escaped');
});

test('folds long lines at 75 octets, counting UTF-8 bytes', () => {
  const long = 'SUMMARY:' + 'é'.repeat(100);
  const folded = foldLine(long);
  for (const l of folded.split('\r\n')) ok(Buffer.byteLength(l, 'utf8') <= 75, 'line too long: ' + Buffer.byteLength(l, 'utf8'));
  eq(folded.replace(/\r\n /g, ''), long, 'unfolds back to the original');
  const ics = buildIcs({ id: 'x', title: 'A'.repeat(300), date: '2020-05-05', yearly: false }, NOW);
  for (const l of lines(ics)) ok(Buffer.byteLength(l, 'utf8') <= 75, 'ics line too long');
});

test('no DESCRIPTION line when there are no notes', () => {
  ok(!buildIcs({ id: 'x', title: 'T', date: '2020-05-05', yearly: false }, NOW).includes('DESCRIPTION:\r\n'));
});

test('file name is safe', () => {
  eq(icsFileName({ title: 'Her Birthday!' }), 'her-birthday.ics');
  eq(icsFileName({ title: '' }), 'date.ics');
});
