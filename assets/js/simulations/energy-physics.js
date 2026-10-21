// ==========================================================================
// Ish, quvvat va mexanik energiya — fizika (DOM'siz, SI).
// 1) Ish: A = F·s·cos α (ip bilan tortish, ishqalanish), quvvat P = A/t = F·v (lebyodka bilan ko'tarish).
// 2) Energiyaning saqlanishi: egri yo'l (skeytpark) bo'ylab sirpanish, ishqalanishda issiqlik Q.
// 3) Prujina energiyasi: kx²/2 → mgh (prujinali otgich).
// ==========================================================================

export const G = 9.81;

/** Ip bilan α burchak ostida tortilgan quti: N = mg − F sin α, f = μN. v > 0 — harakatda. */
export function pullForces({ M, F, alpha, mu, v = 0 }, g = G) {
  const Fx = F * Math.cos(alpha), N = Math.max(0, M * g - F * Math.sin(alpha)), fmax = mu * N;
  let f, a;
  if (v > 1e-9 || Fx > fmax) { f = fmax; a = (Fx - f) / M; } else { f = Fx; a = 0; }
  return { Fx, N, f, a };
}
/** Doimiy quvvatli dvigatel yukni tekis ko'taradi: v = P/(mg). */
export const liftSpeed = (P, m, g = G) => P / (m * g);

/* ------------------------------------------------------------------ Egri yo'l (Catmull–Rom splayn) */

export function makeTrack(pts, n = 900) {
  const P = [pts[0], ...pts, pts[pts.length - 1]], xs = [], ys = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]], m = Math.ceil(n / (pts.length - 1));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      xs.push(f(p0[0], p1[0], p2[0], p3[0])); ys.push(f(p0[1], p1[1], p2[1], p3[1]));
    }
  }
  xs.push(pts[pts.length - 1][0]); ys.push(pts[pts.length - 1][1]);
  const N = xs.length, S = new Float64Array(N);
  for (let i = 1; i < N; i++) S[i] = S[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  const L = S[N - 1];
  const idx = (s) => { let lo = 0, hi = N - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; } return lo; };
  function at(s) {
    s = Math.min(L, Math.max(0, s));
    const i = Math.min(N - 2, idx(s)), u = (s - S[i]) / Math.max(1e-12, S[i + 1] - S[i]);
    const x = xs[i] + (xs[i + 1] - xs[i]) * u, y = ys[i] + (ys[i + 1] - ys[i]) * u;
    const j0 = Math.max(0, i - 2), j1 = Math.min(N - 1, i + 3), dx = xs[j1] - xs[j0], dy = ys[j1] - ys[j0], dl = Math.hypot(dx, dy) || 1;
    // egrilik: qo'shni urinmalar burchagining o'zgarishi
    const k0 = Math.max(0, i - 6), k1 = Math.min(N - 1, i + 7), a0 = Math.atan2(ys[Math.min(N - 1, k0 + 2)] - ys[k0], xs[Math.min(N - 1, k0 + 2)] - xs[k0]), a1 = Math.atan2(ys[k1] - ys[Math.max(0, k1 - 2)], xs[k1] - xs[Math.max(0, k1 - 2)]);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const kap = da / Math.max(1e-6, S[k1] - S[k0]);
    return { x, y, tx: dx / dl, ty: dy / dl, kap };
  }
  /** Gorizontal koordinata bo'yicha eng yaqin s (sudrash uchun). */
  function nearest(px, py) { let best = 0, bd = Infinity; for (let i = 0; i < N; i += 2) { const d = (xs[i] - px) ** 2 + (ys[i] - py) ** 2; if (d < bd) { bd = d; best = S[i]; } } return best; }
  return { xs, ys, S, L, at, nearest };
}

/**
 * Yo'l bo'ylab sirpanish (yo'ldan ajralmaydi): s̈ = −g·ty − sign(v)·μ·N/m, N/m = g·tx + v²κ (≥ 0).
 * st = { s, v, Q } (Q — issiqlik / m, J/kg). Ishqalanish tezlikni nolga yetkazsa, jism to'xtaydi (agar qiyalik ushlab tursa).
 */
export function skateStep(tr, st, dt, mu, g = G) {
  const n = Math.max(1, Math.ceil(dt / 0.002)), h = dt / n;
  let { s, v, Q } = st;
  for (let i = 0; i < n; i++) {
    const p = tr.at(s), Nm = Math.max(0, g * p.tx + v * v * p.kap); // N/m = g·n_y + v²κ, n = (−ty, tx)
    const fric = mu * Nm, aG = -g * p.ty;
    if (Math.abs(v) < 1e-6 && Math.abs(aG) <= fric) { v = 0; continue; } // tinchlikdagi ishqalanish ushlab turadi
    const dir = Math.abs(v) > 1e-6 ? Math.sign(v) : Math.sign(aG);
    let v1 = v + (aG - dir * fric) * h;
    if (dir !== 0 && Math.sign(v1) !== dir && Math.abs(v) > 1e-9 && fric > 0 && Math.abs(aG) <= fric) v1 = 0;
    const ds = 0.5 * (v + v1) * h;
    Q += fric * Math.abs(ds); s += ds; v = v1;
    if (s <= 0) { s = 0; v = Math.abs(v); } else if (s >= tr.L) { s = tr.L; v = -Math.abs(v); }
  }
  return { s, v, Q };
}

/* ------------------------------------------------------------------ Prujinali otgich */

/** Siqilish x bo'lsa, eng past nuqtadan ko'tarilish balandligi H = kx²/(2mg). */
export const launchHeight = (k, x, m, g = G) => (k * x * x) / (2 * m * g);
/** y — sharcha pastki nuqtasi (prujina erkin uchi y = 0), siqilgan holatda y < 0. */
export function springBallStep(st, dt, k, m, g = G) {
  const n = Math.max(1, Math.ceil(dt / 2e-4)), h = dt / n;
  let { y, v } = st;
  for (let i = 0; i < n; i++) { const a = (y < 0 ? (-k * y) / m : 0) - g; v += a * h; y += v * h; }
  return { y, v };
}
