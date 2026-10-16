// Backup and restore (Settings). Pure: no DOM, no Firebase.
// A backup file: { app: 'perfect-boyfriend', version: 1, exportedAt, dates: [rows],
//   profile: [items], settings: {...}, lists: { <name>: [rows] } }   every row has a string id.
// Restore only ADDS rows whose id isn't already there. It never deletes or overwrites,
// and settings are never restored (they're in the file for reference only).

export const BACKUP_APP = 'perfect-boyfriend';
export const BACKUP_VERSION = 1;

const pad = (n) => String(n).padStart(2, '0');
const localYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const backupName = (now = new Date()) => `perfect-boyfriend-backup-${localYMD(now)}.json`;

// Firestore Timestamps (updatedAt) become ISO text; everything else is copied as plain JSON.
function plain(v) {
  if (v && typeof v === 'object') {
    if (typeof v.toDate === 'function') { try { return v.toDate().toISOString(); } catch (_) { return null; } }
    if (Array.isArray(v)) return v.map(plain);
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = plain(x);
    return out;
  }
  return v;
}
const rows = (x) => (Array.isArray(x) ? x.map(plain) : []);

export function buildBackup(S, listNames, now = new Date()) {
  const lists = {};
  for (const n of listNames) lists[n] = rows(S[n]);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    dates: rows(S.dates),
    profile: rows(S.profile),
    settings: plain(S.settings || {}),
    lists,
  };
}

// Firestore doc ids: non-empty, no '/', not '.' or '..', short.
const goodId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 200 && !id.includes('/') && id !== '.' && id !== '..';
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const goodRows = (a) => Array.isArray(a) && a.every((r) => isObj(r) && goodId(r.id));

export function validateBackup(b) {
  const no = (error) => ({ ok: false, error });
  if (!isObj(b) || b.app !== BACKUP_APP) return no('That isn\'t a Perfect Boyfriend backup.');
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) return no('This backup is from a newer version.');
  if (!goodRows(b.dates)) return no('The dates in this file are damaged.');
  if (!goodRows(b.profile)) return no('The profile in this file is damaged.');
  if (!isObj(b.lists) || !Object.values(b.lists).every(goodRows)) return no('The lists in this file are damaged.');
  return { ok: true };
}

export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch (_) { return { ok: false, error: 'That file isn\'t a backup.' }; }
  const v = validateBackup(data);
  return v.ok ? { ok: true, data } : v;
}

// What a restore would add. `current` is the app state (S); missing keys count as empty.
// Returns { dates: [rows], profile: [whole new list] | null, lists: {name: [rows]}, added, skipped }.
export function planRestore(backup, current, listNames) {
  let added = 0, skipped = 0;
  const fresh = (incoming, have) => {
    const ids = new Set((Array.isArray(have) ? have : []).map((r) => r && r.id));
    const out = [];
    for (const r of incoming || []) {
      if (ids.has(r.id)) { skipped++; continue; }
      ids.add(r.id);
      const { updatedAt, ...rest } = r;   // the backend stamps its own
      out.push(rest);
      added++;
    }
    return out;
  };
  const dates = fresh(backup.dates, current.dates);
  const curProfile = Array.isArray(current.profile) ? current.profile : [];
  const newItems = fresh(backup.profile, curProfile);
  const lists = {};
  for (const n of listNames) lists[n] = fresh(backup.lists[n], current[n]);
  return { dates, profile: newItems.length ? [...curProfile, ...newItems] : null, lists, added, skipped };
}
