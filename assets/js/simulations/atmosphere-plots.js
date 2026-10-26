// ==========================================================================
// Atmosfera bosimi — grafiklar (simulations/atmosphere.html):
// p(h) — standart atmosfera va «har 12 m da 1 mm» yaqinlashuvi; Magdeburg: kerakli kuch F(n) va tortish kuchi.
// Kursor bilan qiymat o'qish.
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./atmosphere-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
function curve(ctx, f, x0, x1, fn, color, w, dash, n = 240) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath();
  for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n, y = fn(x); if (k) ctx.lineTo(f.X(x), f.Y(y)); else ctx.moveTo(f.X(x), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
}
const dot = (ctx, x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };

/** p(h): o: { h (m), marks: [[h, nom]], hover (km) } */
export function drawAlt(ctx, st, o) {
  const c = st.colors, xMax = 12;
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax: 110, xTicks: ticks(0, xMax, st.w < 480 ? 4 : 12).values, yTicks: [0, 20, 40, 60, 80, 100], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "p, kPa", xUnit: "h, km" });
  last = { ...f, xMin: 0, xMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  curve(ctx, f, 0, 3.2, (km) => (P.P0 - ((km * 1000) / 12) * P.MMHG) / 1000, c.text3, 1.8, [6, 4], 20);
  curve(ctx, f, 0, xMax, (km) => P.isa(km * 1000).p / 1000, c.primary, 2.6);
  for (const [hm] of o.marks) { const x = f.X(hm / 1000); ctx.strokeStyle = c.grid; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  if (st.w >= 520) for (const [hm, name] of o.marks) tag(ctx, name, f.X(hm / 1000) + 3, r.y + r.h - 14, { color: c.text2, bg: c.bg2, font: "600 10px Inter, system-ui, sans-serif", pad: 4 });
  const p = P.isa(o.h).p / 1000;
  ctx.strokeStyle = c.warning; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(f.X(o.h / 1000), f.Y(0)); ctx.lineTo(f.X(o.h / 1000), f.Y(p)); ctx.lineTo(r.x, f.Y(p)); ctx.stroke(); ctx.setLineDash([]);
  dot(ctx, f.X(o.h / 1000), f.Y(p), 6, c.warning);
  legend(ctx, [{ color: c.primary, label: st.w < 480 ? "p(h)" : "Standart atmosfera p(h)" }, { color: c.text3, label: st.w < 480 ? "12 m/mm" : "har 12 m da 1 mm sim. ust. (faqat Yer yaqinida)", dash: [6, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover != null) { const km = Math.max(0, Math.min(xMax, o.hover)), s = P.isa(km * 1000); hoverLine(ctx, f, f.X(km), [`h = ${fmt(km * 1000, 0)} m`, `p = ${fmt(s.p / 1000, 1)} kPa = ${fmt(s.p / P.MMHG, 0)} mm sim. ust.`, `t = ${fmt(s.T - 273.15, 1)} °C, ρ = ${fmt(s.rho, 3)} kg/m³`, `suv ${fmt(P.boilingPoint(s.p), 1)} °C da qaynaydi`], c); }
}

/** Magdeburg: F(n): o: { V, Vp, pMin, Rad, n, pull (N), hover } */
export function drawPump(ctx, st, o) {
  const c = st.colors, nMax = 40, Fmax = P.pullForce(0, o.Rad), big = Fmax > 5000, k = big ? 1000 : 1, unit = big ? "kN" : "N";
  const yMax = Math.max(Fmax, o.pull) * 1.12 / k;
  const f = frame(ctx, st, { xMin: 0, xMax: nMax, yMin: 0, yMax, xTicks: ticks(0, nMax, st.w < 480 ? 4 : 8).values, yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: `F, ${unit}`, xUnit: "yurish" });
  last = { ...f, xMin: 0, xMax: nMax };
  const r = f.rect, F = (n) => P.pullForce(P.pumped(n, o.V, o.Vp, P.P0, o.pMin), o.Rad) / k;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  curve(ctx, f, 0, nMax, () => Fmax / k, c.text3, 1.2, [3, 4], 2);
  curve(ctx, f, 0, nMax, () => o.pull / k, c.success, 2.2, [6, 4], 2);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.6; ctx.beginPath();
  for (let n = 0; n <= nMax; n++) { const x = f.X(n), y = f.Y(F(n)); if (n) { ctx.lineTo(x, f.Y(F(n - 1))); ctx.lineTo(x, y); } else ctx.moveTo(x, y); }
  ctx.stroke();
  ctx.restore();
  const nn = Math.min(o.n, nMax); dot(ctx, f.X(nn), f.Y(F(nn)), 6, c.warning);
  legend(ctx, [{ color: c.primary, label: st.w < 480 ? "kerakli F" : "ajratish uchun kerakli kuch F = Δp·πR²" }, { color: c.success, label: st.w < 480 ? "tortish" : "tortuvchilar kuchi", dash: [6, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover != null) { const n = Math.round(Math.max(0, Math.min(nMax, o.hover))), p = P.pumped(n, o.V, o.Vp, P.P0, o.pMin); hoverLine(ctx, f, f.X(n), [`${n} ta yurish`, `ichida p = ${fmt(p / 1000, 1)} kPa`, `F = ${fmt(F(n), big ? 1 : 0)} ${unit}`], c); }
}
