// ==========================================================================
// Termodinamika — virtual laboratoriya (simulations/thermo.html)
// 1) 1-qonun: porshenli silindr, gorelka/muz/izolyatsiya; porshenni sudrab V₂, gorelka dastagi bilan Q;
//    Q, ΔU, A ustunlari, p–V da ish yuzasi va T–S diagramma.
// 2) Sikllar: Karno, sovitgich, to'g'ri to'rtburchak, ixtiyoriy (tugunlar p–V da suriladi), Otto; isitgich va
//    sovitgich termometrlari sahnada suriladi; Q₁, Q₂, A, FIK.
// 3) Dvigatel: 4 taktli benzinli/dizel, klapanlar, uchqun/forsunka, tirsakli val (sudrab aylantiriladi), p–V va p(θ).
// Fizika: thermo-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow } from "./sim-kit.js";
import * as P from "./thermo-physics.js";
import { drawDiagram, drawPTheta, lastFrame, niceRange, legColor } from "./thermo-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 13px Inter, system-ui, sans-serif";
const NU = 0.04, VMAX = 4;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "law", tab: "pv", speed: 1, hover: null, i: 3 };
const law = { type: "p", p1: 100, V1: 1, V2: 2, Q: 150, u: 1 };
const cyc = { kind: "carnot", T1: 500, T2: 300, r: 2, eps: 6, Q1: 200, rect: { Va: 1, Vb: 3, pa: 80, pb: 200 }, quad: [{ V: 1, p: 200 }, { V: 2.6, p: 170 }, { V: 3, p: 70 }, { V: 1.3, p: 90 }], u: 0 };
const eng = { fuel: "benzin", eps: 10, Q1: 900, theta: 0, model: null };
let presetId = null;
const geo = {};
const parts = Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() * TAU }));

const G = () => P.gas(ui.i);

/* ------------------------------------------------------------------ Hisob */

function lawResult() {
  const g = G(), s1 = { p: law.p1, V: law.V1 };
  if (law.type === "V") { const p2 = Math.max(5, law.p1 + (2 * law.Q) / (ui.i * law.V1)); return P.process("V", s1, p2, NU, g); }
  return P.process(law.type, s1, law.V2, NU, g);
}
/** Jarayonning u (0…1) qismigacha energiyalar. */
function lawPartial(res, u) {
  const n = Math.max(1, Math.round(u * (res.pts.length - 1))), pts = res.pts.slice(0, n + 1);
  return { ...P.legEnergy(pts, NU, G(), law.type), s: pts[pts.length - 1] };
}
function cycleDef() {
  const g = G();
  if (cyc.kind === "carnot") return { nodes: P.carnotNodes(cyc.T1, cyc.T2, 0.8, cyc.r, NU, g), types: P.CARNOT_TYPES };
  if (cyc.kind === "fridge") { const n = P.carnotNodes(cyc.T1, cyc.T2, 0.8, cyc.r, NU, g).reverse(); return { nodes: n, types: ["T", "Q0", "T", "Q0"] }; }
  if (cyc.kind === "otto") return { nodes: P.ottoNodes(1, cyc.eps, 100, cyc.Q1, NU, g), types: P.OTTO_TYPES };
  if (cyc.kind === "rect") { const q = cyc.rect; return { nodes: [{ V: q.Va, p: q.pb }, { V: q.Vb, p: q.pb }, { V: q.Vb, p: q.pa }, { V: q.Va, p: q.pa }], types: ["p", "V", "p", "V"] }; }
  return { nodes: cyc.quad.map((q) => ({ ...q })), types: ["line", "line", "line", "line"] };
}
let cycCache = null;
function cycResult() { const d = cycleDef(); cycCache = { ...d, ...P.cycle(d.nodes, d.types, NU, G()) }; return cycCache; }
/** Sikl bo'ylab faza u ∈ [0, 4): joriy holat va tarmoq. */
function cycState(c, u) {
  const k = Math.floor(u) % 4, l = c.legs[k], f = u - Math.floor(u), i = Math.min(l.pts.length - 1, Math.round(f * (l.pts.length - 1)));
  const a = l.pts[Math.max(0, i - 1)], b = l.pts[Math.min(l.pts.length - 1, i + 1)], dQ = l.type === "Q0" ? 0 : NU * G().Cv * (b.T - a.T) + 0.5 * (a.p + b.p) * (b.V - a.V);
  return { ...l.pts[i], k, leg: l, dQ };
}
const engModel = () => (eng.model ||= P.engine({ eps: eng.eps, fuel: eng.fuel, Q1: eng.Q1 }));

/* ------------------------------------------------------------------ Sahna: umumiy */

const tCol = (c, T) => { const u = clamp((T - 250) / 900, 0, 1); return `rgba(${Math.round(59 + 180 * u)},${Math.round(130 - 60 * u)},${Math.round(246 - 200 * u)},${c.dark ? 0.35 : 0.22})`; };
function cylinder(ctx, c, x, yBot, w, gasTop, T, { insul = false, weights = 0, handle = false } = {}) {
  const wall = 6, top = 22;
  if (insul) { ctx.fillStyle = c.dark ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.35)"; ctx.fillRect(x - w / 2 - wall - 10, top, 10, yBot - top + wall); ctx.fillRect(x + w / 2 + wall, top, 10, yBot - top + wall); ctx.fillRect(x - w / 2 - wall - 10, yBot + wall, w + 2 * wall + 20, 10); }
  ctx.fillStyle = tCol(c, T); ctx.fillRect(x - w / 2, gasTop, w, yBot - gasTop);
  // zarrachalar (tezligi √T ga proporsional)
  ctx.fillStyle = c.dark ? "rgba(226,232,240,0.85)" : "rgba(30,41,59,0.6)";
  for (const p of parts) { ctx.beginPath(); ctx.arc(x - w / 2 + 4 + p.x * (w - 8), gasTop + 4 + p.y * (yBot - gasTop - 8), 2.2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = c.dark ? "#64748b" : "#94a3b8";
  ctx.fillRect(x - w / 2 - wall, top, wall, yBot - top + wall); ctx.fillRect(x + w / 2, top, wall, yBot - top + wall); ctx.fillRect(x - w / 2 - wall, yBot, w + 2 * wall, wall);
  // porshen
  ctx.fillStyle = c.dark ? "#475569" : "#64748b"; ctx.fillRect(x - w / 2, gasTop - 14, w, 14);
  ctx.fillRect(x - 4, gasTop - 30, 8, 16);
  for (let k = 0; k < weights; k++) { ctx.fillStyle = k % 2 ? (c.dark ? "#a16207" : "#ca8a04") : (c.dark ? "#854d0e" : "#a16207"); ctx.fillRect(x - 26, gasTop - 30 - (k + 1) * 9, 52, 8); }
  if (handle) {
    const hy = gasTop - 7; ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + w / 2 - 14, hy, 8, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.primary; ctx.beginPath(); ctx.moveTo(x + w / 2 - 14, hy - 6); ctx.lineTo(x + w / 2 - 17, hy - 2); ctx.lineTo(x + w / 2 - 11, hy - 2); ctx.closePath(); ctx.moveTo(x + w / 2 - 14, hy + 6); ctx.lineTo(x + w / 2 - 17, hy + 2); ctx.lineTo(x + w / 2 - 11, hy + 2); ctx.closePath(); ctx.fill();
    geo.piston = { x: x + w / 2 - 14, y: hy, r: 16 };
  }
}
function flame(ctx, c, x, y, s, cold) {
  if (cold) { ctx.fillStyle = c.dark ? "rgba(147,197,253,0.6)" : "rgba(147,197,253,0.9)"; ctx.strokeStyle = c.primary; ctx.lineWidth = 1; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.rect(x + k * 22 - 9, y - 16 * s, 18, 16 * s); ctx.fill(); ctx.stroke(); } return; }
  for (let k = -2; k <= 2; k++) {
    const hh = (18 + 10 * Math.sin(performance.now() / 120 + k)) * s;
    ctx.fillStyle = "rgba(249,115,22,0.85)"; ctx.beginPath(); ctx.moveTo(x + k * 12 - 6, y); ctx.quadraticCurveTo(x + k * 12, y - hh * 1.3, x + k * 12 + 6, y); ctx.fill();
    ctx.fillStyle = "rgba(250,204,21,0.9)"; ctx.beginPath(); ctx.moveTo(x + k * 12 - 3, y); ctx.quadraticCurveTo(x + k * 12, y - hh * 0.7, x + k * 12 + 3, y); ctx.fill();
  }
}
function bars(ctx, c, x, yTop, h, items, w) {
  const m = Math.max(1, ...items.map((b) => Math.abs(b.v))), y0 = yTop + h / 2, bw = Math.min(46, (w - 20) / items.length - 14);
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 6, y0 + 0.5); ctx.lineTo(x + items.length * (bw + 16), y0 + 0.5); ctx.stroke();
  items.forEach((b, i) => {
    const bx = x + i * (bw + 16), hh = (b.v / m) * (h / 2 - 16);
    ctx.fillStyle = b.color; ctx.globalAlpha = 0.85; ctx.fillRect(bx, Math.min(y0, y0 - hh), bw, Math.abs(hh)); ctx.globalAlpha = 1;
    ctx.font = BOLD; ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = hh >= 0 ? "bottom" : "top"; ctx.fillText(b.label, bx + bw / 2, hh >= 0 ? y0 - hh - 14 : y0 - hh + 14);
    ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.fillText(`${fmt(b.v, 0)} J`, bx + bw / 2, hh >= 0 ? y0 - hh - 2 : y0 - hh + 2);
  });
}

/* ------------------------------------------------------------------ 1. Birinchi qonun */

function drawLaw(ctx, c, w, h) {
  const res = lawResult(), part = lawPartial(res, law.u), s = part.s, narrow = w < 560;
  const x = narrow ? w * 0.3 : w * 0.24, cw = narrow ? 100 : 130, yBot = h - 62, k = (yBot - 70) / VMAX, gasTop = yBot - s.V * k;
  geo.law = { x, yBot, k };
  cylinder(ctx, c, x, yBot, cw, gasTop, s.T, { insul: law.type === "Q0", weights: Math.round(clamp(s.p / 40, 1, 8)), handle: law.type !== "V" });
  // issiqlik manbai
  const fy = yBot + 34, Qn = part.Q;
  if (law.type === "Q0") { ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("issiqlik izolyatsiyasi: Q = 0", x, yBot + 22); }
  else if (law.type === "T") { ctx.fillStyle = c.dark ? "rgba(248,113,113,0.25)" : "rgba(254,202,202,0.9)"; ctx.fillRect(x - cw / 2 - 20, yBot + 14, cw + 40, 26); ctx.font = SMALL; ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`termostat: T = ${fmt(res.pts[0].T, 0)} K`, x, yBot + 27); }
  else flame(ctx, c, x, fy, clamp(Math.abs(res.Q) / 250, 0.25, 1.2), res.Q < 0);
  if (Math.abs(Qn) > 0.5 && law.type !== "Q0") arrow(ctx, x - cw / 2 - 22, Qn > 0 ? yBot + 4 : yBot - 40, 0, Qn > 0 ? -40 : 40, Qn > 0 ? c.danger : c.primary, { label: "Q", head: 9 });
  if (Math.abs(part.A) > 0.5) arrow(ctx, x + cw / 2 + 22, gasTop - 7, 0, part.A > 0 ? -34 : 34, c.success, { label: "A", head: 9 });
  if (law.type === "V") {
    const kx = x + cw / 2 + 34, ky = yBot + 28, frac = (law.Q + 100) / 400;
    ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(kx, ky, 13, 0, TAU); ctx.fill(); ctx.stroke();
    const a = (135 + 270 * frac) * (Math.PI / 180); ctx.strokeStyle = c.primary; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(kx, ky, 18, (135 * Math.PI) / 180, a); ctx.stroke();
    ctx.strokeStyle = c.text; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(a) * 10, ky + Math.sin(a) * 10); ctx.stroke();
    ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(`Q = ${fmt(law.Q, 0)} J`, kx + 22, ky);
    geo.knob = { x: kx, y: ky, r: 22 }; geo.piston = null;
  } else geo.knob = null;
  ctx.font = MID; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText(`p = ${fmt(s.p, 0)} kPa · V = ${fmt(s.V, 2)} L · T = ${fmt(s.T, 0)} K`, x, 4);
  // energiya ustunlari
  const bx = narrow ? x + cw / 2 + 52 : w * 0.52, items = [{ label: "Q", v: part.Q, color: c.danger }, { label: "ΔU", v: part.dU, color: c.warning }, { label: "A", v: part.A, color: c.success }];
  bars(ctx, c, bx, 26, h - 70, items, w - bx);
  ctx.font = BOLD; ctx.fillStyle = c.text; ctx.textAlign = "left"; ctx.textBaseline = "top";
  if (!narrow) ctx.fillText(`Q = ΔU + A:  ${fmt(part.Q, 0)} = ${fmt(part.dU, 0)} + ${fmt(part.A, 0)} J`, bx, h - 34);
}

/* ------------------------------------------------------------------ 2. Sikllar */

function thermometer(ctx, c, x, y, h, T, col, label, key) {
  const f = clamp((T - 200) / 600, 0, 1);
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(x - 5, y, 10, h, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col; ctx.fillRect(x - 3, y + h * (1 - f), 6, h * f); ctx.beginPath(); ctx.arc(x, y + h + 6, 8, 0, TAU); ctx.fill();
  const hy = y + h * (1 - f);
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, hy, 7, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.font = MID; ctx.fillStyle = c.text; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(`${label} = ${fmt(T, 0)} K`, x, y - 4);
  geo[key] = { x, y: hy, r: 14, y0: y, h };
}
function drawCyc(ctx, c, w, h) {
  const res = cycResult(), st = cycState(res, cyc.u), narrow = w < 560, g = G();
  const x = w / 2, cw = narrow ? 84 : 110, yBot = h - 58, k = (yBot - 70) / Math.max(...res.nodes.map((n) => n.V)) * 0.95, gasTop = yBot - st.V * k;
  const isC = cyc.kind === "carnot" || cyc.kind === "fridge";
  let Th = 0, Tc = Infinity; res.legs.forEach((l) => l.pts.forEach((q) => { Th = Math.max(Th, q.T); Tc = Math.min(Tc, q.T); }));
  const T1 = isC ? cyc.T1 : Th, T2 = isC ? cyc.T2 : Tc;
  // rezervuarlar
  const rw = narrow ? 70 : 110, rh = 90, ry = h / 2 - rh / 2 + 10;
  [[x - cw / 2 - 40 - rw, c.danger, "Isitgich", T1], [x + cw / 2 + 40, c.primary, "Sovitgich", T2]].forEach(([rx, col, lab, T]) => {
    ctx.fillStyle = col; ctx.globalAlpha = 0.14; ctx.fillRect(rx, ry, rw, rh); ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
    ctx.font = BOLD; ctx.fillStyle = col; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(lab, rx + rw / 2, ry + rh + 6);
    if (!isC) { ctx.font = MID; ctx.fillStyle = c.text; ctx.fillText(`${fmt(T, 0)} K`, rx + rw / 2, ry + rh / 2 - 6); }
  });
  geo.T1 = geo.T2 = null;
  if (isC) { thermometer(ctx, c, x - cw / 2 - 40 - rw / 2, ry + 14, rh - 30, cyc.T1, c.danger, "T₁", "T1"); thermometer(ctx, c, x + cw / 2 + 40 + rw / 2, ry + 14, rh - 30, cyc.T2, c.primary, "T₂", "T2"); }
  cylinder(ctx, c, x, yBot, cw, gasTop, st.T, { insul: st.leg.type === "Q0" });
  // issiqlik oqimi
  const ay = ry + rh / 2;
  if (st.dQ > 1e-6) arrow(ctx, x - cw / 2 - 38, ay, 30, 0, c.danger, { label: "Q₁", head: 9 });
  else if (st.dQ < -1e-6) arrow(ctx, x + cw / 2 + 8, ay, 30, 0, c.primary, { label: "Q₂", head: 9 });
  ctx.font = MID; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top";
  const legName = { T: "izotermik", Q0: "adiabatik", p: "izobarik", V: "izoxorik", line: "chiziqli" }[st.leg.type];
  ctx.fillText(`${st.k + 1}–${((st.k + 1) % 4) + 1}: ${legName}${st.dQ > 1e-6 ? ", issiqlik olinadi" : st.dQ < -1e-6 ? ", issiqlik beriladi" : ""}`, x, 4);
  ctx.fillText(`T = ${fmt(st.T, 0)} K`, x, 20);
  if (cyc.kind === "otto" && !narrow) { ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.fillText(`γ = ${fmt(g.gamma, 2)}`, x, 36); }
}

/* ------------------------------------------------------------------ 3. Dvigatel */

function drawEngine(ctx, c, w, h) {
  const e = engModel(), s = e.state(eng.theta), narrow = w < 560;
  const ex = narrow ? w * 0.3 : w * 0.26, S = Math.min(h * 0.21, 72), rc = S / 2, L = rc / e.lam, bore = narrow ? 70 : 86; // λ = r/L — fizika bilan bir xil
  const yc = h - 16 - rc, th = s.theta % TAU;
  const pinX = ex + rc * Math.sin(th), pinY = yc - rc * Math.cos(th), pistonPin = yc - (rc * Math.cos(th) + Math.sqrt(L * L - rc * rc * Math.sin(th) ** 2));
  const pinTDC = yc - (rc + L), clear = S / (e.eps - 1), head = pinTDC - 22 - clear, pistonTop = pistonPin - 22;
  geo.crank = { x: ex, y: yc, r: rc + 14 };
  // silindr
  ctx.fillStyle = tCol(c, s.T); ctx.fillRect(ex - bore / 2, head, bore, pistonTop - head);
  ctx.fillStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.fillRect(ex - bore / 2 - 8, head - 10, 8, pinTDC + S + 4 - head); ctx.fillRect(ex + bore / 2, head - 10, 8, pinTDC + S + 4 - head);
  ctx.fillRect(ex - bore / 2 - 8, head - 18, bore + 16, 10);
  // klapanlar
  const intake = s.stroke === 0, exhaust = s.stroke === 3, lift = (open, kk) => (open ? Math.sin(((s.theta - kk * Math.PI) / Math.PI) * Math.PI) * 9 : 0);
  [[ex - bore * 0.28, lift(intake, 0), c.primary, "kirish"], [ex + bore * 0.28, lift(exhaust, 3), c.text3, "chiqish"]].forEach(([vx, l, col, lab]) => {
    ctx.strokeStyle = c.dark ? "#cbd5e1" : "#334155"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(vx, head - 34); ctx.lineTo(vx, head + l); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.fillRect(vx - 9, head - 3 + l, 18, 4);
    ctx.font = SMALL; ctx.fillStyle = l > 0.5 ? col : c.text3; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(lab, vx, head - 36); // ochiq klapan yozuvi rangli
  });
  // uchqun yoki forsunka
  const ign = s.theta >= 2 * Math.PI && s.theta < 2 * Math.PI + (eng.fuel === "dizel" ? 0.7 : 0.35);
  ctx.fillStyle = c.dark ? "#e2e8f0" : "#475569"; ctx.fillRect(ex - 3, head - 26, 6, 22);
  if (ign) {
    if (eng.fuel === "dizel") { ctx.fillStyle = "rgba(250,204,21,0.8)"; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(ex, head - 2); ctx.lineTo(ex + k * 7, head + 16); ctx.lineTo(ex + k * 7 + 3, head + 16); ctx.closePath(); ctx.fill(); } }
    else { ctx.strokeStyle = "#facc15"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ex - 6, head + 2); ctx.lineTo(ex + 2, head + 6); ctx.lineTo(ex - 3, head + 9); ctx.lineTo(ex + 6, head + 14); ctx.stroke(); }
  }
  // porshen, shatun, tirsak
  ctx.fillStyle = c.dark ? "#475569" : "#64748b"; ctx.fillRect(ex - bore / 2 + 2, pistonTop, bore - 4, 30);
  ctx.strokeStyle = c.dark ? "#94a3b8" : "#334155"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(ex, pistonPin); ctx.lineTo(pinX, pinY); ctx.stroke();
  ctx.strokeStyle = c.border; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ex, yc, rc + 8, 0, TAU); ctx.stroke();
  ctx.strokeStyle = c.dark ? "#cbd5e1" : "#1e293b"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(ex, yc); ctx.lineTo(pinX, pinY); ctx.stroke();
  ctx.fillStyle = c.primary; ctx.beginPath(); ctx.arc(pinX, pinY, 5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(ex, yc, 4, 0, TAU); ctx.fill();
  // taktlar
  const bx = narrow ? ex + bore / 2 + 22 : w * 0.5, bw = Math.min(150, (w - bx - 12) / (narrow ? 1 : 2) - 8);
  P.STROKES.forEach((n, k) => {
    const col = narrow ? 0 : k % 2, row = narrow ? k : Math.floor(k / 2), xx = bx + col * (bw + 10), yy = 14 + row * (narrow ? 34 : 48), on = k === s.stroke;
    ctx.fillStyle = on ? (c.dark ? "rgba(96,165,250,0.25)" : "rgba(37,99,235,0.12)") : c.bg2; ctx.strokeStyle = on ? c.primary : c.border; ctx.lineWidth = on ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(xx, yy, bw, narrow ? 28 : 40, 8); ctx.fill(); ctx.stroke();
    ctx.font = BOLD; ctx.fillStyle = on ? c.primary : c.text2; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(`${k + 1}. ${n}`, xx + 8, yy + 7);
    if (!narrow) { ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.fillText(["kirish klapani ochiq", "ikkala klapan yopiq", eng.fuel === "dizel" ? "yoqilg‘i purkaladi" : "uchqun, kengayish", "chiqish klapani ochiq"][k], xx + 8, yy + 24); }
  });
  if (!narrow) {
    const yy = 14 + 2 * 48 + 8; ctx.font = MID; ctx.fillStyle = c.text; ctx.textAlign = "left"; ctx.textBaseline = "top";
    [`θ = ${fmt((s.theta * 180) / Math.PI, 0)}°`, `p = ${fmt(s.p / 100, 1)} bar`, `T = ${fmt(s.T, 0)} K`, `V = ${fmt(s.V * 1000, 0)} cm³`].forEach((t, i) => ctx.fillText(t, bx + (i % 2) * (bw + 10), yy + Math.floor(i / 2) * 18));
  }
}

/* ------------------------------------------------------------------ Chizish */

function draw(ctx, st) {
  const c = st.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "law") drawLaw(ctx, c, st.w, st.h); else if (ui.mode === "cyc") drawCyc(ctx, c, st.w, st.h); else drawEngine(ctx, c, st.w, st.h);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.55, vh * 0.42), 280, 340)), graph: Math.round(clamp(vh * 0.3, 200, 280)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* Grafik */
const toXY = (pts, tab) => pts.map((q) => (tab === "ts" ? { x: P.entropy(q.T, q.V, NU, G()), y: q.T } : { x: q.V, y: q.p }));
function rangeOf(xy, tab) {
  const xs = xy.map((q) => q.x), ys = xy.map((q) => q.y);
  const [x0, x1] = niceRange(Math.min(...xs), Math.max(...xs), 0.12, tab !== "ts"), [y0, y1] = niceRange(Math.min(...ys), Math.max(...ys), 0.12, true);
  return [x0, x1, y0, y1];
}
function hoverText(x, y) {
  if (ui.tab === "ts") return [`S = ${fmt(x, 2)} J/K`, `T = ${fmt(y, 0)} K`];
  return [`V = ${fmt(x, 2)} L, p = ${fmt(y, 0)} kPa`, `T = pV/νR = ${fmt(P.temp(y, x, NU), 0)} K`];
}
function drawGraph(ctx, gst) {
  const c = gst.colors;
  if (ui.mode === "law") {
    const res = lawResult(), part = lawPartial(res, law.u), xyAll = toXY(res.pts, ui.tab), n = Math.max(1, Math.round(law.u * (res.pts.length - 1)));
    const guides = [];
    if (ui.tab === "pv") { const g = G(), s0 = res.pts[0]; guides.push({ pts: P.legPath("T", s0, { V: 0.3 }, NU, g, 40).reverse().concat(P.legPath("T", s0, { V: VMAX }, NU, g, 60)).map((q) => ({ x: q.V, y: q.p })), color: c.danger }); } // boshlang'ich izoterma
    const leg = { xy: xyAll.slice(0, n + 1), type: law.type, Qp: part.Qp, Qm: part.Qm };
    const ghost = { xy: xyAll, type: law.type, Qp: res.Qp, Qm: res.Qm, dash: [6, 5], width: 1.8, noArrow: true };
    const s0 = xyAll[0], s1 = xyAll[n];
    return drawDiagram(ctx, gst, {
      range: ui.tab === "pv" ? [0, VMAX, 0, Math.max(250, niceRange(0, Math.max(...res.pts.map((q) => q.p)))[1])] : rangeOf(xyAll, "ts"),
      yLabel: ui.tab === "pv" ? "p, kPa" : "T, K", xUnit: ui.tab === "pv" ? "V, L" : "S, J/K",
      legs: [ghost, leg], fill: ui.tab === "pv" ? "under" : null, fillSign: part.A, guides,
      nodes: [{ ...s0, label: "1" }, { ...xyAll[xyAll.length - 1], label: "2", drag: false }], point: s1, hover: ui.hover, hoverText,
      legend: ui.tab === "pv" ? [{ color: c.danger, label: "izoterma (T₁)", dash: [3, 4] }] : null,
    });
  }
  if (ui.mode === "cyc") {
    const res = cycCache || cycResult(), st = cycState(res, cyc.u), legs = res.legs.map((l) => ({ ...l, xy: toXY(l.pts, ui.tab) })), all = legs.flatMap((l) => l.xy);
    const drag = ui.tab === "pv" && (cyc.kind === "custom" || cyc.kind === "rect");
    const nodes = res.nodes.map((n, i) => ({ ...(ui.tab === "pv" ? { x: n.V, y: n.p } : toXY([{ ...n, T: P.temp(n.p, n.V, NU) }], "ts")[0]), label: String(i + 1), drag }));
    return drawDiagram(ctx, gst, { range: rangeOf(all, ui.tab), yLabel: ui.tab === "pv" ? "p, kPa" : "T, K", xUnit: ui.tab === "pv" ? "V, L" : "S, J/K", legs, fill: "cycle", fillSign: res.A, nodes, point: toXY([st], ui.tab)[0], hover: ui.hover, hoverText, legend: [{ color: c.danger, label: "Q olinadi" }, { color: c.primary, label: "Q beriladi" }, { color: c.text3, label: "adiabata" }] });
  }
  const e = engModel();
  if (ui.tab === "pt") return drawPTheta(ctx, gst, { eng: e, theta: eng.theta, hover: ui.hover });
  const legs = e.cyc.legs.map((l) => ({ ...l, xy: l.pts.map((q) => ({ x: q.V * 1000, y: q.p / 100 })) }));
  const intake = { xy: [{ x: e.Vc * 1000, y: 1 }, { x: e.V1 * 1000, y: 1 }], type: "line", Qp: 0, Qm: 0, dash: [4, 4], width: 1.5, noArrow: true };
  const s = e.state(eng.theta), all = legs.flatMap((l) => l.xy);
  return drawDiagram(ctx, gst, { range: [0, niceRange(0, e.V1 * 1000)[1], 0, niceRange(0, Math.max(...all.map((q) => q.y)))[1]], yLabel: "p, bar", xUnit: "V, cm³", legs: [...legs, intake], fill: "cycle", fillSign: 1, point: { x: s.V * 1000, y: s.p / 100 }, nodes: e.nodes.map((n, i) => ({ x: n.V * 1000, y: n.p / 100, label: String(i + 1) })), hover: ui.hover, hoverText: (x, y) => [`V = ${fmt(x, 0)} cm³, p = ${fmt(y, 1)} bar`] });
}
const graph = createStage($("#graph"), drawGraph, { height: (cw) => heights(cw).graph });

const TABS = {
  law: { pv: ["p–V diagramma", "Grafik ostidagi yashil yuza — gaz bajargan ish A (siqilganda qizil — ish gaz ustida bajariladi). Shtrix — boshlang‘ich haroratdagi izoterma: undan yuqorida gaz isigan."], ts: ["T–S diagramma", "Grafik ostidagi yuza — olingan issiqlik Q = ∫T dS. Adiabatik jarayonda entropiya o‘zgarmaydi (vertikal chiziq)."] },
  cyc: { pv: ["Sikl: p–V diagramma", "Sikl ichidagi yuza — bir siklda bajarilgan foydali ish A = Q₁ − Q₂. Qizil tarmoqlarda gaz issiqlik oladi, ko‘k tarmoqlarda beradi."], ts: ["Sikl: T–S diagramma", "Karno sikli T–S da to‘g‘ri to‘rtburchak: ikki izoterma (gorizontal) va ikki adiabata (vertikal). Yuza — foydali ish."] },
  eng: { pv: ["Indikator diagramma (p–V)", "Ideal sikl: 1→2 siqish (adiabata), 2→3 yonish, 3→4 ishchi yo‘l, 4→1 chiqarish. Shtrix — so‘rish va chiqarish (atmosfera bosimi)."], pt: ["Bosim tirsak burchagi bo‘yicha p(θ)", "To‘rt takt — tirsakli valning ikki aylanishi (720°). Eng katta bosim yonishdan keyin, yuqori o‘lik nuqtada."] },
};
const TAB_LABEL = { pv: "p–V", ts: "T–S", pt: "p(θ)" };
function setTab(tab) {
  ui.tab = tab; const t = TABS[ui.mode][tab];
  $("[data-tabs]").innerHTML = Object.keys(TABS[ui.mode]).map((k) => `<button type="button" data-tab-value="${k}" aria-pressed="${k === tab}">${TAB_LABEL[k]}</button>`).join("");
  $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1] + (ui.mode === "cyc" && tab === "pv" && (cyc.kind === "custom" || cyc.kind === "rect") ? " Tugunlarni surib siklni o‘zgartiring." : "");
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
const u = (v, d, unit) => `${fmt(v, d)}<small>${unit}</small>`;
const PROC = { p: "Izobarik (p = const)", V: "Izoxorik (V = const)", T: "Izotermik (T = const)", Q0: "Adiabatik (Q = 0)" };

function updateReadouts() {
  if (ui.mode === "law") {
    const res = lawResult(), s1 = res.pts[0], s2 = res.s2, T2 = P.temp(s2.p, s2.V, NU);
    setRO("r1", "Jarayon", PROC[law.type].split(" (")[0], PROC[law.type].slice(PROC[law.type].indexOf("(")));
    setRO("r2", "Issiqlik miqdori <i>Q</i>", u(res.Q, 1, "J"), res.Q > 0.5 ? "gaz issiqlik oldi" : res.Q < -0.5 ? "gaz issiqlik berdi" : "issiqlik almashinuvi yo‘q", "orange");
    setRO("r3", "Ichki energiya o‘zgarishi <i>ΔU</i>", u(res.dU, 1, "J"), `= (i/2)·νRΔT, i = ${ui.i}`);
    setRO("r4", "Gaz bajargan ish <i>A</i>", u(res.A, 1, "J"), res.A > 0.5 ? "gaz kengaydi" : res.A < -0.5 ? "gaz ustida ish bajarildi" : "hajm o‘zgarmadi — A = 0");
    setRO("r5", "Harorat <i>T₁ → T₂</i>", `${fmt(s1.T, 0)} → ${fmt(T2, 0)}<small>K</small>`, `p₂ = ${fmt(s2.p, 0)} kPa, V₂ = ${fmt(s2.V, 2)} L`);
    setRO("r6", "Tekshiruv <i>Q − (ΔU + A)</i>", u(res.Q - res.dU - res.A, 2, "J"), "1-qonun: energiya saqlanadi");
    return;
  }
  if (ui.mode === "cyc") {
    const r = cycCache || cycResult(); let Th = 0, Tc = Infinity; r.legs.forEach((l) => l.pts.forEach((q) => { Th = Math.max(Th, q.T); Tc = Math.min(Tc, q.T); }));
    const fr = cyc.kind === "fridge";
    setRO("r1", fr ? "Sovuqdan olingan <i>Q₂</i>" : "Isitgichdan olingan <i>Q₁</i>", u(r.Q1, 1, "J"), fr ? "sovitgich kamerasidan" : "issiqlik olingan tarmoqlar (qizil)");
    setRO("r2", fr ? "Xonaga berilgan <i>Q₁</i>" : "Sovitgichga berilgan <i>Q₂</i>", u(r.Q2, 1, "J"), fr ? "Q₁ = Q₂ + A" : "ko‘k tarmoqlar");
    setRO("r3", fr ? "Sarflangan ish <i>A</i>" : "Foydali ish <i>A</i>", u(Math.abs(r.A), 1, "J"), `= sikl yuzasi; ΔU = ${fmt(r.dU, 2)} J`);
    if (fr) { setRO("r4", "Sovitish koeffitsiyenti", fmt(r.Q1 / Math.abs(r.A), 2), `T₂/(T₁ − T₂) = ${fmt(P.copFridge(cyc.T1, cyc.T2), 2)}`, "orange"); setRO("r5", "Issiqlik nasosi koeffitsiyenti", fmt(r.Q2 / Math.abs(r.A), 2), `T₁/(T₁ − T₂) = ${fmt(P.copPump(cyc.T1, cyc.T2), 2)}`); }
    else { setRO("r4", "FIK <i>η</i>", u(r.eta * 100, 1, "%"), "η = A/Q₁", "orange"); setRO("r5", "Karno FIKi (shu haroratlar)", u(P.etaCarnot(Th, Tc) * 100, 1, "%"), `T_max = ${fmt(Th, 0)} K, T_min = ${fmt(Tc, 0)} K`); }
    setRO("r6", cyc.kind === "otto" ? "Otto formulasi" : "Holat", cyc.kind === "otto" ? u(P.etaOtto(cyc.eps, G().gamma) * 100, 1, "%") : `${fmt(cycState(r, cyc.u).T, 0)}<small>K</small>`, cyc.kind === "otto" ? "η = 1 − ε^(1−γ)" : `${Math.floor(cyc.u) % 4 + 1}-tarmoq`);
    return;
  }
  const e = engModel(), s = e.state(eng.theta), pmax = Math.max(...e.nodes.map((n) => n.p)), Tmax = Math.max(...e.nodes.map((n) => P.temp(n.p, n.V, e.nu)));
  setRO("r1", "Takt", P.STROKES[s.stroke], `θ = ${fmt((s.theta * 180) / Math.PI, 0)}° (${s.stroke < 2 ? 1 : 2}-aylanish)`);
  setRO("r2", "Ideal FIK <i>η</i>", u(e.eta * 100, 1, "%"), eng.fuel === "dizel" ? "Dizel sikli" : "η = 1 − ε^(1−γ), γ = 1,4", "orange");
  setRO("r3", "Bir sikldagi ish <i>A</i>", u(e.A, 0, "J"), `Q₁ = ${fmt(e.Q1, 0)} J, Q₂ = ${fmt(e.cyc.Q2, 0)} J`);
  setRO("r4", "Quvvat (3000 ayl/min)", u((e.A * 25) / 1000, 1, "kW"), "har 2 aylanishda bitta ishchi yo‘l");
  setRO("r5", "Eng katta bosim", u(pmax / 100, 0, "bar"), `siqish oxirida ${fmt(e.nodes[1].p / 100, 0)} bar`);
  setRO("r6", "Eng yuqori harorat", u(Tmax, 0, "K"), `siqishdan keyin ${fmt(P.temp(e.nodes[1].p, e.nodes[1].V, e.nu), 0)} K`);
}
function updateStatus() {
  const el = $("[data-status]"); let t, tone = "blue";
  if (ui.mode === "law") { const r = lawResult(); t = law.u < 1 ? "Jarayon bormoqda" : r.dU > 0.5 ? "Gaz isidi (ΔU > 0)" : r.dU < -0.5 ? "Gaz soviydi (ΔU < 0)" : "Harorat o‘zgarmadi"; tone = law.u < 1 ? "purple" : r.dU > 0.5 ? "orange" : "blue"; }
  else if (ui.mode === "cyc") { const st = cycState(cycCache || cycResult(), cyc.u); t = st.dQ > 1e-6 ? "Issiqlik olinmoqda" : st.dQ < -1e-6 ? "Issiqlik berilmoqda" : "Adiabatik tarmoq"; tone = st.dQ > 1e-6 ? "red" : st.dQ < -1e-6 ? "blue" : "purple"; }
  else { const s = engModel().state(eng.theta); t = `${P.STROKES[s.stroke]} takti`; tone = s.stroke === 2 ? "red" : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "law") {
    const r = lawResult();
    p.push("<p><b>Termodinamikaning birinchi qonuni</b>: gazga berilgan issiqlik Q uning ichki energiyasini oshirishga (ΔU) va tashqi kuchlarga qarshi ish bajarishga (A) sarflanadi: Q = ΔU + A. Bu — energiyaning saqlanish qonuni.</p>");
    p.push({ p: `<p>Izobarik jarayonda bosim o‘zgarmas (yuklar bir xil). Gaz kengayganda issiqlikning ${ui.i === 3 ? "2/5" : "2/7"} qismi ishga, qolgani ichki energiyaga ketadi: Q = ${fmt(r.Q, 0)} J, A = ${fmt(r.A, 0)} J.</p>`, V: "<p>Izoxorik jarayonda hajm o‘zgarmaydi, demak A = 0: barcha issiqlik ichki energiyani oshiradi (Q = ΔU), bosim va harorat ortadi.</p>", T: "<p>Izotermik jarayonda harorat o‘zgarmaydi (termostat), ideal gazning ichki energiyasi ham o‘zgarmaydi: olingan issiqlik to‘liq ishga aylanadi (Q = A).</p>", Q0: "<p>Adiabatik jarayonda issiqlik almashinuvi yo‘q (Q = 0): ish faqat ichki energiya hisobidan bajariladi (A = −ΔU). Gaz tez siqilganda qiziydi (velosiped nasosi), kengayganda soviydi.</p>" }[law.type]);
  } else if (ui.mode === "cyc") {
    const r = cycCache || cycResult();
    p.push(cyc.kind === "fridge" ? "<p><b>Sovitgich</b> — teskari ishlaydigan issiqlik mashinasi: tashqi ish (kompressor) hisobiga issiqlikni sovuq jismdan (kamera) olib, issiqroq jismga (xona) beradi. Sikl p–V da soat strelkasiga qarshi aylanadi, yuza — sarflangan ish.</p>" : `<p><b>Issiqlik mashinasi</b> siklik ishlaydi: isitgichdan Q₁ issiqlik oladi, uning bir qismini ishga aylantiradi va qolganini (Q₂) sovitgichga beradi. FIK η = (Q₁ − Q₂)/Q₁ = ${fmt(r.eta * 100, 1)} %.</p>`);
    p.push(cyc.kind === "carnot" ? `<p><b>Karno sikli</b> — ikki izoterma va ikki adiabata. Berilgan T₁ va T₂ oralig‘ida ishlaydigan mashinalar ichida eng katta FIK aynan Karno siklida: η = 1 − T₂/T₁ = ${fmt(P.etaCarnot(cyc.T1, cyc.T2) * 100, 1)} %. U gaz turiga va hajmga bog‘liq emas — termometrlarni surib tekshiring.</p>` : cyc.kind === "otto" ? "<p>Otto sikli — benzinli dvigatelning ideal modeli: ikki adiabata va ikki izoxora. FIK faqat siqish darajasi ε va γ ga bog‘liq.</p>" : cyc.kind === "fridge" ? "<p>Sovitgich koeffitsiyenti 1 dan katta bo‘lishi mumkin: 1 J ish sarflab, kameradan bir necha joul issiqlik olib chiqiladi. T₁ va T₂ yaqin bo‘lsa, koeffitsiyent katta.</p>" : "<p>Tugunlarni surib turli sikllarni sinab ko‘ring: FIK hech qachon shu eng yuqori va eng past haroratlar orasidagi Karno FIKidan oshmaydi (termodinamikaning 2-qonuni).</p>");
  } else {
    const e = engModel();
    p.push("<p><b>To‘rt taktli dvigatel</b>: 1) so‘rish — porshen pastga, kirish klapani ochiq; 2) siqish — klapanlar yopiq, aralashma siqiladi va qiziydi; 3) ishchi yo‘l — yoqilg‘i yonadi, qizigan gaz porshenni itaradi; 4) chiqarish — ishlatilgan gaz chiqib ketadi. Bir sikl — tirsakli valning ikki aylanishi.</p>");
    p.push(eng.fuel === "dizel" ? `<p>Dizelda havo kuchli siqiladi (ε = ${fmt(eng.eps, 1)}) va ${fmt(P.temp(e.nodes[1].p, e.nodes[1].V, e.nu), 0)} K gacha qiziydi — purkalgan yoqilg‘i o‘z-o‘zidan alangalanadi, uchqun kerak emas. Yuqori ε tufayli FIK kattaroq.</p>` : `<p>Benzinli dvigatelda aralashma uchqun bilan yondiriladi. Ideal FIK η = 1 − ε^(1−γ) = ${fmt(e.eta * 100, 1)} %; siqish darajasini oshirsak FIK ortadi, lekin juda katta ε da benzin o‘z-o‘zidan portlaydi (detonatsiya).</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "law" ? "<small>1-qonun</small> Q = ΔU + A" : ui.mode === "cyc" ? (cyc.kind === "fridge" ? "<small>Sovitgich</small> k = Q₂/A" : "<small>FIK</small> η = (Q₁ − Q₂)/Q₁") : "<small>Otto sikli</small> η = 1 − ε<sup>1−γ</sup>";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { if (ui.mode === "cyc") cycResult(); updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  const temp = ui.mode === "law" ? (lawPartial(lawResult(), law.u).s.T) : ui.mode === "cyc" ? cycState(cycCache || cycResult(), cyc.u).T : engModel().state(eng.theta).T;
  const sp = 0.25 * Math.sqrt(temp / 300);
  for (const p of parts) { p.x += Math.cos(p.a) * sp * dt * 2; p.y += Math.sin(p.a) * sp * dt * 2; if (p.x < 0 || p.x > 1) { p.a = Math.PI - p.a; p.x = clamp(p.x, 0, 1); } if (p.y < 0 || p.y > 1) { p.a = -p.a; p.y = clamp(p.y, 0, 1); } }
  if (ui.mode === "law" && law.u < 1) { law.u = Math.min(1, law.u + (dt * ui.speed) / 2.5); if (law.u >= 1) refresh(); }
  if (ui.mode === "cyc") cyc.u = (cyc.u + (dt * ui.speed) / 1.6) % 4;
  if (ui.mode === "eng") eng.theta = (eng.theta + (dt * ui.speed * 4 * Math.PI) / 5) % (4 * Math.PI);
  stage.render(); graph.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; updateReadouts(); updateStatus(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : ui.mode === "law" ? "Jarayonni ko‘rsatish" : "Davom ettirish";
}
playBtn.addEventListener("click", () => {
  if (loop.running) { loop.stop(); return; }
  if (ui.mode === "law" && law.u >= 1) law.u = 0;
  if (prefersReducedMotion() && ui.mode === "law") { law.u = 1; refresh(); return; }
  loop.start();
});
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || MODE_DEFAULT[ui.mode]));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = +b.dataset.speedValue; document.querySelectorAll("[data-speed-value]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));

/* ------------------------------------------------------------------ Boshqaruv */

function changed() { law.u = 1; eng.model = null; customized(); refresh(); }
const lPC = bindRange($("#lP"), $("#lPOut"), (v) => `${fmt(v, 0)} kPa`, (v) => { law.p1 = v; changed(); });
const lVC = bindRange($("#lV"), $("#lVOut"), (v) => `${fmt(v, 1)} L`, (v) => { law.V1 = v; changed(); });
const lV2C = bindRange($("#lV2"), $("#lV2Out"), (v) => `${fmt(v, 2)} L`, (v) => { law.V2 = v; changed(); });
const lQC = bindRange($("#lQ"), $("#lQOut"), (v) => `${fmt(v, 0)} J`, (v) => { law.Q = v; changed(); });
const cT1C = bindRange($("#cT1"), $("#cT1Out"), (v) => `${fmt(v, 0)} K`, (v) => { cyc.T1 = v; if (cyc.T2 > v - 50) { cyc.T2 = v - 50; cT2C.set(cyc.T2); } changed(); });
const cT2C = bindRange($("#cT2"), $("#cT2Out"), (v) => `${fmt(v, 0)} K`, (v) => { cyc.T2 = v; if (cyc.T1 < v + 50) { cyc.T1 = v + 50; cT1C.set(cyc.T1); } changed(); });
const cRC = bindRange($("#cR"), $("#cROut"), (v) => fmt(v, 1), (v) => { cyc.r = v; changed(); });
const cEC = bindRange($("#cE"), $("#cEOut"), (v) => fmt(v, 1), (v) => { cyc.eps = v; changed(); });
const cQC = bindRange($("#cQ"), $("#cQOut"), (v) => `${fmt(v, 0)} J`, (v) => { cyc.Q1 = v; changed(); });
const eEC = bindRange($("#eE"), $("#eEOut"), (v) => fmt(v, 1), (v) => { eng.eps = v; changed(); });
const eQC = bindRange($("#eQ"), $("#eQOut"), (v) => `${fmt(v, 0)} J`, (v) => { eng.Q1 = v; changed(); });
const cK = $("#cK");
cK.addEventListener("change", () => { cyc.kind = cK.value; syncKind(); changed(); setTab(ui.tab); });
const seg = (attr, fn) => document.querySelectorAll(`[data-${attr}-value]`).forEach((b) => b.addEventListener("click", () => { fn(b.dataset[`${attr}Value`]); syncSegs(); changed(); }));
seg("gas", (v) => { ui.i = +v; });
seg("proc", (v) => { law.type = v; syncProc(); });
seg("fuel", (v) => { eng.fuel = v; if (v === "dizel" && eng.eps < 14) { eng.eps = 18; eEC.set(18); } if (v === "benzin" && eng.eps > 12) { eng.eps = 10; eEC.set(10); } });
function syncSegs() {
  const set = (attr, val) => document.querySelectorAll(`[data-${attr}-value]`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[`${attr}Value`] === String(val))));
  set("gas", ui.i); set("proc", law.type); set("fuel", eng.fuel);
}
function syncProc() { document.querySelectorAll("[data-lt]").forEach((el) => { el.hidden = (el.dataset.lt === "heat") !== (law.type === "V"); }); }
const CK_HINT = { carnot: "Isitgich va sovitgich termometrlarini sahnada surib haroratlarni o‘zgartiring.", fridge: "Termometrlarni surib kamera (T₂) va xona (T₁) haroratini o‘zgartiring.", rect: "p–V grafigidagi burchaklarni suring: sikl to‘g‘ri to‘rtburchakligicha qoladi.", custom: "p–V grafigidagi 4 ta tugunni xohlagan joyga suring.", otto: "ε va Q₁ ni o‘zgartiring." };
function syncKind() {
  cK.value = cyc.kind;
  document.querySelectorAll("[data-ck]").forEach((el) => { el.hidden = !el.dataset.ck.split(" ").includes(cyc.kind); });
  $("[data-ck-hint]").textContent = CK_HINT[cyc.kind];
}

/* Sahnada sudrash */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const hit = (p, b) => b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r;
function stageHit(p) {
  if (ui.mode === "law") { if (law.type !== "V" && hit(p, geo.piston)) return "piston"; if (law.type === "V" && hit(p, geo.knob)) return "knob"; }
  if (ui.mode === "cyc" && (cyc.kind === "carnot" || cyc.kind === "fridge")) { if (hit(p, geo.T1)) return "T1"; if (hit(p, geo.T2)) return "T2"; }
  if (ui.mode === "eng" && hit(p, geo.crank)) return "crank";
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = stageHit(p); if (!h) return;
  e.preventDefault(); drag = { k: h, y0: p.y, v0: law.Q, a0: Math.atan2(p.x - (geo.crank?.x ?? 0), -(p.y - (geo.crank?.y ?? 0))) };
  if (h === "crank" || h === "piston" || h === "knob") loop.stop();
  canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (!drag) { const h = stageHit(p); canvas.style.cursor = h ? (h === "crank" ? "grab" : h === "knob" ? "ew-resize" : "ns-resize") : ""; return; }
  if (drag.k === "piston") { const L = geo.law, V = clamp(Math.round(((L.yBot - (p.y + 7)) / L.k) * 20) / 20, 0.3, VMAX); law.V2 = V; lV2C.set(V); changed(); }
  else if (drag.k === "knob") { law.Q = clamp(Math.round((drag.v0 + (drag.y0 - p.y) * 2) / 5) * 5, -100, 300); lQC.set(law.Q); changed(); }
  else if (drag.k === "T1" || drag.k === "T2") {
    const gT = geo[drag.k], T = clamp(Math.round((200 + 600 * (1 - (p.y - gT.y0) / gT.h)) / 10) * 10, drag.k === "T1" ? 300 : 230, drag.k === "T1" ? 700 : 450);
    if (drag.k === "T1") { cyc.T1 = Math.max(T, cyc.T2 + 50); cT1C.set(cyc.T1); } else { cyc.T2 = Math.min(T, cyc.T1 - 50); cT2C.set(cyc.T2); }
    changed();
  } else if (drag.k === "crank") {
    const a = Math.atan2(p.x - geo.crank.x, -(p.y - geo.crank.y)); let d = a - drag.a0; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
    drag.a0 = a; eng.theta = (eng.theta + d + 4 * Math.PI) % (4 * Math.PI); refresh();
  }
});
function endDrag() { if (!drag) return; drag = null; canvas.dataset.dragging = "false"; refresh(); }
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* Grafikda: kursor va tugunlar */
const gcv = graph.canvas;
let gdrag = null;
function toData(p) { const f = lastFrame(); if (!f) return null; const r = f.rect, [x0, x1, y0, y1] = f.range; return { x: x0 + ((p.x - r.x) / r.w) * (x1 - x0), y: y1 - ((p.y - r.y) / r.h) * (y1 - y0), inside: p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h }; }
function nodeAt(p) {
  if (ui.mode !== "cyc" || ui.tab !== "pv" || !(cyc.kind === "custom" || cyc.kind === "rect")) return -1;
  const f = lastFrame(); if (!f) return -1;
  const nodes = (cycCache || cycResult()).nodes;
  for (let i = 0; i < nodes.length; i++) if (Math.hypot(p.x - f.X(nodes[i].V), p.y - f.Y(nodes[i].p)) <= 14) return i;
  return -1;
}
gcv.addEventListener("pointerdown", (e) => { const p = ptr(gcv, e), n = nodeAt(p); if (n < 0) return; gdrag = { n, range: lastFrame().range.slice() }; e.preventDefault(); try { gcv.setPointerCapture(e.pointerId); } catch { /* */ } });
gcv.addEventListener("pointermove", (e) => {
  const p = ptr(gcv, e), d = toData(p);
  if (gdrag && d) {
    const V = clamp(Math.round(d.x * 20) / 20, 0.3, 4), pr = clamp(Math.round(d.y / 5) * 5, 30, 400);
    if (cyc.kind === "custom") cyc.quad[gdrag.n] = { V, p: pr };
    else { const q = cyc.rect, n = gdrag.n; if (n === 0 || n === 3) q.Va = Math.min(V, q.Vb - 0.2); else q.Vb = Math.max(V, q.Va + 0.2); if (n <= 1) q.pb = Math.max(pr, q.pa + 10); else q.pa = Math.min(pr, q.pb - 10); }
    changed(); return;
  }
  ui.hover = d && d.inside ? { x: d.x, y: d.y } : null;
  gcv.style.cursor = nodeAt(p) >= 0 ? "move" : ui.hover ? "crosshair" : ""; graph.render();
});
gcv.addEventListener("pointerleave", () => { if (!gdrag) { ui.hover = null; graph.render(); } });
const gEnd = () => { gdrag = null; };
gcv.addEventListener("pointerup", gEnd); gcv.addEventListener("pointercancel", gEnd);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  heatP: { mode: "law", title: "Gazni qizdirish (izobarik)", lesson: "Porshen ustidagi yuklar bosimni o‘zgarmas saqlaydi. Gaz isitilganda kengayadi: issiqlikning bir qismi ishga, qolgani ichki energiyaga ketadi. Porshenni surib V₂ ni o‘zgartiring.", set: () => { Object.assign(law, { type: "p", p1: 100, V1: 1, V2: 2 }); ui.i = 3; } },
  heatV: { mode: "law", title: "Yopiq idish (izoxorik)", lesson: "Porshen mahkamlangan — hajm o‘zgarmaydi, gaz ish bajarmaydi. Gorelka dastagini burab Q ni o‘zgartiring: barcha issiqlik ichki energiyaga aylanadi.", set: () => { Object.assign(law, { type: "V", p1: 100, V1: 1, Q: 100 }); ui.i = 3; } },
  isoT: { mode: "law", title: "Izotermik kengayish", lesson: "Silindr termostatda: harorat o‘zgarmas, ΔU = 0. Gaz kengayganda olgan issiqligini to‘liq ishga aylantiradi (Q = A). p–V da giperbola (izoterma).", set: () => { Object.assign(law, { type: "T", p1: 100, V1: 1, V2: 3 }); ui.i = 3; } },
  pump: { mode: "law", title: "Nasos: adiabatik siqish", lesson: "Havo tez siqiladi — issiqlik chiqib ketishga ulgurmaydi (Q = 0). Bajarilgan ish ichki energiyaga aylanadi: havo qiziydi. Velosiped nasosi shuning uchun isiydi.", set: () => { Object.assign(law, { type: "Q0", p1: 100, V1: 1, V2: 0.4 }); ui.i = 5; } },
  cool: { mode: "law", title: "Sovitish (izobarik siqilish)", lesson: "Gaz muz ustida soviydi va o‘zgarmas bosimda siqiladi: Q < 0, A < 0 (ish gaz ustida bajariladi), ΔU < 0.", set: () => { Object.assign(law, { type: "p", p1: 100, V1: 1.2, V2: 0.8 }); ui.i = 3; } },
  carnot: { mode: "cyc", title: "Karno sikli", lesson: "Gaz isitgichdan (T₁ = 500 K) izotermik kengayishda issiqlik oladi, sovitgichga (T₂ = 300 K) izotermik siqilishda beradi; oraliqda — adiabatalar. FIK 1 − T₂/T₁ = 40 %. Termometrlarni suring.", set: () => Object.assign(cyc, { kind: "carnot", T1: 500, T2: 300, r: 2 }) },
  carnotHot: { mode: "cyc", title: "Isitgich qanchalik issiq bo‘lsa…", lesson: "T₁ = 700 K, T₂ = 300 K: FIK 57 %. Isitgich haroratini oshirish yoki sovitgichni sovitish FIKni oshiradi — issiqlik elektr stansiyalarida bug‘ shuning uchun juda qizdiriladi.", set: () => Object.assign(cyc, { kind: "carnot", T1: 700, T2: 300, r: 2 }) },
  rect: { mode: "cyc", title: "To‘g‘ri to‘rtburchak sikl", lesson: "Ikki izobara va ikki izoxora. Yuza = (p₂ − p₁)(V₂ − V₁) — foydali ish. Burchaklarni surib siklni kattalashtiring va FIKni shu haroratlar uchun Karno FIKi bilan solishtiring.", set: () => Object.assign(cyc, { kind: "rect", rect: { Va: 1, Vb: 2.5, pa: 80, pb: 180 } }) },
  custom: { mode: "cyc", title: "O‘z siklingizni chizing", lesson: "To‘rtta tugunni p–V grafigida xohlagan joyga suring. Soat strelkasi bo‘yicha aylansa — dvigatel (A > 0), teskari bo‘lsa — sovitgich. FIK Karnodan oshib keta oladimi?", set: () => Object.assign(cyc, { kind: "custom", quad: [{ V: 1, p: 200 }, { V: 2.6, p: 170 }, { V: 3, p: 70 }, { V: 1.3, p: 90 }] }) },
  ottoC: { mode: "cyc", title: "Otto sikli", lesson: "Benzinli dvigatelning ideal sikli: adiabatik siqish, o‘zgarmas hajmda yonish, adiabatik kengayish, o‘zgarmas hajmda sovish. ε ni oshirib FIK o‘sishini kuzating.", set: () => { Object.assign(cyc, { kind: "otto", eps: 6, Q1: 200 }); ui.i = 5; } },
  fridge: { mode: "cyc", title: "Sovitgich", lesson: "Kamera 250 K (−23 °C), xona 300 K. Kompressor ish bajarib, issiqlikni kameradan xonaga «nasos» qiladi. Sovitish koeffitsiyenti T₂/(T₁ − T₂) = 5: 1 J ish evaziga kameradan 5 J issiqlik olinadi.", set: () => Object.assign(cyc, { kind: "fridge", T1: 300, T2: 250, r: 2 }) },
  benzin: { mode: "eng", title: "Benzinli dvigatel (ε = 10)", lesson: "To‘rt taktni kuzating: grafikda nuqta indikator diagramma bo‘ylab yuradi. Tirsakli valni sichqoncha bilan aylantirib, har taktni alohida ko‘ring.", set: () => Object.assign(eng, { fuel: "benzin", eps: 10, Q1: 900 }) },
  dizel: { mode: "eng", title: "Dizel (ε = 18)", lesson: "Dizelda havo 18 marta siqiladi va 900 K dan ortiq qiziydi — yoqilg‘i purkalganda o‘z-o‘zidan yonadi. Yonish o‘zgarmas bosimda boradi (grafikda gorizontal tarmoq).", set: () => Object.assign(eng, { fuel: "dizel", eps: 18, Q1: 900 }) },
  lowEps: { mode: "eng", title: "Kichik siqish darajasi (ε = 6)", lesson: "Siqish darajasi kichik — eski dvigatellar kabi. FIK 51 %, ε = 10 da 60 %. Indikator diagramma yuzasini solishtiring.", set: () => Object.assign(eng, { fuel: "benzin", eps: 6, Q1: 900 }) },
};
const GROUPS = [["1-qonun", ["heatP", "heatV", "isoT", "pump", "cool"]], ["Sikllar va FIK", ["carnot", "carnotHot", "rect", "custom", "ottoC", "fridge"]], ["Dvigatel", ["benzin", "dizel", "lowEps"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { law: "Porshenni yoki gorelka dastagini suring", cyc: "Termometrlarni yoki grafik tugunlarini suring", eng: "Tirsakli valni aylantiring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
}
function syncAll() {
  lPC.set(law.p1); lVC.set(law.V1); lV2C.set(law.V2); lQC.set(law.Q);
  cT1C.set(cyc.T1); cT2C.set(cyc.T2); cRC.set(cyc.r); cEC.set(cyc.eps); cQC.set(cyc.Q1); eEC.set(eng.eps); eQC.set(eng.Q1);
  syncSegs(); syncProc(); syncKind();
}
const MODE_DEFAULT = { law: "heatP", cyc: "carnot", eng: "benzin" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  loop.stop(); drag = null; gdrag = null; ui.hover = null;
  ui.mode = p.mode; p.set(); eng.model = null; law.u = 1; cyc.u = 0; eng.theta = 0;
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab("pv"); refresh();
  if (ui.mode !== "law" && !prefersReducedMotion()) loop.start(); else setPlayUI(false);
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "heatP");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
