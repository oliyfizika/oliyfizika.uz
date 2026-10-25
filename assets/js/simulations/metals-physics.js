// ==========================================================================
// Metallarda elektr toki — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_metals.mjs)
// - Erkin elektronlar: tok kuchi I = enSv, tok zichligi j = I/S = env (v — tartibli harakat (dreyf) tezligi).
// - Elektronlarning tartibsiz (issiqlik) harakati tezligi (klassik baho): v = √(3kT/m) ~ 10⁵ m/s.
// - Qarshilik: R = ρl/S; temperaturaga bog'liqligi R = R₀(1 + αt) (R₀ — 0 °C da).
// - O'ta o'tkazuvchanlik: simob T < T_k = 4,15 K da R = 0 (Kamerling-Onnes, 1911).
// Birliklar: SI.
// ==========================================================================

export const E = 1.602e-19;    // elektron zaryadi, C
export const ME = 9.109e-31;   // elektron massasi, kg
export const KB = 1.381e-23;   // Bolsman doimiysi, J/K
export const C = 2.998e8;      // yorug'lik tezligi (elektr maydon tarqalishi), m/s

/** Metallar: rho20 — 20 °C dagi solishtirma qarshilik (Ω·m), alpha — temperatura koeffitsiyenti (1/K),
 *  n — erkin elektronlar konsentratsiyasi (1/m³; qotishmalar uchun null), tMax — sahnadagi eng yuqori temperatura (°C) */
export const METALS = {
  silver: { name: "Kumush", rho20: 1.6e-8, alpha: 4.1e-3, n: 5.86e28, tMax: 900, color: [203, 213, 225] },
  copper: { name: "Mis", rho20: 1.7e-8, alpha: 4.3e-3, n: 8.5e28, tMax: 1000, color: [217, 119, 6] },
  aluminum: { name: "Alyuminiy", rho20: 2.8e-8, alpha: 4.2e-3, n: 18.1e28, tMax: 600, color: [148, 163, 184] },
  iron: { name: "Temir", rho20: 1.0e-7, alpha: 6.0e-3, n: 17.0e28, tMax: 1000, color: [100, 116, 139] },
  tungsten: { name: "Volfram", rho20: 5.5e-8, alpha: 4.6e-3, n: null, tMax: 2500, color: [161, 161, 170] },
  nichrome: { name: "Nixrom", rho20: 1.1e-6, alpha: 1.0e-4, n: null, tMax: 1000, color: [120, 113, 108] },
  constantan: { name: "Konstantan", rho20: 5.0e-7, alpha: 2.0e-5, n: null, tMax: 500, color: [180, 142, 98] },
};

/** Dreyf tezligi v = I/(enS) */
export const driftSpeed = (I, n, S) => I / (E * n * S);
/** Tok zichligi j = I/S */
export const currentDensity = (I, S) => I / S;
/** Tok kuchi I = enSv */
export const currentFrom = (n, S, v) => E * n * S * v;
/** Elektronning tartibsiz harakati tezligi (klassik baho) √(3kT/m), T — kelvin */
export const thermalSpeed = (T) => Math.sqrt((3 * KB * T) / ME);
/** Elektron l masofani dreyf tezligi bilan bosib o'tish vaqti (s) */
export const travelTime = (l, v) => l / v;

/** Qarshilik R = ρl/S */
export const resistance = (rho, l, S) => (rho * l) / S;
/** 0 °C dagi solishtirma qarshilik (jadvaldagi 20 °C qiymatidan) */
export const rho0 = (m) => m.rho20 / (1 + m.alpha * 20);
/** ρ(t) = ρ₀(1 + αt), t — °C */
export const rhoAt = (m, t) => rho0(m) * (1 + m.alpha * t);
/** R(t) = R₀(1 + αt) */
export const Rt = (R0, alpha, t) => R0 * (1 + alpha * t);
/** Ikki o'lchashdan α: α = (R₂ − R₁)/(R₁t₂ − R₂t₁) */
export const alphaFrom = (R1, t1, R2, t2) => (R2 - R1) / (R1 * t2 - R2 * t1);

/** O'ta o'tkazuvchanlik: simob (T — kelvin). R0 — 0 °C dagi qarshilik. Kritik temperaturada keskin nolga tushadi. */
export const HG_TC = 4.15;
export const HG_RES = 0.0013; // R(4,2 K)/R(0 °C) — qoldiq qarshilik nisbati
export function mercuryR(R0, T) {
  if (T <= HG_TC - 0.01) return 0;
  const normal = R0 * HG_RES * (1 + 0.04 * (T - 4.2));
  if (T >= HG_TC + 0.01) return normal;
  return normal * (T - (HG_TC - 0.01)) / 0.02; // ~0,02 K kenglikdagi o'tish
}
