// Plan and Card load a data file the first time they render. When that fetch fails (offline on a
// first visit, or a missing file), the re-render after the failure must not start another fetch
// right away: that looped forever (measured 2026-10-16: ~130 requests in 4 s, then a tab crash).
import { test, eq, ok } from './harness.mjs';
import plan from '../js/screens/plan.js';
import card from '../js/screens/card.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Renders the screen the way the shell does (ctx.render re-renders it) with every fetch failing.
async function countFetches(screen, file) {
  const saved = { document: globalThis.document, fetch: globalThis.fetch, now: Date.now };
  let calls = 0;
  // The clock stands still, so a busy test run (other files blocking the event loop) can't push a
  // late re-render past the 30 s retry wait and count a legitimate retry as a loop.
  const t0 = Date.now();
  Date.now = () => t0;
  globalThis.document = {};
  globalThis.fetch = async (url) => {
    if (String(url).includes(file)) calls++;
    throw new Error('offline');
  };
  try {
    const ctx = { S: { info: { status: 'ready', uid: 'u1' }, sscUses: [], savedPlans: [], dateLog: [] } };
    let renders = 0;
    ctx.render = () => { if (++renders < 500) screen.render(ctx); };
    const html = screen.render(ctx);
    ok(html.includes('Loading'), 'shows Loading first');
    await wait(300);
    const after = screen.render(ctx);
    ok(after.includes('Can\'t load'), 'says it can\'t load');
    return calls;
  } finally {
    globalThis.document = saved.document;
    globalThis.fetch = saved.fetch;
    Date.now = saved.now;
  }
}

// One test, one screen after the other: both swap the global fetch.
test('plan + card: a failed data load is not retried in a loop', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    eq(await countFetches(plan, 'plan-stops.json'), 1, 'plan-stops.json fetches');
    eq(await countFetches(card, 'ssc-deals.json'), 1, 'ssc-deals.json fetches');
  } finally { console.warn = warn; }
});
