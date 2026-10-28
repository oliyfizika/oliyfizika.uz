// ==========================================================================
// Lazer — grafik (simulations/laser.html): sathlardagi atomlar ulushi va lazer nuri quvvati vaqt bo'yicha.
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;

/** o: { hist: [{ t, up, low, beam }], span, col (lazer rangi), lowName, hover (t) } */
export function drawHistory(ctx, st, o) {
  const c = st.colors, h = o.hist, tEnd = h.length ? h[h.length - 1].t : 0, tMin = Math.max(0, tEnd - o.span), tMax = tMin + o.span;
  let yMax = 1; for (const q of h) if (q.t >= tMin) yMax = Math.max(yMax, q.beam * 1.1);
  yMax = Math.ceil(yMax * 4) / 4;
  const f = frame(ctx, st, { xMin: tMin, xMax: tMax, yMin: 0, yMax, xTicks: ticks(tMin, tMax, st.w < 480 ? 4 : 6).values, yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 2), yLabel: "ulush", xUnit: "t (shartli)" });
  last = { ...f, xMin: tMin, xMax: tMax };
  const r = f.rect, pts = h.filter((q) => q.t >= tMin);
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  if (pts.length > 1) {
    ctx.fillStyle = o.col + "40"; ctx.beginPath(); ctx.moveTo(f.X(pts[0].t), f.Y(0));
    for (const q of pts) ctx.lineTo(f.X(q.t), f.Y(q.beam)); ctx.lineTo(f.X(pts[pts.length - 1].t), f.Y(0)); ctx.closePath(); ctx.fill();
    const line = (key, col, wdt, dash) => { ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.setLineDash(dash || []); ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(f.X(q.t), f.Y(q[key])) : ctx.moveTo(f.X(q.t), f.Y(q[key])))); ctx.stroke(); ctx.setLineDash([]); };
    line("beam", o.col, 1.2);
    line("low", c.text3, 2, [6, 4]);
    line("up", c.warning, 2.4);
  }
  ctx.restore();
  legend(ctx, [{ color: c.warning, label: st.w < 480 ? "N₂/N" : "yuqori sath N₂/N" }, { color: c.text3, label: st.w < 480 ? "N₁/N" : `${o.lowName} N₁/N`, dash: [6, 4] }, { color: o.col, label: st.w < 480 ? "nur" : "lazer nuri (nisbiy quvvat)" }], f.padL + 10, r.y + 12, c);
  if (o.hover != null && pts.length) {
    const q = pts.reduce((b, p) => (Math.abs(p.t - o.hover) < Math.abs(b.t - o.hover) ? p : b), pts[0]), px = f.X(q.t);
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
    const lines = [`t = ${fmt(q.t, 1)}`, `N₂/N = ${fmt(q.up, 2)}`, `N₁/N = ${fmt(q.low, 2)}`, `nur: ${fmt(q.beam, 2)}`];
    ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
    lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 40 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
  }
}
