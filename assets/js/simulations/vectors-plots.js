// ==========================================================================
// Vektorlar va kuchlarni qo'shish — grafiklar (simulations/vectors.html):
// proyeksiyalar aₓ(α), a_y(α); |a + b| va |a − b| vektorlar orasidagi burchakka bog'liq; natijaviy kuch R(θ).
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./vectors-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
function curve(ctx, f, x0, x1, fn, color, width = 2.6, dash = null) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath();
  for (let k = 0; k <= 360; k++) { const x = x0 + ((x1 - x0) * k) / 360, y = f.Y(fn(x)); if (k) ctx.lineTo(f.X(x), y); else ctx.moveTo(f.X(x), y); }
  ctx.stroke(); ctx.setLineDash([]);
}
const dot = (ctx, f, x, y, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), 6, 0, Math.PI * 2); ctx.fill(); };
const degTicks = (max, narrow) => (max === 360 ? (narrow ? [0, 90, 180, 270, 360] : [0, 45, 90, 135, 180, 225, 270, 315, 360]) : narrow ? [0, 45, 90, 135, 180] : [0, 30, 60, 90, 120, 150, 180]);

/** Proyeksiyalar: o: { r, deg, unit, hover } */
export function drawProj(ctx, st, o) {
  const c = st.colors, m = Math.max(1, o.r) * 1.15, yt = ticks(-m, m, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: 360, yMin: -m, yMax: m, xTicks: degTicks(360, st.w < 480), yTicks: yt.values, fmtX: (v) => `${v}°`, fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: `proyeksiya, ${o.unit}`, xUnit: "α" });
  last = { ...f, xMin: 0, xMax: 360 }; const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r.x, f.Y(0)); ctx.lineTo(r.x + r.w, f.Y(0)); ctx.stroke();
  curve(ctx, f, 0, 360, (x) => o.r * Math.cos(x * P.DEG), c.danger);
  curve(ctx, f, 0, 360, (x) => o.r * Math.sin(x * P.DEG), c.success);
  ctx.restore();
  dot(ctx, f, o.deg, o.r * Math.cos(o.deg * P.DEG), c.danger); dot(ctx, f, o.deg, o.r * Math.sin(o.deg * P.DEG), c.success);
  legend(ctx, [{ color: c.danger, label: "x o‘qiga: a·cosα" }, { color: c.success, label: "y o‘qiga: a·sinα" }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`α = ${fmt(o.hover, 0)}°`, `x: ${fmt(o.r * Math.cos(o.hover * P.DEG), 2)} ${o.unit}`, `y: ${fmt(o.r * Math.sin(o.hover * P.DEG), 2)} ${o.unit}`], c);
}

/** |a ± b|(θ): o: { a, b, theta, diff, unit, hover } */
export function drawSum(ctx, st, o) {
  const c = st.colors, yMax = Math.max(1, o.a + o.b) * 1.12, yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: 180, yMin: 0, yMax, xTicks: degTicks(180, st.w < 480), yTicks: yt.values, fmtX: (v) => `${v}°`, fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: `modul, ${o.unit}`, xUnit: "θ" });
  last = { ...f, xMin: 0, xMax: 180 }; const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  [o.a + o.b, Math.abs(o.a - o.b)].forEach((v) => { ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(r.x, f.Y(v)); ctx.lineTo(r.x + r.w, f.Y(v)); ctx.stroke(); ctx.setLineDash([]); });
  curve(ctx, f, 0, 180, (x) => P.sumMag(o.a, o.b, x), c.primary);
  curve(ctx, f, 0, 180, (x) => P.diffMag(o.a, o.b, x), c.special, o.diff ? 2.6 : 1.4, o.diff ? null : [5, 4]);
  ctx.restore();
  dot(ctx, f, o.theta, P.sumMag(o.a, o.b, o.theta), c.warning); if (o.diff) dot(ctx, f, o.theta, P.diffMag(o.a, o.b, o.theta), c.special);
  legend(ctx, [{ color: c.primary, label: "|a + b|" }, { color: c.special, label: "|a − b|", dash: o.diff ? null : [5, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`θ = ${fmt(o.hover, 0)}°`, `|a + b| = ${fmt(P.sumMag(o.a, o.b, o.hover), 2)} ${o.unit}`, `|a − b| = ${fmt(P.diffMag(o.a, o.b, o.hover), 2)} ${o.unit}`], c);
}

/** R(θ): F₂ ni F₁ ga nisbatan θ burchakka burganda (F₃ o'zgarmas). o: { F1, F2, F3 (vektor yoki null), theta, hover } */
export function drawForces(ctx, st, o) {
  const c = st.colors, d1 = P.dirDeg(o.F1), m2 = P.mag(o.F2);
  const R = (th) => P.mag(P.resultant([o.F1, P.polar(m2, d1 + th), ...(o.F3 ? [o.F3] : [])]));
  let yMax = 1; for (let k = 0; k <= 72; k++) yMax = Math.max(yMax, R(k * 5)); yMax *= 1.12;
  const yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: 360, yMin: 0, yMax, xTicks: degTicks(360, st.w < 480), yTicks: yt.values, fmtX: (v) => `${v}°`, fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: "R, N", xUnit: "θ" });
  last = { ...f, xMin: 0, xMax: 360 }; const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  curve(ctx, f, 0, 360, R, c.primary);
  ctx.restore();
  dot(ctx, f, o.theta, R(o.theta), c.warning);
  legend(ctx, [{ color: c.primary, label: st.w < 480 ? "R(θ)" : `R(θ): F₂ ni F₁ ga nisbatan burganda${o.F3 ? " (F₃ o‘zgarmas)" : ""}` }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`θ = ${fmt(o.hover, 0)}°`, `R = ${fmt(R(o.hover), 2)} N`], c);
}
