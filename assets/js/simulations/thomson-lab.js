// ==========================================================================
// e/m laboratoriya ishi — natijalarni qayta ishlash (DOM'siz).
// Har bir qator: U, r (belgi), I₁ (qurilma 0°), I₂ (qurilma 180° burilgan, ixtiyoriy) → Ī = (I₁ + I₂)/2, B = k·Ī,
// e/m = 2U/(B²r²). Barcha nuqtalar: U = (e/m)·(Br)²/2 — koordinata boshidan o‘tuvchi to‘g‘ri chiziq.
// ==========================================================================

import { EM, KB, MARKS, Ineed, QE } from "./thomson-physics.js";
import { fit0 } from "./photo-lab.js";

export function check(r) {
  if (!Number.isFinite(r.U)) return { ok: false, err: "U kiritilmagan" };
  if (r.U < 50 || r.U > 400) return { ok: false, err: "U 50…400 V" };
  if (!MARKS.includes(r.r)) return { ok: false, err: "r ni tanlang" };
  if (!Number.isFinite(r.Ip) || r.Ip <= 0 || r.Ip > 5) return { ok: false, err: "I₁ 0…5 A" };
  if (Number.isFinite(r.Im) && (r.Im <= 0 || r.Im > 5)) return { ok: false, err: "I₂ 0…5 A" };
  return { ok: true };
}
export function analyze(rows) {
  const R = rows.map((r) => {
    const both = Number.isFinite(r.Im), I = both ? (r.Ip + r.Im) / 2 : r.Ip, B = KB * I, em = (2 * r.U) / (B * B * r.r * r.r), Bp = KB * r.Ip, emp = (2 * r.U) / (Bp * Bp * r.r * r.r);
    return { ...r, both, I, B, em, emp, X: (B * r.r) ** 2 / 2 };
  });
  const out = { rows: R, ok: R.length >= 4 && new Set(R.map((r) => r.U)).size >= 2 && new Set(R.map((r) => r.r)).size >= 2 };
  if (R.length) {
    const m = R.reduce((s, r) => s + r.em, 0) / R.length; out.m = m;
    out.sd = R.length > 1 ? Math.sqrt(R.reduce((s, r) => s + (r.em - m) ** 2, 0) / (R.length - 1)) : 0; out.se = out.sd / Math.sqrt(R.length);
    const ps = R.reduce((s, r) => s + r.emp, 0) / R.length; out.mp = ps; out.nBoth = R.filter((r) => r.both).length;
  }
  if (R.length >= 2) out.fit = fit0(R.map((r) => r.X), R.map((r) => r.U));
  if (out.fit) { out.emFit = out.fit.k; out.me = QE / out.fit.k; }
  return out;
}
/** Qurilma: belgi orqali o‘tadigan tok ±0,015 A. */
export function match(r, tol = 0.015) {
  const ok1 = Math.abs(Ineed(r.U, r.r, 1) - r.Ip) <= tol;
  const ok2 = !Number.isFinite(r.Im) || Math.abs(Ineed(r.U, r.r, -1) - r.Im) <= tol;
  return ok1 && ok2;
}
export { EM };
