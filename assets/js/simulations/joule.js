// ==========================================================================
// Tok ishi, quvvati va Joul–Lens qonuni — virtual laboratoriya (simulations/joule.html)
// 1) Joul–Lens: laboratoriya manbai, pichoqli kalit, ampermetr, voltmetr va suvli kalorimetr(lar) ichidagi nixrom spiral.
//    Termometr va sekundomer bo'yicha ΔT(t); spirallar bitta, ketma-ket (Q ∝ R) yoki parallel (Q ∝ 1/R); FIK.
// 2) Lampa quvvati: LATR (laboratoriya avtotransformatori), o'zgaruvchan tok voltmetri va ampermetri, patronlardagi
//    cho'g'lanma lampalar; tola temperaturasi bo'yicha rang va yorqinlik, 40 W va 100 W ketma-ket/parallel.
// 3) Uy tarmog'i: impulsli elektr hisoblagich (kVt·soat), avtomat saqlagich, parallel ulangan maishiy iste'molchilar.
// Dunyo koordinatalari 520×300 (shartli birlik). Fizika: joule-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { analogMeter, powerSupply, knifeSwitch, stopwatch, wire, terminal } from "./instruments.js";
import { tempRGB } from "./bb-physics.js";
import * as P from "./joule-physics.js";
import { drawHeat, drawLamp, drawLine, lastFrame } from "./joule-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const SUB = "₁₂";

/* ------------------------------------------------------------------ Holat */

const WORLD = [520, 300];
const R_INT = 0.3, CUP_M = 0.05, METER0 = 4521.3, IMP = 3200, TY = 146;
const LAMP_X = [340, 440];
const ui = { mode: "kal", view: { kal: "T", lamp: "I", home: "I" }, hover: null, speed: 10 };
const kal = { E: 8, R1: 2, R2: 4, m: 150, conn: "single", closed: false, t: 0, T: [P.T_ROOM, P.T_ROOM], Qe: [0, 0], hist: [], histT: 0 };
const lamp = { a: "l40", b: "none", conn: "series", U: 220 };
const HOME_IDS = ["kettle", "iron", "heater", "washer", "ac", "fridge", "tv", "pc", "lamp", "led"];
const SHORT = { kettle: "Choynak", iron: "Dazmol", heater: "Isitgich", washer: "Kir mashina", ac: "Konditsioner", fridge: "Muzlatkich", tv: "Televizor", pc: "Kompyuter", lamp: "Lampa", led: "LED lampa" };
const home = { on: {}, In: 16, tariff: 1000, t: 0, E: 0, acc: 0, tripped: false, why: "", hist: [], histT: 0, pulse: 0, pulses: 0, flow: 0 };
let presetId = null;
let running = false;
let CW = 800, anim = 0;
const hits = {};

/* ------------------------------------------------------------------ Dunyo → ekran */

const view = { s: 1, ox: 0, oy: 0 };
function fit(w, h, pad = 4) {
  const [W, H] = WORLD, s = Math.min((w - 2 * pad) / W, (h - 2 * pad) / H);
  view.s = s; view.ox = (w - W * s) / 2; view.oy = (h - H * s) / 2;
}
const X = (x) => view.ox + x * view.s, Y = (y) => view.oy + y * view.s;
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s, y: (py - view.oy) / view.s });
const wd = ([x, y]) => [(x - view.ox) / view.s, (y - view.oy) / view.s];
const S = (pts) => pts.map(([x, y]) => [X(x), Y(y)]);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(X(x), Y(y), w * view.s, h * view.s, r * view.s); };

const COL = (c) => ({ red: c.dark ? "#f87171" : "#b91c1c", black: c.dark ? "#cbd5e1" : "#1f2937", blue: c.dark ? "#60a5fa" : "#1d4ed8", yellow: c.dark ? "#facc15" : "#a16207", brown: c.dark ? "#d6a77a" : "#92400e" });
function label(ctx, c, text, x, y, align = "left", color) {
  ctx.font = SMALL;
  const w = ctx.measureText(text).width + 8;
  const x0 = clamp(align === "center" ? x - w / 2 : align === "right" ? x - w : x, 2, CW - 2 - w);
  tag(ctx, text, x0, y, { color: color || c.text2, bg: c.bg2, font: SMALL, pad: 4 });
}
function table(ctx, c, y) {
  const g = ctx.createLinearGradient(0, Y(y), 0, Y(WORLD[1]));
  g.addColorStop(0, c.dark ? "#57534e" : "#d6d3d1"); g.addColorStop(1, c.dark ? "#292524" : "#a8a29e");
  ctx.fillStyle = g; ctx.fillRect(X(0), Y(y), WORLD[0] * view.s, (WORLD[1] - y) * view.s);
}
const RANGES = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
const range = (v) => RANGES.find((r) => r >= v * 1.04) || 20;
const meterOpt = (r) => { const m = Math.round(r / 10 ** Math.floor(Math.log10(r) + 1e-9)), two = m === 2 || (m === 1 && r < 1); return { max: r, ticks: two ? 2 : 5, digits: two ? (r < 0.2 ? 2 : r < 2 ? 1 : 0) : r < 1 ? 1 : r < 10 && m === 1 ? 1 : 0 }; };
const rangeText = (r) => `0–${fmt(r, r < 1 ? 1 : 0)} A`;

/* ------------------------------------------------------------------ 1) Kalorimetr */

const kalN = () => (kal.conn === "single" ? 1 : 2);
const kalC = () => P.heatCapacity(kal.m / 1000, CUP_M);
const cupsX = () => (kalN() === 1 ? [330] : [270, 420]);
function kalCirc() {
  const h = P.heaters(kal.E, R_INT, [kal.R1, kal.R2], kal.conn);
  if (kal.closed) return h;
  return { I: 0, U: 0, R: h.R, parts: h.parts.map((p) => ({ R: p.R, I: 0, U: 0, P: 0 })) };
}
function pushKal() {
  const n = kalN(), C = kalC();
  kal.hist.push({ t: kal.t, T: kal.T.slice(0, n), Qe: kal.Qe.slice(0, n), Qa: kal.T.slice(0, n).map((T) => C * (T - P.T_ROOM)) });
  kal.histT = kal.t;
  if (kal.hist.length > 1200) kal.hist = kal.hist.filter((_, i, a) => i % 2 === 0 || i === a.length - 1);
}
function resetKal() { kal.t = 0; kal.T = [P.T_ROOM, P.T_ROOM]; kal.Qe = [0, 0]; kal.hist = []; pushKal(); }
function stepKal(dt) {
  if (!kal.closed) return;
  const h = kalCirc(), C = kalC();
  h.parts.forEach((p, i) => { kal.T[i] = Math.min(P.BOIL, P.stepTemp(kal.T[i], dt, p.P, C)); kal.Qe[i] += p.P * dt; });
  kal.t += dt;
  if (kal.t - kal.histT >= Math.max(1, kal.t / 400)) pushKal();
}

function calorimeter(ctx, c, cx, i, part, T) {
  const s = view.s, depth = 40 + (60 * (kal.m - 50)) / 250, surf = 269 - depth;
  // tashqi alyuminiy idish (kesimda): devorlar, havo qatlami, probka halqa
  const metal = (x0, x1) => { const g = ctx.createLinearGradient(X(x0), 0, X(x1), 0); g.addColorStop(0, c.dark ? "#64748b" : "#94a3b8"); g.addColorStop(0.5, c.dark ? "#cbd5e1" : "#f1f5f9"); g.addColorStop(1, c.dark ? "#475569" : "#64748b"); return g; };
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.16)"; ctx.fillRect(X(cx - 36), Y(158), 72 * s, 116 * s);
  ctx.fillStyle = metal(cx - 42, cx - 36); ctx.fillRect(X(cx - 42), Y(156), 6 * s, 124 * s);
  ctx.fillStyle = metal(cx + 36, cx + 42); ctx.fillRect(X(cx + 36), Y(156), 6 * s, 124 * s);
  ctx.fillStyle = metal(cx - 42, cx + 42); ctx.fillRect(X(cx - 42), Y(274), 84 * s, 6 * s);
  ctx.fillStyle = c.dark ? "#a16207" : "#c08a55"; ctx.fillRect(X(cx - 36), Y(158), 4 * s, 8 * s); ctx.fillRect(X(cx + 32), Y(158), 4 * s, 8 * s); ctx.fillRect(X(cx - 20), Y(272), 40 * s, 2 * s);
  // ichki stakan va suv
  ctx.fillStyle = c.dark ? "#1e293b" : "#f8fafc"; ctx.fillRect(X(cx - 29), Y(160), 58 * s, 109 * s);
  const gw = ctx.createLinearGradient(0, Y(surf), 0, Y(269));
  gw.addColorStop(0, c.dark ? "rgba(56,189,248,0.45)" : "rgba(125,211,252,0.6)"); gw.addColorStop(1, c.dark ? "rgba(14,116,144,0.7)" : "rgba(56,189,248,0.75)");
  ctx.fillStyle = gw; ctx.fillRect(X(cx - 29), Y(surf), 58 * s, (269 - surf) * s);
  ctx.strokeStyle = c.dark ? "rgba(186,230,253,0.8)" : "rgba(2,132,199,0.7)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(X(cx - 29), Y(surf)); ctx.lineTo(X(cx + 29), Y(surf)); ctx.stroke();
  ctx.fillStyle = metal(cx - 32, cx - 29); ctx.fillRect(X(cx - 32), Y(160), 3 * s, 112 * s);
  ctx.fillStyle = metal(cx + 29, cx + 32); ctx.fillRect(X(cx + 29), Y(160), 3 * s, 112 * s);
  ctx.fillStyle = metal(cx - 32, cx + 32); ctx.fillRect(X(cx - 32), Y(269), 64 * s, 3 * s);
  // issiq oqim (konveksiya) va pufakchalar
  if (part.P > 0.5) {
    ctx.save(); ctx.strokeStyle = c.dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.65)"; ctx.lineWidth = 1;
    for (const dx of [-10, 0, 10]) { ctx.beginPath(); for (let y = 250; y >= surf + 4; y -= 3) { const x = cx + dx + Math.sin(y * 0.25 + anim * 4 + dx) * 1.6; y === 250 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)); } ctx.stroke(); }
    ctx.restore();
  }
  if (T > 80) {
    const nb = Math.round(((T - 80) / 20) * 14);
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1;
    for (let k = 0; k < nb; k++) { const ph = (anim * (0.6 + (k % 4) * 0.15) + k * 0.37) % 1, bx = cx - 24 + ((k * 23) % 48), by = 262 - ph * (262 - surf - 2); ctx.beginPath(); ctx.arc(X(bx), Y(by), (1 + (k % 3) * 0.6) * s, 0, TAU); ctx.stroke(); }
  }
  // nixrom spiral va uning tutqichlari
  ctx.strokeStyle = c.dark ? "#a8a29e" : "#57534e"; ctx.lineWidth = Math.max(1.2, 1.8 * s);
  for (const dx of [-18, 18]) { ctx.beginPath(); ctx.moveTo(X(cx + dx), Y(TY)); ctx.lineTo(X(cx + dx), Y(256)); ctx.stroke(); }
  const hot = clamp(part.P / 40, 0, 1);
  ctx.strokeStyle = hot > 0.05 ? `rgb(${Math.round(120 + 100 * hot)},${Math.round(113 - 40 * hot)},${Math.round(108 - 70 * hot)})` : c.dark ? "#d6d3d1" : "#78716c";
  ctx.lineWidth = Math.max(1, 1.3 * s);
  for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.ellipse(X(cx - 16 + k * 4), Y(256), 2.6 * s, 5 * s, 0, 0, TAU); ctx.stroke(); }
  // ebonit qopqoq va klemmalar
  ctx.fillStyle = c.dark ? "#0f172a" : "#1c1917"; rr(ctx, cx - 46, TY, 92, 10, 2); ctx.fill();
  terminal(ctx, X(cx - 18), Y(TY), 4 * s, "#a1a1aa"); terminal(ctx, X(cx + 18), Y(TY), 4 * s, "#a1a1aa");
  // termometr (shkala 0…100 °C)
  const ty = (v) => 226 - v * 1.2;
  ctx.fillStyle = c.dark ? "rgba(226,232,240,0.25)" : "rgba(255,255,255,0.85)"; ctx.strokeStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.lineWidth = 1;
  rr(ctx, cx - 3, 92, 6, 146, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(X(cx), Y(240), 4.5 * s, 0, TAU); ctx.fill();
  ctx.fillRect(X(cx - 1.1), Y(ty(T)), 2.2 * s, (240 - ty(T)) * s);
  ctx.strokeStyle = c.dark ? "#e2e8f0" : "#1c1917"; ctx.fillStyle = ctx.strokeStyle; ctx.font = `600 ${Math.max(6.5, 7 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  for (let v = 0; v <= 100; v += 10) { const y = Y(ty(v)); ctx.beginPath(); ctx.moveTo(X(cx + 3), y); ctx.lineTo(X(cx + (v % 50 ? 5 : 7)), y); ctx.stroke(); if (v % 50 === 0) ctx.fillText(String(v), X(cx + 8), y); }
  // bug' (qaynaganda)
  if (T >= P.BOIL - 0.05) {
    ctx.save(); ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.35)" : "rgba(100,116,139,0.35)"; ctx.lineWidth = 2;
    for (const dx of [-34, 30]) { ctx.beginPath(); for (let y = TY - 2; y > 100; y -= 3) { const x = cx + dx + Math.sin(y * 0.18 - anim * 5 + dx) * 3; y === TY - 2 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)); } ctx.stroke(); }
    ctx.restore();
  }
  label(ctx, c, `R${kalN() > 1 ? SUB[i] : ""} ${fmt(part.R, 1)} Ω · ${fmt(T, 1)} °C`, X(cx), Y(292), "center", c.text);
}

function drawKal(ctx, c) {
  const s = view.s, n = kalN(), h = kalCirc(), col = COL(c), cups = cupsX();
  table(ctx, c, 288);
  stopwatch(ctx, c, X(18), Y(40), 92 * s, kal.t, kal.closed && running);
  const ps = powerSupply(ctx, c, X(10), Y(150), 120 * s, 100 * s, { value: kal.E, unit: "V", frac: kal.E / 12, title: "Manba 0–12 V", on: true });
  const kw = wd([ps.knob.x, ps.knob.y]); hits.knob = { x: kw[0], y: kw[1], r: ps.knob.r / s };
  const rI = range(h.I);
  const am = analogMeter(ctx, c, X(180), Y(10), 80 * s, { value: h.I, sym: "A", label: rangeText(rI), plusLeft: true, ...meterOpt(rI) });
  const vm = analogMeter(ctx, c, X(400), Y(10), 80 * s, { value: h.U, max: 15, sym: "V", label: "0–15 V", ticks: 5, digits: 0, plusLeft: true });
  cups.forEach((cx, i) => calorimeter(ctx, c, cx, i, h.parts[i], kal.T[i]));
  const pp = wd(ps.plus), pm = wd(ps.minus), ap = wd(am.plus), an = wd(am.minus), vp = wd(vm.plus), vn = wd(vm.minus);
  const L0 = cups[0] - 18, R0 = cups[n - 1] + 18, on = h.I > 0;
  wire(ctx, c, S([vp, [vp[0], 82], [L0 + 4, 82], [L0 + 4, TY]]), { color: col.blue, width: 1.8 });
  wire(ctx, c, S([vn, [vn[0], 88], [R0 - 4, 88], [R0 - 4, TY]]), { color: col.blue, width: 1.8 });
  wire(ctx, c, S([pp, [140, pp[1]], [140, 100], [145, 100]]), { color: col.red, on });
  wire(ctx, c, S([[180, 100], [ap[0], 100], ap]), { color: col.red, on });
  wire(ctx, c, S([an, [an[0], 90], [L0, 90], [L0, TY]]), { color: col.red, on });
  if (kal.conn === "series") wire(ctx, c, S([[cups[0] + 18, TY], [cups[0] + 18, 128], [cups[1] - 18, 128], [cups[1] - 18, TY]]), { color: col.yellow, on });
  if (kal.conn === "parallel") {
    wire(ctx, c, S([[L0, TY], [L0, 116], [cups[1] - 18, 116], [cups[1] - 18, TY]]), { color: col.red, on });
    wire(ctx, c, S([[cups[0] + 18, TY], [cups[0] + 18, 128], [R0, 128], [R0, TY]]), { color: col.black, on });
  }
  wire(ctx, c, S([[R0, TY], [R0, 132], [505, 132], [505, 284], [pm[0], 284], pm]), { color: col.black, on });
  // klemmalar simlar ustida
  terminal(ctx, ps.plus[0], ps.plus[1], Math.max(4, 6 * s), "#dc2626"); terminal(ctx, ps.minus[0], ps.minus[1], Math.max(4, 6 * s), "#334155");
  terminal(ctx, am.plus[0], am.plus[1], 4.4 * s, "#dc2626"); terminal(ctx, am.minus[0], am.minus[1], 4.4 * s, "#334155");
  terminal(ctx, vm.plus[0], vm.plus[1], 4.4 * s, "#dc2626"); terminal(ctx, vm.minus[0], vm.minus[1], 4.4 * s, "#334155");
  cups.forEach((cx) => { terminal(ctx, X(cx - 18), Y(TY), 4 * s, "#a1a1aa"); terminal(ctx, X(cx + 18), Y(TY), 4 * s, "#a1a1aa"); });
  const sw = knifeSwitch(ctx, c, [X(145), Y(100)], [X(180), Y(100)], kal.closed, s);
  const sww = wd([sw.x, sw.y]); hits.sw = { x: sww[0], y: sww[1] + 6, r: Math.max(20, sw.r / s) };
  label(ctx, c, kal.closed ? "kalit ulangan" : "kalit uzilgan", X(162), Y(118), "center", kal.closed ? c.success : c.text3);
}

/* ------------------------------------------------------------------ 2) Lampa */

const lampList = () => [P.LAMPS[lamp.a], lamp.b !== "none" ? P.LAMPS[lamp.b] : null].filter(Boolean);
const small = () => lamp.a === "l6";
const Umax = () => (small() ? 8 : 250);
function lampCirc() {
  const ls = lampList();
  if (ls.length === 1 || lamp.conn === "parallel") return { ...P.parallelLamps(ls, lamp.U), series: false };
  const r = P.seriesLamps(ls, lamp.U);
  return { I: r.I, parts: r.parts.map((p) => ({ ...p, I: r.I })), series: true };
}

function latr(ctx, c) {
  const s = view.s, cx = 70, cy = 136, R = 46, U = Umax(), f = clamp(lamp.U / U, 0, 1);
  const g = ctx.createLinearGradient(X(16), 0, X(124), 0);
  g.addColorStop(0, c.dark ? "#3f3f46" : "#a1a1aa"); g.addColorStop(0.45, c.dark ? "#71717a" : "#e4e4e7"); g.addColorStop(1, c.dark ? "#27272a" : "#71717a");
  ctx.fillStyle = g; rr(ctx, 16, 70, 108, 182, 14); ctx.fill(); ctx.strokeStyle = c.dark ? "#52525b" : "#52525b"; ctx.lineWidth = 1; ctx.stroke();
  // shnur va vilka
  ctx.strokeStyle = c.dark ? "#a1a1aa" : "#27272a"; ctx.lineWidth = 3 * s; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(X(18), Y(236)); ctx.bezierCurveTo(X(2), Y(246), X(10), Y(276), X(4), Y(296)); ctx.stroke();
  // shkala
  ctx.fillStyle = c.dark ? "#e7e5e4" : "#fafaf9"; ctx.beginPath(); ctx.arc(X(cx), Y(cy), R * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#57534e"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#1c1917"; ctx.strokeStyle = "#1c1917"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `600 ${Math.max(6.5, 7.5 * s)}px Inter, system-ui, sans-serif`;
  for (let k = 0; k <= 25; k++) {
    const a = (135 + 270 * (k / 25)) * DEG, big = k % 5 === 0, r0 = R * (big ? 0.78 : 0.84);
    ctx.lineWidth = big ? 1.3 : 0.7; ctx.beginPath(); ctx.moveTo(X(cx + Math.cos(a) * r0), Y(cy + Math.sin(a) * r0)); ctx.lineTo(X(cx + Math.cos(a) * R * 0.94), Y(cy + Math.sin(a) * R * 0.94)); ctx.stroke();
    if (big) ctx.fillText(fmt((U * k) / 25, 0), X(cx + Math.cos(a) * R * 0.62), Y(cy + Math.sin(a) * R * 0.62));
  }
  ctx.fillStyle = c.primary; ctx.font = `800 ${Math.max(7, 8 * s)}px Inter, system-ui, sans-serif`; ctx.fillText("V", X(cx), Y(cy + R * 0.5));
  // dasta
  const a = (135 + 270 * f) * DEG;
  ctx.fillStyle = "#18181b"; ctx.beginPath(); ctx.arc(X(cx), Y(cy), 17 * s, 0, TAU); ctx.fill();
  for (let k = 0; k < 12; k++) { const b = (k / 12) * TAU; ctx.fillStyle = "#3f3f46"; ctx.beginPath(); ctx.arc(X(cx + Math.cos(b) * 15.5), Y(cy + Math.sin(b) * 15.5), 1.6 * s, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = "#dc2626"; ctx.lineWidth = Math.max(1.5, 2.2 * s); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(X(cx + Math.cos(a) * 6), Y(cy + Math.sin(a) * 6)); ctx.lineTo(X(cx + Math.cos(a) * R * 0.98), Y(cy + Math.sin(a) * R * 0.98)); ctx.stroke();
  hits.latr = { x: cx, y: cy, r: R + 6 };
  ctx.fillStyle = c.dark ? "#f4f4f5" : "#18181b"; ctx.font = `800 ${Math.max(8, 10 * s)}px Inter, system-ui, sans-serif`; ctx.fillText("LATR", X(70), Y(198));
  ctx.font = `600 ${Math.max(6.5, 7 * s)}px Inter, system-ui, sans-serif`; ctx.fillStyle = c.dark ? "#d4d4d8" : "#3f3f46"; ctx.fillText(small() ? "~220 V → 0–8 V" : "~220 V → 0–250 V, 2 A", X(70), Y(210));
  return { o1: [52, 230], o2: [88, 230] };
}

function bulb(ctx, c, x, L, part) {
  const s = view.s, k = L.Un < 50 ? 0.6 : 1, T = part ? part.T : 293, b = P.brightness(T);
  const base = 216, cy = base - 66 * k, r = 34 * k;
  const by = (y) => Y(base - (base - y) * k), bx = (dx) => X(x + dx * k);
  // patron (bakelit) va taxtacha
  ctx.fillStyle = c.dark ? "#475569" : "#1c1917"; rr(ctx, x - 17 * k, base, 34 * k, 262 - base, 3); ctx.fill();
  ctx.fillStyle = c.dark ? "#64748b" : "#44403c"; ctx.fillRect(X(x - 17 * k), Y(base + 6), 34 * k * s, 2 * s);
  // yorug'lik (halo)
  const rgb = tempRGB(Math.max(1000, T));
  if (b > 0.004) {
    const R = (r + 22 + 90 * Math.sqrt(Math.min(b, 1.6))) * s, g = ctx.createRadialGradient(bx(0), Y(cy), r * 0.3 * s, bx(0), Y(cy), R);
    g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(0.75, 0.6 * b + 0.12)})`); g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx(0), Y(cy), R, 0, TAU); ctx.fill();
  }
  // shisha kolba
  ctx.beginPath(); ctx.moveTo(bx(-12), by(198)); ctx.bezierCurveTo(bx(-14), by(186), bx(-34), by(176), bx(-34), by(150));
  ctx.arc(bx(0), Y(cy), r * s, Math.PI, 0); ctx.bezierCurveTo(bx(34), by(176), bx(14), by(186), bx(12), by(198)); ctx.closePath();
  ctx.fillStyle = b > 0.004 ? `rgba(${rgb[0]},${rgb[1]},${Math.round(rgb[2] * 0.85)},${Math.min(0.85, 0.15 + 0.6 * b)})` : c.dark ? "rgba(226,232,240,0.12)" : "rgba(226,232,240,0.45)"; ctx.fill();
  ctx.strokeStyle = c.dark ? "rgba(203,213,225,0.7)" : "rgba(100,116,139,0.8)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2 * s * k; ctx.beginPath(); ctx.arc(bx(0), Y(cy), r * 0.72 * s, 1.12 * Math.PI, 1.4 * Math.PI); ctx.stroke();
  // shisha ushlagich, elektrodlar va volfram tola
  ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.5)" : "rgba(148,163,184,0.9)"; ctx.lineWidth = 3 * s * k; ctx.beginPath(); ctx.moveTo(bx(0), by(198)); ctx.lineTo(bx(0), by(172)); ctx.stroke();
  ctx.strokeStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.lineWidth = Math.max(0.8, 1 * s);
  ctx.beginPath(); ctx.moveTo(bx(-3), by(196)); ctx.lineTo(bx(-12), by(150)); ctx.moveTo(bx(3), by(196)); ctx.lineTo(bx(12), by(150)); ctx.moveTo(bx(0), by(172)); ctx.lineTo(bx(0), by(142)); ctx.stroke();
  const fil = T < 850 ? (c.dark ? "#a8a29e" : "#57534e") : `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  ctx.strokeStyle = fil; ctx.lineWidth = Math.max(1, (b > 0.05 ? 2 : 1.3) * s * k);
  if (b > 0.05) { ctx.shadowColor = fil; ctx.shadowBlur = 8 * s * Math.min(1, b); }
  ctx.beginPath();
  for (let q = 0; q <= 48; q++) { const u = q / 48, dx = -12 + 24 * u, dy = 150 - 8 * Math.sin(Math.PI * u) + Math.sin(u * 30 * Math.PI) * 1.4; q ? ctx.lineTo(bx(dx), by(dy)) : ctx.moveTo(bx(dx), by(dy)); }
  ctx.stroke(); ctx.shadowBlur = 0;
  // rezbali sokol (latun)
  const g2 = ctx.createLinearGradient(bx(-12), 0, bx(12), 0); g2.addColorStop(0, "#a16207"); g2.addColorStop(0.45, "#fde68a"); g2.addColorStop(1, "#854d0e");
  ctx.fillStyle = g2; ctx.fillRect(bx(-12), by(198), 24 * k * s, 18 * k * s);
  ctx.strokeStyle = "rgba(120,53,15,0.7)"; ctx.lineWidth = 1; for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.moveTo(bx(-12), by(201 + q * 4)); ctx.lineTo(bx(12), by(203 + q * 4)); ctx.stroke(); }
  if (part) label(ctx, c, `${fmt(part.P, part.P < 10 ? 2 : 1)} W`, X(x), Y(cy - r - 10), "center", b > 0.02 ? c.warning : c.text3);
}

function drawLampStage(ctx, c) {
  const s = view.s, col = COL(c), ls = lampList(), res = lampCirc(), n = ls.length, on = res.I > 1e-4;
  table(ctx, c, 288);
  const { o1, o2 } = latr(ctx, c);
  const rI = range(res.I);
  const am = analogMeter(ctx, c, X(240), Y(10), 80 * s, { value: res.I, sym: "A", label: `~ ${rangeText(rI)}`, ac: true, ...meterOpt(rI) });
  const vm = analogMeter(ctx, c, X(160), Y(168), 80 * s, { value: lamp.U, max: small() ? 10 : 300, sym: "V", label: small() ? "~ 0–10 V" : "~ 0–300 V", ticks: small() ? 5 : 3, digits: 0, ac: true });
  // lampalar taxtasi
  ctx.fillStyle = c.dark ? "#7c5a3a" : "#c08a55"; rr(ctx, 294, 262, 208, 16, 3); ctx.fill();
  ctx.strokeStyle = c.dark ? "#5b4029" : "#9a6a3e"; ctx.lineWidth = 1; ctx.stroke();
  ls.forEach((L, i) => bulb(ctx, c, LAMP_X[i], L, res.parts[i]));
  const a1 = wd(am.plus), a2 = wd(am.minus), v1 = wd(vm.minus), v2 = wd(vm.plus);
  const [a1x, a2x] = a1[0] < a2[0] ? [a1, a2] : [a2, a1];
  const tl = (i) => [LAMP_X[i] - 16, 268], tr = (i) => [LAMP_X[i] + 16, 268];
  wire(ctx, c, S([o2, [150, o2[1]], [150, 120], [a1x[0], 120], a1x]), { color: col.brown, on });
  wire(ctx, c, S([v1, [v1[0], 240], [150, 240], [150, o2[1]]]), { color: col.blue, width: 1.8 });
  wire(ctx, c, S([v2, [v2[0], 282]]), { color: col.blue, width: 1.8 });
  wire(ctx, c, S([a2x, [a2x[0], 268], tl(0)]), { color: col.brown, on });
  let endX = 356;
  if (n === 2 && res.series) { wire(ctx, c, S([tr(0), tl(1)]), { color: col.yellow, on }); wire(ctx, c, S([tr(1), [490, 268], [490, 282]]), { color: col.blue, on }); endX = 490; }
  else if (n === 2) {
    wire(ctx, c, S([[a2x[0], 88], [400, 88], [400, 268], tl(1)]), { color: col.brown, on });
    wire(ctx, c, S([tr(0), [tr(0)[0], 282]]), { color: col.blue, on }); wire(ctx, c, S([tr(1), [490, 268], [490, 282]]), { color: col.blue, on }); endX = 490;
  } else wire(ctx, c, S([tr(0), [tr(0)[0], 282]]), { color: col.blue, on });
  wire(ctx, c, S([o1, [o1[0], 282], [endX, 282]]), { color: col.blue, on });
  const dot = ([x, y]) => { ctx.fillStyle = c.text2; ctx.beginPath(); ctx.arc(X(x), Y(y), 2.4 * s, 0, TAU); ctx.fill(); };
  dot([150, o2[1]]); dot([v2[0], 282]); if (n === 2 && !res.series) { dot([a2x[0], 88]); dot([tr(0)[0], 282]); }
  [o1, o2].forEach((p) => terminal(ctx, X(p[0]), Y(p[1]), 4.5 * s, "#334155"));
  [am.plus, am.minus].forEach((p) => terminal(ctx, p[0], p[1], 4.4 * s, "#334155"));
  [vm.plus, vm.minus].forEach((p) => terminal(ctx, p[0], p[1], 3.5 * s, "#334155"));
  ls.forEach((_, i) => { terminal(ctx, X(tl(i)[0]), Y(268), 3.6 * s, "#a1a1aa"); terminal(ctx, X(tr(i)[0]), Y(268), 3.6 * s, "#a1a1aa"); });
  ls.forEach((L, i) => label(ctx, c, `${L.name}${L.Un > 50 ? ", 220 V" : ""}`, X(LAMP_X[i]), Y(291), "center", c.text));
}

/* ------------------------------------------------------------------ 3) Uy tarmog'i */

const homeP = () => (home.tripped ? 0 : HOME_IDS.reduce((sum, id) => sum + (home.on[id] ? P.APPLIANCES[id].P : 0), 0));
const homeLoad = () => HOME_IDS.reduce((sum, id) => sum + (home.on[id] ? P.APPLIANCES[id].P : 0), 0);
const homeI = () => homeP() / P.MAINS;
const homeWin = () => (ui.speed >= 60 ? 3600 : ui.speed >= 10 ? 600 : 60);
const cardBox = (k) => ({ x: 182 + (k % 5) * 66, y: k < 5 ? 186 : 244, w: 60, h: 50 });
function pushHome() { home.hist.push({ t: home.t, I: homeI() }); home.histT = home.t; if (home.hist.length > 1500) home.hist = home.hist.filter((p) => p.t >= home.t - homeWin() * 1.2); }
function trip(why) { home.tripped = true; home.why = why; home.acc = 0; pushHome(); flashStatus(why === "mag" ? "Qisqa tutashuvdek katta tok — avtomat bir zumda uzildi" : "Ortiqcha yuklanish — avtomat qizib uzildi"); }
function stepHome(sdt, dt) {
  const I = homeI(), lim = (P.FUSE_K * home.In) ** 2;
  home.t += sdt; home.E += P.kWh(homeP(), sdt);
  if (!home.tripped) {
    if (I > 5 * home.In) trip("mag");
    else { home.acc = I * I > lim ? home.acc + (I * I - lim) * sdt : Math.max(0, home.acc - (lim - I * I) * sdt * 0.5); if (home.acc >= P.fuseW(home.In)) trip("heat"); }
  }
  const np = Math.floor(home.E * IMP); if (np > home.pulses) { home.pulses = np; home.pulse = 0.09; }
  home.pulse = Math.max(0, home.pulse - dt); home.flow += dt * homeI() * 1.2;
  if (home.t - home.histT >= homeWin() / 300) pushHome();
}

function pictogram(ctx, c, id, x, y, sz, color) {
  const s = view.s, p = (dx, dy) => [X(x + dx * sz), Y(y + dy * sz)];
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1, 1.4 * s); ctx.lineJoin = "round"; ctx.lineCap = "round";
  const line = (...pts) => { ctx.beginPath(); pts.forEach(([a, b], i) => { const q = p(a, b); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); };
  const box = (a, b, w, h) => { const q = p(a, b); ctx.strokeRect(q[0], q[1], w * sz * s, h * sz * s); };
  const circ = (a, b, r) => { const q = p(a, b); ctx.beginPath(); ctx.arc(q[0], q[1], r * sz * s, 0, TAU); ctx.stroke(); };
  if (id === "kettle") { line([0.25, 0.95], [0.75, 0.95], [0.7, 0.3], [0.3, 0.3], [0.25, 0.95]); line([0.3, 0.45], [0.1, 0.3]); line([0.7, 0.4], [0.92, 0.45], [0.88, 0.8], [0.73, 0.82]); line([0.4, 0.3], [0.45, 0.18], [0.55, 0.18], [0.6, 0.3]); }
  else if (id === "iron") { line([0.05, 0.85], [0.95, 0.85], [0.95, 0.6], [0.45, 0.55], [0.05, 0.85]); line([0.4, 0.55], [0.5, 0.25], [0.85, 0.25], [0.85, 0.6]); }
  else if (id === "heater") { for (let k = 0; k < 5; k++) box(0.1 + k * 0.17, 0.2, 0.12, 0.65); line([0.1, 0.92], [0.18, 0.92]); line([0.82, 0.92], [0.9, 0.92]); }
  else if (id === "washer") { box(0.12, 0.08, 0.76, 0.86); line([0.12, 0.28], [0.88, 0.28]); circ(0.5, 0.6, 0.22); circ(0.75, 0.18, 0.04); }
  else if (id === "ac") { box(0.04, 0.25, 0.92, 0.38); line([0.12, 0.52], [0.88, 0.52]); line([0.3, 0.72], [0.25, 0.9]); line([0.5, 0.72], [0.5, 0.92]); line([0.7, 0.72], [0.75, 0.9]); }
  else if (id === "fridge") { box(0.24, 0.04, 0.52, 0.92); line([0.24, 0.38], [0.76, 0.38]); line([0.66, 0.16], [0.66, 0.28]); line([0.66, 0.48], [0.66, 0.66]); }
  else if (id === "tv") { box(0.06, 0.12, 0.88, 0.6); line([0.35, 0.9], [0.65, 0.9]); line([0.5, 0.72], [0.5, 0.9]); }
  else if (id === "pc") { box(0.04, 0.12, 0.6, 0.46); line([0.34, 0.58], [0.34, 0.75]); line([0.18, 0.78], [0.5, 0.78]); box(0.72, 0.1, 0.24, 0.8); }
  else { circ(0.5, 0.4, 0.28); line([0.38, 0.68], [0.38, 0.88], [0.62, 0.88], [0.62, 0.68]); if (id === "led") { line([0.38, 0.32], [0.38, 0.48], [0.46, 0.48]); line([0.56, 0.3], [0.56, 0.5]); } else line([0.4, 0.45], [0.45, 0.32], [0.5, 0.45], [0.55, 0.32], [0.6, 0.45]); }
  ctx.restore();
}
const HEATING = { kettle: 1, iron: 1, heater: 1 };

function drawHome(ctx, c) {
  const s = view.s, col = COL(c), I = homeI(), on = I > 0;
  // kiruvchi kabel
  wire(ctx, c, S([[40, 0], [40, 16]]), { color: col.brown, on }); wire(ctx, c, S([[62, 0], [62, 16]]), { color: col.blue, on });
  // hisoblagich
  ctx.fillStyle = c.dark ? "#475569" : "#e5e7eb"; rr(ctx, 12, 16, 100, 124, 8); ctx.fill(); ctx.strokeStyle = c.dark ? "#64748b" : "#9ca3af"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = c.dark ? "#1e293b" : "#f8fafc"; rr(ctx, 18, 24, 88, 76, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#a3b18a"; rr(ctx, 23, 32, 78, 22, 3); ctx.fill();
  ctx.fillStyle = "#1a2e05"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.font = `700 ${Math.round(12 * s)}px "SFMono-Regular", Menlo, Consolas, ui-monospace, monospace`;
  ctx.fillText((METER0 + home.E).toFixed(2).padStart(8, "0").replace(".", ","), X(98), Y(43.5));
  ctx.fillStyle = c.dark ? "#e2e8f0" : "#1f2937"; ctx.textAlign = "left"; ctx.font = `700 ${Math.max(6.5, 7.5 * s)}px Inter, system-ui, sans-serif`;
  ctx.fillText("kVt·soat", X(24), Y(62)); ctx.font = `600 ${Math.max(6, 6.5 * s)}px Inter, system-ui, sans-serif`;
  ctx.fillText(`${IMP} imp/(kVt·soat)`, X(24), Y(74)); ctx.fillText("220 V  5(60) A  50 Hz", X(24), Y(86));
  ctx.fillStyle = home.pulse > 0 ? "#ef4444" : c.dark ? "#7f1d1d" : "#fca5a5"; ctx.beginPath(); ctx.arc(X(98), Y(64), 3.2 * s, 0, TAU); ctx.fill();
  if (home.pulse > 0) { ctx.fillStyle = "rgba(239,68,68,0.3)"; ctx.beginPath(); ctx.arc(X(98), Y(64), 7 * s, 0, TAU); ctx.fill(); }
  ctx.fillStyle = c.dark ? "#cbd5e1" : "#374151"; ctx.font = `700 ${Math.max(6.5, 7.5 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText("Elektr hisoblagich", X(62), Y(112));
  [30, 48, 70, 92].forEach((x) => terminal(ctx, X(x), Y(128), 3.4 * s, "#a1a1aa"));
  // avtomat (DIN reyka)
  ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.fillRect(X(124), Y(76), 50 * s, 8 * s);
  ctx.fillStyle = c.dark ? "#e2e8f0" : "#ffffff"; rr(ctx, 132, 40, 34, 84, 3); ctx.fill(); ctx.strokeStyle = c.dark ? "#94a3b8" : "#9ca3af"; ctx.stroke();
  ctx.fillStyle = "#1f2937"; ctx.font = `800 ${Math.max(7, 8 * s)}px Inter, system-ui, sans-serif`; ctx.fillText(`C${home.In}`, X(149), Y(53));
  ctx.fillStyle = "#374151"; rr(ctx, 140, 66, 18, 30, 2); ctx.fill();
  const up = !home.tripped;
  ctx.fillStyle = up ? "#16a34a" : "#dc2626"; rr(ctx, 143, up ? 68 : 80, 12, 14, 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.max(6, 7 * s)}px Inter, system-ui, sans-serif`; ctx.fillText(up ? "I" : "O", X(149), Y(up ? 75 : 87));
  ctx.fillStyle = "#6b7280"; ctx.font = `600 ${Math.max(6, 6.5 * s)}px Inter, system-ui, sans-serif`; ctx.fillText("230 V~", X(149), Y(108));
  terminal(ctx, X(149), Y(44), 3.2 * s, "#a1a1aa"); terminal(ctx, X(149), Y(120), 3.2 * s, "#a1a1aa");
  hits.breaker = { x: 132, y: 40, w: 34, h: 84 };
  // simlar: L (faza) avtomat orqali, N (nol) to'g'ridan
  wire(ctx, c, S([[92, 128], [92, 150], [124, 150], [124, 30], [149, 30], [149, 44]]), { color: col.brown, on });
  wire(ctx, c, S([[149, 120], [149, 160], [512, 160]]), { color: col.brown, on });
  wire(ctx, c, S([[70, 128], [70, 172], [512, 172]]), { color: col.blue, on });
  // tok oqimini ko'rsatuvchi nuqtalar
  if (on) { ctx.fillStyle = c.dark ? "#fde68a" : "#f59e0b"; for (let x = 150 + ((home.flow * 20) % 14); x < 512; x += 14) { ctx.beginPath(); ctx.arc(X(x), Y(160), 1.6 * s, 0, TAU); ctx.fill(); } }
  ctx.fillStyle = c.text2; ctx.font = `700 ${Math.max(7, 8 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "left"; ctx.fillText("L", X(176), Y(154)); ctx.fillText("N", X(176), Y(180));
  // iste'molchilar
  HOME_IDS.forEach((id, k) => {
    const b = cardBox(k), A = P.APPLIANCES[id], isOn = !!home.on[id], live = isOn && !home.tripped, dx = b.x + b.w / 2;
    const drop = b.y === 186 ? [[dx - 6, 160, 186], [dx + 6, 172, 186]] : [[b.x - 4, 160, 252], [b.x - 2, 172, 256]];
    drop.forEach(([x, y0, y1], j) => { ctx.strokeStyle = j ? col.blue : col.brown; ctx.globalAlpha = isOn ? 0.9 : 0.35; ctx.lineWidth = Math.max(1, 1.3 * s); ctx.beginPath(); ctx.moveTo(X(x), Y(y0)); ctx.lineTo(X(x), Y(y1)); if (b.y !== 186) ctx.lineTo(X(b.x), Y(y1)); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(X(x), Y(y0), 1.8 * s, 0, TAU); ctx.fill(); });
    ctx.fillStyle = live ? (c.dark ? "rgba(34,197,94,0.16)" : "rgba(22,163,74,0.09)") : c.bg2; rr(ctx, b.x, b.y, b.w, b.h, 6); ctx.fill();
    ctx.strokeStyle = live ? c.success : isOn ? c.danger : c.border; ctx.lineWidth = live ? 1.8 : 1; ctx.stroke();
    if (live && HEATING[id]) { ctx.fillStyle = c.dark ? "rgba(251,146,60,0.2)" : "rgba(249,115,22,0.12)"; rr(ctx, b.x + 3, b.y + 3, 24, 24, 4); ctx.fill(); }
    pictogram(ctx, c, id, b.x + 5, b.y + 5, 20, live ? (HEATING[id] ? c.warning : c.success) : c.text3);
    ctx.fillStyle = live ? c.success : c.text3; ctx.beginPath(); ctx.arc(X(b.x + b.w - 7), Y(b.y + 8), 2.6 * s, 0, TAU); ctx.fill();
    const fs = Math.max(7, Math.min(10, 9 * s)); ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`; ctx.fillStyle = live ? c.text : c.text2; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(A.P >= 1000 ? `${fmt(A.P / 1000, 1)} kW` : `${A.P} W`, X(b.x + b.w - 4), Y(b.y + 22));
    ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`; ctx.textAlign = "center";
    if (ctx.measureText(SHORT[id]).width <= b.w * s - 4) ctx.fillText(SHORT[id], X(dx), Y(b.y + 40));
  });
}

/* ------------------------------------------------------------------ Sahna */

function draw(ctx, stg) {
  CW = stg.w;
  const c = stg.colors;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, stg.w, stg.h);
  fit(stg.w, stg.h);
  if (ui.mode === "kal") drawKal(ctx, c);
  else if (ui.mode === "lamp") drawLampStage(ctx, c);
  else drawHome(ctx, c);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { graph: Math.round(clamp(vh * 0.28, 190, 250)) }; };
const stage = createStage($("#stage"), draw, { height: (cw) => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return Math.round(clamp(Math.min(cw * 0.62, vh * 0.46), 240, 340)); } });

/* ------------------------------------------------------------------ Grafik */

function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "kal") {
    const h = kalCirc(), C = kalC();
    return drawHeat(ctx, gs, { view: ui.view.kal, hist: kal.hist, n: kalN(), C: [C, C], P: h.parts.map((p) => p.P), R: h.parts.map((p) => p.R), hover: ui.hover });
  }
  if (ui.mode === "lamp") { const r = lampCirc(); return drawLamp(ctx, gs, { view: ui.view.lamp, lamps: lampList(), Umax: Umax(), pts: r.parts, hover: ui.hover }); }
  return drawLine(ctx, gs, { hist: home.hist, In: home.In, win: homeWin(), hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  kal: [["T", "T(t)", "Suv temperaturasi T(t)", "Uzluksiz chiziq — termometr ko‘rsatishi, shtrix — issiqlik yo‘qotilmaganda bo‘ladigan T₀ + Pt/C. Boshida ular ustma-ust: ΔT vaqtga proporsional. Suv isigan sari atrofga ko‘proq issiqlik ketadi."],
    ["Q", "Q(t)", "Spiral bergan va suv olgan issiqlik", "Uzluksiz — spiralda ajralgan Q = I²Rt, shtrix — suv va idish olgan cmΔT. Ular orasidagi farq — atrofga yo‘qotilgan issiqlik (FIK < 100 %)."]],
  lamp: [["I", "I(U)", "Lampaning volt-amper xarakteristikasi", "Uzluksiz — cho‘g‘lanma lampa, shtrix — qarshiligi o‘zgarmas bo‘lganda (Om qonuni). Tola qizigan sari qarshiligi ortadi, shuning uchun egri chiziq to‘g‘ri chiziqdan pastda. Nuqta — hozirgi ish holati."],
    ["P", "P(U)", "Lampa quvvatining kuchlanishga bog‘liqligi", "R o‘zgarmas bo‘lsa P = U²/R (shtrix parabola). Lampada qarshilik ortgani uchun quvvat sekinroq o‘sadi: kuchlanish yarmida quvvat 25 % emas, ~33 %."]],
  home: [["I", "I(t)", "Tarmoqdagi tok I(t)", "Har bir iste’molchi yoqilganda tok ΣP/U ga sakraydi. Qizil soha — 1,45·Iₙ dan katta tok: unda avtomatning bimetall plastinkasi qiziydi va bir necha soniyada uziladi."]],
};
function setTabs() {
  const box = $("[data-tabs]"), tabs = TABS[ui.mode], cur = ui.view[ui.mode], t = tabs.find((x) => x[0] === cur);
  box.innerHTML = tabs.map(([v, name]) => `<button type="button" data-tab-value="${v}" aria-pressed="${v === cur}">${name}</button>`).join("");
  box.hidden = tabs.length < 2;
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.canvas.setAttribute("aria-label", t[2]); ui.hover = null; graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (!b) return; ui.view[ui.mode] = b.dataset.tabValue; setTabs(); });
const gcv = graph.canvas;
const ptrIn = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptrIn(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const fJ = (q) => (Math.abs(q) >= 1e6 ? u(fmt(q / 1e6, 2), "MJ") : Math.abs(q) >= 1e3 ? u(fmt(q / 1e3, Math.abs(q) >= 1e5 ? 0 : 1), "kJ") : u(fmt(q, 0), "J"));
const fW = (p) => (p >= 1000 ? u(fmt(p / 1000, 2), "kW") : u(fmt(p, p < 10 ? 2 : p < 100 ? 1 : 0), "W"));
const tText = (t) => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return t >= 3600 ? `${Math.floor(t / 3600)} soat ${Math.floor((t % 3600) / 60)} min` : m ? `${m} min ${s} s` : `${fmt(t, 1)} s`; };
const money = (v) => `${fmt(v, v < 10 ? 1 : 0)} so‘m`;

function updateReadouts() {
  if (ui.mode === "kal") {
    const h = kalCirc(), n = kalN(), C = kalC(), dT = kal.T.slice(0, n).map((T) => T - P.T_ROOM), Qe = kal.Qe.slice(0, n).reduce((a, b) => a + b, 0), Qa = dT.reduce((a, b) => a + C * b, 0);
    setRO("r1", "Tok kuchi <i>I</i> (ampermetr)", u(fmt(h.I, 2), "A"), kal.closed ? `I = E/(R + r) = ${fmt(kal.E, 1)}/(${fmt(h.R, 2)} + ${fmt(R_INT, 1)})` : "kalit uzilgan", kal.closed ? "blue" : "");
    setRO("r2", "Kuchlanish <i>U</i> (voltmetr)", u(fmt(h.U, 2), "V"), n > 1 ? h.parts.map((p, i) => `U${SUB[i]} = ${fmt(p.U, 2)} V`).join(", ") : "spiral uchlarida");
    setRO("r3", "Quvvat <i>P</i> = <i>UI</i>", fW(h.U * h.I), n > 1 ? h.parts.map((p, i) => `P${SUB[i]} = ${fmt(p.P, 1)} W`).join(", ") : `P = I²R = ${fmt(h.I * h.I * h.R, 1)} W`, "orange");
    setRO("r4", "Vaqt <i>t</i> (sekundomer)", kal.t < 60 ? u(fmt(kal.t, 1), "s") : u(`${Math.floor(kal.t / 60)}:${String(Math.floor(kal.t % 60)).padStart(2, "0")}`, "min"), `tezlik ${ui.speed}×`);
    setRO("r5", "Temperatura <i>T</i>", u(kal.T.slice(0, n).map((T) => fmt(T, 1)).join(" | "), "°C"), `ΔT = ${dT.map((d) => fmt(d, 1)).join(" | ")} K; C = ${fmt(C, 0)} J/K${kal.T.slice(0, n).some((T) => T >= P.BOIL - 0.05) ? " · qaynamoqda" : ""}`, kal.T.some((T) => T >= P.BOIL - 0.05) ? "red" : "");
    setRO("r6", "Issiqlik <i>Q</i> = <i>I</i>²<i>Rt</i>", fJ(Qe), Qe > 50 ? `suv va idish oldi cmΔT = ${fmt(Qa / 1000, 2)} kJ, FIK η = ${fmt((Qa / Qe) * 100, 1)} %` : "kalitni ulang va kuting", "green");
  } else if (ui.mode === "lamp") {
    const ls = lampList(), r = lampCirc(), p1 = r.parts[0], p2 = r.parts[1];
    setRO("r1", "Kuchlanish <i>U</i> (LATR, voltmetr)", u(fmt(lamp.U, small() ? 1 : 0), "V"), "o‘zgaruvchan tok, ta’sir etuvchi qiymat");
    setRO("r2", "Zanjirdagi tok <i>I</i> (ampermetr)", u(fmt(r.I, 3), "A"), ls.length < 2 ? `nominal tok Iₙ = ${fmt(P.ratedI(ls[0]), 3)} A` : r.series ? "ketma-ket: ikkala lampada bir xil" : `I = I₁ + I₂ = ${fmt(p1.I, 3)} + ${fmt(p2.I, 3)}`, "blue");
    setRO("r3", `${ls[0].name} lampa quvvati <i>P</i>${ls.length > 1 ? "₁" : ""}`, fW(p1.P), `U${ls.length > 1 ? "₁" : ""} = ${fmt(p1.U, 1)} V; nominaldan ${fmt((p1.P / ls[0].Pn) * 100, 0)} %`, "orange");
    if (p2) setRO("r4", `${ls[1].name} lampa quvvati <i>P</i>₂`, fW(p2.P), `U₂ = ${fmt(p2.U, 1)} V; nominaldan ${fmt((p2.P / ls[1].Pn) * 100, 0)} %`, "orange");
    else setRO("r4", "Elektr energiya (1 soatda)", u(fmt(P.kWh(p1.P, 3600) * 1000, 1), "W·soat"), `W = Pt; 1 kVt·soat = 3,6 MJ`);
    setRO("r5", `Tola qarshiligi <i>R</i>${ls.length > 1 ? "₁" : ""} = <i>U/I</i>`, u(fmt(P.lampR(ls[0], p1.U), 0), "Ω"), `sovuq tola ${fmt(P.coldR(ls[0]), ls[0].Un < 50 ? 1 : 0)} Ω; nominalda ${fmt((ls[0].Un * ls[0].Un) / ls[0].Pn, ls[0].Un < 50 ? 1 : 0)} Ω`);
    setRO("r6", "Tola temperaturasi <i>T</i>", u(r.parts.map((p) => fmt(p.T, 0)).join(" | "), "K"), `yorqinlik: ${r.parts.map((p) => `${fmt(P.brightness(p.T) * 100, 0)} %`).join(" | ")} (nominalga nisbatan)`, "red");
  } else {
    const Pw = homeP(), I = homeI(), lim = P.FUSE_K * home.In, left = I > lim && !home.tripped ? (P.fuseW(home.In) - home.acc) / (I * I - lim * lim) : null, nOn = HOME_IDS.filter((id) => home.on[id]).length;
    setRO("r1", "Iste’mol quvvati <i>P</i> = Σ<i>P</i><sub>i</sub>", fW(Pw), home.tripped ? `yuklama ${fmt(homeLoad(), 0)} W — avtomat uzilgan` : `${nOn} ta iste’molchi yoqilgan`, "orange");
    setRO("r2", "Tarmoq toki <i>I</i> = <i>P/U</i>", u(fmt(I, 1), "A"), `U = 220 V; avtomat Iₙ = ${home.In} A`, I > lim ? "red" : I > home.In ? "orange" : "blue");
    setRO("r3", "Avtomat", home.tripped ? "uzildi" : left != null ? u(`~${fmt(Math.max(0, left), 0)}`, "s") : "yoqilgan", home.tripped ? (home.why === "mag" ? "elektromagnit uzgich: I > 5Iₙ" : home.why === "heat" ? "bimetall plastinka qizib egildi" : "qo‘lda o‘chirilgan") : left != null ? `I > 1,45·Iₙ = ${fmt(lim, 1)} A — uzilishigacha` : `${fmt(lim, 1)} A gacha uzoq vaqt ishlaydi`, home.tripped ? "red" : left != null ? "orange" : "green");
    setRO("r4", "Sarflangan energiya <i>W</i>", u(fmt(home.E, home.E < 1 ? 3 : 2), "kVt·soat"), `t = ${tText(home.t)}; hisoblagich ${home.pulses} impuls`);
    setRO("r5", "Narxi", u(fmt(home.E * home.tariff, home.E * home.tariff < 10 ? 1 : 0), "so‘m"), `tarif ${fmt(home.tariff, 0)} so‘m / kVt·soat`, "green");
    setRO("r6", "Shu yuklamada 1 soatda", u(fmt(Pw / 1000, 2), "kVt·soat"), `${money((Pw / 1000) * home.tariff)}; oyiga (kuniga 3 soat) ${money((Pw / 1000) * 90 * home.tariff)}`);
  }
}
function updateStatus() {
  if (flashUntil > Date.now()) return;
  const el = $("[data-status]"); let t, tone = "blue";
  if (ui.mode === "kal") {
    if (!kal.closed) { t = "Kalit uzilgan — tok yo‘q"; tone = ""; }
    else if (kal.T.slice(0, kalN()).some((T) => T >= P.BOIL - 0.05)) { t = "Suv qaynamoqda"; tone = "red"; }
    else { t = `Tok o‘tmoqda — suv isimoqda (${ui.speed}×)`; tone = "orange"; }
  } else if (ui.mode === "lamp") {
    const r = lampCirc(), ls = lampList();
    if (lamp.U < 0.5 || r.parts.every((p) => P.brightness(p.T) < 0.002)) { t = lamp.U < 0.5 ? "LATR nolda — lampalar o‘chiq" : "Tola qizarmagan — yorug‘lik yo‘q"; tone = ""; }
    else if (ls.length === 2 && r.series && ls[0].Pn !== ls[1].Pn) { const k = r.parts[0].P > r.parts[1].P ? 0 : 1; t = `Ketma-ket: ${ls[k].name} lampa yorqinroq`; tone = "orange"; }
    else { t = `Yorqinlik ${fmt(P.brightness(r.parts[0].T) * 100, 0)} %`; tone = "orange"; }
  } else {
    const I = homeI(), lim = P.FUSE_K * home.In;
    if (home.tripped) { t = home.why ? "Avtomat uzildi — iste’molchilarni kamaytirib, qayta yoqing" : "Avtomat o‘chirilgan"; tone = "red"; }
    else if (I > lim) { t = "Ortiqcha yuklanish! Avtomat qizimoqda"; tone = "red"; }
    else if (I > 0) { t = `Tok ${fmt(I, 1)} A — me’yorda`; tone = "green"; }
    else { t = "Barcha iste’molchilar o‘chiq"; tone = ""; }
  }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let flashUntil = 0;
function flashStatus(t) { const el = $("[data-status]"); el.textContent = t; el.dataset.tone = "red"; flashUntil = Date.now() + 2200; }

let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "kal") {
    const h = kalCirc(), C = kalC();
    p.push(`<p>Tok o‘tganda o‘tkazgichdagi erkin elektronlar maydon bajargan ish hisobiga tezlanadi va kristall panjara ionlariga urilib, energiyasini ularga beradi — o‘tkazgich qiziydi. Ajralgan issiqlik <b>Joul–Lens qonuni</b> bilan topiladi: <b>Q = I²Rt</b>. Spiral suvga botirilgan, shuning uchun issiqlik suv va alyuminiy stakanni isitadi: <b>Q = cmΔT</b>, C = ${fmt(C, 0)} J/K.</p>`);
    if (kal.conn === "series") p.push(`<p><b>Ketma-ket</b> ulanganda ikkala spiraldan bir xil tok o‘tadi (${fmt(h.I, 2)} A), shuning uchun Q₁/Q₂ = R₁/R₂ = ${fmt(kal.R1 / kal.R2, 2)}: qarshiligi katta spiral ko‘proq issiqlik beradi. Termometrlarni solishtiring.</p>`);
    else if (kal.conn === "parallel") p.push(`<p><b>Parallel</b> ulanganda spirallardagi kuchlanish bir xil (${fmt(h.U, 2)} V), Q = U²t/R: endi qarshiligi <b>kichik</b> spiral ko‘proq issiqlik beradi, Q₁/Q₂ = R₂/R₁ = ${fmt(kal.R2 / kal.R1, 2)}. Shuning uchun uydagi kuchli isitgichlarning qarshiligi kichik.</p>`);
    else p.push(`<p>Kuchlanishni 2 marta oshirsangiz, tok ham 2 marta, quvvat esa 4 marta ortadi — suv 4 marta tez isiydi. Qarshilikni o‘zgartirib ko‘ring: manba ichki qarshiligi (${fmt(R_INT, 1)} Ω) tufayli eng katta quvvat R = r da bo‘ladi.</p>`);
    if (kal.t > 30) { const Qe = kal.Qe.slice(0, kalN()).reduce((a, b) => a + b, 0), Qa = kal.T.slice(0, kalN()).reduce((a, T) => a + C * (T - P.T_ROOM), 0); p.push(`<p>Hozircha spiral ${fmt(Qe / 1000, 2)} kJ issiqlik berdi, suv va idish ${fmt(Qa / 1000, 2)} kJ oldi — kalorimetr FIK ${fmt((Qa / Math.max(1, Qe)) * 100, 1)} %. Qolgani g‘ilof va qopqoq orqali havoga ketdi; suv qancha issiq bo‘lsa, yo‘qotish shuncha katta.</p>`); }
  } else if (ui.mode === "lamp") {
    const r = lampCirc(), ls = lampList();
    p.push(`<p>Cho‘g‘lanma lampada volfram tola tok bilan ~2700 K gacha qiziydi va nur sochadi. Volfram qarshiligi temperatura bilan kuchli ortadi: sovuq tolaning qarshiligi ${fmt(P.coldR(ls[0]), 0)} Ω, ish holatida esa ${fmt((ls[0].Un * ls[0].Un) / ls[0].Pn, 0)} Ω. Shuning uchun lampa yoqilgan zahoti tok bir necha marta katta bo‘ladi va lampalar ko‘pincha aynan yoqilganda kuyadi.</p>`);
    if (ls.length === 2 && r.series) p.push(`<p><b>Ketma-ket</b>: tok bir xil, quvvat P = I²R. Nominal quvvati kichik lampaning (${ls[0].Pn < ls[1].Pn ? ls[0].name : ls[1].name}) qarshiligi katta, shuning uchun unda kuchlanish va quvvat ko‘p — u yorqinroq yonadi, 100 W lampa esa zo‘rg‘a qizaradi. Ikkalasi ham nominaldan ancha kam quvvat oladi.</p>`);
    else if (ls.length === 2) p.push(`<p><b>Parallel</b>: har bir lampa to‘liq kuchlanishda, P = U²/R. Qarshiligi kichik (nominal quvvati katta) lampa yorqinroq. Uydagi barcha iste’molchilar shunday — parallel ulanadi.</p>`);
    else p.push(`<p>Lampa quvvatini ampermetr va voltmetr bilan o‘lchaymiz: <b>P = UI</b> = ${fmt(lamp.U, 0)} V · ${fmt(r.I, 3)} A = ${fmt(r.parts[0].P, 1)} W. LATR bilan kuchlanishni kamaytiring: tok kamayadi, tola soviydi va qarshiligi kamayadi — quvvat U² ga emas, taxminan U^1,58 ga proporsional kamayadi, rangi qizarib boradi.</p>`);
  } else {
    p.push("<p>Xonadondagi barcha iste’molchilar tarmoqqa <b>parallel</b> ulanadi: har biri 220 V kuchlanishda ishlaydi, umumiy tok esa ularning toklari yig‘indisi: <b>I = ΣP/U</b>. Faza (L) simiga avtomat saqlagich, hisoblagich esa kirishga o‘rnatiladi.</p>");
    p.push(`<p>Hisoblagich elektr energiyani <b>kVt·soat</b>da o‘lchaydi: 1 kVt·soat = 1000 W · 3600 s = 3,6 MJ. 2 kW choynak 30 minutda 1 kVt·soat sarflaydi. Hisoblagichdagi qizil chiroqcha har 1/${IMP} kVt·soatda miltillaydi — tezroq miltillasa, quvvat katta.</p>`);
    p.push(`<p>Avtomat ikki xil himoya qiladi: tok 1,45·Iₙ dan oshsa, <b>bimetall plastinka</b> qizib egiladi va bir necha soniya–minutda zanjirni uzadi (ortiqcha yuklanish); tok 5·Iₙ dan oshsa (qisqa tutashuv), <b>elektromagnit</b> bir zumda uzadi. Bu simlarning qizib, yong‘in chiqishidan saqlaydi — sim ham Joul–Lens qonuni bo‘yicha qiziydi.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "kal" ? "<small>Joul–Lens qonuni</small> Q = I²Rt" : ui.mode === "lamp" ? "<small>Tok quvvati</small> P = UI = U²/R" : "<small>Elektr energiya</small> W = Pt";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); syncTools(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  dt = Math.min(dt, 0.05); anim += dt;
  if (ui.mode === "kal") stepKal(dt * ui.speed);
  else if (ui.mode === "home") stepHome(dt * ui.speed, dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.12) { uiTimer = 0; updateReadouts(); updateStatus(); if (ui.mode !== "lamp") { graph.render(); updateExplain(); } }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  if (!on) refresh();
}
playBtn.addEventListener("click", () => loop.toggle());
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || MODE_DEFAULT[ui.mode], false));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = Number(b.dataset.speedValue); if (ui.mode === "home") home.hist = home.hist.filter((p) => p.t >= home.t - homeWin()); syncSpeed(); refresh(); }));
const syncSpeed = () => document.querySelectorAll("[data-speed-value]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.speedValue) === ui.speed)));

/* ------------------------------------------------------------------ Boshqaruv */

// 1) Kalorimetr
const EC = bindRange($("#kE"), $("#kEOut"), (v) => `${fmt(v, 1)} V`, (v) => { kal.E = v; customized(); refresh(); });
const R1C = bindRange($("#kR1"), $("#kR1Out"), (v) => `${fmt(v, 1)} Ω`, (v) => { kal.R1 = v; customized(); refresh(); });
const R2C = bindRange($("#kR2"), $("#kR2Out"), (v) => `${fmt(v, 1)} Ω`, (v) => { kal.R2 = v; customized(); refresh(); });
const mC = bindRange($("#km"), $("#kmOut"), (v) => `${fmt(v, 0)} g`, (v) => { kal.m = v; resetKal(); customized(); refresh(); });
document.querySelectorAll("[data-conn-value]").forEach((b) => b.addEventListener("click", () => { if (kal.conn === b.dataset.connValue) return; kal.conn = b.dataset.connValue; resetKal(); customized(); syncKal(); refresh(); }));
function syncKal() {
  EC.set(kal.E); R1C.set(kal.R1); R2C.set(kal.R2); mC.set(kal.m);
  document.querySelectorAll("[data-conn-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.connValue === kal.conn)));
  $("[data-r2]").hidden = kal.conn === "single";
}
function toggleKey() { kal.closed = !kal.closed; if (kal.closed && kal.hist.length <= 1) pushKal(); customized(); refresh(); if (kal.closed && !prefersReducedMotion()) loop.start(); }
$("[data-key]").addEventListener("click", toggleKey);

// 2) Lampa
const selA = $("#lA"), selB = $("#lB");
const OPT = (ids) => ids.map((id) => `<option value="${id}">${id === "none" ? "— ulanmagan —" : P.LAMPS[id].name}${id !== "none" && P.LAMPS[id].Un > 50 ? ", 220 V" : ""}</option>`).join("");
selA.innerHTML = OPT(["l25", "l40", "l60", "l100", "l6"]); selB.innerHTML = OPT(["none", "l25", "l40", "l60", "l100", "l6"]);
const UC = bindRange($("#lU"), $("#lUOut"), (v) => `${fmt(v, small() ? 1 : 0)} V`, (v) => { lamp.U = v; customized(); refresh(); });
function normLamps(changed) {
  const sa = lamp.a === "l6", sb = lamp.b === "l6";
  if (lamp.b !== "none" && sa !== sb) { if (changed === "a") lamp.b = "none"; else lamp.a = sb ? "l6" : "l40"; }
  lamp.U = clamp(lamp.U, 0, Umax());
}
selA.addEventListener("change", () => { const was = small(); lamp.a = selA.value; normLamps("a"); if (was !== small()) lamp.U = small() ? 6.3 : 220; customized(); syncLamp(); refresh(); });
selB.addEventListener("change", () => { const was = small(); lamp.b = selB.value; normLamps("b"); if (was !== small()) lamp.U = small() ? 6.3 : 220; customized(); syncLamp(); refresh(); });
document.querySelectorAll("[data-lconn-value]").forEach((b) => b.addEventListener("click", () => { lamp.conn = b.dataset.lconnValue; customized(); syncLamp(); refresh(); }));
function syncLamp() {
  selA.value = lamp.a; selB.value = lamp.b;
  const inp = $("#lU"); inp.max = String(Umax()); inp.step = small() ? "0.1" : "1"; UC.set(lamp.U);
  document.querySelectorAll("[data-lconn-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lconnValue === lamp.conn)));
  $("[data-lconn]").hidden = lamp.b === "none";
}

// 3) Uy tarmog'i
const fuseSel = $("#hF");
fuseSel.addEventListener("change", () => { home.In = Number(fuseSel.value); home.acc = 0; customized(); refresh(); });
const TC = bindRange($("#hT"), $("#hTOut"), (v) => `${fmt(v, 0)} so‘m`, (v) => { home.tariff = v; customized(); refresh(); });
function toggleBreaker() { if (home.tripped) { home.tripped = false; home.why = ""; home.acc = 0; } else { home.tripped = true; home.why = ""; } pushHome(); flashUntil = 0; customized(); refresh(); }
$("[data-fuse]").addEventListener("click", toggleBreaker);
function toggleAppliance(id) { home.on[id] = !home.on[id]; pushHome(); customized(); refresh(); if (!prefersReducedMotion()) loop.start(); }
function syncHome() { fuseSel.value = String(home.In); TC.set(home.tariff); }

function syncTools() {
  const kb = $("[data-key]"); kb.textContent = kal.closed ? "Kalitni uzish" : "Kalitni ulash"; kb.setAttribute("aria-pressed", String(kal.closed));
  const fb = $("[data-fuse]"); fb.textContent = home.tripped ? "Avtomatni yoqish" : "Avtomatni o‘chirish";
  $("[data-speed]").hidden = ui.mode === "lamp";
}

/* ------------------------------------------------------------------ Sahnada boshqarish */

const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); };
const latrF = (p) => { const a = ((Math.atan2(p.y - hits.latr.y, p.x - hits.latr.x) / DEG - 135 + 720) % 360) / 270; return a > 1 ? (a < 1 + 45 / 270 ? 1 : 0) : a; };
function hitTest(p) {
  if (ui.mode === "kal") {
    if (hits.sw && dist(p.x, p.y, hits.sw.x, hits.sw.y) <= hits.sw.r) return { k: "sw" };
    if (hits.knob && dist(p.x, p.y, hits.knob.x, hits.knob.y) <= hits.knob.r + 4) return { k: "knob" };
    return null;
  }
  if (ui.mode === "lamp") return hits.latr && dist(p.x, p.y, hits.latr.x, hits.latr.y) <= hits.latr.r ? { k: "latr" } : null;
  const b = hits.breaker; if (b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return { k: "breaker" };
  for (let k = 0; k < HOME_IDS.length; k++) { const q = cardBox(k); if (p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h) return { k: "card", id: HOME_IDS[k] }; }
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  e.preventDefault();
  if (h.k === "sw") return toggleKey();
  if (h.k === "breaker") return toggleBreaker();
  if (h.k === "card") return toggleAppliance(h.id);
  drag = { ...h, y0: p.y, E0: kal.E, f: lamp.U / Umax() };
  canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  if (h.k === "latr") onDrag(p);
});
function onDrag(p) {
  if (drag.k === "knob") { kal.E = clamp(Math.round((drag.E0 + (drag.y0 - p.y) * 0.08) * 10) / 10, 0, 12); EC.set(kal.E); }
  else if (drag.k === "latr") { const f = latrF(p); if (Math.abs(f - drag.f) > 0.5) return; drag.f = f; lamp.U = small() ? Math.round(f * Umax() * 10) / 10 : Math.round(f * Umax()); UC.set(lamp.U); }
  customized(); refresh();
}
const CURSOR = { sw: "pointer", knob: "ns-resize", latr: "grab", breaker: "pointer", card: "pointer" };
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? CURSOR[h.k] : ""; return; } onDrag(p); });
function endDrag() { if (!drag) return; drag = null; canvas.dataset.dragging = "false"; refresh(); }
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const setKal = (conn, E, R1, R2, m, speed = 10) => () => { Object.assign(kal, { conn, E, R1, R2, m, closed: true }); ui.speed = speed; resetKal(); };
const setLamp = (a, b, conn, U) => () => { Object.assign(lamp, { a, b, conn, U }); };
const setHome = (ids, In = 16, speed = 10) => () => { home.on = Object.fromEntries(ids.map((id) => [id, true])); Object.assign(home, { In, t: 0, E: 0, acc: 0, tripped: false, why: "", hist: [], pulses: 0, pulse: 0 }); ui.speed = speed; pushHome(); };
const PRESETS = {
  single: { mode: "kal", title: "Bitta spiral: Q = I²Rt", lesson: "Kalit ulangan: spiraldan 3,5 A tok o‘tmoqda, quvvat ~24 W. Termometr va sekundomerni kuzating — ΔT vaqtga proporsional o‘sadi. Manba dastasini yuqoriga suring: kuchlanish 2 marta ortsa, suv 4 marta tez isiydi.", set: setKal("single", 8, 2, 4, 150) },
  series: { mode: "kal", title: "Ketma-ket: Q ∝ R", lesson: "Ikki kalorimetr ketma-ket: tok bir xil, R₂ = 2R₁. Bir necha minutdan so‘ng ΔT₂ ≈ 2ΔT₁ ekanini tekshiring (suv massalari teng).", set: setKal("series", 12, 2, 4, 150) },
  parallel: { mode: "kal", title: "Parallel: Q ∝ 1/R", lesson: "Spirallar parallel: kuchlanish bir xil. Endi qarshiligi kichik spiral (R₁ = 2 Ω) ikki marta ko‘p issiqlik beradi — ΔT₁ ≈ 2ΔT₂.", set: setKal("parallel", 8, 2, 4, 150) },
  water: { mode: "kal", title: "Ko‘p suv — sekin isiydi", lesson: "Suv massasi 300 g: xuddi shu quvvatda ΔT ikki marta kichik, chunki C = cm katta. m ni o‘zgartirib, T(t) qiyaligini solishtiring.", set: setKal("single", 10, 2, 4, 300) },
  boil: { mode: "kal", title: "Qaynashgacha (60×)", lesson: "R = 1 Ω, 80 g suv, 12 V: quvvat ~85 W. Taxminan 6 minutda suv qaynaydi — keyin temperatura 100 °C da to‘xtaydi, energiya bug‘lanishga ketadi.", set: setKal("single", 12, 1, 4, 80, 60) },
  eff: { mode: "kal", title: "Kalorimetr FIK", lesson: "10 minut kuting va «Q(t)» grafigini oching: spiral bergan I²Rt bilan suv olgan cmΔT orasidagi farq — yo‘qotish. FIK oxirgi natijada.", set: setKal("single", 10, 4, 4, 200, 60) },
  rated: { mode: "lamp", title: "100 W lampa quvvati", lesson: "Laboratoriya ishi: LATR 220 V. Voltmetr va ampermetr ko‘rsatishidan P = UI ni hisoblang va lampadagi yozuv (100 W) bilan solishtiring.", set: setLamp("l100", "none", "series", 220) },
  low: { mode: "lamp", title: "Kuchlanish yarmida", lesson: "U = 110 V: Om qonuni bo‘yicha quvvat 4 marta (25 W gacha) kamayishi kerak edi, lekin tola soviganida qarshiligi kamayadi — quvvat ~33 W. Tola rangi sarg‘ish-qizil.", set: setLamp("l100", "none", "series", 110) },
  series40: { mode: "lamp", title: "40 W va 100 W ketma-ket", lesson: "Kutilmagan natija: ketma-ket ulanganda 40 W lampa yorqin yonadi, 100 W esa zo‘rg‘a qizaradi. Sababi — 40 W lampaning qarshiligi katta, tok esa bir xil: P = I²R.", set: setLamp("l40", "l100", "series", 220) },
  parallel40: { mode: "lamp", title: "40 W va 100 W parallel", lesson: "Parallel ulanganda ikkala lampa ham 220 V da — har biri o‘z nominal quvvatida. Ampermetr umumiy tokni ko‘rsatadi: I = (40 + 100)/220.", set: setLamp("l40", "l100", "parallel", 220) },
  small: { mode: "lamp", title: "6,3 V lampa (maktab)", lesson: "Maktab laboratoriyasidagi kichik lampa: 6,3 V; 0,3 A. Kuchlanishni 0 dan oshirib boring va tola qachon qizara boshlaganini kuzating.", set: setLamp("l6", "none", "series", 6.3) },
  warm: { mode: "lamp", title: "Sovuq va issiq tola", lesson: "U = 20 V da tola deyarli qizimagan: qarshilik nominaldagidan bir necha marta kichik. LATR dastasini sekin aylantiring va «I(U)» grafigida nuqtaning Om qonuni chizig‘idan uzoqlashishini kuzating.", set: setLamp("l100", "none", "series", 20) },
  kettle: { mode: "home", title: "Choynak: 1 kVt·soat", lesson: "2 kW elektr choynak yoqilgan (60×). 30 minutda hisoblagich 1 kVt·soat qo‘shadi. Tarifni o‘zgartirib, narxni hisoblang.", set: setHome(["kettle"], 16, 60) },
  overload: { mode: "home", title: "Ortiqcha yuklanish", lesson: "Choynak, isitgich, dazmol va kir yuvish mashinasi birdan yoqildi: 6,9 kW, I ≈ 31 A. 16 A avtomat taxminan 11 s da uziladi. Bir nechtasini o‘chirib, avtomatni qayta yoqing.", set: setHome(["kettle", "heater", "iron", "washer"], 16, 1) },
  led: { mode: "home", title: "LED va cho‘g‘lanma lampa", lesson: "Ikkala lampa ham bir xil yorug‘lik beradi, lekin cho‘g‘lanma lampa 100 W, LED — 12 W. Birini o‘chirib, «1 soatda» va oylik narxni solishtiring.", set: setHome(["lamp", "led"], 10, 60) },
  evening: { mode: "home", title: "Oddiy oqshom", lesson: "Muzlatkich, televizor, kompyuter va LED lampa: tok 2,6 A — avtomat uchun xavfsiz. Konditsionerni ham yoqib ko‘ring.", set: setHome(["fridge", "tv", "pc", "led"], 16, 60) },
};
const GROUPS = [["Joul–Lens qonuni", ["single", "series", "parallel", "water", "boil", "eff"]], ["Lampa quvvati", ["rated", "low", "series40", "parallel40", "small", "warm"]], ["Uy tarmog‘i", ["kettle", "overload", "led", "evening"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { kal: "Manba dastasini yuqoriga-pastga suring, kalitni bosing", lamp: "LATR dastasini aylantiring", home: "Iste’molchi yoki avtomatni bosing" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = el.dataset.tool !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  setTabs();
}
const MODE_DEFAULT = { kal: "single", lamp: "rated", home: "kettle" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id, mark = true) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; ui.hover = null; flashUntil = 0;
  p.set();
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncKal(); syncLamp(); syncHome(); syncSpeed(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  if (mark) { try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ } }
}

setPlayUI(false);
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "single");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });

// Node/Playwright tekshiruvi uchun
window.__joule = { kal, lamp, home, ui, loadPreset, refresh, stepKal, stepHome, kalCirc, lampCirc, homeI };
