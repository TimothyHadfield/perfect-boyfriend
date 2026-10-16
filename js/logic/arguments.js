// Pure logic for Her > Arguments: the private log and its patterns. No DOM, no Firebase.
// A row: { id, date: 'YYYY-MM-DD', topic, trigger, helped, worse,
//          outcome: 'resolved' | 'open' | 'revisit', intensity: 1|2|3, notes }

import { parseYMD } from './dates.js';

export const OUTCOMES = [['resolved', 'Resolved'], ['open', 'Unresolved'], ['revisit', 'Revisit']];
export const outcomeName = (k) => (OUTCOMES.find((o) => o[0] === k) || [k, ''])[1];

const dayNum = (p) => Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000);

// Whole days from the entry's date to today (0 = today, negative = future), or null.
export function daysAgo(dateStr, today) {
  const p = parseYMD(dateStr);
  return p ? dayNum(today) - dayNum(p) : null;
}

// "  Chores " -> "Chores"; the key ignores case and extra spaces.
export const cleanTopic = (s) => String(s || '').trim().replace(/\s+/g, ' ');
export const topicKey = (s) => cleanTopic(s).toLowerCase();

// "Listened first, hugged; took a break." -> ['listened first', 'hugged', 'took a break']
export function splitPhrases(text) {
  return String(text || '')
    .split(/[,;\n/]+|\s+\+\s+/)
    .map((p) => p.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 1);
}

// Newest first (same day: most recently saved order is not known, so by topic).
export function sortLog(list) {
  return (list || []).slice().sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')) || cleanTopic(a.topic).localeCompare(cleanTopic(b.topic)));
}

// Past topics for the topic picker: most used first, spelled as last written.
export function topicList(list) {
  const m = new Map();
  for (const e of sortLog(list)) {
    const k = topicKey(e.topic);
    if (!k) continue;
    if (!m.has(k)) m.set(k, { topic: cleanTopic(e.topic), n: 0, i: m.size });
    m.get(k).n++;
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.i - b.i).map((x) => x.topic);
}

// Days since the latest argument on or before today, or null if none.
export function daysSinceLast(list, today) {
  let best = null;
  for (const e of list || []) {
    const d = daysAgo(e.date, today);
    if (d !== null && d >= 0 && (best === null || d < best)) best = d;
  }
  return best;
}

// Phrases ranked by how many texts use them; ties go to the most recent.
// `texts` must be newest first. Returns [{ phrase, n }].
function rankPhrases(texts) {
  const m = new Map();
  texts.forEach((t, i) => {
    for (const p of new Set(splitPhrases(t))) {
      if (!m.has(p)) m.set(p, { phrase: p, n: 0, first: i });
      m.get(p).n++;
    }
  });
  return [...m.values()].sort((a, b) => b.n - a.n || a.first - b.first).map(({ phrase, n }) => ({ phrase, n }));
}

// The phrase used most often across these texts, or null.
export function topPhrase(texts) {
  return rankPhrases(texts)[0] || null;
}

// "Before you talk": what helped most across every log (all topics).
export function workedBefore(list, n = 3) {
  return rankPhrases(sortLog(list).map((e) => e.helped)).slice(0, n);
}

// "Before you talk" content. Based on Gottman research (soft startup, repair attempts,
// taking a break when flooded) and plain active listening. Kept short on purpose.
export const CHECKLIST = [
  'Cool down first (20 min if heated)',
  'Listen to understand, not to answer',
  'Start with "I feel… when…"',
  'Just this issue, no scorekeeping',
  'Own your part',
  'Ask what she needs',
];

export const REPAIR_LINES = [
  'I hear you.',
  'Can we start over?',
  'What do you need from me right now?',
  'You\'re right about that part.',
  'Sorry, that came out wrong.',
  'Help me understand.',
  'Let me try that again, more gently.',
  'Can we take a break and come back?',
  'I\'m on your side.',
  'We\'re okay. I want to fix this.',
];

export const RECENT_DAYS = 90;

// Patterns stay hidden until this many entries (with a topic) are logged.
export const PATTERN_MIN = 3;
export const hasPatterns = (list) => (list || []).filter((e) => topicKey(e && e.topic)).length >= PATTERN_MIN;

// One block per topic, ranked by the last 90 days, then all time, then most recent.
export function patterns(list, today) {
  const groups = new Map();
  for (const e of sortLog(list)) {
    const k = topicKey(e.topic);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const out = [];
  for (const [key, rows] of groups) {
    const past = rows.filter((e) => { const d = daysAgo(e.date, today); return d !== null && d >= 0; });
    const recent = past.filter((e) => daysAgo(e.date, today) < RECENT_DAYS);
    const last = past[0] || null;
    out.push({
      key,
      topic: cleanTopic(rows[0].topic),
      count: rows.length,
      count90: recent.length,
      last: last ? last.date : null,
      lastDays: last ? daysAgo(last.date, today) : null,
      helped: topPhrase(rows.map((e) => e.helped)),
      worse: topPhrase(rows.map((e) => e.worse)),
      revisit: rows.filter((e) => e.outcome === 'revisit'),
    });
  }
  return out.sort((a, b) => b.count90 - a.count90 || b.count - a.count
    || (a.lastDays ?? 1e9) - (b.lastDays ?? 1e9) || a.topic.localeCompare(b.topic));
}

// Clean a form's values into a row (keeps it small).
export function cleanEntry(x) {
  const cut = (s, n) => String(s || '').trim().slice(0, n);
  const intensity = [1, 2, 3].includes(+x.intensity) ? +x.intensity : 2;
  const outcome = OUTCOMES.some((o) => o[0] === x.outcome) ? x.outcome : 'resolved';
  return {
    id: x.id,
    date: parseYMD(x.date) ? x.date : '',
    topic: cleanTopic(x.topic).slice(0, 80),
    trigger: cut(x.trigger, 300),
    helped: cut(x.helped, 300),
    worse: cut(x.worse, 300),
    outcome,
    intensity,
    notes: cut(x.notes, 2000),
  };
}
