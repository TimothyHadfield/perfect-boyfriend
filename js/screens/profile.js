// Her > Profile (was "About her"): sections of label/detail rows, and their editor.
import { esc, svg, topbar, banner, loadingOr, openEditor, closeEditor, editorHead, armDelete, flash } from '../ui.js';
import { SECTIONS, sectionName, groupBySection, upsertItem, removeItem, newId } from '../logic/profile.js';

function openItemEditor(ctx, sectionKey, id) {
  const { S, backend } = ctx;
  if (!S.info.uid) { flash('Not connected yet.'); return; }
  const existing = id ? S.profile.find((x) => x.id === id) : null;
  const sec = existing ? existing.section : sectionKey;
  const hints = (SECTIONS.find((s) => s.key === sec) || { hints: [] }).hints;
  const it = existing || { id: newId(), section: sec, label: '', value: '' };
  openEditor(`${editorHead(sectionName(sec))}
    <form class="form" id="ed-form">
      <label class="field"><span>Label</span><input id="ed-label" maxlength="100" list="ed-hints" value="${esc(it.label)}" required></label>
      <datalist id="ed-hints">${hints.map((h) => `<option value="${esc(h)}">`).join('')}</datalist>
      <label class="field"><span>Details</span><textarea id="ed-value" rows="3" maxlength="1000">${esc(it.value)}</textarea></label>
      <p class="form-msg" id="ed-msg" role="status"></p>
      ${existing ? '<div class="btn-col"><button type="button" class="btn btn-danger" id="ed-del">Delete</button></div>' : ''}
    </form>`, (root) => {
    const msg = root.querySelector('#ed-msg');
    root.querySelector('#ed-form').onsubmit = (e) => {
      e.preventDefault();
      const label = root.querySelector('#ed-label').value.trim();
      const value = root.querySelector('#ed-value').value.trim();
      if (!label) { msg.textContent = 'Add a label.'; msg.classList.add('is-error'); return; }
      try { backend.saveProfile(upsertItem(S.profile, { ...it, label, value })); closeEditor(); }
      catch (err) { msg.textContent = backend.friendlyError(err); msg.classList.add('is-error'); }
    };
    armDelete(root.querySelector('#ed-del'), () => {
      try { backend.saveProfile(removeItem(S.profile, it.id)); closeEditor(); } catch (err) { msg.textContent = backend.friendlyError(err); }
    });
  });
}

export default {
  key: 'profile',
  title: 'Profile',
  group: 'her',
  render({ S, subtabs }) {
    const g = groupBySection(S.profile);
    const body = `<div class="about-grid">${SECTIONS.map((s) => `
      <section class="about-sec">
        <div class="sec-row"><h2 class="sec-head">${esc(s.name)}</h2>
          <button class="icon-btn small" data-new-item="${s.key}" aria-label="Add to ${esc(s.name)}">${svg('plus')}</button></div>
        ${g[s.key].length ? `<div class="list">${g[s.key].map((it) => `
          <button class="row kv" data-edit-item="${esc(it.id)}">
            <span class="kv-label${it.value ? '' : ' solo'}">${esc(it.label)}</span><span class="kv-value">${esc(it.value)}</span>
          </button>`).join('')}</div>` : ''}
      </section>`).join('')}</div>`;
    return `${topbar('Her')}${subtabs}${banner(S.info)}<div class="pane">${loadingOr(S.info, S.profileLoaded, body)}</div>`;
  },
  bind(root, ctx) {
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-new-item],[data-edit-item]');
      if (!t) return;
      if (t.dataset.newItem) openItemEditor(ctx, t.dataset.newItem, null);
      else openItemEditor(ctx, null, t.dataset.editItem);
    });
  },
};
