// Home's one smart suggestion, picked by priority. Pure: tested in Node.
//   0. birthday / anniversary within 3 days  -> Plan (+ Gifts link)
//   0b. a follow-up due today or overdue     -> its text, with a Done tap (done: follow-up id)
//   1. birthday / anniversary within 14 days -> Plan (+ Gifts link)
//   2. gift reminder due today or tomorrow   -> Gifts
//   3. no date logged in more than 10 days   -> Plan
//   4. her period, or the PMS days before it -> Cycle (natural mode only)
//   5. otherwise a little-things nudge, or the weekly check-in question
// Returns { kind, label, text, go?: screen key, link?: [screen key, label], next?: true, done?: id }.
import { toYMD, upcoming } from './dates.js';
import { remindersSorted, profileHint } from './gifts.js';
import { cycleStatus } from './cycle.js';
import { daysSinceLatest } from './home.js';
import { nudgeFor } from './nudges.js';
import { dueFollowUp } from './capture.js';

export const EVENT_DAYS = 14;
export const GAP_DAYS = 10;
export const URGENT_DAYS = 3;

const inDays = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `${n} days`);

export function suggest({ today, dates, giftReminders, dateLog, cycles, profile, followUps } = {}, offset = 0) {
  const ev = upcoming(dates, today).find((x) => (x.type === 'birthday' || x.type === 'anniversary') && x.days <= EVENT_DAYS);
  const event = ev && {
    kind: 'event', label: ev.type === 'birthday' ? 'Birthday soon' : 'Anniversary soon',
    text: `Plan + gift for ${ev.title || (ev.type === 'birthday' ? 'her birthday' : 'your anniversary')} (${inDays(ev.days)})`,
    go: 'plan', link: ['gifts', 'Gifts'],
  };
  if (event && ev.days <= URGENT_DAYS) return event;

  const fu = dueFollowUp(followUps, today);
  if (fu) return { kind: 'followup', label: 'Follow up', text: fu.text.trim(), done: fu.id, late: fu.late };

  if (event) return event;

  const rem = remindersSorted(giftReminders, today).find((r) => r.days !== null && r.days <= 1);
  if (rem) {
    const what = String(rem.what || '').trim() || 'Gift';
    const hint = profileHint(what, profile);
    return {
      kind: 'gift', label: 'Gift reminder',
      text: `${what} ${rem.days === 0 ? 'today' : 'tomorrow'}${hint ? ` · she likes ${hint}` : ''}`,
      go: 'gifts',
    };
  }

  const gap = daysSinceLatest(dateLog, today);
  if (gap !== null && gap > GAP_DAYS) {
    return { kind: 'gap', label: 'Plan a date', text: `It's been ${gap} days since your last date`, go: 'plan' };
  }

  if ((cycles || []).length) {
    const st = cycleStatus(cycles, toYMD(today));
    if (st.pred && !st.pred.veryLate) {
      if (st.onPeriod) return { kind: 'cycle', label: 'Her cycle', text: 'Her period: keep plans easy and check what she needs', go: 'cycle' };
      if (st.phase === 'pms') return { kind: 'cycle', label: 'Her cycle', text: 'Her period is close: a little extra patience helps', go: 'cycle' };
    }
  }

  const n = nudgeFor(today, offset);
  return n.kind === 'checkin'
    ? { kind: 'checkin', label: 'Ask her', text: n.text, next: true }
    : { kind: 'little', label: 'Little thing', text: n.text, next: true };
}
