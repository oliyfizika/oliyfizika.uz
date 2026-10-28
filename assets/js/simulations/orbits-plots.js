// ==========================================================================
// Orbitalar va kosmik tezliklar — grafiklar (simulations/orbits.html):
// Nyuton to'pi: otilgan jismlarning balandligi h(t); sun'iy yo'ldosh: doiraviy orbita tezligi v(h)
// (XKS, GPS, geostatsionar belgilari). Kursor bilan qiymat o'qish.
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./orbits-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
const dot = (ctx, x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
const niceMax = (v) => { const e = 10 ** Math.floor(Math.log10(v)), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; };

/** h(t): o: { p, shots: [{ pts: [[x, y, t]], color, v, tNow }], hover (min) } */
export function drawHeights(ctx, st, o) {
  const c = st.colors, R = o.p.R;
  let tMax = 10, hMax = 200;
  for (const s of o.shots) { const n = s.pts.length; if (!n) continue; tMax = Math.max(tMax, s.pts[n - 1][2] / 60); for (const q of s.pts) hMax = Math.max(hMax, Math.hypot(q[0], q[1]) - R); }
  tMax = niceMax(tMax); hMax = niceMax(Math.min(hMax, 6 * R) * 1.05);
  const f = frame(ctx, st, { xMin: 0, xMax: tMax, yMin: 0, yMax: hMax, xTicks: ticks(0, tMax, st.w < 480 ? 4 : 6).values, yTicks: ticks(0, hMax, 4).values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "h, km", xUnit: "t, min" });
  last = { ...f, xMin: 0, xMax: tMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (const s of o.shots) {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2.2; ctx.beginPath(); let first = true;
    for (const q of s.pts) { if (q[2] > s.tNow) break; const x = f.X(q[2] / 60), y = f.Y(Math.min(hMax * 1.2, Math.hypot(q[0], q[1]) - R)); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  if (o.shots.length) legend(ctx, o.shots.slice(-5).map((s) => ({ color: s.color, label: `${fmt(s.v, 2)} km/s` })), f.padL + 10, r.y + 12, c);
  if (o.hover != null) {
    const t = Math.max(0, Math.min(tMax, o.hover)) * 60, lines = [`t = ${fmt(t / 60, 1)} min`];
    for (const s of o.shots.slice(-3)) { const q = s.pts.find((p) => p[2] >= t); if (q) lines.push(`${fmt(s.v, 2)} km/s: h = ${fmt(Math.hypot(q[0], q[1]) - R, 0)} km`); }
    hoverLine(ctx, f, f.X(t / 60), lines, c);
  }
}

/** v(h): o: { p, h, marks: [[h, nom]], hover (km) } */
export function drawSpeed(ctx, st, o) {
  const c = st.colors, p = o.p, xMax = 40000, yMax = 10;
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: ticks(0, xMax, st.w < 480 ? 4 : 8).values, yTicks: [0, 2, 4, 6, 8, 10], fmtX: (v) => fmt(v / 1000, 0), fmtY: (v) => fmt(v, 0), yLabel: "v, km/s", xUnit: "h, ming km" });
  last = { ...f, xMin: 0, xMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (const [hm] of o.marks) if (hm <= xMax) { const x = f.X(hm); ctx.strokeStyle = c.grid; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); ctx.setLineDash([]); }
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.beginPath();
  for (let k = 0; k <= 240; k++) { const hh = (xMax * k) / 240, x = f.X(hh), y = f.Y(P.v2(p, hh)); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.6; ctx.beginPath();
  for (let k = 0; k <= 240; k++) { const hh = (xMax * k) / 240, x = f.X(hh), y = f.Y(P.v1(p, hh)); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke();
  ctx.restore();
  if (st.w >= 520) for (const [hm, name] of o.marks) if (hm <= xMax) tag(ctx, name, f.X(hm) + 3, r.y + r.h - 14, { color: c.text2, bg: c.bg2, font: "600 10px Inter, system-ui, sans-serif", pad: 4 });
  if (o.h <= xMax) dot(ctx, f.X(o.h), f.Y(P.v1(p, o.h)), 6, c.warning);
  legend(ctx, [{ color: c.primary, label: st.w < 480 ? "v₁(h)" : "doiraviy orbita tezligi v = √(GM/r)" }, { color: c.text3, label: st.w < 480 ? "v₂(h)" : "uzoqlashib ketish tezligi √2·v", dash: [6, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover != null) { const hh = Math.max(0, Math.min(xMax, o.hover)), T = P.period(p, hh); hoverLine(ctx, f, f.X(hh), [`h = ${fmt(hh, 0)} km`, `v = ${fmt(P.v1(p, hh), 2)} km/s`, `T = ${T < 7200 ? `${fmt(T / 60, 1)} min` : `${fmt(T / 3600, 2)} soat`}`], c); }
}
