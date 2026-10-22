// ==========================================================================
// Milliken laboratoriya ishi — natijalarni qayta ishlash (DOM'siz).
// Dinamik usul: v_t = s/t_t, v_k = s/t_k;  r = √(b²/4p² + 9ηv_t/(2(ρ−ρ_h)g)) − b/2p;
//               q = 6πη_ef r (v_t + v_k)·d/U.
// Muvozanat usuli: q = (4/3)πr³(ρ−ρ_h)g·d/U_m.
// Elementar zaryad: q_i = n_i·e — n_i butun sonlar bo‘ladigan eng katta e (1,2…2,0·10⁻¹⁹ C oralig‘ida) topiladi, so‘ng e = Σq/Σn.
// ==========================================================================

import { QE, RHO, RHO_AIR, G, ETA, B_C, PRESS, D_PL, S_MEAS, etaEff, mass } from "./millikan-physics.js";
import { fit0 } from "./photo-lab.js";

export function radius(vf) { const a = B_C / (2 * PRESS); return Math.sqrt(a * a + (9 * ETA * vf) / (2 * (RHO - RHO_AIR) * G)) - a; }
export const qDyn = (U, tf, tr) => { const vf = S_MEAS / tf, vr = S_MEAS / tr, r = radius(vf); return { vf, vr, r, q: (6 * Math.PI * etaEff(r) * r * (vf + vr) * D_PL) / U }; };
export const qBal = (Ub, tf) => { const vf = S_MEAS / tf, r = radius(vf); return { vf, r, q: (mass(r) * G * D_PL) / Ub }; };

/** q lar ro‘yxatidan n_i va e. */
export function quantize(qs, extra = []) {
  if (!qs.length) return null;
  const all = qs.concat(extra); // boshqa usuldagi zaryadlar ham hisobga olinadi (bir qiymatlilik uchun)
  let best = null;
  for (let e = 2.0e-19; e >= 1.2e-19; e -= 0.002e-19) {
    const rms = Math.sqrt(all.reduce((s, q) => { const x = q / e; return s + (x - Math.round(x)) ** 2; }, 0) / all.length);
    if (all.every((q) => Math.round(q / e) >= 1) && rms < 0.15) { best = e; break; }
  }
  if (!best) return null;
  const ns = qs.map((q) => Math.max(1, Math.round(q / best))), e = qs.reduce((s, q) => s + q, 0) / ns.reduce((s, n) => s + n, 0);
  const each = qs.map((q, i) => q / ns[i]), m = each.reduce((s, v) => s + v, 0) / each.length;
  const sd = each.length > 1 ? Math.sqrt(each.reduce((s, v) => s + (v - m) ** 2, 0) / (each.length - 1)) : 0;
  return { ns, e, sd, se: sd / Math.sqrt(each.length), fit: fit0(ns, qs) };
}

export function check1(r) {
  if (!Number.isFinite(r.drop) || r.drop < 1) return { ok: false, err: "tomchi №" };
  if (!Number.isFinite(r.U) || r.U <= 0 || r.U > 800) return { ok: false, err: "U 0…800 V" };
  if (!Number.isFinite(r.tf) || r.tf <= 0.5 || r.tf > 120) return { ok: false, err: "t_t 0,5…120 s" };
  if (!Number.isFinite(r.tr) || r.tr <= 0.5 || r.tr > 120) return { ok: false, err: "t_k 0,5…120 s" };
  return { ok: true };
}
export function check2(r) {
  if (!Number.isFinite(r.drop) || r.drop < 1) return { ok: false, err: "tomchi №" };
  if (!Number.isFinite(r.tf) || r.tf <= 0.5 || r.tf > 120) return { ok: false, err: "t_t 0,5…120 s" };
  if (!Number.isFinite(r.Ub) || r.Ub <= 0 || r.Ub > 800) return { ok: false, err: "U_m 0…800 V" };
  return { ok: true };
}
/** Bir tomchi (va bir xil U) bo‘yicha takroriy o‘lchashlar o‘rtachalanadi — Broun harakati xatosi kamayadi. */
function finish(R, ok, calc, key, extra = []) {
  const groups = new Map(); R.forEach((r, i) => { const k = key(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  const G = [...groups.values()].map((idx) => { const avg = (f) => idx.reduce((s, i) => s + R[i][f], 0) / idx.length; return { idx, drop: R[idx[0]].drop, ...calc(R[idx[0]], avg) }; });
  const Q = quantize(G.map((g) => g.q), extra);
  if (Q) G.forEach((g, j) => { g.n = Q.ns[j]; g.qn = g.q / g.n; g.idx.forEach((i) => { R[i].n = g.n; R[i].qn = R[i].q / g.n; }); });
  return { rows: R, groups: G, Q, ok: ok(G) && !!Q };
}
export const analyze1 = (rows) => finish(rows.map((r) => ({ ...r, ...qDyn(r.U, r.tf, r.tr) })), (G) => G.length >= 4, (r, avg) => ({ U: r.U, tf: avg("tf"), tr: avg("tr"), ...qDyn(r.U, avg("tf"), avg("tr")) }), (r) => `${r.drop}|${r.U}`);
export const analyze2 = (rows, extra = []) => finish(rows.map((r) => ({ ...r, ...qBal(r.Ub, r.tf) })), (G) => G.length >= 3, (r, avg) => ({ Ub: avg("Ub"), tf: avg("tf"), ...qBal(avg("Ub"), avg("tf")) }), (r) => `${r.drop}`, extra);
export { QE };
