// ==========================================================================
// Massa, zichlik va suzish — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_density.mjs)
// - Pallali (richagli) tarozi: elkalari teng, og'ish burchagi momentlar farqiga bog'liq (sezgirlik chegarasi bilan).
// - Zichlik ρ = m/V; menzurka bilan hajm o'lchash; jadvaldan moddani aniqlash.
// - Arximed kuchi F_A = ρ_s·g·V_bot; dinamometr ko'rsatishi P − F_A; suzish sharti va muvozanatdagi botish chuqurligi.
// Birliklar: massa — g, hajm — cm³, zichlik — g/cm³ (UI da kg/m³ ham), kuch — N, uzunlik — cm.
// ==========================================================================

export const G = 9.81;

/** Moddalar zichligi, g/cm³ (darslik jadvali qiymatlari) */
export const MATERIALS = {
  cork: { name: "Probka", rho: 0.24, color: "#d6a76c" },
  wood: { name: "Yog‘och (qarag‘ay)", rho: 0.5, color: "#c08a4a" },
  ice: { name: "Muz", rho: 0.9, color: "#bae6fd" },
  paraffin: { name: "Parafin", rho: 0.9, color: "#fef3c7" },
  egg: { name: "Tovuq tuxumi", rho: 1.05, color: "#fde7c4" },
  plastic: { name: "Organik shisha", rho: 1.2, color: "#a5f3fc" },
  glass: { name: "Shisha", rho: 2.5, color: "#99f6e4" },
  granite: { name: "Granit", rho: 2.6, color: "#a8a29e" },
  alu: { name: "Alyuminiy", rho: 2.7, color: "#cbd5e1" },
  zinc: { name: "Rux", rho: 7.1, color: "#94a3b8" },
  steel: { name: "Po‘lat", rho: 7.8, color: "#64748b" },
  brass: { name: "Latun", rho: 8.5, color: "#eab308" },
  copper: { name: "Mis", rho: 8.9, color: "#c2410c" },
  silver: { name: "Kumush", rho: 10.5, color: "#e2e8f0" },
  lead: { name: "Qo‘rg‘oshin", rho: 11.3, color: "#475569" },
  gold: { name: "Oltin", rho: 19.3, color: "#facc15" },
};

/** Suyuqliklar zichligi, g/cm³ */
export const LIQUIDS = {
  water: { name: "Suv", rho: 1.0, color: [56, 189, 248] },
  salt: { name: "Sho‘r suv (to‘yingan)", rho: 1.2, color: [125, 211, 252] },
  sea: { name: "Dengiz suvi", rho: 1.03, color: [14, 165, 233] },
  kerosene: { name: "Kerosin", rho: 0.8, color: [253, 230, 138] },
  alcohol: { name: "Spirt", rho: 0.79, color: [226, 232, 240] },
  oil: { name: "O‘simlik moyi", rho: 0.93, color: [250, 204, 21] },
  mercury: { name: "Simob", rho: 13.6, color: [148, 163, 184] },
};

/** Tarozi toshlari (gira), g */
export const WEIGHTS = [100, 50, 20, 20, 10, 5, 2, 2, 1, 0.5, 0.2, 0.2, 0.1];

export const density = (m, V) => m / V;
export const toKgM3 = (rhoG) => rhoG * 1000;

/** Jadvaldan eng yaqin modda: { key, mat, err } (err — nisbiy farq) */
export function identify(rho) {
  let best = null;
  for (const [key, mat] of Object.entries(MATERIALS)) { const err = Math.abs(rho - mat.rho) / mat.rho; if (!best || err < best.err) best = { key, mat, err }; }
  return best;
}

/** Toshlar yig'indisi (g), yaxlitlash xatosiz */
export const sumWeights = (list) => Math.round(list.reduce((s, w) => s + w, 0) * 10) / 10;

/**
 * Tarozi: muvozanat burchagi (rad). dm = m_o'ng − m_chap (g). Sezgirlik chegarasi s (g) dan kichik farqni tarozi sezmaydi.
 * Kichik farqda og'ish proporsional, katta farqda — tirgakkacha (maxA).
 */
export function balanceAngle(dm, { s = 0.05, k = 0.02, maxA = 0.22 } = {}) {
  if (Math.abs(dm) <= s) return 0;
  return Math.max(-maxA, Math.min(maxA, -k * dm));
}

/** Toshlarni tanlash (ochko'z usul): massaga eng yaqin yig'indi, katta toshdan boshlab */
export function greedyWeights(m) {
  const out = []; let rest = Math.round(m * 10) / 10;
  for (const w of WEIGHTS) if (w <= rest + 1e-9) { out.push(w); rest = Math.round((rest - w) * 10) / 10; }
  return { out, rest };
}

/** Menzurka: hajm o'qish (shkala bo'limi div mL ga yaxlitlanadi) */
export const readCylinder = (V, div = 2) => Math.round(V / div) * div;

/* ------------------------------------------------------------------ Suzish */

/**
 * To'g'ri prizma shaklidagi jism (asos yuzasi A cm², balandligi H cm) suyuqlikka d cm botgan.
 * Qaytaradi: { Vsub (cm³), FA (N) }
 */
export function buoyancy({ A, H, rhoL, d }) {
  const Vsub = A * Math.max(0, Math.min(H, d));
  return { Vsub, FA: rhoL * Vsub * 1e-3 * G }; // ρ (g/cm³) · V (cm³) = m (g)
}
/** Og'irlik (N): m g dan */
export const weight = (m) => (m / 1000) * G;
/** Dinamometr ko'rsatishi (N): P − F_A, lekin ip bo'shashsa 0 */
export function springReading({ m, A, H, rhoL, d }) {
  const { FA } = buoyancy({ A, H, rhoL, d });
  return Math.max(0, weight(m) - FA);
}
/** Erkin jism: suzadimi va muvozanatda qancha botadi (cm). Cho'ksa null. */
export function floatDepth({ m, A, H, rhoL }) {
  const d = m / (rhoL * A);
  return d < H ? d : null;
}
/** Suzish sharti */
export const floats = (rhoBody, rhoL) => rhoBody < rhoL;
