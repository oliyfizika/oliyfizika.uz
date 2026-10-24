// ==========================================================================
// Bosim, Paskal qonuni, suyuqlik bosimi — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_pressure.mjs)
// - Qattiq jism bosimi p = F/S (g'isht qirralari, chang'i va etik, igna).
// - Gidravlik press: F₂/F₁ = S₂/S₁, s₂ = s₁·S₁/S₂ (ishda yutuq yo'q). Paskal shari: bosim har tomonga bir xil.
// - Gidrostatik bosim p = ρgh; tutash idishlar: bir jinsli suyuqlik sathlari teng, ikki suyuqlikda ρ₁h₁ = ρ₂h₂.
// Birliklar: SI (N, m², Pa, kg/m³, m).
// ==========================================================================

export const G = 9.81;
export const P0 = 101325;

/** G'isht: 25 × 12 × 6,5 cm, 3,5 kg. Qirralar: yassi (eng katta), yon, tik (eng kichik) */
export const BRICK = { a: 0.25, b: 0.12, c: 0.065, m: 3.5 };
export const FACES = {
  flat: { name: "Yassi yotqizilgan", S: BRICK.a * BRICK.b, w: BRICK.a, h: BRICK.c },
  edge: { name: "Yoni bilan", S: BRICK.a * BRICK.c, w: BRICK.a, h: BRICK.b },
  end: { name: "Tik qo‘yilgan", S: BRICK.b * BRICK.c, w: BRICK.b, h: BRICK.a },
};
/** Boshqa jismlar: S — tayanch yuzasi (m²), m — massa (kg) yoki F — kuch (N) */
export const OBJECTS = {
  boots: { name: "Odam etikda (60 kg)", m: 60, S: 2 * 0.03, note: "ikki etik tagi 2 × 300 cm²" },
  skis: { name: "Odam chang‘ida (60 kg)", m: 60, S: 2 * 1.8 * 0.09, note: "ikki chang‘i 2 × 1,8 m × 9 cm" },
  needle: { name: "Igna (1 N kuch bilan)", F: 1, S: 0.01e-6, note: "uchi 0,01 mm²" },
  tractor: { name: "Zanjirli traktor (6 t)", m: 6000, S: 2 * 2.4 * 0.5, note: "ikki zanjir 2 × 2,4 m × 0,5 m" },
};

export const pressure = (F, S) => F / S;
export const weightN = (m) => m * G;

/* ------------------------------------------------------------------ Paskal qonuni, gidravlik press */

/** Gidravlik press (ideal): kichik porshenga F₁ — katta porshenda F₂ = F₁·S₂/S₁ */
export const pressForce = (F1, S1, S2) => (F1 * S2) / S1;
/** Kichik porshen s₁ ga tushsa, katta porshen s₂ = s₁·S₁/S₂ ga ko'tariladi (suyuqlik siqilmaydi) */
export const pressLift = (s1, S1, S2) => (s1 * S1) / S2;
/** M massali yukni ko'tarish uchun kichik porshenga kerakli kuch */
export const forceToLift = (M, S1, S2) => (weightN(M) * S1) / S2;
/** Yopiq idishdagi suyuqlik bosimi porshen kuchidan */
export const pistonPressure = (F, S) => F / S;
/** Paskal shari: teshikdan otilib chiqqan suv tezligi v = √(2Δp/ρ) — barcha teshiklarda bir xil */
export const jetSpeed = (dp, rho = 1000) => Math.sqrt((2 * Math.max(0, dp)) / rho);

/* ------------------------------------------------------------------ Suyuqlik bosimi */

export const LIQUIDS = {
  water: { name: "Suv", rho: 1000, color: [56, 189, 248] },
  sea: { name: "Dengiz suvi", rho: 1030, color: [14, 165, 233] },
  oil: { name: "O‘simlik moyi", rho: 930, color: [250, 204, 21] },
  kerosene: { name: "Kerosin", rho: 800, color: [253, 230, 138] },
  mercury: { name: "Simob", rho: 13600, color: [148, 163, 184] },
};

/** Gidrostatik bosim (Pa): p = ρgh; withAtm — atmosfera bosimi qo'shiladi */
export const hydro = (rho, h, withAtm = false) => rho * G * Math.max(0, h) + (withAtm ? P0 : 0);
/** Idish tubiga bosim kuchi: F = pS (shakliga bog'liq emas — gidrostatik paradoks) */
export const bottomForce = (rho, h, S) => hydro(rho, h) * S;

/**
 * U-nay (kesimi bir xil) suv bilan; chap tirsakka ρ₂ zichlikli, h₂ balandlikli suyuqlik quyildi (aralashmaydi).
 * Qaytaradi: { x — chap suv sathining pasayishi (= o'ng sathining ko'tarilishi), dTop — ustki sathlar farqi, dWater — suv sathlari farqi }
 */
export function uTube(rho1, rho2, h2) {
  const x = (rho2 * h2) / (2 * rho1);
  return { x, dWater: 2 * x, dTop: h2 - 2 * x };
}
