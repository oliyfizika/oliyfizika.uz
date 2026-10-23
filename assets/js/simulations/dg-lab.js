// ==========================================================================
// Elektron difraksiyasi laboratoriya ishi — natijalarni qayta ishlash (DOM'siz).
// 1-topshiriq (Devisson–Jermer): λ = d·sinφ/n, λ_dB = h/√(2meU); λ = k/√U (nol orqali EKK) → h = k·√(2mₑe).
// 2-topshiriq (grafit): λ = d·D/(2L) (kichik burchak), D = s/√U → k = s·d/(2L) → h.
// ==========================================================================

import { K_NR, NI_D, DG, GRAPHITE, ME, QE, dgCurrent, dgPeak } from "./dg-physics.js";

const RAD = Math.PI / 180;
const meanStd = (v) => { const n = v.length, m = v.reduce((s, x) => s + x, 0) / n; const sd = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0; return { m, sd, sm: sd / Math.sqrt(n) }; };
/** y = k·x (nol orqali) — k va uning xatoligi. */
export function fit0(xs, ys) {
  let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += x * x; sxy += x * ys[i]; });
  const k = sxy / sxx, n = xs.length, ss = xs.reduce((s, x, i) => s + (ys[i] - k * x) ** 2, 0);
  return { k, sk: n > 1 ? Math.sqrt(ss / (n - 1) / sxx) : 0, n };
}
/** k (nm·V^½) → Plank doimiysi, J·s. */
export const hFromK = (k) => k * 1e-9 * Math.sqrt(2 * ME * QE);

/* ------------------------------------------------------------------ Devisson–Jermer */

export function checkDG(r) {
  if (![r.U, r.phi, r.n].every(Number.isFinite)) return { ok: false, err: "to‘liq emas" };
  if (r.U < DG.Umin || r.U > DG.Umax) return { ok: false, err: `U ${DG.Umin}…${DG.Umax} V` };
  if (r.phi < DG.phiMin || r.phi > DG.phiMax) return { ok: false, err: `φ ${DG.phiMin}…${DG.phiMax}°` };
  if (![1, 2].includes(r.n)) return { ok: false, err: "n = 1 yoki 2" };
  return { ok: true };
}
export function analyzeDG(rowsIn) {
  const rows = rowsIn.filter((r) => checkDG(r).ok).map((r) => {
    const lam = (NI_D * Math.sin(r.phi * RAD)) / r.n, lamDB = K_NR / Math.sqrt(r.U);
    return { ...r, lam, lamDB, x: 1 / Math.sqrt(r.U), dev: (lam - lamDB) / lamDB };
  });
  const out = { rows, ok: rows.length >= 3 && new Set(rows.map((r) => r.U)).size >= 3 };
  if (rows.length >= 2) { out.fit = fit0(rows.map((r) => r.x), rows.map((r) => r.lam)); out.h = hFromK(out.fit.k); out.sh = hFromK(out.fit.sk); }
  return out;
}
/** Qurilmadagi haqiqiy (o‘lchanadigan) maksimum: nazariy burchak atrofida I(φ) ning eng katta qiymati. */
export function dgTrueMax(U, n = 1) {
  const t = dgPeak(U, n); if (t === null) return null;
  let best = -1, bp = t; for (let f = Math.max(DG.phiMin, t - 8); f <= Math.min(DG.phiMax, t + 8); f += 0.1) { const I = dgCurrent(U, f); if (I > best) { best = I; bp = f; } }
  return bp;
}
export function matchDG(r, tol = 1.5) { const m = dgTrueMax(r.U, r.n); return m !== null && Math.abs(m - r.phi) <= tol; }

/* ------------------------------------------------------------------ Grafit */

export function checkGr(r) {
  if (!Number.isFinite(r.U)) return { ok: false, err: "U kiritilmagan" };
  if (r.U < GRAPHITE.Umin || r.U > GRAPHITE.Umax) return { ok: false, err: `U ${GRAPHITE.Umin}…${GRAPHITE.Umax} kV` };
  if (!(Number.isFinite(r.D1) || Number.isFinite(r.D2))) return { ok: false, err: "D₁ yoki D₂ kerak" };
  if ((Number.isFinite(r.D1) && !(r.D1 > 5 && r.D1 < 90)) || (Number.isFinite(r.D2) && !(r.D2 > 5 && r.D2 < 120))) return { ok: false, err: "D mm da" };
  return { ok: true };
}
export function analyzeGr(rowsIn) {
  const [d1, d2] = GRAPHITE.d, L = GRAPHITE.L;
  const rows = rowsIn.filter((r) => checkGr(r).ok).map((r) => {
    const l1 = Number.isFinite(r.D1) ? (d1 * r.D1) / (2 * L) : null, l2 = Number.isFinite(r.D2) ? (d2 * r.D2) / (2 * L) : null;
    const ls = [l1, l2].filter((v) => v !== null), lam = ls.reduce((s, v) => s + v, 0) / ls.length;
    return { ...r, l1, l2, lam, lamDB: K_NR / Math.sqrt(r.U * 1000), x: 1 / Math.sqrt(r.U * 1000) };
  });
  const out = { rows, ok: rows.length >= 3 && new Set(rows.map((r) => r.U)).size >= 3 };
  const p1 = rows.filter((r) => r.l1 !== null), p2 = rows.filter((r) => r.l2 !== null);
  if (p1.length >= 2) { out.f1 = fit0(p1.map((r) => r.x), p1.map((r) => r.D1)); out.k1 = (out.f1.k * d1) / (2 * L); out.sk1 = (out.f1.sk * d1) / (2 * L); }
  if (p2.length >= 2) { out.f2 = fit0(p2.map((r) => r.x), p2.map((r) => r.D2)); out.k2 = (out.f2.k * d2) / (2 * L); out.sk2 = (out.f2.sk * d2) / (2 * L); }
  if (rows.length >= 2) { out.fit = fit0(rows.map((r) => r.x), rows.map((r) => r.lam)); out.h = hFromK(out.fit.k); out.sh = hFromK(out.fit.sk); }
  return out;
}
export function matchGr(r, journal, tol = 0.051) {
  const has = (D) => !Number.isFinite(D) || journal.some((j) => Math.abs(j.U - r.U) < 1e-6 && Math.abs(j.D - D) <= tol);
  return has(r.D1) && has(r.D2);
}
export { meanStd };
