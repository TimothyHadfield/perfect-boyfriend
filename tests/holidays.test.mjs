import { test, eq, ok } from './harness.mjs';
import { HOLIDAYS, nthWeekday, holidayDate, upcomingHolidays, holidayPrefs } from '../js/logic/holidays.js';
import { parseYMD } from '../js/logic/dates.js';

const T = (s) => parseYMD(s);

test('nth weekday of a month (floating dates)', () => {
  // Thanksgiving: 4th Thursday of November
  eq(nthWeekday(2026, 11, 4, 4), { y: 2026, m: 11, d: 26 });
  eq(nthWeekday(2025, 11, 4, 4), { y: 2025, m: 11, d: 27 });
  eq(nthWeekday(2024, 11, 4, 4), { y: 2024, m: 11, d: 28 });
  eq(nthWeekday(2028, 11, 4, 4), { y: 2028, m: 11, d: 23 }); // Nov 1 2028 is a Wednesday
  // Mother's Day: 2nd Sunday of May
  eq(nthWeekday(2026, 5, 0, 2), { y: 2026, m: 5, d: 10 });
  eq(nthWeekday(2027, 5, 0, 2), { y: 2027, m: 5, d: 9 });
  eq(nthWeekday(2022, 5, 0, 2), { y: 2022, m: 5, d: 8 }); // May 1 2022 is a Sunday
});

test('fixed holidays land on their day', () => {
  eq(holidayDate('valentines', 2027), { y: 2027, m: 2, d: 14 });
  eq(holidayDate('halloween', 2026), { y: 2026, m: 10, d: 31 });
  eq(holidayDate('christmas', 2026), { y: 2026, m: 12, d: 25 });
  eq(holidayDate('nye', 2026), { y: 2026, m: 12, d: 31 });
});

test('has the six holidays; Mother\'s Day off by default', () => {
  eq(HOLIDAYS.map((h) => h.key), ['valentines', 'mothers', 'halloween', 'thanksgiving', 'christmas', 'nye']);
  const p = holidayPrefs(undefined);
  eq(p.mothers, false);
  eq(p.christmas, true);
  eq(holidayPrefs({ mothers: true, christmas: false }).christmas, false);
});

test('upcoming holidays: next occurrence, today counts, rolls to next year', () => {
  const list = upcomingHolidays(T('2026-10-31'), holidayPrefs({}));
  const hw = list.find((x) => x.holiday === 'halloween');
  eq(hw.days, 0, 'Halloween is today');
  eq(hw.date, '2026-10-31');
  const val = list.find((x) => x.holiday === 'valentines');
  eq(val.date, '2027-02-14');
  eq(val.days, 106);
  const tg = list.find((x) => x.holiday === 'thanksgiving');
  eq(tg.date, '2026-11-26');
  ok(list.every((x) => x.type === 'holiday' && x.yearly === false), 'shape');
});

test('Thanksgiving after it passed goes to next year\'s 4th Thursday', () => {
  const tg = upcomingHolidays(T('2026-11-27'), holidayPrefs({})).find((x) => x.holiday === 'thanksgiving');
  eq(tg.date, '2027-11-25');
});

test('switched-off holidays are left out', () => {
  const keys = upcomingHolidays(T('2026-03-01'), holidayPrefs({ halloween: false })).map((x) => x.holiday);
  ok(!keys.includes('halloween'), 'halloween off');
  ok(!keys.includes('mothers'), 'mothers off by default');
  ok(upcomingHolidays(T('2026-03-01'), holidayPrefs({ mothers: true })).some((x) => x.holiday === 'mothers' && x.date === '2026-05-10'), 'mothers on');
});
