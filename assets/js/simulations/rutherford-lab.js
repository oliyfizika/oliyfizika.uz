// ==========================================================================
// Rezerford laboratoriya ishi — natijalarni qayta ishlash (DOM'siz).
// 1-jadval: θ, t, N → n = N/t, sin⁴(θ/2), K = n·sin⁴(θ/2); K̄ (vaznli o'rtacha), χ²; ln n = m·ln(1/sin⁴(θ/2)) + c
// to'g'ri chiziq (m ≈ 1); yadro zaryadi Z; eng yaqin masofa r_min (yadro o'lchamining yuqori chegarasi).
// 2-jadval: boshqa folgalar — har biri uchun Z.
// ==========================================================================

import { KE2, FM2_CM2, MATERIALS, SOURCES, APP, areal, dOmega, collisionD, rMin, nucRadius } from "./rutherford-physics.js";

const RAD = Math.PI / 180;
export const sin4 = (thDeg) => Math.sin((Math.abs(thDeg) * RAD) / 2) ** 4;

/** Satrni tekshirish: { ok, err }. */
export function checkRow(r, minDeg = 5) {
  if (![r.th, r.t, r.N].every((v) => Number.isFinite(v))) return { ok: false, err: "to‘liq emas" };
  if (Math.abs(r.th) < minDeg || Math.abs(r.th) > 175) return { ok: false, err: `θ ${minDeg}°…175° oralig‘ida bo‘lsin` };
  if (r.t <= 0) return { ok: false, err: "t > 0 bo‘lsin" };
  if (r.N < 1 || !Number.isInteger(r.N)) return { ok: false, err: "N — butun musbat son" };
  return { ok: true };
}

/** Z ni K = n·sin⁴(θ/2) dan topish: K = I₀·(n_a t)·ΔΩ·(zZe²/4E)². */
export function zFromK(K, { mat, tUm, E }, app = APP, z = 2) {
  const nt = areal(MATERIALS[mat], tUm), dO = dOmega(app.Ad, app.L);
  const a = Math.sqrt(K / (app.I0 * nt * dO * FM2_CM2)); // fm
  return (4 * E * a) / (z * KE2);
}

/** Vaznli chiziqli regressiya y = m·x + c (w — vaznlar). */
export function wfit(xs, ys, ws) {
  let S = 0, Sx = 0, Sy = 0, Sxx = 0, Sxy = 0;
  xs.forEach((x, i) => { const w = ws[i]; S += w; Sx += w * x; Sy += w * ys[i]; Sxx += w * x * x; Sxy += w * x * ys[i]; });
  const D = S * Sxx - Sx * Sx; if (!(Math.abs(D) > 1e-12)) return null;
  const m = (S * Sxy - Sx * Sy) / D, c = (Sxx * Sy - Sx * Sxy) / D;
  return { m, c, sm: Math.sqrt(S / D), sc: Math.sqrt(Sxx / D) };
}

/** 1-jadvalni tahlil qilish. cond = { mat, tUm, src } (src — SOURCES kaliti). */
export function analyze(rowsIn, cond, app = APP) {
  const E = SOURCES[cond.src].E, m = MATERIALS[cond.mat];
  const rows = rowsIn.filter((r) => checkRow(r).ok).map((r) => {
    const n = r.N / r.t, s4 = sin4(r.th), K = n * s4;
    return { ...r, n, sn: Math.sqrt(r.N) / r.t, s4, inv: 1 / s4, K, sK: K / Math.sqrt(r.N) };
  });
  const out = { rows, E, mat: m, cond, ok: rows.length >= 3 };
  if (!rows.length) return out;
  // K̄ — vaznli o'rtacha
  let W = 0, WK = 0; rows.forEach((r) => { const w = 1 / r.sK ** 2; W += w; WK += w * r.K; });
  out.K = WK / W; out.sK = 1 / Math.sqrt(W);
  out.chi2 = rows.reduce((s, r) => s + ((r.K - out.K) / r.sK) ** 2, 0); out.dof = rows.length - 1;
  out.Kplain = rows.reduce((s, r) => s + r.K, 0) / rows.length;
  // ln n = m·ln(1/sin⁴) + c, σ(ln n) = 1/√N → vazn N
  if (rows.length >= 2) out.fit = wfit(rows.map((r) => Math.log(r.inv)), rows.map((r) => Math.log(r.n)), rows.map((r) => r.N));
  // Z
  out.Z = zFromK(out.K, { mat: cond.mat, tUm: cond.tUm, E }, app); out.sZ = (out.Z / 2) * (out.sK / out.K);
  // yadro o'lchami: eng katta burchakda ham formula bajarildi → R < r_min
  const thMax = Math.max(...rows.map((r) => Math.abs(r.th)));
  out.thMax = thMax; out.d = collisionD(m.Z, E); out.rmin = rMin(out.d, thMax * RAD); out.R = nucRadius(m.A);
  // har bir nuqta uchun nisbiy og'ish
  rows.forEach((r) => { r.dev = (r.K - out.K) / out.K; r.sig = (r.K - out.K) / r.sK; });
  return out;
}

/** 2-jadval: { mat, tUm, src, th, t, N } satrlari uchun Z. */
export function analyzeFoils(rowsIn, app = APP) {
  return rowsIn.filter((r) => MATERIALS[r.mat] && SOURCES[r.src] && r.tUm > 0 && checkRow(r).ok).map((r) => {
    const E = SOURCES[r.src].E, n = r.N / r.t, K = n * sin4(r.th), Z = zFromK(K, { mat: r.mat, tUm: r.tUm, E }, app);
    return { ...r, E, n, K, Z, sZ: Z / (2 * Math.sqrt(r.N)), Ztrue: MATERIALS[r.mat].Z };
  });
}

/** O'lchov jurnalidan mos yozuvni topish. */
export function matchJournal(row, cond, journal) {
  return journal.some((j) => j.mat === cond.mat && Math.abs(j.tUm - cond.tUm) < 1e-6 && j.src === cond.src && Math.abs(j.th - row.th) < 0.01 && Math.abs(j.t - row.t) < 1e-6 && j.N === row.N);
}
