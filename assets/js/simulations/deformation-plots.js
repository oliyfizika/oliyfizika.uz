// ==========================================================================
// Qattiq jism deformatsiyasi — grafiklar (simulations/deformation.html):
// cho'zilish diagrammasi σ(ε) (nazariy egri chiziq + o'lchangan yo'l, xarakterli kuchlanishlar);
// simni cho'zish: F(Δl) — o'lchangan nuqtalar, ular bo'yicha to'g'ri chiziq va nazariy k = ES/l₀.
// Kursor bilan qiymat o'qish.
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./deformation-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
const SMALLF = "600 10px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
const dot = (ctx, x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
const STEPS = [0.25, 0.5, 1, 2, 3, 5, 10, 20, 30, 40, 50];
/** Diagramma o'qi uchun ε chegarasi (%) */
export const niceStrain = (pct) => STEPS.find((s) => s >= pct) ?? 50;

/** σ(ε): o: { m, path: [[ε, σ]], e, s, xMax (%), S (m²), hover (%) } */
export function drawSE(ctx, st, o) {
  const c = st.colors, m = o.m, MPa = 1e6, xMax = o.xMax, yMax = Math.ceil((m.su * 1.15) / MPa / 50) * 50;
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: ticks(0, xMax, st.w < 480 ? 4 : 6).values, yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, xMax < 1 ? 2 : xMax < 5 ? 1 : 0), fmtY: (v) => fmt(v, 0), yLabel: "σ, MPa", xUnit: "ε, %" });
  last = { ...f, xMin: 0, xMax };
  const r = f.rect, X = (e) => f.X(e * 100), Y = (s) => f.Y(s / MPa);
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  // xarakterli kuchlanishlar
  const y02 = P.yieldStrength(m), lines = [];
  if (!m.brittle) lines.push([m.sp, st.w < 520 ? "σₚ" : `σₚ = ${fmt(m.sp / MPa, 0)} MPa (proporsionallik)`, c.success]);
  if (y02) lines.push([y02, st.w < 520 ? "σₜ" : `σₜ ≈ ${fmt(y02 / MPa, 0)} MPa (oquvchanlik)`, c.warning]);
  lines.push([m.su, st.w < 520 ? "σₘ" : `σₘ = ${fmt(m.su / MPa, 0)} MPa (mustahkamlik)`, c.danger]);
  for (const [s, , col] of lines) { ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(r.x, Y(s)); ctx.lineTo(r.x + r.w, Y(s)); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.setLineDash([]);
  // nazariy egri chiziq
  const eEnd = Math.min(m.ef, (xMax / 100) * 1.02), n = 500;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]); ctx.beginPath();
  for (let k = 0; k <= n; k++) { const e = (eEnd * k) / n; const x = X(e), y = Y(P.sigmaMono(m, e)); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke(); ctx.setLineDash([]);
  // o'lchangan yo'l
  if (o.path.length > 1) { ctx.strokeStyle = c.primary; ctx.lineWidth = 2.6; ctx.lineJoin = "round"; ctx.beginPath(); o.path.forEach(([e, s], i) => { if (i) ctx.lineTo(X(e), Y(s)); else ctx.moveTo(X(e), Y(s)); }); ctx.stroke(); }
  ctx.restore();
  for (const [s, label, col] of lines) if (Y(s) > r.y + 4) tag(ctx, label, r.x + r.w - 4, Y(s) - 9, { color: col, bg: c.bg2, align: "right", font: SMALLF, pad: 4 });
  if (o.e * 100 <= xMax * 1.001) dot(ctx, X(o.e), Y(o.s), 6, c.warning);
  legend(ctx, [{ color: c.primary, label: st.w < 480 ? "o‘lchangan" : "o‘lchangan (yuklash va yuksizlantirish)" }, { color: c.text3, label: st.w < 480 ? "nazariy" : "monoton yuklash diagrammasi", dash: [6, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover != null) {
    const pct = Math.max(0, Math.min(xMax, o.hover)), e = pct / 100;
    if (e <= m.ef) { const s = P.sigmaMono(m, e); hoverLine(ctx, f, f.X(pct), [`ε = ${fmt(pct, pct < 1 ? 3 : 2)} %`, `σ = ${fmt(s / MPa, 0)} MPa`, `F = σS₀ = ${fmt((s * o.S) / 1000, 1)} kN`], c); }
  }
}

/** F(Δl): o: { pts: [[Δl mm, F N]], kTh (N/mm), dlMax (mm), Fmax (N), dl, F, hover (mm) } */
export function drawHooke(ctx, st, o) {
  const c = st.colors, xMax = o.dlMax, yMax = o.Fmax;
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: ticks(0, xMax, st.w < 480 ? 4 : 6).values, yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, xMax < 2 ? 2 : 1), fmtY: (v) => fmt(v, 0), yLabel: "F, N", xUnit: "Δl, mm" });
  last = { ...f, xMin: 0, xMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.4; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xMax), f.Y(o.kTh * xMax)); ctx.stroke(); ctx.setLineDash([]);
  const fit = fitK(o.pts);
  if (fit) { ctx.strokeStyle = c.primary; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xMax), f.Y(fit * xMax)); ctx.stroke(); }
  ctx.restore();
  for (const [x, F] of o.pts) { ctx.strokeStyle = c.bg; ctx.lineWidth = 2; dot(ctx, f.X(x), f.Y(F), 5, c.warning); ctx.beginPath(); ctx.arc(f.X(x), f.Y(F), 5, 0, Math.PI * 2); ctx.stroke(); }
  if (o.dl <= xMax && o.F <= yMax) { ctx.strokeStyle = c.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.X(o.dl), f.Y(o.F), 8, 0, Math.PI * 2); ctx.stroke(); }
  legend(ctx, [{ color: c.warning, label: "o‘lchashlar" }, { color: c.primary, label: st.w < 480 ? "F = kΔl" : `chiziq: k = ${fit ? fmt(fit, 1) : "—"} N/mm` }, { color: c.text3, label: st.w < 480 ? "ES/l₀" : `nazariy k = ES/l₀ = ${fmt(o.kTh, 1)} N/mm`, dash: [6, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover != null) { const x = Math.max(0, Math.min(xMax, o.hover)); hoverLine(ctx, f, f.X(x), [`Δl = ${fmt(x, 3)} mm`, `F = kΔl = ${fmt(o.kTh * x, 1)} N`, `≈ ${fmt((o.kTh * x) / P.G, 2)} kg yuk`], c); }
}
/** Koordinata boshidan o'tuvchi to'g'ri chiziq qiyaligi (eng kichik kvadratlar) */
export function fitK(pts) { let sxy = 0, sxx = 0; for (const [x, F] of pts) { if (x <= 0) continue; sxy += x * F; sxx += x * x; } return sxx > 0 && pts.length >= 2 ? sxy / sxx : null; }
