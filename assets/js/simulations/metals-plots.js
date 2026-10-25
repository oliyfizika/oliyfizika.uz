// ==========================================================================
// Metallarda elektr toki — grafiklar (simulations/metals.html):
// v(I) turli metallarda, tok zichligi j(x) sim bo'ylab, R(t) qizdirilganda (va simobning o'ta o'tkazuvchanligi R(T)).
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./metals-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
const DRIFT_METALS = ["silver", "copper", "aluminum", "iron"];

/** v(I): o: { metal, S (m²), I (A), on, hover (A) } — v mm/s da */
export function drawDrift(ctx, st, o) {
  const c = st.colors, IMax = 10, vOf = (k, I) => P.driftSpeed(I, P.METALS[k].n, o.S) * 1000;
  const yMax = Math.max(...DRIFT_METALS.map((k) => vOf(k, IMax))) * 1.08;
  const xt = ticks(0, IMax, st.w < 480 ? 5 : 10), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: IMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 0.1 ? 2 : 1), yLabel: "v, mm/s", xUnit: "I, A" });
  last = { ...f, xMax: IMax };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (const k of DRIFT_METALS) {
    const cur = k === o.metal; ctx.strokeStyle = cur ? c.primary : c.text3; ctx.lineWidth = cur ? 2.8 : 1.2; ctx.setLineDash(cur ? [] : [4, 4]);
    ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(IMax), f.Y(vOf(k, IMax))); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  const I = o.on ? o.I : 0;
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(I), f.Y(vOf(o.metal, I)), 6, 0, Math.PI * 2); ctx.fill();
  legend(ctx, [{ color: c.primary, label: `${P.METALS[o.metal].name}: v = I/(enS)` }, { color: c.text3, label: "boshqa metallar", dash: [4, 4] }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`I = ${fmt(o.hover, 2)} A`, ...DRIFT_METALS.map((k) => `${P.METALS[k].name}: v = ${fmt(vOf(k, o.hover), 3)} mm/s`)], c);
}

/** j(x): o: { parts: [{ x0, x1, S }] (cm, m²), I, n, gate (cm), L (cm), hover (cm) } — j A/mm² da */
export function drawDensity(ctx, st, o) {
  const c = st.colors, jOf = (S) => P.currentDensity(o.I, S) / 1e6, vOf = (S) => P.driftSpeed(o.I, o.n, S) * 1000;
  const yMax = Math.max(0.5, ...o.parts.map((p) => jOf(p.S))) * 1.25, partAt = (x) => o.parts.find((p) => x >= p.x0 && x <= p.x1) || o.parts[o.parts.length - 1];
  const xt = ticks(0, o.L, st.w < 480 ? 4 : 6), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax: o.L, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: "j, A/mm²", xUnit: "x, cm" });
  last = { ...f, xMax: o.L };
  const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.fillStyle = c.dark ? "rgba(96,165,250,0.18)" : "rgba(37,99,235,0.1)";
  for (const p of o.parts) ctx.fillRect(f.X(p.x0), f.Y(jOf(p.S)), f.X(p.x1) - f.X(p.x0), f.Y(0) - f.Y(jOf(p.S)));
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.8; ctx.beginPath();
  o.parts.forEach((p, i) => { if (i) ctx.lineTo(f.X(p.x0), f.Y(jOf(p.S))); else ctx.moveTo(f.X(p.x0), f.Y(jOf(p.S))); ctx.lineTo(f.X(p.x1), f.Y(jOf(p.S))); });
  ctx.stroke();
  ctx.restore();
  const g = partAt(o.gate);
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(o.gate), f.Y(jOf(g.S)), 6, 0, Math.PI * 2); ctx.fill();
  legend(ctx, [{ color: c.primary, label: "j = I/S — kesim yuzasiga teskari" }], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) { const p = partAt(o.hover); hoverLine(ctx, f, f.X(o.hover), [`x = ${fmt(o.hover, 1)} cm, S = ${fmt(p.S * 1e6, 2)} mm²`, `j = ${fmt(jOf(p.S), 2)} A/mm²`, `v = ${fmt(vOf(p.S), 3)} mm/s`], c); }
}

/** R(t): o: { metal, R20, t, tMin, tMax, pts: [{ t, R }], sc, hover } — sc: simob (T, K; R mΩ) */
export function drawRT(ctx, st, o) {
  const c = st.colors;
  if (o.sc) {
    const xMin = 3, xMax = 6, R0 = o.R20, yMax = P.mercuryR(R0, xMax) * 1000 * 1.25;
    const xt = ticks(xMin, xMax, 6), yt = ticks(0, yMax, 4);
    const f = frame(ctx, st, { xMin, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 0), yLabel: "R, mΩ", xUnit: "T, K" });
    last = { ...f, xMin, xMax }; const r = f.rect;
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    ctx.strokeStyle = c.primary; ctx.lineWidth = 2.8; ctx.beginPath();
    for (let k = 0; k <= 600; k++) { const T = xMin + ((xMax - xMin) * k) / 600, y = f.Y(P.mercuryR(R0, T) * 1000); if (k) ctx.lineTo(f.X(T), y); else ctx.moveTo(f.X(T), y); }
    ctx.stroke();
    ctx.strokeStyle = c.danger; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(f.X(P.HG_TC), r.y); ctx.lineTo(f.X(P.HG_TC), r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.fillStyle = c.danger; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(`Tₖ = ${fmt(P.HG_TC, 2)} K`, f.X(P.HG_TC) + 4, r.y + r.h - 34);
    ctx.fillStyle = c.success; for (const p of o.pts) { ctx.beginPath(); ctx.arc(f.X(p.t), f.Y(p.R * 1000), 3.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(o.t), f.Y(P.mercuryR(R0, o.t) * 1000), 6, 0, Math.PI * 2); ctx.fill();
    legend(ctx, [{ color: c.primary, label: "Simob: o‘ta o‘tkazuvchanlik (Kamerling-Onnes, 1911)" }], f.padL + 10, r.y + 12, c);
    if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`T = ${fmt(o.hover, 2)} K`, `R = ${fmt(P.mercuryR(R0, o.hover) * 1000, 2)} mΩ`], c);
    return;
  }
  const RofM = (k, t) => { const m = P.METALS[k]; return (o.R20 * P.rhoAt(m, t)) / m.rho20; };
  const xMin = o.tMin, xMax = o.tMax, cur = P.METALS[o.metal];
  const yMax = Math.max(RofM(o.metal, xMax), o.R20 * 1.5) * 1.08, yMin = 0;
  const xt = ticks(xMin, xMax, st.w < 480 ? 3 : 7), yt = ticks(yMin, yMax, 4);
  const f = frame(ctx, st, { xMin, xMax, yMin, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: "R, Ω", xUnit: "t, °C" });
  last = { ...f, xMin, xMax }; const r = f.rect;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (const [k, m] of Object.entries(P.METALS)) {
    const isCur = k === o.metal, t1 = Math.min(xMax, m.tMax); if (t1 <= xMin) continue;
    ctx.strokeStyle = isCur ? c.primary : c.text3; ctx.lineWidth = isCur ? 2.8 : 1.1; ctx.setLineDash(isCur ? [] : [4, 4]);
    ctx.beginPath(); ctx.moveTo(f.X(xMin), f.Y(RofM(k, xMin))); ctx.lineTo(f.X(t1), f.Y(RofM(k, t1))); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.X(0), r.y); ctx.lineTo(f.X(0), r.y + r.h); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = c.success; for (const p of o.pts) { ctx.beginPath(); ctx.arc(f.X(p.t), f.Y(p.R), 3.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(f.X(o.t), f.Y(RofM(o.metal, o.t)), 6, 0, Math.PI * 2); ctx.fill();
  legend(ctx, [{ color: c.primary, label: `${cur.name}${st.w < 480 ? "" : ": R = R₀(1 + αt)"}, α = ${fmt(cur.alpha * 1000, cur.alpha < 1e-3 ? 2 : 1)}·10⁻³ K⁻¹` }, { color: c.text3, label: st.w < 480 ? "boshqalar" : "boshqa metallar (R₂₀ bir xil)", dash: [4, 4] }, ...(o.pts.length ? [{ color: c.success, label: "o‘lchangan" }] : [])], f.padL + 10, r.y + 12, c);
  if (o.hover !== null && o.hover !== undefined) hoverLine(ctx, f, f.X(o.hover), [`t = ${fmt(o.hover, 0)} °C`, `R = ${fmt(RofM(o.metal, o.hover), 2)} Ω`], c);
}
