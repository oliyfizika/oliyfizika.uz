// ==========================================================================
// Fotoeffekt laboratoriya ishi — natijalarni qayta ishlash (DOM'siz).
// 1-topshiriq: U_t(ν) → EKK: U_t = (h/e)ν − W/e → h, W, ν₀, λ₀.
// 2-topshiriq: to‘yinish toki I_t(Φ) ~ Φ (Stoletov qonuni); U_t intensivlikka bog‘liq emas.
// ==========================================================================

import { QE, C, LINES, CATHODES, lineById, nu, zeroCross, current } from "./photo-physics.js";

export function lfit(xs, ys) {
  const n = xs.length; if (n < 2) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); });
  if (!(sxx > 0)) return null;
  const b = sxy / sxx, a = my - b * mx, ss = xs.reduce((s, x, i) => s + (ys[i] - a - b * x) ** 2, 0), s2 = n > 2 ? ss / (n - 2) : 0;
  return { a, b, sb: Math.sqrt(s2 / sxx), sa: Math.sqrt(s2 * (1 / n + (mx * mx) / sxx)), n };
}
export function fit0(xs, ys) {
  let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += x * x; sxy += x * ys[i]; });
  const k = sxy / sxx, n = xs.length, ss = xs.reduce((s, x, i) => s + (ys[i] - k * x) ** 2, 0);
  return { k, sk: n > 1 ? Math.sqrt(ss / (n - 1) / sxx) : 0 };
}

/* 1-topshiriq */
export function check1(r) {
  if (!lineById(r.line)) return { ok: false, err: "filtrni tanlang" };
  if (!Number.isFinite(r.Us)) return { ok: false, err: "U_t kiritilmagan" };
  if (r.Us < 0 || r.Us > 3) return { ok: false, err: "U_t 0…3 V (musbat son)" };
  return { ok: true };
}
export function analyze1(rows, cond) {
  const W = CATHODES[cond.cath]?.W;
  const R = rows.map((r) => { const L = lineById(r.line); return { ...r, L, nu: nu(L.nm), nu14: nu(L.nm) / 1e14 }; });
  const out = { rows: R, ok: new Set(R.map((r) => r.line)).size >= 3, Wtrue: W };
  const f = lfit(R.map((r) => r.nu), R.map((r) => r.Us));
  if (f) { out.fit = f; out.h = f.b * QE; out.sh = f.sb * QE; out.W = -f.a; out.sW = f.sa; out.nu0 = -f.a / f.b; out.lam0 = (C / out.nu0) * 1e9; }
  return out;
}
export function match1(r, cond, tol = 0.04) { const z = zeroCross({ line: r.line, cath: cond.cath, inten: 100 }); return z !== null && Math.abs(z - r.Us) <= tol; }

/* 2-topshiriq */
export function check2(r) {
  if (!Number.isFinite(r.inten) || r.inten <= 0 || r.inten > 100) return { ok: false, err: "Φ 1…100 %" };
  if (!Number.isFinite(r.Is) || r.Is < 0) return { ok: false, err: "I_t kiritilmagan" };
  if (Number.isFinite(r.Us) && (r.Us < 0 || r.Us > 3)) return { ok: false, err: "U_t 0…3 V" };
  return { ok: true };
}
export function analyze2(rows) {
  const out = { rows, ok: rows.length >= 3 && new Set(rows.map((r) => r.inten)).size >= 3 };
  if (rows.length >= 2) { out.fit = fit0(rows.map((r) => r.inten), rows.map((r) => r.Is)); out.lin = lfit(rows.map((r) => r.inten), rows.map((r) => r.Is)); }
  const us = rows.map((r) => r.Us).filter(Number.isFinite);
  if (us.length >= 2) { const m = us.reduce((s, v) => s + v, 0) / us.length; out.Us = { m, sd: Math.sqrt(us.reduce((s, v) => s + (v - m) ** 2, 0) / (us.length - 1)), n: us.length }; }
  return out;
}
/** To‘yinish toki: U = +10 V dagi tok (±3 %). */
export function match2(r, cond, tol = 0.03) {
  const I = current(10, { line: cond.line, cath: cond.cath, inten: r.inten });
  const okI = Math.abs(r.Is - I) <= Math.max(tol * I, 0.005);
  const okU = !Number.isFinite(r.Us) || match1({ line: cond.line, Us: r.Us }, cond);
  return okI && okU;
}
export { LINES, CATHODES };
