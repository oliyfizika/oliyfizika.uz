// ==========================================================================
// Bosim, Paskal qonuni va tutash idishlar — virtual laboratoriya (simulations/pressure.html)
// 1) Qattiq jism bosimi: g'isht (3 qirra, ustiga yuk), odam etikda va chang'ida, igna, traktor — qumdagi iz p ga mos.
// 2) Paskal qonuni: gidravlik press (kichik porshen sahnada pastga suriladi, katta porshen yukni ko'taradi) va Paskal shari.
// 3) Suyuqlik bosimi: idishdagi bosim datchigi (sahnada suriladi) + U-manometr, p = ρgh; tutash idishlar va suv-moy U-nay.
// Fizika: pressure-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { clamp, fmt, sci, createStage, tag, bindRange, arrow } from "./sim-kit.js";
import * as P from "./pressure-physics.js";
import { drawCompare, drawPress, drawDepth, drawProfiles, lastFrame } from "./pressure-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 13px Inter, system-ui, sans-serif";
const OBJ_NAMES = { brick: "G‘isht (3,5 kg)", ...Object.fromEntries(Object.entries(P.OBJECTS).map(([k, v]) => [k, v.name])) };
const TANK_H = 0.8;  // idishdagi suyuqlik chuqurligi, m
const UT_H = 0.4;    // U-nay balandligi, m
const UT_W0 = 0.2;   // U-naydagi suv sathi (moysiz), m
const BALL_S = 10e-4; // Paskal shari porsheni yuzasi, m²
const PRESS_S1MAX = 20; // kichik porshen yo'li, cm

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "solid", tab: "cmp", hover: null };
const solid = { obj: "brick", face: "flat", extra: 0 };
const pas = { view: "press", S1: 2, S2: 100, M: 200, s1: 6, F: 50, t: 0 };
const flu = { view: "depth", liq: "water", h: 0.3, x: 0.5, atm: false, rot: 0, level: 0.18, oil: 0.1 };
let presetId = null;
const geo = {};

/* ------------------------------------------------------------------ Hisob */

function solidNow() {
  if (solid.obj === "brick") { const f = P.FACES[solid.face], m = P.BRICK.m + solid.extra; return { F: P.weightN(m), S: f.S, m, label: `G‘isht: ${f.name.toLowerCase()}` }; }
  const o = P.OBJECTS[solid.obj]; return { F: o.F ?? P.weightN(o.m), S: o.S, m: o.m ?? null, label: o.name };
}
const solidP = () => { const s = solidNow(); return P.pressure(s.F, s.S); };
const pressF1 = () => P.forceToLift(pas.M, pas.S1 * 1e-4, pas.S2 * 1e-4);
const s2 = () => P.pressLift(pas.s1, pas.S1, pas.S2); // cm
const ballP = () => P.pistonPressure(pas.F, BALL_S);
const fluP = () => P.hydro(P.LIQUIDS[flu.liq].rho, flu.h, flu.atm);
const uNow = () => P.uTube(1000, P.LIQUIDS.oil.rho, flu.oil);

/* ------------------------------------------------------------------ 1. Qattiq jism */

function sand(ctx, c, x0, x1, y, h, col) {
  ctx.fillStyle = col; ctx.fillRect(x0, y, x1 - x0, h);
  ctx.fillStyle = c.dark ? "rgba(0,0,0,0.25)" : "rgba(120,90,40,0.25)";
  for (let k = 0; k < (x1 - x0) / 6; k++) { const xx = x0 + ((k * 37) % (x1 - x0)), yy = y + 6 + ((k * 13) % Math.max(4, h - 10)); ctx.fillRect(xx, yy, 2, 2); }
}
function drawSolidStage(ctx, c, w, h) {
  const narrow = w < 560, s = solidNow(), p = P.pressure(s.F, s.S), gy = h * 0.66, cx = narrow ? w * 0.5 : w * 0.36;
  const snow = solid.obj === "boots" || solid.obj === "skis", ground = snow ? (c.dark ? "#cbd5e1" : "#f1f5f9") : solid.obj === "tractor" ? (c.dark ? "#78350f" : "#a16207") : (c.dark ? "#a16207" : "#fcd34d");
  const dent = solid.obj === "needle" ? 46 : clamp(p / 250, 1, 44); // iz chuqurligi (px) ∝ p, sxematik
  sand(ctx, c, 8, w - 8, gy, h - gy - 8, ground);
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(snow ? "qor" : solid.obj === "tractor" ? "yumshoq tuproq" : "qum", 14, h - 10);
  geo.brick = null; geo.load = null;
  if (solid.obj === "brick") {
    const f = P.FACES[solid.face], k = Math.min(620, (w * 0.5) / 0.25, (h * 0.5) / 0.25), bw = f.w * k, bh = f.h * k, y0 = gy + dent - bh;
    // iz
    ctx.fillStyle = c.dark ? "rgba(0,0,0,0.35)" : "rgba(120,80,20,0.35)"; ctx.fillRect(cx - bw / 2 - 3, gy, bw + 6, dent);
    const g = ctx.createLinearGradient(0, y0, 0, y0 + bh); g.addColorStop(0, "#dc6b3b"); g.addColorStop(1, "#9a3412");
    ctx.fillStyle = g; ctx.fillRect(cx - bw / 2, y0, bw, bh); ctx.strokeStyle = "#7c2d12"; ctx.lineWidth = 1.5; ctx.strokeRect(cx - bw / 2, y0, bw, bh);
    if (solid.face !== "end") { ctx.fillStyle = "rgba(0,0,0,0.18)"; for (const fx of [-0.25, 0.25]) { ctx.beginPath(); ctx.arc(cx + fx * bw, y0 + bh / 2, Math.min(bh * 0.25, 10), 0, TAU); ctx.fill(); } }
    geo.brick = { x: cx - bw / 2, y: y0, w: bw, h: bh };
    // yuk
    let ly = y0;
    for (let k2 = 0; k2 < solid.extra; k2++) { ly -= 9; ctx.fillStyle = c.dark ? "#64748b" : "#475569"; ctx.fillRect(cx - 22, ly, 44, 8); }
    if (solid.extra) { ctx.font = SMALL; ctx.fillStyle = c.text; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(`+${solid.extra} kg`, cx + 28, ly + 4); }
    const hy = ly - 18; ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, hy, 9, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.primary; ctx.beginPath(); ctx.moveTo(cx, hy - 5); ctx.lineTo(cx - 3, hy - 1.5); ctx.lineTo(cx + 3, hy - 1.5); ctx.closePath(); ctx.moveTo(cx, hy + 5); ctx.lineTo(cx - 3, hy + 1.5); ctx.lineTo(cx + 3, hy + 1.5); ctx.closePath(); ctx.fill();
    geo.load = { x: cx, y: hy, r: 14 };
    const fl = Math.min(60, 20 + s.F / 4); arrow(ctx, cx + bw / 2 + 18, y0 + bh * 0.2, 0, fl, c.danger, { width: 2.5, head: 8 });
    tag(ctx, `F = ${fmt(s.F, 1)} N`, cx + bw / 2 + 28, y0 + bh * 0.2 + fl / 2, { color: c.danger, bg: c.bg, font: MID });
    tag(ctx, `S = ${fmt(f.S * 1e4, 0)} cm²`, cx, gy + dent + 14, { color: c.text, bg: c.bg2, align: "center", font: MID });
  } else if (solid.obj === "boots" || solid.obj === "skis") {
    const fy = gy + dent, ski = solid.obj === "skis";
    ctx.fillStyle = c.dark ? "rgba(0,0,0,0.3)" : "rgba(100,116,139,0.35)"; ctx.fillRect(cx - (ski ? 150 : 30), gy, ski ? 300 : 60, dent);
    if (ski) { ctx.fillStyle = c.primary; ctx.fillRect(cx - 150, fy - 5, 300, 5); ctx.beginPath(); ctx.moveTo(cx + 150, fy); ctx.quadraticCurveTo(cx + 166, fy - 2, cx + 168, fy - 14); ctx.lineTo(cx + 162, fy - 5); ctx.closePath(); ctx.fill(); }
    const by = fy - (ski ? 5 : 0);
    ctx.fillStyle = c.text2; ctx.fillRect(cx - 26, by - 12, 24, 12); ctx.fillRect(cx + 2, by - 12, 24, 12);
    ctx.strokeStyle = c.text2; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx - 14, by - 12); ctx.lineTo(cx - 6, by - 70); ctx.moveTo(cx + 14, by - 12); ctx.lineTo(cx + 6, by - 70); ctx.stroke();
    ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(cx, by - 74); ctx.lineTo(cx, by - 130); ctx.stroke(); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, by - 120); ctx.lineTo(cx - 26, by - 86); ctx.moveTo(cx, by - 120); ctx.lineTo(cx + 26, by - 86); ctx.stroke(); ctx.lineCap = "butt";
    ctx.fillStyle = c.text2; ctx.beginPath(); ctx.arc(cx, by - 146, 13, 0, TAU); ctx.fill();
    tag(ctx, `S = ${fmt(s.S * 1e4, 0)} cm²`, cx, gy + dent + 16, { color: c.text, bg: c.bg2, align: "center", font: MID });
  } else if (solid.obj === "needle") {
    const ty = gy + dent; ctx.strokeStyle = c.text2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, ty); ctx.lineTo(cx, ty - 120); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, ty - 112, 2.5, 6, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = c.bg2; ctx.strokeStyle = c.text3; ctx.beginPath(); ctx.roundRect(cx - 20, ty - 150, 40, 30, 8); ctx.fill(); ctx.stroke();
    ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("barmoq", cx, ty - 135);
    arrow(ctx, cx + 30, ty - 160, 0, 40, c.danger, { width: 2.5, head: 8, label: "F = 1 N" });
    tag(ctx, "S = 0,01 mm²", cx, gy + dent + 16, { color: c.text, bg: c.bg2, align: "center", font: MID });
  } else {
    const tw = Math.min(260, w * 0.5), ty = gy + dent;
    ctx.fillStyle = c.dark ? "rgba(0,0,0,0.3)" : "rgba(80,50,20,0.35)"; ctx.fillRect(cx - tw / 2, gy, tw, dent);
    ctx.fillStyle = c.text2; ctx.beginPath(); ctx.roundRect(cx - tw / 2, ty - 26, tw, 26, 13); ctx.fill();
    ctx.fillStyle = c.bg2; for (let k2 = 0; k2 < 7; k2++) { ctx.beginPath(); ctx.arc(cx - tw / 2 + 18 + k2 * (tw - 36) / 6, ty - 13, 8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = "#16a34a"; ctx.fillRect(cx - tw / 2 + 20, ty - 90, tw * 0.55, 64); ctx.fillRect(cx - tw / 2 + 20 + tw * 0.55, ty - 120, tw * 0.3, 94);
    ctx.fillStyle = c.dark ? "#93c5fd" : "#bfdbfe"; ctx.fillRect(cx - tw / 2 + 28 + tw * 0.55, ty - 112, tw * 0.22, 30);
    tag(ctx, `S = ${fmt(s.S, 1)} m²`, cx, gy + dent + 16, { color: c.text, bg: c.bg2, align: "center", font: MID });
  }
  // natija paneli
  if (narrow) return;
  const ix = w * 0.66; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = "700 15px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text;
  ctx.fillText(s.label, ix, 16);
  ctx.font = MID; ctx.fillStyle = c.text2;
  [`F = ${s.m !== null ? `mg = ${fmt(s.m, 1)} kg · 9,81 = ` : ""}${fmt(s.F, 1)} N`, `S = ${s.S >= 1e-4 ? `${fmt(s.S, 4)} m²` : `${sci(s.S, 3)} m²`}`, `p = F/S = ${p >= 1e6 ? sci(p, 3) : fmt(p, 0)} Pa`, `iz chuqurligi bosimga mos`].forEach((l, k2) => ctx.fillText(l, ix, 42 + k2 * 18));
}

/* ------------------------------------------------------------------ 2. Paskal */

function drawPascalStage(ctx, c, w, h) {
  if (pas.view === "ball") return drawBall(ctx, c, w, h);
  const narrow = w < 560, k = 5.5, base = h * 0.4, pipeY = h - 34, oil = c.dark ? "rgba(250,204,21,0.35)" : "rgba(250,204,21,0.45)";
  const d1 = 14 + Math.sqrt(pas.S1) * 6, d2 = 20 + Math.sqrt(pas.S2) * 6.5, x1 = narrow ? w * 0.2 : w * 0.18, x2 = narrow ? w * 0.62 : w * 0.46;
  const y1 = base + pas.s1 * k, y2 = base - s2() * k;
  // suyuqlik
  ctx.fillStyle = oil; ctx.fillRect(x1 - d1 / 2, y1, d1, pipeY - y1); ctx.fillRect(x2 - d2 / 2, y2, d2, pipeY - y2); ctx.fillRect(x1 - d1 / 2, pipeY - 16, x2 - x1 + d1 / 2 + d2 / 2, 16);
  // devorlar
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2.5; ctx.beginPath();
  ctx.moveTo(x1 - d1 / 2, 40); ctx.lineTo(x1 - d1 / 2, pipeY); ctx.lineTo(x2 + d2 / 2, pipeY); ctx.lineTo(x2 + d2 / 2, 40);
  ctx.moveTo(x1 + d1 / 2, 40); ctx.lineTo(x1 + d1 / 2, pipeY - 16); ctx.lineTo(x2 - d2 / 2, pipeY - 16); ctx.lineTo(x2 - d2 / 2, 40); ctx.stroke();
  // porshenlar
  ctx.fillStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.fillRect(x1 - d1 / 2 + 1, y1 - 10, d1 - 2, 10); ctx.fillRect(x2 - d2 / 2 + 1, y2 - 12, d2 - 2, 12);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x1, y1 - 10); ctx.lineTo(x1, y1 - 46); ctx.stroke();
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x1, y1 - 52, 9, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.primary; ctx.beginPath(); ctx.moveTo(x1, y1 - 46); ctx.lineTo(x1 - 3, y1 - 50); ctx.lineTo(x1 + 3, y1 - 50); ctx.closePath(); ctx.fill();
  geo.knob = { x: x1, y: y1 - 52, r: 16, base, k };
  // yuk
  const car = pas.M >= 800, lw = Math.min(d2 + 40, 160), ly = y2 - 12;
  if (car) {
    ctx.fillStyle = c.danger; ctx.beginPath(); ctx.roundRect(x2 - lw / 2, ly - 30, lw, 22, 6); ctx.fill(); ctx.beginPath(); ctx.roundRect(x2 - lw * 0.3, ly - 46, lw * 0.6, 18, 6); ctx.fill();
    ctx.fillStyle = c.text2; ctx.beginPath(); ctx.arc(x2 - lw * 0.3, ly - 8, 8, 0, TAU); ctx.arc(x2 + lw * 0.3, ly - 8, 8, 0, TAU); ctx.fill();
  } else { ctx.fillStyle = c.dark ? "#475569" : "#334155"; ctx.fillRect(x2 - lw / 2 + 10, ly - 36, lw - 20, 36); ctx.fillStyle = "#fff"; ctx.font = BOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${fmt(pas.M, 0)} kg`, x2, ly - 18); }
  // kuchlar
  const F1 = pressF1(), F2 = P.weightN(pas.M);
  arrow(ctx, x1 + d1 / 2 + 14, y1 - 40, 0, 32, c.danger, { width: 2.5, head: 8 });
  tag(ctx, `F₁ = ${fmt(F1, 1)} N`, x1 + d1 / 2 + 20, y1 - 26, { color: c.danger, bg: c.bg, font: MID });
  arrow(ctx, x2 + d2 / 2 + 14, y2 + 30, 0, -36, c.success, { width: 2.5, head: 8 });
  tag(ctx, `F₂ = ${F2 >= 1000 ? `${fmt(F2 / 1000, 2)} kN` : `${fmt(F2, 0)} N`}`, x2 + d2 / 2 + 20, y2 + 4, { color: c.success, bg: c.bg, font: MID });
  // siljishlar
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x1 - d1, base); ctx.lineTo(x2 + d2, base); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(`s₁ = ${fmt(pas.s1, 1)} cm`, x1 - d1 / 2 - 6, (base + y1) / 2 + 6);
  ctx.textAlign = "right"; ctx.fillText(`s₂ = ${fmt(s2(), 2)} cm`, x2 - d2 / 2 - 6, base - 8);
  ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`S₁ = ${fmt(pas.S1, 0)} cm²`, x1, pipeY + 4); ctx.fillText(`S₂ = ${fmt(pas.S2, 0)} cm²`, x2, pipeY + 4);
  if (narrow) return;
  const ix = x2 + d2 / 2 + 110; if (w - ix < 150) return;
  ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = BOLD; ctx.fillStyle = c.text; ctx.fillText("Gidravlik press", ix, 16);
  ctx.font = MID; ctx.fillStyle = c.text2;
  [`p = F₁/S₁ = ${fmt((F1 / (pas.S1 * 1e-4)) / 1000, 1)} kPa`, `kuchda yutuq S₂/S₁ = ${fmt(pas.S2 / pas.S1, 0)}`, `A₁ = F₁s₁ = ${fmt(F1 * pas.s1 / 100, 2)} J`, `A₂ = F₂s₂ = ${fmt(F2 * s2() / 100, 2)} J`].forEach((l, k2) => ctx.fillText(l, ix, 40 + k2 * 18));
}
function drawBall(ctx, c, w, h) {
  const cy = h * 0.5, bx = w * 0.56, R = Math.min(70, h * 0.24), cx0 = w * 0.12, push = (pas.F / 100) * 30, water = c.dark ? "rgba(56,189,248,0.35)" : "rgba(56,189,248,0.4)";
  const p = ballP(), L = Math.min(110, 16 + Math.sqrt(p / 1000) * 14);
  // oqimlar
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.8;
  for (let k = 0; k < 9; k++) { const a = -Math.PI * 0.8 + (k / 8) * Math.PI * 1.6, hx = bx + Math.cos(a) * R, hy = cy + Math.sin(a) * R; if (p > 100) { ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * L, hy + Math.sin(a) * L); ctx.stroke(); } }
  ctx.globalAlpha = 1;
  // shar va silindr
  ctx.fillStyle = water; ctx.beginPath(); ctx.arc(bx, cy, R, 0, TAU); ctx.fill(); ctx.fillRect(cx0 + 40 + push, cy - 16, bx - R - cx0 - 40 - push + 4, 32);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bx, cy, R, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx0 + 30, cy - 18); ctx.lineTo(bx - R + 2, cy - 18); ctx.moveTo(cx0 + 30, cy + 18); ctx.lineTo(bx - R + 2, cy + 18); ctx.stroke();
  for (let k = 0; k < 9; k++) { const a = -Math.PI * 0.8 + (k / 8) * Math.PI * 1.6; ctx.fillStyle = c.bg; ctx.beginPath(); ctx.arc(bx + Math.cos(a) * R, cy + Math.sin(a) * R, 3, 0, TAU); ctx.fill(); }
  ctx.fillStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.fillRect(cx0 + 30 + push, cy - 16, 10, 32);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx0 + 30 + push, cy); ctx.lineTo(cx0 - 6 + push, cy); ctx.stroke();
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx0 - 12 + push, cy, 9, 0, TAU); ctx.fill(); ctx.stroke();
  geo.ballKnob = { x: cx0 - 12 + push, y: cy, r: 16, x0: cx0 - 12 };
  arrow(ctx, cx0 - 40 + push, cy - 30, 30, 0, c.danger, { width: 2.5, head: 8, label: `F = ${fmt(pas.F, 0)} N` });
  tag(ctx, `p = F/S = ${fmt(p / 1000, 1)} kPa — barcha teshiklardan bir xil oqim`, 12, 18, { color: c.text, bg: c.bg2, font: MID });
}

/* ------------------------------------------------------------------ 3. Suyuqlik */

function drawFluidStage(ctx, c, w, h) {
  if (flu.view === "vessels") return drawVessels(ctx, c, w, h);
  const narrow = w < 560, L = P.LIQUIDS[flu.liq], tx = 20, tw = narrow ? w * 0.56 : w * 0.38, top = 26, bot = h - 18, k = (bot - top) / TANK_H;
  ctx.fillStyle = `rgba(${L.color[0]},${L.color[1]},${L.color[2]},${c.dark ? 0.3 : 0.4})`; ctx.fillRect(tx, top, tw, bot - top);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(tx, top - 14); ctx.lineTo(tx, bot); ctx.lineTo(tx + tw, bot); ctx.lineTo(tx + tw, top - 14); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.strokeStyle = c.text3; ctx.lineWidth = 1;
  for (let cm = 0; cm <= TANK_H * 100; cm += 10) { const y = top + cm / 100 * k; ctx.beginPath(); ctx.moveTo(tx + tw, y); ctx.lineTo(tx + tw + 6, y); ctx.stroke(); ctx.fillText(`${cm}`, tx + tw + 8, y); }
  ctx.fillText("h, cm", tx + tw + 4, top - 18);
  // datchik
  const px = tx + 20 + flu.x * (tw - 40), py = top + flu.h * k;
  ctx.strokeStyle = c.text3; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(tx, py); ctx.lineTo(px - 14, py); ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); ctx.translate(px, py); ctx.rotate(flu.rot);
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(-12, -9, 24, 18, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.warning; ctx.fillRect(-12, -9, 4, 18);
  ctx.restore();
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py - 9); ctx.lineTo(px, top - 10); ctx.lineTo(narrow ? tx + tw + 20 : tx + tw + 52, top - 10); ctx.stroke(); // manometrning chap tirsagiga
  geo.probe = { x: px, y: py, r: 18, tx, tw, top, k };
  // U-manometr
  const mx = tx + tw + 52, mw = 34, mtop = top + 10, mbot = bot - 10, mH = mbot - mtop, rhoM = 1000, dp = P.hydro(L.rho, flu.h), dh = (dp / (rhoM * P.G)) * 100, sc = Math.min(1, (mH * 0.42) / Math.max(dh, 1)), half = (dh / 2) * sc, mid = mtop + mH * 0.55;
  if (!narrow) {
    ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx, top - 10); ctx.lineTo(mx, mbot); ctx.arcTo(mx, mbot + mw / 2, mx + mw / 2, mbot + mw / 2, mw / 2); ctx.arcTo(mx + mw, mbot + mw / 2, mx + mw, mbot, mw / 2); ctx.lineTo(mx + mw, mtop); ctx.stroke();
    ctx.strokeStyle = c.primary; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(mx, mid + half); ctx.lineTo(mx, mbot); ctx.arcTo(mx, mbot + mw / 2, mx + mw / 2, mbot + mw / 2, mw / 2); ctx.arcTo(mx + mw, mbot + mw / 2, mx + mw, mbot, mw / 2); ctx.lineTo(mx + mw, mid - half); ctx.stroke();
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(mx - 6, mid + half); ctx.lineTo(mx + mw + 30, mid + half); ctx.moveTo(mx + mw - 4, mid - half); ctx.lineTo(mx + mw + 30, mid - half); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(`Δh = ${fmt(dh, 1)} cm${sc < 1 ? " (kichraytirilgan)" : ""}`, mx + mw + 8, mid);
    ctx.textBaseline = "top"; ctx.fillText("suvli U-manometr", mx - 6, mbot + mw / 2 + 4 > h - 12 ? h - 12 : mbot + mw / 2 + 4);
  }
  tag(ctx, `p = ${fluP() >= 1e5 ? fmt(fluP() / 1000, 1) + " kPa" : fmt(fluP(), 0) + " Pa"}`, clamp(px + 18, tx + 4, tx + tw - 90), py - 22, { color: c.text, bg: c.bg2, font: MID });
}
function vesselLevel(k, top, base) { return base - flu.level * k; }
function drawVessels(ctx, c, w, h) {
  const narrow = w < 600, water = c.dark ? "rgba(56,189,248,0.35)" : "rgba(56,189,248,0.4)", oilc = c.dark ? "rgba(250,204,21,0.45)" : "rgba(250,204,21,0.55)";
  // chap: uch xil idish
  const base = h - 30, k = (h - 70) / 0.32, Ly = vesselLevel(k, 0, base), x0 = 18, vw = narrow ? (w - 40) / 3 : w * 0.16;
  const shapes = [
    (x, y) => [[x, base], [x, base - 0.32 * k], [x + vw * 0.6, base - 0.32 * k], [x + vw * 0.6, base]],
    (x) => [[x + vw * 0.25, base], [x, base - 0.32 * k], [x + vw, base - 0.32 * k], [x + vw * 0.75, base]],
    (x) => [[x + vw * 0.4, base], [x + vw * 0.1, base - 0.32 * k], [x + vw * 0.25, base - 0.32 * k], [x + vw * 0.55, base]],
  ];
  const xs = [x0, x0 + vw + 10, x0 + 2 * vw + 20];
  ctx.fillStyle = water; ctx.fillRect(x0, base - 6, xs[2] + vw - x0, 14);
  shapes.forEach((sh, i) => {
    const pts = sh(xs[i]);
    ctx.save(); ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
    ctx.fillStyle = water; ctx.fillRect(xs[i] - 10, Ly, vw + 20, base - Ly); ctx.restore();
    ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.moveTo(...pts[2]); ctx.lineTo(...pts[3]); ctx.stroke();
  });
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, base + 8); ctx.lineTo(xs[2] + vw * 0.6, base + 8); ctx.stroke();
  ctx.strokeStyle = c.primary; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x0 - 6, Ly); ctx.lineTo(xs[2] + vw + 6, Ly); ctx.stroke(); ctx.setLineDash([]);
  geo.level = { x0, x1: xs[2] + vw, y: Ly, k, base };
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(`sath ${fmt(flu.level * 100, 0)} cm — hamma idishda bir xil`, x0, Ly - 4);
  if (narrow) return;
  // o'ng: U-nay
  const ux = w * 0.66, uw = 70, ut = 24, ub = h - 36, uk = (ub - ut) / UT_H, u = uNow(), wl = UT_W0 - u.x, wr = UT_W0 + u.x, oilTop = wl + flu.oil;
  const Yu = (y) => ub - y * uk, r = 9;
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ux - r, ut); ctx.lineTo(ux - r, ub); ctx.arcTo(ux - r, ub + uw / 2 + r, ux + uw / 2, ub + uw / 2 + r, uw / 2 + r); ctx.arcTo(ux + uw + r, ub + uw / 2 + r, ux + uw + r, ub, uw / 2 + r); ctx.lineTo(ux + uw + r, ut);
  ctx.moveTo(ux + r, ut); ctx.lineTo(ux + r, ub); ctx.arcTo(ux + r, ub + uw / 2 - r, ux + uw / 2, ub + uw / 2 - r, uw / 2 - r); ctx.arcTo(ux + uw - r, ub + uw / 2 - r, ux + uw - r, ub, uw / 2 - r); ctx.lineTo(ux + uw - r, ut); ctx.stroke();
  ctx.fillStyle = water; ctx.fillRect(ux - r + 1, Yu(wl), 2 * r - 2, ub - Yu(wl)); ctx.fillRect(ux + uw - r + 1, Yu(wr), 2 * r - 2, ub - Yu(wr));
  ctx.beginPath(); ctx.arc(ux + uw / 2, ub, uw / 2, 0, Math.PI); ctx.lineWidth = 2 * r - 2; ctx.strokeStyle = water; ctx.stroke();
  if (flu.oil > 0) { ctx.fillStyle = oilc; ctx.fillRect(ux - r + 1, Yu(oilTop), 2 * r - 2, Yu(wl) - Yu(oilTop)); }
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.warning; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ux - r - 16, Yu(oilTop), 8, 0, TAU); ctx.fill(); ctx.stroke();
  geo.oil = { x: ux - r - 16, y: Yu(oilTop), r: 16, Yu, uk, wl };
  ctx.strokeStyle = c.text3; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ux - 20, Yu(wl)); ctx.lineTo(ux + uw + 30, Yu(wl)); ctx.moveTo(ux + uw - r, Yu(wr)); ctx.lineTo(ux + uw + 30, Yu(wr)); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(`h(suv) = ${fmt(u.dWater * 100, 1)} cm`, ux + uw + 22, (Yu(wl) + Yu(wr)) / 2);
  if (flu.oil > 0) { ctx.fillStyle = c.warning; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(`moy ${fmt(flu.oil * 100, 1)} cm`, ux - r - 4, Yu(oilTop) - 12); }
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("U-nay: suv va moy", ux + uw / 2, 6);
}

/* ------------------------------------------------------------------ Asosiy chizish va grafik */

function draw(ctx, st) {
  const c = st.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "solid") drawSolidStage(ctx, c, st.w, st.h);
  else if (ui.mode === "pascal") drawPascalStage(ctx, c, st.w, st.h);
  else drawFluidStage(ctx, c, st.w, st.h);
}
const heights = () => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(vh * 0.42, 300, 350)), graph: Math.round(clamp(vh * 0.28, 210, 260)) };
};
const stage = createStage($("#stage"), draw, { height: () => heights().stage });

function compareRows() {
  const cur = solidNow(), pc = P.pressure(cur.F, cur.S), rows = [];
  for (const [k, f] of Object.entries(P.FACES)) rows.push({ label: `G‘isht: ${f.name.toLowerCase()}`, p: P.pressure(P.weightN(P.BRICK.m), f.S), cur: solid.obj === "brick" && solid.face === k && !solid.extra });
  if (solid.obj === "brick" && solid.extra) rows.push({ label: `G‘isht + ${solid.extra} kg`, p: pc, cur: true });
  for (const [k, o] of Object.entries(P.OBJECTS)) rows.push({ label: o.name.replace(/ \(.*\)/, ""), p: P.pressure(o.F ?? P.weightN(o.m), o.S), cur: solid.obj === k });
  return rows.sort((a, b) => a.p - b.p);
}
function drawGraphCanvas(ctx, gst) {
  const c = gst.colors;
  if (ui.mode === "solid") return drawCompare(ctx, gst, { rows: compareRows(), hover: ui.hover });
  if (ui.mode === "pascal") return drawPress(ctx, gst, { S1: pas.S1, S2: pas.S2, F1: pressF1(), F1max: Math.max(pressF1() * 1.6, 50), hover: ui.hover });
  if (flu.view === "depth") return drawDepth(ctx, gst, { liq: flu.liq, h: flu.h, hMax: TANK_H, atm: flu.atm, hover: ui.hover });
  const u = uNow(), wl = UT_W0 - u.x, wr = UT_W0 + u.x;
  return drawProfiles(ctx, gst, { yMax: UT_H, hover: ui.hover, arms: [{ label: "chap tirsak (moy + suv)", color: c.warning, layers: [{ top: wl + flu.oil, bottom: wl, rho: P.LIQUIDS.oil.rho }, { top: wl, bottom: 0, rho: 1000 }] }, { label: "o‘ng tirsak (suv)", color: c.primary, dash: [6, 4], layers: [{ top: wr, bottom: 0, rho: 1000 }] }] });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });

function tabInfo() {
  if (ui.mode === "solid") return ["Bosimlarni taqqoslash", "Logarifmik shkala: igna uchi bosimi 10⁸ Pa, chang‘ida esa atigi 10³ Pa atrofida. Bosim kuch va tayanch yuzasiga bog‘liq: p = F/S."];
  if (ui.mode === "pascal") return pas.view === "ball" ? null : ["Kuchda yutuq: F₂(F₁)", `Gidravlik press kuchni S₂/S₁ = ${fmt(pas.S2 / pas.S1, 0)} marta oshiradi. Shtrix — pressiz (F₂ = F₁). Lekin katta porshen shuncha marta kam yo‘l bosadi.`];
  return flu.view === "depth" ? ["Suyuqlik bosimi chuqurlikka bog‘liq: p(h)", "Bosim chuqurlikka chiziqli bog‘liq va suyuqlik zichligiga proporsional (shtrix — boshqa suyuqliklar). Idish shakliga bog‘liq emas."] : ["U-naydagi bosim balandlik bo‘yicha", "Ikkala tirsakda tubdagi bosim bir xil — shuning uchun moy ustuni suvdan baland turadi: ρ_moy·h_moy = ρ_suv·h_suv."];
}
function setTab() {
  const t = tabInfo(), card = $(".sim-graph");
  card.hidden = !t; if (!t) return;
  $("[data-tabs]").innerHTML = "";
  $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1];
  graph.canvas.setAttribute("aria-label", t[0]); ui.hover = null; graph.render();
}

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, unit) => `${v}<small>${unit}</small>`;
const paU = (p) => (p >= 1e6 ? u(sci(p, 3), "Pa") : p >= 1e4 ? u(fmt(p / 1000, 2), "kPa") : u(fmt(p, 0), "Pa"));

function updateReadouts() {
  if (ui.mode === "solid") {
    const s = solidNow(), p = P.pressure(s.F, s.S);
    setRO("r1", "Bosim kuchi <i>F</i>", s.F >= 1e4 ? u(fmt(s.F / 1000, 1), "kN") : u(fmt(s.F, 1), "N"), s.m !== null ? `og‘irlik: mg = ${fmt(s.m, 1)} kg · 9,81 N/kg` : "barmoq kuchi");
    setRO("r2", "Tayanch yuzasi <i>S</i>", s.S >= 1e-4 ? u(fmt(s.S * 1e4, 0), "cm²") : u(fmt(s.S * 1e6, 2), "mm²"), s.S >= 1e-4 ? `= ${fmt(s.S, 4)} m²` : `= ${sci(s.S, 2)} m²`);
    setRO("r3", "Bosim <i>p = F/S</i>", paU(p), p >= 1e4 && p < 1e6 ? `= ${fmt(p, 0)} Pa` : "1 Pa = 1 N/m²", "orange");
    if (solid.obj === "brick") {
      const pf = P.pressure(s.F, P.FACES.flat.S), pe = P.pressure(s.F, P.FACES.end.S);
      setRO("r4", "Yassi qo‘yilganda", paU(pf), "eng katta yuza — eng kichik bosim");
      setRO("r5", "Tik qo‘yilganda", paU(pe), `yassidan ${fmt(pe / pf, 2)} marta katta`);
    } else {
      const o = P.OBJECTS[solid.obj];
      setRO("r4", "Tayanch", o.note, "");
      const ratio = p / P.pressure(P.weightN(P.BRICK.m), P.FACES.flat.S);
      setRO("r5", "G‘isht bilan solishtiring", `${ratio >= 1000 ? sci(ratio, 2) : fmt(ratio, ratio >= 100 ? 0 : 1)} ×`, "yassi g‘isht bosimidan");
    }
    setRO("r6", "Iz", solid.obj === "needle" ? "teshadi" : p > 2e4 ? "chuqur botadi" : p > 5000 ? "botadi" : p > 2000 ? "biroz botadi" : "deyarli botmaydi", "bosim qancha katta bo‘lsa — iz shuncha chuqur");
    return;
  }
  if (ui.mode === "pascal") {
    if (pas.view === "ball") {
      const p = ballP();
      setRO("r1", "Porshenga kuch <i>F</i>", u(fmt(pas.F, 0), "N"), "sahnada porshenni suring");
      setRO("r2", "Porshen yuzasi <i>S</i>", u(fmt(BALL_S * 1e4, 0), "cm²"), "");
      setRO("r3", "Suvdagi bosim <i>p = F/S</i>", paU(p), "atmosfera bosimidan ortiq", "orange");
      setRO("r4", "Oqim tezligi", u(fmt(P.jetSpeed(p), 1), "m/s"), "v = √(2p/ρ) — barcha teshiklarda bir xil");
      setRO("r5", "Teshiklar", "9 ta", "har xil yo‘nalishda");
      setRO("r6", "Xulosa", "p hamma tomonga bir xil", "Paskal qonuni");
      return;
    }
    const F1 = pressF1(), F2 = P.weightN(pas.M);
    setRO("r1", "Kichik porshenga <i>F₁</i>", u(fmt(F1, 1), "N"), `S₁ = ${fmt(pas.S1, 0)} cm²`, "orange");
    setRO("r2", "Katta porshen <i>F₂ = Mg</i>", F2 >= 1e4 ? u(fmt(F2 / 1000, 2), "kN") : u(fmt(F2, 0), "N"), `S₂ = ${fmt(pas.S2, 0)} cm², M = ${fmt(pas.M, 0)} kg`);
    setRO("r3", "Kuchda yutuq", `${fmt(pas.S2 / pas.S1, 0)} ×`, "F₂/F₁ = S₂/S₁");
    setRO("r4", "Suyuqlik bosimi <i>p</i>", paU(F1 / (pas.S1 * 1e-4)), "p = F₁/S₁ = F₂/S₂");
    setRO("r5", "Yo‘llar <i>s₁ / s₂</i>", u(`${fmt(pas.s1, 1)} / ${fmt(s2(), 2)}`, "cm"), "s₂ = s₁·S₁/S₂");
    setRO("r6", "Ish <i>A₁ = A₂</i>", u(fmt((F1 * pas.s1) / 100, 2), "J"), "ishda yutuq yo‘q");
    return;
  }
  if (flu.view === "depth") {
    const L = P.LIQUIDS[flu.liq], ph = P.hydro(L.rho, flu.h);
    setRO("r1", "Chuqurlik <i>h</i>", u(fmt(flu.h * 100, 0), "cm"), "suyuqlik sirtidan");
    setRO("r2", "Suyuqlik zichligi <i>ρ</i>", u(fmt(L.rho, 0), "kg/m³"), L.name);
    setRO("r3", "Gidrostatik bosim <i>ρgh</i>", paU(ph), `= ${fmt(L.rho, 0)} · 9,81 · ${fmt(flu.h, 2)}`, "orange");
    setRO("r4", "To‘liq bosim", paU(ph + P.P0), "p₀ + ρgh (atmosfera bilan)");
    setRO("r5", "1 cm² membranaga kuch", u(fmt((flu.atm ? ph + P.P0 : ph) * 1e-4, 2), "N"), "F = pS");
    setRO("r6", "Manometr <i>Δh</i>", u(fmt((ph / (1000 * P.G)) * 100, 1), "cm suv"), "membrana qayoqqa qaramasin — bir xil");
    return;
  }
  const uu = uNow();
  setRO("r1", "Idishlardagi sath", u(fmt(flu.level * 100, 0), "cm"), "shaklidan qat’i nazar bir xil");
  setRO("r2", "Tubdagi bosim", paU(P.hydro(1000, flu.level)), "barcha idishlarda bir xil");
  setRO("r3", "Moy ustuni <i>h₁</i>", u(fmt(flu.oil * 100, 1), "cm"), `ρ₁ = ${fmt(P.LIQUIDS.oil.rho, 0)} kg/m³`);
  setRO("r4", "Suv ustuni <i>h₂</i>", u(fmt(uu.dWater * 100, 2), "cm"), "suv sathlari farqi", "orange");
  setRO("r5", "<i>ρ₁h₁ = ρ₂h₂</i>", `${fmt(P.LIQUIDS.oil.rho * flu.oil, 1)} = ${fmt(1000 * uu.dWater, 1)}`, "kg/m²");
  setRO("r6", "Sathlar farqi", u(fmt(uu.dTop * 100, 2), "cm"), "moy yuzasi suvdan baland — yengilroq");
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "solid") { const p = solidP(); t = `p = ${p >= 1e6 ? sci(p, 2) : fmt(p, 0)} Pa`; tone = p > 2e4 ? "orange" : "green"; }
  else if (ui.mode === "pascal") { t = pas.view === "ball" ? "Bosim hamma tomonga bir xil" : `Kuchda ${fmt(pas.S2 / pas.S1, 0)} marta yutuq`; tone = "green"; }
  else { t = flu.view === "depth" ? `p = ρgh = ${fmt(P.hydro(P.LIQUIDS[flu.liq].rho, flu.h) / 1000, 2)} kPa` : "Tutash idishlar"; tone = "purple"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "solid") {
    p.push("<p><b>Bosim</b> — sirtga perpendikulyar ta’sir qiluvchi kuchning shu sirt yuzasiga nisbati: p = F/S. Bir xil kuch kichik yuzaga ta’sir qilsa bosim katta bo‘ladi — shuning uchun g‘isht tik qo‘yilganda qumga chuqurroq botadi.</p>");
    p.push(solid.obj === "skis" || solid.obj === "boots" ? "<p>Chang‘i tayanch yuzasini ≈ 5 marta oshiradi — bosim shuncha kamayadi va odam qorga botmaydi. Etikda esa chuqur botadi.</p>" : solid.obj === "needle" ? "<p>Igna uchi yuzasi juda kichik, shuning uchun barmoq kuchi bilan ham 10⁸ Pa (1000 atmosfera!) bosim hosil bo‘ladi. Pichoq, qaychi, mix — o‘tkir qilinadi.</p>" : solid.obj === "tractor" ? "<p>Traktor juda og‘ir, lekin keng zanjirlari tufayli yerga bosimi odamnikidan atigi 2–3 marta katta — yumshoq yerda botib qolmaydi. Poydevor, rels ostidagi shpallar ham shu maqsadda keng qilinadi.</p>" : "<p>Bosimni oshirish uchun yuzani kamaytiramiz (o‘tkir asboblar), kamaytirish uchun — oshiramiz (keng poydevor, chang‘i, zanjir).</p>");
  } else if (ui.mode === "pascal") {
    p.push("<p><b>Paskal qonuni</b>: suyuqlik yoki gazga berilgan tashqi bosim uning har bir nuqtasiga har tomonga o‘zgarishsiz uzatiladi. Sababi — molekulalar erkin harakatlanib, bosimni barcha yo‘nalishlarda tarqatadi.</p>");
    p.push(pas.view === "ball" ? "<p>Porshen surilganda suv shardagi barcha teshiklardan bir xil kuch bilan otilib chiqadi — bosim faqat porshen yo‘nalishida emas, hamma tomonga uzatildi.</p>" : `<p><b>Gidravlik press</b>: ikkala porshen ostida bosim bir xil (p = F₁/S₁ = F₂/S₂), shuning uchun katta porshenga S₂/S₁ = ${fmt(pas.S2 / pas.S1, 0)} marta katta kuch ta’sir qiladi. Ammo kichik porshen 1 cm tushganda katta porshen atigi ${fmt(pas.S1 / pas.S2, 3)} cm ko‘tariladi — ishda yutuq yo‘q. Avtomobil tormozi, domkrat, ekskavator shu prinsipda ishlaydi.</p>`);
  } else if (flu.view === "depth") {
    p.push("<p>Suyuqlik o‘z og‘irligi tufayli idish tubiga, devorlariga va ichidagi jismlarga bosim beradi. h chuqurlikdagi bosim — shu nuqta ustidagi suyuqlik ustunining og‘irligidan: <b>p = ρgh</b>. Bir xil chuqurlikda bosim hamma yo‘nalishda bir xil (Paskal qonuni) — membranani burib tekshiring.</p>");
    p.push("<p>Suvda har 10 m chuqurlikda bosim ≈ 1 atmosferaga ortadi. Shuning uchun g‘avvoslar uchun maxsus skafandr, suv osti kemalari uchun qalin korpus kerak; to‘g‘on pastki qismi qalinroq quriladi.</p>");
  } else {
    p.push("<p><b>Tutash idishlar</b>da bir jinsli suyuqlik sathi idishlar shakli va kesimidan qat’i nazar bir xil balandlikda turadi: tubdagi bosim ρgh hamma joyda teng bo‘lishi kerak. Choynak jo‘mragi, suv minorasi va vodoprovod, shlyuzlar shunga asoslangan.</p>");
    p.push("<p>Agar tirsaklarda har xil suyuqlik bo‘lsa, ularning chegarasidan hisoblangan ustunlar balandligi zichliklarga teskari proporsional: <b>ρ₁h₁ = ρ₂h₂</b>. Moy yengil — shuning uchun moy ustuni suv ustunidan baland.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "solid" ? "<small>Bosim</small> p = F/S" : ui.mode === "pascal" ? (pas.view === "ball" ? "<small>Paskal qonuni</small> p = F/S hamma tomonga" : "<small>Gidravlik press</small> F₂/F₁ = S₂/S₁") : flu.view === "depth" ? "<small>Suyuqlik bosimi</small> p = ρgh" : "<small>Tutash idishlar</small> ρ₁h₁ = ρ₂h₂";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); if (!$(".sim-graph").hidden) graph.render(); }

/* ------------------------------------------------------------------ Asboblar paneli (sahna statik: holat surish bilan o'zgaradi, animatsiya yo'q) */

$("[data-play]").hidden = true;
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "solid") { solid.extra = 0; sLoadC.set(0); }
  else if (ui.mode === "pascal") { pas.s1 = 0; pas.F = 0; pFC.set(0); }
  else { flu.h = 0.3; flu.x = 0.5; flu.rot = 0; fHC.set(30); flu.oil = 0; fOilC.set(0); }
  customized(); refresh();
});

/* ------------------------------------------------------------------ Boshqaruv */

const sObj = $("#sObj");
sObj.innerHTML = Object.entries(OBJ_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
sObj.addEventListener("change", () => { solid.obj = sObj.value; customized(); syncSolid(); setTab(); refresh(); });
document.querySelectorAll("[data-face-value]").forEach((b) => b.addEventListener("click", () => { solid.face = b.dataset.faceValue; customized(); syncSolid(); refresh(); }));
const sLoadC = bindRange($("#sLoad"), $("#sLoadOut"), (v) => `${fmt(v, 0)} kg`, (v) => { solid.extra = v; customized(); refresh(); });
function syncSolid() {
  sObj.value = solid.obj; sLoadC.set(solid.extra);
  document.querySelectorAll("[data-face-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.faceValue === solid.face)));
  document.querySelectorAll("[data-sv]").forEach((el) => { el.hidden = solid.obj !== "brick"; });
}
document.querySelectorAll("[data-pview-value]").forEach((b) => b.addEventListener("click", () => { pas.view = b.dataset.pviewValue; customized(); syncPascal(); setTab(); refresh(); }));
const pS1C = bindRange($("#pS1"), $("#pS1Out"), (v) => `${fmt(v, 0)} cm²`, (v) => { pas.S1 = v; customized(); setTab(); refresh(); });
const pS2C = bindRange($("#pS2"), $("#pS2Out"), (v) => `${fmt(v, 0)} cm²`, (v) => { pas.S2 = v; customized(); setTab(); refresh(); });
const pMC = bindRange($("#pM"), $("#pMOut"), (v) => `${fmt(v, 0)} kg`, (v) => { pas.M = v; customized(); refresh(); });
const pFC = bindRange($("#pF"), $("#pFOut"), (v) => `${fmt(v, 0)} N`, (v) => { pas.F = v; customized(); refresh(); });
function syncPascal() {
  document.querySelectorAll("[data-pview-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pviewValue === pas.view)));
  document.querySelectorAll("[data-pv]").forEach((el) => { el.hidden = el.dataset.pv !== pas.view; });
  pS1C.set(pas.S1); pS2C.set(pas.S2); pMC.set(pas.M); pFC.set(pas.F);
}
document.querySelectorAll("[data-fview-value]").forEach((b) => b.addEventListener("click", () => { flu.view = b.dataset.fviewValue; customized(); syncFluid(); setTab(); refresh(); }));
const fLiq = $("#fLiq");
fLiq.innerHTML = Object.entries(P.LIQUIDS).map(([k, v]) => `<option value="${k}">${v.name} (${fmt(v.rho, 0)} kg/m³)</option>`).join("");
fLiq.addEventListener("change", () => { flu.liq = fLiq.value; customized(); refresh(); });
const fHC = bindRange($("#fH"), $("#fHOut"), (v) => `${fmt(v, 0)} cm`, (v) => { flu.h = v / 100; customized(); refresh(); });
$("[data-atm]").addEventListener("change", (e) => { flu.atm = e.target.checked; customized(); refresh(); });
$("[data-rotate]").addEventListener("click", () => { flu.rot = (flu.rot + Math.PI / 2) % TAU; refresh(); });
const fLevelC = bindRange($("#fLevel"), $("#fLevelOut"), (v) => `${fmt(v, 0)} cm`, (v) => { flu.level = v / 100; customized(); refresh(); });
const fOilC = bindRange($("#fOil"), $("#fOilOut"), (v) => `${fmt(v, 1)} cm`, (v) => { flu.oil = v / 100; customized(); refresh(); });
function syncFluid() {
  document.querySelectorAll("[data-fview-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.fviewValue === flu.view)));
  document.querySelectorAll("[data-fv]").forEach((el) => { el.hidden = el.dataset.fv !== flu.view; });
  fLiq.value = flu.liq; fHC.set(Math.round(flu.h * 100)); $("[data-atm]").checked = flu.atm; fLevelC.set(Math.round(flu.level * 100)); fOilC.set(flu.oil * 100);
}

/* Sahnada surish */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const near = (p, g) => g && Math.hypot(p.x - g.x, p.y - g.y) <= g.r;
function hit(p) {
  if (ui.mode === "solid") { if (near(p, geo.load)) return { kind: "load", y0: p.y, e0: solid.extra }; const b = geo.brick; if (b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return { kind: "brick" }; }
  else if (ui.mode === "pascal") { if (pas.view === "press" && near(p, geo.knob)) return { kind: "knob", y0: p.y, s0: pas.s1 }; if (pas.view === "ball" && near(p, geo.ballKnob)) return { kind: "ball", x0: p.x, F0: pas.F }; }
  else if (flu.view === "depth") { if (near(p, geo.probe)) return { kind: "probe" }; }
  else { if (near(p, geo.oil)) return { kind: "oil" }; const L = geo.level; if (L && p.x >= L.x0 && p.x <= L.x1 && Math.abs(p.y - L.y) <= 12) return { kind: "level" }; }
  return null;
}
function dragTo(p) {
  if (drag.kind === "load") { solid.extra = clamp(Math.round(drag.e0 + (drag.y0 - p.y) / 9), 0, 12); sLoadC.set(solid.extra); }
  else if (drag.kind === "knob") { pas.s1 = clamp(Math.round((drag.s0 + (p.y - drag.y0) / geo.knob.k) * 2) / 2, 0, PRESS_S1MAX); }
  else if (drag.kind === "ball") { pas.F = clamp(Math.round(drag.F0 + ((p.x - drag.x0) / 30) * 100), 0, 100); pFC.set(pas.F); }
  else if (drag.kind === "probe") { const g = geo.probe; flu.h = clamp(Math.round(((p.y - g.top) / g.k) * 100) / 100, 0, TANK_H); flu.x = clamp((p.x - g.tx - 20) / (g.tw - 40), 0, 1); fHC.set(Math.round(flu.h * 100)); }
  else if (drag.kind === "level") { const L = geo.level; flu.level = clamp(Math.round(((L.base - p.y) / L.k) * 100) / 100, 0.05, 0.3); fLevelC.set(Math.round(flu.level * 100)); }
  else if (drag.kind === "oil") { const g = geo.oil, top = (g.Yu(0) - p.y) / g.uk; // moy yuzasi balandligi
    // h(moy) dan moy yuzasi: wl + h = W0 − ρ₂h/(2ρ₁) + h → h = (top − W0)/(1 − ρ₂/(2ρ₁))
    flu.oil = clamp(Math.round(((top - UT_W0) / (1 - P.LIQUIDS.oil.rho / 2000)) * 200) / 200, 0, 0.2); fOilC.set(flu.oil * 100); }
  refresh();
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return;
  customized(); e.preventDefault();
  if (h.kind === "brick") { const order = ["flat", "edge", "end"]; solid.face = order[(order.indexOf(solid.face) + 1) % 3]; syncSolid(); refresh(); return; }
  drag = h; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  canvas.dataset.dragging = "true"; if (h.kind !== "knob" && h.kind !== "load" && h.kind !== "ball") dragTo(p);
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (drag) { dragTo(p); return; }
  const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "brick" ? "pointer" : h.kind === "ball" ? "ew-resize" : h.kind === "probe" ? "grab" : "ns-resize";
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* Grafikda kursor */
const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => {
  const f = lastFrame(); if (!f) return;
  const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y - 10 && p.y <= r.y + r.h + 10;
  ui.hover = inside ? (ui.mode === "solid" ? (p.x - r.x) / r.w : ((p.x - r.x) / r.w) * f.xMax) : null;
  gcv.style.cursor = inside ? "crosshair" : ""; graph.render();
});
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  brickFlat: { mode: "solid", title: "G‘isht: yassi yotqizilgan", lesson: "G‘isht og‘irligi 34,3 N, eng katta yuzasi 300 cm²: p ≈ 1,1 kPa. G‘ishtni bosing — u boshqa qirrasi bilan qo‘yiladi va qumdagi iz chuqurlashadi.", set: () => Object.assign(solid, { obj: "brick", face: "flat", extra: 0 }) },
  brickEnd: { mode: "solid", title: "G‘isht: tik qo‘yilgan", lesson: "Og‘irlik o‘zgarmadi, lekin tayanch yuzasi 78 cm² ga kamaydi — bosim ≈ 3,9 marta ortdi va g‘isht chuqurroq botdi.", set: () => Object.assign(solid, { obj: "brick", face: "end", extra: 0 }) },
  brickLoad: { mode: "solid", title: "Yukni oshirish", lesson: "Yuz o‘zgarmas, yukni oshiramiz: bosim kuchga to‘g‘ri proporsional. G‘isht ustidagi tutqichni yuqoriga suring.", set: () => Object.assign(solid, { obj: "brick", face: "flat", extra: 6 }) },
  boots: { mode: "solid", title: "Odam etikda qorda", lesson: "60 kg odam etikda: p ≈ 9,8 kPa — yumshoq qorga chuqur botadi. Chang‘i bilan solishtiring.", set: () => Object.assign(solid, { obj: "boots" }) },
  skis: { mode: "solid", title: "Odam chang‘ida", lesson: "Xuddi shu odam chang‘ida: tayanch yuzasi 3240 cm² — bosim 1,8 kPa, qorga deyarli botmaydi.", set: () => Object.assign(solid, { obj: "skis" }) },
  needle: { mode: "solid", title: "Igna uchi", lesson: "1 N kuch 0,01 mm² yuzaga — 10⁸ Pa. Kichik kuch bilan katta bosim olish mumkin.", set: () => Object.assign(solid, { obj: "needle" }) },
  tractor: { mode: "solid", title: "Zanjirli traktor", lesson: "6 tonnali traktor zanjirlari bilan yerga ≈ 25 kPa bosim beradi — odamnikidan atigi 2,5 marta ko‘p.", set: () => Object.assign(solid, { obj: "tractor" }) },
  press: { mode: "pascal", title: "Gidravlik press", lesson: "S₂/S₁ = 50: 200 kg yukni ko‘tarish uchun kichik porshenga atigi 39 N kerak. Kichik porshen dastasini pastga suring va katta porshen qanchalik kam ko‘tarilishini kuzating.", set: () => Object.assign(pas, { view: "press", S1: 2, S2: 100, M: 200, s1: 6 }) },
  car: { mode: "pascal", title: "Avtomobilni ko‘tarish", lesson: "Gidravlik ko‘targich: S₂/S₁ = 100. 1,2 tonnali avtomobilni 118 N (≈ 12 kg yuk og‘irligi) kuch bilan ko‘tarish mumkin.", set: () => Object.assign(pas, { view: "press", S1: 4, S2: 400, M: 1200, s1: 10 }) },
  ball: { mode: "pascal", title: "Paskal shari", lesson: "Porshenni chapdan o‘ngga suring: suv shardagi barcha teshiklardan bir xil otilib chiqadi — bosim hamma tomonga uzatiladi.", set: () => Object.assign(pas, { view: "ball", F: 50 }) },
  depth: { mode: "fluid", title: "Chuqurlikdagi bosim", lesson: "Datchikni chuqurroq tushiring — manometrdagi suv sathlari farqi va bosim ortadi: p = ρgh. Membranani burang — bosim o‘zgarmaydi.", set: () => Object.assign(flu, { view: "depth", liq: "water", h: 0.3, x: 0.5, atm: false, rot: 0 }) },
  mercuryP: { mode: "fluid", title: "Simobda bosim", lesson: "Simob suvdan 13,6 marta zich — bir xil chuqurlikda bosim ham 13,6 marta katta. 76 cm simob ustuni atmosfera bosimiga teng.", set: () => Object.assign(flu, { view: "depth", liq: "mercury", h: 0.5, x: 0.5, atm: false, rot: 0 }) },
  atm: { mode: "fluid", title: "Atmosfera bosimi bilan", lesson: "Suyuqlik sirtiga havo ham bosim beradi: p₀ ≈ 101 kPa. To‘liq bosim p = p₀ + ρgh. 80 cm suv atmosfera bosimiga atigi 8 % qo‘shadi.", set: () => Object.assign(flu, { view: "depth", liq: "water", h: 0.8, x: 0.5, atm: true, rot: 0 }) },
  vessels: { mode: "fluid", title: "Tutash idishlar", lesson: "Uch xil shakldagi idish pastdan tutashtirilgan: suv sathi hammasida bir xil. Istalgan idishdagi sathni suring.", set: () => Object.assign(flu, { view: "vessels", level: 0.18, oil: 0 }) },
  oil: { mode: "fluid", title: "U-nayda suv va moy", lesson: "Chap tirsakka 15 cm moy quyildi: moy ustuni suv ustunidan baland, chunki moy yengil. ρ_moy·h_moy = ρ_suv·h_suv — moy zichligini shunday o‘lchash mumkin.", set: () => Object.assign(flu, { view: "vessels", level: 0.18, oil: 0.15 }) },
};
const GROUPS = [["Qattiq jism bosimi", ["brickFlat", "brickEnd", "brickLoad", "boots", "skis", "needle", "tractor"]], ["Paskal qonuni", ["press", "car", "ball"]], ["Suyuqlik bosimi", ["depth", "mercuryP", "atm", "vessels", "oil"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { solid: "G‘ishtni bosing, yukni suring", pascal: "Porshen dastasini suring", fluid: "Datchikni yoki suyuqlik sathini suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { solid: "Qumdagi g‘isht, odam yoki igna — bosim izi", pascal: "Gidravlik press yoki Paskal shari", fluid: "Suyuqlikli idish, bosim datchigi va manometr yoki tutash idishlar" }[ui.mode]);
}
const MODE_DEFAULT = { solid: "brickFlat", pascal: "press", fluid: "depth" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null;
  ui.mode = p.mode; p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncSolid(); syncPascal(); syncFluid(); setTab(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "brickFlat");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
