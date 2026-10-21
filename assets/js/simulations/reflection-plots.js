// ==========================================================================
// Qaytish va sinish grafiklari: β(α), Frenel R(α), lab sin α – sin β, plastinkada siljish Δ(α),
// prizmada og'ish δ(α), optik tolada uzatish T(α), ikki ko'zgudagi tasvirlar soni N(φ), sferik ko'zgu f(d), Γ(d).
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, tag } from "./sim-kit.js";
import * as P from "./reflection-physics.js";

const TAU = Math.PI * 2;
const D = P.DEG;
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
function curve(ctx, f, fn, x0, x1, color, w = 2.5, n = 300, dash = null) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath();
  let pen = false;
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = fn(x); if (!Number.isFinite(y) || Math.abs(y) > 1e4) { pen = false; continue; } if (!pen) { ctx.moveTo(f.X(x), f.Y(y)); pen = true; } else ctx.lineTo(f.X(x), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
}
const dot = (ctx, f, x, y, color, r = 6) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), r, 0, TAU); ctx.fill(); };
function vline(ctx, f, x, color, dash = [4, 4]) { ctx.strokeStyle = color; ctx.lineWidth = 1.25; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(f.X(x), f.rect.y); ctx.lineTo(f.X(x), f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]); }
const small = "600 10px Inter, system-ui, sans-serif";
const A90 = { xMin: 0, xMax: 90, xTicks: [0, 15, 30, 45, 60, 75, 90], fmtX: (v) => `${fmt(v, 0)}°` };

/** β(α) chegarada. */
export function drawBetaAlpha(ctx, st, { n1, n2, alpha }) {
  const c = st.colors;
  const f = frame(ctx, st, { ...A90, yMin: 0, yMax: 90, yTicks: [0, 30, 60, 90], fmtY: (v) => `${fmt(v, 0)}°`, yLabel: "β" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, (x) => x, 0, 90, c.text3, 1.25, 2, [5, 5]);
  curve(ctx, f, (a) => { const r = P.snell(n1, n2, a); return r.tir ? NaN : r.beta / D; }, 0, 90, c.primary, 2.5, 400);
  const r = P.snell(n1, n2, alpha);
  if (r.critical !== null) vline(ctx, f, r.critical / D, c.danger);
  if (!r.tir) dot(ctx, f, alpha, r.beta / D, c.warning);
  ctx.restore();
  const items = [{ color: c.primary, label: `n₁ = ${fmt(n1)}, n₂ = ${fmt(n2)}` }, { color: c.text3, label: "β = α (sinmasa)", dash: [5, 5] }];
  if (r.critical !== null) items.push({ color: c.danger, label: `α_kr = ${fmt(r.critical / D, 1)}°`, dash: [4, 4] });
  legend(ctx, items, f.padL + 56, 9, c);
}

/** Frenel: qaytgan ulush R(α), Rs va Rp. */
export function drawFresnel(ctx, st, { n1, n2, alpha }) {
  const c = st.colors;
  const f = frame(ctx, st, { ...A90, yMin: 0, yMax: 100, yTicks: [0, 25, 50, 75, 100], fmtY: (v) => fmt(v, 0), yLabel: "R, %" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, (a) => P.snell(n1, n2, a).Rs * 100, 0, 89.9, "#8b5cf6", 1.5, 400, [6, 4]);
  curve(ctx, f, (a) => P.snell(n1, n2, a).Rp * 100, 0, 89.9, "#14b8a6", 1.5, 400, [2, 3]);
  curve(ctx, f, (a) => P.snell(n1, n2, a).R * 100, 0, 89.9, c.primary, 2.5, 400);
  const B = P.brewster(n1, n2), r = P.snell(n1, n2, alpha);
  vline(ctx, f, B, "#14b8a6", [3, 4]);
  dot(ctx, f, alpha, r.R * 100, c.warning);
  ctx.restore();
  tag(ctx, `Bryuster ${fmt(B, 1)}°`, f.X(B) + 4, f.rect.y + f.rect.h - 14, { color: "#14b8a6", bg: c.bg, font: small });
  legend(ctx, [{ color: c.primary, label: "R (qutblanmagan)" }, { color: "#8b5cf6", label: "R⊥ (s)", dash: [6, 4] }, { color: "#14b8a6", label: "R∥ (p)", dash: [2, 3] }], f.padL + 56, 9, c);
}

/** Lab: x = sin(shishadagi burchak), y = sin(havodagi burchak); og'ish = n. */
export function drawLab(ctx, st, { pts, n, hidden }) {
  const c = st.colors;
  const f = frame(ctx, st, { xMin: 0, xMax: 1, yMin: 0, yMax: 1, xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1], yTicks: [0, 0.25, 0.5, 0.75, 1], fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 2), xUnit: "sin β", yLabel: "sin α" });
  ctx.save(); clipTo(ctx, f.rect);
  if (!hidden) curve(ctx, f, (x) => n * x, 0, 1, c.text3, 1.5, 2, [6, 5]);
  let nm = null;
  if (pts.length) {
    const sxy = pts.reduce((a, p) => a + p.sg * p.sa, 0), sxx = pts.reduce((a, p) => a + p.sg * p.sg, 0);
    nm = sxy / sxx;
    curve(ctx, f, (x) => nm * x, 0, 1, c.success, 2, 2);
    pts.forEach((p) => dot(ctx, f, p.sg, p.sa, c.success, 5));
  }
  ctx.restore();
  const items = [];
  if (!hidden) items.push({ color: c.text3, label: `nazariy: sin α = ${fmt(n, 2)}·sin β`, dash: [6, 5] });
  items.push({ color: c.success, label: nm ? `o‘lchov: n ≈ ${fmt(nm, 3)} (${pts.length} ta)` : "o‘lchovlar yo‘q — «O‘lchovni yozish»" });
  legend(ctx, items, f.padL + 56, 9, c);
  return nm;
}

/** Plastinkada nurning siljishi Δ(α). */
export function drawShift(ctx, st, { t, n, alpha }) {
  const c = st.colors;
  const yMax = Math.max(1, t * 1.05);
  const yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { ...A90, yMin: 0, yMax: yt.values[yt.values.length - 1], yTicks: yt.values, fmtY: (v) => fmt(v, dec(yt.step)), yLabel: "Δ, cm" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, (a) => P.slabShift(t, n, a), 0, 89.9, c.primary, 2.5, 300);
  dot(ctx, f, alpha, P.slabShift(t, n, alpha), c.warning);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: `Δ = t·sin(α−β)/cos β, t = ${fmt(t, 1)} cm` }], f.padL + 56, 9, c);
}

/** Prizmada og'ish δ(α). */
export function drawDeviation(ctx, st, { A, n, alpha }) {
  const c = st.colors;
  const pts = [];
  for (let a = 0; a <= 90; a += 0.25) { const r = P.prismDeviation(A, n, a); if (!r.tir) pts.push([a, r.delta]); }
  const yMax = pts.length ? Math.max(...pts.map((p) => p[1])) : 60;
  const yt = ticks(0, Math.max(30, yMax * 1.05), 4);
  const f = frame(ctx, st, { ...A90, yMin: 0, yMax: yt.values[yt.values.length - 1], yTicks: yt.values, fmtY: (v) => `${fmt(v, 0)}°`, yLabel: "δ" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, (a) => { const r = P.prismDeviation(A, n, a); return r.tir ? NaN : r.delta; }, 0, 90, c.primary, 2.5, 360);
  const mn = P.prismMinDeviation(A, n);
  if (mn) { ctx.strokeStyle = c.success; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.25; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(mn.delta)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(mn.delta)); ctx.stroke(); ctx.setLineDash([]); }
  const r = P.prismDeviation(A, n, alpha); if (!r.tir) dot(ctx, f, alpha, r.delta, c.warning);
  ctx.restore();
  const items = [{ color: c.primary, label: `A = ${fmt(A, 0)}°, n = ${fmt(n, 2)}` }];
  if (mn) items.push({ color: c.success, label: `δ_min = ${fmt(mn.delta, 1)}° (α = ${fmt(mn.alpha, 1)}°)`, dash: [4, 4] });
  legend(ctx, items, f.padL + 56, 9, c);
  if (pts.length && pts[0][0] > 0.5) tag(ctx, "to‘liq ichki qaytish", f.X(pts[0][0] / 2), f.rect.y + f.rect.h - 14, { color: c.danger, bg: c.bg, align: "center", font: small });
}

/** Optik tola: chiqish uchiga yetgan energiya ulushi T(α). fn(α) → ulush (0…1). */
export function drawFiberT(ctx, st, { fn, alpha, accept }) {
  const c = st.colors;
  const f = frame(ctx, st, { ...A90, yMin: 0, yMax: 100, yTicks: [0, 25, 50, 75, 100], fmtY: (v) => fmt(v, 0), yLabel: "uzatish, %" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, (a) => fn(a) * 100, 0, 89, c.primary, 2.5, 120);
  if (accept < 89.9) vline(ctx, f, accept, c.danger);
  dot(ctx, f, alpha, fn(alpha) * 100, c.warning);
  ctx.restore();
  const items = [{ color: c.primary, label: "chiqish uchiga yetgan yorug‘lik" }];
  if (accept < 89.9) items.push({ color: c.danger, label: `qabul burchagi ${fmt(accept, 1)}°`, dash: [4, 4] });
  legend(ctx, items, f.padL + 56, 9, c);
}

/** Ikki ko'zgu: tasvirlar soni N(φ). */
export function drawImages(ctx, st, { phi, count }) {
  const c = st.colors;
  const f = frame(ctx, st, { xMin: 20, xMax: 180, yMin: 0, yMax: 18, xTicks: [30, 60, 90, 120, 150, 180], yTicks: [0, 3, 6, 9, 12, 15, 18], fmtX: (v) => `${fmt(v, 0)}°`, fmtY: (v) => fmt(v, 0), yLabel: "N" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, (x) => 360 / x - 1, 20, 180, c.text3, 1.5, 300, [5, 4]);
  // bissektrisadagi buyum uchun hisoblangan son (pog'onali)
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath();
  let prev = null;
  for (let x = 20; x <= 180; x += 0.25) {
    const N = P.twoMirrorImages(x, { x: Math.cos((x * D) / 2), y: Math.sin((x * D) / 2) }).length;
    if (prev === null) ctx.moveTo(f.X(x), f.Y(N)); else if (N !== prev) { ctx.lineTo(f.X(x), f.Y(prev)); ctx.lineTo(f.X(x), f.Y(N)); } else ctx.lineTo(f.X(x), f.Y(N));
    prev = N;
  }
  ctx.stroke();
  [30, 36, 40, 45, 60, 72, 90, 120, 180].forEach((x) => dot(ctx, f, x, 360 / x - 1, c.text2, 3.5));
  dot(ctx, f, phi, count, c.warning);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: "hisob (buyum bissektrisada)" }, { color: c.text3, label: "N = 360°/φ − 1", dash: [5, 4] }], f.padL + 56, 9, c);
}

/** Yassi ko'zgu: tasvirgacha masofa d′ = d. */
export function drawPlane(ctx, st, { d }) {
  const c = st.colors;
  const f = frame(ctx, st, { xMin: 0, xMax: 14, yMin: 0, yMax: 14, xTicks: [0, 2, 4, 6, 8, 10, 12, 14], yTicks: [0, 7, 14], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "cm", yLabel: "d′, cm" });
  ctx.save(); clipTo(ctx, f.rect); curve(ctx, f, (x) => x, 0, 14, c.primary, 2.5, 2); dot(ctx, f, d, d, c.warning); ctx.restore();
  legend(ctx, [{ color: c.primary, label: "d′ = d — tasvir ko‘zgu orqasida, xuddi shunday masofada" }], f.padL + 56, 9, c);
}

/** Sferik ko'zgu: f(d) yoki Γ(d). */
export function drawMirrorFD(ctx, st, { R, d, gamma }) {
  const c = st.colors, F = R / 2;
  const f = gamma
    ? frame(ctx, st, { xMin: 0, xMax: 40, yMin: 0, yMax: 5, xTicks: [0, 10, 20, 30, 40], yTicks: [0, 1, 2, 3, 4, 5], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "cm", yLabel: "Γ" })
    : frame(ctx, st, { xMin: 0, xMax: 40, yMin: -40, yMax: 40, xTicks: [0, 10, 20, 30, 40], yTicks: [-40, -20, 0, 20, 40], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "cm", yLabel: "f, cm" });
  ctx.save(); clipTo(ctx, f.rect);
  if (F > 0) vline(ctx, f, F, c.text3);
  if (gamma) { ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(1)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(1)); ctx.stroke(); ctx.setLineDash([]); }
  curve(ctx, f, (x) => { const r = P.sphericalMirror(R, x); return r.inf ? NaN : gamma ? Math.abs(r.m) : r.f; }, 0.2, 40, c.primary, 2.5, 400);
  const r = P.sphericalMirror(R, d);
  if (!r.inf) { const y = gamma ? Math.abs(r.m) : r.f; if (Math.abs(y) < (gamma ? 5 : 40)) dot(ctx, f, d, y, c.warning); }
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: gamma ? "Γ = |f/d|" : `${R > 0 ? "botiq" : "qavariq"}: F = ${fmt(F, 1)} cm (f < 0 — mavhum)` }], f.padL + 56, 9, c);
  if (F > 0) tag(ctx, "d = F", f.X(F) + 4, f.rect.y + 12, { color: c.text3, bg: c.bg, font: small });
}
