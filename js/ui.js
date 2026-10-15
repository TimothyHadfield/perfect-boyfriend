// Shared UI pieces every screen can import: escaping, icons, the top bar,
// the ? help bubble, editors (full screen on phone, a panel on laptop), toast.

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  dates: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  plan: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  gifts: '<rect x="3.5" y="8" width="17" height="4.5" rx="1"/><path d="M5 12.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5M12 8v13M12 8S10.5 3.6 8 4.2C6 4.8 6.8 8 12 8zm0 0s1.5-4.4 4-3.8c2 .6 1.2 3.8-4 3.8z"/>',
  her: '<path d="M12 20.5s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z"/>',
  person: '<path d="M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
};
export const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;

// Top bar. `back` shows a back arrow (handled by the shell: goes to the previous screen).
// Main screens get Settings and Account icons on the phone (the laptop sidebar has both).
export function topbar(title, actions = '', back = false) {
  return `<header class="topbar">
    ${back ? `<a class="icon-btn" href="#/home" data-back aria-label="Back">${svg('back')}</a>` : ''}
    <h1>${esc(title)}</h1>
    ${actions}
    ${back ? '' : `<a class="icon-btn phone-only" href="#/settings" aria-label="Settings">${svg('settings')}</a>
    <a class="icon-btn avatar-btn" href="#/account" aria-label="Account">${svg('person')}</a>`}
  </header>`;
}

export function banner(info) {
  if (info && info.status === 'error') return `<div class="banner" role="status">${esc(info.error)}</div>`;
  return '';
}

export function loadingOr(info, loaded, html) {
  if (info.status === 'error' && !loaded) return '<p class="empty">Can\'t load right now.</p>';
  if (!loaded) return '<p class="empty">Loading…</p>';
  return html;
}

/* ---------------- ? help: a small bubble that floats, so nothing moves ---------------- */

export const help = (text) => `<button type="button" class="help" data-help="${esc(text)}" aria-label="Why?">?</button>`;

let helpEl = null;
export function hideHelp() { if (helpEl) { helpEl.remove(); helpEl = null; } }
export function showHelp(btn) {
  const same = helpEl && helpEl.dataset.for === btn.dataset.help;
  hideHelp();
  if (same) return;
  const pop = document.createElement('div');
  pop.className = 'help-pop';
  pop.setAttribute('role', 'tooltip');
  pop.dataset.for = btn.dataset.help;
  pop.textContent = btn.dataset.help;
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  const below = r.bottom + 6 + h < window.innerHeight - 8;
  pop.style.left = left + 'px';
  pop.style.top = (below ? r.bottom + 6 : r.top - 6 - h) + 'px';
  helpEl = pop;
}

/* ---------------- editors ---------------- */

let editorEl = null;

export function openEditor(html, bind) {
  closeEditor(true);
  const wrap = document.createElement('div');
  wrap.className = 'editor-backdrop';
  wrap.innerHTML = `<div class="editor" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  editorEl = wrap;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeEditor(); });
  wrap.querySelector('[data-cancel]').onclick = () => closeEditor();
  bind(wrap);
}

export function closeEditor(instant) {
  if (!editorEl) return;
  const el = editorEl;
  editorEl = null;
  if (instant) { el.remove(); return; }
  // While it fades out it must not catch taps or share field ids with the next editor.
  el.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  el.classList.add('leaving');
  setTimeout(() => el.remove(), 160);
}

export function editorHead(title) {
  return `<header class="editor-head">
    <button type="button" class="link-btn" data-cancel>Cancel</button>
    <h2>${esc(title)}</h2>
    <button type="submit" class="link-btn strong" form="ed-form">Save</button>
  </header>`;
}

// Two taps to delete; the button keeps its size.
export function armDelete(btn, onConfirm) {
  if (!btn) return;
  let armed = false;
  btn.onclick = () => {
    if (armed) return onConfirm();
    armed = true;
    btn.textContent = 'Tap again to delete';
    btn.classList.add('armed');
    setTimeout(() => { armed = false; btn.textContent = 'Delete'; btn.classList.remove('armed'); }, 3000);
  };
}

/* ---------------- small toast ---------------- */

export function flash(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
