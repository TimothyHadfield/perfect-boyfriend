// Settings: app options (which holidays show on Home, the monthly budget).
import { esc, topbar, banner, help, flash } from '../ui.js';
import { HOLIDAYS, holidayPrefs } from '../logic/holidays.js';
import { budgetOf } from '../logic/history.js';

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
    </div>`;
}

// What's typed in the budget box but not saved yet, so a re-render mid-typing keeps it.
let budgetDraft = null;

function bind(root, { S, backend }) {
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
