// ==========================================================================
// Termodinamika — grafiklar (simulations/thermo.html): p–V va T–S diagrammalari (jarayon yo'li, ish yuzasi,
// issiqlik ishorasi bo'yicha rang, yo'nalish strelkalari, suriladigan tugunlar), dvigatel uchun p(θ).
// ==========================================================================

import { fmt, tag, clamp } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;

/** Chegaralarni yaxlit qilib kengaytirish. */
export function niceRange(lo, hi, pad = 0.08, floor0 = true) {
  const d = (hi - lo) || Math.abs(hi) || 1; let a = lo - d * pad, b = hi + d * pad;
  if (floor0) a = Math.max(0, a);
  const t = ticks(a, b, 5).step; return [Math.floor(a / t) * t, Math.ceil(b / t) * t];
}

/** Tarmoq rangi: issiqlik olinsa qizil, berilsa ko'k, adiabata kulrang. */
export const legColor = (c, leg) => (leg.type === "Q0" || (leg.Qp < 1e-6 && leg.Qm < 1e-6) ? c.text3 : leg.Qp >= leg.Qm ? c.danger : c.primary);

function arrowHead(ctx, x0, y0, x1, y1, col) {
  const a = Math.atan2(y1 - y0, x1 - x0), s = 7;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - s * Math.cos(a - 0.45), y1 - s * Math.sin(a - 0.45)); ctx.lineTo(x1 - s * Math.cos(a + 0.45), y1 - s * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

/**
 * Diagramma. o: { xKey: "V" | "S", yKey: "p" | "T", xLabel, yLabel, xUnit, range: [x0, x1, y0, y1],
 *   legs: [{ pts, type, Qp, Qm, xs?, ys? }], fill: "under" | "cycle" | null, fillSign, point: {x, y}, nodes: [{x, y}],
 *   hover: {x, y} | null, hoverText: (x, y) => string[], ghost: [{x, y}] (izoterma/adiabata yordamchi chiziqlari) }
 */
export function drawDiagram(ctx, st, o) {
  const c = st.colors, [x0, x1, y0, y1] = o.range;
  const xt = ticks(x0, x1, st.w < 480 ? 4 : 6), yt = ticks(y0, y1, 4);
  const f = frame(ctx, st, { xMin: x0, xMax: x1, yMin: y0, yMax: y1, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, xt.step < 1 ? 1 : 0), fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: o.yLabel, xUnit: o.xUnit });
  last = { ...f, range: o.range };
  const r = f.rect, P = (q) => [f.X(q.x), f.Y(q.y)];
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  // yordamchi chiziqlar
  for (const gl of o.guides || []) {
    ctx.strokeStyle = gl.color || c.text3; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ctx.beginPath();
    gl.pts.forEach((q, i) => { const [px, py] = P(q); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  // yuza
  const all = o.legs.flatMap((l) => l.xy);
  if (o.fill === "cycle" && all.length) {
    ctx.fillStyle = o.fillSign >= 0 ? (c.dark ? "rgba(52,211,153,0.20)" : "rgba(22,163,74,0.14)") : (c.dark ? "rgba(248,113,113,0.2)" : "rgba(220,38,38,0.12)");
    ctx.beginPath(); all.forEach((q, i) => { const [px, py] = P(q); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.closePath(); ctx.fill();
  } else if (o.fill === "under" && all.length) {
    ctx.fillStyle = o.fillSign >= 0 ? (c.dark ? "rgba(52,211,153,0.20)" : "rgba(22,163,74,0.14)") : (c.dark ? "rgba(248,113,113,0.2)" : "rgba(220,38,38,0.12)");
    ctx.beginPath(); ctx.moveTo(f.X(all[0].x), f.Y(Math.max(y0, 0)));
    all.forEach((q) => { const [px, py] = P(q); ctx.lineTo(px, py); }); ctx.lineTo(f.X(all[all.length - 1].x), f.Y(Math.max(y0, 0))); ctx.closePath(); ctx.fill();
  }
  // tarmoqlar
  for (const l of o.legs) {
    const col = legColor(c, l); ctx.strokeStyle = col; ctx.lineWidth = l.width || 3; ctx.lineJoin = "round"; ctx.setLineDash(l.dash || []);
    ctx.beginPath(); l.xy.forEach((q, i) => { const [px, py] = P(q); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.setLineDash([]);
    if (l.xy.length > 4 && !l.noArrow) { const m = Math.floor(l.xy.length * 0.55), [ax, ay] = P(l.xy[m - 2]), [bx, by] = P(l.xy[m]); if (Math.hypot(bx - ax, by - ay) > 0.5) arrowHead(ctx, ax, ay, bx, by, col); }
  }
  ctx.restore();
  // tugunlar
  for (const n of o.nodes || []) {
    const [px, py] = P(n);
    ctx.fillStyle = c.bg; ctx.strokeStyle = n.drag ? c.primary : c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, n.drag ? 7 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (n.label) { ctx.font = "700 11px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(n.label, px + 7, py - 5); }
  }
  if (o.point) { const [px, py] = P(o.point); ctx.fillStyle = c.warning; ctx.strokeStyle = c.bg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  if (o.hover) {
    const px = f.X(o.hover.x), py = f.Y(o.hover.y);
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.moveTo(r.x, py + 0.5); ctx.lineTo(r.x + r.w, py + 0.5); ctx.stroke(); ctx.setLineDash([]);
    const lines = o.hoverText(o.hover.x, o.hover.y); ctx.font = FONT;
    const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
    lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, clamp(py - 30, r.y + 12, r.y + r.h - 12 - 24 * (lines.length - 1)) + i * 24, { color: c.text, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
  }
  if (o.legend) legend(ctx, o.legend, f.padL + 10, r.y + 14, c);
}

/** Dvigatel: p(θ), θ = 0…720°. o: { eng, theta, hover } */
export function drawPTheta(ctx, st, o) {
  const c = st.colors, e = o.eng, pMax = Math.max(...e.nodes.map((n) => n.p)) / 100, [y0, y1] = niceRange(0, pMax, 0.08);
  const f = frame(ctx, st, { xMin: 0, xMax: 720, yMin: y0, yMax: y1, xTicks: [0, 180, 360, 540, 720], yTicks: ticks(y0, y1, 4).values, fmtX: (v) => `${fmt(v, 0)}°`, fmtY: (v) => fmt(v, 0), yLabel: "p, bar", xUnit: "" });
  last = { ...f, range: [0, 720, y0, y1] };
  const r = f.rect, names = ["so‘rish", "siqish", "ishchi yo‘l", "chiqarish"];
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  names.forEach((n, k) => { ctx.fillStyle = k % 2 ? (c.dark ? "rgba(148,163,184,0.06)" : "rgba(148,163,184,0.08)") : "transparent"; ctx.fillRect(f.X(k * 180), r.y, f.X(180) - f.X(0), r.h); ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(n, f.X(k * 180 + 90), r.y + 6); });
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let i = 0; i <= 720; i++) { const s = e.state((i * Math.PI) / 180), y = f.Y(s.p / 100); if (i) ctx.lineTo(f.X(i), y); else ctx.moveTo(f.X(i), y); }
  ctx.stroke(); ctx.restore();
  const s = e.state(o.theta), th = (s.theta * 180) / Math.PI;
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(th), f.Y(s.p / 100), 6, 0, Math.PI * 2); ctx.fill();
  if (o.hover) { const t = clamp(o.hover.x, 0, 720), q = e.state((t * Math.PI) / 180), px = f.X(t); ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px, r.y); ctx.lineTo(px, r.y + r.h); ctx.stroke(); ctx.setLineDash([]); tag(ctx, `θ = ${fmt(t, 0)}°: p = ${fmt(q.p / 100, 1)} bar, T = ${fmt(q.T, 0)} K`, clamp(px + 10, r.x, r.x + r.w - 220), r.y + 30, { color: c.text, bg: c.bg2, font: FONT }); }
}
