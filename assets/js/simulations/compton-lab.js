// ==========================================================================
// Kompton laboratoriya ishi — natijalarni qayta ishlash (DOM'siz).
// 1-topshiriq: MCA kalibrlash — ma’lum γ-chiziqlar cho‘qqilari kanallari → E = a + b·kanal (EKK).
// 2-topshiriq: sochilgan γ-kvant energiyasi E′(θ): 1/E′ = 1/E₀ + (1 − cos θ)/(mₑc²) → mₑc², E₀;
//              Δλ = hc(1/E′ − 1/E₀) = λ_C(1 − cos θ) → Kompton to‘lqin uzunligi λ_C.
// ==========================================================================

import { CAL, E0, MEC2, HC, NCH, chOf, eScat } from "./compton-physics.js";
import { lfit } from "./photo-lab.js";

export const calById = (id) => CAL.find((c) => c.id === id);
export function check1(r) {
  if (!calById(r.line)) return { ok: false, err: "chiziqni tanlang" };
  if (!Number.isFinite(r.ch) || r.ch <= 0 || r.ch >= NCH) return { ok: false, err: "kanal 0…1023" };
  return { ok: true };
}
export function analyze1(rows) {
  const R = rows.map((r) => ({ ...r, L: calById(r.line), E: calById(r.line).E }));
  const out = { rows: R, ok: new Set(R.map((r) => r.line)).size >= 3 };
  const f = lfit(R.map((r) => r.ch), R.map((r) => r.E));
  if (f) { out.fit = f; R.forEach((r) => { r.res = r.E - (f.a + f.b * r.ch); }); }
  return out;
}
export const match1 = (r) => { const L = calById(r.line); return !!L && Math.abs(r.ch - chOf(L.E)) <= 3 + 0.005 * chOf(L.E); };

export function check2(r) {
  if (!Number.isFinite(r.th) || r.th < 10 || r.th > 160) return { ok: false, err: "θ 10…160°" };
  if (!Number.isFinite(r.ch) || r.ch <= 0 || r.ch >= NCH) return { ok: false, err: "kanal 0…1023" };
  return { ok: true };
}
/** cal — 1-topshiriq fit {a, b}. */
export function analyze2(rows, cal) {
  if (!cal) return { rows: rows.map((r) => ({ ...r })), ok: false, noCal: true };
  const R = rows.map((r) => { const E = cal.a + cal.b * r.ch, x = 1 - Math.cos((r.th * Math.PI) / 180); return { ...r, E, x, inv: 1 / E, Eth: eScat(r.th), dl: HC * (1 / E - 1 / E0) }; }); // dl — pm
  const out = { rows: R, ok: new Set(R.map((r) => Math.round(r.th))).size >= 4 };
  const f = lfit(R.map((r) => r.x), R.map((r) => r.inv));
  if (f) { out.fit = f; out.mc2 = 1 / f.b; out.smc2 = f.sb / (f.b * f.b); out.E0 = 1 / f.a; out.sE0 = f.sa / (f.a * f.a); out.lc = HC * f.b; out.slc = HC * f.sb; }
  return out;
}
export const match2 = (r) => { const c = chOf(eScat(r.th)); return Math.abs(r.ch - c) <= 4 + 0.012 * c; };
export { E0, MEC2 };
