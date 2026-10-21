// ==========================================================================
// Mayatnik fizikasi (DOM'siz) — matematik ham, fizik mayatnik ham shu yadrodan foydalanadi.
//
// Umumiy harakat tenglamasi (burchak θ — vertikaldan pastga qarab o'lchanadi):
//     θ'' = −ω₀² · sin θ − γ · θ' + f · cos(Ω t)
//   ω₀² = g / L            — matematik mayatnik (L — ip uzunligi)
//   ω₀² = m g d / I        — fizik mayatnik (d — osish nuqtasidan massa markazigacha, I — inersiya momenti)
//   γ                       — viskoz (chiziqli) ishqalanish koeffitsiyenti, 1/s
//   f, Ω                    — majburlovchi moment (burchak tezlanishi birligida) va uning chastotasi
//
// Integrallash: 4-tartibli Runge–Kutta, qadam 2 ms. Energiya saqlanishi tekshirilgan (pendulum testi).
// Aniq davr: to'liq elliptik integral K orqali (arifmetik-geometrik o'rta, AGM).
// ==========================================================================

export const TAU = 2 * Math.PI;
export const H_MAX = 0.002; // s

/* ------------------------------------------------------------------ Elliptik integral va aniq davr */

/** Arifmetik-geometrik o'rta. */
export function agm(a, b) {
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return a;
}

/** Katta amplituda uchun nisbat: T(θm) / T₀ = 2K(sin θm/2)/π = 1 / AGM(1, cos(θm/2)). */
export function periodRatio(thetaMax) {
  return 1 / agm(1, Math.cos(Math.min(thetaMax, Math.PI - 1e-9) / 2));
}

/** Kichik tebranish davri T₀ = 2π / ω₀. */
export const smallPeriod = (w2) => TAU / Math.sqrt(w2);

/** Taxminiy qator: T ≈ T₀ (1 + θ²/16 + 11θ⁴/3072) — qiyoslash uchun. */
export const seriesRatio = (th) => 1 + th ** 2 / 16 + (11 * th ** 4) / 3072;

/**
 * Hozirgi holat uchun harakat turi va aniq davr (ishqalanishsiz, majburlovchi kuchsiz yaqinlashishda).
 * eper = ½ω² + ω₀²(1 − cosθ)  — massa va inersiya birligiga keltirilgan energiya.
 * Qaytaradi: { mode: "rest"|"oscillation"|"separatrix"|"rotation", amplitude (rad), period (s) }
 */
export function motionInfo(s, w2) {
  const eper = specificEnergy(s, w2);
  const w0 = Math.sqrt(w2);
  const T0 = TAU / w0;
  if (eper < 1e-12) return { mode: "rest", amplitude: 0, period: T0, eper };
  if (eper < 2 * w2 * (1 - 1e-9)) {
    const amp = Math.acos(Math.max(-1, 1 - eper / w2));
    return { mode: "oscillation", amplitude: amp, period: T0 * periodRatio(amp), eper };
  }
  if (eper <= 2 * w2 * (1 + 1e-9)) return { mode: "separatrix", amplitude: Math.PI, period: Infinity, eper };
  // Aylanish: T = 4 K(κ) / ω_c,  κ² = 2ω₀²/eper,  ω_c = √(2 eper)
  const kappa2 = (2 * w2) / eper;
  const K = Math.PI / (2 * agm(1, Math.sqrt(1 - kappa2)));
  return { mode: "rotation", amplitude: Infinity, period: (4 * K) / Math.sqrt(2 * eper), eper };
}

/* ------------------------------------------------------------------ Energiya */

/** Massa (yoki inersiya momenti) birligiga keltirilgan: ½ω² + ω₀²(1 − cos θ). */
export const specificEnergy = (s, w2) => 0.5 * s.w * s.w + w2 * (1 - Math.cos(s.th));
export const specificKinetic = (s) => 0.5 * s.w * s.w;
export const specificPotential = (s, w2) => w2 * (1 - Math.cos(s.th));

/* ------------------------------------------------------------------ Integrator */

/** Harakat tenglamasi. p: { w2, gamma, f, Om, linear } */
function acc(th, w, t, p) {
  const restoring = p.linear ? th : Math.sin(th);
  return -p.w2 * restoring - p.gamma * w + (p.f ? p.f * Math.cos(p.Om * t) : 0);
}

/** RK4 qadami: s = {th, w, t} → yangi s. */
export function rk4(s, p, h) {
  const { th, w, t } = s;
  const k1t = w,                 k1w = acc(th, w, t, p);
  const k2t = w + 0.5 * h * k1w, k2w = acc(th + 0.5 * h * k1t, k2t, t + 0.5 * h, p);
  const k3t = w + 0.5 * h * k2w, k3w = acc(th + 0.5 * h * k2t, k3t, t + 0.5 * h, p);
  const k4t = w + h * k3w,       k4w = acc(th + h * k3t, k4t, t + h, p);
  return {
    th: th + (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t),
    w: w + (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w),
    t: t + h,
  };
}

/**
 * dt vaqtga oldinga yurish (ichki qadamlar ≤ H_MAX). Har ichki qadamdan keyin onSub(prev, next) chaqiriladi.
 */
export function advance(s, p, dt, onSub) {
  if (dt <= 0) return s;
  const n = Math.max(1, Math.ceil(dt / H_MAX - 1e-9));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const next = rk4(s, p, h);
    if (onSub) onSub(s, next);
    s = next;
  }
  return s;
}

/* ------------------------------------------------------------------ Davr o'lchagich (sekundomer) */

/**
 * Muvozanat holatidan (θ = 2πk) bir yo'nalishda ketma-ket o'tishlar orasidagi vaqtni o'lchaydi.
 * Tebranishda ham, aylanishda ham ishlaydi. feed(prev, next) — har ichki qadamda chaqiriladi.
 *  period — oxirgi o'lchangan davr; mean — barcha to'liq tebranishlar bo'yicha o'rtacha; count — to'liq tebranishlar soni.
 */
export function createPeriodMeter() {
  const m = {
    period: null, mean: null, count: 0,
    _last: { 1: null, "-1": null }, _anchorDir: 0, _anchorT0: null, _anchorT: null,
    reset() {
      m.period = null; m.mean = null; m.count = 0;
      m._last = { 1: null, "-1": null }; m._anchorDir = 0; m._anchorT0 = null; m._anchorT = null;
    },
    feed(a, b) {
      const ka = Math.floor(a.th / TAU), kb = Math.floor(b.th / TAU);
      if (ka === kb) return;
      const dir = kb > ka ? 1 : -1;
      const target = TAU * Math.max(ka, kb);
      const tc = a.t + ((target - a.th) / (b.th - a.th)) * (b.t - a.t);
      const prev = m._last[dir];
      if (prev !== null) m.period = tc - prev;
      m._last[dir] = tc;
      if (!m._anchorDir) { m._anchorDir = dir; m._anchorT0 = tc; return; }
      if (dir === m._anchorDir) {
        m.count += 1;
        m._anchorT = tc;
        m.mean = (tc - m._anchorT0) / m.count;
      }
    },
  };
  return m;
}

/* ------------------------------------------------------------------ Yordamchilar */

/** θ ni (−π, π] oralig'iga keltirish. */
export function wrapAngle(th) {
  let x = (th + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
}

/** Sodda "yaxshi" qadam (grafik o'qlari uchun): 1, 2, 5 × 10ⁿ. */
export function niceStep(span, target = 5) {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag;
}
