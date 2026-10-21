// ==========================================================================
// Aylana bo'ylab harakat — fizika (DOM'siz, SI).
// Kinematika: ω = v/R, T = 2πR/v, a_m = v²/R; notekis harakatda tangensial tezlanish.
// Dinamika: ipdagi sharcha (T = mv²/R, uzilish), burilishdagi avtomobil (ishqalanish, qiyalik), vertikal halqa
// (energiya, tayanch reaksiyasi, ajralish nuqtasi, ajralgandan keyin parabola).
// Uzatmalar: tasma/tishli uzatma — v₁ = v₂, ω₁R₁ = ω₂R₂.
// ==========================================================================

export const G = 9.81;
export const TAU = Math.PI * 2;

export function kin(v, R) { const omega = v / R; return { omega, T: TAU / omega, nu: omega / TAU, ac: (v * v) / R }; }
export const tension = (m, v, R) => (m * v * v) / R;
/** Ip uziladigan tezlik: v = √(T_max·R/m). */
export const breakSpeed = (m, R, Tmax) => Math.sqrt((Tmax * R) / m);

/** Qiyalik α (rad) va ishqalanish μ bilan burilishda eng katta tezlik; ideal (ishqalanishsiz) tezlik. */
export function carMax(mu, R, alpha = 0, g = G) {
  const t = Math.tan(alpha), den = 1 - mu * t;
  return den <= 0 ? Infinity : Math.sqrt((g * R * (mu + t)) / den);
}
export const carIdeal = (R, alpha, g = G) => Math.sqrt(g * R * Math.tan(alpha));
/** Markazga intilma tezlanish chegaralari: hi — sirpanmasdan eng katta, lo — qiyalikdan pastga sirpanmaslik uchun eng kichik. */
export function carBounds(mu, alpha = 0, g = G) {
  const t = Math.tan(alpha), den = 1 - mu * t;
  return { hi: den <= 0 ? Infinity : (g * (mu + t)) / den, lo: Math.max(0, (g * (t - mu)) / (1 + mu * t)) };
}
/** Qiya burilishda eng kichik tezlik (undan sekin bo'lsa, avtomobil ichkariga — pastga sirpanadi). */
export const carMin = (mu, R, alpha = 0, g = G) => Math.sqrt(R * carBounds(mu, alpha, g).lo);
/** Kerakli ishqalanish kuchi (qiyalik bo'ylab ichkariga musbat) va normal kuch. */
export function carForces(m, v, R, alpha = 0, g = G) {
  const ac = (v * v) / R, c = Math.cos(alpha), s = Math.sin(alpha);
  return { f: m * (ac * c - g * s), N: m * (g * c + ac * s), ac };
}

/* ------------------------------------------------------------------ Vertikal halqa */

/** θ — pastki nuqtadan burchak (0 — pastda, π — tepada). Boshlang'ich balandlik h (pastki nuqtadan). */
export function loopAt(h, R, theta, g = G) {
  const y = R * (1 - Math.cos(theta)), v2 = 2 * g * (h - y);
  const nOverMg = v2 >= 0 ? v2 / (g * R) + Math.cos(theta) : NaN; // N/(mg)
  return { y, v: Math.sqrt(Math.max(0, v2)), v2, n: nOverMg };
}
/** Ajralish burchagi (cos θ = (2 − 2h/R)/3) yoki null (ajralmaydi). */
export function detachAngle(h, R) {
  if (h >= 2.5 * R) return null;     // to'liq aylanadi
  if (h <= R) return null;           // gorizontal diametrdan yuqoriga chiqmaydi — orqaga qaytadi
  return Math.acos((2 - (2 * h) / R) / 3);
}
export const minHeight = (R) => 2.5 * R;

/** Halqa ichida harakat: θ'' = −(g/R)·sin θ (RK4 qadami), holat {th, w}. */
export function loopStep(s, dt, R, g = G) {
  const f = (th, w) => [w, -(g / R) * Math.sin(th)];
  const [a1, b1] = f(s.th, s.w), [a2, b2] = f(s.th + (dt / 2) * a1, s.w + (dt / 2) * b1), [a3, b3] = f(s.th + (dt / 2) * a2, s.w + (dt / 2) * b2), [a4, b4] = f(s.th + dt * a3, s.w + dt * b3);
  return { th: s.th + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4), w: s.w + (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4) };
}

/* ------------------------------------------------------------------ Tepalik + halqa + chiqish yo'li */

/**
 * makeTrack — R birligidagi yo'l: tepalik y = Hr·(x/Lr)² (x ∈ [−Lr, 0]), halqa (markaz (0, 1), radius 1), gorizontal chiqish.
 * s — yo'l bo'ylab koordinata (R birligida): tepalikda manfiy, halqa pastida 0, halqada [0, 2π], undan keyin chiqish yo'li.
 * at(s) → { x, y, tx, ty } (birlik urinma; ty = dy/ds).
 */
export function makeTrack({ Hr = 3.6, Lr = 4.4, exit = 3.2, n = 1600 } = {}) {
  const yp = (x) => (2 * Hr * x) / (Lr * Lr), rampY = (x) => Hr * (x / Lr) ** 2;
  const xs = new Float64Array(n + 1), ss = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) xs[i] = -Lr * (1 - i / n);
  for (let i = n - 1; i >= 0; i--) { const xm = (xs[i] + xs[i + 1]) / 2; ss[i] = ss[i + 1] - (xs[i + 1] - xs[i]) * Math.hypot(1, yp(xm)); }
  const sMin = ss[0];
  const find = (arr, v) => { let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; } return lo; };
  const xOfS = (s) => { if (s <= sMin) return -Lr; if (s >= 0) return 0; const i = find(ss, s), t = (s - ss[i]) / (ss[i + 1] - ss[i]); return xs[i] + t * (xs[i + 1] - xs[i]); };
  const sOfX = (x) => { if (x <= -Lr) return sMin; if (x >= 0) return 0; const i = find(xs, x), t = (x - xs[i]) / (xs[i + 1] - xs[i]); return ss[i] + t * (ss[i + 1] - ss[i]); };
  function at(s) {
    if (s < 0) { const x = xOfS(s), d = yp(x), L = Math.hypot(1, d); return { x, y: rampY(x), tx: 1 / L, ty: d / L, seg: "ramp" }; }
    if (s <= TAU) return { x: Math.sin(s), y: 1 - Math.cos(s), tx: Math.cos(s), ty: Math.sin(s), seg: "loop" };
    return { x: s - TAU, y: 0, tx: 1, ty: 0, seg: "exit" };
  }
  /** Tayanch reaksiyasi N/(mg) (w — ds/dt, R birligida; R metrda). */
  function normal(s, w, R, g = G) {
    const v2 = w * w * R / g; // v²/(gR)
    if (s < 0) { const x = xOfS(s), d = yp(x), q = 1 + d * d, kap = (2 * Hr) / (Lr * Lr) / q ** 1.5; return 1 / Math.sqrt(q) + v2 * kap; }
    if (s <= TAU) return v2 + Math.cos(s);
    return 1;
  }
  const sOfH = (k) => sOfX(-Lr * Math.sqrt(Math.min(1, Math.max(0, k / Hr))));
  return { Hr, Lr, exit, sMin, at, xOfS, sOfX, rampY, normal, sOfH };
}

/** Yo'l bo'ylab sirpanish (ishqalanishsiz): s̈ = −(g/R)·dy/ds, RK4. st = { s, w }. */
export function trackStep(tr, st, dt, R, g = G) {
  const f = (s) => -(g / R) * tr.at(s).ty;
  const k1s = st.w, k1w = f(st.s);
  const k2s = st.w + (dt / 2) * k1w, k2w = f(st.s + (dt / 2) * k1s);
  const k3s = st.w + (dt / 2) * k2w, k3w = f(st.s + (dt / 2) * k2s);
  const k4s = st.w + dt * k3w, k4w = f(st.s + dt * k3s);
  return { s: st.s + (dt / 6) * (k1s + 2 * k2s + 2 * k3s + k4s), w: st.w + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w) };
}

/* ------------------------------------------------------------------ Uzatmalar */

export const beltOmega2 = (omega1, R1, R2) => (omega1 * R1) / R2;
