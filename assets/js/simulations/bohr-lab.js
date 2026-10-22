// ==========================================================================
// Bor postulatlari laboratoriya ishi — natijalarni qayta ishlash (DOM'siz).
// 1-topshiriq (Frank–Gers): U_k maksimumlar → U_k = U₀ + k·ΔU (EKK), E₁ = eΔU, λ = hc/E₁.
// 2-topshiriq (Balmer): φ = (φ_o‘ng − φ_chap)/2, λ = d·sinφ/k, R = 1/(λ(1/4 − 1/n²)), hν ↔ E_n − E₂.
// ==========================================================================

import { GASES, LINES, GRATINGS, HC_EV_NM, R_H, levelEv, fhMaxima } from "./bohr-physics.js";

const RAD = Math.PI / 180;

/** Oddiy chiziqli regressiya y = a + b·x (σ — qoldiqlardan). */
export function lfit(xs, ys) {
  const n = xs.length; if (n < 2) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); });
  if (!(sxx > 0)) return null;
  const b = sxy / sxx, a = my - b * mx;
  const ss = xs.reduce((s, x, i) => s + (ys[i] - a - b * x) ** 2, 0), s2 = n > 2 ? ss / (n - 2) : 0;
  return { a, b, sb: Math.sqrt(s2 / sxx), sa: Math.sqrt(s2 * (1 / n + (mx * mx) / sxx)), n };
}
const meanStd = (v) => { const n = v.length, m = v.reduce((s, x) => s + x, 0) / n; const sd = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0; return { m, sd, sm: sd / Math.sqrt(n) }; };

/* ------------------------------------------------------------------ Frank–Gers */

export function checkFH(r, gas) {
  if (![r.k, r.U].every(Number.isFinite)) return { ok: false, err: "to‘liq emas" };
  if (!Number.isInteger(r.k) || r.k < 1 || r.k > 20) return { ok: false, err: "k — 1, 2, 3, … butun son" };
  if (r.U <= 0 || r.U > GASES[gas].Umax + 5) return { ok: false, err: `U 0…${GASES[gas].Umax} V oralig‘ida` };
  return { ok: true };
}
/** rows [{k, U}], cond {gas, T, Ur} */
export function analyzeFH(rowsIn, cond) {
  const g = GASES[cond.gas];
  const rows = rowsIn.filter((r) => checkFH(r, cond.gas).ok).sort((a, b) => a.k - b.k);
  const out = { rows, gas: g, cond, ok: rows.length >= 3 && new Set(rows.map((r) => r.k)).size === rows.length };
  if (!rows.length) return out;
  rows.forEach((r, i) => { r.dU = i > 0 && rows[i - 1].k === r.k - 1 ? r.U - rows[i - 1].U : null; });
  const f = lfit(rows.map((r) => r.k), rows.map((r) => r.U));
  if (f) { out.fit = f; out.dU = f.b; out.sdU = f.sb; out.U0 = f.a; out.sU0 = f.sa; out.E1 = f.b; out.lam = HC_EV_NM / f.b; out.slam = (out.lam * f.sb) / f.b; }
  const ds = rows.map((r) => r.dU).filter((v) => v !== null);
  if (ds.length) out.diff = meanStd(ds);
  return out;
}
/** Kiritilgan U qurilmaning haqiqiy k-maksimumiga yaqinmi (±tol V). */
export function matchFH(r, cond, tol = 0.3) {
  const m = fhMaxima(cond); const u = m[r.k - 1];
  return u !== undefined && Math.abs(u - r.U) <= tol;
}

/* ------------------------------------------------------------------ Balmer */

export const lineById = (id) => LINES.find((l) => l.id === id);
export function checkBal(r) {
  if (!lineById(r.line)) return { ok: false, err: "chiziqni tanlang" };
  if (![r.k, r.pL, r.pR].every(Number.isFinite)) return { ok: false, err: "to‘liq emas" };
  if (![1, 2, 3].includes(r.k)) return { ok: false, err: "k = 1, 2 yoki 3" };
  const phi = (r.pR - r.pL) / 2;
  if (!(phi > 1 && phi < 89)) return { ok: false, err: "φ_o‘ng > φ_chap bo‘lsin" };
  return { ok: true };
}
/** rows [{line, k, pL, pR}], cond {gr} */
export function analyzeBalmer(rowsIn, cond) {
  const d = GRATINGS[cond.gr].d;
  const rows = rowsIn.filter((r) => checkBal(r).ok).map((r) => {
    const L = lineById(r.line), phi = (r.pR - r.pL) / 2, lam = (d * Math.sin(phi * RAD)) / r.k; // m
    const x = 0.25 - 1 / (L.n * L.n), R = 1 / (lam * x), hv = HC_EV_NM / (lam * 1e9), dE = levelEv(L.n) - levelEv(2);
    return { ...r, L, n: L.n, phi, zero: (r.pR + r.pL) / 2, lamNm: lam * 1e9, x, inv: 1 / lam, R, hv, dE };
  });
  const out = { rows, cond, d, ok: rows.length >= 3 && new Set(rows.map((r) => r.n)).size >= 3 };
  if (!rows.length) return out;
  out.Rst = meanStd(rows.map((r) => r.R));
  // 1/λ = R·x + b
  const f = lfit(rows.map((r) => r.x), rows.map((r) => r.inv)); if (f) out.fit = f;
  // nol orqali: R = Σxy/Σx²
  let sxy = 0, sxx = 0; rows.forEach((r) => { sxy += r.x * r.inv; sxx += r.x * r.x; }); out.R0 = sxy / sxx;
  out.Rtheory = R_H;
  out.Eion = (HC_EV_NM * 1e-9) * out.Rst.m; // eV: hcR
  out.zero = meanStd(rows.map((r) => r.zero));
  return out;
}
export function matchBal(r, journal, tol = 0.006) {
  const has = (v) => journal.some((j) => j.gr === r.gr && Math.abs(j.phi - v) <= tol);
  return has(r.pL) && has(r.pR);
}
