// Settings: app options (for now, which holidays show on Home).
import { esc, topbar, banner, help, flash } from '../ui.js';
import { HOLIDAYS, holidayPrefs } from '../logic/holidays.js';

function render({ S }) {
  const prefs = holidayPrefs(S.settings.holidays);
  return `${topbar('Settings', '', true)}${banner(S.info)}
    <div class="pane">
      <div class="sec-row settings-row"><h2 class="sec-head">Holidays ${help('Switched-on holidays show on Home, so none sneak up on you.')}</h2></div>
      <div class="switch-grid">${HOLIDAYS.map((h) => `<label class="switch-row switch-cell"><span>${esc(h.name)}</span>
        <input type="checkbox" class="switch" data-holiday="${h.key}"${prefs[h.key] ? ' checked' : ''}${S.info.uid ? '' : ' disabled'}></label>`).join('')}
      </div>
    </div>`;
}

function bind(root, { S, backend }) {
  root.addEventListener('change', (e) => {
    const t = e.target.closest('[data-holiday]');
    if (!t || !S.info.uid) return;
    const prefs = holidayPrefs(S.settings.holidays);
    prefs[t.dataset.holiday] = t.checked;
    try { backend.saveHolidaySettings(prefs); } catch (err) { flash(backend.friendlyError(err)); }
  });
}

export default { key: 'settings', title: 'Settings', sub: true, render, bind };
