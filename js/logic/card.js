// Card screen logic (pure, tested): uses left, search + section filter, totals, which use "Undo" removes.
// Deals come from data/ssc-deals.json ({id, section, business, deal, uses, used, limits, code, where, ...}).
// Tim: "just ignore the expiration date, the deals are nearly the same across years."

// Printed uses: a number, 'unlimited', or (never in today's data) missing, which counts as one use.
export function usesLeft(deal, sscUses = []) {
  if (deal.uses === 'unlimited') return Infinity;
  const printed = deal.uses == null ? 1 : (+deal.uses || 0);
  const logged = sscUses.filter((u) => u.dealId === deal.id).length;
  return Math.max(0, printed - (+deal.used || 0) - logged);
}

export function leftLabel(left) {
  if (left === Infinity) return 'Unlimited';
  return left > 0 ? `${left} left` : 'Used up';
}

// Sections in the order the card prints them.
export function sections(deals) {
  const out = [];
  for (const d of deals) if (d.section && !out.includes(d.section)) out.push(d.section);
  return out;
}

// Lowercase, no apostrophes or accents, other punctuation as spaces: "Auntie Anne's" matches "auntie annes".
export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '').replace(/[^a-z0-9$%]+/g, ' ').trim();
}

// Every word typed must appear in the business or the deal text.
export function matches(deal, q) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = ' ' + norm(deal.business) + ' ' + norm(deal.deal) + ' ';
  return words.every((w) => hay.includes(w));
}

// o = {q, section (null = all), hideUsed, sscUses} -> [{deal, left}] in card order.
export function filterDeals(deals, o = {}) {
  const uses = o.sscUses || [];
  const out = [];
  for (const deal of deals) {
    if (o.section && deal.section !== o.section) continue;
    if (!matches(deal, o.q)) continue;
    const left = usesLeft(deal, uses);
    if (o.hideUsed && left <= 0) continue;
    out.push({ deal, left });
  }
  return out;
}

// Whole card: deals with any use left, and the countable uses left (unlimited deals add no number).
export function totals(deals, sscUses = []) {
  let n = 0, uses = 0;
  for (const d of deals) {
    const left = usesLeft(d, sscUses);
    if (left <= 0) continue;
    n++;
    if (left !== Infinity) uses += left;
  }
  return { deals: n, uses };
}

const stamp = (u) => {
  const t = u.updatedAt;
  if (t == null) return Infinity;                 // still saving: it's the newest
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000 + (t.nanoseconds || 0) / 1e6;
  return +new Date(t) || 0;
};

// The use "Undo last use" deletes: latest date, then latest saved. null when none was logged in the app.
export function lastUse(dealId, sscUses = []) {
  let best = null;
  for (const u of sscUses) {
    if (u.dealId !== dealId) continue;
    if (!best) { best = u; continue; }
    const d = String(u.date || '').localeCompare(String(best.date || ''));
    if (d > 0 || (d === 0 && stamp(u) > stamp(best))) best = u;
  }
  return best;
}

// The row "Used one" saves (same shape Plan's "We did this" writes).
export function useRow(dealId, ymd) {
  return { dealId, date: ymd };
}

export function todayYMD(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
