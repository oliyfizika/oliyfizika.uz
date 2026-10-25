// ==========================================================================
// Gazlarda elektr toki va razryad turlari — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_discharge.mjs)
// 1) Ionlash kamerasi: ionlagich q juft/(m³·s) hosil qiladi, ionlar rekombinatsiyalanadi (n = √(q/β)).
//    Kichik U da Om qonuni j = en(μ₊ + μ₋)E, keyin to'yinish j_s = eqd, katta E da zarbli ionlanish
//    (Taunsend: α = Ap·e^(−Bp/E), M = e^(αd)/(1 − γ(e^(αd) − 1))), M → ∞ da mustaqil razryad (teshilish).
// 2) Razryad trubkasi: teshilish kuchlanishi — Pashen qonuni U_t = Bpd/ln(Apd/ln(1 + 1/γ)); bosim kamaysa
//    katod qorong'i sohasi (d_k·p ≈ 0,3 Torr·cm) kengayadi, qatlamlar, keyin katod nurlari (shisha shu'lasi).
// 3) Uchqun (sharlar orasida havo teshilishi), elektr yoyi (Ayrton tenglamasi, manfiy differensial qarshilik)
//    va toj razryad (Pik qonuni: E_k = 30mδ(1 + 0,301/√(δr)) kV/cm).
// Birliklar: SI, bosim — Torr (mm sim. ust.), Pashen o'lchamlari — cm va V/cm (adabiyotdagidek).
// ==========================================================================

export const E_CH = 1.602e-19;          // C
export const TORR = 133.322;            // Pa
export const BETA = 1.6e-12;            // havoda ionlar rekombinatsiya koeffitsiyenti, m³/s
export const MU = 3.3e-4;               // μ₊ + μ₋ havoda, m²/(V·s)
export const GAMMA = 0.01;              // ikkilamchi emissiya koeffitsiyenti

/** Gazlar: A (1/(cm·Torr)), B (V/(cm·Torr)), ustun va manfiy shu'la ranglari */
export const GASES = {
  air: { name: "Havo", A: 15, B: 365, col: [244, 114, 182], neg: [165, 180, 252] },
  n2: { name: "Azot", A: 12, B: 342, col: [232, 121, 249], neg: [196, 181, 253] },
  ne: { name: "Neon", A: 4, B: 100, col: [255, 90, 31], neg: [255, 160, 80] },
  ar: { name: "Argon", A: 12, B: 180, col: [179, 136, 255], neg: [147, 197, 253] },
  he: { name: "Geliy", A: 3, B: 34, col: [255, 176, 160], neg: [254, 243, 199] },
  h2: { name: "Vodorod", A: 5, B: 130, col: [255, 79, 216], neg: [196, 181, 253] },
};

/* ------------------------------------------------------------------ Taunsend va Pashen */

/** Birinchi Taunsend koeffitsiyenti α (1/cm): p — Torr, E — V/cm */
export const alpha = (g, p, E) => (E > 0 ? g.A * p * Math.exp((-g.B * p) / E) : 0);
/** Elektronlar ko'payishi M (yoki Infinity — mustaqil razryad) */
export function multiplication(g, p, E, dcm, gamma = GAMMA) {
  const ead = Math.exp(alpha(g, p, E) * dcm), den = 1 - gamma * (ead - 1);
  return den > 0 ? ead / den : Infinity;
}
/** Pashen qonuni: U_t (V), pd — Torr·cm; Pashen minimumidan chapda — Infinity */
export function paschen(g, pd, gamma = GAMMA) {
  const L = Math.log((g.A * pd) / Math.log(1 + 1 / gamma));
  return L > 0 ? (g.B * pd) / L : Infinity;
}
/** Pashen minimumi: (pd)_min = e·ln(1 + 1/γ)/A, U_min = B·(pd)_min */
export const paschenMin = (g, gamma = GAMMA) => { const x = (Math.E * Math.log(1 + 1 / gamma)) / g.A; return { pd: x, U: g.B * x }; };
/** Trubka uchun teshilish kuchlanishi: o'ng tarmoq — Pashen, juda past bosimda (chap tarmoq) — taxminiy U ∝ (pd)^(−1,3) */
export function tubeBreakdown(g, p, dcm) {
  const x = p * dcm, x0 = 1.4 * paschenMin(g).pd;
  return x >= x0 ? paschen(g, x) : paschen(g, x0) * Math.pow(x0 / x, 1.3);
}

/* ------------------------------------------------------------------ 1) Ionlash kamerasi */

/** Ionlagichlar: q — juft/(m³·s) */
export const IONIZERS = {
  none: { name: "Kosmik nurlar (fon)", q: 1e7 },
  uv: { name: "Ultrabinafsha lampa", q: 1e12 },
  xray: { name: "Rentgen nurlari", q: 1e14 },
  flame: { name: "Spirt lampa alangasi", q: 1e16 },
};
/**
 * Yassi kamera: U (V), d (m), S (m²), q, havo p = 760 Torr.
 * → { I, Is, M, n, regime: "ohm" | "sat" | "town" | "spark" }
 */
export function chamber(U, d, S, q, p = 760, g = GASES.air) {
  const E = U / d, n = Math.sqrt(q / BETA), jo = E_CH * n * MU * E, js = E_CH * q * d;
  const j = js > 0 ? js * Math.tanh(jo / js) : 0, M = multiplication(g, p, E / 100, d * 100);
  const regime = !Number.isFinite(M) ? "spark" : M > 1.2 ? "town" : jo < 0.5 * js ? "ohm" : "sat";
  return { I: j * S * (Number.isFinite(M) ? M : 1), Is: js * S, M, n, E, regime };
}
/** Kamera teshilish kuchlanishi (V) */
export const chamberBreakdown = (d, p = 760, g = GASES.air) => paschen(g, p * d * 100);

/* ------------------------------------------------------------------ 2) Razryad trubkasi */

/** Vakuum nasosi: p → p_ult + (p − p_ult)·e^(−kΔt) (aylanma moyli nasos, ~40 s da 760 → 10⁻³ Torr) */
export const P_ULT = 2e-4;
export const pumpStep = (p, dt, k = 0.35) => P_ULT + (p - P_ULT) * Math.exp(-k * dt);
/** Atmosfera havosi kirsa (klapan ochiq) */
export const ventStep = (p, dt) => 760 - (760 - p) * Math.exp(-3 * dt);
/**
 * Tlejli razryad tuzilishi (cm), trubka uzunligi L: katod qorong'i sohasi d_k ≈ 0,3/p, manfiy shu'la ≈ 1,5·d_k,
 * Faradey qorong'i sohasi ≈ 2·d_k, qolgani — musbat ustun. Qatlamlar 0,05…1,5 Torr da.
 */
export function glowLayout(p, L) {
  const dk = 0.3 / p, neg = Math.min(1.5 * dk, Math.max(0, L - dk)), far = Math.min(2 * dk, Math.max(0, L - dk - neg));
  const col = Math.max(0, L - dk - neg - far);
  const striae = p > 0.05 && p < 1.5 ? clamp01(1 - Math.abs(Math.log10(p / 0.3)) / 0.75) : 0;
  return { dk: Math.min(dk, L), neg, far, col, striae, spacing: 0.9 / Math.sqrt(p), cord: p > 3 ? Math.min(1, (p - 3) / 30) : 0, rays: dk >= 0.8 * L };
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** Yonib turish (so'nish) kuchlanishi — teshilishdan kichik: U_s ≈ 0,4·U_t (gisterezis) */
export const SUSTAIN = 0.4;
/** Trubka toki (A): ballast qarshilik R orqali */
export const tubeCurrent = (U, Ub, R) => Math.max(0, U - SUSTAIN * Ub) / R;

/* ------------------------------------------------------------------ 3) Uchqun, yoy, toj */

/** Sharlar orasidagi uchqun: havo 760 Torr, oraliq d (cm) → U_t (V) */
export const sparkVb = (dcm, p = 760) => paschen(GASES.air, p * dcm);
/** Uchqunlar chastotasi: kondensator C manbadan R orqali zaryadlanadi va U_t da teshiladi */
export const sparkRate = (U, Vb, RC) => (U > Vb ? 1 / (RC * Math.log(U / (U - Vb))) : 0);

/** Ayrton tenglamasi (ko'mir elektrodlar): U = a + b·d + (c + e·d)/I, d — mm, I — A */
export const ayrton = (dmm, I) => 38.9 + 2.07 * dmm + (11.7 + 10.5 * dmm) / I;
/** Yoyning ballast qarshilik R va manba E bilan barqaror ish nuqtasi (katta ildiz) yoki null — yoy so'nadi */
export function arcPoint(E, R, dmm) {
  const a = 38.9 + 2.07 * dmm, b = 11.7 + 10.5 * dmm, D = (E - a) ** 2 - 4 * R * b;
  if (E <= a || D < 0) return null;
  const I = (E - a + Math.sqrt(D)) / (2 * R);
  return { I, U: ayrton(dmm, I), Iu: (E - a - Math.sqrt(D)) / (2 * R) };
}
/** Yoy so'nmaydigan eng katta oraliq (mm) */
export function arcMaxGap(E, R) { let lo = 0, hi = 100; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (arcPoint(E, R, m)) lo = m; else hi = m; } return lo; }

/** Pik qonuni: toj boshlanadigan maydon E_k (kV/cm) — r (cm), δ — havo nisbiy zichligi, m — sirt koeffitsiyenti */
export const peek = (rcm, m = 1, delta = 1) => 30 * m * delta * (1 + 0.301 / Math.sqrt(delta * rcm));
/** Yer ustidagi sim sirtidagi maydon (kV/cm): U (kV), r, h (cm) */
export const wireField = (U, rcm, hcm) => U / (rcm * Math.log((2 * hcm) / rcm));
/** Toj boshlanish kuchlanishi U_k (kV) */
export const coronaOnset = (rcm, hcm, m = 1, delta = 1) => peek(rcm, m, delta) * rcm * Math.log((2 * hcm) / rcm);
/** Toj toki (nisbiy, U_k dan yuqorida): I ∝ U(U − U_k) */
export const coronaI = (U, Uc) => (U > Uc ? U * (U - Uc) : 0);
