// ==========================================================================
// To'lqinlar grafiklari: ip shakli y(x) va o'rovchi, nuqta tebranishi y(t), interferensiya (tebranishlarni qo'shish,
// amplituda taqsimoti), Doppler: f′(u) va kuzatuvchilardagi bosim p(t).
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt } from "./sim-kit.js";
import * as W from "./waves-physics.js";

const TAU = Math.PI * 2;
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
function poly(ctx, f, xs, ys, color, w = 2.5, dash = null) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath();
  let pen = false;
  for (let i = 0; i < xs.length; i++) { const y = ys[i]; if (!Number.isFinite(y)) { pen = false; continue; } if (!pen) { ctx.moveTo(f.X(xs[i]), f.Y(y)); pen = true; } else ctx.lineTo(f.X(xs[i]), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
}
function curve(ctx, f, fn, x0, x1, color, w = 2.5, n = 300, dash = null) { const xs = [], ys = []; for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; xs.push(x); ys.push(fn(x)); } poly(ctx, f, xs, ys, color, w, dash); }
const dot = (ctx, f, x, y, color, r = 6) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), r, 0, TAU); ctx.fill(); };
const symTicks = (m) => { const t = ticks(0, m, 2), top = t.values[t.values.length - 1]; return { top, vals: [-top, -top / 2, 0, top / 2, top], step: top / 2 }; };

/** Ip shakli: u (m), envelope (m); A — amplituda (m) o'q chegarasi uchun; L — uzunlik. */
export function drawShape(ctx, st, { u, env, L, A, probeX, nodes }) {
  const c = st.colors, n = u.length - 1;
  const m = Math.max(A * 100 * 2.2, 2), yt = symTicks(m);
  const f = frame(ctx, st, { xMin: 0, xMax: L, yMin: -yt.top, yMax: yt.top, xTicks: ticks(0, L, 8).values, yTicks: yt.vals, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: "m", yLabel: "y, cm" });
  ctx.save(); clipTo(ctx, f.rect);
  const xs = Array.from({ length: n + 1 }, (_, i) => (i * L) / n);
  if (env) { ctx.fillStyle = "rgba(37,99,235,0.08)"; ctx.beginPath(); xs.forEach((x, i) => (i ? ctx.lineTo(f.X(x), f.Y(env[i] * 100)) : ctx.moveTo(f.X(x), f.Y(env[i] * 100)))); for (let i = n; i >= 0; i--) ctx.lineTo(f.X(xs[i]), f.Y(-env[i] * 100)); ctx.closePath(); ctx.fill(); }
  (nodes || []).forEach((x) => { ctx.fillStyle = c.danger; ctx.beginPath(); ctx.arc(f.X(x), f.Y(0), 3.5, 0, TAU); ctx.fill(); });
  poly(ctx, f, xs, Array.from(u, (v) => v * 100), c.primary, 2.5);
  dot(ctx, f, probeX, (u[Math.round((probeX / L) * n)] || 0) * 100, c.danger, 5);
  ctx.restore();
  const items = [{ color: c.primary, label: "ipning shakli (shu on)" }];
  if (env) items.push({ color: "rgba(37,99,235,0.35)", label: "tebranish chegarasi" });
  if (nodes && nodes.length) items.push({ color: c.danger, label: "tugunlar" });
  legend(ctx, items, f.padL + 56, 9, c);
}

/** Nuqta tebranishi y(t): hist — [{t, y}] (y metrda). */
export function drawProbe(ctx, st, { hist, A, span = 6, T }) {
  const c = st.colors;
  const t1 = hist.length ? hist[hist.length - 1].t : 0, t0 = Math.max(0, t1 - span);
  const m = Math.max(A * 100 * 2.2, 2), yt = symTicks(m);
  const f = frame(ctx, st, { xMin: t0, xMax: t0 + span, yMin: -yt.top, yMax: yt.top, xTicks: ticks(t0, t0 + span, 6).values, yTicks: yt.vals, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, dec(yt.step)), xUnit: "s", yLabel: "y, cm" });
  ctx.save(); clipTo(ctx, f.rect);
  const pts = hist.filter((p) => p.t >= t0);
  poly(ctx, f, pts.map((p) => p.t), pts.map((p) => p.y * 100), c.danger, 2.2);
  ctx.restore();
  legend(ctx, [{ color: c.danger, label: T ? `belgilangan nuqta, T = ${fmt(T, 2)} s` : "belgilangan nuqta" }], f.padL + 56, 9, c);
}

/** Interferensiya: belgilangan nuqtada ikki to'lqin va ularning yig'indisi. a1, a2 — amplitudalar, p1, p2 — fazalar (k·r + φ), w — ω. */
export function drawSum(ctx, st, { a1, a2, p1, p2, w, t, two }) {
  const c = st.colors, span = (2 * TAU) / w * 1.5, t0 = t - span;
  const m = (a1 + (two ? a2 : 0)) * 1.15 || 1;
  const f = frame(ctx, st, { xMin: t0, xMax: t, yMin: -m, yMax: m, xTicks: ticks(t0, t, 5).values, yTicks: [-m, 0, m].map((v) => +v.toFixed(2)), fmtX: (v) => fmt(v, 2), fmtY: () => "", xUnit: "s", yLabel: "y" });
  ctx.save(); clipTo(ctx, f.rect);
  const y1 = (tt) => a1 * Math.cos(p1 - w * tt), y2 = (tt) => a2 * Math.cos(p2 - w * tt);
  curve(ctx, f, y1, t0, t, "#8b5cf6", 1.5, 300, [6, 4]);
  if (two) { curve(ctx, f, y2, t0, t, "#14b8a6", 1.5, 300, [2, 3]); curve(ctx, f, (tt) => y1(tt) + y2(tt), t0, t, c.primary, 2.8, 300); }
  ctx.restore();
  const items = [{ color: "#8b5cf6", label: "1-manbadan", dash: [6, 4] }];
  if (two) items.push({ color: "#14b8a6", label: "2-manbadan", dash: [2, 3] }, { color: c.primary, label: `yig‘indi: A = ${fmt(W.sumAmplitude(a1, a2, p1 - p2) / (a1 + a2), 2)}·(A₁+A₂)` });
  legend(ctx, items, f.padL + 56, 9, c);
}

/** Amplituda taqsimoti gorizontal chiziq bo'ylab. fn(x) → amplituda. */
export function drawAmpLine(ctx, st, { fn, x0, x1, probeX, yLine, maxA }) {
  const c = st.colors;
  const f = frame(ctx, st, { xMin: x0, xMax: x1, yMin: 0, yMax: maxA, xTicks: ticks(x0, x1, 6).values, yTicks: [0, maxA / 2, maxA], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v / maxA * 2, 1), xUnit: "cm", yLabel: "A/A₀" });
  ctx.save(); clipTo(ctx, f.rect); curve(ctx, f, fn, x0, x1, c.primary, 2.5, 500); dot(ctx, f, probeX, fn(probeX), c.danger, 5); ctx.restore();
  legend(ctx, [{ color: c.primary, label: `amplituda y = ${fmt(yLine, 0)} cm chiziq bo‘ylab` }], f.padL + 56, 9, c);
}

/** Doppler: f′ ning manba tezligiga bog'liqligi (o'q bo'ylab). */
export function drawDopplerF(ctx, st, { f0, M }) {
  const c = st.colors, x1 = 0.95;
  const fmax = f0 / (1 - x1);
  const yt = ticks(0, Math.min(fmax, f0 * 4), 4);
  const f = frame(ctx, st, { xMin: 0, xMax: x1, yMin: 0, yMax: yt.values[yt.values.length - 1], xTicks: [0, 0.2, 0.4, 0.6, 0.8], yTicks: yt.values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 0), xUnit: "u/c", yLabel: "f′, Hz" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, (m) => f0 / (1 - m), 0, x1, c.danger, 2.5); curve(ctx, f, (m) => f0 / (1 + m), 0, x1, c.primary, 2.5);
  curve(ctx, f, () => f0, 0, x1, c.text3, 1.2, 2, [4, 4]);
  if (M <= x1) { dot(ctx, f, M, f0 / (1 - M), c.danger); dot(ctx, f, M, f0 / (1 + M), c.primary); }
  ctx.restore();
  legend(ctx, [{ color: c.danger, label: "manba yaqinlashmoqda: f/(1 − u/c)" }, { color: c.primary, label: "uzoqlashmoqda: f/(1 + u/c)" }], f.padL + 56, 9, c);
}

/** Doppler: kuzatuvchilardagi bosim tebranishi. sA, sB — [{t, p}] (null — sukunat). */
export function drawPressure(ctx, st, { hA, hB, span }) {
  const c = st.colors;
  const t1 = Math.max(hA.length ? hA[hA.length - 1].t : 0, 1e-6), t0 = t1 - span;
  const f = frame(ctx, st, { xMin: t0 * 1000, xMax: t1 * 1000, yMin: -2.6, yMax: 2.6, xTicks: ticks(t0 * 1000, t1 * 1000, 5).values, yTicks: [-1, 1], fmtX: (v) => fmt(v, 0), fmtY: (v) => (v > 0 ? "A" : "B"), xUnit: "ms", yLabel: "p" });
  ctx.save(); clipTo(ctx, f.rect);
  const draw = (h, off, col) => { const pts = h.filter((p) => p.t >= t0); poly(ctx, f, pts.map((p) => p.t * 1000), pts.map((p) => (p.p === null ? NaN : off + 0.9 * p.p)), col, 1.8); };
  draw(hA, 1.2, c.danger); draw(hB, -1.2, c.primary);
  ctx.restore();
  legend(ctx, [{ color: c.danger, label: "A kuzatuvchi" }, { color: c.primary, label: "B kuzatuvchi" }], f.padL + 56, 9, c);
}
