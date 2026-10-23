// ==========================================================================
// Nyuton qonunlari grafiklari: o'lchangan a(F) va a(1/m) (nazariy chiziq bilan); liftda P(t), a(t), v(t).
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, tag } from "./sim-kit.js";
import * as P from "./newton-physics.js";

const TAU = Math.PI * 2;
const small = "600 10px Inter, system-ui, sans-serif";
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
const nice = (m, n = 4) => { const step = ticks(0, m, n).step, top = Math.ceil(m / step - 1e-9) * step, vals = []; for (let i = 0; i * step <= top + step * 1e-9; i++) vals.push(+(i * step).toFixed(10)); return { top, vals, step }; };
function curve(ctx, f, fn, x0, x1, color, w = 2, dash = null, n = 200) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); let pen = false;
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = fn(x); if (!Number.isFinite(y)) { pen = false; continue; } pen ? ctx.lineTo(f.X(x), f.Y(y)) : ctx.moveTo(f.X(x), f.Y(y)); pen = true; }
  ctx.stroke(); ctx.setLineDash([]);
}
/** Massaga qarab nuqta rangi (0,5…1,3 kg). */
const PAL = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
export const massColor = (m) => PAL[Math.min(PAL.length - 1, Math.max(0, Math.round((m - 0.5) * 10)))];

/** Nazariy a(F_d) — joriy aravacha massasi M, ishqalanish μ, rejim. */
function aTheory(Fd, M, mu, mode, g = P.G) { const mass = mode === "hang" ? M + Fd / g : M; return Math.max(0, (Fd - mu * M * g) / mass); }

export function drawAF(ctx, st, { pts, M, mu, mode, Fd }) {
  const c = st.colors, xm = mode === "hang" ? 3 : 4;
  const amax = Math.max(1, aTheory(xm, 0.5, 0, "force") * (mode === "hang" ? 0.7 : 1), ...pts.map((p) => p.a)) * 1.08;
  const yt = nice(Math.min(amax, 9)), xt = ticks(0, xm, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: xm, yMin: 0, yMax: yt.top, xTicks: xt.values, yTicks: yt.vals, fmtX: (x) => fmt(x, 1), fmtY: (y) => fmt(y, dec(yt.step)), xUnit: "N", yLabel: "a, m/s²" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, (F) => aTheory(F, M, mu, mode), 0, xm, massColor(M), 1.6, [6, 4]);
  pts.forEach((p) => { ctx.fillStyle = massColor(p.M); ctx.beginPath(); ctx.arc(f.X(p.F), f.Y(p.a), 5, 0, TAU); ctx.fill(); ctx.strokeStyle = c.bg; ctx.lineWidth = 1.5; ctx.stroke(); });
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(f.X(Fd), f.rect.y); ctx.lineTo(f.X(Fd), f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  if (!pts.length) tag(ctx, "Aravachani qo‘yib yuboring — o‘lchov nuqtasi shu yerda paydo bo‘ladi", f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2, { color: c.text3, bg: c.bg, align: "center", font: small });
  legend(ctx, [{ color: massColor(M), label: `nazariya: M = ${fmt(M, 1)} kg${mu ? `, μ = ${fmt(mu, 2)}` : ""}`, dash: [6, 4] }], f.padL + 70, 9, c);
}

export function drawAM(ctx, st, { pts, M, m, F, mu, mode }) {
  const c = st.colors, x1 = 2.2;
  const fn = (x) => { const mass = 1 / x, Mc = mode === "hang" ? mass - m : mass; if (Mc < 0.05) return NaN; const Fd = mode === "hang" ? m * P.G : F; return Math.max(0, (Fd - mu * Mc * P.G) / mass); };
  const amax = Math.max(1, fn(x1) || 0, ...pts.map((p) => p.a)) * 1.08;
  const yt = nice(Math.min(amax, 9));
  const f = frame(ctx, st, { xMin: 0, xMax: x1, yMin: 0, yMax: yt.top, xTicks: [0, 0.5, 1, 1.5, 2], yTicks: yt.vals, fmtX: (x) => fmt(x, 1), fmtY: (y) => fmt(y, dec(yt.step)), xUnit: "1/kg", yLabel: "a, m/s²" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, fn, 0.02, x1, c.primary, 1.6, [6, 4]);
  pts.forEach((p) => { const same = Math.abs(p.F - (mode === "hang" ? m * P.G : F)) < 1e-6; ctx.globalAlpha = same ? 1 : 0.3; ctx.fillStyle = massColor(p.M); ctx.beginPath(); ctx.arc(f.X(1 / p.mass), f.Y(p.a), 5, 0, TAU); ctx.fill(); });
  ctx.globalAlpha = 1; ctx.restore();
  legend(ctx, [{ color: c.primary, label: `nazariya: ${mode === "hang" ? `mg = ${fmt(m * P.G, 2)}` : `F = ${fmt(F, 1)}`} N`, dash: [6, 4] }], f.padL + 70, 9, c);
}

export function drawLiftP(ctx, st, { hist, span, mass }) {
  const c = st.colors, t1 = hist.length ? hist[hist.length - 1].t : 0, t0 = Math.max(0, t1 - span), pts = hist.filter((p) => p.t >= t0);
  const mg = mass * P.G, yt = nice(Math.max(mg * 2.3, ...pts.map((p) => p.P)) * 1.02);
  const f = frame(ctx, st, { xMin: t0, xMax: t0 + span, yMin: 0, yMax: yt.top, xTicks: ticks(t0, t0 + span, 6).values, yTicks: yt.vals, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "s", yLabel: "P, N" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.3; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(mg)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(mg)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.4; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(f.X(p.t), f.Y(p.P)) : ctx.moveTo(f.X(p.t), f.Y(p.P)))); ctx.stroke();
  ctx.restore();
  tag(ctx, `mg = ${fmt(mg, 0)} N`, f.rect.x + f.rect.w - 4, f.Y(mg) - 11, { color: c.text2, bg: c.bg, align: "right", font: small });
  legend(ctx, [{ color: c.primary, label: "tarozi ko‘rsatgan vazn P(t)" }, { color: c.text3, label: "og‘irlik kuchi mg", dash: [5, 4] }], f.padL + 50, 9, c);
}

export function drawLiftAV(ctx, st, { hist, span }) {
  const c = st.colors, t1 = hist.length ? hist[hist.length - 1].t : 0, t0 = Math.max(0, t1 - span), pts = hist.filter((p) => p.t >= t0);
  const m = Math.max(4, ...pts.map((p) => Math.max(Math.abs(p.a), Math.abs(p.v)))) * 1.1, yt = nice(m, 3);
  const f = frame(ctx, st, { xMin: t0, xMax: t0 + span, yMin: -yt.top, yMax: yt.top, xTicks: ticks(t0, t0 + span, 6).values, yTicks: [...yt.vals.slice(1).reverse().map((v) => -v), ...yt.vals], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: "s", yLabel: "a, v" });
  ctx.save(); clipTo(ctx, f.rect);
  const line = (k, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = 2.3; ctx.setLineDash(dash || []); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(f.X(p.t), f.Y(p[k])) : ctx.moveTo(f.X(p.t), f.Y(p[k])))); ctx.stroke(); ctx.setLineDash([]); };
  line("a", c.special); line("v", c.success, [6, 4]);
  ctx.restore();
  legend(ctx, [{ color: c.special, label: "tezlanish a, m/s² (yuqoriga +)" }, { color: c.success, label: "tezlik v, m/s", dash: [6, 4] }], f.padL + 40, 9, c);
}
