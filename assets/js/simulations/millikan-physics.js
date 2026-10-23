// ==========================================================================
// Milliken tajribasi — moy tomchilari (DOM'siz).
// Tomchiga og‘irlik (Arximed kuchi hisobga olingan) m'g = (4/3)πr³(ρ − ρ_h)g, elektr kuch qE (E = U/d)
// va Stoks qarshiligi 6πη_ef r v ta’sir qiladi; tezlik bir zumda barqarorlashadi. Kichik tomchilar uchun
// Kanningem tuzatmasi: η_ef = η/(1 + b/(p r)). Broun harakati: D = kT/(6πη_ef r).
// Koordinata y — yuqoriga (m), mikroskop ko‘rish maydoni markazi y = 0.
// ==========================================================================

export const QE = 1.602176634e-19;
export const RHO = 875.3, RHO_AIR = 1.204, G = 9.81, ETA = 1.827e-5, B_C = 8.2e-3, PRESS = 101325, KT = 1.380649e-23 * 293;
export const D_PL = 6.0e-3; // plastinalar orasidagi masofa, m
export const S_MEAS = 0.5e-3; // ikki o‘lchov chizig‘i orasidagi masofa, m
export const U_MAX = 600;
export const VIEW = 1.2e-3; // ko‘rish maydoni radiusi, m
export const etaEff = (r) => ETA / (1 + B_C / (PRESS * r));
export const mass = (r) => (4 / 3) * Math.PI * r ** 3 * (RHO - RHO_AIR);
/** Barqaror tezlik (yuqoriga musbat), m/s. field — +1 (kuch yuqoriga musbat zaryad uchun), 0, −1. */
export function vel(d, U, field) { const E = (field * U) / D_PL, F = d.n * QE * E - mass(d.r) * G; return F / (6 * Math.PI * etaEff(d.r) * d.r); }
export const vFall = (d) => -vel(d, 0, 0);
export const diff = (r) => KT / (6 * Math.PI * etaEff(r) * r);
/** Muvozanat kuchlanishi, V. */
export const uBal = (d) => (mass(d.r) * G * D_PL) / (d.n * QE);

/** Deterministik tasodifiy generator (urug‘ bilan). */
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const NPROB = [0, 0.22, 0.3, 0.24, 0.14, 0.07, 0.03];
export function pickN(R) { let x = R(), n = 1; for (; n < NPROB.length - 1; n++) { x -= NPROB[n]; if (x < 0) break; } return n; }
/** Yangi tomchi. */
export function makeDrop(id, R) {
  const r = (0.7 + 0.5 * R()) * 1e-6;
  return { id, r, n: pickN(R), hist: [], x: (R() * 1.6 - 0.8) * VIEW * 0.8, y: (R() * 1.4 - 0.2) * VIEW * 0.7 };
}
/** Gauss tasodifiy son. */
export function gauss(R) { let u = 0, v = 0; while (u === 0) u = R(); v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
/** Bir qadam: drift + Broun harakati. */
export function step(d, U, field, dt, R) {
  const s = Math.sqrt(2 * diff(d.r) * dt);
  d.y += vel(d, U, field) * dt + s * gauss(R); d.x += s * gauss(R);
}
/** Kutiladigan vaqtlar (s): S_MEAS masofani tushish / ko‘tarilish (U, field = +1 da). */
export const tFall = (d) => S_MEAS / vFall(d);
export const tRise = (d, U, n = d.n) => { const v = vel({ ...d, n }, U, 1); return v > 0 ? S_MEAS / v : Infinity; };
