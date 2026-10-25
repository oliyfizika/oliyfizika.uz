// ==========================================================================
// Sirt tarangligi, ho'llash va kapillyarlik — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_surface.mjs)
// - Sirt taranglik kuchi F = σl; sovun pardasi (ikki sirt) ramka to'sinini F = 2σL kuch bilan tortadi; ish A = σΔS.
// - Kapillyar ko'tarilish (Jyuren): h = 2σcosθ/(ρgr); ho'llamaydigan suyuqlikda (θ > 90°) h < 0 — pasayish.
// - Tomchilar usuli (Teyt qonuni, soddalashtirilgan): tomchi uzilganda mg = πdσ → σ = mg/(πd).
// Birliklar: SI (N/m, m, kg/m³, rad).
// ==========================================================================

export const G = 9.81;
export const DEG = Math.PI / 180;

/** Suyuqliklar (20 °C): σ (N/m), ρ (kg/m³), θ — shisha bilan chegaraviy burchak, kT — σ ning temperatura koeffitsiyenti (N/(m·K)) */
export const LIQUIDS = {
  water: { name: "Suv", sigma: 0.0728, rho: 1000, theta: 0, kT: 1.5e-4, color: [56, 189, 248] },
  soap: { name: "Sovunli suv", sigma: 0.04, rho: 1000, theta: 0, kT: 1.0e-4, color: [196, 181, 253] },
  alcohol: { name: "Spirt", sigma: 0.022, rho: 790, theta: 0, kT: 0.8e-4, color: [226, 232, 240] },
  glycerin: { name: "Glitserin", sigma: 0.063, rho: 1260, theta: 0, kT: 0.6e-4, color: [254, 240, 138] },
  kerosene: { name: "Kerosin", sigma: 0.026, rho: 800, theta: 0, kT: 0.9e-4, color: [253, 230, 138] },
  mercury: { name: "Simob", sigma: 0.465, rho: 13546, theta: 140 * DEG, kT: 2.0e-4, color: [148, 163, 184] },
};

/** σ(t): chiziqli kamayadi (t — °C, 20 °C dagi qiymatdan) */
export const sigmaAt = (key, t = 20) => Math.max(0, LIQUIDS[key].sigma - LIQUIDS[key].kT * (t - 20));

/** Sirt taranglik kuchi chegara uzunligi l bo'yicha */
export const tensionForce = (sigma, l) => sigma * l;
/** Sovun pardasi (ikki sirt) L uzunlikdagi to'sinni tortadi */
export const filmForce = (sigma, L) => 2 * sigma * L;
/** Pardani Δx ga cho'zishdagi ish (ikki sirt): A = σΔS, ΔS = 2LΔx */
export const filmWork = (sigma, L, dx) => sigma * 2 * L * dx;
/** Sirt energiyasi E = σS */
export const surfaceEnergy = (sigma, S) => sigma * S;

/** Kapillyar ko'tarilish balandligi (m), r — nay radiusi */
export const capillaryH = (sigma, rho, r, theta = 0) => (2 * sigma * Math.cos(theta)) / (rho * G * r);
/** Yassi plastinalar orasida (oraliq d): h = 2σcosθ/(ρgd) */
export const slitH = (sigma, rho, d, theta = 0) => (2 * sigma * Math.cos(theta)) / (rho * G * d);
/** Ho'llash sharti */
export const wets = (theta) => theta < 90 * DEG;

/** Tomchi uzilish paytidagi massasi (kg): mg = πdσ, d — naycha uchi diametri */
export const dropMass = (sigma, d) => (Math.PI * d * sigma) / G;
/** Tomchilar usuli: N tomchi massasi M dan σ = Mg/(πdN) */
export const sigmaFromDrops = (M, N, d) => (M * G) / (Math.PI * d * N);
/** Tomchi hajmi va (shar deb) radiusi */
export const dropRadius = (m, rho) => Math.cbrt((3 * (m / rho)) / (4 * Math.PI));
