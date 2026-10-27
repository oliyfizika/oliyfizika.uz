// ==========================================================================
// Qiya tekislik: ish va FIK — grafiklar (simulations/incline-efficiency.html):
// F(l) — oltin qoida: F = Ph/l giperbolasi, to'rtburchak yuzasi = bajarilgan ish;
// η(α) — turli μ uchun FIK, joriy nuqta va laboratoriyada o'lchangan nuqtalar. Kursor bilan qiymat o'qish.
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./incline-efficiency-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
const DEG = Math.PI / 180;
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

/** F(l): o: { Pw (N), h (m), l (m), mu, hover } */
export function drawRule(ctx, st, o) {
  const c = st.colors, xMax = 6, yMax = Math.ceil((o.Pw * 1.1) / 100) * 100;
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: ticks(0, xMax, 6).values, yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "F, N", xUnit: "l, m" });
  last = { ...f, xMin: 0, xMax };
  const r = f.rect, F = (l) => (l < o.h ? NaN : P.pullForce(o.Pw, Math.asin(o.h / l), o.mu));
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const Fl = F(o.l);
  ctx.fillStyle = c.primary; ctx.globalAlpha = 0.14; ctx.fillRect(f.X(0), f.Y(Fl), f.X(o.l) - f.X(0), f.Y(0) - f.Y(Fl)); ctx.globalAlpha = 1;
  if (o.mu > 0) curve(ctx, f, o.h, xMax, (l) => (o.Pw * o.h) / l, c.text3, 1.6, [6, 4]);
  curve(ctx, f, o.h, xMax, F, c.primary, 2.6);
  ctx.strokeStyle = c.warning; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(f.X(o.h), r.y); ctx.lineTo(f.X(o.h), r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  dot(ctx, f.X(o.l), f.Y(Fl), 6, c.warning);
  tag(ctx, `A = F·l = ${fmt(Fl * o.l, 0)} J`, f.X(o.l / 2), f.Y(Fl / 2), { color: c.primary, bg: c.bg2, align: "center", font: FONT });
  legend(ctx, [{ color: c.primary, label: st.w < 480 ? "F(l)" : o.mu > 0 ? `F = P(sin α + μ cos α), μ = ${fmt(o.mu, 2)}` : "F = Ph/l (ishqalanishsiz)" }, ...(o.mu > 0 ? [{ color: c.text3, label: st.w < 480 ? "μ = 0" : "ishqalanishsiz: Ph/l", dash: [6, 4] }] : []), { color: c.warning, label: st.w < 480 ? "l = h" : "l = h (tik ko‘tarish, F = P)", dash: [3, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover != null) { const l = Math.max(o.h, Math.min(xMax, o.hover)), Fh = F(l); hoverLine(ctx, f, f.X(l), [`l = ${fmt(l, 2)} m, α = ${fmt(Math.asin(o.h / l) / DEG, 1)}°`, `F = ${fmt(Fh, 0)} N`, `A = F·l = ${fmt(Fh * l, 0)} J`], c); }
}

/** η(α): o: { mu, a (rad), pts: [[α°, η]], hover (°) } */
export function drawEta(ctx, st, o) {
  const c = st.colors, xMax = 90;
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax: 100, xTicks: [0, 15, 30, 45, 60, 75, 90], yTicks: [0, 25, 50, 75, 100], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "η, %", xUnit: "α, °" });
  last = { ...f, xMin: 0, xMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (const m of [0.1, 0.2, 0.3, 0.5, 0.8]) if (Math.abs(m - o.mu) > 0.02) curve(ctx, f, 0, 90, (a) => 100 * P.efficiency(a * DEG, m), c.grid, 1.2, null, 120);
  curve(ctx, f, 0, 90, (a) => 100 * P.efficiency(a * DEG, o.mu), c.primary, 2.6);
  // o'z-o'zidan tormozlanish sohasi
  const aLock = Math.atan(o.mu) / DEG;
  ctx.fillStyle = c.danger; ctx.globalAlpha = 0.07; ctx.fillRect(f.X(0), r.y, f.X(aLock) - f.X(0), r.h); ctx.globalAlpha = 1;
  ctx.restore();
  if (st.w >= 480 && aLock > 4) tag(ctx, "o‘z-o‘zidan tormozlanadi", f.X(aLock / 2), r.y + r.h - 14, { color: c.danger, bg: c.bg2, align: "center", font: "600 10px Inter, system-ui, sans-serif", pad: 4 });
  for (const [a, e] of o.pts) { dot(ctx, f.X(a), f.Y(e), 5, c.success); ctx.strokeStyle = c.bg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.X(a), f.Y(e), 5, 0, Math.PI * 2); ctx.stroke(); }
  if (o.a != null) dot(ctx, f.X(o.a / DEG), f.Y(100 * P.efficiency(o.a, o.mu)), 6, c.warning);
  legend(ctx, [{ color: c.primary, label: `μ = ${fmt(o.mu, 2)}` }, { color: c.grid, label: st.w < 480 ? "boshqa μ" : "μ = 0,1; 0,2; 0,3; 0,5; 0,8" }, ...(o.pts.length ? [{ color: c.success, label: "o‘lchangan" }] : [])], f.padL + 10, r.y + 12, c);
  if (o.hover != null) { const a = Math.max(0.5, Math.min(90, o.hover)); hoverLine(ctx, f, f.X(a), [`α = ${fmt(a, 1)}°`, `η = ${fmt(100 * P.efficiency(a * DEG, o.mu), 1)} %`, `kuchdan yutuq P/F = ${fmt(P.gain(1, a * DEG, o.mu), 2)}`], c); }
}
