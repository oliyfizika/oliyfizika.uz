// ==========================================================================
// Magnit maydonda zaryadli zarra — fizika (DOM'siz, SI).
// Lorens kuchi F = qv×B, aylana r = mv/(|q|B), davr T = 2πm/(|q|B) (tezlikka bog'liq emas),
// vint chiziq (v B ga burchak ostida), mass-spektrometr (tezlatish + tezlik selektori), siklotron.
// ==========================================================================

export const E = 1.602176634e-19;
export const AMU = 1.66053907e-27;
export const PARTICLES = {
  e: { name: "Elektron", m: 9.1093837e-31, q: -E, sym: "e⁻" },
  p: { name: "Proton", m: 1.67262192e-27, q: E, sym: "p⁺" },
  a: { name: "Alfa-zarra", m: 6.6446573e-27, q: 2 * E, sym: "α" },
};

export const radius = (m, v, q, B) => (m * v) / (Math.abs(q) * B);
export const period = (m, q, B) => (2 * Math.PI * m) / (Math.abs(q) * B);
export const force = (q, v, B, sinA = 1) => Math.abs(q) * v * B * Math.abs(sinA);

/**
 * Bir jinsli Bz maydonda aniq qadam (tekislikda): dv/dt = (q/m) v×B.
 * p, v — [x, y]; dt; Bz (+ — ekrandan bizga). Qaytaradi yangi { p, v }.
 */
export function stepPlane(p, v, dt, q, m, Bz) {
  const W = (q * Bz) / m; // dv/dt = W·(vy, −vx)
  if (Math.abs(W * dt) < 1e-12) return { p: [p[0] + v[0] * dt, p[1] + v[1] * dt], v: [...v] };
  const th = W * dt, c = Math.cos(th), s = Math.sin(th);
  // v(t) = R(−θ) v0, p(t) = p0 + (1/W)[[sinθ, 1−cosθ],[cosθ−1, sinθ]] v0
  const nv = [c * v[0] + s * v[1], -s * v[0] + c * v[1]];
  const np = [p[0] + (s * v[0] + (1 - c) * v[1]) / W, p[1] + ((c - 1) * v[0] + s * v[1]) / W];
  return { p: np, v: nv };
}

/** Vint chiziq: B — x o'qi bo'ylab, v B ga α burchak ostida. */
export function helix(m, v, q, B, alpha) {
  const vp = v * Math.sin(alpha), vl = v * Math.cos(alpha), T = period(m, q, B);
  return { r: radius(m, vp, q, B), pitch: vl * T, T, vp, vl };
}

/* --------------------------------------------------------------- Mass-spektrometr */

export const speedFromU = (m, q, U) => Math.sqrt((2 * Math.abs(q) * U) / m);
export const msRadius = (m, q, U, B) => Math.sqrt((2 * m * U) / Math.abs(q)) / B;
export const massFromR = (r, q, U, B) => (Math.abs(q) * B * B * r * r) / (2 * U);
/** Tezlik selektori (E ⊥ B₁): o'tadigan tezlik v = E/B₁; uzunligi L bo'lgan selektorda ko'ndalang siljish. */
export const selectorSpeed = (Ef, B1) => Ef / B1;
export function selectorShift(m, q, v, Ef, B1, L) { const a = (Math.abs(q) * (Ef - v * B1)) / m, t = L / v; return 0.5 * a * t * t; }

/* --------------------------------------------------------------- Siklotron */

export const cycFreq = (m, q, B) => (Math.abs(q) * B) / (2 * Math.PI * m);
export const cycEnergy = (m, q, B, R) => (q * B * R) ** 2 / (2 * m);
/** k-o'tishdagi energiya o'zgarishi: generator U₀cos(2πf t) va o'tish yo'nalishi (−1)^k. */
export const gapGain = (q, U0, f, t, k) => Math.abs(q) * U0 * Math.cos(2 * Math.PI * f * t) * (k % 2 ? -1 : 1);
