// Checks firestore.rules against the local emulator (never the real project).
//   firebase emulators:exec --only firestore --project demo-pb "node tests/rules.emulator.mjs"
// or, with an emulator already running on 8085: node tests/rules.emulator.mjs
// Uses unsigned tokens, which only the emulator accepts.
const HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8085';
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-pb';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

function token(uid) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, iat: now, exp: now + 3600, auth_time: now,
    sub: uid, user_id: uid, firebase: { sign_in_provider: 'anonymous', identities: {} },
  })}.`;
}

const val = (v) => (typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v }
  : Array.isArray(v) ? { arrayValue: { values: v.map(val) } }
  : typeof v === 'number' ? { integerValue: String(v) }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } });

async function call(method, path, uid, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${token(uid)}` } : {}) },
    body: body ? JSON.stringify({ fields: Object.fromEntries(Object.entries(body).map(([k, v]) => [k, val(v)])) }) : undefined,
  });
  return res.status;
}

const goodDate = { title: 'Her birthday', date: '1999-10-20', type: 'birthday', yearly: true, notes: '' };
const checks = [
  ['owner writes a date', () => call('PATCH', 'users/alice/dates/d1', 'alice', goodDate), 200],
  ['owner reads her date', () => call('GET', 'users/alice/dates/d1', 'alice'), 200],
  ['signed-out read denied', () => call('GET', 'users/alice/dates/d1', null), 403],
  ['signed-out write denied', () => call('PATCH', 'users/alice/dates/d2', null, goodDate), 403],
  ['other user read denied', () => call('GET', 'users/alice/dates/d1', 'bob'), 403],
  ['other user write denied', () => call('PATCH', 'users/alice/dates/d3', 'bob', goodDate), 403],
  ['bad date shape denied', () => call('PATCH', 'users/alice/dates/d4', 'alice', { ...goodDate, date: 'soon' }), 403],
  ['extra field denied', () => call('PATCH', 'users/alice/dates/d5', 'alice', { ...goodDate, secret: 'x' }), 403],
  ['owner writes profile/main', () => call('PATCH', 'users/alice/profile/main', 'alice', { items: [{ id: '1', section: 'sizes', label: 'Shoe', value: '7' }] }), 200],
  ['profile other doc denied', () => call('PATCH', 'users/alice/profile/other', 'alice', { items: [] }), 403],
  ['other user profile read denied', () => call('GET', 'users/alice/profile/main', 'bob'), 403],
  ['unknown collection denied', () => call('PATCH', 'users/alice/secrets/s1', 'alice', { title: 'x' }), 403],
  ['owner writes settings', () => call('PATCH', 'users/alice/profile/settings', 'alice', { holidays: { mothers: true } }), 200],
  ['settings extra field denied', () => call('PATCH', 'users/alice/profile/settings', 'alice', { holidays: { mothers: true }, x: 'y' }), 403],
  ['other user settings denied', () => call('GET', 'users/alice/profile/settings', 'bob'), 403],
  ['owner writes monthly budget', () => call('PATCH', 'users/alice/profile/settings', 'alice', { holidays: { mothers: true }, monthlyBudget: 80 }), 200],
  ['negative budget denied', () => call('PATCH', 'users/alice/profile/settings', 'alice', { monthlyBudget: -5 }), 403],
  ['text budget denied', () => call('PATCH', 'users/alice/profile/settings', 'alice', { monthlyBudget: 'lots' }), 403],
  ...['gifts', 'dateLog', 'giftReminders', 'cycles'].flatMap((coll) => [
    [`owner writes ${coll}`, () => call('PATCH', `users/alice/${coll}/x1`, 'alice', { title: 'x' }), 200],
    [`owner reads ${coll}`, () => call('GET', `users/alice/${coll}/x1`, 'alice'), 200],
    [`other user ${coll} read denied`, () => call('GET', `users/alice/${coll}/x1`, 'bob'), 403],
    [`signed-out ${coll} write denied`, () => call('PATCH', `users/alice/${coll}/x2`, null, { title: 'x' }), 403],
  ]),
  ['wildcard does not loosen dates shape', () => call('PATCH', 'users/alice/dates/d6', 'alice', { title: 'x' }), 403],
  ['top-level collection denied', () => call('PATCH', 'other/x', 'alice', { title: 'x' }), 403],
  ['user root doc denied', () => call('PATCH', 'users/alice', 'alice', { title: 'x' }), 403],
  ['owner deletes her date', () => call('DELETE', 'users/alice/dates/d1', 'alice'), 200],
];

let fail = 0;
for (const [name, fn, want] of checks) {
  const got = await fn();
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}  (${got}, want ${want})`);
}
console.log(`\n${checks.length - fail} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
