// ==========================================================================
// Elektron difraksiyasi — fizika (DOM'siz). De Broyl: λ = h/p, p = √(2meU·(1 + eU/2mc²)).
// 1) Devisson–Jermer (1927): elektronlar nikel monokristalining (111) sirtiga normal tushadi; sirtdagi atom
//    qatorlari (d = 0,215 nm) difraksion panjara: d·sinφ = nλ. Kollektor toki I(φ) da «bo‘rtiq»; uning kattaligi
//    U ≈ 54 V da eng yaqqol (kristall ichidagi qatlamlar bilan Bragg sharti).
// 2) Grafit plyonka (polikristall): Debay–Sherrer halqalari, 2d·sinθ = λ, ekranda D = 2L·tg2θ;
//    kichik burchakda λ ≈ d·D/(2L). d₁₀ = 0,213 nm, d₁₁ = 0,123 nm.
// ==========================================================================

export const H = 6.62607015e-34, ME = 9.1093837015e-31, QE = 1.602176634e-19, C = 2.99792458e8;
export const K_NR = (H / Math.sqrt(2 * ME * QE)) * 1e9; // 1,2264 nm·V^½
/** De Broyl to‘lqin uzunligi, nm (rel = true — relyativistik tuzatma bilan). */
export function lambdaNm(U, rel = true) {
  const p = Math.sqrt(2 * ME * QE * U * (rel ? 1 + (QE * U) / (2 * ME * C * C) : 1));
  return (H / p) * 1e9;
}

/* ------------------------------------------------------------------ Devisson–Jermer */

export const NI_D = 0.215; // nm, (111) sirtdagi atom qatorlari oralig‘i
export const DG = { Umin: 20, Umax: 100, phiMin: 10, phiMax: 90 };
/** Difraksiya maksimumi burchagi (n-tartib), gradus yoki null. */
export function dgPeak(U, n = 1) { const s = (n * lambdaNm(U)) / NI_D; return s < 1 ? (Math.asin(s) * 180) / Math.PI : null; }
/** Kollektor toki, nA (nisbiy birlikda emas — qurilma galvanometri). */
export function dgCurrent(U, phiDeg) {
  const ph = (phiDeg * Math.PI) / 180, lam = lambdaNm(U);
  const bg = 0.55 + 0.75 * Math.cos(ph) ** 1.5 + 0.12 * Math.sin(2 * ph); // sochilgan (diffuz) elektronlar
  let peak = 0;
  for (let n = 1; n <= 2; n++) {
    const s0 = (n * lam) / NI_D; if (s0 >= 1) continue;
    const env = (n === 1 ? 1 : 0.35) * (0.22 + 0.95 * Math.exp(-(((U - 54) / 13) ** 2)));
    const w = 0.055; // sinφ bo‘yicha kenglik (kogerent qatorlar soni ~ 10)
    peak += env * Math.exp(-(((Math.sin(ph) - s0) / w) ** 2) / 2);
  }
  return (bg + peak) * (0.6 + 0.012 * U);
}

/* ------------------------------------------------------------------ Grafit */

export const GRAPHITE = { d: [0.213, 0.123], L: 135, Umin: 2.5, Umax: 5 }; // L — mm, U — kV
/** Halqa diametri, mm (aniq: D = 2L·tg2θ, sinθ = λ/2d). */
export function ringD(UkV, d) { const lam = lambdaNm(UkV * 1000), th = Math.asin(lam / (2 * d)); return 2 * GRAPHITE.L * Math.tan(2 * th); }
