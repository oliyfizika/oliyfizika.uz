// ==========================================================================
// Maxsus nisbiylik — grafiklar (simulations/relativity.html):
// γ(v/c) — vaqt sekinlashishi va uzunlik qisqarishi; myuonlar ulushi N/N₀(h) — klassik va nisbiylik;
// tezliklarni qo'shish u(u'); Bertozzi: v/c (K) — klassik va relyativistik, o'lchangan nuqtalar. Kursor bilan qiymat o'qish.
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./relativity-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
function curve(ctx, f, x0, x1, fn, color, w, dash, n = 300) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath();
  for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n, y = fn(x); if (k) ctx.lineTo(f.X(x), f.Y(y)); else ctx.moveTo(f.X(x), f.Y(y)); }
  ctx.stroke(); ctx.setLineDash([]);
}
const dot = (ctx, x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
const clip = (ctx, r) => { ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); };

/** γ(β): o: { b, hover } */
export function drawGamma(ctx, st, o) {
  const c = st.colors, yMax = 8;
  const f = frame(ctx, st, { xMin: 0, xMax: 1, yMin: 0, yMax, xTicks: ticks(0, 1, st.w < 480 ? 4 : 10).values, yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 0), yLabel: "γ = Δt/Δt₀ = L₀/L", xUnit: "v/c" });
  last = { ...f, xMin: 0, xMax: 1 };
  const r = f.rect;
  clip(ctx, r);
  curve(ctx, f, 0, 0.9999, P.gamma, c.primary, 2.6);
  curve(ctx, f, 0, 1, () => 1, c.text3, 1.2, [5, 4], 2);
  ctx.strokeStyle = c.danger; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(f.X(1), r.y); ctx.lineTo(f.X(1), r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  const g = P.gamma(o.b);
  ctx.strokeStyle = c.warning; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(f.X(o.b), f.Y(0)); ctx.lineTo(f.X(o.b), f.Y(g)); ctx.lineTo(r.x, f.Y(g)); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  if (g <= yMax) dot(ctx, f.X(o.b), f.Y(g), 6, c.warning);
  legend(ctx, [{ color: c.primary, label: st.w < 480 ? "γ(v)" : "Lorens omili γ = 1/√(1 − v²/c²)" }, { color: c.text3, label: st.w < 480 ? "klassik" : "klassik mexanika (γ = 1)", dash: [5, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover != null) { const b = Math.min(0.9999, Math.max(0, o.hover)), gg = P.gamma(b); hoverLine(ctx, f, f.X(b), [`v = ${fmt(b, 3)}c`, `γ = ${fmt(gg, 3)}`, `L/L₀ = ${fmt(1 / gg, 3)}`], c); }
}

/** Myuonlar: N/N₀ (h): o: { b, H, meas (0…1 yoki null), hover } */
export function drawMuon(ctx, st, o) {
  const c = st.colors, H = o.H;
  const f = frame(ctx, st, { xMin: 0, xMax: H, yMin: 0, yMax: 1.12, xTicks: ticks(0, H, st.w < 480 ? 3 : 6).values, yTicks: [0, 0.25, 0.5, 0.75, 1], fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v * 100, 0), yLabel: "N/N₀, %", xUnit: "m" });
  last = { ...f, xMin: 0, xMax: H };
  const r = f.rect, rel = (h) => P.muonSurvival(h, o.b).frac, cl = (h) => P.muonSurvival(h, o.b, false).frac;
  clip(ctx, r);
  curve(ctx, f, 0, H, rel, c.success, 2.6);
  curve(ctx, f, 0, H, cl, c.danger, 2, [6, 4]);
  ctx.restore();
  dot(ctx, f.X(H), f.Y(rel(H)), 5, c.success); dot(ctx, f.X(H), f.Y(cl(H)), 5, c.danger);
  if (o.meas != null) { ctx.strokeStyle = c.warning; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.X(H) - 1, f.Y(o.meas), 7, 0, Math.PI * 2); ctx.stroke(); }
  legend(ctx, [{ color: c.success, label: st.w < 480 ? "nisbiylik" : "nisbiylik: t₀ = t/γ" }, { color: c.danger, label: st.w < 480 ? "klassik" : "klassik: vaqt sekinlashmasa", dash: [6, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover != null) { const h = Math.max(0, Math.min(H, o.hover)); hoverLine(ctx, f, f.X(h), [`h = ${fmt(h, 0)} m`, `nisbiylik: ${fmt(rel(h) * 100, 1)} %`, `klassik: ${fmt(cl(h) * 100, 1)} %`], c); }
}

/** Tezliklarni qo'shish: u(u'): o: { v, u, hover } */
export function drawAdd(ctx, st, o) {
  const c = st.colors, yMax = 2;
  const f = frame(ctx, st, { xMin: 0, xMax: 1, yMin: 0, yMax, xTicks: ticks(0, 1, st.w < 480 ? 4 : 10).values, yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 1), yLabel: "u/c (Yerga nisbatan)", xUnit: "u′/c" });
  last = { ...f, xMin: 0, xMax: 1 };
  const r = f.rect;
  clip(ctx, r);
  ctx.fillStyle = c.dark ? "rgba(248,113,113,0.08)" : "rgba(220,38,38,0.06)"; ctx.fillRect(r.x, r.y, r.w, f.Y(1) - r.y);
  curve(ctx, f, 0, 1, () => 1, c.danger, 1.4, [3, 4], 2);
  curve(ctx, f, 0, 1, (u) => P.addGal(o.v, u), c.text3, 2, [6, 4]);
  curve(ctx, f, 0, 1, (u) => P.addVel(o.v, u), c.primary, 2.6);
  ctx.restore();
  dot(ctx, f.X(o.u), f.Y(P.addGal(o.v, o.u)), 4.5, c.text3);
  dot(ctx, f.X(o.u), f.Y(P.addVel(o.v, o.u)), 6, c.warning);
  tag(ctx, "c — yorug‘lik tezligi", r.x + r.w - 4, f.Y(1) - 13, { color: c.danger, bg: c.bg2, align: "right", font: FONT });
  legend(ctx, [{ color: c.primary, label: st.w < 480 ? "Eynshteyn" : "u = (v + u′)/(1 + vu′/c²)" }, { color: c.text3, label: st.w < 480 ? "Galiley" : "Galiley: u = v + u′", dash: [6, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover != null) { const u = Math.max(0, Math.min(1, o.hover)); hoverLine(ctx, f, f.X(u), [`u′ = ${fmt(u, 2)}c, v = ${fmt(o.v, 2)}c`, `u = ${fmt(P.addVel(o.v, u), 4)}c`, `Galiley: ${fmt(P.addGal(o.v, u), 2)}c`], c); }
}

/** Bertozzi: v/c (K), K — log o'qda: o: { E0, K, lo, hi, pts: [{K, b}], hover (log10 K) } */
export function drawBert(ctx, st, o) {
  const c = st.colors, lo = o.lo, hi = o.hi, yMax = 1.4;
  const xt = []; for (let k = Math.ceil(lo); k <= Math.floor(hi); k++) xt.push(k);
  const fx = (v) => { const x = 10 ** v; return x >= 1000 ? `${fmt(x / 1000, 0)}·10³` : fmt(x, x < 1 ? (x < 0.1 ? 2 : 1) : 0); };
  const f = frame(ctx, st, { xMin: lo, xMax: hi, yMin: 0, yMax, xTicks: xt, yTicks: [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4], fmtX: fx, fmtY: (v) => fmt(v, 1), yLabel: "v/c", xUnit: "MeV" });
  last = { ...f, xMin: lo, xMax: hi };
  const r = f.rect, E0 = o.E0;
  clip(ctx, r);
  ctx.fillStyle = c.dark ? "rgba(248,113,113,0.08)" : "rgba(220,38,38,0.06)"; ctx.fillRect(r.x, r.y, r.w, f.Y(1) - r.y);
  curve(ctx, f, lo, hi, () => 1, c.danger, 1.4, [3, 4], 2);
  curve(ctx, f, lo, hi, (L) => P.particle(10 ** L, E0).bCl, c.text3, 2, [6, 4]);
  curve(ctx, f, lo, hi, (L) => P.particle(10 ** L, E0).b, c.primary, 2.6);
  // m₀c² belgisi
  const lE = Math.log10(E0); if (lE > lo && lE < hi) { ctx.strokeStyle = c.special; ctx.lineWidth = 1; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(f.X(lE), r.y); ctx.lineTo(f.X(lE), r.y + r.h); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  if (lE > lo && lE < hi && st.w >= 420) tag(ctx, "K = m₀c²", f.X(lE) + 4, r.y + r.h - 14, { color: c.special, bg: c.bg2, font: FONT });
  for (const p of o.pts) { ctx.strokeStyle = c.warning; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.X(Math.log10(p.K)), f.Y(p.b), 5, 0, Math.PI * 2); ctx.stroke(); }
  const s = P.particle(o.K, E0), lk = Math.log10(o.K);
  dot(ctx, f.X(lk), f.Y(s.b), 6, c.warning);
  if (s.bCl <= yMax) dot(ctx, f.X(lk), f.Y(s.bCl), 4.5, c.text3);
  legend(ctx, [{ color: c.primary, label: st.w < 480 ? "nisbiylik" : "nisbiylik: v = c√(1 − 1/γ²)" }, { color: c.text3, label: st.w < 480 ? "klassik" : "klassik: v = √(2K/m₀)", dash: [6, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover != null) { const L = Math.max(lo, Math.min(hi, o.hover)), q = P.particle(10 ** L, E0); hoverLine(ctx, f, f.X(L), [`K = ${fmt(10 ** L, 10 ** L < 1 ? 3 : 1)} MeV`, `v = ${fmt(q.b, 4)}c, m = ${fmt(q.g, 2)}m₀`, `klassik: ${fmt(q.bCl, 2)}c`], c); }
}
