// ==========================================================================
// Elektromagnit to'lqinlar va radioaloqa — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_emwaves.mjs)
// - Yassi EM to'lqin: E = E₀cos(ωt − kx), B = E/v, v = c/n, λ = v/ν. EM spektr diapazonlari.
// - Xossalari: qaytish (α = β), sinish (n₁sinα = n₂sinβ), qutblanish (qabul qiluvchi vibrator: P ∝ cos²φ).
// - Radioaloqa: AM va FM modulyatsiya, qabul qiluvchi LC kontur rezonansi (aslilik Q), diodli detektor (RC filtr).
// ==========================================================================

export const C = 299792458;
export const EPS0 = 8.8541878128e-12;
export const MU0 = 1.25663706212e-6;

/** To'lqin uzunligi (m) */
export const lambdaOf = (nu, n = 1) => C / (n * nu);
/** Muhitdagi tezlik */
export const speedIn = (n = 1) => C / n;
/** Yassi to'lqin maydonlari: x (m), t (s). B = E/v */
export function fields(x, t, { E0 = 1, nu, n = 1 }) {
  const w = 2 * Math.PI * nu, k = (w * n) / C, ph = w * t - k * x, E = E0 * Math.cos(ph);
  return { E, B: E / speedIn(n), ph };
}
/** Energiya oqimi zichligi (intensivlik, vakuumda): I = cε₀E₀²/2 */
export const intensity = (E0) => (C * EPS0 * E0 * E0) / 2;

/** EM spektr diapazonlari (chastota bo'yicha, Hz) */
export const BANDS = [
  { id: "radio", name: "Radioto‘lqinlar", from: 3e3, to: 3e8, color: "#64748b" },
  { id: "micro", name: "Mikroto‘lqinlar", from: 3e8, to: 3e11, color: "#0ea5e9" },
  { id: "ir", name: "Infraqizil", from: 3e11, to: 4e14, color: "#dc2626" },
  { id: "vis", name: "Ko‘rinadigan yorug‘lik", from: 4e14, to: 7.9e14, color: "#22c55e" },
  { id: "uv", name: "Ultrabinafsha", from: 7.9e14, to: 3e16, color: "#8b5cf6" },
  { id: "xray", name: "Rentgen nurlari", from: 3e16, to: 3e19, color: "#2563eb" },
  { id: "gamma", name: "Gamma-nurlanish", from: 3e19, to: 1e22, color: "#0f172a" },
];
export const bandOf = (nu) => BANDS.find((b) => nu >= b.from && nu < b.to) || (nu < BANDS[0].from ? BANDS[0] : BANDS[BANDS.length - 1]);
/** Radioto'lqinlar ichidagi nomlar (O'zbekistonda qabul qilingan) */
export function radioBand(nu) {
  if (nu < 3e5) return "uzun to‘lqinlar (UT)";
  if (nu < 3e6) return "o‘rta to‘lqinlar (O‘T)";
  if (nu < 3e7) return "qisqa to‘lqinlar (QT)";
  if (nu < 3e8) return "ultraqisqa to‘lqinlar (UQT)";
  if (nu < 3e9) return "detsimetrli to‘lqinlar (UQT, televideniye, mobil aloqa)";
  return "";
}
/** Ko'rinadigan yorug'lik rangi (taxminiy) */
export function visibleColor(nu) {
  const l = lambdaOf(nu) * 1e9;
  if (l < 380 || l > 750) return null;
  if (l < 450) return "#7c3aed"; if (l < 495) return "#2563eb"; if (l < 570) return "#16a34a"; if (l < 590) return "#eab308"; if (l < 620) return "#f97316"; return "#dc2626";
}

/* ------------------------------------------------------------------ Xossalari */

/** Sinish: n₁ sinα = n₂ sinβ. To'la ichki qaytishda null. Burchaklar — radian. */
export function refractAngle(n1, n2, a) { const s = (n1 / n2) * Math.sin(a); return Math.abs(s) > 1 ? null : Math.asin(s); }
/** Qaytish koeffitsiyenti (Frenel, qutblanmagan to'lqin uchun o'rtacha) */
export function reflectance(n1, n2, a) {
  const b = refractAngle(n1, n2, a); if (b === null) return 1;
  const ci = Math.cos(a), ct = Math.cos(b);
  const rs = ((n1 * ci - n2 * ct) / (n1 * ci + n2 * ct)) ** 2, rp = ((n1 * ct - n2 * ci) / (n1 * ct + n2 * ci)) ** 2;
  return (rs + rp) / 2;
}
/** Qutblanish: qabul qiluvchi vibrator E ga φ burchak ostida — signal quvvati cos²φ */
export const receiverPower = (phi) => Math.cos(phi) ** 2;

/* ------------------------------------------------------------------ Radioaloqa */

/** AM: s(t) = A(1 + m cos Ωt) cos ωt */
export const amSignal = (t, { f, F, m, A = 1 }) => A * (1 + m * Math.cos(2 * Math.PI * F * t)) * Math.cos(2 * Math.PI * f * t);
/** FM: s(t) = A cos(ωt + β sin Ωt), β = Δf/F (modulyatsiya indeksi) */
export const fmSignal = (t, { f, F, df, A = 1 }) => A * Math.cos(2 * Math.PI * f * t + (df / F) * Math.sin(2 * Math.PI * F * t));
/** FM oniy chastotasi */
export const fmFreq = (t, { f, F, df }) => f + df * Math.cos(2 * Math.PI * F * t);

/** LC kontur rezonans chastotasi */
export const resonance = (L, Cc) => 1 / (2 * Math.PI * Math.sqrt(L * Cc));
/** Kerakli sig'im */
export const capFor = (L, f) => 1 / (4 * Math.PI * Math.PI * f * f * L);
/** Kontur javobi (amplituda nisbati): A = 1/√(1 + Q²(f/f₀ − f₀/f)²) */
export const response = (f, f0, Q) => 1 / Math.sqrt(1 + Q * Q * (f / f0 - f0 / f) ** 2);
/** O'tkazish polosasi (−3 dB): Δf = f₀/Q */
export const bandwidth = (f0, Q) => f0 / Q;

/**
 * Diodli detektor: to'g'rilash + RC filtr (birinchi tartibli). samples — vaqt bo'yicha teng qadamli signal.
 * Qaytaradi chiqish kuchlanishi massivini. tau = RC.
 */
/** Detektor uchun mos RC: 1/f ≪ τ ≪ 1/F; geometrik o'rtacha atrofida (τ = 2/√(fF)) xato eng kichik */
export const detectorTau = (f, F) => 2 / Math.sqrt(f * F);
export function detect(samples, dt, tau) {
  const out = new Array(samples.length); let v = 0;
  for (let k = 0; k < samples.length; k++) {
    const s = Math.max(0, samples[k]);
    if (s > v) v = s; // kondensator diod orqali tez zaryadlanadi
    else v -= (v * dt) / tau; // rezistor orqali sekin razryad
    out[k] = v;
  }
  return out;
}
