// Weather helpers (js/logic/weather.js): parsing Open-Meteo, bad-weather rules, cache and offline.
import { test, eq, ok } from './harness.mjs';
import { parseForecast, wxKind, badWeather, wetLikely, dateTemp, getForecast, WX_KEY, WX_FRESH } from '../js/logic/weather.js';

// Same shape as a real Open-Meteo daily response (7 days, America/Denver).
const SAMPLE = {
  latitude: 40.29, longitude: -111.69, timezone: 'America/Denver',
  daily_units: { time: 'iso8601', weather_code: 'wmo code', temperature_2m_max: '°F', temperature_2m_min: '°F', precipitation_probability_max: '%' },
  daily: {
    time: ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'],
    weather_code: [0, 3, 61, 73, 95, 2, null],
    temperature_2m_max: [68.4, 60.1, 52.3, 34.9, 70.2, 98.6, 60],
    temperature_2m_min: [41.2, 38.7, 40.1, 22.5, 50.4, 70.1, 40],
    precipitation_probability_max: [0, 10, 80, 65, 40, 0, 0],
  },
};

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const okFetch = (body) => { let n = 0; const f = async () => { n++; return { ok: true, json: async () => body }; }; f.count = () => n; return f; };
const failFetch = async () => { throw new Error('offline'); };

test('parseForecast reads Open-Meteo daily data and skips broken days', () => {
  const d = parseForecast(SAMPLE);
  eq(Object.keys(d).length, 6);
  eq(d['2026-10-15'], { code: 0, hi: 68, lo: 41, pop: 0 });
  eq(d['2026-10-17'], { code: 61, hi: 52, lo: 40, pop: 80 });
  eq(parseForecast(null), {});
  eq(parseForecast({ error: true, reason: 'x' }), {});
});

test('weather kinds and bad-weather rules (rain/snow likely, storms, very cold or hot)', () => {
  eq([0, 1, 2, 3, 45, 51, 63, 80, 71, 86, 95].map(wxKind), ['sun', 'sun', 'partly', 'cloud', 'fog', 'rain', 'rain', 'rain', 'snow', 'snow', 'storm']);
  const d = parseForecast(SAMPLE);
  eq(badWeather(d['2026-10-15'], 18 * 60), false);     // clear, 55° evening
  eq(badWeather(d['2026-10-16'], 18 * 60), false);     // cloudy, dry
  eq(badWeather(d['2026-10-17'], 18 * 60), true);      // rain 80%
  eq(badWeather(d['2026-10-18'], 10 * 60), true);      // snow + cold
  eq(badWeather(d['2026-10-19'], 18 * 60), true);      // thunderstorm
  eq(badWeather(d['2026-10-20'], 14 * 60), true);      // 99° high
  eq(wetLikely({ code: 61, hi: 60, lo: 50, pop: 20 }), false);   // drizzle code but only 20%: not bad
  eq(badWeather({ code: 0, hi: 40, lo: 20, pop: 0 }, 19 * 60), true);   // ~30° at night
  eq(badWeather({ code: 0, hi: 40, lo: 20, pop: 0 }, 13 * 60), false);  // 40° afternoon
  eq(dateTemp(d['2026-10-15'], 18 * 60), 55);
  eq(dateTemp(d['2026-10-15'], 11 * 60), 68);
  eq(badWeather(null), false);
});

test('getForecast: fetches once, reuses the cache for a few hours, then refreshes', async () => {
  const store = memStore(), f = okFetch(SAMPLE);
  const a = await getForecast({ fetchFn: f, storage: store, now: 1000 });
  eq(a['2026-10-17'].pop, 80);
  ok(store.m.has(WX_KEY), 'cached');
  await getForecast({ fetchFn: f, storage: store, now: 1000 + WX_FRESH - 1 });
  eq(f.count(), 1);
  await getForecast({ fetchFn: f, storage: store, now: 1000 + WX_FRESH + 1 });
  eq(f.count(), 2);
});

test('getForecast fails quietly: offline -> stale cache or null; broken storage is fine', async () => {
  eq(await getForecast({ fetchFn: failFetch, storage: memStore(), now: 0 }), null);
  const store = memStore();
  await getForecast({ fetchFn: okFetch(SAMPLE), storage: store, now: 0 });
  const stale = await getForecast({ fetchFn: failFetch, storage: store, now: WX_FRESH + 5 });
  eq(stale['2026-10-15'].hi, 68);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  eq((await getForecast({ fetchFn: okFetch(SAMPLE), storage: broken, now: 0 }))['2026-10-16'].code, 3);
  eq(await getForecast({ fetchFn: async () => ({ ok: false, status: 500 }), storage: null, now: 0 }), null);
  eq(await getForecast({ fetchFn: okFetch({ daily: {} }), storage: null, now: 0 }), null);
});
