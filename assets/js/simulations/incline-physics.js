// ==========================================================================
// Qiya tekislik fizikasi (DOM'siz, alohida tekshiriladi).
// x — tekislik bo'ylab PASTGA o'lchanadigan koordinata (m), v > 0 — pastga harakat.
// Tinch ishqalanish: |mg sinθ| ≤ μ mg cosθ bo'lsa va v = 0 — jism tinch turadi, F_t = mg sinθ.
// Integratsiya bosqichma-bosqich ANIQ (har bir oraliqda a = const), to'xtash momenti
// alohida topiladi — jism "teskari" tezlanib ketmaydi.
// ==========================================================================

export const G = 9.8;
export const PLANE_LENGTH = 5;   // m
export const BLOCK = 0.6;        // m (jism tomoni)
export const X_MIN = BLOCK / 2;
export const X_MAX = PLANE_LENGTH - BLOCK / 2;
const EPS_V = 1e-9;

/**
 * Joriy holat bo'yicha kuchlar va tezlanish.
 * p: { theta (rad), mu, m }
 * Qaytaradi: { a, friction (ishorali: + pastga), kind: "static"|"kinetic"|"none", N, gPar, mode }
 * mode: "rest" | "down" | "up"
 */
export function dynamics(v, p) {
  const s = Math.sin(p.theta), c = Math.cos(p.theta);
  const N = p.m * G * c;
  const gPar = p.m * G * s;        // mg sinθ, pastga
  const fMax = p.mu * N;
  if (v > EPS_V) {
    const f = -fMax;               // harakatga qarshi (yuqoriga)
    return { a: (gPar + f) / p.m, friction: f, kind: p.mu > 0 ? "kinetic" : "none", N, gPar, mode: "down" };
  }
  if (v < -EPS_V) {
    const f = +fMax;               // harakatga qarshi (pastga)
    return { a: (gPar + f) / p.m, friction: f, kind: p.mu > 0 ? "kinetic" : "none", N, gPar, mode: "up" };
  }
  // v = 0
  if (gPar > fMax + 1e-9) {
    return { a: (gPar - fMax) / p.m, friction: -fMax, kind: p.mu > 0 ? "kinetic" : "none", N, gPar, mode: "down" };
  }
  return { a: 0, friction: -gPar, kind: gPar > 1e-9 ? "static" : "none", N, gPar, mode: "rest" };
}

/** Holatni dt soniyaga suradi. st: { x, v, t, s, edge } — joyida o'zgartiriladi. */
export function step(st, p, dt) {
  let left = dt;
  for (let guard = 0; left > 1e-12 && guard < 8; guard++) {
    const d = dynamics(st.v, p);
    if (d.mode === "rest") { st.v = 0; st.t += left; return st; }

    // Tezlik nolga yetadigan vaqt (sekinlanish bo'lsa)
    let tStop = Infinity;
    if (st.v > EPS_V && d.a < 0) tStop = st.v / -d.a;
    if (st.v < -EPS_V && d.a > 0) tStop = -st.v / d.a;

    const h = Math.min(left, tStop);
    const x0 = st.x;
    let x1 = x0 + st.v * h + 0.5 * d.a * h * h;
    let v1 = st.v + d.a * h;
    if (h === tStop) v1 = 0;

    // Chegaralar: pastki va yuqori tirgak
    if (x1 >= X_MAX) {
      // tirgakka yetish vaqti: x0 + v t + a t²/2 = X_MAX
      const tHit = hitTime(x0, st.v, d.a, X_MAX);
      st.s += Math.abs(X_MAX - x0);
      st.vHit = Math.abs(st.v + d.a * tHit);
      st.x = X_MAX; st.v = 0; st.t += tHit; st.edge = "bottom";
      return st;
    }
    if (x1 <= X_MIN) {
      const tHit = hitTime(x0, st.v, d.a, X_MIN);
      st.s += Math.abs(x0 - X_MIN);
      st.vHit = Math.abs(st.v + d.a * tHit);
      st.x = X_MIN; st.v = 0; st.t += tHit; st.edge = "top";
      left -= tHit;
      continue;
    }
    st.s += Math.abs(x1 - x0);
    st.x = x1; st.v = v1; st.t += h;
    left -= h;
  }
  return st;
}

function hitTime(x0, v, a, target) {
  const dx = target - x0;
  if (Math.abs(a) < 1e-12) return Math.abs(v) > 1e-12 ? Math.max(0, dx / v) : 0;
  const disc = v * v + 2 * a * dx;
  if (disc < 0) return 0;
  const r = Math.sqrt(disc);
  const roots = [(-v + r) / a, (-v - r) / a].filter((t) => t >= -1e-12);
  return roots.length ? Math.max(0, Math.min(...roots)) : 0;
}

export function initialState(v0) {
  return v0 > 0
    ? { x: X_MAX, v: -v0, t: 0, s: 0, edge: null, vHit: 0 }
    : { x: X_MIN, v: 0, t: 0, s: 0, edge: null, vHit: 0 };
}
