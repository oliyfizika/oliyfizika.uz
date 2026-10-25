// ==========================================================================
// Kulon qonuni va elektr maydon — fizika (DOM'siz, Node'da tekshiriladi: tools/simulations/tests/t_coulomb.mjs)
// 1) Osma sharcha tajribasi: ipga osilgan yengil sharcha va izolyator stenddagi sharcha. Muvozanat burchagi
//    to'liq energiya U(α) = m g L(1 − cos α) + k q₁q₂/(ε d(α)) ning eng yaqin lokal minimumidan topiladi;
//    o'lchangan kuch F = mg·tg α (kuch gorizontal deb olinadi — kichik tizimli xato).
// 2) Superpozitsiya: E = Σ kqᵢ/(ε rᵢ²)·r̂ᵢ, φ = Σ kqᵢ/(ε rᵢ).
// 3) Zaryadlangan shar: o'tkazgich (zaryad sirtda) — ichida E = 0, φ = kQ/R; tekis zaryadlangan dielektrik shar —
//    ichida E = kQr/R³, φ = kQ(3R² − r²)/(2R³). Tashqarida ikkalasida ham nuqtaviy zaryaddek: E = kQ/r².
//    Havo E ≈ 3 MV/m da teshiladi — sharning eng katta zaryadi Q = E·R²/k.
// Birliklar: SI (C, m, kg, N, N/C, V).
// ==========================================================================

export const K = 8.9875517923e9;    // k = 1/(4πε₀), N·m²/C²
export const EPS0 = 8.8541878128e-12;
export const G = 9.81;
export const E_BD = 3e6;            // havoning elektr mustahkamligi, V/m
export const NC = 1e-9;
export const DEG = Math.PI / 180;

/** Muhitlar: ε — dielektrik singdiruvchanlik */
export const MEDIA = {
  air: { name: "Havo", eps: 1.0006 },
  vacuum: { name: "Vakuum", eps: 1 },
  kerosene: { name: "Kerosin", eps: 2.1 },
  trafo: { name: "Transformator moyi", eps: 2.2 },
  castor: { name: "Kastor moyi", eps: 4.7 },
  glycerin: { name: "Glitserin", eps: 43 },
  water: { name: "Distillangan suv", eps: 81 },
};

/** Kulon kuchi (proyeksiya ishorasi bilan): F > 0 — itarilish, F < 0 — tortishish */
export const coulomb = (q1, q2, r, eps = 1) => (K * q1 * q2) / (eps * r * r);
/** Nuqtaviy zaryad maydoni moduli */
export const fieldPoint = (q, r, eps = 1) => (K * Math.abs(q)) / (eps * r * r);
/** O'zaro ta'sir potensial energiyasi */
export const energy = (q1, q2, r, eps = 1) => (K * q1 * q2) / (eps * r);
/** Sharchada havo teshilmasdan saqlanadigan eng katta zaryad (C) */
export const maxCharge = (R, Ebd = E_BD) => (Ebd * R * R) / K;

/* ------------------------------------------------------------------ 1) Osma sharcha */

/** Osma sharcha markazi (osilish nuqtasi (0, 0), y pastga): α > 0 — stenddagi sharcha (+x) tomonga */
export const bobPos = (L, a) => ({ x: L * Math.sin(a), y: L * Math.cos(a) });
/** Sharchalar markazlari orasidagi masofa. D — tinch holatdagi gorizontal masofa, stenddagi sharcha (D, L) da */
export const gap = (L, D, a) => Math.hypot(D - L * Math.sin(a), L - L * Math.cos(a));
/** To'liq potensial energiya (J) */
export function potential(o, a) {
  return o.m * G * o.L * (1 - Math.cos(a)) + energy(o.q1, o.q2, gap(o.L, o.D, a), o.eps ?? 1);
}
/**
 * Muvozanat: α = 0 dan energiya kamayadigan tomonga yurib birinchi lokal minimum yoki tegish nuqtasi.
 * o: { L, D, m, r (sharcha radiusi), q1, q2, eps } → { a, contact, d }
 */
export function equilibrium(o, { step = 0.005 * DEG, aMax = 80 * DEG } = {}) {
  const aTouch = touchAngle(o.L, o.D, 2 * o.r);
  if (!o.q1 || !o.q2) return { a: 0, contact: false, d: gap(o.L, o.D, 0) };
  const dU = (a) => (potential(o, a + 1e-7) - potential(o, a - 1e-7)) / 2e-7;
  const dir = dU(0) < 0 ? 1 : -1;
  let a = 0;
  for (let i = 0; i < aMax / step; i++) {
    const n = a + dir * step;
    if (dir > 0 && n >= aTouch) return { a: aTouch, contact: true, d: 2 * o.r };
    if (potential(o, n) > potential(o, a)) break;
    a = n;
  }
  // aniqlashtirish (oltin kesim)
  let lo = a - step, hi = a + step;
  for (let k = 0; k < 60; k++) {
    const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618;
    if (potential(o, m1) < potential(o, m2)) hi = m2; else lo = m1;
  }
  a = (lo + hi) / 2;
  if (a >= aTouch) return { a: aTouch, contact: true, d: 2 * o.r };
  return { a, contact: false, d: gap(o.L, o.D, a) };
}
/** Sharchalar tegadigan burchak (markazlar orasi = dc) */
export function touchAngle(L, D, dc) {
  if (D <= dc) return 0;
  let lo = 0, hi = Math.asin(Math.min(1, D / L)); // gap shu oraliqda kamayadi
  if (gap(L, D, hi) > dc) return Infinity;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (gap(L, D, m) > dc) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/** Burchakdan o'lchangan kuch (kuch gorizontal deb): F = mg·tg α */
export const measuredForce = (m, a) => m * G * Math.tan(Math.abs(a));
/** Ip tarangligi (muvozanatda, kuch gorizontal deb) T = mg/cos α */
export const tension = (m, a) => (m * G) / Math.cos(a);
/** Bir xil sharchalar tekkanda zaryad teng bo'linadi */
export const share = (q1, q2) => [(q1 + q2) / 2, (q1 + q2) / 2];

/* ------------------------------------------------------------------ 2) Superpozitsiya */

/** charges: [{ x, y, q }] (m, C) → nuqtadagi maydon { ex, ey, e, parts: [{ ex, ey, e }] } */
export function field(charges, x, y, eps = 1) {
  let ex = 0, ey = 0;
  const parts = charges.map((c) => {
    const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
    if (r < 1e-9) return { ex: 0, ey: 0, e: 0, r };
    const k = (K * c.q) / (eps * r2 * r);
    ex += k * dx; ey += k * dy;
    return { ex: k * dx, ey: k * dy, e: Math.abs(k) * r, r };
  });
  return { ex, ey, e: Math.hypot(ex, ey), parts };
}
/** Potensial φ = Σ kq/(εr) */
export const potentialAt = (charges, x, y, eps = 1) => charges.reduce((s, c) => s + (K * c.q) / (eps * Math.hypot(x - c.x, y - c.y)), 0);
/** Ikki zaryad orasida (bir xil ishorali) maydon nolga teng nuqta: q₁ dan masofa x = d/(1 + √(q₂/q₁)) */
export const zeroPoint = (q1, q2, d) => d / (1 + Math.sqrt(Math.abs(q2 / q1)));

/* ------------------------------------------------------------------ 3) Zaryadlangan shar */

/** type: "shell" — o'tkazgich (zaryad sirtda), "solid" — tekis zaryadlangan dielektrik shar */
export function sphereE(Q, R, r, type = "shell", eps = 1) {
  if (r >= R) return (K * Q) / (eps * r * r);
  return type === "shell" ? 0 : (K * Q * r) / (eps * R * R * R);
}
export function spherePhi(Q, R, r, type = "shell", eps = 1) {
  if (r >= R) return (K * Q) / (eps * r);
  return type === "shell" ? (K * Q) / (eps * R) : (K * Q * (3 * R * R - r * r)) / (eps * 2 * R * R * R);
}
/** Sirtdagi zaryad zichligi σ = Q/(4πR²) */
export const surfaceDensity = (Q, R) => Q / (4 * Math.PI * R * R);
/** Sirt yonidagi maydon E = σ/ε₀ (o'tkazgich) */
export const surfaceField = (Q, R) => surfaceDensity(Q, R) / EPS0;
/** Sig'im C = 4πε₀R */
export const capacitance = (R, eps = 1) => 4 * Math.PI * EPS0 * eps * R;
