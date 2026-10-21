// ==========================================================================
// Prujinali mayatnik fizikasi (DOM'siz).
//
// x — massaning MUVOZANAT holatidan siljishi (pastga / o'ngga musbat). Harakat tenglamasi:
//     m x″ = −k x − b x′ + F₀ cos(Ω t)
// Gorizontal ham, vertikal ham shu tenglamaga keladi: vertikal holda og'irlik kuchi faqat
// muvozanat nuqtasini mg/k ga siljitadi (Δl = mg/k), davr esa g ga bog'liq emas.
//   ω₀ = √(k/m),  T = 2π√(m/k),  γ = b/m,  ω_d = √(ω₀² − γ²/4),  Q = ω₀/γ
// Integrallash: RK4 (qadam ≤ 2 ms va ≤ 0,03/ω₀). Ishqalanishsiz/majburlovchi kuchsiz holat uchun aniq yechim ham bor.
// ==========================================================================

export const TAU = 2 * Math.PI;
export const G_EARTH = 9.81;

/* ------------------------------------------------------------------ Prujinalar ulanishi */

/** Ekvivalent qattiqlik: bitta / parallel (k₁+k₂) / ketma-ket (k₁k₂/(k₁+k₂)). */
export function effectiveK(mode, k1, k2) {
  if (mode === "parallel") return k1 + k2;
  if (mode === "series") return (k1 * k2) / (k1 + k2);
  return k1;
}

/** Ketma-ket ulanishda oraliq nuqta (birlashma) ning siljishi: x₁ = x · k₂/(k₁+k₂). */
export const jointShare = (k1, k2) => k2 / (k1 + k2);

/* ------------------------------------------------------------------ Parametrlar va nazariya */

/** P: { m, k, b, f (N), Om (rad/s) } → integrator parametrlari. */
export function dynParams(P) {
  return { w2: P.k / P.m, gamma: P.b / P.m, f: P.f / P.m, Om: P.Om };
}

export const omega0 = (k, m) => Math.sqrt(k / m);
export const period0 = (k, m) => TAU * Math.sqrt(m / k);

/** So'nish rejimi. bc = 2√(km) — kritik qarshilik. */
export function regime(k, m, b) {
  const w0 = omega0(k, m), gamma = b / m, bc = 2 * Math.sqrt(k * m);
  if (b <= 1e-12) return { type: "none", w0, gamma, wd: w0, Q: Infinity, bc, T: TAU / w0 };
  const disc = w0 * w0 - (gamma * gamma) / 4;
  if (Math.abs(disc) < 1e-9 * w0 * w0) return { type: "critical", w0, gamma, wd: 0, Q: w0 / gamma, bc, T: Infinity };
  if (disc > 0) { const wd = Math.sqrt(disc); return { type: "under", w0, gamma, wd, Q: w0 / gamma, bc, T: TAU / wd }; }
  return { type: "over", w0, gamma, wd: 0, Q: w0 / gamma, bc, T: Infinity };
}

/** Erkin harakat (f = 0) uchun aniq yechim: { x, v } t vaqtda. */
export function exactFree(x0, v0, w0, gamma, t) {
  const disc = w0 * w0 - (gamma * gamma) / 4;
  const e = Math.exp((-gamma * t) / 2);
  if (Math.abs(disc) < 1e-9 * w0 * w0) {                 // kritik
    const c2 = v0 + (gamma / 2) * x0;
    return { x: e * (x0 + c2 * t), v: e * (c2 - (gamma / 2) * (x0 + c2 * t)) };
  }
  if (disc > 0) {                                          // susayuvchi tebranish
    const wd = Math.sqrt(disc), B = (v0 + (gamma / 2) * x0) / wd;
    const c = Math.cos(wd * t), s = Math.sin(wd * t);
    return { x: e * (x0 * c + B * s), v: e * (-(gamma / 2) * (x0 * c + B * s) + (-x0 * wd * s + B * wd * c)) };
  }
  const r = Math.sqrt(-disc), l1 = -gamma / 2 + r, l2 = -gamma / 2 - r;   // aperiodik
  const a = (v0 - l2 * x0) / (l1 - l2), b = x0 - a;
  return { x: a * Math.exp(l1 * t) + b * Math.exp(l2 * t), v: a * l1 * Math.exp(l1 * t) + b * l2 * Math.exp(l2 * t) };
}

/** Majburiy tebranishning turg'un amplitudasi (m): (F₀/m) / √((ω₀² − Ω²)² + (γΩ)²). */
export function steadyAmplitude(k, m, b, F0, Om) {
  const w2 = k / m, g = b / m;
  const den = Math.sqrt((w2 - Om * Om) ** 2 + (g * Om) ** 2);
  return den > 1e-12 ? F0 / m / den : Infinity;
}

/** Tebranish amplitudasi (energiyadan): A = √(x² + (v/ω₀)²). */
export const amplitudeOf = (x, v, w0) => Math.sqrt(x * x + (v / w0) ** 2);

/* ------------------------------------------------------------------ Energiya */

export const kinetic = (v, m) => 0.5 * m * v * v;
export const elastic = (x, k) => 0.5 * k * x * x;           // muvozanatga nisbatan: gorizontal ½kx²; vertikal — og'irlik bilan birga

/** Vertikal: prujina to'liq cho'zilishi e = Δl + x. U_el = ½ k e², U_g = −m g x (muvozanatga nisbatan). */
export function verticalEnergies(x, v, m, k, g) {
  const e = (m * g) / k + x;
  return { kin: 0.5 * m * v * v, el: 0.5 * k * e * e, grav: -m * g * x };
}

/* ------------------------------------------------------------------ Integrator */

const H_MAX = 0.002;
const acc = (x, v, t, p) => -p.w2 * x - p.gamma * v + (p.f ? p.f * Math.cos(p.Om * t) : 0);

export function rk4(s, p, h) {
  const { x, v, t } = s;
  const k1x = v,                 k1v = acc(x, v, t, p);
  const k2x = v + 0.5 * h * k1v, k2v = acc(x + 0.5 * h * k1x, k2x, t + 0.5 * h, p);
  const k3x = v + 0.5 * h * k2v, k3v = acc(x + 0.5 * h * k2x, k3x, t + 0.5 * h, p);
  const k4x = v + h * k3v,       k4v = acc(x + h * k3x, k4x, t + h, p);
  return { x: x + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x), v: v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v), t: t + h };
}

export function advance(s, p, dt, onSub) {
  if (dt <= 0) return s;
  const hMax = Math.min(H_MAX, 0.03 / Math.sqrt(p.w2));
  const n = Math.max(1, Math.ceil(dt / hMax - 1e-9));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const nx = rk4(s, p, h);
    if (onSub) onSub(s, nx);
    s = nx;
  }
  return s;
}

/* ------------------------------------------------------------------ Davr o'lchagich */

/** x = 0 dan yuqoriga (pastdan tepaga) ketma-ket o'tishlar orasidagi vaqt. */
export function createPeriodMeter() {
  const m = {
    period: null, mean: null, count: 0, _t0: null, _last: null,
    reset() { m.period = null; m.mean = null; m.count = 0; m._t0 = null; m._last = null; },
    feed(a, b) {
      if (!(a.x < 0 && b.x >= 0)) return;
      const tc = a.t + ((0 - a.x) / (b.x - a.x)) * (b.t - a.t);
      if (m._last !== null) m.period = tc - m._last;
      m._last = tc;
      if (m._t0 === null) { m._t0 = tc; return; }
      m.count += 1;
      m.mean = (tc - m._t0) / m.count;
    },
  };
  return m;
}
