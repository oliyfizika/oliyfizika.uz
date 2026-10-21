// ==========================================================================
// Elektromagnit tebranishlar grafiklari: q(t) va i(t), energiya, T(C) (Tomson), u(t) va i(t),
// reaktiv qarshiliklar X(f), rezonans egri chizig'i I(f) (lab), U_L va U_C (f).
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, tag } from "./sim-kit.js";
import * as P from "./lc-physics.js";

const TAU = Math.PI * 2;
const small = "600 10px Inter, system-ui, sans-serif";
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
function poly(ctx, f, xs, ys, color, w = 2.5, dash = null) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath();
  let pen = false;
  for (let i = 0; i < xs.length; i++) { const y = ys[i]; if (!Number.isFinite(y)) { pen = false; continue; } if (!pen) { ctx.moveTo(f.X(xs[i]), f.Y(y)); pen = true; } else ctx.lineTo(f.X(xs[i]), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
}
function curve(ctx, f, fn, x0, x1, color, w = 2.5, n = 300, dash = null) { const xs = [], ys = []; for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; xs.push(x); ys.push(fn(x)); } poly(ctx, f, xs, ys, color, w, dash); }
const dot = (ctx, f, x, y, color, r = 6) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), r, 0, TAU); ctx.fill(); };
const nice = (m) => { const t = ticks(0, m, 4); return { top: t.values[t.values.length - 1], vals: t.values, step: t.step }; };
const logTicks = (a, b) => [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].filter((v) => v >= a && v <= b);

/** q(t) va i(t) (normallashtirilgan, birliklar legendada). hist — [{t, q, i}] (sekundda, sim vaqti). */
export function drawQI(ctx, st, { hist, qm, im, span }) {
  const c = st.colors, t1 = hist.length ? hist[hist.length - 1].t : 0, t0 = Math.max(0, t1 - span);
  const f = frame(ctx, st, { xMin: t0 * 1000, xMax: (t0 + span) * 1000, yMin: -1.15, yMax: 1.15, xTicks: ticks(t0 * 1000, (t0 + span) * 1000, 6).values, yTicks: [-1, 0, 1], fmtX: (v) => fmt(v, 0), fmtY: (v) => (v === 0 ? "0" : v > 0 ? "max" : "−max"), xUnit: "ms" });
  ctx.save(); clipTo(ctx, f.rect);
  const pts = hist.filter((p) => p.t >= t0), xs = pts.map((p) => p.t * 1000);
  poly(ctx, f, xs, pts.map((p) => p.q / qm), c.primary, 2.5);
  poly(ctx, f, xs, pts.map((p) => p.i / im), c.danger, 2, [6, 4]);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: `zaryad q (max ${fmt(qm * 1e3, 2)} mC)` }, { color: c.danger, label: `tok i (max ${fmt(im * 1e3, 0)} mA)`, dash: [6, 4] }], f.padL + 56, 9, c);
}

/** Energiya: W_E, W_M, yig'indi (mJ). */
export function drawEnergy(ctx, st, { hist, span, E0 }) {
  const c = st.colors, t1 = hist.length ? hist[hist.length - 1].t : 0, t0 = Math.max(0, t1 - span);
  const y = nice(Math.max(E0 * 1e3 * 1.1, 1e-3));
  const f = frame(ctx, st, { xMin: t0 * 1000, xMax: (t0 + span) * 1000, yMin: 0, yMax: y.top, xTicks: ticks(t0 * 1000, (t0 + span) * 1000, 6).values, yTicks: y.vals, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(y.step)), xUnit: "ms", yLabel: "W, mJ" });
  ctx.save(); clipTo(ctx, f.rect);
  const pts = hist.filter((p) => p.t >= t0), xs = pts.map((p) => p.t * 1000);
  poly(ctx, f, xs, pts.map((p) => p.WE * 1e3), c.primary, 2.2);
  poly(ctx, f, xs, pts.map((p) => p.WM * 1e3), c.danger, 2.2);
  poly(ctx, f, xs, pts.map((p) => (p.WE + p.WM) * 1e3), c.text, 2, [6, 4]);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: "elektr maydon q²/2C" }, { color: c.danger, label: "magnit maydon Li²/2" }, { color: c.text, label: "jami", dash: [6, 4] }], f.padL + 56, 9, c);
}

/** Tomson formulasi: T(C) berilgan L da (C mkF). */
export function drawThomson(ctx, st, { L, C }) {
  const c = st.colors, x0 = 10, x1 = 1000;
  const y = nice(P.thomson(L, x1 * 1e-6) * 1000 * 1.05);
  const f = frame(ctx, st, { xMin: x0, xMax: x1, yMin: 0, yMax: y.top, xTicks: [10, 200, 400, 600, 800, 1000], yTicks: y.vals, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(y.step)), xUnit: "mkF", yLabel: "T, ms" });
  ctx.save(); clipTo(ctx, f.rect); curve(ctx, f, (x) => P.thomson(L, x * 1e-6) * 1000, x0, x1, c.primary); dot(ctx, f, C * 1e6, P.thomson(L, C) * 1000, c.warning); ctx.restore();
  legend(ctx, [{ color: c.primary, label: `T = 2π√(LC), L = ${fmt(L, 2)} Gn` }], f.padL + 56, 9, c);
}

/** O'zgaruvchan tok: u(t) va i(t), ikki davr. */
export function drawUI(ctx, st, { ac, U }) {
  const c = st.colors, T = TAU / ac.w, t1 = 2 * T;
  const im = Math.max(ac.I0, 1e-9);
  const f = frame(ctx, st, { xMin: 0, xMax: t1 * 1000, yMin: -1.2, yMax: 1.2, xTicks: ticks(0, t1 * 1000, 6).values, yTicks: [-1, 0, 1], fmtX: (v) => fmt(v, v < 10 ? 1 : 0), fmtY: (v) => (v === 0 ? "0" : v > 0 ? "max" : "−max"), xUnit: "ms" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, (x) => P.acInstant(ac, U, x / 1000).u / U, 0, t1 * 1000, c.primary, 2.5, 400);
  curve(ctx, f, (x) => P.acInstant(ac, U, x / 1000).i / im, 0, t1 * 1000, c.danger, 2.2, 400, [6, 4]);
  ctx.restore();
  const deg = (ac.phi * 180) / Math.PI;
  legend(ctx, [{ color: c.primary, label: `kuchlanish u (U₀ = ${fmt(U, 1)} V)` }, { color: c.danger, label: `tok i (I₀ = ${fmt(ac.I0 * 1000, 1)} mA)`, dash: [6, 4] }, { color: c.text3, label: `φ = ${fmt(deg, 0)}°` }], f.padL + 56, 9, c);
}

/** Reaktiv qarshiliklar chastotaga bog'liq (logarifmik f). */
export function drawReact(ctx, st, { R, L, C, f: fc, hasL, hasC }) {
  const c = st.colors, a = 10, b = 2000, la = Math.log10(a), lb = Math.log10(b);
  const Zs = (lf) => P.acSeries({ R, L: hasL ? L : 0, C: hasC ? C : Infinity }, 1, Math.pow(10, lf));
  const ymax = 1000;
  const f = frame(ctx, st, { xMin: la, xMax: lb, yMin: 0, yMax: ymax, xTicks: logTicks(a, b).map(Math.log10), yTicks: [0, 250, 500, 750, 1000], fmtX: (v) => fmt(Math.pow(10, v), 0), fmtY: (v) => fmt(v, 0), xUnit: "Hz", yLabel: "Om" });
  ctx.save(); clipTo(ctx, f.rect);
  if (hasL) curve(ctx, f, (lf) => Zs(lf).XL, la, lb, "#14b8a6", 2, 300, [6, 4]);
  if (hasC) curve(ctx, f, (lf) => Math.min(Zs(lf).XC, ymax * 3), la, lb, "#8b5cf6", 2, 300, [2, 3]);
  if (R > 0) curve(ctx, f, () => R, la, lb, c.text3, 1.5, 2);
  curve(ctx, f, (lf) => Math.min(Zs(lf).Z, ymax * 3), la, lb, c.primary, 2.6, 400);
  const z = Zs(Math.log10(fc)).Z; if (z <= ymax) dot(ctx, f, Math.log10(fc), z, c.warning);
  ctx.restore();
  const items = [{ color: c.primary, label: "to‘la qarshilik Z" }];
  if (hasL) items.push({ color: "#14b8a6", label: "X_L = ωL", dash: [6, 4] });
  if (hasC) items.push({ color: "#8b5cf6", label: "X_C = 1/(ωC)", dash: [2, 3] });
  if (R > 0) items.push({ color: c.text3, label: "R" });
  legend(ctx, items, f.padL + 56, 9, c);
}

/** Rezonans egri chizig'i: I_ef(f) va lab o'lchovlari. */
export function drawRes(ctx, st, { R, L, C, U, f: fc, pts }) {
  const c = st.colors, f0 = P.resonanceF(L, C), a = Math.max(5, f0 / 4), b = f0 * 2.5;
  const I = (x) => P.acSeries({ R, L, C }, U, x).Ief * 1000;
  const y = nice(I(f0) * 1.1);
  const f = frame(ctx, st, { xMin: a, xMax: b, yMin: 0, yMax: y.top, xTicks: ticks(a, b, 6).values.filter((v) => v >= a), yTicks: y.vals, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(y.step)), xUnit: "Hz", yLabel: "I, mA" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.fillStyle = "rgba(34,197,94,0.1)"; const bw = P.bandwidth(R, L); ctx.fillRect(f.X(f0 - bw / 2), f.rect.y, f.X(f0 + bw / 2) - f.X(f0 - bw / 2), f.rect.h);
  ctx.strokeStyle = c.success; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(f.X(f0), f.rect.y); ctx.lineTo(f.X(f0), f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]);
  curve(ctx, f, I, a, b, c.primary, 2.5, 500);
  pts.forEach((p) => dot(ctx, f, p.f, p.I * 1000, c.success, 5));
  if (fc >= a && fc <= b) dot(ctx, f, fc, I(fc), c.warning);
  ctx.restore();
  tag(ctx, `f₀ = ${fmt(f0, 0)} Hz`, f.X(f0) + 4, f.rect.y + f.rect.h - 14, { color: c.success, bg: c.bg, font: small });
  legend(ctx, [{ color: c.primary, label: `I(f), R = ${fmt(R, 0)} Om` }, { color: "rgba(34,197,94,0.5)", label: `o‘tkazish kengligi Δf = ${fmt(bw, 1)} Hz` }, ...(pts.length ? [{ color: c.success, label: `o‘lchovlar: ${pts.length} ta` }] : [])], f.padL + 56, 9, c);
}

/** U_L va U_C chastotaga bog'liq (effektiv). */
export function drawULC(ctx, st, { R, L, C, U, f: fc }) {
  const c = st.colors, f0 = P.resonanceF(L, C), a = Math.max(5, f0 / 4), b = f0 * 2.5;
  const ac = (x) => P.acSeries({ R, L, C }, U, x);
  let m = U / Math.SQRT2; for (let x = a; x <= b; x += (b - a) / 300) { const s = ac(x); m = Math.max(m, s.UL / Math.SQRT2, s.UC / Math.SQRT2); }
  const y = nice(m * 1.05);
  const f = frame(ctx, st, { xMin: a, xMax: b, yMin: 0, yMax: y.top, xTicks: ticks(a, b, 6).values.filter((v) => v >= a), yTicks: y.vals, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(y.step)), xUnit: "Hz", yLabel: "U, V" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, (x) => ac(x).UL / Math.SQRT2, a, b, "#14b8a6", 2.4, 400);
  curve(ctx, f, (x) => ac(x).UC / Math.SQRT2, a, b, "#8b5cf6", 2.4, 400);
  curve(ctx, f, () => U / Math.SQRT2, a, b, c.text3, 1.4, 2, [5, 4]);
  if (fc >= a && fc <= b) { dot(ctx, f, fc, ac(fc).UL / Math.SQRT2, "#14b8a6", 5); dot(ctx, f, fc, ac(fc).UC / Math.SQRT2, "#8b5cf6", 5); }
  ctx.restore();
  legend(ctx, [{ color: "#14b8a6", label: "U_L (g‘altakda)" }, { color: "#8b5cf6", label: "U_C (kondensatorda)" }, { color: c.text3, label: "manba U", dash: [5, 4] }], f.padL + 56, 9, c);
}
