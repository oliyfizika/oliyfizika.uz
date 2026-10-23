// ==========================================================================
// Qora jism laboratoriya ishi — natijalarni qayta ishlash (DOM'siz).
// 1-topshiriq: λ_max(T) → λ_max = b·(1/T) (koordinata boshidan o‘tuvchi to‘g‘ri chiziq) → b.
// 2-topshiriq: E(T) → E = s·(T⁴ − T₀⁴), σ = s·L²/(ε a²); ln E = n·ln T + c → n ≈ 4.
// Ikkalasidan: Plank doimiysi h va Bolsman doimiysi k (hkFrom).
// ==========================================================================

import { B_WIEN, T0, A_AP, L_RAD, EPS, lamMax, irr, hkFrom } from "./bb-physics.js";
import { lfit, fit0 } from "./photo-lab.js";

export function check1(r) {
  if (!Number.isFinite(r.T) || r.T < 500 || r.T > 4000) return { ok: false, err: "T 500…4000 K" };
  if (!Number.isFinite(r.lm) || r.lm < 0.3 || r.lm > 8) return { ok: false, err: "λ_max 0,3…8 μm" };
  return { ok: true };
}
export function analyze1(rows) {
  const R = rows.map((r) => ({ ...r, inv: 1e3 / r.T, bi: r.lm * 1e-6 * r.T }));
  const out = { rows: R, ok: new Set(R.map((r) => Math.round(r.T / 20))).size >= 3 };
  if (R.length >= 2) { const f = fit0(R.map((r) => 1 / r.T), R.map((r) => r.lm * 1e-6)); out.b = f.k; out.sb = f.sk; out.lin = lfit(R.map((r) => 1 / r.T), R.map((r) => r.lm * 1e-6)); }
  return out;
}
export const match1 = (r) => Math.abs(r.lm - lamMax(r.T)) <= 0.025 * lamMax(r.T) + 0.01;

export function check2(r) {
  if (!Number.isFinite(r.T) || r.T < 500 || r.T > 4000) return { ok: false, err: "T 500…4000 K" };
  if (!Number.isFinite(r.E) || r.E <= 0) return { ok: false, err: "E > 0" };
  return { ok: true };
}
export function analyze2(rows) {
  const g = EPS * (A_AP / L_RAD) ** 2;
  const R = rows.map((r) => ({ ...r, X: r.T ** 4 - T0 ** 4, si: r.E / (g * (r.T ** 4 - T0 ** 4)) }));
  const out = { rows: R, ok: new Set(R.map((r) => Math.round(r.T / 20))).size >= 3 };
  if (R.length >= 2) {
    const f = fit0(R.map((r) => r.X), R.map((r) => r.E)); out.s = f.k; out.sigma = f.k / g; out.ssig = f.sk / g;
    const l = lfit(R.map((r) => Math.log(r.T)), R.map((r) => Math.log(r.E))); if (l) { out.n = l.b; out.sn = l.sb; out.ln = l; }
  }
  return out;
}
export const match2 = (r) => Math.abs(r.E - irr(r.T)) <= 0.02 * irr(r.T) + 0.05;
export { hkFrom, B_WIEN };
