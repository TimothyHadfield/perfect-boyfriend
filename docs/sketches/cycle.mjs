// Reference sketch of the recommended cycle predictor. Plain JS, no deps.
// Dates are 'YYYY-MM-DD' strings; all math in UTC days to avoid DST off-by-one.
const DAY = 86400000;
const toDay = (s) => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY);
const toStr = (d) => new Date(d * DAY).toISOString().slice(0, 10);

export const DEFAULTS = {
  popMean: 29,        // Bull 2019: 29.3; Flo JMIR 2020 ~28-29 median
  popBetweenSD: 4.5,  // spread of people's *typical* lengths (derived from Bull 5.2 total vs 2.6 within)
  popWithinSD: 2.6,   // Bull 2019: mean per-user SD 2.6 d
  priorStrength: 3,   // pseudo-cycles of population SD mixed into the user's SD
  halfLife: 6,        // cycles; exponential weight half-life
  maxCycles: 12,      // Clue uses last 12 for predictions
  luteal: 13,         // Apple/Clue count back 13; Bull mean 12.4 +/- 2.4
  lutealSD: 2,
  periodLen: 5,       // default when nothing logged (Bull mean 4.0, Clue 4.08)
  z: 1.28,            // 80% window
  minLen: 15, maxLen: 90,
};

function median(a) { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

export function cleanCycles(lengths, C = DEFAULTS) {
  const kept = [], flagged = [];
  const ok = lengths.filter((L) => L >= C.minLen && L <= C.maxLen);
  const med = ok.length >= 3 ? median(ok) : null;
  const cld = [];
  for (let i = 1; i < ok.length; i++) cld.push(Math.abs(ok[i] - ok[i - 1]));
  const medCLD = cld.length >= 2 ? median(cld) : null;
  for (const L of lengths) {
    if (L < C.minLen) { flagged.push({ L, why: 'too short (spotting or mis-log?)' }); continue; }
    if (L > C.maxLen) { flagged.push({ L, why: 'gap > 90 days (missed logs / pregnancy / BC?)' }); continue; }
    if (med != null) {
      const k = Math.round(L / med);
      if (k >= 2 && Math.abs(L - k * med) <= Math.max(4, 0.15 * L)) { flagged.push({ L, why: `looks like ${k} cycles with a skipped log` }); continue; }
      if (medCLD != null && L - med >= medCLD + 10) { flagged.push({ L, why: 'outlier long cycle (Clue rule)' }); continue; }
    }
    kept.push(L);
  }
  return { kept, flagged };
}

function normPdf(x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }
function normCdf(x) { // Abramowitz-Stegun 7.1.26 via erf
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export function predict({ starts, periodLengths = [], usualLength = null, today, mode = 'natural' }, C = DEFAULTS) {
  if (mode !== 'natural') return { paused: true, reason: mode };
  const days = [...new Set(starts)].map(toDay).sort((a, b) => a - b);
  if (!days.length) return { paused: true, reason: 'no period logged' };
  const raw = days.slice(1).map((d, i) => d - days[i]);
  const { kept, flagged } = cleanCycles(raw, C);
  const recent = kept.slice(-C.maxCycles);
  const n = recent.length;

  // exponentially weighted mean and SD of recent cycles (newest weight 1)
  let sw = 0, sw2 = 0, m = 0;
  recent.forEach((L, i) => { const w = Math.pow(0.5, (n - 1 - i) / C.halfLife); sw += w; sw2 += w * w; m += w * L; });
  m = n ? m / sw : 0;
  const nEff = n ? (sw * sw) / sw2 : 0;
  let userVar = 0;
  if (n >= 2) { const mu = recent.reduce((a, b) => a + b, 0) / n; userVar = recent.reduce((a, L) => a + (L - mu) ** 2, 0) / (n - 1); }
  // within-person SD: shrink toward population
  const k = C.priorStrength;
  const sigma2 = (k * C.popWithinSD ** 2 + Math.max(0, n - 1) * userVar) / (k + Math.max(0, n - 1));
  // typical length: normal-normal shrinkage toward prior (user's typed "usual length" beats population)
  const mu0 = usualLength ?? C.popMean;
  const tau2 = usualLength ? 2 ** 2 : C.popBetweenSD ** 2;
  const prec = 1 / tau2 + nEff / sigma2;
  const muHat = (mu0 / tau2 + (nEff * m) / sigma2) / prec;
  const predSD = Math.sqrt(sigma2 + 1 / prec);

  const last = days[days.length - 1];
  const daysSince = today ? toDay(today) - last : 0;
  let expLen = muHat, late = 0;
  if (daysSince > muHat) { // already past expected: condition on L > daysSince (truncated normal mean)
    const a = (daysSince - muHat) / predSD;
    expLen = Math.max(daysSince + 1, muHat + predSD * normPdf(a) / Math.max(1e-6, 1 - normCdf(a)));
    late = daysSince - Math.round(muHat); // days past the predicted start date
  }
  const half = Math.min(10, Math.max(2, Math.round(C.z * predSD)));
  const next = last + Math.round(expLen);
  const todayD = today ? toDay(today) : -Infinity;
  const pl = periodLengths.length ? Math.round(median(periodLengths.slice(-6))) : C.periodLen;
  const L = Math.round(muHat);
  const ov = L - C.luteal; // cycle day of ovulation (1-based day = ov)
  const ovSD = Math.sqrt(sigma2 + C.lutealSD ** 2);
  const range6 = recent.length >= 3 ? Math.max(...recent.slice(-6)) - Math.min(...recent.slice(-6)) : null;
  const irregular = (range6 != null && range6 > 9) || Math.sqrt(sigma2) > 4.5;
  return {
    nextStart: toStr(next), windowStart: toStr(Math.max(next - half, todayD)), windowEnd: toStr(next + half),
    typicalLength: +muHat.toFixed(1), sd: +predSD.toFixed(1), cyclesUsed: n, flagged, late: late > 0 ? late : 0,
    periodLength: pl, irregular,
    ovulationDay: toStr(last + ov - 1), ovulationUncertaintyDays: Math.round(C.z * ovSD),
    // widen like Flo does when unsure: pad by the ovulation uncertainty, total capped at ~14 days
    fertileWindow: (() => { const u = Math.min(4, Math.max(0, Math.round(C.z * ovSD) - 2));
      return [toStr(last + ov - 6 - u), toStr(last + ov - 1 + u)]; })(),
    phases: {
      menstrual: [1, pl], follicular: [pl + 1, Math.max(pl + 1, ov - 3)], ovulatory: [ov - 2, ov + 1],
      luteal: [ov + 2, L], pms: [Math.max(ov + 2, L - 4), L],
    },
  };
}
