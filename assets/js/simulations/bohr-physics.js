// ==========================================================================
// Bor postulatlari — fizika (DOM'siz).
// 1) Frank–Gers tajribasi: elektronlar simob (yoki neon) bug‘ida tezlashtiriladi; atom faqat aniq E₁ energiya
//    porsiyasini yutadi (statsionar holatlar) → anod toki I(U) da davriy maksimumlar, oralig‘i ΔU = E₁/e.
//    Model: tezlashtirish sohasida k-uyg‘otish W ≥ k·E₁ + δ_k da sodir bo‘ladi (δ ~ Exp(ε), ε — bug‘ zichligiga
//    bog‘liq); anodga faqat kinetik energiyasi tormozlovchi potensialdan katta elektronlar yetadi.
// 2) Vodorod spektri (Balmer seriyasi), difraksion panjara: 1/λ = R_H(1/2² − 1/n²), d·sinφ = kλ.
// ==========================================================================

export const H = 6.62607015e-34, C = 2.99792458e8, E = 1.602176634e-19, ME_MP = 1 / 1836.15267343;
export const R_INF = 10973731.568160; // m⁻¹
export const R_H = R_INF / (1 + ME_MP); // vodorod uchun (keltirilgan massa)
export const HC_EV_NM = (H * C) / E * 1e9; // 1239,84 eV·nm
export const RY_EV = (H * C * R_H) / E; // 13,598 eV

/* ------------------------------------------------------------------ Frank–Gers */

export const GASES = {
  Hg: { id: "Hg", name: "Simob", E1: 4.887, lineNm: 253.7, Uc: 2.1, Umax: 30, T: [140, 200], glow: "#a78bfa", visible: false },
  Ne: { id: "Ne", name: "Neon", E1: 18.7, lineNm: 585.2, Uc: 3.2, Umax: 80, T: [20, 20], glow: "#fb923c", visible: true },
};
/** Bug‘ zichligiga bog‘liq parametrlar: ε — uyg‘otishgacha qo‘shimcha energiya o‘rtachasi, σ — issiqlik yoyilishi, damp — umumiy sochilish. */
export function fhParams(gas, T) {
  const g = GASES[gas];
  if (gas === "Ne") return { eps: 1.2, sig: 0.55, damp: 1 };
  const x = Math.min(1, Math.max(0, (T - g.T[0]) / (g.T[1] - g.T[0]))); // 0 → 140°C, 1 → 200°C
  return { eps: 0.75 - 0.6 * x, sig: 0.32 - 0.12 * x, damp: 1 - 0.55 * x };
}
const erf = (x) => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
/** Anod toki I(U), nA. s = { gas, T, Ur }. Uyg‘otishlar soni n taqsimoti × tormozlovchi to‘siqdan o‘tish ehtimoli
 *  (elektronlar energiyasining issiqlik yoyilishi σ hisobga olingan, Φ — normal taqsimot funksiyasi). */
export function fhCurrent(U, { gas, T, Ur = 1.5 }) {
  const g = GASES[gas], { eps, sig, damp } = fhParams(gas, T), W = U - g.Uc;
  if (W <= 0) return 0;
  const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  let p = 0, prevGE = 1;
  for (let k = 0; k < 40; k++) {
    const geNext = W > (k + 1) * g.E1 ? 1 - Math.exp(-(W - (k + 1) * g.E1) / eps) : 0; // P(n ≥ k+1)
    p += Math.max(0, prevGE - geNext) * Phi((W - k * g.E1 - Ur) / sig);
    prevGE = geNext; if (geNext <= 0) break;
  }
  const scale = gas === "Hg" ? 2.2 : 0.35;
  return scale * damp * W ** 1.5 * p + 0.02 * W;
}
/** Haqiqiy maksimumlar (sonli qidiruv: ±1 V atrofidagi eng katta qiymat), V. */
export function fhMaxima(s) {
  const g = GASES[s.gas], h = 0.01, n = Math.round(g.Umax / h), v = [];
  for (let i = 0; i <= n; i++) v.push(fhCurrent(i * h, s));
  const w = Math.round(1 / h), out = [];
  for (let i = w; i <= n - w; i++) { if (v[i] < 0.05) continue; let ok = true; for (let j = i - w; j <= i + w; j++) if (v[j] > v[i] || (v[j] === v[i] && j < i)) { ok = false; break; } if (ok) out.push(Math.round(i * h * 100) / 100); }
  return out;
}
/** Uyg‘otish sodir bo‘ladigan joylar (katod→to‘r oralig‘i ulushida, 0..1) — yorug‘ qatlamlar. */
export function glowLayers(U, gas, T) {
  const g = GASES[gas], { eps } = fhParams(gas, T), W = U - g.Uc, out = [];
  for (let k = 1; k * g.E1 + eps < W; k++) out.push((k * g.E1 + eps) / W);
  return out;
}

/* ------------------------------------------------------------------ Vodorod spektri */

export const LINES = [
  { id: "a", n: 3, name: "H$_\\alpha$", plain: "Hα", color: "#ff2a1a", I: 1 },
  { id: "b", n: 4, name: "H$_\\beta$", plain: "Hβ", color: "#22c8ff", I: 0.5 },
  { id: "g", n: 5, name: "H$_\\gamma$", plain: "Hγ", color: "#6b4dff", I: 0.25 },
  { id: "d", n: 6, name: "H$_\\delta$", plain: "Hδ", color: "#8b2cff", I: 0.12 },
];
/** Balmer chizig‘i to‘lqin uzunligi (vakuum), nm. */
export const balmerNm = (n) => 1e9 / (R_H * (1 / 4 - 1 / (n * n)));
export const levelEv = (n) => -RY_EV / (n * n);
export const GRATINGS = { 300: { id: 300, d: 1e-3 / 300 }, 600: { id: 600, d: 1e-3 / 600 } };
/** k-tartibdagi difraksiya burchagi (gradus) yoki null. */
export function diffAngle(lamNm, k, d) { const s = (k * lamNm * 1e-9) / d; return Math.abs(s) < 1 ? (Math.asin(s) * 180) / Math.PI : null; }
/** Goniometr nol nuqtasining siljishi (o‘lchashda (φ_o‘ng − φ_chap)/2 bilan yo‘qotiladi). */
export const ZERO_OFFSET = 0.35;
/** Teleskop shkala o‘qishi φ_sh bo‘lganda ko‘rish maydonidagi chiziqlar: [{line, k, off (°)}], |off| < fov. */
export function linesInView(phiScale, gr, fov = 1.2) {
  const d = GRATINGS[gr].d, phi = phiScale - ZERO_OFFSET, out = [];
  for (const L of LINES) for (const k of [-3, -2, -1, 1, 2, 3]) {
    const a = diffAngle(balmerNm(L.n), k, d); if (a === null) continue;
    const off = a - phi; if (Math.abs(off) < fov) out.push({ line: L, k, off, ang: a });
  }
  if (Math.abs(phi) < fov) out.push({ line: null, k: 0, off: -phi, ang: 0 });
  return out;
}
