// ==========================================================================
// Magnit maydon grafiklari: B(r), F(I), F(α), relsdagi harakat, M(φ), ω(τ).
// ==========================================================================

import { frame, ticks, legend } from "./pendulum-plots.js";
import { fmt, tag, clamp } from "./sim-kit.js";
import { field, ampereForce, frameTorque } from "./magnet-physics.js";

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const small = "600 11px Inter, system-ui, sans-serif";
const dec = (step) => (step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3);
function clipTo(ctx, r) { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); }
function message(ctx, stage, text) {
  const { w, h, colors: c } = stage;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = c.text3; ctx.font = "500 13px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);
}
function axes(stage, xMin, xMax, yMin, yMax, nx = 6, ny = 4) {
  const xt = ticks(xMin, xMax, stage.w < 480 ? Math.min(4, nx) : nx), yt = ticks(yMin, yMax, stage.h < 220 ? 3 : ny);
  return { xt, yt, xMin: Math.min(xMin, xt.values[0]), xMax: Math.max(xMax, xt.values[xt.values.length - 1]), yMin: Math.min(yMin, yt.values[0]), yMax: Math.max(yMax, yt.values[yt.values.length - 1]) };
}
function curve(ctx, f, fn, x0, x1, color, width = 2.25, dash = null, n = 160) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath();
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = fn(x); if (i === 0) ctx.moveTo(f.X(x), f.Y(y)); else ctx.lineTo(f.X(x), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
}

/** B(r): manbadan o'ngga (x o'qi bo'ylab) masofa bo'yicha |B|. */
export function drawProfileB(ctx, stage, d) {
  const c = stage.colors;
  if (!d.src || !d.cmp) return message(ctx, stage, "Stolga manba (magnit, tok yoki g‘altak) qo‘ying");
  const r0 = d.src.type === "wire" ? 0.005 : d.src.type === "magnet" ? d.src.len / 2 + 0.005 : d.src.len / 2 + 0.005;
  const ang = d.src.type === "wire" ? 0 : d.src.angle;
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const r = r0 + (0.15 * i) / 120;
    const [bx, by] = field(d.cmp, d.src.x + Math.cos(ang) * r, d.src.y + Math.sin(ang) * r);
    pts.push([r, Math.hypot(bx, by)]);
  }
  const bmax = Math.max(...pts.map((p) => p[1]));
  const useMT = bmax >= 2e-3, k = useMT ? 1e3 : 1e6;
  const a = axes(stage, 0, (r0 + 0.15) * 100, 0, bmax * k * 1.08);
  const f = frame(ctx, stage, { xMin: 0, xMax: a.xMax, yMin: 0, yMax: a.yMax, xTicks: a.xt.values, yTicks: a.yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(a.yt.step)), xUnit: "cm", yLabel: useMT ? "B, mT" : "B, μT" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath();
  pts.forEach(([r, b], i) => { const x = f.X(r * 100), y = f.Y(b * k); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke(); ctx.restore();
  const label = d.src.type === "wire" ? "to‘g‘ri tok o‘qidan" : d.src.type === "magnet" ? "magnit markazidan (N tomonga)" : "g‘altak markazidan (o‘q bo‘ylab)";
  legend(ctx, [{ color: c.primary, label: `|B|, ${label}` }], f.padL + 56, 9, c);
}

/** F(I): nazariy chiziq va o'lchov nuqtalari. */
export function drawFI(ctx, stage, d) {
  const c = stage.colors;
  const Fk = (I) => ampereForce(d.B, I, d.l, d.alpha * DEG) * 1000;
  const yMax = Math.max(Math.abs(Fk(10)), ...d.pts.map((p) => Math.abs(p.F * 1000)), 1) * 1.1;
  const a = axes(stage, -10, 10, -yMax, yMax);
  const f = frame(ctx, stage, { xMin: -10, xMax: 10, yMin: a.yMin, yMax: a.yMax, xTicks: a.xt.values, yTicks: a.yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(a.yt.step)), xUnit: "A", yLabel: "F, mN" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, Fk, -10, 10, c.primary, 2.25, [6, 5], 2);
  ctx.fillStyle = c.success; d.pts.forEach((p) => { ctx.beginPath(); ctx.arc(f.X(p.I), f.Y(p.F * 1000), 4.5, 0, TAU); ctx.fill(); });
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(d.I), f.Y(d.Fnow * 1000), 6, 0, TAU); ctx.fill();
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: `F = BIl·sinα (B = ${fmt(d.B, 2)} T)`, dash: [6, 5] }, { color: c.success, label: "o‘lchov: mg·tgθ" }], f.padL + 56, 9, c);
}

export function drawFAlpha(ctx, stage, d) {
  const c = stage.colors;
  const Fk = (a) => ampereForce(d.B, Math.abs(d.I), d.l, a * DEG) * 1000;
  const yMax = Math.max(Fk(90), 1) * 1.12;
  const a = axes(stage, 0, 90, 0, yMax);
  const f = frame(ctx, stage, { xMin: 0, xMax: 90, yMin: 0, yMax: a.yMax, xTicks: [0, 15, 30, 45, 60, 75, 90], yTicks: a.yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(a.yt.step)), xUnit: "°", yLabel: "F, mN" });
  ctx.save(); clipTo(ctx, f.rect); curve(ctx, f, Fk, 0, 90, c.primary, 2.5);
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(d.alpha), f.Y(Fk(d.alpha)), 6, 0, TAU); ctx.fill(); ctx.restore();
  legend(ctx, [{ color: c.primary, label: "F = BIl·sinα" }], f.padL + 56, 9, c);
}

export function drawRail(ctx, stage, d) {
  const c = stage.colors, h = d.hist;
  if (h.length < 2) return message(ctx, stage, "Tok bilan o‘tkazgich harakatlansa, grafik shu yerda chiziladi");
  const tMax = Math.max(h[h.length - 1].t, 1);
  const xMax = Math.max(...h.map((p) => p.x * 100), 1);
  const a = axes(stage, 0, tMax, 0, xMax * 1.1);
  const f = frame(ctx, stage, { xMin: 0, xMax: a.xMax, yMin: 0, yMax: a.yMax, xTicks: a.xt.values, yTicks: a.yt.values, fmtX: (v) => fmt(v, dec(a.xt.step)), fmtY: (v) => fmt(v, dec(a.yt.step)), xUnit: "s", yLabel: "s, cm" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.warning; ctx.lineWidth = 2.5; ctx.beginPath(); h.forEach((p, i) => { const x = f.X(p.t), y = f.Y(p.x * 100); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
  ctx.restore();
  legend(ctx, [{ color: c.warning, label: "ko‘chish s(τ) — tekis tezlanuvchan" }], f.padL + 56, 9, c);
}

export function drawTorque(ctx, stage, d) {
  const c = stage.colors;
  const Mk = (deg) => { const ph = deg * DEG; const I = d.commutator ? d.I * (Math.sin(ph) >= 0 ? 1 : -1) : d.I; return frameTorque(d.N, d.B, I, d.S, ph) * 1000; };
  const Mmax = Math.max(d.N * d.B * d.I * d.S * 1000, 0.1);
  const a = axes(stage, 0, 360, -Mmax * 1.15, Mmax * 1.15);
  const f = frame(ctx, stage, { xMin: 0, xMax: 360, yMin: a.yMin, yMax: a.yMax, xTicks: [0, 90, 180, 270, 360], yTicks: a.yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, dec(a.yt.step)), xUnit: "°", yLabel: "M, mN·m" });
  ctx.save(); clipTo(ctx, f.rect);
  curve(ctx, f, Mk, 0, 360, c.primary, 2.5, null, 360);
  const deg = (((d.phi / DEG) % 360) + 360) % 360;
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(deg), f.Y(Mk(deg)), 6, 0, TAU); ctx.fill();
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: d.commutator ? "M = NBIS·|sinφ| (kollektor bilan)" : "M = NBIS·sinφ" }], f.padL + 56, 9, c);
}

export function drawOmega(ctx, stage, d) {
  const c = stage.colors, h = d.hist;
  if (h.length < 2) return message(ctx, stage, "Ma’lumot yig‘ilmoqda…");
  const t0 = h[0].t, tMax = Math.max(h[h.length - 1].t - t0, 2);
  const a = axes(stage, 0, tMax, 0, Math.max(...h.map((p) => p.w), 10) * 1.1);
  const f = frame(ctx, stage, { xMin: 0, xMax: a.xMax, yMin: 0, yMax: a.yMax, xTicks: a.xt.values, yTicks: a.yt.values, fmtX: (v) => fmt(v, dec(a.xt.step)), fmtY: (v) => fmt(v, 0), xUnit: "s", yLabel: "n, ayl/min" });
  ctx.save(); clipTo(ctx, f.rect);
  ctx.strokeStyle = c.warning; ctx.lineWidth = 2.5; ctx.beginPath(); h.forEach((p, i) => { const x = f.X(p.t - t0), y = f.Y(p.w); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
  ctx.restore();
  void tag; void clamp;
}
