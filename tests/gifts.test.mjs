import { test, eq, ok } from './harness.mjs';
import {
  addMonths, nextReminder, nextLabel, everyLabel, timeLabel, occurrence, validReminder, remindersSorted,
  rruleFor, buildReminderIcs, ideasOf, givenOf, sameGift, givenBefore, priceLabel, parsePrice, profileHint,
} from '../js/logic/gifts.js';

const D = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const ymd = (p) => p && `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
const NOW = new Date(Date.UTC(2026, 9, 15, 8, 5, 9));
const unfold = (s) => s.replace(/\r\n[ \t]/g, '');

/* ---------- next occurrence ---------- */

test('month math clamps to month end and counts from the start', () => {
  eq(ymd(addMonths(D('2027-01-31'), 1)), '2027-02-28');
  eq(ymd(addMonths(D('2028-01-31'), 1)), '2028-02-29', 'leap year');
  eq(ymd(addMonths(D('2027-01-31'), 2)), '2027-03-31', 'back to 31, not 28');
  eq(ymd(addMonths(D('2026-11-30'), 3)), '2027-02-28');
  eq(ymd(addMonths(D('2026-12-15'), 1)), '2027-01-15', 'year rolls');
});

test('start in the future or today is the next one', () => {
  const r = { every: 2, unit: 'week', start: '2026-10-20', time: '17:00' };
  eq(ymd(nextReminder(r, D('2026-10-15'))), '2026-10-20');
  eq(ymd(nextReminder(r, D('2026-10-20'))), '2026-10-20');
});

test('every 2 weeks steps by 14 days', () => {
  const r = { every: 2, unit: 'week', start: '2026-10-02' };
  eq(ymd(nextReminder(r, D('2026-10-15'))), '2026-10-16');
  eq(ymd(nextReminder(r, D('2026-10-16'))), '2026-10-16');
  eq(ymd(nextReminder(r, D('2026-10-17'))), '2026-10-30');
  eq(ymd(nextReminder(r, D('2027-01-01'))), '2027-01-08', 'across the year');
});

test('every N days', () => {
  const r = { every: 3, unit: 'day', start: '2026-10-01' };
  eq(ymd(nextReminder(r, D('2026-10-15'))), '2026-10-16');
  eq(ymd(nextReminder(r, D('2026-10-13'))), '2026-10-13');
});

test('monthly on the 31st clamps each month', () => {
  const r = { every: 1, unit: 'month', start: '2026-10-31' };
  eq(ymd(nextReminder(r, D('2026-11-01'))), '2026-11-30');
  eq(ymd(nextReminder(r, D('2027-02-01'))), '2027-02-28');
  eq(ymd(nextReminder(r, D('2027-03-01'))), '2027-03-31');
  eq(ymd(nextReminder(r, D('2028-02-10'))), '2028-02-29');
});

test('every 2 months skips the off months', () => {
  const r = { every: 2, unit: 'month', start: '2026-01-15' };
  eq(ymd(nextReminder(r, D('2026-02-10'))), '2026-03-15');
  eq(ymd(nextReminder(r, D('2026-03-16'))), '2026-05-15');
  eq(ymd(nextReminder(r, D('2026-05-15'))), '2026-05-15');
});

test('bad reminders give null', () => {
  eq(nextReminder({ every: 0, unit: 'week', start: '2026-10-01' }, D('2026-10-15')), null);
  eq(nextReminder({ every: 1, unit: 'year', start: '2026-10-01' }, D('2026-10-15')), null);
  eq(nextReminder({ every: 1, unit: 'week', start: '' }, D('2026-10-15')), null);
  ok(!validReminder({ every: 1.5, unit: 'day', start: '2026-10-01' }));
});

test('labels', () => {
  const today = D('2026-10-15');
  eq(nextLabel({ every: 1, unit: 'day', start: '2026-10-15' }, today), 'today');
  eq(nextLabel({ every: 1, unit: 'week', start: '2026-10-10' }, today), 'Oct 17');
  eq(nextLabel({ every: 1, unit: 'week', start: '2026-10-16' }, today), 'tomorrow');
  eq(nextLabel({ every: 1, unit: 'month', start: '2027-01-05' }, today), 'Jan 5, 2027');
  eq(everyLabel({ every: 2, unit: 'week' }), 'Every 2 weeks');
  eq(everyLabel({ every: 1, unit: 'month' }), 'Monthly');
  eq(timeLabel('17:00'), '5 PM');
  eq(timeLabel('09:30'), '9:30 AM');
  eq(timeLabel('00:15'), '12:15 AM');
  eq(timeLabel('12:00'), '12 PM');
});

test('reminders sort soonest first, bad rows last', () => {
  const list = [
    { id: 'a', what: 'Candy', every: 1, unit: 'month', start: '2026-10-01' },
    { id: 'b', what: 'Bad', every: 0, unit: 'week', start: '2026-10-01' },
    { id: 'c', what: 'Note', every: 1, unit: 'week', start: '2026-10-14' },
  ];
  eq(remindersSorted(list, D('2026-10-15')).map((r) => r.id), ['c', 'a', 'b']);
});

/* ---------- .ics ---------- */

test('rrule matches the interval', () => {
  eq(rruleFor({ every: 2, unit: 'week', start: '2026-10-16' }), 'RRULE:FREQ=WEEKLY;INTERVAL=2');
  eq(rruleFor({ every: 3, unit: 'day', start: '2026-10-16' }), 'RRULE:FREQ=DAILY;INTERVAL=3');
  eq(rruleFor({ every: 1, unit: 'month', start: '2026-10-16' }), 'RRULE:FREQ=MONTHLY;INTERVAL=1');
});

test('monthly rrule on the 29th-31st clamps to month end like the app', () => {
  eq(rruleFor({ every: 1, unit: 'month', start: '2026-10-31' }), 'RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
  eq(rruleFor({ every: 2, unit: 'month', start: '2026-10-29' }), 'RRULE:FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=28,29;BYSETPOS=-1');
});

test('reminder .ics: timed repeating event with an alert at the event time', () => {
  const ics = buildReminderIcs({ id: 'r1', what: 'Flowers, roses', every: 2, unit: 'week', start: '2026-10-16', time: '17:30', hint: 'Tulips' }, NOW);
  ok(ics.endsWith('\r\n') && !/[^\r]\n/.test(ics), 'CRLF');
  const u = unfold(ics);
  for (const must of ['BEGIN:VCALENDAR', 'VERSION:2.0', 'UID:r1@perfect-boyfriend', 'DTSTAMP:20261015T080509Z',
    'DTSTART:20261016T173000\r\n', 'DURATION:PT30M', 'RRULE:FREQ=WEEKLY;INTERVAL=2\r\n', 'SUMMARY:Flowers\\, roses',
    'DESCRIPTION:Her favorite: Tulips', 'TRIGGER:PT0M\r\n', 'END:VCALENDAR']) ok(u.includes(must), 'missing ' + must);
  eq((ics.match(/BEGIN:VALARM/g) || []).length, 1);
  eq((ics.match(/^RRULE:/gm) || []).length, 1, 'one repeat rule');
  ok(!/DTSTART[^\r]*Z\r\n/.test(ics), 'floating local time, not UTC');
  for (const l of ics.split('\r\n')) ok(Buffer.byteLength(l, 'utf8') <= 75, 'folded');
});

test('reminder .ics refuses a bad reminder', () => {
  let threw = false;
  try { buildReminderIcs({ what: 'x', every: 0, unit: 'week', start: '2026-10-16' }, NOW); } catch (_) { threw = true; }
  ok(threw);
});

test('occurrence 0 is the start', () => {
  eq(ymd(occurrence({ every: 1, unit: 'month', start: '2026-01-31' }, 0)), '2026-01-31');
});

/* ---------- ideas, given, repeats ---------- */

const GIFTS = [
  { id: 'i1', title: 'Red roses', added: '2026-10-01' },
  { id: 'i2', title: 'Kindle Paperwhite', price: 150, added: '2026-10-10' },
  { id: 'i3', title: 'Bath bombs', added: '2026-09-01' },
  { id: 'g1', title: 'Roses', date: '2026-02-14', reaction: 3 },
  { id: 'g2', title: 'Crumbl cookies', date: '2026-09-20', reaction: 2 },
  { id: 'g3', title: 'roses!', date: '2025-05-01', reaction: 2 },
  { id: 'g4', title: 'Necklace', date: 'not a date' },
];

test('ideas have no date; given sorted newest first', () => {
  eq(ideasOf(GIFTS).map((g) => g.id), ['i2', 'i1', 'i3', 'g4']);
  eq(givenOf(GIFTS).map((g) => g.id), ['g2', 'g1', 'g3']);
});

test('repeat detection matches titles loosely', () => {
  ok(sameGift('Red roses', 'Roses'));
  ok(sameGift('Crumbl Cookies', 'crumbl cookie'));
  ok(sameGift("Her favorite flowers", 'favorite flower'));
  ok(!sameGift('Bath bombs', 'Roses'));
  ok(!sameGift('', 'Roses'));
  ok(!sameGift('the', 'the'));
  eq(givenBefore(GIFTS[0], GIFTS).id, 'g1', 'latest matching gift');
  eq(givenBefore(GIFTS[2], GIFTS), null);
});

test('price parse and label', () => {
  eq(parsePrice('$25'), 25);
  eq(parsePrice('1,299.999'), 1300);
  eq(parsePrice(''), null);
  eq(parsePrice('abc'), null);
  eq(priceLabel(25), '$25');
  eq(priceLabel(12.5), '$12.50');
  eq(priceLabel(null), '');
  eq(priceLabel(''), '');
});

test('profile hint reads About her favorites', () => {
  const items = [
    { id: '1', section: 'favorites', label: 'Flower', value: 'Tulips' },
    { id: '2', section: 'favorites', label: 'Candy', value: '  ' },
    { id: '3', section: 'notes', label: 'Candy', value: 'Sour Patch' },
  ];
  eq(profileHint('Flowers', items), 'Tulips');
  eq(profileHint('Roses for her', items), 'Tulips');
  eq(profileHint('Candy', items), '', 'blank favorite and wrong section ignored');
  eq(profileHint('Love note', items), '');
  eq(profileHint('Flowers', undefined), '');
});
