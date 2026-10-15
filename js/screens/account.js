// Account: sign up / sign in / sign out only. App settings live in Settings.
import { esc, topbar, banner, help } from '../ui.js';

function render({ S }) {
  const i = S.info;
  let status;
  if (i.status === 'connecting') status = 'Connecting…';
  else if (!i.uid) status = 'Not connected.';
  else if (i.anonymous) status = `Guest ${help('Sign up so your data stays safe if this phone is lost.')}`;
  else status = `Signed in as <b>${esc(i.email)}</b>`;
  const form = i.uid && !i.anonymous
    ? `<button class="btn" id="acct-signout">Sign out</button>`
    : `<form class="form" id="acct-form" autocomplete="on">
        <label class="field"><span>Email</span><input id="acct-email" type="email" autocomplete="username" inputmode="email" required></label>
        <label class="field"><span>Password</span><input id="acct-pass" type="password" autocomplete="current-password" minlength="6" required></label>
        <div class="btn-row">
          <button class="btn btn-primary" type="submit" data-mode="up">Sign up</button>
          <button class="btn" type="submit" data-mode="in">Sign in</button>
        </div>
      </form>`;
  return `${topbar('Account', '', true)}${banner(i)}
    <div class="pane"><div class="narrow">
      <p class="acct-status">${status}</p>
      ${form}
      <p class="form-msg" id="acct-msg" role="status"></p>
    </div></div>`;
}

function bind(root, { backend }) {
  const msg = root.querySelector('#acct-msg');
  const out = root.querySelector('#acct-signout');
  if (out) out.onclick = async () => {
    try { await backend.signOut(); } catch (err) { msg.textContent = backend.friendlyError(err); }
  };
  const form = root.querySelector('#acct-form');
  if (!form) return;
  let mode = 'up';
  form.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { mode = b.dataset.mode; }; });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = form.querySelector('#acct-email').value.trim();
    const pass = form.querySelector('#acct-pass').value;
    msg.textContent = mode === 'up' ? 'Signing up…' : 'Signing in…';
    msg.classList.remove('is-error');
    try {
      if (mode === 'up') await backend.signUp(email, pass);
      else await backend.signIn(email, pass);
      // the shell re-renders on the sign-in change
    } catch (err) {
      const m = document.getElementById('acct-msg');
      if (m) { m.textContent = backend.friendlyError(err); m.classList.add('is-error'); }
    }
  };
}

export default { key: 'account', title: 'Account', sub: true, render, bind };
