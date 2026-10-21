// ==========================================================================
// Potensial va kondensator grafiklari: φ(x), yo'l bo'ylab ish, C(d), W(d), RC zaryadlanish.
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt } from "./sim-kit.js";
import * as P from "./potential-physics.js";

const TAU = Math.PI * 2;
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
function curve(ctx, f, fn, x0, x1, color, w = 2.5, n = 300, dash = null) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); let pen = false;
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = fn(x); if (!Number.isFinite(y)) { pen = false; continue; } if (!pen) { ctx.moveTo(f.X(x), f.Y(y)); pen = true; } else ctx.lineTo(f.X(x), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
}
const dot = (ctx, f, x, y, color, r = 6) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), r, 0, TAU); ctx.fill(); };
const symTicks = (m) => { const t = ticks(0, m, 2), top = t.values[t.values.length - 1]; return { top, vals: [-top, -top / 2, 0, top / 2, top], step: top / 2 }; };

/** Potensial gorizontal chiziq bo'ylab (x, cm). */
export function drawPhi(ctx, st, { fn, x0, x1, xp, yLine }) {
  const c = st.colors;
  let m = 50; for (let i = 0; i <= 200; i++) m = Math.max(m, Math.min(5000, Math.abs(fn(x0 + ((x1 - x0) * i) / 200))));
  const yt = symTicks(m * 1.05);
  const f = frame(ctx, st, { xMin: x0, xMax: x1, yMin: -yt.top, yMax: yt.top, xTicks: ticks(x0, x1, 8).values, yTicks: yt.vals, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "cm", yLabel: "φ, V" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(0)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(0)); ctx.stroke();
  curve(ctx, f, fn, x0, x1, c.primary, 2.5, 600); dot(ctx, f, xp, fn(xp), c.warning);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: `φ(x) chiziq y = ${fmt(yLine, 1)} cm bo‘ylab` }], f.padL + 56, 9, c);
}

/** Sinov zaryadini sudrashda bajarilgan ish (yo'l uzunligi bo'yicha) va aniq qiymat. */
export function drawWork(ctx, st, { hist, Wexact }) {
  const c = st.colors, s1 = Math.max(1, hist.length ? hist[hist.length - 1].s : 1);
  let m = Math.abs(Wexact) * 1e9; hist.forEach((p) => { m = Math.max(m, Math.abs(p.W) * 1e9); }); m = Math.max(m, 50);
  const yt = symTicks(m * 1.1);
  const f = frame(ctx, st, { xMin: 0, xMax: s1, yMin: -yt.top, yMax: yt.top, xTicks: ticks(0, s1, 6).values, yTicks: yt.vals, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "cm", yLabel: "A, nJ" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.success; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(Wexact * 1e9)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(Wexact * 1e9)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); hist.forEach((p, i) => (i ? ctx.lineTo(f.X(p.s), f.Y(p.W * 1e9)) : ctx.moveTo(f.X(p.s), f.Y(p.W * 1e9)))); ctx.stroke();
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: "yo‘l bo‘ylab yig‘ilgan ish" }, { color: c.success, label: `q(φ_A − φ_B) = ${fmt(Wexact * 1e9, 1)} nJ`, dash: [5, 4] }], f.padL + 56, 9, c);
}

/** C(d): sig'im plastinkalar orasidagi masofaga bog'liq. S (m²), d (m). */
export function drawCd(ctx, st, { S, eps, d }) {
  const c = st.colors, x0 = 1, x1 = 10, C = (dmm) => P.capacitance(S, dmm / 1000, eps) * 1e12;
  const yt = ticks(0, C(x0) * 1.05, 4), top = yt.values[yt.values.length - 1];
  const f = frame(ctx, st, { xMin: 0, xMax: x1, yMin: 0, yMax: top, xTicks: [0, 2, 4, 6, 8, 10], yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: "mm", yLabel: "C, pF" });
  ctx.save(); clipTo(ctx, f.rect); curve(ctx, f, C, 0.5, x1, c.primary); dot(ctx, f, d * 1000, C(d * 1000), c.warning); ctx.restore();
  legend(ctx, [{ color: c.primary, label: `C = ε₀εS/d, ε = ${fmt(eps, 1)}, S = ${fmt(S * 1e4, 0)} cm²` }], f.padL + 56, 9, c);
}

/** Energiya W(d): batareyaga ulangan (U const) va uzilgan (q const) holatlar. */
export function drawWd(ctx, st, { S, eps, d, U0, q0, connected }) {
  const c = st.colors, x1 = 10;
  const Wc = (dmm) => P.capState({ S, d: dmm / 1000, eps, connected: true, U0 }).W * 1e9;
  const Wi = (dmm) => P.capState({ S, d: dmm / 1000, eps, connected: false, q0 }).W * 1e9;
  let m = 0; for (let x = 1; x <= x1; x += 0.25) m = Math.max(m, Math.min(Wc(x), 1e9), Wi(x));
  const yt = ticks(0, Math.max(m, Wc(d * 1000)) * 1.05, 4), top = yt.values[yt.values.length - 1];
  const f = frame(ctx, st, { xMin: 0, xMax: x1, yMin: 0, yMax: top, xTicks: [0, 2, 4, 6, 8, 10], yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: "mm", yLabel: "W, nJ" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, Wc, 0.5, x1, c.primary, connected ? 2.6 : 1.4, 300, connected ? null : [6, 4]);
  curve(ctx, f, Wi, 0.5, x1, c.danger, connected ? 1.4 : 2.6, 300, connected ? [6, 4] : null);
  dot(ctx, f, d * 1000, connected ? Wc(d * 1000) : Wi(d * 1000), c.warning);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: "ulangan: U = const, W = CU²/2", dash: connected ? null : [6, 4] }, { color: c.danger, label: "uzilgan: q = const, W = q²/2C", dash: connected ? [6, 4] : null }], f.padL + 56, 9, c);
}

/** RC: q/q_max, i/i_max (vaqt s). hist — [{t, q, i}]. */
export function drawRC(ctx, st, { hist, qm, im, tau, span }) {
  const c = st.colors, t1 = hist.length ? hist[hist.length - 1].t : 0, t0 = Math.max(0, t1 - span);
  const f = frame(ctx, st, { xMin: t0, xMax: t0 + span, yMin: -1.1, yMax: 1.1, xTicks: ticks(t0, t0 + span, 6).values, yTicks: [-1, 0, 1], fmtX: (v) => fmt(v, 1), fmtY: (v) => (v === 0 ? "0" : v > 0 ? "max" : "−max"), xUnit: "s" });
  ctx.save(); clipTo(ctx, f.rect);
  const pts = hist.filter((p) => p.t >= t0);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(f.X(p.t), f.Y(p.q / qm)) : ctx.moveTo(f.X(p.t), f.Y(p.q / qm)))); ctx.stroke();
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(f.X(p.t), f.Y(p.i / im)) : ctx.moveTo(f.X(p.t), f.Y(p.i / im)))); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: `zaryad q (max ${fmt(qm * 1e6, 1)} mkC)` }, { color: c.danger, label: `tok i (max ${fmt(im * 1e3, 2)} mA)`, dash: [6, 4] }, { color: c.text3, label: `τ = RC = ${fmt(tau, 2)} s` }], f.padL + 56, 9, c);
}
