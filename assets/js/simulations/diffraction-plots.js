// ==========================================================================
// Interferensiya va difraksiya grafiklari: ekrandagi intensivlik I(y) (rangli), o'lcham egri chiziqlari,
// panjara lab: sin φ — k.
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt } from "./sim-kit.js";

const TAU = Math.PI * 2;
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
const dot = (ctx, f, x, y, color, r = 6) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), r, 0, TAU); ctx.fill(); };
const rgbCss = (c, a = 1) => `rgba(${Math.round(255 * Math.min(1, c[0]))},${Math.round(255 * Math.min(1, c[1]))},${Math.round(255 * Math.min(1, c[2]))},${a})`;

/**
 * Ekrandagi intensivlik. sample(Y) → { I (0…1+), rgb }, Y metrda; Ymax — yarim kenglik (m). unit — "mm" yoki "cm".
 * env(Y) — ixtiyoriy o'rovchi (punktir). marker — Y yoki null.
 */
export function drawProfile(ctx, st, { sample, Ymax, unit, env, marker, label }) {
  const c = st.colors, k = unit === "cm" ? 100 : 1000;
  const xt = ticks(-Ymax * k, Ymax * k, 6);
  const f = frame(ctx, st, { xMin: -Ymax * k, xMax: Ymax * k, yMin: 0, yMax: 1.12, xTicks: xt.values, yTicks: [0, 0.5, 1], fmtX: (v) => fmt(v, dec(xt.step)), fmtY: (v) => fmt(v, 1), xUnit: unit, yLabel: "I/I₀" });
  ctx.save(); clipTo(ctx, f.rect);
  const n = Math.max(200, Math.round(f.rect.w));
  const ys = [];
  for (let i = 0; i <= n; i++) { const Y = -Ymax + (2 * Ymax * i) / n, s = sample(Y); ys.push([Y, s.I]); ctx.fillStyle = rgbCss(s.rgb, 0.55); const x0 = f.X(Y * k), x1 = f.X((Y + (2 * Ymax) / n) * k); ctx.fillRect(x0, f.Y(Math.min(1.12, s.I)), Math.max(1, x1 - x0 + 0.5), f.Y(0) - f.Y(Math.min(1.12, s.I))); }
  if (env) { ctx.strokeStyle = c.text3; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]); ctx.beginPath(); for (let i = 0; i <= n; i++) { const Y = -Ymax + (2 * Ymax * i) / n, v = env(Y); i ? ctx.lineTo(f.X(Y * k), f.Y(v)) : ctx.moveTo(f.X(Y * k), f.Y(v)); } ctx.stroke(); ctx.setLineDash([]); }
  ctx.strokeStyle = c.text; ctx.lineWidth = 1.8; ctx.beginPath(); ys.forEach(([Y, I], i) => (i ? ctx.lineTo(f.X(Y * k), f.Y(Math.min(1.12, I))) : ctx.moveTo(f.X(Y * k), f.Y(Math.min(1.12, I))))); ctx.stroke();
  if (marker !== null && marker !== undefined) { ctx.strokeStyle = c.danger; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f.X(marker * k), f.rect.y); ctx.lineTo(f.X(marker * k), f.rect.y + f.rect.h); ctx.stroke(); }
  ctx.restore();
  const items = [{ color: c.text, label: label || "intensivlik" }];
  if (env) items.push({ color: c.text3, label: "bitta tirqish o‘rovchisi", dash: [5, 4] });
  legend(ctx, items, f.padL + 56, 9, c);
}

/** Umumiy egri chiziq: fn(x), joriy nuqta. */
export function drawCurve(ctx, st, { fn, x0, x1, cur, xUnit, yLabel, fmtX = (v) => fmt(v, 2), yScale = 1, label }) {
  const c = st.colors;
  let m = 0; for (let i = 0; i <= 200; i++) m = Math.max(m, fn(x0 + ((x1 - x0) * i) / 200) * yScale);
  const yt = ticks(0, m * 1.05, 4), top = yt.values[yt.values.length - 1];
  const xt = ticks(x0, x1, 6);
  const f = frame(ctx, st, { xMin: x0, xMax: x1, yMin: 0, yMax: top, xTicks: xt.values.filter((v) => v >= x0 - 1e-12), yTicks: yt.values, fmtX, fmtY: (v) => fmt(v, dec(yt.step)), xUnit, yLabel });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let i = 0; i <= 300; i++) { const x = x0 + ((x1 - x0) * i) / 300, y = fn(x) * yScale; i ? ctx.lineTo(f.X(x), f.Y(y)) : ctx.moveTo(f.X(x), f.Y(y)); }
  ctx.stroke(); dot(ctx, f, cur, fn(cur) * yScale, c.warning); ctx.restore();
  legend(ctx, [{ color: c.primary, label }], f.padL + 56, 9, c);
}

/** Lab: k — sin φ, og'ish λ/d. */
export function drawLab(ctx, st, { pts, lamTrue, d, hidden, kMax }) {
  const c = st.colors, km = Math.max(2, kMax);
  const f = frame(ctx, st, { xMin: -km - 0.5, xMax: km + 0.5, yMin: -1, yMax: 1, xTicks: Array.from({ length: 2 * km + 1 }, (_, i) => i - km), yTicks: [-1, -0.5, 0, 0.5, 1], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 1), xUnit: "k", yLabel: "sin φ" });
  ctx.save(); clipTo(ctx, f.rect);
  if (!hidden) { ctx.strokeStyle = c.text3; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(f.X(-km - 0.5), f.Y((-km - 0.5) * lamTrue / d)); ctx.lineTo(f.X(km + 0.5), f.Y((km + 0.5) * lamTrue / d)); ctx.stroke(); ctx.setLineDash([]); }
  let lam = null;
  if (pts.length) {
    const sxy = pts.reduce((a, p) => a + p.k * p.s, 0), sxx = pts.reduce((a, p) => a + p.k * p.k, 0), m = sxy / sxx; lam = m * d;
    ctx.strokeStyle = c.success; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.X(-km - 0.5), f.Y((-km - 0.5) * m)); ctx.lineTo(f.X(km + 0.5), f.Y((km + 0.5) * m)); ctx.stroke();
    pts.forEach((p) => dot(ctx, f, p.k, p.s, c.success, 5));
  }
  ctx.restore();
  const items = [];
  if (!hidden) items.push({ color: c.text3, label: `nazariy: sin φ = kλ/d, λ = ${fmt(lamTrue * 1e9, 0)} nm`, dash: [6, 5] });
  items.push({ color: c.success, label: lam ? `o‘lchov: λ = d·sin φ/k ≈ ${fmt(lam * 1e9, 0)} nm (${pts.length} ta)` : "o‘lchovlar yo‘q — markerni yorug‘ dog‘ga qo‘ying" });
  legend(ctx, items, f.padL + 56, 9, c);
}
