// ==========================================================================
// Maxsus nisbiylik nazariyasi — fizika (DOM'siz; simulations/relativity.html).
// Tezliklar c birligida (β = v/c). Lorens omili γ = 1/√(1 − β²).
// Vaqt sekinlashishi Δt = γΔt₀ (yorug'lik soati: Δt₀ = 2d/c), uzunlik qisqarishi L = L₀/γ.
// Tezliklarni qo'shish u = (v + u')/(1 + vu'/c²). Myuonlar (Frisch–Smith, 1963): N/N₀ = 2^(−t₀/T½), t₀ = t/γ.
// Massa va energiya: m = γm₀, E = mc² = γm₀c², K = (γ − 1)m₀c², pc = √(K² + 2Km₀c²).
// Bertozzi tajribasi (1964): elektronlar U kuchlanishda tezlatiladi, 8,4 m uchish vaqti o'lchanadi.
// ==========================================================================

export const C = 299792458;             // m/s
export const MEV = 1.602176634e-13;      // 1 MeV, J
export const PARTICLES = {
  e: { name: "elektron", sym: "e⁻", m: 9.1093837e-31, E0: 0.51099895 },   // E0 = m₀c², MeV
  p: { name: "proton", sym: "p", m: 1.67262192e-27, E0: 938.27209 },
};
export const MUON = { T_HALF: 1.52e-6, E0: 105.6584 }; // myuonning tinchlikdagi yarim yemirilish davri, s

/** Lorens omili */
export const gamma = (b) => 1 / Math.sqrt(1 - b * b);
/** γ dan β */
export const betaOf = (g) => Math.sqrt(Math.max(0, 1 - 1 / (g * g)));

/* ------------------------------------------------------------------ Vaqt va uzunlik */

/** Yorug'lik soati: d — ko'zgular orasidagi masofa (m), b — soat tezligi. Qaytaradi bir «tik» davomiyligi, s */
export function lightClock(d, b) {
  const t0 = (2 * d) / C, t = gamma(b) * t0;
  return { t0, t, path: C * t, shift: b * C * t }; // path — Yerdan qaralganda yorug'lik yo'li, shift — soat siljishi
}
/** Uzunlik qisqarishi */
export const contracted = (L0, b) => L0 / gamma(b);

/** Myuonlar: h (m) balandlikdan b tezlikda tushadi. rel = false — klassik (vaqt sekinlashmaydi) */
export function muonSurvival(h, b, rel = true, T = MUON.T_HALF) {
  const t = h / (b * C), t0 = rel ? t / gamma(b) : t;
  return { t, t0, frac: 2 ** (-t0 / T), hOwn: rel ? h / gamma(b) : h };
}

/* ------------------------------------------------------------------ Tezliklarni qo'shish */

/** Relyativistik qo'shish (β birligida) */
export const addVel = (v, u) => (v + u) / (1 + v * u);
/** Galiley bo'yicha (klassik) */
export const addGal = (v, u) => v + u;
/** Teskari: laboratoriyada u, poyezdda u' = (u − v)/(1 − uv) */
export const subVel = (u, v) => (u - v) / (1 - u * v);

/* ------------------------------------------------------------------ Massa va energiya */

/** Zarra kinetik energiyasi K (MeV) bo'yicha: γ, β, klassik β, m/m₀, E, pc */
export function particle(K, E0) {
  const g = 1 + K / E0;
  return { K, E0, g, b: betaOf(g), bCl: Math.sqrt((2 * K) / E0), E: g * E0, pc: Math.sqrt(K * K + 2 * K * E0) };
}
/** Tezlik bo'yicha kinetik energiya (relyativistik va klassik), MeV */
export const kinOf = (b, E0) => (gamma(b) - 1) * E0;
export const kinCl = (b, E0) => 0.5 * b * b * E0;

/** Uchish vaqti, s */
export const tof = (L, b) => L / (b * C);

/** Massa ↔ energiya: m (kg) → E (J) */
export const restEnergy = (m) => m * C * C;
