// ==========================================================================
// Dispersiya, kamalak va qutblanish — fizika (DOM'siz).
// Dispersiya: Koshi formulasi n(λ) = A + B/λ² (λ mkm da), koeffitsiyentlar F (486,1 nm) va C (656,3 nm) chiziqlari
// bo'yicha haqiqiy shishalardan olingan. Kamalak: sferik tomchida 1 yoki 2 marta ichki qaytish, eng kichik og'ish.
// Qutblanish: Malyus qonuni I = I₀cos²θ, qutblanmagan nur polyaroiddan keyin I₀/2; Bryuster: tg α_B = n.
// ==========================================================================

import { fresnel, snell } from "./reflection-physics.js";

export const DEG = Math.PI / 180;

export const GLASSES = [
  { id: "crown", name: "Kron shisha (BK7)", A: 1.5044, B: 0.00424 },
  { id: "flint", name: "Flint shisha (F2)", A: 1.59428, B: 0.008927 },
  { id: "dflint", name: "Og‘ir flint (SF11)", A: 1.73893, B: 0.01595 },
  { id: "water", name: "Suv", A: 1.324, B: 0.00306 },
  { id: "diamond", name: "Olmos", A: 2.3791, B: 0.0133 },
];
export const glass = (id) => GLASSES.find((g) => g.id === id) || GLASSES[0];
/** Sindirish ko'rsatkichi: λ nm da. */
export const nOf = (g, nm) => g.A + g.B / ((nm / 1000) ** 2);
/** Abbe soni V = (n_d − 1)/(n_F − n_C): kichik — kuchli dispersiya. */
export const abbe = (g) => (nOf(g, 587.6) - 1) / (nOf(g, 486.1) - nOf(g, 656.3));

/* ------------------------------------------------------------------ Kamalak */

/** Tomchida og'ish (gradus): b — nishon parametri (0…1), k — ichki qaytishlar soni. D = k·180° + 2i − 2(k+1)r. */
export function dropDeviation(b, n, k = 1) {
  const i = Math.asin(b), r = Math.asin(b / n);
  return (k * Math.PI + 2 * i - 2 * (k + 1) * r) / DEG;
}
/** Kamalak burchagi (quyoshga qarama-qarshi nuqtadan): birlamchi — 180° − D_min, ikkilamchi — D_min − 180°. */
export function rainbowAngle(n, k = 1) {
  const c2 = (n * n - 1) / (k * k + 2 * k); // cos²i eng kichik og'ishda
  const i = Math.acos(Math.sqrt(c2)), b = Math.sin(i);
  const D = dropDeviation(b, n, k);
  return { b, D, angle: k % 2 ? 180 - D : D - 180 };
}

/* ------------------------------------------------------------------ Qutblanish */

/** Polyaroidlar zanjiri: angles — o'qlar burchaklari (gradus). Qaytaradi har bir polyaroiddan keyingi intensivlik (I₀ = 1). */
export function malusChain(angles) {
  const out = []; let I = 1, prev = null;
  for (const a of angles) {
    I = prev === null ? I / 2 : I * Math.cos((a - prev) * DEG) ** 2;
    out.push(I); prev = a;
  }
  return out;
}
/** Bryuster burchagi (gradus). */
export const brewsterAngle = (n1, n2) => Math.atan(n2 / n1) / DEG;
/**
 * Qaytgan nur analizator orqali: alpha — tushish burchagi, phi — analizator o'qi s-yo'nalishdan burchak (gradus).
 * Qutblanmagan tushuvchi nur (I₀ = 1): I = (Rs·cos²φ + Rp·sin²φ)/2. Qaytadi {Rs, Rp, R, I, P (qutblanish darajasi)}.
 */
export function reflectedThroughAnalyzer(n1, n2, alpha, phi) {
  const s = snell(n1, n2, alpha);
  const Rs = s.tir ? 1 : s.Rs, Rp = s.tir ? 1 : s.Rp;
  const c = Math.cos(phi * DEG) ** 2;
  return { Rs, Rp, R: (Rs + Rp) / 2, I: (Rs * c + Rp * (1 - c)) / 2, P: Rs + Rp > 0 ? (Rs - Rp) / (Rs + Rp) : 0 };
}
export { fresnel };
