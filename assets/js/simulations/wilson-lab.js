// ==========================================================================
// Vilson kamerasi laboratoriya ishi — natijalarni qayta ishlash (DOM'siz).
// 1-topshiriq: α-izlar uzunligi R → E = (R/3,18)^{2/3} (Geyger), v = √(2E/m); energiyalar guruhlarga ajratiladi.
// 2-topshiriq: β-izlar egrilik radiusi r → p = 0,3·B·r, T = √(p² + m²) − m; zaryad ishorasi egrilik yo‘nalishidan.
// ==========================================================================

import { geigerE, geigerR, MALPHA, ME, SOURCES, TofP } from "./wilson-physics.js";

export function check1(r) {
  if (!Number.isFinite(r.id) || r.id < 1) return { ok: false, err: "iz №" };
  if (!Number.isFinite(r.R) || r.R < 5 || r.R > 160) return { ok: false, err: "R 5…160 mm" };
  return { ok: true };
}
export function groups(Es, gap = 0.15) {
  const s = Es.slice().sort((a, b) => a - b), G = [];
  s.forEach((e) => { const g = G.at(-1); if (g && e - g.at(-1) <= gap) g.push(e); else G.push([e]); });
  return G.map((g) => { const m = g.reduce((a, b) => a + b, 0) / g.length; return { m, n: g.length, sd: g.length > 1 ? Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / (g.length - 1)) : 0 }; });
}
export function analyze1(rows, cond) {
  const R = rows.map((r) => { const E = geigerE(r.R); return { ...r, E, v: Math.sqrt((2 * E) / MALPHA) * 2.998e8 }; });
  const out = { rows: R, ok: R.length >= 4, src: SOURCES[cond?.src] };
  if (R.length) out.G = groups(R.map((r) => r.E));
  return out;
}
/** tr — haqiqiy iz (yoki undefined). */
export function match1(r, tr) {
  if (!tr || tr.t !== "a") return { ok: false, why: "bu raqamli α-iz yo‘q" };
  if (tr.partial && Math.abs(r.R - tr.Rvis) <= 2) return { ok: false, why: "iz to‘liq emas (yoritilgan qatlamdan chiqib ketgan)" };
  return Math.abs(r.R - tr.R) <= 1.5 + 0.02 * tr.R ? { ok: true } : { ok: false, why: "uzunlik izga mos emas" };
}

export function check2(r) {
  if (!Number.isFinite(r.id) || r.id < 1) return { ok: false, err: "iz №" };
  if (!Number.isFinite(r.r) || r.r < 1 || r.r > 2000) return { ok: false, err: "r 1…2000 mm" };
  if (!["-", "+"].includes(r.sign)) return { ok: false, err: "ishora" };
  return { ok: true };
}
export function analyze2(rows, cond) {
  const B = +cond?.B || 0;
  const R = rows.map((r) => { const p = 0.3 * B * r.r, T = TofP(p); return { ...r, p, T, beta: p / Math.sqrt(p * p + ME * ME) }; });
  const out = { rows: R, B, ok: B > 0 && R.length >= 3 };
  if (R.length) { out.Tm = R.reduce((a, r) => a + r.T, 0) / R.length; out.Tmax = Math.max(...R.map((r) => r.T)); }
  return out;
}
export function match2(r, tr, B) {
  if (!tr || tr.t !== "b") return { ok: false, why: "bu raqamli β-iz yo‘q" };
  if (Math.abs((+B || 0) - tr.B) > 1e-6) return { ok: false, why: "iz boshqa maydonda olingan" };
  if ((r.sign === "-" ? -1 : 1) !== tr.q) return { ok: false, why: "zaryad ishorasi noto‘g‘ri" };
  return Math.abs(r.r - tr.r) <= 0.06 * tr.r + 0.5 ? { ok: true } : { ok: false, why: "radius izga mos emas" };
}
export { geigerR };
