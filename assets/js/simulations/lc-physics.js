// ==========================================================================
// Elektromagnit tebranishlar va o'zgaruvchan tok — fizika (DOM'siz).
// 1) LC (RLC) kontur: L·q̈ + R·q̇ + q/C = ε(t), RK4; analitik yechim (so'nuvchi, kritik, aperiodik), Tomson formulasi.
// 2) O'zgaruvchan tok zanjiri: X_L = ωL, X_C = 1/(ωC), Z, φ, effektiv qiymatlar, quvvat.
// 3) Ketma-ket RLC rezonans: f₀ = 1/(2π√(LC)), aslilik Q, o'tkazish kengligi, U_L va U_C.
// Birliklar: SI (Gn, F, Om, V, A, s).
// ==========================================================================

export const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ 1) Kontur */

export const omega0 = (L, C) => 1 / Math.sqrt(L * C);
export const thomson = (L, C) => TAU * Math.sqrt(L * C);         // T = 2π√(LC)
export const dampingBeta = (R, L) => R / (2 * L);                  // β = R/(2L)
export const qualityQ = (R, L, C) => (R > 0 ? Math.sqrt(L / C) / R : Infinity);
export const criticalR = (L, C) => 2 * Math.sqrt(L / C);
export function regime(R, L, C) { const Rc = criticalR(L, C); return R < Rc * (1 - 1e-9) ? "under" : R > Rc * (1 + 1e-9) ? "over" : "critical"; }

/** Bir RK4 qadami: holat {q, i}, ε — manba EYuK (doimiy qadam ichida). */
export function rlcStep(s, dt, { L, C, R, emf = 0 }) {
  const f = (q, i) => [i, (emf - R * i - q / C) / L];
  const [k1q, k1i] = f(s.q, s.i);
  const [k2q, k2i] = f(s.q + (dt / 2) * k1q, s.i + (dt / 2) * k1i);
  const [k3q, k3i] = f(s.q + (dt / 2) * k2q, s.i + (dt / 2) * k2i);
  const [k4q, k4i] = f(s.q + dt * k3q, s.i + dt * k3i);
  return { q: s.q + (dt / 6) * (k1q + 2 * k2q + 2 * k3q + k4q), i: s.i + (dt / 6) * (k1i + 2 * k2i + 2 * k3i + k4i) };
}
/** Kondensatorni zaryadlash: R_ichki orqali EYuK ε ga ulangan (eksponensial, aniq). */
export function chargeStep(q, dt, { C, emf, r }) { const qf = C * emf; return qf + (q - qf) * Math.exp(-dt / (r * C)); }

/** Analitik yechim: boshlang'ich q0, i0 = 0, t paytda {q, i}. */
export function rlcAnalytic(q0, L, C, R, t) {
  const b = R / (2 * L), w0 = omega0(L, C);
  if (b < w0 * (1 - 1e-12)) {
    const wd = Math.sqrt(w0 * w0 - b * b), e = Math.exp(-b * t);
    const q = q0 * e * (Math.cos(wd * t) + (b / wd) * Math.sin(wd * t));
    const i = -q0 * e * ((w0 * w0) / wd) * Math.sin(wd * t);
    return { q, i };
  }
  if (b > w0 * (1 + 1e-12)) {
    const g = Math.sqrt(b * b - w0 * w0), r1 = -b + g, r2 = -b - g;
    const A = (q0 * r2) / (r2 - r1), B = q0 - A; // q = A e^{r1 t} + B e^{r2 t}, q'(0) = 0
    return { q: A * Math.exp(r1 * t) + B * Math.exp(r2 * t), i: A * r1 * Math.exp(r1 * t) + B * r2 * Math.exp(r2 * t) };
  }
  const e = Math.exp(-b * t);
  return { q: q0 * (1 + b * t) * e, i: -q0 * b * b * t * e };
}
/** Energiyalar: elektr maydon W_E = q²/(2C), magnit maydon W_M = Li²/2. */
export const energies = (s, L, C) => ({ WE: (s.q * s.q) / (2 * C), WM: (L * s.i * s.i) / 2 });

/* ------------------------------------------------------------------ 2) O'zgaruvchan tok */

/**
 * Ketma-ket zanjir: elements — { R, L, C } (yo'q element: R = 0, L = 0, C = Infinity). U — amplituda (V), f — chastota (Hz).
 * Qaytaradi: { w, XL, XC, Z, phi (rad, kuchlanish tokdan oldinda bo'lsa musbat), I0, Ief, Uef, P, cos, UR, UL, UC (amplitudalar) }.
 */
export function acSeries({ R = 0, L = 0, C = Infinity }, U, f) {
  const w = TAU * f, XL = w * L, XC = Number.isFinite(C) ? 1 / (w * C) : 0;
  const X = XL - XC, Z = Math.hypot(R, X);
  const phi = Math.atan2(X, R);
  const I0 = Z > 0 ? U / Z : Infinity;
  const Ief = I0 / Math.SQRT2, Uef = U / Math.SQRT2;
  return { w, XL, XC, X, Z, phi, I0, Ief, Uef, P: Uef * Ief * Math.cos(phi), cos: Math.cos(phi), UR: I0 * R, UL: I0 * XL, UC: I0 * XC };
}
/** Oniy qiymatlar: u = U·sin ωt, i = I0·sin(ωt − φ). */
export const acInstant = (ac, U, t) => ({ u: U * Math.sin(ac.w * t), i: ac.I0 * Math.sin(ac.w * t - ac.phi) });

/* ------------------------------------------------------------------ 3) Rezonans */

export const resonanceF = (L, C) => 1 / (TAU * Math.sqrt(L * C));
/** O'tkazish kengligi (yarim quvvat bo'yicha): Δf = R/(2πL). */
export const bandwidth = (R, L) => R / (TAU * L);
/** Berilgan rezonans chastota uchun kerakli sig'im: C = 1/(4π²f²L). */
export const capacitanceFor = (f, L) => 1 / (TAU * TAU * f * f * L);
