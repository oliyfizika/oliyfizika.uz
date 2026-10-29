// ==========================================================================
// Aylana bo'ylab harakat grafiklari:
// kinematika — x(t), y(t); v(t), a(t); a(R) · ip — F(v), F(t) · burilish — v_max(R), f(v) ·
// halqa — N(θ), energiya · uzatmalar — n₂(R₂), aylanishlar soni N(t).
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, tag } from "./sim-kit.js";
import * as P from "./circular-physics.js";

const TAU = Math.PI * 2;
const small = "600 10px Inter, system-ui, sans-serif";
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
function curve(ctx, f, fn, x0, x1, color, w = 2.5, n = 300, dash = null) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); let pen = false;
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = fn(x); if (!Number.isFinite(y)) { pen = false; continue; } if (!pen) { ctx.moveTo(f.X(x), f.Y(y)); pen = true; } else ctx.lineTo(f.X(x), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
}
function series(ctx, f, pts, get, color, dash = null, w = 2.4) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(f.X(p.t), f.Y(get(p))) : ctx.moveTo(f.X(p.t), f.Y(get(p)))));
  ctx.stroke(); ctx.setLineDash([]);
}
const dot = (ctx, f, x, y, color, r = 6) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), r, 0, TAU); ctx.fill(); };
/** 0 dan m gacha "chiroyli" shkala; top ≥ m (ma'lumot kesilmaydi). */
const nice = (m, n = 4) => { const step = ticks(0, m, n).step, top = Math.ceil(m / step - 1e-9) * step, vals = []; for (let i = 0; i * step <= top + step * 1e-9; i++) vals.push(+(i * step).toFixed(10)); return { top, vals, step }; };
function niceStep(x) { const p = 10 ** Math.floor(Math.log10(x)), r = x / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p; }
function hline(ctx, f, y, color, dash = [5, 4]) { ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(y)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(y)); ctx.stroke(); ctx.setLineDash([]); }
const windowOf = (hist, span) => { const t1 = hist.length ? hist[hist.length - 1].t : 0, t0 = Math.max(0, t1 - span); return { t0, pts: hist.filter((p) => p.t >= t0) }; };
const timeAxis = (t0, span) => ({ xMin: t0, xMax: t0 + span, xTicks: ticks(t0, t0 + span, 6).values, fmtX: (v) => fmt(v, 1), xUnit: "s" });

/* ------------------------------------------------------------------ Kinematika */

export function drawXY(ctx, st, { hist, R, span }) {
  const c = st.colors, { t0, pts } = windowOf(hist, span), yt = nice(R * 100 * 1.1, 2);
  const f = frame(ctx, st, { ...timeAxis(t0, span), yMin: -yt.top, yMax: yt.top, yTicks: [-yt.top, 0, yt.top], fmtY: (v) => fmt(v, 0), yLabel: "cm" });
  ctx.save(); clipTo(ctx, f.rect);
  series(ctx, f, pts, (p) => p.x * 100, c.primary);
  series(ctx, f, pts, (p) => p.y * 100, c.danger, [6, 4]);
  ctx.restore();
  const narrow = st.w < 520;
  legend(ctx, [{ color: c.primary, label: narrow ? "x(t)" : "x(t) = R·cos φ" }, { color: c.danger, label: narrow ? "y(t)" : "y(t) = R·sin φ", dash: [6, 4] }], f.padL + 56, 9, c);
}

/* ------------------------------------------------------------------ Ipdagi sharcha */

export function drawFV(ctx, st, { m, R, Fmax, v }) {
  const c = st.colors, x1 = Math.max(P.breakSpeed(m, R, Fmax) * 1.4, v * 1.15, 1);
  const top = nice(Math.min(Math.max(Fmax * 1.6, P.tension(m, v, R) * 1.1), Fmax * 2.4));
  const f = frame(ctx, st, { xMin: 0, xMax: x1, yMin: 0, yMax: top.top, xTicks: ticks(0, x1, 6).values, yTicks: top.vals, fmtX: (x) => fmt(x, 1), fmtY: (x) => fmt(x, dec(top.step)), xUnit: "m/s", yLabel: "F, N" });
  ctx.save(); clipTo(ctx, f.rect);
  const vb = P.breakSpeed(m, R, Fmax);
  ctx.fillStyle = "rgba(239,68,68,0.08)"; ctx.fillRect(f.X(vb), f.rect.y, f.rect.x + f.rect.w - f.X(vb), f.rect.h);
  curve(ctx, f, (x) => P.tension(m, x, R), 0, x1, c.primary); hline(ctx, f, Fmax, c.danger);
  dot(ctx, f, v, P.tension(m, v, R), P.tension(m, v, R) > Fmax ? c.danger : c.warning);
  ctx.restore();
  if (f.X(vb) < f.rect.x + f.rect.w - 60) tag(ctx, `uziladi: v > ${fmt(vb, 2)} m/s`, f.rect.x + f.rect.w - 4, f.rect.y + f.rect.h - 14, { color: c.danger, bg: c.bg, align: "right", font: small });
  legend(ctx, [{ color: c.primary, label: "F = mv²/R" }, { color: c.danger, label: `F_max = ${fmt(Fmax, 1)} N`, dash: [5, 4] }], f.padL + 56, 9, c);
}

export function drawFT(ctx, st, { hist, Fmax, span }) {
  const c = st.colors, { t0, pts } = windowOf(hist, span);
  const top = nice(Math.max(Fmax * 1.35, ...pts.map((p) => p.F)) * 1.02);
  const f = frame(ctx, st, { ...timeAxis(t0, span), yMin: 0, yMax: top.top, yTicks: top.vals, fmtY: (v) => fmt(v, dec(top.step)), yLabel: "F, N" });
  ctx.save(); clipTo(ctx, f.rect); hline(ctx, f, Fmax, c.danger); series(ctx, f, pts, (p) => p.F, c.primary); ctx.restore();
  legend(ctx, [{ color: c.primary, label: "ip tarangligi F(t)" }, { color: c.danger, label: "F_max", dash: [5, 4] }], f.padL + 56, 9, c);
}

/* ------------------------------------------------------------------ Burilish */

export function drawVmax(ctx, st, { mu, alpha, R, v }) {
  const c = st.colors, x1 = 200, kmh = 3.6;
  const fn = (r) => P.carMax(mu, r, alpha) * kmh, fl = (r) => P.carMin(mu, r, alpha) * kmh;
  const yt = nice(Math.min(Math.max(fn(x1), v * kmh) * 1.05, 400));
  const f = frame(ctx, st, { xMin: 0, xMax: x1, yMin: 0, yMax: yt.top, xTicks: [0, 50, 100, 150, 200], yTicks: yt.vals, fmtX: (x) => fmt(x, 0), fmtY: (x) => fmt(x, 0), xUnit: "m", yLabel: "v, km/soat" });
  ctx.save(); clipTo(ctx, f.rect);
  const low = fl(x1) > 0.5;
  ctx.fillStyle = "rgba(34,197,94,0.10)"; ctx.beginPath();
  for (let i = 0; i <= 100; i++) { const r = 1 + ((x1 - 1) * i) / 100; const y = Math.min(fn(r), yt.top * 2); i ? ctx.lineTo(f.X(r), f.Y(y)) : ctx.moveTo(f.X(r), f.Y(y)); }
  for (let i = 100; i >= 0; i--) { const r = 1 + ((x1 - 1) * i) / 100; ctx.lineTo(f.X(r), f.Y(low ? fl(r) : 0)); }
  ctx.closePath(); ctx.fill();
  curve(ctx, f, fn, 1, x1, c.primary);
  if (low) curve(ctx, f, fl, 1, x1, c.warning, 2, 200);
  if (alpha > 0) curve(ctx, f, (r) => P.carIdeal(r, alpha) * kmh, 1, x1, c.success, 1.6, 200, [6, 4]);
  const b = P.carBounds(mu, alpha), a = (v * v) / R;
  dot(ctx, f, R, v * kmh, a > b.hi || a < b.lo ? c.danger : c.text);
  ctx.restore();
  const items = [{ color: c.primary, label: st.w < 520 ? "v_max" : `eng katta tezlik (μ = ${fmt(mu, 2)})` }];
  if (low) items.push({ color: c.warning, label: st.w < 520 ? "v_min" : "eng kichik tezlik" });
  if (alpha > 0) items.push({ color: c.success, label: st.w < 520 ? "ideal" : "ishqalanishsiz", dash: [6, 4] });
  legend(ctx, items, f.padL + 70, 9, c);
}

export function drawFric(ctx, st, { m, R, mu, alpha, v }) {
  const c = st.colors, x1 = 160, kmh = 3.6;
  const fr = (u) => P.carForces(m, u / kmh, R, alpha).f / 1000, fm = (u) => (mu * P.carForces(m, u / kmh, R, alpha).N) / 1000;
  const hi = Math.min(Math.max(fm(x1) * 1.4, fm(0) * 2.2, Math.abs(fr(v * kmh)) * 1.2), fm(x1) * 12), lo = alpha > 0 ? Math.min(fr(0), -fm(0)) * 1.15 : 0;
  const step = ticks(lo, hi, 5).step, yMin = Math.floor(lo / step - 1e-9) * step, yMax = Math.ceil(hi / step - 1e-9) * step;
  const yTicks = []; for (let y = yMin; y <= yMax + step * 1e-6; y += step) yTicks.push(+y.toFixed(10));
  const f = frame(ctx, st, { xMin: 0, xMax: x1, yMin, yMax, xTicks: [0, 40, 80, 120, 160], yTicks, fmtX: (x) => fmt(x, 0), fmtY: (x) => fmt(x, dec(step)), xUnit: "km/soat", yLabel: "f, kN" });
  const yt = { top: yMax };
  ctx.save(); clipTo(ctx, f.rect);
  ctx.fillStyle = "rgba(34,197,94,0.12)"; ctx.beginPath();
  for (let i = 0; i <= 160; i++) { const u = (x1 * i) / 160; i ? ctx.lineTo(f.X(u), f.Y(fm(u))) : ctx.moveTo(f.X(u), f.Y(fm(u))); }
  for (let i = 160; i >= 0; i--) { const u = (x1 * i) / 160; ctx.lineTo(f.X(u), f.Y(-fm(u))); }
  ctx.closePath(); ctx.fill();
  curve(ctx, f, fm, 0, x1, c.danger, 1.6, 160, [5, 4]); if (yMin < 0) curve(ctx, f, (u) => -fm(u), 0, x1, c.danger, 1.6, 160, [5, 4]);
  curve(ctx, f, fr, 0, x1, c.primary);
  const fv = fr(v * kmh), out = Math.abs(fv) > fm(v * kmh);
  dot(ctx, f, v * kmh, Math.max(yMin, Math.min(yt.top, fv)), out ? c.danger : c.text);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: st.w < 520 ? "kerakli f" : "kerakli ishqalanish kuchi f" }, { color: c.danger, label: "±μN", dash: [5, 4] }], f.padL + 40, 9, c);
}

/* ------------------------------------------------------------------ Vertikal halqa */

export function drawLoop(ctx, st, { h, R, th }) {
  const c = st.colors;
  const f = frame(ctx, st, { xMin: 0, xMax: 360, yMin: -2, yMax: 8, xTicks: [0, 90, 180, 270, 360], yTicks: [-2, 0, 2, 4, 6, 8], fmtX: (v) => `${fmt(v, 0)}°`, fmtY: (v) => fmt(v, 0), xUnit: "θ", yLabel: "N/mg" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.fillStyle = "rgba(239,68,68,0.08)"; ctx.fillRect(f.rect.x, f.Y(0), f.rect.w, f.Y(-2) - f.Y(0));
  hline(ctx, f, 0, c.danger, []);
  curve(ctx, f, (d) => { const s = P.loopAt(h, R, (d * Math.PI) / 180); return s.v2 < 0 ? NaN : s.n; }, 0, 360, c.primary, 2.5, 360);
  if (th !== null) { const s = P.loopAt(h, R, th); if (Number.isFinite(s.n)) dot(ctx, f, (th * 180) / Math.PI, s.n, c.warning); }
  ctx.restore();
  tag(ctx, "N < 0 — sharcha yo‘ldan ajraladi", f.rect.x + f.rect.w - 4, f.Y(-1), { color: c.danger, bg: c.bg, align: "right", font: small });
  legend(ctx, [{ color: c.primary, label: `N(θ), h = ${fmt(h / R, 2)}R` }], f.padL + 56, 9, c);
}

export function drawEnergy(ctx, st, { hist, span }) {
  const c = st.colors, { t0, pts } = windowOf(hist, span);
  const f = frame(ctx, st, { ...timeAxis(t0, span), yMin: 0, yMax: 110, yTicks: [0, 25, 50, 75, 100], fmtY: (v) => fmt(v, 0), yLabel: "E, %" });
  ctx.save(); clipTo(ctx, f.rect);
  series(ctx, f, pts, (p) => p.K * 100, c.primary); series(ctx, f, pts, (p) => p.U * 100, c.warning, [6, 4]); series(ctx, f, pts, (p) => (p.K + p.U) * 100, c.success, null, 1.8);
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: "kinetik" }, { color: c.warning, label: "potensial", dash: [6, 4] }, { color: c.success, label: "to‘liq" }], f.padL + 56, 9, c);
}

/* ------------------------------------------------------------------ Uzatmalar */

export function drawBelt(ctx, st, { R1, R2, n1 }) {
  const c = st.colors, x0 = 2, x1 = 20, fn = (r) => (n1 * R1) / r;
  const yt = nice(fn(x0) * 1.05);
  const f = frame(ctx, st, { xMin: 0, xMax: x1, yMin: 0, yMax: yt.top, xTicks: [0, 5, 10, 15, 20], yTicks: yt.vals, fmtX: (x) => fmt(x, 0), fmtY: (x) => fmt(x, dec(yt.step)), xUnit: "cm", yLabel: "n₂, ayl/s" });
  ctx.save(); clipTo(ctx, f.rect); curve(ctx, f, fn, x0, x1, c.primary); hline(ctx, f, n1, c.text3); dot(ctx, f, R2, fn(R2), c.warning); ctx.restore();
  tag(ctx, `n₁ = ${fmt(n1, 2)} ayl/s`, f.rect.x + f.rect.w - 4, f.Y(n1) - 12, { color: c.text2, bg: c.bg, align: "right", font: small });
  legend(ctx, [{ color: c.primary, label: st.w < 520 ? "n₂ = n₁R₁/R₂" : `n₂ = n₁·R₁/R₂ (R₁ = ${fmt(R1, 1)} cm)` }], f.padL + 56, 9, c);
}

export function drawTurns(ctx, st, { hist, span, n1, n2 }) {
  const c = st.colors, { t0, pts } = windowOf(hist, span);
  const b1 = pts.length ? pts[0].a1 : 0, b2 = pts.length ? pts[0].a2 : 0;
  const yt = nice(Math.max(1, Math.max(n1, n2) * span) * 1.02);
  const f = frame(ctx, st, { ...timeAxis(t0, span), yMin: 0, yMax: yt.top, yTicks: yt.vals, fmtY: (v) => fmt(v, dec(yt.step)), yLabel: "aylanishlar" });
  ctx.save(); clipTo(ctx, f.rect); series(ctx, f, pts, (p) => p.a1 - b1, c.primary); series(ctx, f, pts, (p) => p.a2 - b2, c.warning, [6, 4]); ctx.restore();
  legend(ctx, [{ color: c.primary, label: `1: n₁ = ${fmt(n1, 2)} ayl/s` }, { color: c.warning, label: `2: n₂ = ${fmt(n2, 2)} ayl/s`, dash: [6, 4] }], f.padL + 74, 9, c);
}
