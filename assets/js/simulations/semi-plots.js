// ==========================================================================
// Yarimo'tkazgichlar — grafiklar (simulations/semiconductor.html):
// metall va termorezistor R(t), ln R(1/T); fotorezistor R(E); n, p, σ ning T ga bog'liqligi;
// diod VAX (to'g'ri va teskari tarmoqlar har xil masshtabda); to'g'rilagich u(t); tranzistor I_K(I_B).
// ==========================================================================

import { fmt, tag } from "./sim-kit.js";
import { frame, ticks, legend } from "./pendulum-plots.js";
import * as P from "./semi-physics.js";

const FONT = "600 11px Inter, system-ui, sans-serif";
let last = null;
export const lastFrame = () => last;
const SUPD = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const p10 = (k) => (k === 0 ? "1" : k === 1 ? "10" : `10${k < 0 ? "⁻" : ""}${String(Math.abs(k)).replace(/\d/g, (d) => SUPD[d])}`);
/** Tok mos birlikda: [qiymat, birlik] */
export function fI(I, dg) {
  const a = Math.abs(I), d = (x) => dg ?? (x >= 100 ? 0 : x >= 10 ? 1 : 2);
  if (a >= 1) return [fmt(I, 2), "A"]; if (a >= 1e-3) return [fmt(I * 1e3, d(a * 1e3)), "mA"]; if (a >= 1e-6) return [fmt(I * 1e6, d(a * 1e6)), "μA"];
  if (a >= 1e-9 || a === 0) return [fmt(I * 1e9, d(a * 1e9)), "nA"]; return [fmt(I * 1e12, 1), "pA"];
}
/** Qarshilik: Ω, kΩ, MΩ */
export function fR(R) { if (!Number.isFinite(R)) return ["∞", "Ω"]; const a = Math.abs(R); if (a >= 1e6) return [fmt(R / 1e6, a >= 1e7 ? 1 : 2), "MΩ"]; if (a >= 1e3) return [fmt(R / 1e3, a >= 1e5 ? 0 : a >= 1e4 ? 1 : 2), "kΩ"]; return [fmt(R, a >= 100 ? 0 : a >= 10 ? 1 : 2), "Ω"]; }
function hoverLine(ctx, r, px, lines, c) {
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + 0.5, r.y); ctx.lineTo(px + 0.5, r.y + r.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = FONT; const wMax = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, right = px + 12 + wMax > r.x + r.w;
  lines.forEach((l, i) => tag(ctx, l, right ? px - 10 : px + 10, r.y + 14 + i * 24, { color: i ? c.text : c.text2, bg: c.bg2, align: right ? "right" : "left", font: FONT }));
}
const clip = (ctx, r) => { ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); };
function curve(ctx, f, x0, x1, n, fn, { color, width = 2.6, dash } = {}) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath(); let pen = false;
  for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n, y = fn(x); if (!Number.isFinite(y)) { pen = false; continue; } const X = f.X(x), Y = f.Y(y); if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; } }
  ctx.stroke(); ctx.setLineDash([]);
}
function dot(ctx, x, y, color, c, { hollow = false, r = 6 } = {}) {
  ctx.fillStyle = hollow ? c.bg : color; ctx.strokeStyle = hollow ? color : c.bg; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
const logTicks = (a, b) => { const out = []; for (let k = Math.ceil(a); k <= Math.floor(b); k++) out.push(k); return out; };
const setLast = (f, xMin, xMax) => { last = { rect: f.rect, inv: (px) => xMin + ((px - f.rect.x) / f.rect.w) * (xMax - xMin) }; };

/** Metall va termorezistor. o: { view: "R" | "ln", hist: [{ T, Rm, Rs }], T, hover } */
export function drawRT(ctx, st, o) {
  const c = st.colors;
  if (o.view === "ln") {
    const xMin = 2.6, xMax = 3.5, yMin = 6, yMax = 10, X = (t) => 1000 / (t + P.T0);
    const f = frame(ctx, st, { xMin, xMax, yMin, yMax, xTicks: ticks(xMin, xMax, st.w < 480 ? 4 : 6).values.filter((v) => v < xMax - 0.1 * (xMax - xMin)), yTicks: ticks(yMin, yMax, 4).values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 0), yLabel: "ln(R/Ω)", xUnit: "10³/T, 1/K" });
    setLast(f, xMin, xMax);
    clip(ctx, f.rect);
    curve(ctx, f, xMin, xMax, 60, (x) => Math.log(P.ntcR(1000 / x - P.T0)), { color: c.warning, width: 1.6, dash: [5, 4] });
    ctx.restore();
    o.hist.forEach((p) => dot(ctx, f.X(X(p.T)), f.Y(Math.log(p.Rs)), c.warning, c, { r: 4 }));
    dot(ctx, f.X(X(o.T)), f.Y(Math.log(P.ntcR(o.T))), c.warning, c, { hollow: true });
    legend(ctx, [{ color: c.warning, label: `termorezistor: qiyalik B = ${fmt(P.NTC.B, 0)} K`, dash: [5, 4] }], f.padL + 10, f.rect.y + 12, c);
    if (o.hover != null) { const t = 1000 / o.hover - P.T0, [v, u] = fR(P.ntcR(t)); hoverLine(ctx, f.rect, f.X(o.hover), [`T = ${fmt(1000 / o.hover, 0)} K (${fmt(t, 0)} °C)`, `R = ${v} ${u}, ln R = ${fmt(Math.log(P.ntcR(t)), 2)}`], c); }
    return;
  }
  const xMin = 10, xMax = 110, yMin = 0, yMax = 1.6;
  const f = frame(ctx, st, { xMin, xMax, yMin, yMax, xTicks: ticks(xMin, xMax, st.w < 480 ? 5 : 10).values, yTicks: ticks(yMin, yMax, 4).values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 1), yLabel: "R/R₂₀", xUnit: "t, °C" });
  setLast(f, xMin, xMax);
  const r20m = P.metalR(20), r20s = P.ntcR(20);
  clip(ctx, f.rect);
  ctx.strokeStyle = c.text3; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(1)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(1)); ctx.stroke(); ctx.setLineDash([]);
  curve(ctx, f, xMin, xMax, 40, (t) => P.metalR(t) / r20m, { color: c.primary, width: 1.6, dash: [5, 4] });
  curve(ctx, f, xMin, xMax, 120, (t) => P.ntcR(t) / r20s, { color: c.warning, width: 1.6, dash: [5, 4] });
  ctx.restore();
  o.hist.forEach((p) => { dot(ctx, f.X(p.T), f.Y(p.Rm / r20m), c.primary, c, { r: 4 }); dot(ctx, f.X(p.T), f.Y(p.Rs / r20s), c.warning, c, { r: 4 }); });
  dot(ctx, f.X(o.T), f.Y(P.metalR(o.T) / r20m), c.primary, c, { hollow: true }); dot(ctx, f.X(o.T), f.Y(P.ntcR(o.T) / r20s), c.warning, c, { hollow: true });
  legend(ctx, [{ color: c.primary, label: "mis (metall)" }, { color: c.warning, label: "termorezistor (yarimo‘tkazgich)" }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null) { const t = o.hover, [a, ua] = fR(P.metalR(t)), [b, ub] = fR(P.ntcR(t)); hoverLine(ctx, f.rect, f.X(t), [`t = ${fmt(t, 0)} °C`, `mis: ${a} ${ua} (${fmt(P.metalR(t) / r20m, 3)} R₂₀)`, `termorezistor: ${b} ${ub} (${fmt(P.ntcR(t) / r20s, 3)} R₂₀)`], c); }
}

/** Fotorezistor R(E), log-log. o: { E, hover (lg E) } */
export function drawPhoto(ctx, st, o) {
  const c = st.colors, xMin = -1, xMax = 4, yMin = 2, yMax = 6.5;
  const f = frame(ctx, st, { xMin, xMax, yMin, yMax, xTicks: logTicks(xMin, xMax), yTicks: logTicks(yMin, yMax), fmtX: (v) => p10(v), fmtY: (v) => p10(v), yLabel: "R, Ω", xUnit: "E, lk", padL: 46 });
  setLast(f, xMin, xMax);
  clip(ctx, f.rect);
  curve(ctx, f, xMin, xMax, 120, (x) => Math.log10(P.ldrR(10 ** x)), { color: c.warning });
  ctx.strokeStyle = c.text3; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(6)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(6)); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  const lx = Math.log10(Math.max(0.1, o.E)); dot(ctx, f.X(Math.min(xMax, lx)), f.Y(Math.log10(P.ldrR(o.E))), c.warning, c);
  legend(ctx, [{ color: c.warning, label: "fotorezistor (CdS)" }, { color: c.text3, label: "qorong‘idagi qarshilik 1 MΩ", dash: [3, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null) { const E = 10 ** o.hover, [v, u] = fR(P.ldrR(E)); hoverLine(ctx, f.rect, f.X(o.hover), [`E = ${fmt(E, E < 10 ? 1 : 0)} lk`, `R = ${v} ${u}`], c); }
}

/** Zaryad tashuvchilar. o: { view: "n" | "s", mat, Nd, Na, T, hover } */
export function drawCarriers(ctx, st, o) {
  const c = st.colors, xMin = 200, xMax = 600, m = o.mat;
  const cr = (T) => P.carriers(m, T, o.Nd, o.Na), sg = (T) => P.conductivity(m, T, o.Nd, o.Na).sigma;
  const xt = ticks(xMin, xMax, st.w < 480 ? 4 : 8);
  if (o.view === "s") {
    const v = [sg(xMin), sg(xMax), sg(o.T)].map(Math.log10), yMin = Math.floor(Math.min(...v) - 0.5), yMax = Math.ceil(Math.max(...v) + 0.5);
    const f = frame(ctx, st, { xMin, xMax, yMin, yMax, xTicks: xt.values, yTicks: logTicks(yMin, yMax).filter((k, i, a) => a.length < 9 || k % 2 === 0), fmtX: (x) => fmt(x, 0), fmtY: (y) => p10(y), yLabel: "σ, S/m", xUnit: "T, K", padL: 50 });
    setLast(f, xMin, xMax);
    clip(ctx, f.rect);
    curve(ctx, f, xMin, xMax, 200, (T) => Math.log10(P.conductivity(m, T).sigma), { color: c.text3, width: 1.4, dash: [5, 4] });
    curve(ctx, f, xMin, xMax, 200, (T) => Math.log10(sg(T)), { color: c.success });
    ctx.restore();
    dot(ctx, f.X(o.T), f.Y(Math.log10(sg(o.T))), c.success, c);
    legend(ctx, [{ color: c.success, label: "σ = e(nμₙ + pμₚ)" }, { color: c.text3, label: `sof ${m.sym}`, dash: [5, 4] }], f.padL + 10, f.rect.y + 12, c);
    if (o.hover != null) hoverLine(ctx, f.rect, f.X(o.hover), [`T = ${fmt(o.hover, 0)} K (${fmt(o.hover - P.T0, 0)} °C)`, `σ = ${sciS(sg(o.hover))} S/m`], c);
    return;
  }
  const v = [cr(xMin).n, cr(xMin).p, cr(xMax).n, cr(xMax).p, cr(o.T).n, cr(o.T).p].filter((x) => x > 0).map(Math.log10);
  const yMin = Math.max(Math.floor(Math.min(...v)) - 1, Math.floor(Math.max(...v)) - 18), yMax = Math.ceil(Math.max(...v)) + 1;
  const f = frame(ctx, st, { xMin, xMax, yMin, yMax, xTicks: xt.values, yTicks: logTicks(yMin, yMax).filter((k) => (yMax - yMin > 9 ? k % 2 === 0 : true)), fmtX: (x) => fmt(x, 0), fmtY: (y) => p10(y), yLabel: "n, p, m⁻³", xUnit: "T, K", padL: 50 });
  setLast(f, xMin, xMax);
  clip(ctx, f.rect);
  curve(ctx, f, xMin, xMax, 200, (T) => Math.log10(P.ni(m, T)), { color: c.text3, width: 1.4, dash: [5, 4] });
  curve(ctx, f, xMin, xMax, 200, (T) => Math.log10(cr(T).p), { color: c.danger });
  curve(ctx, f, xMin, xMax, 200, (T) => Math.log10(cr(T).n), { color: c.primary, width: o.Na > 0 || o.Nd > 0 ? 2.6 : 2 });
  ctx.restore();
  const k = cr(o.T); dot(ctx, f.X(o.T), f.Y(Math.log10(k.n)), c.primary, c); dot(ctx, f.X(o.T), f.Y(Math.log10(k.p)), c.danger, c);
  legend(ctx, [{ color: c.primary, label: "elektronlar n" }, { color: c.danger, label: "kovaklar p" }, { color: c.text3, label: "nᵢ (sof)", dash: [5, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null) { const q = cr(o.hover); hoverLine(ctx, f.rect, f.X(o.hover), [`T = ${fmt(o.hover, 0)} K (${fmt(o.hover - P.T0, 0)} °C)`, `n = ${sciS(q.n)} m⁻³`, `p = ${sciS(q.p)} m⁻³`], c); }
}
function sciS(v) { if (!(v > 0)) return "0"; const e = Math.floor(Math.log10(v)), mm = v / 10 ** e; return `${fmt(mm, 2)}·${p10(e)}`; }

/**
 * Diod VAX: o'ngda — to'g'ri tarmoq (V, mA), chapda — teskari (V, μA yoki nA).
 * o: { d, T, pts: [{ U, I }], U, I, hover }
 */
export function drawVAX(ctx, st, o) {
  const c = st.colors, { w, h } = st, d = o.d, led = !!d.led;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  const padL = 12, padR = 16, padT = 20, padB = 32, pw = w - padL - padR, ph = h - padT - padB;
  const x0 = padL + pw * 0.34, y0 = padT + ph * 0.66, Uf = led ? 4 : 1.2, Ur = 30, If = 50;
  const Irv = Math.abs(P.diodeI(d, -Ur, o.T)), [Ik, Iu] = Irv >= 1e-6 ? [1e-6, "μA"] : [1e-9, "nA"];
  const Ir = ticks(0, Math.max(Irv / Ik, ...o.pts.filter((p) => p.I < 0).map((p) => -p.I / Ik), 1e-3) * 1.15, 3).values.at(-1) || 1;
  const XU = (U) => (U >= 0 ? x0 + (U / Uf) * (padL + pw - x0) : x0 + (U / Ur) * (x0 - padL));
  const YI = (I) => (I >= 0 ? y0 - ((I * 1000) / If) * (y0 - padT) : y0 + (-I / Ik / Ir) * (padT + ph - y0));
  const r = { x: padL, y: padT, w: pw, h: ph };
  last = { rect: r, inv: (px) => (px >= x0 ? ((px - x0) / (padL + pw - x0)) * Uf : -((x0 - px) / (x0 - padL)) * Ur) };
  // to'r va o'qlar
  ctx.font = "500 11px Inter, system-ui, sans-serif"; ctx.lineWidth = 1; ctx.strokeStyle = c.grid; ctx.beginPath();
  const uf = ticks(0, Uf, 4).values, ur = ticks(0, Ur, 3).values, ifv = ticks(0, If, 5).values, irv = ticks(0, Ir, 2).values;
  uf.forEach((U) => { const x = Math.round(XU(U)) + 0.5; ctx.moveTo(x, padT); ctx.lineTo(x, padT + ph); });
  ur.forEach((U) => { const x = Math.round(XU(-U)) + 0.5; ctx.moveTo(x, padT); ctx.lineTo(x, padT + ph); });
  ifv.forEach((I) => { const y = Math.round(YI(I / 1000)) + 0.5; ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); });
  irv.forEach((I) => { const y = Math.round(YI(-I * Ik)) + 0.5; ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); });
  ctx.stroke();
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(padL, y0 + 0.5); ctx.lineTo(padL + pw, y0 + 0.5); ctx.moveTo(x0 + 0.5, padT); ctx.lineTo(x0 + 0.5, padT + ph); ctx.stroke();
  ctx.fillStyle = c.text3; ctx.textBaseline = "top"; ctx.textAlign = "center";
  uf.forEach((U) => U && ctx.fillText(fmt(U, Uf < 2 ? 1 : 0), XU(U), y0 + 4)); ur.forEach((U) => U && ctx.fillText(`−${fmt(U, 0)}`, XU(-U), y0 + 4));
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ifv.forEach((I) => I && ctx.fillText(fmt(I, 0), x0 - 4, YI(I / 1000))); irv.forEach((I) => I && ctx.fillText(`−${fmt(I, Ir < 1 ? 2 : Ir < 10 ? 1 : 0)}`, x0 - 4, YI(-I * Ik)));
  ctx.fillStyle = c.text2; ctx.font = "600 11px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText("I, mA", x0 + 6, padT + 4);
  ctx.fillText(`I, ${Iu}`, x0 + 6, padT + ph - 6); ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("U, V", padL + pw, y0 - 3);
  // nazariy egri chiziq
  clip(ctx, r);
  ctx.strokeStyle = led ? `rgb(${d.led.join(",")})` : c.primary; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]); ctx.beginPath();
  for (let k = 0; k <= 240; k++) { const U = -Ur + ((Uf + Ur) * k) / 240, I = P.diodeI(d, U, o.T), x = XU(U), y = YI(I); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  const col = led ? `rgb(${d.led.join(",")})` : c.primary;
  o.pts.forEach((p) => dot(ctx, XU(p.U), YI(p.I), col, c, { r: 4.5 }));
  dot(ctx, XU(Math.max(-Ur, Math.min(Uf, o.U))), Math.max(padT, Math.min(padT + ph, YI(o.I))), c.warning, c, { hollow: true });
  legend(ctx, [{ color: col, label: `${d.short}${o.T !== 293 ? `, ${fmt(o.T - P.T0, 0)} °C` : ""}`, dash: [5, 4] }, { color: c.warning, label: "hozirgi nuqta" }], padL + pw * 0.38, padT + 10, c);
  if (o.hover != null) { const I = P.diodeI(d, o.hover, o.T), [v, u] = fI(I); hoverLine(ctx, r, XU(o.hover), [`U = ${fmt(o.hover, Math.abs(o.hover) < 5 ? 2 : 1)} V`, `I = ${v} ${u}`], c); }
}

/** To'g'rilagich u(t). o: { r (rectifier natijasi), ph (0…2 davr ulushi), hover } */
export function drawWave(ctx, st, o) {
  const c = st.colors, r = o.r, xMax = r.T * 2000, yA = Math.ceil((Math.max(...r.uin) * 1.15) / 5) * 5;
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: -yA, yMax: yA, xTicks: ticks(0, xMax, st.w < 480 ? 4 : 8).values, yTicks: ticks(-yA, yA, 4).values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), yLabel: "u, V", xUnit: "t, ms" });
  setLast(f, 0, xMax);
  clip(ctx, f.rect);
  const line = (arr, color, wd, dash) => { ctx.strokeStyle = color; ctx.lineWidth = wd; ctx.setLineDash(dash || []); ctx.beginPath(); arr.forEach((v, i) => { const x = f.X(r.t[i] * 1000), y = f.Y(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]); };
  line(r.uin, c.warning, 1.6, [5, 4]); line(r.uout, c.primary, 2.6);
  ctx.strokeStyle = c.success; ctx.lineWidth = 1.2; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(r.Uavg)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(r.Uavg)); ctx.stroke(); ctx.setLineDash([]);
  const px = f.X(o.ph * xMax); ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, f.rect.y); ctx.lineTo(px, f.rect.y + f.rect.h); ctx.stroke();
  ctx.restore();
  legend(ctx, [{ color: c.warning, label: "transformator (kirish)", dash: [5, 4] }, { color: c.primary, label: "yuklamada (chiqish)" }, { color: c.success, label: `o‘rtacha ${fmt(r.Uavg, 1)} V`, dash: [2, 3] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null) { const i = Math.max(0, Math.min(r.t.length - 1, Math.round((o.hover / xMax) * (r.t.length - 1)))); hoverLine(ctx, f.rect, f.X(o.hover), [`t = ${fmt(o.hover, 1)} ms`, `kirish ${fmt(r.uin[i], 1)} V, chiqish ${fmt(r.uout[i], 1)} V`], c); }
}

/** Tranzistor: kollektor toki baza tokiga bog'liq. o: { Ucc, Rk, Ib, Ic, hover } — mA */
export function drawTr(ctx, st, o) {
  const c = st.colors, b = P.TRANSISTOR.beta, Imax = ((o.Ucc - P.TRANSISTOR.Usat) / o.Rk) * 1000, xMax = 3, yMax = Math.ceil((Imax * 1.3) / 50) * 50;
  const f = frame(ctx, st, { xMin: 0, xMax, yMin: 0, yMax, xTicks: ticks(0, xMax, 6).values, yTicks: ticks(0, yMax, 4).values, fmtX: (v) => fmt(v, 1), fmtY: (v) => fmt(v, 0), yLabel: "kollektor toki, mA", xUnit: "baza toki, mA", padL: 62 });
  setLast(f, 0, xMax);
  clip(ctx, f.rect);
  ctx.fillStyle = c.dark ? "rgba(74,222,128,0.10)" : "rgba(22,163,74,0.07)"; const xs = Imax / b; ctx.fillRect(f.X(xs), f.rect.y, f.rect.x + f.rect.w - f.X(xs), f.rect.h);
  curve(ctx, f, 0, xMax, 2, (x) => b * x, { color: c.text3, width: 1.3, dash: [5, 4] });
  curve(ctx, f, 0, xMax, 300, (x) => Math.min(b * x, Imax), { color: c.primary });
  ctx.restore();
  dot(ctx, f.X(Math.min(xMax, o.Ib * 1000)), f.Y(o.Ic * 1000), c.warning, c);
  tag(ctx, "to‘yinish", f.X(xs) + 6, f.rect.y + f.rect.h - 14, { color: c.success, bg: c.bg2, font: FONT });
  legend(ctx, [{ color: c.primary, label: "kollektor toki" }, { color: c.text3, label: `β marta kuchaytirish, β = ${b}`, dash: [5, 4] }], f.padL + 10, f.rect.y + 12, c);
  if (o.hover != null) hoverLine(ctx, f.rect, f.X(o.hover), [`baza toki ${fmt(o.hover, 2)} mA`, `kollektor toki ${fmt(Math.min(b * o.hover, Imax), 0)} mA`], c);
}
