// Weather for the Plan screen: Open-Meteo's free daily forecast for Orem (no key, CORS ok).
// Pure helpers (tested in tests/weather.test.mjs) + getForecast(), which caches in localStorage
// for a few hours and quietly gives null when offline or blocked. Temperatures are °F.

export const WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=40.2969&longitude=-111.6946'
  + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
  + '&temperature_unit=fahrenheit&timezone=America%2FDenver&forecast_days=7';
export const WX_KEY = 'pb-weather';
export const WX_FRESH = 3 * 60 * 60 * 1000;     // reuse a forecast for 3 hours
export const WX_STALE = 18 * 60 * 60 * 1000;    // offline: an older one is still better than nothing

// Open-Meteo daily JSON -> { 'YYYY-MM-DD': {code, hi, lo, pop} }. Bad or missing data -> {}.
export function parseForecast(j) {
  const d = j && j.daily;
  const out = {};
  if (!d || !Array.isArray(d.time)) return out;
  d.time.forEach((ymd, i) => {
    const code = num(d.weather_code, i), hi = num(d.temperature_2m_max, i), lo = num(d.temperature_2m_min, i);
    if (code == null || hi == null || lo == null) return;
    out[ymd] = { code, hi: Math.round(hi), lo: Math.round(lo), pop: num(d.precipitation_probability_max, i) };
  });
  return out;
}
function num(arr, i) {
  const v = Array.isArray(arr) ? arr[i] : null;
  return typeof v === 'number' && isFinite(v) ? v : null;
}

// WMO weather code -> a simple kind for the icon and the rules.
export function wxKind(code) {
  if (code == null) return null;
  if (code <= 1) return 'sun';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  return 'cloud';
}

// About how warm it is during the date: the high in the daytime, between high and low in the evening.
export function dateTemp(wx, start) {
  if (!wx) return null;
  const evening = start == null || start >= 17 * 60 || start < 8 * 60;
  return Math.round(evening ? (wx.hi + wx.lo) / 2 : wx.hi);
}

export const wetLikely = (wx) => {
  const k = wx && wxKind(wx.code);
  return !!k && (k === 'storm' || ((k === 'rain' || k === 'snow') && (wx.pop == null || wx.pop >= 50)));
};

// Rain or snow likely, a storm, or very cold / very hot -> plans prefer indoor stops.
export function badWeather(wx, start) {
  if (!wx) return false;
  if (wetLikely(wx)) return true;
  const t = dateTemp(wx, start);
  return t < 35 || wx.hi >= 95;
}

/* ---------------- fetching (browser only) ---------------- */

function readCache(storage) {
  try {
    const raw = storage && storage.getItem(WX_KEY);
    const c = raw ? JSON.parse(raw) : null;
    return c && typeof c.at === 'number' && c.days ? c : null;
  } catch (_) { return null; }
}

// -> Promise of { 'YYYY-MM-DD': {code, hi, lo, pop} } or null. Never throws.
export async function getForecast({ fetchFn, storage, now } = {}) {
  const f = fetchFn || (typeof fetch === 'function' ? fetch : null);
  let st = storage;
  if (st === undefined) { try { st = typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { st = null; } }
  const t = now == null ? Date.now() : now;
  const cached = readCache(st);
  if (cached && t - cached.at < WX_FRESH) return cached.days;
  try {
    if (!f) throw new Error('no fetch');
    const res = await f(WX_URL);
    if (!res.ok) throw new Error('weather ' + res.status);
    const days = parseForecast(await res.json());
    if (!Object.keys(days).length) throw new Error('weather: empty');
    try { st && st.setItem(WX_KEY, JSON.stringify({ at: t, days })); } catch (_) { /* storage full or blocked */ }
    return days;
  } catch (_) {
    return cached && t - cached.at < WX_STALE ? cached.days : null;
  }
}
