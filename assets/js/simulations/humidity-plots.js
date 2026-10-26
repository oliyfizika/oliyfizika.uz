// ==========================================================================
// Havo namligi — grafiklar (simulations/humidity.html):
// pₛ(t) to'yingan bug' bosimi egri chizig'i va holat nuqtasi (shudring nuqtasiga gorizontal proyeksiya);
// sutkalik t(τ) va t_d(τ) — shudring/tuman davrlari bo'yalgan. Kursor bilan qiymat o'qish.
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./humidity-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}

/** pₛ(t): o: { t, p (Pa), td, hover (°C) } — bosim kPa da */
export function drawSat(ctx, st, o) {
  const c = st.colors, xMin = -10, xMax = 40, yMax = 8;
  const xt = ticks(xMin, xMax, st.w < 480 ? 5 : 10), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "p, kPa", xUnit: "t, °C" });
  last = { ...f, xMin, xMax };
  const r = f.rect, kP = (t) => P.pSat(t) / 1000;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  // to'yinmagan soha (egri chiziq ostida) va o'ta to'yingan (ustida)
  ctx.fillStyle = c.dark ? "rgba(96,165,250,0.10)" : "rgba(37,99,235,0.07)";
  ctx.beginPath(); ctx.moveTo(f.X(xMin), f.Y(0)); for (let k = 0; k <= 200; k++) { const t = xMin + ((xMax - xMin) * k) / 200; ctx.lineTo(f.X(t), f.Y(kP(t))); } ctx.lineTo(f.X(xMax), f.Y(0)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.6; ctx.beginPath();
  for (let k = 0; k <= 200; k++) { const t = xMin + ((xMax - xMin) * k) / 200; if (k) ctx.lineTo(f.X(t), f.Y(kP(t))); else ctx.moveTo(f.X(t), f.Y(kP(t))); }
  ctx.stroke();
  // holat nuqtasi → shudring nuqtasi
  const pk = o.p / 1000;
  ctx.strokeStyle = c.success; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(f.X(o.t), f.Y(pk)); ctx.lineTo(f.X(o.td), f.Y(pk)); ctx.lineTo(f.X(o.td), f.Y(0)); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.beginPath(); ctx.moveTo(f.X(o.t), f.Y(pk)); ctx.lineTo(f.X(o.t), f.Y(kP(o.t))); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  ctx.fillStyle = c.success; ctx.beginPath(); ctx.arc(f.X(o.td), f.Y(pk), 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(o.t), f.Y(pk), 6, 0, Math.PI * 2); ctx.fill();
  if (st.w >= 420) {
    tag(ctx, `t_d = ${fmt(o.td, 1)} °C`, f.X(o.td), Math.min(f.Y(pk) + 10, r.y + r.h - 22), { color: c.success, bg: c.bg2, align: "center", font: FONT });
  }
  legend(ctx, [{ color: c.primary, label: st.w < 480 ? "pₛ(t)" : "To‘yingan bug‘ bosimi pₛ(t)" }, { color: c.success, label: st.w < 480 ? "→ t_d" : "p = const → shudring nuqtasi", dash: [5, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) {
    const t = o.hover; hoverLine(ctx, f, f.X(t), [`t = ${fmt(t, 1)} °C`, `pₛ = ${fmt(kP(t), 3)} kPa`, `ρₛ = ${fmt(P.rhoSat(t), 2)} g/m³`, `φ = ${fmt((o.p / P.pSat(t)) * 100, 0)} % (shu p da)`], c);
  }
}

/** Sutkalik egri chiziqlar: o: { tMin, tMax, W, wind, tau, hover (soat) } */
export function drawDay(ctx, st, o) {
  const c = st.colors, N = 240, T = [], D = [], S = [];
  for (let k = 0; k <= N; k++) { const h = (24 * k) / N, t = P.dayTemp(h, o.tMin, o.tMax), s = P.phenomenon(t, o.W, o.wind); T.push(t); D.push(s.td); S.push(s); }
  const lo = Math.floor(Math.min(...T, ...D) - 2), hi = Math.ceil(Math.max(...T) + 2);
  const xt = { values: [0, 3, 6, 9, 12, 15, 18, 21, 24] }, yt = ticks(lo, hi, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: 24, yMin: lo, yMax: hi, xTicks: st.w < 480 ? [0, 6, 12, 18, 24] : xt.values, yTicks: yt.values, fmtX: (v) => `${v}`, fmtY: (v) => fmt(v, 0), yLabel: "t, °C", xUnit: "soat" });
  last = { ...f, xMin: 0, xMax: 24 };
  const r = f.rect, X = (k) => f.X((24 * k) / N);
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  // shudring/qirov/tuman davrlari
  for (let k = 0; k < N; k++) {
    const s = S[k]; if (!(s.dew || s.frost)) continue;
    ctx.fillStyle = s.fog ? (c.dark ? "rgba(148,163,184,0.28)" : "rgba(100,116,139,0.18)") : s.frost ? "rgba(125,211,252,0.22)" : "rgba(34,197,94,0.16)";
    ctx.fillRect(X(k), r.y, X(k + 1) - X(k) + 0.5, r.h);
  }
  const line = (arr, color, w, dash) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); arr.forEach((v, k) => (k ? ctx.lineTo(X(k), f.Y(v)) : ctx.moveTo(X(k), f.Y(v)))); ctx.stroke(); ctx.setLineDash([]); };
  line(T, c.danger, 2.6);
  line(D, c.success, 2, [6, 4]);
  if (lo < 0 && hi > 0) { ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r.x, f.Y(0)); ctx.lineTo(r.x + r.w, f.Y(0)); ctx.stroke(); }
  ctx.restore();
  const tNow = P.dayTemp(o.tau, o.tMin, o.tMax), sNow = P.phenomenon(tNow, o.W, o.wind);
  ctx.strokeStyle = c.warning; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f.X(o.tau) + 0.5, r.y); ctx.lineTo(f.X(o.tau) + 0.5, r.y + r.h); ctx.stroke();
  ctx.fillStyle = c.danger; ctx.beginPath(); ctx.arc(f.X(o.tau), f.Y(tNow), 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c.success; ctx.beginPath(); ctx.arc(f.X(o.tau), f.Y(sNow.td), 4.5, 0, Math.PI * 2); ctx.fill();
  legend(ctx, [{ color: c.danger, label: st.w < 480 ? "t" : "Havo temperaturasi t" }, { color: c.success, label: st.w < 480 ? "t_d" : "Shudring nuqtasi t_d", dash: [6, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) {
    const h = Math.max(0, Math.min(24, o.hover)), t = P.dayTemp(h, o.tMin, o.tMax), s = P.phenomenon(t, o.W, o.wind);
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60) % 60;
    hoverLine(ctx, f, f.X(h), [`${String(hh % 24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, `t = ${fmt(t, 1)} °C, t_d = ${fmt(s.td, 1)} °C`, `φ = ${fmt(s.phi * 100, 0)} %`], c);
  }
}
