// ==========================================================================
// Havo namligi va atmosfera hodisalari — fizika (DOM'siz; simulations/humidity.html).
// To'yingan bug' bosimi: Bak formulasi (A. Buck, 1996; suv ustida t ≥ 0, muz ustida t < 0; 0…100 °C da xatosi < 0,1 %).
// Absolyut namlik ρ = pM/(RT), nisbiy namlik φ = p/pₛ = ρ/ρₛ, shudring (qirov) nuqtasi — pₛ(t_d) = p tenglamasining yechimi.
// Psixrometr: pₛ(t_h) − A·p·(t − t_h) = p (A — psixrometrik koeffitsiyent), ho'l termometr t_h — bisektsiya bilan.
// Kondensatsion gigrometr: idish sirti t_d gacha soviganda shudring paydo bo'ladi.
// Atmosfera: sutkalik temperatura, havodagi suv miqdori saqlanadi; t ≤ t_d bo'lsa shudring/qirov/tuman;
// bulut asosi balandligi h ≈ (t − t_d)/(Γ_a − Γ_d) (Espi formulasi, ≈ 122 m/°C).
// ==========================================================================

export const R = 8.314;          // J/(mol·K)
export const MW = 0.018015;      // suv molyar massasi, kg/mol
export const P0 = 101325;        // normal atmosfera bosimi, Pa
export const A_PSY = 6.62e-4;    // aspiratsion psixrometr koeffitsiyenti, 1/K (maktab psixrometrik jadvali shunga mos)
export const GAMMA_A = 9.8;      // quruq adiabatik gradient, °C/km
export const GAMMA_D = 1.6;      // ko'tarilayotgan havoda shudring nuqtasining pasayishi, °C/km

/** Suv ustidagi to'yingan bug' bosimi, Pa */
export const pSatWater = (t) => 611.21 * Math.exp((18.678 - t / 234.5) * (t / (257.14 + t)));
/** Muz ustidagi to'yingan bug' bosimi, Pa */
export const pSatIce = (t) => 611.15 * Math.exp((23.036 - t / 333.7) * (t / (279.82 + t)));
/** To'yingan bug' bosimi: t ≥ 0 — suv, t < 0 — muz ustida, Pa */
export const pSat = (t) => (t >= 0 ? pSatWater(t) : pSatIce(t));

function invert(f, p, lo = -80, hi = 120) {
  for (let i = 0; i < 90; i++) { const m = (lo + hi) / 2; if (f(m) > p) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

/** Bug' zichligi (absolyut namlik), g/m³ */
export const rhoOf = (p, t) => (p * MW * 1000) / (R * (t + 273.15));
/** Bosim zichlikdan, Pa */
export const pOf = (rho, t) => (rho / 1000) * R * (t + 273.15) / MW;
/** To'yingan bug' zichligi, g/m³ */
export const rhoSat = (t) => rhoOf(pSat(t), t);

/** Shudring nuqtasi (suv ustida), °C */
export const dewPointWater = (p) => invert(pSatWater, p);
/** Qirov nuqtasi (muz ustida), °C */
export const frostPoint = (p) => invert(pSatIce, p);
/** Shudring nuqtasi: 0 °C dan yuqori bo'lsa suv ustida, aks holda qirov nuqtasi */
export function dewPoint(p) { const td = dewPointWater(p); return td >= 0 ? td : frostPoint(p); }

/** Nisbiy namlik (0…1) */
export const phiOf = (p, t) => p / pSat(t);

/**
 * Yopiq hajmdagi havo: umumiy suv miqdori Wt (g/m³) saqlanadi.
 * Bug' ρ = min(Wt, ρₛ(t)); ortiqchasi — tomchilar (tuman, shudring), g/m³.
 */
export function airState(t, Wt) {
  const rs = rhoSat(t), rho = Math.min(Wt, rs), p = pOf(rho, t);
  return { t, rho, rs, p, ps: pSat(t), phi: rho / rs, td: dewPoint(p), cond: Math.max(0, Wt - rs) };
}

/* ------------------------------------------------------------------ Psixrometr */

/** Ho'l termometr ko'rsatishi, °C (havo t, nisbiy namlik φ, bosim p) */
export function wetBulb(t, phi, p = P0, A = A_PSY) {
  const pv = phi * pSat(t);
  let lo = -40, hi = t;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2, f = pSat(m) - A * p * (t - m) - pv;
    if (f > 0) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}
/** Psixrometr ko'rsatishlaridan nisbiy namlik (0…1) */
export const phiFromPsy = (t, tw, p = P0, A = A_PSY) => (pSat(tw) - A * p * (t - tw)) / pSat(t);

/** Psixrometrik jadval: qatorlar — quruq termometr t, ustunlar — Δt; qiymat — φ, % (butun). Ma'nosiz katak — null. */
export function psyTable(tRows, dtCols, p = P0) {
  return tRows.map((t) => dtCols.map((dt) => { const v = phiFromPsy(t, t - dt, p) * 100; return v > 0.5 ? Math.round(v) : null; }));
}

/* ------------------------------------------------------------------ Atmosfera */

/** Sutkalik temperatura: minimum quyosh chiqishida (5:00), maksimum 15:00 da. τ — soat (0…24) */
export function dayTemp(tau, tMin, tMax) {
  const d = tMax - tMin, h = ((tau % 24) + 24) % 24;
  if (h >= 5 && h <= 15) return tMin + (d * (1 - Math.cos((Math.PI * (h - 5)) / 10))) / 2;
  const s = (((h - 15) + 24) % 24) / 14;
  return tMax - (d * (1 - Math.cos(Math.PI * s))) / 2;
}
/** Bulut asosi balandligi (Espi formulasi), m */
export const cloudBase = (t, td) => (Math.max(0, t - td) / (GAMMA_A - GAMMA_D)) * 1000;

/**
 * Yer sirti yaqinidagi hodisa: Wt — havodagi suv miqdori (g/m³), wind — shamol.
 * Havo t_d gacha sovisa — o'tlarda shudring (t < 0 da qirov). Shamolsiz kechada ortiqcha bug' havoda
 * kondensatsiyalanib tuman hosil qiladi (shamol havoni aralashtirib, tumanni tarqatadi).
 */
export function phenomenon(t, Wt, wind) {
  const s = airState(t, Wt), sat = s.cond > 0 || s.phi >= 0.999;
  return { ...s, dew: sat && t >= 0, frost: sat && t < 0, fog: sat && !wind && s.cond > 0.15 };
}
