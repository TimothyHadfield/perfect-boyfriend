// Past dates (dateLog) and this month's spending. Pure: tested in Node.
// dateLog row: { title, date 'YYYY-MM-DD', stops?: [names], stopIds?: [ids], cost: number,
//   rating?: 'loved'|'ok'|'meh', note?: string (<=500), manual?: true }  (see docs/wave3-plan.md)
// Gifts count toward spending once given (they have a real `date`); their cost is `price`.
import { parseYMD } from './dates.js';

export const RATINGS = [['loved', 'Loved'], ['ok', 'Ok'], ['meh', 'Meh']];
export const NOTE_MAX = 500;

export const ratingName = (k) => (RATINGS.find((x) => x[0] === k) || [null, ''])[1];

// Newest date first; ties by title; rows with a bad date last.
export function pastSorted(list) {
  return (list || []).slice().sort((a, b) => {
    const da = parseYMD(a && a.date) ? a.date : '', db = parseYMD(b && b.date) ? b.date : '';
    if (da !== db) return db.localeCompare(da);
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

// A usable dollar amount, or 0 for missing / junk / negative.
export function money(v) {
  if (v === '' || v == null || typeof v === 'boolean') return 0;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// '25', '$25.50' -> number; blank -> null; junk -> NaN.
export function parseCost(s) {
  const t = String(s == null ? '' : s).replace(/[$,\s]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

const pad = (n) => String(n).padStart(2, '0');
const inMonth = (ymd, today) => {
  const p = parseYMD(ymd);
  return !!p && p.y === today.y && p.m === today.m;
};

// This calendar month's spending: dates (dateLog cost) + given gifts (price).
export function monthSpend(dateLog, gifts, today) {
  let dates = 0, giftsSum = 0;
  for (const d of dateLog || []) if (d && inMonth(d.date, today)) dates += money(d.cost);
  for (const g of gifts || []) if (g && inMonth(g.date, today)) giftsSum += money(g.price);
  const r = (x) => Math.round(x * 100) / 100;
  return { month: `${today.y}-${pad(today.m)}`, dates: r(dates), gifts: r(giftsSum), total: r(dates + giftsSum) };
}

// The row to save after editing. Keeps every field it doesn't change (Plan's stops,
// stopIds, manual...). cost null = left blank -> 0; empty rating / note are removed.
export function editedRow(orig, { title, date, cost, rating, note }) {
  const row = { ...orig, title, date, cost: cost == null ? 0 : cost };
  if (RATINGS.some((r) => r[0] === rating)) row.rating = rating; else delete row.rating;
  const n = String(note || '').trim().slice(0, NOTE_MAX);
  if (n) row.note = n; else delete row.note;
  delete row.updatedAt;
  return row;
}

// A set budget in dollars, or null.
export function budgetOf(settings) {
  const b = settings && settings.monthlyBudget;
  return typeof b === 'number' && Number.isFinite(b) && b > 0 ? b : null;
}

// Red->green by how close spending is to the budget: green up to 60%, red at 100% and over.
export function spendHue(total, budget) {
  if (!budget) return null;
  const f = money(total) / budget;
  if (f <= 0.6) return 120;
  if (f >= 1) return 0;
  return Math.round(120 * (1 - (f - 0.6) / 0.4));
}

export function dollars(n) {
  const v = money(n);
  return '$' + (Number.isInteger(v) ? v : v.toFixed(2));
}
