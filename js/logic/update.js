// New-build check (pure, tested in tests/build.test.mjs). The shell (js/app.js) reads the live
// js/version.js past every cache and reloads onto a newer build only when that can't lose anything.

// BUILD from the text of js/version.js, or null.
export function readBuild(text) {
  const m = /BUILD\s*=\s*'([^']+)'/.exec(String(text || ''));
  return m ? m[1] : null;
}

// 'YYYY-MM-DD.N' compared part by part as numbers (so .10 is after .9). >0 when a is newer.
export function compareBuild(a, b) {
  const pa = String(a).split(/[-.]/).map(Number), pb = String(b).split(/[-.]/).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// o = {running, latest, busy (a sheet is open or a field has focus), interacted (tapped or typed since the
// app came on screen), tried (the build this tab already reloaded for)}.
// Reload only onto a newer build, never mid-edit or mid-tap, and at most once per build (no loops).
export function shouldReload(o) {
  if (!o.latest || !o.running) return false;
  if (compareBuild(o.latest, o.running) <= 0) return false;
  if (o.busy || o.interacted) return false;
  return o.tried !== o.latest;
}
