// ==========================================================================
// Atmosfera bosimi — fizika (DOM'siz; simulations/atmosphere.html).
// Torichelli: suyuqlik ustuni balandligi h = p/(ρg); nay qiyalatilsa vertikal balandlik o'zgarmaydi.
// Standart atmosfera (ISA, troposfera 0–11 km): T = T₀ − Lh, p = p₀(T/T₀)^(gM/(RL)); 11 km dan yuqori — izotermik.
// Havo zichligi ρ = pM/(RT). Suvning qaynash temperaturasi — pₛ(t) = p (humidity-physics, Bak formulasi).
// Magdeburg yarim sharlari: nasos har yurishda p ← p·V/(V + V_n) (nasos chegarasi p_min), ajratish kuchi F = (p₀ − p)πR².
// ==========================================================================

import { pSatWater } from "./humidity-physics.js";

export const G = 9.80665;          // m/s²
export const P0 = 101325;          // normal atmosfera bosimi, Pa
export const MMHG = 133.322;       // 1 mm sim. ust., Pa
export const T0 = 288.15, LAPSE = 0.0065, M_AIR = 0.0289644, R = 8.31446;
export const LIQUIDS = {
  hg: { name: "simob", rho: 13595 },
  water: { name: "suv", rho: 1000 },
};

/** Suyuqlik ustuni balandligi, m */
export const columnHeight = (p, rho) => p / (rho * G);

/**
 * Qiya nay: nay uzunligi Lt (m), vertikaldan og'ish burchagi a (rad), atmosfera bosimi p.
 * Qaytaradi: vertikal ustun hv, nay bo'ylab uzunlik len, nay to'liq to'lganmi (bo'shliq yo'q) va nay tepasidagi bosim.
 */
export function tube(p, rho, Lt, a) {
  const h = columnHeight(p, rho), top = Lt * Math.cos(a);
  if (top <= h) return { hv: top, len: Lt, full: true, pTop: p - rho * G * top, h };
  return { hv: h, len: h / Math.cos(a), full: false, pTop: 0, h };
}

/** Standart atmosfera: h (m) → { T (K), p (Pa), rho (kg/m³) } */
export function isa(h) {
  const k = (G * M_AIR) / (R * LAPSE);
  let T, p;
  if (h <= 11000) { T = T0 - LAPSE * h; p = P0 * (T / T0) ** k; }
  else { const T11 = T0 - LAPSE * 11000, p11 = P0 * (T11 / T0) ** k; T = T11; p = p11 * Math.exp((-G * M_AIR * (h - 11000)) / (R * T11)); }
  return { T, p, rho: (p * M_AIR) / (R * T) };
}
/** Balandlik bosimdan (teskari), m */
export function altitudeOf(p) { let lo = -500, hi = 20000; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (isa(m).p > p) lo = m; else hi = m; } return (lo + hi) / 2; }
/** Yer yaqinida 1 mm sim. ust. ga to'g'ri keladigan balandlik, m */
export const metersPerMmHg = () => MMHG / (isa(0).rho * G);

/** Suvning qaynash temperaturasi berilgan bosimda, °C */
export function boilingPoint(p) { let lo = 0, hi = 120; for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; if (pSatWater(m) > p) hi = m; else lo = m; } return (lo + hi) / 2; }

/** Germetik paket (izotermik): hajm nisbati V/V₀ = p₀/p */
export const bagRatio = (p, pStart = P0) => pStart / p;

/* ------------------------------------------------------------------ Magdeburg yarim sharlari */

/** n yurishdan keyingi ichki bosim: V — shar hajmi, Vp — nasos silindri hajmi, pMin — nasos chegarasi */
export function pumped(n, V, Vp, pOut = P0, pMin = 0) {
  const r = V / (V + Vp);
  return pMin + (pOut - pMin) * r ** n;
}
/** Ajratish uchun kerakli kuch, N (R — shar radiusi, m) */
export const pullForce = (pIn, Rad, pOut = P0) => Math.max(0, pOut - pIn) * Math.PI * Rad * Rad;
/** Shar hajmi */
export const sphereVolume = (Rad) => (4 / 3) * Math.PI * Rad ** 3;
