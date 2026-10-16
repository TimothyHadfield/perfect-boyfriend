// "She mentioned…" quick capture from Home's +: build the row each choice saves,
// and pick the follow-up that is due. Pure: tested in Node.
//   Gift idea -> a `gifts` idea row (same shape Gifts' quick add writes: no `date`)
//   Follow up -> a `followUps` row { text (<=200), date: 'YYYY-MM-DD', done?: bool }
//   About her -> a profile item { id, section, label, value } appended to S.profile
import { parseYMD, toYMD } from './dates.js';
import { SECTIONS } from './profile.js';

export const KINDS = [['gift', 'Gift idea'], ['follow', 'Follow up'], ['about', 'About her']];
export const TEXT_MAX = 200;
const LABEL_MAX = 100;

const dayNum = ({ y, m, d }) => Math.round(Date.UTC(y, m - 1, d) / 86400000);

export function tomorrowYMD(today) {
  const t = new Date(Date.UTC(today.y, today.m - 1, today.d + 1));
  return toYMD({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// Returns '' when fine, else a short message for the sheet.
// profileReady: About her saves the whole profile list, so it must wait until the profile has loaded.
export function checkCapture(kind, text, extra, profileReady = true) {
  const t = clean(text);
  if (!t) return kind === 'gift' ? 'Add a gift.' : kind === 'follow' ? 'Add what to follow up on.' : 'Add what she said.';
  if (t.length > TEXT_MAX) return `Keep it under ${TEXT_MAX} characters.`;
  if (kind === 'follow' && !parseYMD(extra)) return 'Pick a date.';
  if (kind === 'about' && !SECTIONS.some((s) => s.key === extra)) return 'Pick a section.';
  if (kind === 'about' && !profileReady) return 'Still loading. Try again in a second.';
  return '';
}

export function giftIdeaRow(id, text, now = new Date()) {
  return { id, title: clean(text).slice(0, TEXT_MAX), added: now.toISOString() };
}

export function followUpRow(id, text, date) {
  return { id, text: clean(text).slice(0, TEXT_MAX), date, done: false };
}

// "Flower: tulips" -> label Flower, value tulips (so gift hints can find it).
// Plain text becomes the label; text too long for a label goes in the details.
export function profileItem(id, section, text) {
  const t = clean(text);
  const i = t.indexOf(':');
  if (i > 0 && i <= LABEL_MAX && t.slice(i + 1).trim()) {
    return { id, section, label: t.slice(0, i).trim(), value: t.slice(i + 1).trim() };
  }
  if (t.length <= LABEL_MAX) return { id, section, label: t, value: '' };
  return { id, section, label: t.slice(0, LABEL_MAX - 1).trimEnd() + '…', value: t };
}

// The follow-up to show today: not done, dated today or earlier; oldest first.
// Adds `late` (whole days overdue). null when none.
export function dueFollowUp(list, today) {
  const t = dayNum(today);
  let best = null;
  for (const f of list || []) {
    if (!f || f.done || !clean(f.text)) continue;
    const p = parseYMD(f.date);
    if (!p) continue;
    const late = t - dayNum(p);
    if (late < 0) continue;
    if (!best || f.date < best.date) best = { ...f, late };
  }
  return best;
}
