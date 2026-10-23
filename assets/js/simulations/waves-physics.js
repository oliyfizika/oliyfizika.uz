// ==========================================================================
// Mexanik to'lqinlar va tovush — fizika (DOM'siz).
// 1) Ip (prujina) dagi to'lqin: 1D to'lqin tenglamasi ∂²u/∂t² = v²∂²u/∂x² − γ∂u/∂t, chekli ayirmalar (leapfrog),
//    chap uchi — manba (garmonik / impuls / qo'lda), o'ng uchi — mahkam / erkin / ochiq (yutuvchi, Mur sharti).
// 2) Suv sirtidagi to'lqinlar: nuqtaviy manbalardan aylanma to'lqinlar yig'indisi (analitik), interferensiya.
// 3) Doppler effekti: harakatlanuvchi manba, to'lqin frontlari, kuzatuvchi qabul qiladigan chastota, Max konusi.
// ==========================================================================

export const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ 1) Ip */

export class StringWave {
  /** L — ip uzunligi (m), n — kataklar soni. */
  constructor({ L = 4, n = 400, v = 2, gamma = 0.05, right = "fixed" } = {}) {
    this.L = L; this.n = n; this.dx = L / n; this.v = v; this.gamma = gamma; this.right = right;
    this.u = new Float64Array(n + 1); this.uo = new Float64Array(n + 1); this.un = new Float64Array(n + 1);
    this.t = 0;
  }
  reset() { this.u.fill(0); this.uo.fill(0); this.un.fill(0); this.t = 0; }
  /** Bitta qadam; drive(t) — chap uchning siljishi (null bo'lsa erkin uch). */
  stepOnce(dt, drive) {
    const { u, uo, un, n } = this, C = (this.v * dt) / this.dx, C2 = C * C, g = (this.gamma * dt) / 2;
    for (let i = 1; i < n; i++) un[i] = (2 * u[i] - (1 - g) * uo[i] + C2 * (u[i + 1] - 2 * u[i] + u[i - 1])) / (1 + g);
    const tn = this.t + dt;
    un[0] = drive ? drive(tn) : un[1];
    if (this.right === "fixed") un[n] = 0;
    else if (this.right === "free") un[n] = un[n - 1];
    else un[n] = u[n - 1] + ((C - 1) / (C + 1)) * (un[n - 1] - u[n]); // Mur yutuvchi sharti
    this.uo.set(u); this.u.set(un); this.t = tn;
  }
  /** T vaqt oralig'ini barqaror qadamlarga bo'lib o'tish (Kurant soni ≤ 0,9). */
  advance(T, drive) {
    const dtMax = (0.9 * this.dx) / this.v, k = Math.max(1, Math.ceil(T / dtMax)), dt = T / k;
    for (let i = 0; i < k; i++) this.stepOnce(dt, drive);
  }
  /** Energiya (birlik chiziqli zichlik va tarangliklar bilan, ρ = 1, T = v²): kinetik + potensial. */
  energy(dt) {
    const { u, uo, n, dx, v } = this; let E = 0;
    for (let i = 0; i < n; i++) { const vel = (u[i] - uo[i]) / dt, s = (u[i + 1] - u[i]) / dx; E += 0.5 * vel * vel * dx + 0.5 * v * v * s * s * dx; }
    return E;
  }
  at(x) { const k = Math.min(this.n, Math.max(0, x / this.dx)), i = Math.floor(k), f = k - i; return i >= this.n ? this.u[this.n] : this.u[i] * (1 - f) + this.u[i + 1] * f; }
}

/** Turg'un to'lqin chastotalari: ikki uchi mahkam — f_n = n·v/(2L); bir uchi erkin — f_n = (2n−1)·v/(4L). */
export function harmonic(n, v, L, ends = "fixed") { return ends === "free" ? ((2 * n - 1) * v) / (4 * L) : (n * v) / (2 * L); }
/** Berilgan f ga eng yaqin garmonika: { n, fn, rel } */
export function nearestHarmonic(f, v, L, ends = "fixed") {
  let best = { n: 1, fn: harmonic(1, v, L, ends), rel: Infinity };
  for (let n = 1; n < 60; n++) { const fn = harmonic(n, v, L, ends), rel = Math.abs(f - fn) / fn; if (rel < best.rel) best = { n, fn, rel }; }
  return best;
}

/* ------------------------------------------------------------------ 2) Suv sirtidagi to'lqinlar */

/**
 * Nuqtaviy manbalar: [{x, y, phase}], k = 2π/λ, ω = 2πf, t — vaqt, t0 — manba yoqilgan payt (front tarqalishi uchun), v — tezlik.
 * Amplituda masofa bilan 1/√r kamayadi (r0 dan boshlab). Qaytaradi sirt balandligi.
 */
export function rippleHeight(srcs, x, y, t, { k, w, v, r0 = 1, t0 = -Infinity }) {
  let h = 0;
  for (const s of srcs) {
    const r = Math.hypot(x - s.x, y - s.y);
    if (r > v * (t - t0)) continue;
    h += Math.cos(k * r - w * t + (s.phase || 0)) / Math.sqrt(Math.max(r, r0) / r0);
  }
  return h;
}
/** Barqaror rejimdagi tebranish amplitudasi nuqtada (kompleks yig'indi moduli). */
export function rippleAmplitude(srcs, x, y, { k, r0 = 1 }) {
  let re = 0, im = 0;
  for (const s of srcs) {
    const r = Math.hypot(x - s.x, y - s.y), a = 1 / Math.sqrt(Math.max(r, r0) / r0), ph = k * r + (s.phase || 0);
    re += a * Math.cos(ph); im += a * Math.sin(ph);
  }
  return Math.hypot(re, im);
}
/** Yo'llar farqi va uning λ ga nisbati, interferensiya sharti. */
export function pathDifference(s1, s2, x, y, lambda, dphi = 0) {
  const d = Math.hypot(x - s1.x, y - s1.y) - Math.hypot(x - s2.x, y - s2.y);
  const m = d / lambda + dphi / TAU; // faza farqini ham hisobga olgan holda
  const frac = m - Math.round(m);
  return { d, m, kind: Math.abs(frac) < 0.12 ? "max" : Math.abs(Math.abs(frac) - 0.5) < 0.12 ? "min" : "mid" };
}

/* ------------------------------------------------------------------ 3) Doppler */

/** Bir o'q bo'ylab: manba tezligi u, kuzatuvchi tezligi w (ikkalasi ham bir-biriga tomon musbat), muhitda tovush tezligi c. */
export const dopplerLine = (f, c, uSource, wObserver = 0) => (f * (c + wObserver)) / (c - uSource);

/**
 * Manba x_s(t) = x0 + u·t (y = ys) bo'ylab harakatlanadi. Kuzatuvchi (X, Y) t paytida qabul qilayotgan to'lqin chiqarilgan payt t_e:
 * |P − S(t_e)| = c·(t − t_e). Yechimlar (u < c — bitta, u > c — 0 yoki 2). Har biri uchun qabul qilinadigan chastota f/(1 − (u/c)cosθ).
 */
export function received(f, c, src, obs, t) {
  const { x0, y: ys, u } = src, dx0 = obs.x - x0, dy = obs.y - ys;
  // (dx0 − u t_e)² + dy² = c²(t − t_e)²  →  a t_e² + b t_e + c0 = 0
  const a = u * u - c * c, b = -2 * dx0 * u + 2 * c * c * t, c0 = dx0 * dx0 + dy * dy - c * c * t * t;
  const sols = [];
  if (Math.abs(a) < 1e-12) { const te = -c0 / b; if (te <= t) sols.push(te); }
  else {
    const D = b * b - 4 * a * c0;
    if (D >= 0) { const q = Math.sqrt(D); [(-b - q) / (2 * a), (-b + q) / (2 * a)].forEach((te) => { if (te <= t + 1e-12) sols.push(te); }); }
  }
  return sols.map((te) => {
    const sx = x0 + u * te, rx = obs.x - sx, ry = obs.y - ys, r = Math.hypot(rx, ry) || 1e-9;
    const cos = (rx * Math.sign(u || 1)) / r;
    return { te, r, f: f / (1 - (Math.abs(u) / c) * cos) };
  }).filter((s) => s.te >= -1e9).sort((p, q) => q.te - p.te);
}
/** Max soni va konus yarim burchagi (gradus): sin α = c/u. */
export const machAngle = (u, c) => (u > c ? (Math.asin(c / u) * 180) / Math.PI : null);

/** Ikki garmonik tebranish yig'indisi amplitudasi (bir xil chastota): A = √(A₁² + A₂² + 2A₁A₂cosΔφ). */
export const sumAmplitude = (A1, A2, dphi) => Math.sqrt(A1 * A1 + A2 * A2 + 2 * A1 * A2 * Math.cos(dphi));

export const MEDIA = [
  { id: "air", name: "Havo (20 °C)", c: 343 },
  { id: "water", name: "Suv", c: 1480 },
  { id: "steel", name: "Po‘lat", c: 5100 },
];
