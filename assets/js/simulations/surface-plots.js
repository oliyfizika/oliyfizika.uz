// ==========================================================================
// Sirt tarangligi — grafiklar (simulations/surface.html):
// F(x) sovun pardasida (ish — yuza), h(r) kapillyar ko'tarilish, M(N) tomchilar usuli. Kursor bilan qiymat o'qish.
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./surface-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}

/** Parda: o: { sigma, L (m), x0, x, xMax (m), hover (cm) } — F mN da, x cm da */
export function drawFilm(ctx, st, o) {
  const c = st.colors, F = P.filmForce(o.sigma, o.L) * 1000, xMax = o.xMax * 100, yMax = Math.max(F * 1.6, 1);
  const xt = ticks(0, xMax, st.w < 480 ? 4 : 6), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: "F, mN", xUnit: "x, cm" });
  last = { ...f, xMax };
  const r = f.rect, a = Math.min(o.x0, o.x) * 100, b = Math.max(o.x0, o.x) * 100;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.fillStyle = c.dark ? "rgba(96,165,250,0.25)" : "rgba(37,99,235,0.15)"; ctx.fillRect(f.X(a), f.Y(F), f.X(b) - f.X(a), f.Y(0) - f.Y(F));
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xMax), f.Y(F * 1.5)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2.8; ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(F)); ctx.lineTo(f.X(xMax), f.Y(F)); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(o.x * 100), f.Y(F), 6, 0, Math.PI * 2); ctx.fill();
  legend(ctx, [{ color: c.danger, label: st.w < 480 ? "Parda: F = 2σL" : "Parda: F = 2σL (o‘zgarmas)" }, { color: c.text3, label: st.w < 480 ? "prujina" : "taqqoslash: prujina F = kx", dash: [5, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`x = ${fmt(o.hover, 1)} cm`, `F = ${fmt(F, 2)} mN`, `ish (bo‘yalgan yuza): A = ${fmt(P.filmWork(o.sigma, o.L, Math.abs(o.x - o.x0)) * 1e6, 1)} μJ`], c);
}

/** h(r): o: { liq, r (m), t, hover (mm) } — h mm da */
export function drawCap(ctx, st, o) {
  const c = st.colors, cur = P.LIQUIDS[o.liq], hOf = (L, rr, s = L.sigma) => P.capillaryH(s, L.rho, rr / 1000, L.theta) * 1000;
  const merc = o.liq === "mercury", yMin = merc ? hOf(cur, 0.1) * 1.05 : 0, yMax = merc ? 5 : Math.min(160, hOf(P.LIQUIDS.water, 0.1) * 1.05);
  const xt = ticks(0, 2, st.w < 480 ? 4 : 5), yt = ticks(yMin, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: 2, yMin, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 0), yLabel: "h, mm", xUnit: "r, mm" });
  last = { ...f, xMax: 2 };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (const [k, L] of Object.entries(P.LIQUIDS)) {
    if ((k === "mercury") !== merc && k !== o.liq) continue;
    const isCur = k === o.liq, s = isCur ? P.sigmaAt(k, o.t) : L.sigma;
    ctx.strokeStyle = isCur ? c.primary : c.text3; ctx.lineWidth = isCur ? 2.8 : 1.2; ctx.setLineDash(isCur ? [] : [4, 4]); ctx.beginPath();
    for (let k2 = 0; k2 <= 200; k2++) { const rr = 0.08 + (1.92 * k2) / 200, h = hOf(L, rr, s); if (k2) ctx.lineTo(f.X(rr), f.Y(h)); else ctx.moveTo(f.X(rr), f.Y(h)); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  const hc = P.capillaryH(P.sigmaAt(o.liq, o.t), cur.rho, o.r, cur.theta) * 1000;
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(o.r * 1000), f.Y(Math.max(yMin, Math.min(yMax, hc))), 6, 0, Math.PI * 2); ctx.fill();
  legend(ctx, [{ color: c.primary, label: `${cur.name}: h = 2σcosθ/(ρgr)` }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) { const rr = Math.max(0.05, o.hover); hoverLine(ctx, f, f.X(rr), [`r = ${fmt(rr, 2)} mm`, `h = ${fmt(P.capillaryH(P.sigmaAt(o.liq, o.t), cur.rho, rr / 1000, cur.theta) * 1000, 1)} mm`], c); }
}

/** Tomchilar: o: { pts: [{ N, M }] (M — mg), sigma, d (m), Nmax, hover } */
export function drawDrops(ctx, st, o) {
  const c = st.colors, m1 = P.dropMass(o.sigma, o.d) * 1e6, xMax = o.Nmax, yMax = Math.max(m1 * xMax * 1.08, 1);
  const xt = ticks(0, xMax, st.w < 480 ? 4 : 6), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "M, mg", xUnit: "N, tomchi" });
  last = { ...f, xMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.6; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(xMax), f.Y(m1 * xMax)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = c.primary; for (const p of o.pts) { ctx.beginPath(); ctx.arc(f.X(p.N), f.Y(p.M), 3.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: st.w < 480 ? "Tarozi" : "Tarozi ko‘rsatishi" }, { color: c.text3, label: st.w < 480 ? "M = N·πdσ/g" : `M = N·πdσ/g (${fmt(m1, 1)} mg/tomchi)`, dash: [6, 5] }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`N = ${fmt(o.hover, 0)}`, `M = ${fmt(m1 * o.hover, 1)} mg`], c);
}
