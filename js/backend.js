// Firebase: sign-in and the two kinds of data (dates, profile).
//
// First visit signs in anonymously so the app works at once. Sign up LINKS an
// email/password to that same anonymous account, so the uid (and all data)
// carries over (pattern from Fitness Tracker's firebase-backend.js).
// No Google sign-in yet; if added later it must be a popup, not a redirect
// (redirect can't complete in an iPhone home-screen app on GitHub Pages).
//
// Data: users/{uid}/dates/{id} and users/{uid}/profile/main ({items: [...]}).

import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

let ctx = null;          // { db, authClient, fs, auth }
let ctxPromise = null;
let user = null;
let state = { status: 'connecting', error: null };
const listeners = new Set();

function emit() {
  const info = describe();
  for (const fn of listeners) { try { fn(info); } catch (e) { console.error(e); } }
}

function describe() {
  return {
    status: state.status,                       // connecting | ready | error
    error: state.error,                         // friendly text or null
    uid: user ? user.uid : null,
    anonymous: user ? user.isAnonymous : true,
    email: user && !user.isAnonymous ? user.email : null,
  };
}

function setError(err) {
  console.warn('[backend]', err && err.code, err && err.message);
  state = { status: 'error', error: friendlyError(err) };
  emit();
}

export function onChange(fn) {
  listeners.add(fn);
  fn(describe());
  return () => listeners.delete(fn);
}

export function current() { return describe(); }

async function connect() {
  if (ctxPromise) return ctxPromise;
  ctxPromise = (async () => {
    const [appMod, auth, fs] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js'),
    ]);
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
    let db;
    try {
      // Offline cache: the app opens and edits work with no signal; they sync later.
      db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
    } catch (err) {
      console.warn('Offline cache unavailable; continuing without it.', err);
      db = fs.getFirestore(app);
    }
    // Testing only: on localhost, ?emu uses a local Firestore emulator (port 8085).
    if (location.hostname === 'localhost' && new URLSearchParams(location.search).has('emu')) {
      fs.connectFirestoreEmulator(db, 'localhost', 8085);
    }
    const authClient = auth.getAuth(app);
    ctx = { db, authClient, fs, auth };
    return ctx;
  })();
  ctxPromise.catch(() => { ctxPromise = null; });
  return ctxPromise;
}

let anonPending = null;
function ensureAnon(c) {
  if (!anonPending) {
    anonPending = c.auth.signInAnonymously(c.authClient)
      .catch((err) => {
        // Here "operation not allowed" means guest sign-in is off, not email.
        if (err && err.code === 'auth/operation-not-allowed') err = { code: 'auth/admin-restricted-operation' };
        setError(err);
      })
      .finally(() => { anonPending = null; });
  }
  return anonPending;
}

// Start up: connect, then follow the signed-in user. With nobody signed in,
// take an anonymous account (also after sign-out).
export async function start() {
  let c;
  try {
    c = await connect();
  } catch (err) {
    setError({ code: 'sdk-load', message: String(err && err.message || err) });
    return;
  }
  c.auth.onAuthStateChanged(c.authClient, (u) => {
    user = u;
    if (u) {
      state = { status: 'ready', error: null };
      emit();
    } else {
      state = { status: 'connecting', error: null };
      emit();
      ensureAnon(c);
    }
  });
}

/* ---------------- dates ---------------- */

function needUser() {
  if (!ctx || !user) {
    const e = new Error('Not connected to the cloud yet.');
    e.code = 'not-ready';
    throw e;
  }
  return ctx;
}

// Calls cb(list) now and on every change. Returns an unsubscribe function.
export function watchDates(cb, onErr) {
  const c = needUser();
  const col = c.fs.collection(c.db, 'users', user.uid, 'dates');
  return c.fs.onSnapshot(col, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => { setError(err); if (onErr) onErr(err); });
}

export function newDateId() {
  const c = needUser();
  return c.fs.doc(c.fs.collection(c.db, 'users', user.uid, 'dates')).id;
}

// Resolves once the write is in the local cache; the server sync follows on its own.
export function saveDate(item) {
  const c = needUser();
  const { id, ...data } = item;
  const ref = c.fs.doc(c.db, 'users', user.uid, 'dates', id);
  const clean = {
    title: String(data.title || '').slice(0, 200),
    date: String(data.date || ''),
    type: ['birthday', 'anniversary', 'other'].includes(data.type) ? data.type : 'other',
    yearly: Boolean(data.yearly),
    notes: String(data.notes || '').slice(0, 2000),
    updatedAt: c.fs.serverTimestamp(),
  };
  watchWrite(c.fs.setDoc(ref, clean));
}

export function deleteDate(id) {
  const c = needUser();
  watchWrite(c.fs.deleteDoc(c.fs.doc(c.db, 'users', user.uid, 'dates', id)));
}

/* ---------------- profile ---------------- */

export function watchProfile(cb, onErr) {
  const c = needUser();
  const ref = c.fs.doc(c.db, 'users', user.uid, 'profile', 'main');
  return c.fs.onSnapshot(ref, (snap) => {
    const data = snap.exists() ? snap.data() : {};
    cb(Array.isArray(data.items) ? data.items : []);
  }, (err) => { setError(err); if (onErr) onErr(err); });
}

export function saveProfile(items) {
  const c = needUser();
  const ref = c.fs.doc(c.db, 'users', user.uid, 'profile', 'main');
  const clean = items.slice(0, 500).map((it) => ({
    id: String(it.id),
    section: String(it.section),
    label: String(it.label || '').slice(0, 100),
    value: String(it.value || '').slice(0, 1000),
  }));
  watchWrite(c.fs.setDoc(ref, { items: clean, updatedAt: c.fs.serverTimestamp() }));
}

/* ---------------- settings (users/{uid}/profile/settings) ---------------- */

export function watchSettings(cb) {
  const c = needUser();
  const ref = c.fs.doc(c.db, 'users', user.uid, 'profile', 'settings');
  return c.fs.onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : {}), (err) => setError(err));
}

export function saveHolidaySettings(holidays) {
  const c = needUser();
  const ref = c.fs.doc(c.db, 'users', user.uid, 'profile', 'settings');
  const clean = {};
  for (const [k, v] of Object.entries(holidays)) clean[k] = Boolean(v);
  watchWrite(c.fs.setDoc(ref, { holidays: clean, updatedAt: c.fs.serverTimestamp() }, { merge: true }));
}

/* ---------------- later slices, read-only for Home ---------------- */

// gifts and dateLog: their screens come in later slices. Home only reads them.
// A read failure here stays quiet (it must not cover Home with an error).
export function watchList(name, cb) {
  if (!['gifts', 'dateLog'].includes(name)) throw new Error('Unknown list ' + name);
  const c = needUser();
  const col = c.fs.collection(c.db, 'users', user.uid, name);
  return c.fs.onSnapshot(col, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.warn('[backend] ' + name, err && err.code));
}

// Firestore writes resolve only when the server confirms (never, offline).
// Don't wait on them; just surface a server refusal.
function watchWrite(p) {
  p.catch((err) => setError(err));
}

/* ---------------- account ---------------- */

export async function signUp(email, password) {
  const c = await connect();
  if (user && user.isAnonymous) {
    const cred = c.auth.EmailAuthProvider.credential(email, password);
    const res = await c.auth.linkWithCredential(user, cred);
    user = res.user;
  } else {
    const res = await c.auth.createUserWithEmailAndPassword(c.authClient, email, password);
    user = res.user;
  }
  state = { status: 'ready', error: null };
  emit();
}

export async function signIn(email, password) {
  const c = await connect();
  const res = await c.auth.signInWithEmailAndPassword(c.authClient, email, password);
  user = res.user;
  state = { status: 'ready', error: null };
  emit();
}

export async function signOut() {
  const c = await connect();
  await c.auth.signOut(c.authClient);
}

// Firebase codes are not for people. Anything unmapped gets a plain line.
const MESSAGES = {
  'auth/invalid-email': 'That email address is not valid.',
  'auth/missing-password': 'Enter a password.',
  'auth/missing-email': 'Enter an email.',
  'auth/weak-password': 'Use at least 6 characters.',
  'auth/email-already-in-use': 'That email already has an account. Try Sign in.',
  'auth/credential-already-in-use': 'That email already has an account. Try Sign in.',
  'auth/user-not-found': 'No account with that email.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/invalid-login-credentials': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes.',
  'auth/network-request-failed': 'No connection. Try again when online.',
  'auth/operation-not-allowed': 'Email sign-up isn\'t switched on yet. You can keep using the app as a guest.',
  'auth/admin-restricted-operation': 'Cloud sign-in isn\'t switched on yet.',
  'auth/configuration-not-found': 'Cloud sign-in isn\'t set up yet.',
  'auth/unauthorized-domain': 'This site isn\'t allowed to sign in yet.',
  'permission-denied': 'The cloud blocked this. Try again later.',
  'failed-precondition': 'The cloud database isn\'t ready yet.',
  'not-found': 'The cloud database isn\'t set up yet.',
  unavailable: 'Offline. Changes are kept on this device and sync later.',
  'not-ready': 'Not connected to the cloud yet.',
  'sdk-load': 'Couldn\'t load the cloud code. Check your connection.',
};

export function friendlyError(err) {
  if (!err) return 'Something went wrong.';
  return MESSAGES[err.code] || 'Something went wrong. Try again.';
}
