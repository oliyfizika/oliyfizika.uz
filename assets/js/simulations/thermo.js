// ==========================================================================
// Termodinamika — virtual laboratoriya (simulations/thermo.html)
// 1) 1-qonun: porshenli silindrdagi gaz; izoxorik / izobarik / izotermik / adiabatik jarayonlar. Porshenni yoki
//    termometrni sahnada surib holatni o'zgartirish; jarayonlar ketma-ket qo'shiladi (o'z siklingizni yasash mumkin).
//    p–V diagramma (ish — yuza) va Q = ΔU + A ustunlari.
// 2) Sikllar: Karno, to'rtburchak, Otto, sovutgich. Silindr isitkich / izolyatsiya / sovitkich ustida yuradi;
//    energiya oqimi Q₁ → A + Q₂, FIK va Karno chegarasi. Isitkich/sovitkich bloklari sahnada suriladi.
// 3) To'rt taktli ichki yonuv dvigateli: tirsakli val, shatun, porshen, klapanlar, sham; indikator p–V diagramma.
// Fizika: thermo-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./thermo-physics.js";
import { drawPV, drawEnergy, lastFrame, niceMax } from "./thermo-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 13px Inter, system-ui, sans-serif";
const NU = (P.P_ATM * 2e-3) / (P.R * 300); // silindrdagi gaz: 2 L, 1 atm, 300 K
const KIND_NAME = { V: "Izoxorik", p: "Izobarik", T: "Izotermik", Q: "Adiabatik" };
const KIND_LAW = { V: "V = const", p: "p = const", T: "T = const", Q: "Q = 0" };
const LIM = { V: [0.6e-3, 4.2e-3], T: [120, 1200] };

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "proc", tab: "pv", speed: 1, hover: null };
const gasState = { key: "air" };
const gas = () => ({ nu: NU, i: P.GASES[gasState.key].i });
const proc = { kind: "p", start: null, legs: [], cur: null, pMax: 300e3, flow: 0, flowT: 0, work: 0, flowA: 0 };
const cyc = { name: "karno", T1: 600, T2: 300, r: 2.5, u: 0, data: null, cylX: null, laps: 0 };
const eng = { eps: 9, Tmax: 2400, rpm: 3000, th: 0, g: null, curve: null };
const mol = Array.from({ length: 36 }, (_, k) => ({ x: ((k * 37) % 100) / 100, y: ((k * 61) % 100) / 100, a: k * 2.39996 }));
let presetId = null, running = false;
const geo = {};

/* ------------------------------------------------------------------ 1. Jarayonlar */

function resetProc(V = 2e-3, T = 300) {
  proc.start = P.stateVT(gas(), V, T);
  proc.cur = proc.start;
  proc.legs = [{ kind: proc.kind, a: proc.start, b: proc.start }];
  proc.pMax = 0; proc.flow = 0; proc.flowT = 0; proc.flowA = 0;
  growP(proc.start);
}
function growP(s) { proc.pMax = Math.max(proc.pMax, niceMax((s.p * 1.15) / 1000) * 1000, 250e3); }
const curLeg = () => proc.legs[proc.legs.length - 1];
function setKind(k) {
  if (k === proc.kind) return;
  proc.kind = k;
  const L = curLeg();
  if (L.a === L.b || (L.a.V === L.b.V && L.a.T === L.b.T)) L.kind = k; // bo'sh jarayonni almashtiramiz
  else { proc.legs.push({ kind: k, a: proc.cur, b: proc.cur }); if (proc.legs.length > 8) proc.legs.shift(); }
}
/** Jarayon bo'ylab yangi holatga o'tish (chegaralar bilan). to: { V } yoki { T } */
function applyTarget(to) {
  const g = gas(), L = curLeg();
  if (proc.kind === "V" && to.V !== undefined) return;
  if (proc.kind === "T" && to.T !== undefined) return;
  let s = P.move(g, proc.cur, proc.kind, to);
  // chegaradan chiqsa — chegaraga qadar
  if (s.V < LIM.V[0] || s.V > LIM.V[1]) s = P.move(g, proc.cur, proc.kind, { V: clamp(s.V, LIM.V[0], LIM.V[1]) });
  if (s.T < LIM.T[0] || s.T > LIM.T[1]) s = P.move(g, proc.cur, proc.kind, { T: clamp(s.T, LIM.T[0], LIM.T[1]) });
  if (s.V < LIM.V[0] - 1e-9 || s.V > LIM.V[1] + 1e-9) return;
  const before = P.leg(g, proc.cur, s, proc.kind);
  if (Math.abs(before.Q) > 1e-6) { proc.flow = Math.sign(before.Q); proc.flowT = 1.2; }
  if (Math.abs(before.A) > 1e-6) { proc.flowA = Math.sign(before.A); }
  proc.cur = s; L.b = s; growP(s);
  syncProcCtl(); refresh();
}
function procTotals() {
  const g = gas();
  return proc.legs.reduce((t, L) => { const r = P.leg(g, L.a, L.b, L.kind); return { A: t.A + r.A, dU: t.dU + r.dU, Q: t.Q + r.Q }; }, { A: 0, dU: 0, Q: 0 });
}

/* ------------------------------------------------------------------ 2. Sikllar */

function buildCycle() {
  const g = gas(), rmax = P.maxRatio(g, cyc.name, cyc.T1, cyc.T2);
  if (cyc.T2 >= cyc.T1 - 10) cyc.T2 = cyc.T1 - 10;
  cyc.r = clamp(cyc.r, 1.2, Math.max(1.21, Math.min(12, rmax)));
  const V1 = cyc.name === "otto" ? 1e-3 : 0.5e-3;
  cyc.data = P.cycle(g, cyc.name, { T1: cyc.T1, T2: cyc.T2, r: cyc.r, V1 });
}
const cycState = () => P.onCycle(gas(), cyc.data, cyc.u);
/** Jarayonda silindr qayerda turadi: 0 isitkich, 1 izolyatsiya, 2 sovitkich */
function station(L) {
  if (L.kind === "Q") return 1;
  return L.Q > 1e-9 ? (cyc.data.reverse ? 2 : 0) : (cyc.data.reverse ? 0 : 2);
}

/* ------------------------------------------------------------------ 3. Dvigatel */

function buildEngine() {
  eng.g = P.engineGeom({ eps: eng.eps });
  const N = 720, pts = [];
  for (let k = 0; k <= N; k++) pts.push(P.engineState(eng.g, 5, eng.Tmax, (k / N) * 4 * Math.PI - 1e-9));
  eng.curve = pts;
}
const engState = () => P.engineState(eng.g, 5, eng.Tmax, eng.th);

/* ------------------------------------------------------------------ Chizish: silindr */

function cylinderGeo(w, h, { cx, cw, vScale }) {
  const yb = h - 58, yt = 30, H = yb - yt - 30;
  return { cx, cw, yb, yt, H, vScale, yOf: (V) => yb - (V / vScale) * H, vOf: (y) => ((yb - y) / H) * vScale };
}
function tempColor(T, alpha = 1) {
  const u = clamp((T - 150) / 1000, 0, 1), r = Math.round(60 + 195 * u), gg = Math.round(130 + 40 * Math.sin(u * Math.PI)), b = Math.round(235 - 200 * u);
  return `rgba(${r},${gg},${b},${alpha})`;
}
function drawCylinder(ctx, c, G, s, opt = {}) {
  const { cx, cw, yb, yt } = G, x0 = cx - cw / 2, py = G.yOf(s.V);
  // devorlar
  if (opt.insulated) {
    ctx.fillStyle = c.dark ? "#3f3f46" : "#e7e5e4"; ctx.fillRect(x0 - 14, yt - 4, 14, yb - yt + 14); ctx.fillRect(x0 + cw, yt - 4, 14, yb - yt + 14); ctx.fillRect(x0 - 14, yb, cw + 28, 10);
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath();
    for (let y = yt; y < yb + 8; y += 8) { ctx.moveTo(x0 - 14, y + 8); ctx.lineTo(x0, y); ctx.moveTo(x0 + cw, y + 8); ctx.lineTo(x0 + cw + 14, y); }
    ctx.stroke();
  }
  if (opt.bath) {
    ctx.fillStyle = c.dark ? "rgba(56,189,248,0.16)" : "rgba(14,165,233,0.14)"; ctx.fillRect(x0 - 22, yt + 20, cw + 44, yb - yt - 10);
    ctx.strokeStyle = c.dark ? "rgba(56,189,248,0.5)" : "rgba(14,165,233,0.5)"; ctx.lineWidth = 1.2; ctx.strokeRect(x0 - 22 + 0.5, yt + 20.5, cw + 44, yb - yt - 10);
    ctx.font = SMALL; ctx.fillStyle = c.primary; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`termostat ${fmt(s.T, 0)} K`, cx, yb + 14);
  }
  // gaz
  ctx.fillStyle = tempColor(s.T, c.dark ? 0.22 : 0.16); ctx.fillRect(x0, py, cw, yb - py);
  // molekulalar
  ctx.fillStyle = tempColor(s.T, 0.95);
  for (const m of mol) { ctx.beginPath(); ctx.arc(x0 + 5 + m.x * (cw - 10), py + 5 + m.y * Math.max(1, yb - py - 10), 2.6, 0, TAU); ctx.fill(); }
  // silindr
  ctx.strokeStyle = c.text2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, yt); ctx.lineTo(x0, yb); ctx.lineTo(x0 + cw, yb); ctx.lineTo(x0 + cw, yt); ctx.stroke();
  // porshen
  const ph = 14;
  ctx.fillStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.fillRect(x0 + 2, py - ph, cw - 4, ph);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.strokeRect(x0 + 2.5, py - ph + 0.5, cw - 5, ph - 1);
  // shtok va dasta
  ctx.strokeStyle = c.text2; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, py - ph); ctx.lineTo(cx, py - ph - 22); ctx.stroke();
  geo.knob = { x: cx, y: py - ph - 26, r: 18, py };
  if (opt.weights) {
    ctx.fillStyle = c.dark ? "#475569" : "#334155"; ctx.beginPath(); ctx.roundRect(cx - cw * 0.28, py - ph - 18, cw * 0.18, 18, 3); ctx.roundRect(cx + cw * 0.1, py - ph - 18, cw * 0.18, 18, 3); ctx.fill();
    ctx.font = SMALL; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("m", cx - cw * 0.19, py - ph - 9); ctx.fillText("m", cx + cw * 0.19, py - ph - 9);
  }
  if (opt.locked) {
    ctx.strokeStyle = c.danger; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 - 8, py - ph - 4); ctx.lineTo(x0 + 16, py - ph - 4); ctx.moveTo(x0 + cw - 16, py - ph - 4); ctx.lineTo(x0 + cw + 8, py - ph - 4); ctx.stroke();
  }
  ctx.fillStyle = opt.dragKnob ? c.primary : c.text3; ctx.strokeStyle = c.bg; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, py - ph - 26, 9, 0, TAU); ctx.fill(); ctx.stroke();
  if (opt.dragKnob) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(cx, py - ph - 32); ctx.lineTo(cx - 3, py - ph - 28); ctx.lineTo(cx + 3, py - ph - 28); ctx.closePath(); ctx.moveTo(cx, py - ph - 20); ctx.lineTo(cx - 3, py - ph - 24); ctx.lineTo(cx + 3, py - ph - 24); ctx.closePath(); ctx.fill(); }
  return py;
}
function drawFlame(ctx, c, x, y, size, on) {
  ctx.save(); ctx.globalAlpha = on ? 1 : 0.25;
  const t = performance.now() / 1000;
  for (let k = -1; k <= 1; k++) {
    const fx = x + k * size * 0.7, hh = size * (1.3 + 0.25 * Math.sin(t * 9 + k * 2));
    const grad = ctx.createLinearGradient(fx, y, fx, y - hh); grad.addColorStop(0, "#f97316"); grad.addColorStop(1, "rgba(250,204,21,0.1)");
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(fx - size * 0.35, y); ctx.quadraticCurveTo(fx - size * 0.3, y - hh * 0.5, fx, y - hh); ctx.quadraticCurveTo(fx + size * 0.3, y - hh * 0.5, fx + size * 0.35, y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawThermometer(ctx, c, x, y0, y1, T, active) {
  const u = clamp((T - LIM.T[0]) / (LIM.T[1] - LIM.T[0]), 0, 1), yT = y1 - u * (y1 - y0);
  ctx.fillStyle = c.bg2; ctx.strokeStyle = active ? c.primary : c.border; ctx.lineWidth = active ? 2 : 1.2;
  ctx.beginPath(); ctx.roundRect(x - 6, y0 - 6, 12, y1 - y0 + 12, 6); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y1 + 12, 10, 0, TAU); ctx.fillStyle = c.danger; ctx.fill();
  ctx.fillStyle = c.danger; ctx.fillRect(x - 3, yT, 6, y1 + 6 - yT);
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  for (const t of [200, 400, 600, 800, 1000]) { const yy = y1 - ((t - LIM.T[0]) / (LIM.T[1] - LIM.T[0])) * (y1 - y0); ctx.beginPath(); ctx.moveTo(x + 6, yy); ctx.lineTo(x + 10, yy); ctx.stroke(); if (y1 - y0 > 140 || t % 400 === 0) ctx.fillText(String(t), x + 12, yy); }
  tag(ctx, `${fmt(T, 0)} K`, x, yT, { color: active ? c.primary : c.text2, bg: c.bg, align: "center", font: MID });
  geo.thermo = { x, y0, y1, active };
}

function drawProcStage(ctx, c, w, h) {
  const narrow = w < 560, cw = Math.min(130, w * (narrow ? 0.34 : 0.22)), cx = narrow ? w * 0.36 : w * 0.2 + 10;
  const G = cylinderGeo(w, h, { cx, cw, vScale: 4.5e-3 }), s = proc.cur, k = proc.kind;
  geo.cyl = G;
  drawCylinder(ctx, c, G, s, { insulated: k === "Q", bath: k === "T", weights: k === "p", locked: k === "V", dragKnob: k !== "V" });
  // issiqlik manbai / sovitgich
  const by = G.yb + 10;
  if (k !== "Q" && k !== "T") {
    ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.fillRect(cx - 26, by + 26, 52, 8);
    if (proc.flow < 0 && proc.flowT > 0) {
      ctx.fillStyle = c.dark ? "rgba(96,165,250,0.6)" : "rgba(59,130,246,0.45)"; ctx.beginPath(); ctx.roundRect(cx - cw / 2, by, cw, 16, 4); ctx.fill();
      ctx.font = SMALL; ctx.fillStyle = c.primary; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("sovitish", cx, by + 18);
    } else drawFlame(ctx, c, cx, by + 26, 9, proc.flow > 0 && proc.flowT > 0);
  }
  // energiya o'qlari
  const L = procTotals();
  if (proc.flowT > 0 && proc.flow && k !== "Q") {
    const ax = cx - cw / 2 - 30, up = proc.flow > 0;
    ctx.strokeStyle = up ? c.danger : c.primary; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ax, up ? G.yb + 4 : G.yb - 40); ctx.lineTo(ax, up ? G.yb - 34 : G.yb - 2); ctx.stroke();
    const ty = up ? G.yb - 40 : G.yb + 4; ctx.beginPath(); ctx.moveTo(ax, ty); ctx.lineTo(ax - 6, ty + (up ? 9 : -9)); ctx.lineTo(ax + 6, ty + (up ? 9 : -9)); ctx.closePath(); ctx.fill();
    ctx.font = BOLD; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(up ? "Q > 0" : "Q < 0", ax - 8, G.yb - 18);
  }
  if (proc.flowA && Math.abs(L.A) > 0.05 && k !== "V") {
    const ax = cx + cw / 2 + 16, py = G.yOf(s.V) - 30, up = proc.flowA > 0;
    ctx.strokeStyle = c.success; ctx.fillStyle = c.success; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ax, py + (up ? 14 : -14)); ctx.lineTo(ax, py + (up ? -14 : 14)); ctx.stroke();
    ctx.beginPath(); const ty = py + (up ? -20 : 20); ctx.moveTo(ax, ty); ctx.lineTo(ax - 6, ty + (up ? 9 : -9)); ctx.lineTo(ax + 6, ty + (up ? 9 : -9)); ctx.closePath(); ctx.fill();
  }
  // termometr
  const tx = cx + cw / 2 + (narrow ? 44 : 54);
  drawThermometer(ctx, c, tx, G.yt + 18, G.yb - 6, s.T, k === "V" || k === "p" || k === "Q");
  // ma'lumot paneli
  const ix = tx + 46; if (narrow || w - ix < 170) return;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.font = "700 15px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text; ctx.fillText(`${KIND_NAME[k]} jarayon`, ix, 16);
  ctx.font = MID; ctx.fillStyle = c.text2; ctx.fillText(`${KIND_LAW[k]} · ${P.GASES[gasState.key].name}, ν = ${fmt(NU, 3)} mol`, ix, 38);
  const rows = [["p", `${fmt(s.p / 1000, 1)} kPa`], ["V", `${fmt(s.V * 1000, 2)} L`], ["T", `${fmt(s.T, 0)} K`], ["U", `${fmt(P.energy(gas(), s.T), 0)} J`]];
  ctx.font = "600 13px Inter, system-ui, sans-serif";
  rows.forEach(([a, b], j) => { ctx.fillStyle = c.text3; ctx.fillText(a, ix, 66 + j * 22); ctx.fillStyle = c.text; ctx.fillText(b, ix + 22, 66 + j * 22); });
  const y2 = 66 + rows.length * 22 + 10;
  ctx.font = BOLD; ctx.fillStyle = c.text; ctx.fillText("Q = ΔU + A", ix, y2);
  ctx.font = MID; ctx.fillStyle = c.text2; ctx.fillText(`${fmt(L.Q, 1)} = ${fmt(L.dU, 1)} ${L.A < 0 ? "−" : "+"} ${fmt(Math.abs(L.A), 1)} J`, ix, y2 + 20);
  if (proc.legs.length > 1) { ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.fillText(`${proc.legs.length} ta jarayon ketma-ket (1-holatdan)`, ix, y2 + 40); }
}

function drawCycleStage(ctx, c, w, h) {
  const d = cyc.data, { j, s } = cycState(), L = d.legs[j], narrow = w < 600;
  const cw = Math.min(84, w * (narrow ? 0.2 : 0.13)), gap = cw * 1.32, x1 = narrow ? w * 0.2 : w * 0.12 + 10;
  const xs = [x1, x1 + gap, x1 + 2 * gap], st = station(L);
  if (cyc.cylX === null) cyc.cylX = xs[st];
  const vScale = Math.max(...d.pts.map((q) => q.V)) * 1.08;
  const G = cylinderGeo(w, h, { cx: cyc.cylX, cw, vScale });
  // bloklar
  const by = G.yb + 1, bh = 24, labels = [`Isitkich ${fmt(cyc.T1, 0)} K`, "Izolyatsiya", `Sovitkich ${fmt(cyc.T2, 0)} K`];
  const cols = [c.danger, c.text3, c.primary];
  geo.blocks = [];
  xs.forEach((x, k) => {
    ctx.globalAlpha = k === st ? 1 : 0.45; ctx.fillStyle = cols[k];
    ctx.beginPath(); ctx.roundRect(x - cw * 0.62, by, cw * 1.24, bh, 5); ctx.fill(); ctx.globalAlpha = 1;
    ctx.font = SMALL; ctx.fillStyle = k === st ? c.text : c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(labels[k], x, by + bh + 4);
    if (k !== 1) { geo.blocks.push({ k, x: x - cw * 0.62, y: by - 4, w: cw * 1.24, h: bh + 20 }); ctx.fillStyle = "#fff"; ctx.font = MID; ctx.textBaseline = "middle"; ctx.fillText("⇕", x, by + bh / 2); }
  });
  drawCylinder(ctx, c, G, s, { insulated: L.kind === "Q", dragKnob: false });
  // jarayon nomi
  ctx.font = BOLD; ctx.fillStyle = c.text; ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(`${j + 1}→${(j + 1) % 4 + 1}: ${KIND_NAME[L.kind]} ${L.kind === "Q" ? "" : L.Q > 0 ? "(gaz issiqlik oladi)" : L.Q < 0 ? "(gaz issiqlik beradi)" : ""}`, 12, 8);
  // energiya oqimi
  if (narrow) return;
  const ex = xs[2] + cw + 40, ew = w - ex - 14; if (ew < 170) return;
  const mx = ex + ew * 0.42, hotY = 22, engY = h * 0.48, coldY = h - 46, Qmax = Math.max(d.Qin, d.Qout, 1), sc = 22 / Qmax;
  const rev = d.reverse, Q1 = rev ? d.Qout : d.Qin, Q2 = rev ? d.Qin : d.Qout, A = Math.abs(d.A);
  const box = (y, col, txt) => { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(mx - 60, y, 120, 26, 6); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = MID; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, mx, y + 13); };
  const flow = (x, ya, yb, wq, col, label, down) => {
    ctx.fillStyle = col; ctx.globalAlpha = 0.75; const ww = Math.max(3, wq);
    ctx.beginPath(); ctx.moveTo(x - ww / 2, ya); ctx.lineTo(x + ww / 2, ya); ctx.lineTo(x + ww / 2, yb - (down ? 9 : -9)); ctx.lineTo(x + ww / 2 + 6, yb - (down ? 9 : -9)); ctx.lineTo(x, yb); ctx.lineTo(x - ww / 2 - 6, yb - (down ? 9 : -9)); ctx.lineTo(x - ww / 2, yb - (down ? 9 : -9)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    ctx.font = MID; ctx.fillStyle = c.text; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(label, x + ww / 2 + 10, (ya + yb) / 2);
  };
  box(hotY, c.danger, `Isitkich T₁ = ${fmt(cyc.T1, 0)} K`);
  box(coldY, c.primary, `Sovitkich T₂ = ${fmt(cyc.T2, 0)} K`);
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mx, engY, 30, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(rev ? "sovutgich" : "dvigatel", mx, engY);
  if (!rev) { flow(mx, hotY + 26, engY - 30, Q1 * sc, c.danger, `Q₁ = ${fmt(Q1, 1)} J`, true); flow(mx, engY + 30, coldY, Q2 * sc, c.primary, `|Q₂| = ${fmt(Q2, 1)} J`, true); }
  else { flow(mx, engY - 30, hotY + 26, Q1 * sc, c.danger, `Q₁ = ${fmt(Q1, 1)} J`, false); flow(mx, coldY, engY + 30, Q2 * sc, c.primary, `Q₂ = ${fmt(Q2, 1)} J`, false); }
  // ish
  ctx.fillStyle = c.success; ctx.globalAlpha = 0.8; const aw = Math.max(3, A * sc), ax0 = rev ? mx - 30 - 44 : mx + 30, ax1 = rev ? mx - 30 : mx + 30 + 44;
  ctx.beginPath(); ctx.rect(Math.min(ax0, ax1), engY - aw / 2, 36, aw); ctx.fill();
  ctx.beginPath(); if (!rev) { ctx.moveTo(ax1, engY); ctx.lineTo(ax1 - 9, engY - aw / 2 - 6); ctx.lineTo(ax1 - 9, engY + aw / 2 + 6); } else { ctx.moveTo(mx - 30, engY); ctx.lineTo(mx - 39, engY - aw / 2 - 6); ctx.lineTo(mx - 39, engY + aw / 2 + 6); } ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  ctx.font = MID; ctx.fillStyle = c.success; ctx.textAlign = rev ? "right" : "left"; ctx.textBaseline = "bottom";
  ctx.fillText(`${rev ? "|A|" : "A"} = ${fmt(A, 1)} J`, rev ? mx - 34 : mx + 34, engY - aw / 2 - 8);
  ctx.textBaseline = "top"; ctx.fillStyle = c.text; ctx.font = BOLD; ctx.textAlign = rev ? "right" : "left";
  ctx.fillText(rev ? `ε = ${fmt(d.cop, 2)}` : `η = ${fmt(d.eta * 100, 1)} %`, rev ? mx - 34 : mx + 34, engY + aw / 2 + 6);
}

function drawEngineStage(ctx, c, w, h) {
  const g = eng.g, es = engState(), narrow = w < 560;
  const k = (h - 44) / (2 * g.r + g.l + (g.Vc / g.area) + 0.05), bore = g.D * k, cx = narrow ? w * 0.38 : w * 0.24;
  const yc = h - g.r * k - 16, pinY = (th) => yc - (g.r * Math.cos(th) + Math.sqrt(g.l * g.l - (g.r * Math.sin(th)) ** 2)) * k;
  const pistonH = 0.05 * k, yHead = pinY(0) - pistonH * 0.4 - (g.Vc / g.area) * k, topP = pinY(eng.th) - pistonH * 0.4;
  const th = eng.th, TH = ((th % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI), phase = (TH % Math.PI) / Math.PI;
  // gaz
  const gasCol = es.stroke === 0 ? (c.dark ? "rgba(56,189,248,0.25)" : "rgba(14,165,233,0.2)") : es.stroke === 1 ? (c.dark ? "rgba(56,189,248,0.45)" : "rgba(14,165,233,0.38)") : es.stroke === 2 ? `rgba(249,115,22,${clamp(0.2 + (es.T / eng.Tmax) * 0.6, 0.2, 0.8)})` : (c.dark ? "rgba(148,163,184,0.45)" : "rgba(100,116,139,0.35)");
  ctx.fillStyle = gasCol; ctx.fillRect(cx - bore / 2, yHead, bore, topP - yHead);
  // silindr devorlari va kallagi
  ctx.strokeStyle = c.text2; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - bore / 2 - 2, yHead - 2); ctx.lineTo(cx - bore / 2 - 2, pinY(Math.PI) - pistonH * 0.4 + pistonH + 6); ctx.moveTo(cx + bore / 2 + 2, yHead - 2); ctx.lineTo(cx + bore / 2 + 2, pinY(Math.PI) - pistonH * 0.4 + pistonH + 6); ctx.stroke();
  ctx.fillStyle = c.dark ? "#475569" : "#94a3b8"; ctx.fillRect(cx - bore / 2 - 14, yHead - 14, bore + 28, 12);
  // klapanlar
  const lift = (on) => (on ? Math.sin(phase * Math.PI) * 8 : 0), vIn = lift(es.stroke === 0), vEx = lift(es.stroke === 3);
  [[cx - bore * 0.28, vIn, c.primary, "so‘rish"], [cx + bore * 0.28, vEx, c.text3, "chiqarish"]].forEach(([x, l, col, lab], i) => {
    ctx.strokeStyle = c.text2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, yHead - 26); ctx.lineTo(x, yHead + l); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 9, yHead + l); ctx.lineTo(x + 9, yHead + l); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.beginPath(); const sx = i ? 1 : -1; ctx.moveTo(x + sx * 34, yHead - 22); ctx.lineTo(x, yHead - 22); ctx.stroke();
    if (l > 1) { ctx.fillStyle = col; const ay = yHead - 22; ctx.beginPath(); if (!i) { ctx.moveTo(x + sx * 10, ay - 6); ctx.lineTo(x + sx * 10, ay + 6); ctx.lineTo(x + sx * 2, ay); } else { ctx.moveTo(x + sx * 38, ay - 6); ctx.lineTo(x + sx * 38, ay + 6); ctx.lineTo(x + sx * 46, ay); } ctx.closePath(); ctx.fill(); }
    if (!narrow) { ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = i ? "left" : "right"; ctx.textBaseline = "middle"; ctx.fillText(lab, x + sx * 38, yHead - 36); }
  });
  // sham va uchqun
  ctx.fillStyle = c.text2; ctx.fillRect(cx - 3, yHead - 24, 6, 22);
  if (TH > 2 * Math.PI - 0.04 && TH < 2 * Math.PI + 0.45) {
    const a = 1 - (TH - 2 * Math.PI + 0.04) / 0.49; ctx.fillStyle = `rgba(250,204,21,${a})`; ctx.beginPath();
    for (let q = 0; q < 10; q++) { const rr = q % 2 ? 5 : 13, an = (q / 10) * TAU; ctx.lineTo(cx + Math.cos(an) * rr, yHead + 6 + Math.sin(an) * rr); } ctx.closePath(); ctx.fill();
  }
  // porshen, shatun, tirsak
  ctx.fillStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.fillRect(cx - bore / 2 + 1, topP, bore - 2, pistonH);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.strokeRect(cx - bore / 2 + 1.5, topP + 0.5, bore - 3, pistonH - 1);
  const pin = { x: cx + g.r * k * Math.sin(th), y: yc - g.r * k * Math.cos(th) }, wristY = pinY(th);
  ctx.strokeStyle = c.dark ? "#475569" : "#e2e8f0"; ctx.lineWidth = 1; ctx.fillStyle = c.dark ? "#1e293b" : "#e2e8f0";
  ctx.beginPath(); ctx.arc(cx, yc, g.r * k + 12, 0, TAU); ctx.fill();
  ctx.strokeStyle = c.text2; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx, yc); ctx.lineTo(pin.x, pin.y); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(pin.x, pin.y); ctx.lineTo(cx, wristY); ctx.stroke(); ctx.lineCap = "butt";
  ctx.fillStyle = c.primary; ctx.beginPath(); ctx.arc(pin.x, pin.y, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = c.text2; ctx.beginPath(); ctx.arc(cx, yc, 5, 0, TAU); ctx.fill();
  geo.crank = { x: cx, y: yc, r: g.r * k + 16 };
  // taktlar
  const ix = narrow ? cx + bore / 2 + 24 : cx + bore / 2 + 70; if (w - ix < 120) return;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.font = "700 16px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text; ctx.fillText(`${es.stroke + 1}-takt: ${P.STROKES[es.stroke]}`, ix, 14);
  const desc = ["Porshen pastga, so‘rish klapani ochiq: yonilg‘i-havo aralashmasi kiradi", "Ikkala klapan yopiq: aralashma adiabatik siqiladi va qiziydi", "Sham uchquni aralashmani yondiradi; qizigan gaz porshenni itaradi — foydali ish", "Chiqarish klapani ochiq: ishlatilgan gazlar chiqariladi"][es.stroke];
  ctx.font = MID; ctx.fillStyle = c.text2;
  wrap(ctx, desc, ix, 38, Math.min(w - ix - 10, 260), 15);
  // 720° halqa
  const R = Math.min(46, (h - 120) / 2), rx = ix + R + 4, ry = h - R - 22;
  P.STROKES.forEach((name, q) => {
    ctx.strokeStyle = q === es.stroke ? [c.primary, c.special, c.warning, c.text3][q] : c.border; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(rx, ry, R, -Math.PI / 2 + (q * Math.PI) / 2 + 0.03, -Math.PI / 2 + ((q + 1) * Math.PI) / 2 - 0.03); ctx.stroke();
  });
  const an = -Math.PI / 2 + TH / 2; ctx.fillStyle = c.text; ctx.beginPath(); ctx.arc(rx + Math.cos(an) * R, ry + Math.sin(an) * R, 5, 0, TAU); ctx.fill();
  ctx.font = BOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${fmt((TH * 180) / Math.PI, 0)}°`, rx, ry - 6);
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.fillText("tirsak burchagi", rx, ry + 10);
  if (w - ix > 2 * R + 140) { ctx.textAlign = "left"; ctx.font = MID; P.STROKES.forEach((name, q) => { ctx.fillStyle = q === es.stroke ? c.text : c.text3; ctx.fillText(`${q + 1}. ${name} (${q * 180}–${(q + 1) * 180}°)`, rx + R + 22, ry - 30 + q * 18); }); }
}
function wrap(ctx, text, x, y, maxW, lh) {
  let line = "", yy = y;
  for (const word of text.split(" ")) { const t = line ? `${line} ${word}` : word; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = word; yy += lh; } else line = t; }
  if (line) ctx.fillText(line, x, yy);
}

function draw(ctx, st) {
  const c = st.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "proc" && proc.cur) drawProcStage(ctx, c, st.w, st.h);
  else if (ui.mode === "cycle" && cyc.data) drawCycleStage(ctx, c, st.w, st.h);
  else if (ui.mode === "engine" && eng.g) drawEngineStage(ctx, c, st.w, st.h);
}
const heights = () => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(vh * 0.44, 300, 360)), graph: Math.round(clamp(vh * 0.3, 200, 280)) };
};
const stage = createStage($("#stage"), draw, { height: () => heights().stage });

/* ------------------------------------------------------------------ Grafik */

function drawGraphCanvas(ctx, gst) {
  const c = gst.colors, g = gas();
  if (ui.mode === "proc" && proc.cur) {
    const T = procTotals();
    if (ui.tab === "en") return drawEnergy(ctx, gst, T);
    const legCol = { V: c.warning, p: c.danger, T: c.primary, Q: c.special };
    const paths = proc.legs.map((L) => ({ pts: P.legPath(g, L, 60), color: legCol[L.kind], width: 3, arrow: Math.abs(L.b.V - L.a.V) + Math.abs(L.b.T - L.a.T) > 1e-6 }));
    const fillPts = proc.legs.flatMap((L) => P.legPath(g, L, 60));
    const marks = [{ s: proc.start, label: "1", color: c.text }];
    proc.legs.forEach((L, k) => { if (k) marks.push({ s: L.a, label: String(k + 1), color: c.text2 }); });
    return drawPV(ctx, gst, {
      gas: g, vMax: 4.5e-3, pMax: proc.pMax, isotherms: [200, 300, 450, 600, 900],
      fill: Math.abs(T.A) > 0.05 ? { pts: fillPts, color: T.A >= 0 ? (c.dark ? "rgba(34,197,94,0.22)" : "rgba(22,163,74,0.16)") : (c.dark ? "rgba(239,68,68,0.2)" : "rgba(220,38,38,0.12)"), closed: false } : null,
      paths, marks, cur: proc.cur, hover: ui.hover,
      legend: [{ color: legCol[proc.kind], label: `${KIND_NAME[proc.kind]} (${KIND_LAW[proc.kind]})` }],
    });
  }
  if (ui.mode === "cycle" && cyc.data) {
    const d = cyc.data, legCol = { V: c.warning, p: c.danger, T: c.primary, Q: c.special };
    const { s } = cycState(), vMax = Math.max(...d.pts.map((q) => q.V)) * 1.12, pMax = niceMax((Math.max(...d.pts.map((q) => q.p)) * 1.1) / 1000) * 1000;
    const all = d.legs.flatMap((L) => P.legPath(g, L, 80));
    return drawPV(ctx, gst, {
      gas: g, vMax, pMax, isotherms: [d.reverse ? cyc.T1 : cyc.T1, cyc.T2],
      fill: { pts: all, closed: true, color: d.reverse ? (c.dark ? "rgba(239,68,68,0.18)" : "rgba(220,38,38,0.1)") : (c.dark ? "rgba(34,197,94,0.22)" : "rgba(22,163,74,0.15)") },
      paths: d.legs.map((L) => ({ pts: P.legPath(g, L, 80), color: legCol[L.kind], width: 3, arrow: true })),
      marks: d.pts.map((q, k) => ({ s: q, label: String(k + 1), color: c.text })), cur: s, hover: ui.hover,
      legend: [...new Set(d.legs.map((L) => L.kind))].map((kd) => ({ color: legCol[kd], label: KIND_NAME[kd] })),
    });
  }
  if (ui.mode === "engine" && eng.g) {
    const pts = eng.curve, pMax = niceMax((Math.max(...pts.map((q) => q.p)) * 1.08) / 1e6) * 1e6, es = engState(), cols = [c.primary, c.special, c.warning, c.text3];
    const byStroke = [0, 1, 2, 3].map((q) => pts.filter((x) => x.stroke === q));
    // ish yo'li boshida izoxorik yonish chizig'i va chiqarishdan oldingi bosim tushishi
    byStroke[2].unshift(byStroke[1][byStroke[1].length - 1]); byStroke[3].unshift(byStroke[2][byStroke[2].length - 1]);
    return drawPV(ctx, gst, {
      gas: { nu: eng.g.nu, i: 5 }, vMax: eng.g.Vmax * 1.1, pMax, pDiv: 1e6, pUnit: "MPa", isotherms: [],
      fill: { pts: [...byStroke[1], ...byStroke[2]], closed: true, color: c.dark ? "rgba(34,197,94,0.2)" : "rgba(22,163,74,0.14)" },
      paths: byStroke.map((q, k) => ({ pts: q, color: cols[k], width: k === 0 || k === 3 ? 4 : 2.8, dash: k === 3 ? [6, 4] : null, arrow: k === 1 || k === 2 })),
      marks: [], cur: es, hover: ui.hover, hoverT: false,
      legend: P.STROKES.map((n, k) => ({ color: cols[k], label: n, dash: k === 3 ? [6, 4] : null })),
    });
  }
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });

const TABS = {
  proc: { pv: ["p–V diagramma", "Jarayon chizig‘i ostidagi yuza — gaz bajargan ish A (yashil — kengayish, A > 0; qizil — siqish, A < 0). Shtrix chiziqlar — izotermalar. Kursor bilan p, V va T ni o‘qing."], en: ["1-qonun: Q = ΔU + A", "Gazga berilgan issiqlik ichki energiyani oshirishga va ish bajarishga sarflanadi. Barcha jarayonlar 1-holatdan hisoblanadi."] },
  cycle: { pv: ["Sikl p–V diagrammasi", "Sikl ichidagi yuza — bir siklda bajarilgan foydali ish A. Soat mili bo‘yicha aylanish — dvigatel (A > 0), teskari — sovutgich (A < 0). Shtrix — T₁ va T₂ izotermalari."] },
  engine: { pv: ["Indikator diagramma (ideal Otto)", "Ko‘k — so‘rish, binafsha — siqish, to‘q sariq — ish yo‘li, kulrang shtrix — chiqarish. Yopiq yuza — bir sikl ishi. Haqiqiy dvigatelda burchaklar silliqroq va yuza kichikroq."] },
};
const TAB_LABEL = { pv: "p–V", en: "Energiya" };
function setTab(tab) {
  ui.tab = TABS[ui.mode][tab] ? tab : "pv";
  const t = TABS[ui.mode][ui.tab], keys = Object.keys(TABS[ui.mode]);
  $("[data-tabs]").innerHTML = keys.length > 1 ? keys.map((k) => `<button type="button" data-tab-value="${k}" aria-pressed="${k === ui.tab}">${TAB_LABEL[k]}</button>`).join("") : "";
  $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1];
  graph.canvas.setAttribute("aria-label", t[0]); graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (b) setTab(b.dataset.tabValue); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, unit) => `${v}<small>${unit}</small>`;
const sgn = (v, d = 1) => (v >= 0.5 * 10 ** -d ? "+" : "") + fmt(v, d);

function updateReadouts() {
  const g = gas();
  if (ui.mode === "proc") {
    const s = proc.cur, s0 = proc.start, T = procTotals();
    setRO("r1", "Bosim <i>p</i>", u(fmt(s.p / 1000, 1), "kPa"), `boshida ${fmt(s0.p / 1000, 1)} kPa`);
    setRO("r2", "Hajm <i>V</i>", u(fmt(s.V * 1000, 2), "L"), `boshida ${fmt(s0.V * 1000, 2)} L`);
    setRO("r3", "Temperatura <i>T</i>", u(fmt(s.T, 0), "K"), `= ${fmt(s.T - 273.15, 0)} °C; boshida ${fmt(s0.T, 0)} K`);
    setRO("r4", "Ichki energiya o‘zgarishi <i>ΔU</i>", u(sgn(T.dU), "J"), `U = (${g.i}/2)νRT = ${fmt(P.energy(g, s.T), 0)} J`);
    setRO("r5", "Gaz bajargan ish <i>A</i>", u(sgn(T.A), "J"), T.A > 0.05 ? "gaz kengayib ish bajardi" : T.A < -0.05 ? "tashqi kuchlar gaz ustida ish bajardi" : "hajm o‘zgarmadi — ish nolga teng");
    setRO("r6", "Issiqlik miqdori <i>Q</i>", u(sgn(T.Q), "J"), T.Q > 0.05 ? "gaz issiqlik oldi" : T.Q < -0.05 ? "gaz issiqlik berdi" : "issiqlik almashinuvi yo‘q", "orange");
    return;
  }
  if (ui.mode === "cycle") {
    const d = cyc.data, { j, s } = cycState(), L = d.legs[j];
    if (d.reverse) {
      setRO("r1", "Sovitkichdan olingan <i>Q₂</i>", u(fmt(d.Qin, 1), "J"), "bir siklda (muzlatgich ichidan)");
      setRO("r2", "Sarflangan ish <i>|A|</i>", u(fmt(-d.A, 1), "J"), "kompressor bajargan ish");
      setRO("r3", "Isitkichga berilgan <i>Q₁</i>", u(fmt(d.Qout, 1), "J"), "Q₁ = Q₂ + |A| (xonaga)");
      setRO("r4", "Sovitish koeffitsiyenti <i>ε</i>", u(fmt(d.cop, 2), ""), "ε = Q₂/|A|", "orange");
      setRO("r5", "Karno chegarasi", u(fmt(d.copC, 2), ""), "ε_max = T₂/(T₁ − T₂)");
    } else {
      setRO("r1", "Isitkichdan olingan <i>Q₁</i>", u(fmt(d.Qin, 1), "J"), "bir siklda");
      setRO("r2", "Sovitkichga berilgan <i>|Q₂|</i>", u(fmt(d.Qout, 1), "J"), "bir siklda");
      setRO("r3", "Foydali ish <i>A</i>", u(fmt(d.A, 1), "J"), "A = Q₁ − |Q₂| = sikl yuzasi");
      setRO("r4", "FIK <i>η</i>", u(fmt(d.eta * 100, 1), "%"), "η = A/Q₁", "orange");
      setRO("r5", "Karno chegarasi <i>η<sub>max</sub></i>", u(fmt(d.etaC * 100, 1), "%"), "η_max = 1 − T₂/T₁ (shu T₁, T₂ da)");
    }
    setRO("r6", `Hozir: ${j + 1}→${(j + 1) % 4 + 1}`, u(fmt(s.T, 0), "K"), `${KIND_NAME[L.kind]}: Q = ${sgn(L.Q)} J, A = ${sgn(L.A)} J`);
    return;
  }
  const es = engState(), pw = P.enginePower(eng.g, 5, eng.Tmax, eng.rpm);
  setRO("r1", "Takt", `${es.stroke + 1}. ${P.STROKES[es.stroke]}`, `tirsak burchagi ${fmt((((eng.th % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI)) * 180 / Math.PI, 0)}°`);
  setRO("r2", "Hajm va bosim", u(`${fmt(es.V * 1e6, 0)} cm³ · ${fmt(es.p / 1e6, 2)}`, "MPa"), `V_c = ${fmt(eng.g.Vc * 1e6, 0)} cm³, V_d = ${fmt(eng.g.Vd * 1e6, 0)} cm³`);
  setRO("r3", "Gaz temperaturasi", u(fmt(es.T, 0), "K"), es.stroke === 1 ? "siqilganda qiziydi" : es.stroke === 2 ? "kengayganda soviydi" : "atrof havo");
  setRO("r4", "Ideal FIK <i>η</i>", u(fmt(pw.cyc.eta * 100, 1), "%"), `η = 1 − ε^(1−γ), ε = ${fmt(eng.eps, 1)}`, "orange");
  setRO("r5", "Bir sikl ishi <i>A</i>", u(fmt(pw.A, 0), "J"), `Q₁ = ${fmt(pw.cyc.Qin, 0)} J yonilg‘idan`);
  setRO("r6", "Quvvat (1 silindr)", u(fmt(pw.P / 1000, 1), "kW"), `N = A·n/2, n = ${fmt(eng.rpm, 0)} ayl/min`);
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "proc") { const T = procTotals(); t = proc.kind === "Q" ? "Issiqlik izolyatsiyasi: Q = 0" : Math.abs(T.Q) < 0.05 ? "Porshenni yoki termometrni suring" : T.Q > 0 ? "Gaz issiqlik oldi" : "Gaz issiqlik berdi"; tone = Math.abs(T.Q) < 0.05 ? "blue" : T.Q > 0 ? "orange" : "purple"; }
  else if (ui.mode === "cycle") { const { j } = cycState(), L = cyc.data.legs[j]; t = L.kind === "Q" ? "Adiabatik: izolyatsiyada" : L.Q > 0 ? "Gaz issiqlik oladi" : "Gaz issiqlik beradi"; tone = L.kind === "Q" ? "purple" : L.Q > 0 ? "orange" : "blue"; }
  else { const es = engState(); t = `${es.stroke + 1}-takt: ${P.STROKES[es.stroke]}`; tone = ["blue", "purple", "orange", "green"][es.stroke]; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "proc") {
    const k = proc.kind, T = procTotals();
    p.push("<p><b>Ichki energiya</b> — gaz molekulalari issiqlik harakatining kinetik energiyasi. Ideal gazda u faqat temperaturaga bog‘liq: U = (i/2)νRT. Temperatura ortsa — molekulalar tezroq harakatlanadi (animatsiyada ranglari qizaradi).</p>");
    p.push({
      V: "<p><b>Izoxorik</b> (V = const): porshen mahkamlangan, gaz ish bajarmaydi (A = 0). Berilgan hamma issiqlik ichki energiyaga aylanadi: Q = ΔU. Termometrni surib gazni qizdiring yoki sovuting.</p>",
      p: "<p><b>Izobarik</b> (p = const): porshen ustidagi yuk bosimni o‘zgarmas tutadi. Qizdirilganda gaz kengayadi va ish bajaradi: A = p·ΔV. Issiqlikning bir qismi ichki energiyaga, qolgani ishga sarflanadi: Q = ΔU + A.</p>",
      T: "<p><b>Izotermik</b> (T = const): silindr termostatda. Ichki energiya o‘zgarmaydi (ΔU = 0), shuning uchun Q = A: kengayganda gaz issiqlik oladi va hammasini ishga sarflaydi, siqilganda issiqlik beradi.</p>",
      Q: "<p><b>Adiabatik</b> (Q = 0): silindr issiqlik o‘tkazmaydi. Gaz ish bajarsa, faqat ichki energiyasi hisobidan: A = −ΔU — kengayganda soviydi, siqilganda qiziydi (velosiped nasosi qiziydi; dizel dvigatelida havo siqilib, yonilg‘i o‘z-o‘zidan alangalanadi).</p>",
    }[k]);
    if (proc.legs.length > 1) p.push(`<p>Bir nechta jarayon ketma-ket bajarildi. Jami: Q = ${fmt(T.Q, 1)} J, ΔU = ${fmt(T.dU, 1)} J, A = ${fmt(T.A, 1)} J. Gazni boshlang‘ich holatga (1-nuqta) qaytarsangiz — ΔU = 0, yopiq yo‘l ichidagi yuza esa sikl ishi.</p>`);
  } else if (ui.mode === "cycle") {
    const d = cyc.data;
    if (d.reverse) p.push(`<p><b>Sovutgich</b> (muzlatgich, konditsioner) siklni teskari yo‘nalishda o‘taydi: tashqi ish |A| hisobiga sovuq jismdan Q₂ issiqlik olib, issiqroq muhitga Q₁ = Q₂ + |A| beradi. Sovitish koeffitsiyenti ε = Q₂/|A| = ${fmt(d.cop, 2)} — 1 J elektr energiyasi ${fmt(d.cop, 1)} J issiqlikni «tashib» chiqaradi.</p>`);
    else {
      p.push(`<p><b>Issiqlik dvigateli</b> isitkichdan Q₁ issiqlik oladi, uning bir qismini foydali ishga aylantiradi, qolganini (|Q₂|) sovitkichga beradi. FIK η = A/Q₁ = ${fmt(d.eta * 100, 1)} %. Sovitkichsiz dvigatel ishlay olmaydi — bu termodinamikaning 2-qonuni.</p>`);
      p.push(cyc.name === "karno" ? "<p><b>Karno sikli</b> — ikki izoterma va ikki adiabatadan iborat. Berilgan T₁ va T₂ oralig‘ida ishlaydigan dvigatellar ichida uning FIK eng katta: η = 1 − T₂/T₁. FIKni oshirish uchun T₁ ni ko‘tarish yoki T₂ ni pasaytirish kerak.</p>" : cyc.name === "otto" ? `<p><b>Otto sikli</b> — benzin dvigatelining ideal modeli: adiabatik siqish, yonish (V = const), adiabatik kengayish, chiqarish. FIK faqat siqish darajasiga bog‘liq: η = 1 − ε^(1−γ). Xuddi shu T₁, T₂ da Karno FIK ${fmt(d.etaC * 100, 1)} % — undan kichik.</p>` : `<p>Bu siklda issiqlik har xil temperaturada olinadi va beriladi, shuning uchun FIK (${fmt(d.eta * 100, 1)} %) xuddi shu T₁, T₂ oralig‘idagi Karno FIKidan (${fmt(d.etaC * 100, 1)} %) ancha kichik.</p>`);
    }
  } else {
    p.push("<p><b>To‘rt taktli ichki yonuv dvigateli</b>: bir ish sikli tirsakli valning ikki aylanishida (720°) bajariladi. Faqat 3-taktda (ish yo‘li) gaz porshenni itarib foydali ish bajaradi; qolgan taktlarda val maxovik inersiyasi bilan aylanadi.</p>");
    p.push(`<p>Siqish darajasi ε = ${fmt(eng.eps, 1)}: ideal FIK ${fmt((1 - eng.eps ** -0.4) * 100, 1)} %. ε ni oshirsangiz FIK ortadi, lekin benzin dvigatelida juda katta siqishda aralashma o‘z-o‘zidan portlab yonadi (detonatsiya), shuning uchun ε ≈ 8–12. Dizel dvigatelida ε = 15–22.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "proc" ? "<small>1-qonun</small> Q = ΔU + A" : ui.mode === "cycle" ? (cyc.data?.reverse ? "<small>Sovutgich</small> ε = Q₂/|A|" : "<small>FIK</small> η = A/Q₁ ≤ 1 − T₂/T₁") : "<small>Otto</small> η = 1 − ε<sup>1−γ</sup>";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
function stepMolecules(dt, T) {
  const sp = 0.55 * Math.sqrt(T / 300);
  for (const m of mol) {
    m.x += Math.cos(m.a) * sp * dt; m.y += Math.sin(m.a) * sp * dt;
    if (m.x < 0) { m.x = -m.x; m.a = Math.PI - m.a; } if (m.x > 1) { m.x = 2 - m.x; m.a = Math.PI - m.a; }
    if (m.y < 0) { m.y = -m.y; m.a = -m.a; } if (m.y > 1) { m.y = 2 - m.y; m.a = -m.a; }
  }
}
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "proc") { stepMolecules(dt, proc.cur.T); proc.flowT = Math.max(0, proc.flowT - dt); }
  else if (ui.mode === "cycle") {
    cyc.u += dt * ui.speed * 0.6; if (cyc.u >= 4) { cyc.u -= 4; cyc.laps++; }
    const { j, s } = cycState(), tx = cycleStationX(station(cyc.data.legs[j]));
    if (tx !== null) cyc.cylX += (tx - cyc.cylX) * Math.min(1, dt * 8);
    stepMolecules(dt, s.T);
  } else { eng.th += dt * ui.speed * Math.PI; if (eng.th > 4 * Math.PI * 1000) eng.th -= 4 * Math.PI * 1000; }
  stage.render(); graph.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); }
}, { onStateChange: setPlayUI });
function cycleStationX(k) {
  const w = stage.w, narrow = w < 600, cw = Math.min(84, w * (narrow ? 0.2 : 0.13)), x1 = narrow ? w * 0.2 : w * 0.12 + 10;
  return w ? x1 + k * cw * 1.32 : null;
}
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : ui.mode === "proc" ? "Molekulalar" : "Boshlash";
}
playBtn.addEventListener("click", () => { if (loop.running) loop.stop(); else if (!prefersReducedMotion() || ui.mode !== "proc") loop.start(); });
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "proc") { resetProc(proc.start.V, proc.start.T); syncProcCtl(); }
  else if (ui.mode === "cycle") { cyc.u = 0; cyc.cylX = null; }
  else eng.th = 0;
  ui.hover = null; refresh();
});
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => {
  ui.speed = +b.dataset.speedValue; syncSpeed();
}));
const syncSpeed = () => document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.speedValue === ui.speed)));

/* ------------------------------------------------------------------ Boshqaruv */

const gasSel = $("#gas");
gasSel.innerHTML = Object.entries(P.GASES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("");
gasSel.addEventListener("change", () => { gasState.key = gasSel.value; customized(); if (ui.mode === "proc") { resetProc(proc.start.V, proc.start.T); syncProcCtl(); } else { buildCycle(); syncCycleCtl(); } refresh(); });

const pVC = bindRange($("#pV"), $("#pVOut"), (v) => `${fmt(v, 2)} L`, (v) => { customized(); applyTarget({ V: v / 1000 }); });
const pTC = bindRange($("#pT"), $("#pTOut"), (v) => `${fmt(v, 0)} K`, (v) => { customized(); applyTarget({ T: v }); });
document.querySelectorAll("[data-kind-value]").forEach((b) => b.addEventListener("click", () => { setKind(b.dataset.kindValue); customized(); syncProcCtl(); refresh(); }));
function syncProcCtl() {
  pVC.set(+(proc.cur.V * 1000).toFixed(2)); pTC.set(Math.round(proc.cur.T));
  $("#pV").disabled = proc.kind === "V"; $("#pT").disabled = proc.kind === "T";
  document.querySelectorAll("[data-kind-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kindValue === proc.kind)));
  $("[data-kind-note]").textContent = {
    V: "Porshen mahkamlangan. Sahnadagi termometrni yuqoriga/pastga surib gazni qizdiring yoki sovuting.",
    p: "Porshen dastasini yoki termometrni suring: qizdirilganda gaz kengayadi, bosim o‘zgarmaydi.",
    T: "Silindr termostatda. Porshen dastasini surib gazni siqing yoki kengaytiring.",
    Q: "Silindr issiqlik o‘tkazmaydi. Porshenni suring — siqilganda gaz qiziydi, kengayganda soviydi.",
  }[proc.kind] + " Jarayon turini almashtirsangiz, yangi jarayon shu holatdan davom etadi.";
}

const cycSel = $("#cyc");
cycSel.innerHTML = Object.entries(P.CYCLES).map(([k, v]) => `<option value="${k}">${v.title}</option>`).join("");
cycSel.addEventListener("change", () => { cyc.name = cycSel.value; customized(); buildCycle(); syncCycleCtl(); refresh(); });
const cT1C = bindRange($("#cT1"), $("#cT1Out"), (v) => `${fmt(v, 0)} K`, (v) => { cyc.T1 = v; customized(); buildCycle(); syncCycleCtl(); refresh(); });
const cT2C = bindRange($("#cT2"), $("#cT2Out"), (v) => `${fmt(v, 0)} K`, (v) => { cyc.T2 = v; customized(); buildCycle(); syncCycleCtl(); refresh(); });
const cRC = bindRange($("#cR"), $("#cROut"), (v) => fmt(v, 1), (v) => { cyc.r = v; customized(); buildCycle(); syncCycleCtl(); refresh(); });
function syncCycleCtl() {
  cycSel.value = cyc.name; cT1C.set(cyc.T1); cT2C.set(cyc.T2); cRC.set(+cyc.r.toFixed(1));
  $("[data-r-label]").textContent = P.CYCLES[cyc.name].rLabel;
}

const eEC = bindRange($("#eE"), $("#eEOut"), (v) => fmt(v, 1), (v) => { eng.eps = v; customized(); buildEngine(); refresh(); });
const eTC = bindRange($("#eT"), $("#eTOut"), (v) => `${fmt(v, 0)} K`, (v) => { eng.Tmax = v; customized(); buildEngine(); refresh(); });
const eNC = bindRange($("#eN"), $("#eNOut"), (v) => `${fmt(v, 0)} ayl/min`, (v) => { eng.rpm = v; customized(); refresh(); });

/* Sahnada: porshen, termometr, bloklar, tirsak */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function hit(p) {
  if (ui.mode === "proc") {
    const k = geo.knob, t = geo.thermo, G = geo.cyl;
    if (proc.kind !== "V" && k && (Math.hypot(p.x - k.x, p.y - k.y) <= k.r || (Math.abs(p.x - G.cx) <= G.cw / 2 && Math.abs(p.y - (k.py - 7)) <= 14))) return { kind: "piston", off: p.y - k.py };
    if (proc.kind !== "T" && t && Math.abs(p.x - t.x) <= 22 && p.y >= t.y0 - 12 && p.y <= t.y1 + 22) return { kind: "thermo" };
  } else if (ui.mode === "cycle") {
    const b = (geo.blocks || []).find((q) => p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h);
    if (b) return { kind: "block", k: b.k, y0: p.y, T0: b.k === 0 ? cyc.T1 : cyc.T2 };
  } else if (geo.crank && Math.hypot(p.x - geo.crank.x, p.y - geo.crank.y) <= geo.crank.r + 10) return { kind: "crank" };
  return null;
}
function dragTo(p) {
  if (drag.kind === "piston") applyTarget({ V: clamp(geo.cyl.vOf(p.y - drag.off), LIM.V[0], LIM.V[1]) });
  else if (drag.kind === "thermo") { const t = geo.thermo, T = LIM.T[0] + ((t.y1 - clamp(p.y, t.y0, t.y1)) / (t.y1 - t.y0)) * (LIM.T[1] - LIM.T[0]); applyTarget({ T: Math.round(T / 5) * 5 }); }
  else if (drag.kind === "block") {
    const T = Math.round((drag.T0 + (drag.y0 - p.y) * 4) / 10) * 10;
    if (drag.k === 0) cyc.T1 = clamp(T, 250, 2500); else cyc.T2 = clamp(T, 150, 600);
    buildCycle(); syncCycleCtl(); refresh();
  } else if (drag.kind === "crank") {
    const a = Math.atan2(p.x - geo.crank.x, -(p.y - geo.crank.y)), base = eng.th - (((eng.th % TAU) + TAU) % TAU);
    let th = base + ((a + TAU) % TAU); if (th - eng.th > Math.PI) th -= TAU; if (eng.th - th > Math.PI) th += TAU;
    eng.th = Math.max(0, th); refresh();
  }
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p);
  if (!h) return;
  drag = h; customized();
  if (h.kind === "crank" && loop.running) loop.stop();
  e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  canvas.dataset.dragging = "true";
  if (h.kind !== "piston" && h.kind !== "block") dragTo(p);
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (drag) { dragTo(p); return; }
  const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "crank" ? "grab" : "ns-resize";
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* Grafikda kursor */
const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => {
  const f = lastFrame(); if (!f) { ui.hover = null; return; }
  const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  ui.hover = inside ? { V: f.toV(p.x), p: f.toP(p.y) } : null;
  gcv.style.cursor = inside ? "crosshair" : ""; graph.render();
});
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  internal: { mode: "proc", title: "Ichki energiya: qizdirish", lesson: "Porshen mahkamlangan (V = const). Gaz 300 K dan 450 K gacha qizdirildi: molekulalar tezlashdi, ichki energiya ortdi, ish esa bajarilmadi (A = 0) — Q = ΔU. Termometrni surib davom eting.", set: () => setProc("he", "V", 2e-3, 300, { T: 450 }) },
  isobar: { mode: "proc", title: "Izobarik kengayish: A = p·ΔV", lesson: "Yuk bosimni o‘zgarmas tutadi. Gaz qizdirilganda 2 L dan 3,5 L gacha kengaydi: ish A = p·ΔV — p–V diagrammadagi to‘rtburchak yuzasi. Energiya ustunlarida Q = ΔU + A ni tekshiring.", set: () => setProc("air", "p", 2e-3, 300, { V: 3.5e-3 }) },
  isotherm: { mode: "proc", title: "Izotermik siqish", lesson: "Termostatdagi gaz sekin siqildi: temperatura o‘zgarmadi (ΔU = 0), gaz ustida bajarilgan ish butunlay issiqlik bo‘lib termostatga o‘tdi (Q = A < 0). Bosim hajmga teskari proporsional — giperbola.", set: () => setProc("air", "T", 3.5e-3, 300, { V: 1.4e-3 }) },
  adiabC: { mode: "proc", title: "Adiabatik siqish: havo qiziydi", lesson: "Issiqlik o‘tkazmaydigan silindrda havo 3,5 L dan 1 L gacha siqildi: Q = 0, bajarilgan ish ichki energiyaga aylandi va temperatura ≈ 500 K gacha ko‘tarildi. Adiabata izotermadan tikroq.", set: () => setProc("air", "Q", 3.5e-3, 300, { V: 1e-3 }) },
  adiabE: { mode: "proc", title: "Adiabatik kengayish: sovish", lesson: "Qizdirilgan gaz izolyatsiyada kengaydi: ishni faqat ichki energiyasi hisobidan bajardi va soviydi (A = −ΔU). Bulutlar shunday hosil bo‘ladi — ko‘tarilgan havo kengayib soviydi.", set: () => setProc("air", "Q", 1e-3, 600, { V: 3.5e-3 }) },
  helium: { mode: "proc", title: "Bir atomli gaz: geliy", lesson: "Geliyda (i = 3) issiqlikning 60 % i ichki energiyaga, 40 % i ishga ketadi; havoda (i = 5) — 71 % va 29 %. Gazni almashtirib, izobarik kengayishda Q, ΔU va A ni solishtiring.", set: () => setProc("he", "p", 2e-3, 300, { V: 3.5e-3 }), tab: "en" },
  karno: { mode: "cycle", title: "Karno sikli", lesson: "Ikki izoterma (isitkich va sovitkichga tegib) va ikki adiabata (izolyatsiyada). FIK = 1 − T₂/T₁ = 50 %. Isitkich yoki sovitkich blokini sahnada surib, FIK qanday o‘zgarishini kuzating.", set: () => setCycle("he", "karno", 600, 300, 2.5) },
  karnoCold: { mode: "cycle", title: "Karno: sovitkichni sovutish", lesson: "Sovitkich 300 K dan 150 K gacha sovutildi — FIK 50 % dan 75 % gacha ortdi. Lekin 100 % ga yetib bo‘lmaydi: buning uchun T₂ = 0 K kerak.", set: () => setCycle("he", "karno", 600, 150, 2.5) },
  rect: { mode: "cycle", title: "To‘rtburchak sikl", lesson: "Ikki izobara va ikki izoxora. Sikl yuzasi Δp·ΔV ga teng. Issiqlik turli temperaturalarda olingani uchun FIK shu T₁, T₂ dagi Karno FIKidan ancha kichik.", set: () => setCycle("he", "rect", 900, 300, 2) },
  otto: { mode: "cycle", title: "Otto sikli", lesson: "Benzin dvigatelining ideal sikli: siqish (adiabata), yonish (izoxora), kengayish (adiabata), chiqarish (izoxora). ε = 8 da η = 1 − 8^(−0,4) ≈ 56 %.", set: () => setCycle("air", "otto", 1800, 300, 8) },
  fridge: { mode: "cycle", title: "Sovutgich (teskari Karno)", lesson: "Sikl teskari yo‘nalishda: kompressor ish bajaradi, gaz sovuq kameradan (260 K) issiqlik olib, xonaga (300 K) beradi. ε = T₂/(T₁ − T₂) = 6,5 — 1 J ishga 6,5 J issiqlik ko‘chiriladi.", set: () => setCycle("he", "rev", 300, 260, 2) },
  otto4: { mode: "engine", title: "To‘rt taktli dvigatel", lesson: "So‘rish → siqish → ish yo‘li → chiqarish: ikki aylanishda bitta ish sikli. Tirsakli valni sahnada aylantirib, har taktda klapanlar va p–V diagrammadagi nuqtani kuzating.", set: () => Object.assign(eng, { eps: 9, Tmax: 2400, rpm: 3000, th: 0 }), speed: 1 },
  highEps: { mode: "engine", title: "Yuqori siqish darajasi", lesson: "ε = 12: siqish oxirida havo ko‘proq qiziydi, ideal FIK 63 % gacha ortadi va bir sikl ishi ko‘payadi. Benzin uchun bu chegaraga yaqin (detonatsiya).", set: () => Object.assign(eng, { eps: 12, Tmax: 2400, rpm: 3000, th: 0 }), speed: 1 },
  slow: { mode: "engine", title: "Sekin: taktlarni kuzatish", lesson: "Animatsiya 4 marta sekinlashtirildi. Klapanlar qachon ochilishini, sham qachon uchqun berishini va gaz rangi (aralashma → yonish → chiqindi gaz) qanday o‘zgarishini kuzating.", set: () => Object.assign(eng, { eps: 9, Tmax: 2400, rpm: 3000, th: 0 }), speed: 0.25 },
};
function setProc(gk, kind, V, T, to) {
  gasState.key = gk; proc.kind = kind; resetProc(V, T);
  if (to) { const flow = proc.flow; applyTarget(to); proc.flowT = 0; proc.flow = flow; }
}
function setCycle(gk, name, T1, T2, r) { gasState.key = gk; Object.assign(cyc, { name, T1, T2, r, u: 0, cylX: null }); buildCycle(); }

const GROUPS = [["1-qonun: jarayonlar", ["internal", "isobar", "isotherm", "adiabC", "adiabE", "helium"]], ["Sikllar va FIK", ["karno", "karnoCold", "rect", "otto", "fridge"]], ["Dvigatel", ["otto4", "highEps", "slow"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { proc: "Porshen dastasini yoki termometrni suring", cycle: "Isitkich va sovitkich bloklarini suring", engine: "Tirsakli valni aylantiring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = !el.dataset.tool.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { proc: "Porshenli silindrdagi gaz, termometr va issiqlik manbai", cycle: "Silindr isitkich, izolyatsiya va sovitkich ustida; energiya oqimi sxemasi", engine: "To‘rt taktli ichki yonuv dvigateli: porshen, shatun, tirsakli val, klapanlar" }[ui.mode]);
}
function syncAll() {
  gasSel.value = gasState.key; syncProcCtl(); syncCycleCtl();
  eEC.set(eng.eps); eTC.set(eng.Tmax); eNC.set(eng.rpm); syncSpeed();
}
const MODE_DEFAULT = { proc: "isobar", cycle: "karno", engine: "otto4" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null;
  ui.mode = p.mode; p.set();
  if (p.mode === "engine") buildEngine();
  ui.speed = p.speed ?? 1;
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || "pv");
  setPlayUI(loop.running);
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

resetProc(); buildCycle(); buildEngine();
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "isobar");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
