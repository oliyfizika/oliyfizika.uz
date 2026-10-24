// ==========================================================================
// Elektroliz — grafiklar (simulations/electrolysis.html):
// I(U) (parchalanish kuchlanishi bilan), R(t): elektrolit va metall, m(t) va m(q) (bir nechta tajriba),
// Faradeyning 2-qonuni: m — M/n. Kursor bilan qiymat o'qish.
// ==========================================================================

import { fmt, sci, tag, clamp } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./electrolysis-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;

function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT;
  const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
const fmtAuto = (step) => (v) => fmt(v, step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0);
function curve(ctx, f, xs, fn, color, width = 2.5, dash = null) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath();
  xs.forEach((x, k) => { const y = fn(x); if (k) ctx.lineTo(f.X(x), f.Y(y)); else ctx.moveTo(f.X(x), f.Y(y)); });
  ctx.stroke(); ctx.setLineDash([]);
}
const range = (a, b, n = 200) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);

/** I(U): o: { cfg (circuit uchun: key, c, t, d, S, Rext), Umax, cur: {U, I}, hover } */
export function drawIU(ctx, st, o) {
  const c = st.colors, Ifn = (U) => P.circuit({ ...o.cfg, U }).I, Imax0 = Ifn(o.Umax);
  const micro = Imax0 < 1e-3, k = micro ? 1e6 : 1, unit = micro ? "μA" : "A", yMax = Math.max(micro ? 5 : 0.1, Imax0 * k * 1.15);
  const xt = ticks(0, o.Umax, st.w < 480 ? 4 : 6), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: o.Umax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: fmtAuto(yt.step), yLabel: `I, ${unit}`, xUnit: "U, V" });
  last = { ...f, xMax: o.Umax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const Ep = P.SOLUTIONS[o.cfg.key].Ep;
  if (Ep > 0) {
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(f.X(Ep), r.y); ctx.lineTo(f.X(Ep), r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = "500 10px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(`E_p = ${fmt(Ep, 1)} V`, f.X(Ep) + 4, r.y + 4);
  }
  curve(ctx, f, range(0, o.Umax), (U) => Ifn(U) * k, c.primary, 2.8);
  ctx.restore();
  if (o.cur) { ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(o.cur.U), f.Y(Math.min(o.cur.I * k, yMax)), 6, 0, Math.PI * 2); ctx.fill(); }
  if (o.hover !== null && o.hover !== undefined) {
    const U = o.hover, I = Ifn(U);
    hoverLine(ctx, f, f.X(U), [`U = ${fmt(U, 2)} V`, I > 0 ? `I = ${micro ? fmt(I * 1e6, 2) + " μA" : fmt(I, 3) + " A"}` : "I = 0 — elektroliz yo‘q"], c);
  }
}

/** R(t)/R(25 °C): elektrolit va mis sim. o: { key, c, t, hover } */
export function drawRT(ctx, st, o) {
  const c = st.colors, el = (t) => P.sigma(o.key, o.c, 25) / P.sigma(o.key, o.c, t), me = (t) => P.metalR(1, t) / P.metalR(1, 25);
  const xt = ticks(0, 100, st.w < 480 ? 4 : 5), yMax = 1.4, yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: 100, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 1), yLabel: "R / R(25 °C)", xUnit: "t, °C" });
  last = { ...f, xMax: 100 };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  curve(ctx, f, range(0, 100), el, c.primary, 2.8);
  curve(ctx, f, range(0, 100), me, c.warning, 2.4, [6, 5]);
  ctx.restore();
  ctx.fillStyle = c.primary; ctx.beginPath(); ctx.arc(f.X(o.t), f.Y(el(o.t)), 6, 0, Math.PI * 2); ctx.fill();
  legend(ctx, [{ color: c.primary, label: "Elektrolit" }, { color: c.warning, label: "Mis sim", dash: [5, 4] }], f.padL + 10, r.y + r.h - 12, c);
  if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`t = ${fmt(o.hover, 0)} °C`, `elektrolit: R/R₂₅ = ${fmt(el(o.hover), 3)}`, `mis: R/R₂₅ = ${fmt(me(o.hover), 3)}`], c);
}

/**
 * m(t) yoki m(q): o: { x: "t" | "q", subst, runs: [{ I, pts: [{t, q, m}], color, label }], tMax (s), hover }
 * massa — mg (yoki g, katta bo'lsa).
 */
export function drawMass(ctx, st, o) {
  const c = st.colors, k = P.kOf(o.subst);
  const xMax = o.x === "t" ? o.tMax / 60 : Math.max(...o.runs.map((rn) => rn.I), 0.5) * o.tMax;
  const mMax = Math.max(k * (o.x === "t" ? Math.max(...o.runs.map((rn) => rn.I), 0.5) * o.tMax : xMax), 1e-7) * 1.08, g = mMax > 2e-3, mk = g ? 1e3 : 1e6;
  const xt = ticks(0, xMax, st.w < 480 ? 4 : 6), yt = ticks(0, mMax * mk, 4);
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax: mMax * mk, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: fmtAuto(yt.step), yLabel: `Δm, ${g ? "g" : "mg"}`, xUnit: o.x === "t" ? "t, min" : "q, C" });
  last = { ...f, xMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  if (o.x === "q") curve(ctx, f, [0, xMax], (q) => k * q * mk, c.text3, 1.6, [6, 5]);
  for (const rn of o.runs) {
    if (o.x === "t") curve(ctx, f, [0, xMax], (t) => k * rn.I * t * 60 * mk, rn.color, 1.4, [5, 5]);
    ctx.fillStyle = rn.color;
    const step = Math.max(1, Math.floor(rn.pts.length / 40));
    rn.pts.forEach((p, i) => { if (i % step && i !== rn.pts.length - 1) return; ctx.beginPath(); ctx.arc(f.X(o.x === "t" ? p.t / 60 : p.q), f.Y(p.m * mk), 3.2, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.restore();
  legend(ctx, o.runs.map((rn) => ({ color: rn.color, label: rn.label })), f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) {
    const x = o.hover, lines = o.x === "t" ? [`t = ${fmt(x, 1)} min`, ...o.runs.slice(-2).map((rn) => `I = ${fmt(rn.I, 2)} A: m = kIt = ${fmt(k * rn.I * x * 60 * mk, g ? 3 : 1)} ${g ? "g" : "mg"}`)] : [`q = ${fmt(x, 0)} C`, `m = kq = ${fmt(k * x * mk, g ? 3 : 1)} ${g ? "g" : "mg"}`];
    hoverLine(ctx, f, f.X(x), lines, c);
  }
}

/** 2-qonun: m — M/n (g/mol). o: { q, cells: [{ s, m, color }], hover } */
export function drawEquiv(ctx, st, o) {
  const c = st.colors, eq = (s) => (P.SUBST[s].M * 1e3) / P.SUBST[s].n, xMax = 120;
  const mOf = (x) => (o.q / P.F) * x; // g, chunki x — g/mol
  const mMax = Math.max(mOf(xMax), 1e-4) * 1.1, g = mMax > 2, mk = g ? 1 : 1000;
  const xt = ticks(0, xMax, st.w < 480 ? 4 : 6), yt = ticks(0, mMax * mk, 4);
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax: mMax * mk, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: fmtAuto(yt.step), yLabel: `m, ${g ? "g" : "mg"}`, xUnit: "M/n, g/mol" });
  last = { ...f, xMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  curve(ctx, f, [0, xMax], (x) => mOf(x) * mk, c.text3, 1.8, [6, 5]);
  ctx.restore();
  ctx.font = FONT;
  for (const cl of o.cells) {
    const x = eq(cl.s), y = cl.m * 1e3 * mk;
    ctx.fillStyle = cl.color; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.text; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(P.SUBST[cl.s].sym, f.X(x) + 8, clamp(f.Y(y) - 4, r.y + 14, r.y + r.h));
  }
  legend(ctx, [{ color: c.text3, label: "m = (q/F)·(M/n)", dash: [5, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`M/n = ${fmt(o.hover, 1)} g/mol`, `m = ${sci(mOf(o.hover) * mk, 3)} ${g ? "g" : "mg"}`], c);
}
