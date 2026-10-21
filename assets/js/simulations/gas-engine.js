// ==========================================================================
// Molekulyar harakat — zarrachalar dvigateli (DOM'siz, ikki o'lchovli model).
// Qattiq disklar: elastik to'qnashuvlar (impuls va energiya saqlanadi), devorlar va harakatlanuvchi porshen.
// To'qnashuvlarni topish — to'r (spatial grid) bilan O(N); katta zarra (Broun) alohida tekshiriladi.
// Birliklar: uzunlik — «u» (dunyo birligi), vaqt — s, massa — nisbiy (azot molekulasi = 1).
// Ikki o'lchovda ekvipartitsiya: o'rtacha kinetik energiya Ē = kT, bosim p = N·kT / S (S — yuza).
// ==========================================================================

/** Gazlar: M — molyar massa (g/mol). */
export const GASES = {
  H2:  { name: "Vodorod (H₂)", M: 2 },
  He:  { name: "Geliy (He)", M: 4 },
  Ne:  { name: "Neon (Ne)", M: 20 },
  N2:  { name: "Azot (N₂)", M: 28 },
  O2:  { name: "Kislorod (O₂)", M: 32 },
  Ar:  { name: "Argon (Ar)", M: 40 },
  CO2: { name: "Karbonat angidrid (CO₂)", M: 44 },
};

export const R = 8.314;          // J/(mol·K)
export const K_B = 1.380649e-23; // J/K
export const N_A = 6.02214076e23;
export const M_REF = 28;         // modelda massa birligi — azot
export const E0 = 11250;         // 300 K dagi kT (model birliklarida): azotda v_kv ≈ 150 u/s
export const kTof = (T) => (E0 * T) / 300;
export const Tof = (kT) => (300 * kT) / E0;

/** Haqiqiy (3D) gaz formulalari — sahifada ko'rsatish uchun. M — g/mol. */
export const vRms3D = (T, M) => Math.sqrt((3 * R * T) / (M / 1000));
export const vMean3D = (T, M) => Math.sqrt((8 * R * T) / (Math.PI * (M / 1000)));
export const vProb3D = (T, M) => Math.sqrt((2 * R * T) / (M / 1000));
export const meanKE3D = (T) => 1.5 * K_B * T;
export const idealP = (nu, T, V) => (nu * R * T) / V; // Pa, V — m³

/** Ikki o'lchovli Maksvell taqsimoti: f(v) = (2v/σ²)·exp(−v²/σ²), σ² = ⟨v²⟩. */
export const maxwell2D = (v, v2) => (2 * v / v2) * Math.exp(-(v * v) / v2);

/** Normal taqsimotli tasodifiy son (Boks–Myuller). */
function gauss(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Takrorlanuvchi tasodifiy sonlar (testlar uchun). */
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * createWorld({ W, H, top, rand }) — to'rtburchak idish: x ∈ [0, W], y ∈ [top, H] (y pastga).
 * top — porshen (yuqori devor) holati, topV — uning tezligi. barrier — to'siq x koordinatasi yoki null.
 */
export function createWorld({ W, H, top = 0, rand = Math.random } = {}) {
  return {
    W, H, top, topV: 0, barrier: null, rand,
    x: [], y: [], vx: [], vy: [], r: [], m: [], sp: [],
    big: -1,                 // katta (Broun) zarraning indeksi
    impulse: 0, impulseTop: 0, // devorlarga berilgan impuls yig'indisi
    collisions: 0, time: 0,
  };
}

/** Zarra qo'shish: tasodifiy joy (ustma-ust tushmasin), tezlik — Maksvell (kT bo'yicha). */
export function addParticles(w, n, { r = 3, m = 1, sp = 0, kT = E0, xMin = 0, xMax = w.W } = {}) {
  const sd = Math.sqrt(kT / m);
  for (let k = 0; k < n; k++) {
    let x = 0, y = 0, ok = false;
    for (let t = 0; t < 60 && !ok; t++) {
      x = xMin + r + w.rand() * (xMax - xMin - 2 * r);
      y = w.top + r + w.rand() * (w.H - w.top - 2 * r);
      ok = true;
      for (let i = 0; i < w.x.length; i++) { const dx = w.x[i] - x, dy = w.y[i] - y, rr = w.r[i] + r; if (dx * dx + dy * dy < rr * rr) { ok = false; break; } }
    }
    w.x.push(x); w.y.push(y);
    w.vx.push(gauss(w.rand) * sd); w.vy.push(gauss(w.rand) * sd);
    w.r.push(r); w.m.push(m); w.sp.push(sp);
  }
}

/** Katta (Broun) zarra: idish markaziga, tinch holatda. */
export function addBig(w, { r = 14, m = 50, kT = E0 } = {}) {
  const cx = w.W / 2, cy = (w.top + w.H) / 2;
  // markaz atrofidagi mayda zarralarni chetga suramiz
  for (let i = 0; i < w.x.length; i++) {
    const dx = w.x[i] - cx, dy = w.y[i] - cy, d = Math.hypot(dx, dy), rr = r + w.r[i] + 1;
    if (d < rr) { const k = rr / (d || 1); w.x[i] = cx + dx * k; w.y[i] = cy + (d ? dy * k : rr); }
  }
  const sd = Math.sqrt(kT / m);
  w.x.push(cx); w.y.push(cy); w.vx.push(gauss(w.rand) * sd); w.vy.push(gauss(w.rand) * sd);
  w.r.push(r); w.m.push(m); w.sp.push(9);
  w.big = w.x.length - 1;
}

export const count = (w) => w.x.length;

/** Kinetik energiya (yig'indi) va o'rtacha (katta zarrasiz). */
export function kinetic(w, { skipBig = true, sp = null } = {}) {
  let E = 0, n = 0;
  for (let i = 0; i < w.x.length; i++) {
    if (skipBig && i === w.big) continue;
    if (sp !== null && w.sp[i] !== sp) continue;
    E += 0.5 * w.m[i] * (w.vx[i] * w.vx[i] + w.vy[i] * w.vy[i]); n++;
  }
  return { E, mean: n ? E / n : 0, n };
}

/** Termostat (Berendsen): tezliklarni T_target tomon asta o'zgartiradi. tau — s. */
export function thermostat(w, kTtarget, dt, tau) {
  const { mean } = kinetic(w);
  if (mean <= 0) return;
  const lam = Math.sqrt(Math.max(0.5, Math.min(2, 1 + (dt / tau) * (kTtarget / mean - 1))));
  for (let i = 0; i < w.x.length; i++) { w.vx[i] *= lam; w.vy[i] *= lam; }
}

/** Ikki disk orasidagi elastik to'qnashuv. */
function collide(w, i, j) {
  const dx = w.x[j] - w.x[i], dy = w.y[j] - w.y[i];
  const rr = w.r[i] + w.r[j];
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 === 0) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  const vrel = (w.vx[i] - w.vx[j]) * nx + (w.vy[i] - w.vy[j]) * ny; // > 0 — yaqinlashmoqda
  const mi = w.m[i], mj = w.m[j];
  if (vrel > 0) {
    const J = (2 * mi * mj / (mi + mj)) * vrel;
    w.vx[i] -= (J / mi) * nx; w.vy[i] -= (J / mi) * ny;
    w.vx[j] += (J / mj) * nx; w.vy[j] += (J / mj) * ny;
    w.collisions++;
  }
  // ustma-ust tushishni massaga teskari proporsional tuzatish
  const over = rr - d;
  const fi = mj / (mi + mj), fj = mi / (mi + mj);
  w.x[i] -= nx * over * fi; w.y[i] -= ny * over * fi;
  w.x[j] += nx * over * fj; w.y[j] += ny * over * fj;
}

/** Devorlar (porshen va to'siq bilan). Bosim uchun devorga berilgan impuls yig'iladi. */
function walls(w, i) {
  const r = w.r[i], m = w.m[i];
  if (w.x[i] < r) { w.x[i] = 2 * r - w.x[i]; if (w.vx[i] < 0) { w.impulse += -2 * m * w.vx[i]; w.vx[i] = -w.vx[i]; } }
  if (w.x[i] > w.W - r) { w.x[i] = 2 * (w.W - r) - w.x[i]; if (w.vx[i] > 0) { w.impulse += 2 * m * w.vx[i]; w.vx[i] = -w.vx[i]; } }
  if (w.y[i] > w.H - r) { w.y[i] = 2 * (w.H - r) - w.y[i]; if (w.vy[i] > 0) { w.impulse += 2 * m * w.vy[i]; w.vy[i] = -w.vy[i]; } }
  if (w.y[i] < w.top + r) {
    // harakatlanuvchi porshen: v' = 2u − v (porshen sanoq tizimida aks etish)
    const u = w.topV;
    w.y[i] = 2 * (w.top + r) - w.y[i];
    if (w.vy[i] < u) { const J = 2 * m * (u - w.vy[i]); w.impulse += J; w.impulseTop += J; w.vy[i] = 2 * u - w.vy[i]; }
    if (w.y[i] < w.top + r) w.y[i] = w.top + r;
  }
  if (w.barrier !== null) {
    const b = w.barrier;
    if (w.x[i] < b && w.x[i] > b - r) { w.x[i] = 2 * (b - r) - w.x[i]; if (w.vx[i] > 0) w.vx[i] = -w.vx[i]; }
    else if (w.x[i] >= b && w.x[i] < b + r) { w.x[i] = 2 * (b + r) - w.x[i]; if (w.vx[i] < 0) w.vx[i] = -w.vx[i]; }
  }
}

/** Bir qadam (dt kichik: eng tez zarra dt da radiusining yarmidan ko'p siljimasin). */
export function step(w, dt) {
  const n = w.x.length;
  for (let i = 0; i < n; i++) { w.x[i] += w.vx[i] * dt; w.y[i] += w.vy[i] * dt; }
  // To'r: mayda zarralar
  let rmax = 0;
  for (let i = 0; i < n; i++) if (i !== w.big && w.r[i] > rmax) rmax = w.r[i];
  const cs = Math.max(2 * rmax, 1);
  const cols = Math.max(1, Math.ceil(w.W / cs)), rows = Math.max(1, Math.ceil((w.H - w.top) / cs) + 1);
  const head = new Int32Array(cols * rows).fill(-1), next = new Int32Array(n).fill(-1);
  const cell = (i) => {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(w.x[i] / cs)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor((w.y[i] - w.top) / cs)));
    return [cx, cy];
  };
  for (let i = 0; i < n; i++) { if (i === w.big) continue; const [cx, cy] = cell(i); const k = cy * cols + cx; next[i] = head[k]; head[k] = i; }
  for (let i = 0; i < n; i++) {
    if (i === w.big) continue;
    const [cx, cy] = cell(i);
    for (let oy = 0; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (oy === 0 && ox < 0) continue;
      const gx = cx + ox, gy = cy + oy;
      if (gx < 0 || gx >= cols || gy >= rows) continue;
      for (let j = head[gy * cols + gx]; j !== -1; j = next[j]) {
        if (oy === 0 && ox === 0 && j <= i) continue;
        collide(w, i, j);
      }
    }
  }
  if (w.big >= 0) for (let i = 0; i < n; i++) if (i !== w.big) collide(w, w.big, i);
  for (let i = 0; i < n; i++) walls(w, i);
  w.time += dt;
}

/** Porshenni berilgan holatga u tezlik bilan siljitish (dt davomida). Qaytaradi: haqiqiy tezlik. */
export function movePiston(w, target, uMax, dt) {
  const d = target - w.top;
  const u = Math.max(-uMax, Math.min(uMax, d / dt));
  const move = u * dt;
  w.top += move; w.topV = u;
  return u;
}

/** Maksimal tezlikdan xavfsiz qadam: siljish ≤ 0,4·r_min. */
export function safeDt(w) {
  let vmax = 1, rmin = Infinity;
  for (let i = 0; i < w.x.length; i++) { const v = Math.hypot(w.vx[i], w.vy[i]); if (v > vmax) vmax = v; if (w.r[i] < rmin) rmin = w.r[i]; }
  return Math.min(0.01, (0.4 * rmin) / vmax);
}

/** Tezliklar gistogrammasi (katta zarrasiz). */
export function speedHistogram(w, bins, vmax) {
  const h = new Array(bins).fill(0);
  for (let i = 0; i < w.x.length; i++) {
    if (i === w.big) continue;
    const v = Math.hypot(w.vx[i], w.vy[i]);
    const k = Math.floor((v / vmax) * bins);
    if (k >= 0 && k < bins) h[k]++;
  }
  return h;
}
