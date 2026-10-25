// ==========================================================================
// Gazlarda elektr toki — grafiklar (simulations/discharge.html):
// ionlash kamerasi I(U) (chiziqli va logarifmik), Pashen egri chizig'i U_t(p), uchqun U(t) va U_t(d),
// elektr yoyi U(I) (Ayrton) va yuklama chizig'i, toj razryad E_sirt(U).
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./discharge-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
const SUPD = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** 10^k yozuvi: 10⁻³, 1, 10, 10² */
export const p10 = (k) => (k === 0 ? "1" : k === 1 ? "10" : `10${k < 0 ? "⁻" : ""}${String(Math.abs(k)).replace(/\d/g, (d) => SUPD[d])}`);
/** Tok: mos birlikda */
export function fI(I) {
  const a = Math.abs(I);
  if (a >= 1) return [fmt(I, 2), "A"]; if (a >= 1e-3) return [fmt(I * 1e3, a >= 0.1 ? 0 : 1), "mA"]; if (a >= 1e-6) return [fmt(I * 1e6, a >= 1e-4 ? 0 : 1), "μA"];
  if (a >= 1e-9) return [fmt(I * 1e9, a >= 1e-7 ? 0 : 1), "nA"]; if (a >= 1e-12) return [fmt(I * 1e12, a >= 1e-10 ? 0 : 1), "pA"]; return [fmt(I * 1e15, 1), "fA"];
}
export function unitFor(I) { const a = Math.abs(I); return a >= 1e-3 ? [1e-3, "mA"] : a >= 1e-6 ? [1e-6, "μA"] : a >= 1e-9 ? [1e-9, "nA"] : a >= 1e-12 ? [1e-12, "pA"] : [1e-15, "fA"]; }
function hoverLine(ctx, f, px, lines, c) {
  const r = f.rect;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
const clip = (ctx, f) => { ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip(); };
function curve(ctx, f, x0, x1, n, fn, { color, width = 2.6, dash } = {}) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath(); let pen = false;
  for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n, y = fn(x); if (!Number.isFinite(y)) { pen = false; continue; } const X = f.X(x), Y = f.Y(y); if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; } }
  ctx.stroke(); ctx.setLineDash([]);
}
function dot(ctx, f, x, y, color, c, hollow = false) {
  ctx.fillStyle = hollow ? c.bg : color; ctx.strokeStyle = hollow ? color : c.bg; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(f.X(x), f.Y(y), 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
const logTicks = (a, b) => { const out = []; for (let k = Math.ceil(a); k <= Math.floor(b); k++) out.push(k); return out; };

/** Ionlash kamerasi. o: { view: "lin" | "log", q, d (m), S (m²), U (V), hover } */
export function drawChamber(ctx, st, o) {
  const c = st.colors, cur = (U) => P.chamber(U, o.d, o.S, o.q).I, Is = P.E_CH * o.q * o.d * o.S;
  if (o.view === "lin") {
    const n = Math.sqrt(o.q / P.BETA), Usat = (o.q * o.d * o.d) / (n * P.MU), Umax = Math.min(2000, Math.max(1, ticks(0, 6 * Usat, 3).values.at(-1) || 1));
    const [k, unit] = unitFor(Is || 1e-15), yMax = (Is / k) * 1.3 || 1;
    const xt = ticks(0, Umax, st.w < 480 ? 4 : 6), yt = ticks(0, yMax, 4);
    const f = frame(ctx, st, { xMin: 0, xMax: Umax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, xt.step < 1 ? 1 : 0), fmtY: (v) => fmt(v, yt.step < 1 ? 1 : 0), yLabel: `I, ${unit}`, xUnit: "U, V" });
    last = { ...f, xMin: 0, xMax: Umax };
    clip(ctx, f);
    ctx.strokeStyle = c.danger; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(Is / k)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(Is / k)); ctx.stroke(); ctx.setLineDash([]);
    curve(ctx, f, 0, Umax, 160, (U) => (P.E_CH * n * P.MU * (U / o.d) * o.S) / k, { color: c.text3, width: 1.4, dash: [5, 4] });
    curve(ctx, f, 0, Umax, 240, (U) => cur(U) / k, { color: c.primary });
    ctx.restore();
    if (o.U <= Umax) dot(ctx, f, o.U, cur(o.U) / k, c.warning, c);
    legend(ctx, [{ color: c.primary, label: "kamera toki" }, { color: c.text3, label: "Om qonuni", dash: [5, 4] }, { color: c.danger, label: "to‘yinish toki Iₛ", dash: [6, 4] }], f.padL + 10, f.rect.y + 12, c);
    if (o.hover != null) { const [v, u] = fI(cur(o.hover)); hoverLine(ctx, f, f.X(o.hover), [`U = ${fmt(o.hover, o.hover < 10 ? 2 : 0)} V`, `I = ${v} ${u}`], c); }
    return;
  }
  const Ub = P.chamberBreakdown(o.d) / 1000, xMax = Math.max(10, Math.ceil((Ub * 1.15) / 5) * 5), lIs = Math.log10(Math.max(Is, 1e-18));
  const yMin = Math.floor(lIs - 2), yMax = Math.ceil(lIs + 4);
  const xt = ticks(0, xMax, st.w < 480 ? 4 : 6), yv = logTicks(yMin, yMax);
  const f = frame(ctx, st, { xMin: 0, xMax, yMin, yMax, xTicks: xt.values, yTicks: yv, fmtX: (v) => fmt(v, 0), fmtY: (v) => p10(v), yLabel: "I, A (log)", xUnit: "U, kV", padL: 52 });
  last = { ...f, xMin: 0, xMax };
  clip(ctx, f);
  ctx.fillStyle = c.dark ? "rgba(248,113,113,0.12)" : "rgba(220,38,38,0.07)"; ctx.fillRect(f.X(Ub), f.rect.y, f.rect.x + f.rect.w - f.X(Ub), f.rect.h);
  ctx.strokeStyle = c.danger; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(f.X(Ub), f.rect.y); ctx.lineTo(f.X(Ub), f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]);
  curve(ctx, f, 0.001, Math.min(Ub * 0.99995, xMax), 400, (u) => Math.log10(Math.max(1e-30, cur(u * 1000))), { color: c.primary });
  ctx.restore();
  tag(ctx, "teshilish", f.X(Ub) - 6, f.rect.y + f.rect.h - 14, { color: c.danger, bg: c.bg2, align: "right", font: FONT });
  if (o.U / 1000 < Ub) dot(ctx, f, o.U / 1000, Math.log10(Math.max(1e-30, cur(o.U))), c.warning, c);
  legend(ctx, [{ color: c.primary, label: "mustaqil bo‘lmagan razryad" }, { color: c.danger, label: `Uₜ = ${fmt(Ub, 1)} kV`, dash: [6, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null && o.hover > 0) { const I = o.hover < Ub ? cur(o.hover * 1000) : NaN, [v, u] = Number.isFinite(I) ? fI(I) : ["—", ""]; hoverLine(ctx, f, f.X(o.hover), [`U = ${fmt(o.hover, 1)} kV`, Number.isFinite(I) ? `I = ${v} ${u}, M = ${fmt(P.chamber(o.hover * 1000, o.d, o.S, o.q).M, 2)}` : "mustaqil razryad"], c); }
}

/** Pashen egri chizig'i. o: { gas, d (cm), p, U, burning, hover (lg p) } */
export function drawPaschen(ctx, st, o) {
  const c = st.colors, xMin = -4, xMax = 3, yMin = 2, yMax = 6;
  const f = frame(ctx, st, { xMin, xMax, yMin, yMax, xTicks: logTicks(xMin, xMax), yTicks: logTicks(yMin, yMax), fmtX: (v) => p10(v), fmtY: (v) => p10(v), yLabel: "Uₜ, V", xUnit: "p, mm", padL: 46 });
  last = { ...f, xMin, xMax };
  const lgU = (g, lp) => Math.log10(P.tubeBreakdown(g, 10 ** lp, o.d));
  clip(ctx, f);
  for (const [id, g] of Object.entries(P.GASES)) if (g !== o.gas) curve(ctx, f, xMin, xMax, 200, (lp) => lgU(g, lp), { color: c.text3, width: 1 });
  // yonadigan soha (egri chiziqdan yuqori)
  ctx.fillStyle = c.dark ? "rgba(34,197,94,0.10)" : "rgba(22,163,74,0.07)"; ctx.beginPath(); ctx.moveTo(f.X(xMin), f.rect.y);
  for (let k = 0; k <= 200; k++) { const lp = xMin + ((xMax - xMin) * k) / 200; ctx.lineTo(f.X(lp), f.Y(Math.min(yMax, lgU(o.gas, lp)))); }
  ctx.lineTo(f.X(xMax), f.rect.y); ctx.closePath(); ctx.fill();
  curve(ctx, f, xMin, xMax, 300, (lp) => lgU(o.gas, lp), { color: c.primary });
  ctx.strokeStyle = c.warning; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4; const yU = f.Y(Math.log10(Math.max(100, o.U)));
  ctx.beginPath(); ctx.moveTo(f.rect.x, yU); ctx.lineTo(f.rect.x + f.rect.w, yU); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  dot(ctx, f, Math.log10(o.p), Math.log10(Math.max(100, o.U)), o.burning ? c.success : c.warning, c, !o.burning);
  legend(ctx, [{ color: c.primary, label: `${o.gas.name}: Uₜ(p), d = ${o.d} cm` }, { color: c.text3, label: "boshqa gazlar" }, { color: c.warning, label: "manba U", dash: [6, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null) { const p = 10 ** o.hover, U = P.tubeBreakdown(o.gas, p, o.d); hoverLine(ctx, f, f.X(o.hover), [`p = ${p < 0.01 ? p.toExponential(1).replace(".", ",") : fmt(p, p < 1 ? 3 : 1)} mm sim. ust.`, `Uₜ = ${U >= 1e3 ? `${fmt(U / 1000, 2)} kV` : `${fmt(U, 0)} V`}`], c); }
}

/** Uchqun. o: { view: "t" | "d", hist: [{ t, U }], Vb (V), d (cm), Umax (V), win, hover } */
export function drawSpark(ctx, st, o) {
  const c = st.colors;
  if (o.view === "d") {
    const xMax = 5, yMax = Math.ceil((P.sparkVb(xMax) / 1000) * 1.1 / 20) * 20, xt = ticks(0, xMax, 5), yt = ticks(0, yMax, 4);
    const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, xt.step < 1 ? 1 : 0), fmtY: (v) => fmt(v, 0), yLabel: "Uₜ, kV", xUnit: "d, cm" });
    last = { ...f, xMin: 0, xMax };
    clip(ctx, f);
    curve(ctx, f, 0.05, xMax, 200, (d) => P.sparkVb(d) / 1000, { color: c.primary });
    curve(ctx, f, 0, xMax, 2, (d) => d * 30, { color: c.text3, width: 1.3, dash: [5, 4] });
    ctx.strokeStyle = c.warning; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(o.Umax / 1000)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(o.Umax / 1000)); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    dot(ctx, f, o.d, o.Vb / 1000, o.Vb < o.Umax ? c.success : c.danger, c);
    legend(ctx, [{ color: c.primary, label: "havo, 760 mm sim. ust." }, { color: c.text3, label: "30 kV/cm", dash: [5, 4] }, { color: c.warning, label: "mashina chegarasi", dash: [6, 4] }], f.padL + 10, f.rect.y + 12, c);
    if (o.hover != null && o.hover > 0.05) hoverLine(ctx, f, f.X(o.hover), [`d = ${fmt(o.hover, 2)} cm`, `Uₜ = ${fmt(P.sparkVb(o.hover) / 1000, 1)} kV`], c);
    return;
  }
  const tNow = o.hist.length ? o.hist[o.hist.length - 1].t : 0, t0 = Math.max(0, tNow - o.win), yMax = Math.ceil((Math.max(o.Vb, ...o.hist.map((p) => p.U)) / 1000) * 1.15 / 10) * 10 || 10;
  const xt = ticks(t0, t0 + o.win, st.w < 480 ? 4 : 6), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: t0, xMax: t0 + o.win, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "U, kV", xUnit: "t, s" });
  last = { ...f, xMin: t0, xMax: t0 + o.win };
  clip(ctx, f);
  if (Number.isFinite(o.Vb)) { ctx.strokeStyle = c.danger; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(o.Vb / 1000)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(o.Vb / 1000)); ctx.stroke(); ctx.setLineDash([]); }
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.4; ctx.beginPath(); o.hist.forEach((p, i) => (i ? ctx.lineTo(f.X(p.t), f.Y(p.U / 1000)) : ctx.moveTo(f.X(p.t), f.Y(p.U / 1000)))); ctx.stroke();
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: "Leyden bankalaridagi U" }, { color: c.danger, label: `teshilish Uₜ = ${fmt(o.Vb / 1000, 1)} kV`, dash: [6, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null && o.hist.length) { let b = o.hist[0]; for (const p of o.hist) if (Math.abs(p.t - o.hover) < Math.abs(b.t - o.hover)) b = p; hoverLine(ctx, f, f.X(o.hover), [`t = ${fmt(o.hover, 1)} s`, `U = ${fmt(b.U / 1000, 1)} kV`], c); }
}

/** Elektr yoyi. o: { d (mm), E, R, pt ({ I, U, Iu } | null), hover } */
export function drawArc(ctx, st, o) {
  const c = st.colors, xMax = 30, yMax = 120, xt = ticks(0, xMax, st.w < 480 ? 3 : 6), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "U, V", xUnit: "I, A" });
  last = { ...f, xMin: 0, xMax };
  clip(ctx, f);
  for (const d of [2, 6, 10]) if (Math.abs(d - o.d) > 0.6) curve(ctx, f, 0.3, xMax, 200, (I) => P.ayrton(d, I), { color: c.text3, width: 1 });
  curve(ctx, f, 0.3, xMax, 300, (I) => P.ayrton(o.d, I), { color: c.primary });
  curve(ctx, f, 0, xMax, 2, (I) => o.E - I * o.R, { color: c.warning, width: 1.6, dash: [6, 4] });
  ctx.restore();
  if (o.pt) { dot(ctx, f, o.pt.I, o.pt.U, c.success, c); if (o.pt.Iu > 0.3) dot(ctx, f, o.pt.Iu, P.ayrton(o.d, o.pt.Iu), c.danger, c, true); }
  legend(ctx, [{ color: c.primary, label: `yoy U(I), d = ${fmt(o.d, 1)} mm` }, { color: c.text3, label: "d = 2, 6, 10 mm" }, { color: c.warning, label: "U = E − IR", dash: [6, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null && o.hover > 0.3) hoverLine(ctx, f, f.X(o.hover), [`I = ${fmt(o.hover, 1)} A`, `yoy: U = ${fmt(P.ayrton(o.d, o.hover), 1)} V`, `manba: E − IR = ${fmt(o.E - o.hover * o.R, 1)} V`], c);
}

/** Toj razryad. o: { r, h (cm), m, U (kV), Umax, hover } */
export function drawCorona(ctx, st, o) {
  const c = st.colors, Ec = P.peek(o.r, o.m), k = 1 / (o.r * Math.log((2 * o.h) / o.r)), xMax = o.Umax, yMax = Math.ceil(Math.max(Ec * 1.5, k * xMax) / 10) * 10;
  const xt = ticks(0, xMax, st.w < 480 ? 4 : 6), yt = ticks(0, yMax, 4);
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "E, kV/cm", xUnit: "U, kV" });
  last = { ...f, xMin: 0, xMax };
  clip(ctx, f);
  ctx.fillStyle = c.dark ? "rgba(167,139,250,0.14)" : "rgba(124,58,237,0.07)"; ctx.fillRect(f.rect.x, f.rect.y, f.rect.w, f.Y(Ec) - f.rect.y);
  ctx.strokeStyle = c.special; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(Ec)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(Ec)); ctx.stroke(); ctx.setLineDash([]);
  curve(ctx, f, 0, xMax, 2, (U) => U * k, { color: c.primary });
  ctx.restore();
  dot(ctx, f, o.U, o.U * k, o.U * k > Ec ? c.special : c.warning, c);
  legend(ctx, [{ color: c.primary, label: "sim sirtidagi maydon" }, { color: c.special, label: `toj chegarasi Eₖ = ${fmt(Ec, 1)} kV/cm`, dash: [6, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null) hoverLine(ctx, f, f.X(o.hover), [`U = ${fmt(o.hover, 0)} kV`, `E = ${fmt(o.hover * k, 1)} kV/cm`], c);
}
