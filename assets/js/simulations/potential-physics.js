// ==========================================================================
// Elektr potensial, ish va kondensatorlar — fizika (DOM'siz, SI).
// Nuqtaviy zaryadlar: φ = Σ kq/r, E = −∇φ; zaryadni ko'chirishda ish A = q(φ₁ − φ₂) — yo'lga bog'liq emas.
// Yassi kondensator: C = ε₀εS/d; batareyaga ulangan (U = const) va uzilgan (q = const) holatlar; energiya, plastinkalar tortishishi.
// Kondensatorlarni ulash: ketma-ket, parallel, aralash; RC zanjirda zaryadlanish.
// ==========================================================================

export const K = 8.9875517923e9;
export const EPS0 = 8.8541878128e-12;
const RMIN = 0.004; // m — zaryad «sharcha» radiusi (cheksizlikdan saqlanish)

/** Potensial (V): charges [{x, y, q}] (m, C). */
export function potential(charges, x, y) {
  let p = 0;
  for (const c of charges) { const r = Math.max(Math.hypot(x - c.x, y - c.y), RMIN); p += (K * c.q) / r; }
  return p;
}
/** Maydon kuchlanganligi (V/m). */
export function field(charges, x, y) {
  let ex = 0, ey = 0;
  for (const c of charges) {
    const dx = x - c.x, dy = y - c.y, r = Math.max(Math.hypot(dx, dy), RMIN), e = (K * c.q) / (r * r * r);
    ex += e * dx; ey += e * dy;
  }
  return { ex, ey, e: Math.hypot(ex, ey) };
}
/** Zaryadni ko'chirishda maydon kuchlarining ishi: A = q(φ₁ − φ₂). */
export const workBetween = (q, phi1, phi2) => q * (phi1 - phi2);
/** Yo'l bo'ylab ishni sonli integrallash (tekshirish uchun): A = ∫ qE·dl. */
export function workAlongPath(charges, q, path) {
  let W = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, E = field(charges, m.x, m.y);
    W += q * (E.ex * (b.x - a.x) + E.ey * (b.y - a.y));
  }
  return W;
}

/* ------------------------------------------------------------------ Yassi kondensator */

/** S (m²), d (m), eps — dielektrik singdiruvchanlik. */
export const capacitance = (S, d, eps = 1) => (EPS0 * eps * S) / d;
/**
 * Holat: connected — batareyaga ulangan (U = U0), aks holda zaryad q0 saqlanadi.
 * Qaytaradi { C, q, U, E, W, sigma, F }.
 */
export function capState({ S, d, eps = 1, connected, U0, q0 }) {
  const C = capacitance(S, d, eps);
  const q = connected ? C * U0 : q0, U = q / C;
  return { C, q, U, E: U / d, W: (q * q) / (2 * C), sigma: q / S, F: (q * q) / (2 * EPS0 * eps * S) };
}

/* ------------------------------------------------------------------ Ulash */

export const series = (cs) => 1 / cs.reduce((a, c) => a + 1 / c, 0);
export const parallel = (cs) => cs.reduce((a, c) => a + c, 0);
/**
 * Sxemalar: "par" — C1 ∥ C2 ∥ C3, "ser" — C1 — C2 — C3, "mix" — C1 ketma-ket (C2 ∥ C3).
 * U — umumiy kuchlanish. Qaytaradi { Ceq, items: [{C, q, U}] } (barqaror holat).
 */
export function network(kind, cs, U) {
  if (kind === "par") return { Ceq: parallel(cs), items: cs.map((C) => ({ C, q: C * U, U })) };
  if (kind === "ser") { const Ceq = series(cs), q = Ceq * U; return { Ceq, items: cs.map((C) => ({ C, q, U: q / C })) }; }
  const C23 = cs[1] + cs[2], Ceq = series([cs[0], C23]), q = Ceq * U, U1 = q / cs[0], U23 = U - U1;
  return { Ceq, items: [{ C: cs[0], q, U: U1 }, { C: cs[1], q: cs[1] * U23, U: U23 }, { C: cs[2], q: cs[2] * U23, U: U23 }] };
}
/** RC zaryadlanish (t ≥ 0): q = Cε(1 − e^(−t/τ)), i = (ε/R)e^(−t/τ); razryad: q = q0·e^(−t/τ). */
export function rcCharge(C, R, emf, t) { const tau = R * C, e = Math.exp(-t / tau); return { q: C * emf * (1 - e), i: (emf / R) * e, U: emf * (1 - e), tau }; }
export function rcDischarge(C, R, q0, t) { const tau = R * C, e = Math.exp(-t / tau); return { q: q0 * e, i: (-q0 / tau) * e, U: (q0 / C) * e, tau }; }
