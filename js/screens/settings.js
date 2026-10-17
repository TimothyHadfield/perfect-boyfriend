// Settings: app options (which holidays show on Home, the monthly budget) and backup.
import { esc, topbar, banner, help, flash } from '../ui.js';
import { HOLIDAYS, holidayPrefs } from '../logic/holidays.js';
import { budgetOf } from '../logic/history.js';
import { buildBackup, backupName, parseBackup, planRestore } from '../logic/backup.js';
import { BUILD } from '../version.js';

let backupMsg = '';   // last download/restore result, kept across re-renders

function render({ S }) {
  const prefs = holidayPrefs(S.settings.holidays);
  const budget = budgetOf(S.settings);
  return `${topbar('Settings', '', true)}${banner(S.info)}
    <div class="pane">
      <div class="sec-row settings-row"><h2 class="sec-head">Holidays ${help('Switched-on holidays show on Home, so none sneak up on you.')}</h2></div>
      <div class="switch-grid">${HOLIDAYS.map((h) => `<label class="switch-row switch-cell"><span>${esc(h.name)}</span>
        <input type="checkbox" class="switch" data-holiday="${h.key}"${prefs[h.key] ? ' checked' : ''}${S.info.uid ? '' : ' disabled'}></label>`).join('')}
      </div>
      <div class="sec-row settings-row set-gap"><h2 class="sec-head">Spending ${help('Dates plus gifts given. The Past view of Dates shows how close you are.')}</h2></div>
      <label class="switch-row set-budget"><span>Monthly budget</span>
        <span class="set-money">$<input id="set-budget" data-nokeep inputmode="decimal" maxlength="7" placeholder="None" aria-label="Monthly budget in dollars"
          value="${budget == null ? '' : esc(budget)}"${S.info.uid ? '' : ' disabled'}></span></label>
      <div class="sec-row settings-row set-gap"><h2 class="sec-head">Backup ${help("Your data lives only in your account. Keep a copy in Files in case you lose access. Restore only adds what's missing.")}</h2></div>
      <div class="btn-row set-backup">
        <button type="button" class="btn" data-backup-download${S.info.uid ? '' : ' disabled'}>Download</button>
        <label class="btn set-restore${S.info.uid ? '' : ' is-disabled'}">Restore<input type="file" accept=".json,application/json" data-backup-file${S.info.uid ? '' : ' disabled'}></label>
      </div>
      <p class="form-msg set-backup-msg" role="status">${esc(backupMsg)}</p>
      <p class="set-build">Build ${esc(BUILD)}</p>
    </div>`;
}

// What's typed in the budget box but not saved yet, so a re-render mid-typing keeps it.
let budgetDraft = null;

function download(S, backend) {
  if (!S.datesLoaded || !S.profileLoaded) { flash('Still loading. Try again in a second.'); return; }
  const data = buildBackup(S, backend.LISTS);
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = backupName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  const n = data.dates.length + data.profile.length + Object.values(data.lists).reduce((t, l) => t + l.length, 0);
  return `Saved ${n} item${n === 1 ? '' : 's'}.`;
}

// Read a list fresh (one snapshot), so restore never overwrites a row that exists
// but hasn't reached S yet.
function readList(backend, name) {
  return new Promise((resolve, reject) => {
    let stop = null, done = false;
    const timer = setTimeout(() => { done = true; if (stop) stop(); reject(new Error('timeout')); }, 10000);
    stop = backend.watchList(name, (list) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      setTimeout(() => stop && stop(), 0);
      resolve(list);
    });
  });
}

async function restore(file, S, backend) {
  if (!S.datesLoaded || !S.profileLoaded) return 'Still loading. Try again in a second.';
  const parsed = parseBackup(await file.text());
  if (!parsed.ok) return parsed.error;
  const current = { dates: S.dates, profile: S.profile };
  try {
    for (const n of backend.LISTS) current[n] = await readList(backend, n);
  } catch (_) { return "Couldn't read your data. Try again online."; }
  const plan = planRestore(parsed.data, current, backend.LISTS);
  let failed = 0;
  const put = (fn) => { try { fn(); } catch (_) { failed++; } };
  plan.dates.forEach((d) => put(() => backend.saveDate(d)));
  for (const [n, rows] of Object.entries(plan.lists)) rows.forEach((r) => put(() => backend.saveListItem(n, r)));
  if (plan.profile) put(() => backend.saveProfile(plan.profile));
  return `Added ${plan.added - failed}, skipped ${plan.skipped} already here${failed ? `, ${failed} failed` : ''}.`;
}

function bind(root, { S, backend }) {
  const setMsg = (t) => { backupMsg = t || ''; const el = root.querySelector('.set-backup-msg'); if (el) el.textContent = backupMsg; };
  root.querySelector('[data-backup-download]').addEventListener('click', () => {
    if (!S.info.uid) return;
    try { setMsg(download(S, backend)); } catch (err) { setMsg("Couldn't make the file."); console.warn(err); }
  });
  root.querySelector('[data-backup-file]').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !S.info.uid) return;
    setMsg('Restoring…');
    try { setMsg(await restore(file, S, backend)); } catch (err) { setMsg("Couldn't read that file."); console.warn(err); }
  });

  const budgetEl = root.querySelector('#set-budget');
  if (budgetDraft !== null) budgetEl.value = budgetDraft;
  budgetEl.addEventListener('input', () => { budgetDraft = budgetEl.value; });
  budgetEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') budgetEl.blur(); });
  budgetEl.addEventListener('blur', () => {
    if (budgetDraft === null || !document.contains(budgetEl)) return;   // a re-render, not the user leaving
    const raw = budgetDraft.replace(/[$,\s]/g, '');
    budgetDraft = null;
    if (!S.info.uid) return;
    const n = raw ? Number(raw) : null;
    if (raw && !(Number.isFinite(n) && n >= 0)) { flash('Budget must be a number.'); budgetEl.value = budgetOf(S.settings) ?? ''; return; }
    if ((n || null) === budgetOf(S.settings)) return;
    try { backend.saveMonthlyBudget(n ? n : null); } catch (err) { flash(backend.friendlyError(err)); }
  });
  root.addEventListener('change', (e) => {
    const t = e.target.closest('[data-holiday]');
    if (!t || !S.info.uid) return;
    const prefs = holidayPrefs(S.settings.holidays);
    prefs[t.dataset.holiday] = t.checked;
    try { backend.saveHolidaySettings(prefs); } catch (err) { flash(backend.friendlyError(err)); }
  });
}

export default { key: 'settings', title: 'Settings', sub: true, render, bind };
