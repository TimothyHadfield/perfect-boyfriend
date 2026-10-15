// Minimal test harness shared by the test files.
const pending = [];
export const results = {
  list: [],
  async done() { await Promise.all(pending); },
};

function caller() {
  const line = (new Error().stack || '').split('\n').find((l) => l.includes('.test.mjs')) || '';
  const m = line.match(/([\w.-]+\.test\.mjs)/);
  return m ? m[1] : '?';
}

export function test(name, fn) {
  const file = caller();
  const p = (async () => {
    try {
      await fn();
      results.list.push({ file, name, ok: true });
    } catch (err) {
      results.list.push({ file, name, ok: false, error: err && err.message ? err.message : String(err) });
    }
  })();
  pending.push(p);
}

export function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ? msg + ': ' : ''}expected ${e}, got ${a}`);
}

export function ok(cond, msg = 'expected true') {
  if (!cond) throw new Error(msg);
}
