// ==========================================================================
// Qora jism nurlanishi — fizika (DOM'siz).
// Plank formulasi: B_λ(T) = 2hc²/λ⁵ · 1/(e^{hc/λkT} − 1)  [W/(m²·sr·m)].
// Vin siljish qonuni: λ_max·T = b;  Stefan–Bolsman: M = σT⁴.
// Model qurilma: qora jism (bo‘shliq) modeli — pech, apertura radiusi a; T — optik pirometr bilan o‘lchanadi.
// Radiometr apertura o‘qida L masofada: E = εσ(T⁴ − T₀⁴)·a²/L² (Lambert manbai).
// ==========================================================================

export const H = 6.62607015e-34, C = 2.99792458e8, K = 1.380649e-23;
export const SIGMA = 5.670374419e-8, B_WIEN = 2.897771955e-3;
export const T0 = 295, A_AP = 5e-3, L_RAD = 0.30, EPS = 0.99;
export const T_RANGE = [800, 3000], LAM_RANGE = [0.3, 6.0]; // K, μm
export const TAU = 3; // pechning issiqlik inersiyasi, s

/** Spektral energetik ravshanlik, W/(m²·sr·m); lam — m. */
export function planck(lam, T) { const x = (H * C) / (lam * K * T); return x > 700 ? 0 : (2 * H * C * C) / lam ** 5 / Math.expm1(x); }
/** Asbob ko‘rsatkichi: kW/(m²·sr·μm). lamUm — μm. */
export const Blam = (lamUm, T) => (EPS * planck(lamUm * 1e-6, T)) * 1e-6 / 1e3;
export const lamMax = (T) => (B_WIEN / T) * 1e6; // μm
/** Radiometr: W/m². */
export const irr = (T) => EPS * SIGMA * (T ** 4 - T0 ** 4) * (A_AP / L_RAD) ** 2;

/** b va σ dan h va k (x = 4,965114 — Vin tenglamasining ildizi). */
export const XW = 4.965114231744276;
export function hkFrom(b, sigma) { const k = (15 * XW ** 3 * b ** 3 * sigma) / (2 * Math.PI ** 5 * C); return { k, h: (XW * k * b) / C }; }

/** Qora jism rangi (sRGB, taxminiy; T — K). */
export function tempRGB(T) {
  const t = T / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  else { r = 329.698727446 * (t - 60) ** -0.1332047592; g = 288.1221695283 * (t - 60) ** -0.0755148492; b = 255; }
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return [cl(r), cl(g), cl(b)];
}
/** Ko‘rinadigan yorqinlik (0…1) — ko‘z uchun taxminiy. */
export const glowLevel = (T) => Math.min(1, Math.max(0, (T - 750) / 1600) ** 1.4);
