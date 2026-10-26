// ==========================================================================
// Atmosfera bosimi — simulyatsiya (simulations/atmosphere.html)
// 1) Torichelli tajribasi: simob (1 m) yoki suv (12 m, Paskal) bilan to'ldirilgan nay idishga to'ntarilgan.
//    Ustun balandligi h = p/(ρg); nayning uchini surib qiyalatish — vertikal balandlik o'zgarmaydi; nay tepasini teshish;
//    joy balandligi (tog'da ustun pasayadi). Chizg'ich, «p₀» strelkalari, Torichelli bo'shlig'i.
// 2) Magdeburg yarim sharlari: nasos dastagi sahnada suriladi (har yurishda p ← p·V/(V + Vn)), vakuummetr, jo'mrak,
//    otlar (o'quvchilar) yoki daraxt; «Tortish» — kerakli kuch F = (p₀ − p)πR² bilan solishtiriladi. Grafik F(n).
// 3) Balandlik va barometr: havo shari sahnada suriladi; aneroid barometr, germetik paket, qaynash temperaturasi.
//    Grafik p(h) — standart atmosfera.
// Fizika: atmosphere-physics.js (Node'da tekshirilgan: t_atmosphere.mjs).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, arrow, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { chipBtn } from "./labkit.js";
import * as P from "./atmosphere-physics.js";
import { drawAlt, drawPump, lastFrame } from "./atmosphere-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "torr", hover: null };
const tr = { liq: "hg", tilt: 0, alt: 0, hole: false, col: null };
const mg = { size: "big", team: 8, tree: false, n: 0, p: P.P0, valve: false, handle: 1, armed: false, pull: 0, apart: false, sep: 0, result: "" };
const al = { h: 455 };
let presetId = null, playing = true;
const geo = {};

const TUBE = { hg: 1, water: 12 };
const SIZES = {
  big: { name: "Gerike yarim sharlari", R: 0.255, puller: 1800, who: "ot", Vp: 1 / 12, pMin: 0.08 },
  small: { name: "maktab yarim sharlari", R: 0.05, puller: 400, who: "o‘quvchi", Vp: 1 / 5, pMin: 0.06 },
};
const sz = () => SIZES[mg.size];
const V = () => P.sphereVolume(sz().R);
const needF = () => P.pullForce(mg.p, sz().R);
const pullF = () => mg.team * sz().puller;
const pAtm = () => P.isa(tr.alt).p;
const tubeNow = () => P.tube(pAtm(), P.LIQUIDS[tr.liq].rho, TUBE[tr.liq], tr.tilt * DEG);
const MARKS = [[455, "Toshkent"], [3309, "Katta Chimyon"], [7495, "Ismoil Somoniy"], [8849, "Everest"], [10500, "samolyot"]];
const mm = (p) => p / P.MMHG;
const kN = (F) => (F >= 5000 ? `${fmt(F / 1000, 1)} kN` : `${fmt(F, 0)} N`);

/* ------------------------------------------------------------------ Umumiy asboblar */

/** Dumaloq strelkali asbob: [lo, hi] shkala 270° yoyda, har step da raqam */
function gauge(ctx, c, cx, cy, R, val, lo, hi, step, label, labelStep = step) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 2, cx, cy, R + 6);
  g.addColorStop(0, "#fde68a"); g.addColorStop(1, "#a16207");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fffbeb"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, A = (v) => a0 + ((v - lo) / (hi - lo)) * (a1 - a0);
  ctx.strokeStyle = "#334155"; ctx.fillStyle = "#1e293b"; ctx.lineWidth = 1; ctx.font = `600 ${R > 40 ? 9 : 8}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const minor = step / 5;
  for (let v = lo; v <= hi + 1e-9; v += minor) { const a = A(v), maj = Math.abs(v / step - Math.round(v / step)) < 1e-6, r0 = R - (maj ? 9 : 5); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2)); ctx.stroke(); if (maj && R >= 34 && Math.abs(((v - lo) / labelStep) - Math.round((v - lo) / labelStep)) < 1e-6) ctx.fillText(`${Math.round(v)}`, cx + Math.cos(a) * (R - 17), cy + Math.sin(a) * (R - 17)); }
  ctx.font = "600 8px Inter, system-ui, sans-serif"; ctx.fillStyle = "#475569";
  if (R >= 34) ctx.fillText(label, cx, cy + R * 0.66);
  const an = A(clamp(val, lo, hi));
  ctx.strokeStyle = "#b91c1c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - Math.cos(an) * 8, cy - Math.sin(an) * 8); ctx.lineTo(cx + Math.cos(an) * (R - 6), cy + Math.sin(an) * (R - 6)); ctx.stroke();
  ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
}
const liqColor = (c) => (tr.liq === "hg" ? ["#cbd5e1", "#94a3b8", "#e2e8f0"] : c.dark ? ["#38bdf8", "#0284c7", "#7dd3fc"] : ["#7dd3fc", "#0284c7", "#bae6fd"]);

/* ------------------------------------------------------------------ 1. Torichelli */

function drawTorr(ctx, c, w, h) {
  const narrow = w < 560, water = tr.liq === "water", t = tubeNow(), Lt = TUBE[tr.liq], a = tr.tilt * DEG;
  const surf = h - 48, px = narrow ? w * 0.5 : w * 0.38, pxm = (surf - 28) / Lt;
  if (tr.col === null) tr.col = t.len;
  const ux = Math.sin(a), uy = -Math.cos(a), col = tr.col;
  // suvli barometr: bino (masshtab)
  if (water) {
    const bx = px + (narrow ? 34 : 60), bw = narrow ? 70 : 110;
    ctx.fillStyle = c.dark ? "rgba(148,163,184,0.12)" : "rgba(203,213,225,0.45)"; ctx.fillRect(bx, surf - 12 * pxm, bw, 12 * pxm + 20);
    ctx.strokeStyle = c.border; ctx.lineWidth = 1;
    for (let f = 1; f <= 4; f++) { const y = surf + 20 - f * 3 * pxm; ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y); ctx.stroke(); ctx.fillStyle = c.dark ? "rgba(125,211,252,0.25)" : "rgba(14,165,233,0.25)"; for (let k = 0; k < 3; k++) ctx.fillRect(bx + 10 + k * (bw - 20) / 3, y + 12, (bw - 40) / 3, 3 * pxm - 30); }
    ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("4 qavatli bino (12 m)", bx, surf - 12 * pxm - 2);
  }
  // chizg'ich (vertikal)
  const rx = px - (narrow ? 64 + 34 : 84 + 46);
  ctx.fillStyle = c.dark ? "#3f2d1d" : "#fef3c7"; ctx.fillRect(rx - 4, 22, 30, surf - 22);
  ctx.strokeStyle = c.dark ? "#d6d3d1" : "#78350f"; ctx.fillStyle = c.dark ? "#e7e5e4" : "#78350f"; ctx.lineWidth = 1; ctx.font = "600 9px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  if (water) { for (let m = 0; m <= 12; m += 0.5) { const y = Math.round(surf - m * pxm) + 0.5, maj = m % 2 === 0; ctx.beginPath(); ctx.moveTo(rx - 4, y); ctx.lineTo(rx + (maj ? 8 : 4), y); ctx.stroke(); if (maj) ctx.fillText(`${m} m`, rx + 10, y); } }
  else { for (let v = 0; v <= 1000; v += 10) { const y = Math.round(surf - (v / 1000) * pxm) + 0.5, maj = v % 100 === 0, mid = v % 50 === 0; ctx.beginPath(); ctx.moveTo(rx - 4, y); ctx.lineTo(rx + (maj ? 9 : mid ? 6 : 3), y); ctx.stroke(); if (maj) ctx.fillText(`${v}`, rx + 10, y); } ctx.fillText("mm", rx + 2, 16); }
  // idish
  const dw = narrow ? 64 : 84;
  const lc = liqColor(c);
  ctx.fillStyle = lc[0]; ctx.fillRect(px - dw, surf, 2 * dw, 26);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - dw - 4, surf - 16); ctx.lineTo(px - dw - 4, surf + 30); ctx.lineTo(px + dw + 4, surf + 30); ctx.lineTo(px + dw + 4, surf - 16); ctx.stroke();
  // atmosfera bosimi strelkalari
  for (const dx of [-dw + 16, dw - 16]) arrow(ctx, px + dx, surf - 30, 0, 24, c.primary, { width: 2, head: 7 });
  ctx.font = "italic 700 12px Inter, system-ui, sans-serif"; ctx.fillStyle = c.primary; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("p₀", px - dw + 30, surf - 22); ctx.fillText("p₀", px + dw - 30, surf - 22);
  // nay
  const bot = { x: px - ux * 16, y: surf - uy * 16 }, len = Lt * pxm, tip = { x: px + ux * len, y: surf + uy * len };
  const tw = narrow ? 12 : 14, nx = -uy * (tw / 2), ny = ux * (tw / 2);
  const quad = (d0, d1) => { const p0 = { x: px + ux * d0, y: surf + uy * d0 }, p1 = { x: px + ux * d1, y: surf + uy * d1 }; ctx.beginPath(); ctx.moveTo(p0.x + nx, p0.y + ny); ctx.lineTo(p1.x + nx, p1.y + ny); ctx.lineTo(p1.x - nx, p1.y - ny); ctx.lineTo(p0.x - nx, p0.y - ny); ctx.closePath(); };
  ctx.fillStyle = c.dark ? "rgba(226,232,240,0.06)" : "rgba(241,245,249,0.7)"; quad(-16, len); ctx.fill();
  // suyuqlik ustuni
  const cl = clamp(col * pxm, 0, len);
  const g = ctx.createLinearGradient(px + nx, surf + ny, px - nx, surf - ny); g.addColorStop(0, lc[1]); g.addColorStop(0.45, lc[2]); g.addColorStop(1, lc[1]);
  ctx.fillStyle = g; quad(-16, cl); ctx.fill();
  if (!tr.hole && !t.full && cl < len - 6) { ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "middle"; const m = (cl + len) / 2; tag(ctx, narrow ? "vakuum" : "Torichelli bo‘shlig‘i (vakuum)", px + ux * m + 14, surf + uy * m, { color: c.text2, bg: c.bg2, font: SMALL, pad: 4 }); }
  // shisha devor
  ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.7)" : "rgba(71,85,105,0.85)"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(bot.x + nx, bot.y + ny); ctx.lineTo(tip.x + nx, tip.y + ny); ctx.arc(tip.x, tip.y, tw / 2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true); ctx.lineTo(bot.x - nx, bot.y - ny); ctx.stroke();
  if (tr.hole) { ctx.fillStyle = c.bg; ctx.beginPath(); ctx.arc(tip.x, tip.y - 1, 3, 0, TAU); ctx.fill(); arrow(ctx, tip.x, tip.y - 22, 0, 14, c.primary, { width: 1.6, head: 5 }); }
  // tutqich
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(tip.x + ux * 12, tip.y + uy * 12, 7, 0, TAU); ctx.fill(); ctx.stroke();
  geo.tip = { x: tip.x + ux * 12, y: tip.y + uy * 12, px, surf };
  // ustun balandligi chizig'i
  const yh = surf - Math.min(col * Math.cos(a), t.hv) * pxm;
  if (col > 0.01) {
    ctx.strokeStyle = c.warning; ctx.lineWidth = 1.4; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(rx - 4, yh); ctx.lineTo(Math.max(px + ux * cl + 30, px + 60), yh); ctx.stroke(); ctx.setLineDash([]);
    const hv = col * Math.cos(a);
    tag(ctx, water ? `h = ${fmt(hv, 2)} m` : `h = ${fmt(hv * 1000, 0)} mm`, Math.max(px + ux * cl + 34, px + 64), yh, { color: c.warning, bg: c.bg2, font: BOLD });
  }
  // ma'lumot va tugma
  const ix = narrow ? w - 10 : w - 16;
  if (!narrow) { gauge(ctx, c, w - 78, h * 0.45, 52, mm(pAtm()), 400, 800, 50, "mm sim. ust.", 100); ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("aneroid barometr", w - 78, h * 0.45 + 62); }
  tag(ctx, narrow ? `p = ${fmt(mm(pAtm()), 0)} mm` : `p = ${fmt(mm(pAtm()), 0)} mm sim. ust. = ${fmt(pAtm() / 1000, 1)} kPa`, ix, narrow ? 44 : 18, { color: c.text, bg: c.bg2, font: narrow ? SMALL : MID, align: "right" });
  if (tr.alt > 0) tag(ctx, `balandlik ${fmt(tr.alt, 0)} m`, ix, narrow ? 70 : 44, { color: c.text2, bg: c.bg2, font: SMALL, align: "right" });
  geo.hole = chipBtn(ctx, c, ix - (narrow ? 70 : 84), h - 34, tr.hole ? "teshilgan" : "Teshish", !tr.hole, narrow ? 70 : 84, 26, c.danger);
}

/* ------------------------------------------------------------------ 2. Magdeburg yarim sharlari */

function horse(ctx, x, y, s, dir, phase, pulling) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.fillStyle = "#7c4a1e"; ctx.strokeStyle = "#4a2c10"; ctx.lineWidth = 1;
  const k = pulling ? Math.sin(phase) * 4 : 0;
  ctx.lineWidth = 3; ctx.strokeStyle = "#5b3514";
  for (const [lx, d] of [[-9, k], [-5, -k], [7, -k], [11, k]]) { ctx.beginPath(); ctx.moveTo(lx, 2); ctx.lineTo(lx + d + (pulling ? 3 : 0), 16); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(1, -2, 15, 8, pulling ? -0.12 : 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(20, -18); ctx.lineTo(26, -16); ctx.lineTo(18, -3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#3f2410"; ctx.fillRect(13, -18, 6, 3); ctx.beginPath(); ctx.moveTo(-14, -4); ctx.quadraticCurveTo(-22, 0, -20, 8); ctx.lineTo(-16, 0); ctx.fill();
  ctx.restore();
}
function person(ctx, c, x, y, dir, pulling) {
  ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 2; const lean = pulling ? 7 * dir : 0;
  ctx.beginPath(); ctx.arc(x + lean * 1.3, y - 30, 5, 0, TAU); ctx.moveTo(x + lean, y - 25); ctx.lineTo(x, y - 10); ctx.lineTo(x - 5 * dir, y); ctx.moveTo(x, y - 10); ctx.lineTo(x + 6 * dir, y); ctx.moveTo(x + lean * 0.8, y - 20); ctx.lineTo(x - 8 * dir, y - 18); ctx.stroke(); ctx.restore();
}
function hemisphere(ctx, c, cx, cy, R, dir) {
  const g = ctx.createRadialGradient(cx + dir * R * 0.2, cy - R * 0.45, 3, cx, cy, R * 1.1);
  g.addColorStop(0, "#fde68a"); g.addColorStop(0.45, "#d97706"); g.addColorStop(1, "#78350f");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI / 2, Math.PI * 1.5, dir > 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#92400e"; ctx.fillRect(dir > 0 ? cx : cx - 6, cy - R - 6, 6, 2 * R + 12);
  ctx.strokeStyle = "#78350f"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx + dir * (R + 10), cy, 8, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + dir * R, cy); ctx.lineTo(cx + dir * (R + 2), cy); ctx.stroke();
}
function drawMag(ctx, c, w, h) {
  const narrow = w < 560, s = sz(), big = mg.size === "big";
  const cx = w / 2, cy = h * 0.42, R = big ? (narrow ? 40 : 54) : (narrow ? 22 : 28), gap = mg.sep * (narrow ? 50 : 80);
  const ground = h - 22;
  ctx.fillStyle = c.dark ? "#14532d" : "#bbf7d0"; ctx.fillRect(0, ground, w, h - ground);
  // arqonlar va tortuvchilar
  const pulling = mg.pull > 0, ph = performance.now() / 90;
  const nDraw = Math.min(mg.team, narrow ? 3 : 6), pmx = narrow ? 34 : 70;
  const hookL = cx - gap / 2 - R - 10, hookR = cx + gap / 2 + R + 10;
  const sp = Math.min(big ? (narrow ? 34 : 44) : (narrow ? 20 : 26), (cx - gap / 2 - R - 10 - 30 - (pmx + 50)) / Math.max(1, nDraw));
  for (const dir of [-1, 1]) {
    const hook = dir < 0 ? hookL : hookR, x0 = hook + dir * 30, tree = dir > 0 && mg.tree;
    const endX = tree ? (narrow ? w - 30 : w - 50) : hook + dir * (30 + nDraw * sp);
    ctx.strokeStyle = pulling ? "#a16207" : "#ca8a04"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hook + dir * 8, cy);
    if (pulling) ctx.lineTo(endX, ground - (big ? 22 : 24)); else ctx.quadraticCurveTo((hook + endX) / 2, ground - 4, endX, ground - (big ? 22 : 24)); ctx.stroke();
    if (tree) {
      ctx.fillStyle = "#78350f"; ctx.fillRect(endX - 6, ground - 90, 14, 90);
      ctx.fillStyle = c.dark ? "#166534" : "#22c55e"; for (const [dx, dy, r] of [[0, -100, 30], [-22, -84, 22], [22, -84, 22]]) { ctx.beginPath(); ctx.arc(endX + dx, ground + dy, r, 0, TAU); ctx.fill(); }
      continue;
    }
    for (let i = 0; i < nDraw; i++) { const x = x0 + dir * i * sp + dir * (pulling ? 6 : 0); if (big) horse(ctx, x, ground - 16, narrow ? 0.8 : 1, dir, ph + i, pulling); else person(ctx, c, x, ground, dir, pulling); }
    if (mg.team > nDraw) tag(ctx, `× ${mg.team}`, x0 + dir * (nDraw * sp + 8), ground - 46, { color: c.text, bg: c.bg2, font: BOLD, align: dir > 0 ? "left" : "right" });
  }
  // havo bosimi strelkalari (Δp ga proporsional)
  const dp = (P.P0 - mg.p) / P.P0;
  if (dp > 0.02 && mg.sep < 0.05) {
    const L = 6 + 18 * dp;
    for (let k = 0; k < 12; k++) { const an = (k / 12) * TAU + 0.26, x = cx + Math.cos(an) * (R + 10 + L), y = cy + Math.sin(an) * (R + 10 + L); arrow(ctx, x, y, -Math.cos(an) * L, -Math.sin(an) * L, c.primary, { width: 1.8, head: 6 }); }
  }
  hemisphere(ctx, c, cx - gap / 2, cy, R, -1);
  hemisphere(ctx, c, cx + gap / 2, cy, R, 1);
  // jo'mrak va shlang
  const vx = cx - gap / 2 - R * 0.35, vy = cy - R * 0.94;
  ctx.fillStyle = "#64748b"; ctx.fillRect(vx - 4, vy - 14, 8, 14); ctx.fillStyle = mg.valve ? c.danger : "#334155"; ctx.fillRect(vx - (mg.valve ? 2 : 9), vy - 18, mg.valve ? 4 : 18, 4);
  // nasos
  const pTop = h - 150, pBot = ground - 4;
  ctx.strokeStyle = c.dark ? "#94a3b8" : "#475569"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(vx, vy - 14); ctx.bezierCurveTo(vx, vy - 60, pmx + 40, pTop - 40, pmx + 12, pTop + 24); ctx.stroke();
  const cg = ctx.createLinearGradient(pmx - 14, 0, pmx + 14, 0); ["#64748b", "#e2e8f0", "#94a3b8"].forEach((col, i) => cg.addColorStop(i / 2, col));
  ctx.fillStyle = cg; ctx.fillRect(pmx - 14, pTop, 28, pBot - pTop); ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.strokeRect(pmx - 14, pTop, 28, pBot - pTop);
  ctx.fillStyle = "#334155"; ctx.fillRect(pmx - 22, pBot - 4, 44, 6);
  const hy = pTop - 8 - mg.handle * 50;
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(pmx - 2, hy, 4, pTop + 30 - hy);
  ctx.fillStyle = "#78350f"; ctx.beginPath(); ctx.roundRect(pmx - 20, hy - 6, 40, 10, 4); ctx.fill();
  geo.handle = { x: pmx, y: hy, y0: pTop - 58, y1: pTop - 8 };
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(`nasos: ${mg.n} yurish`, Math.max(4, pmx - 30), pBot + 6 > h - 12 ? pBot - 16 : pBot + 6);
  // vakuummetr
  const gx = narrow ? w - 40 : w - 70, gy = narrow ? 40 : 58, gR = narrow ? 26 : 42;
  gauge(ctx, c, gx, gy, gR, mg.p / 1000, 0, 100, 20, "kPa");
  if (!narrow) { ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`p = ${fmt(mg.p / 1000, 1)} kPa`, gx, gy + gR + 10); }
  // tugmalar
  const bx = narrow ? 8 : 16;
  geo.pull = chipBtn(ctx, c, bx, 10, mg.apart ? "ajraldi" : pulling ? "tortilmoqda…" : "Tortish!", !mg.apart && !pulling, narrow ? 84 : 96, 26, c.success);
  geo.valve = chipBtn(ctx, c, bx, 42, mg.valve ? "jo‘mrak ochiq" : "Jo‘mrakni ochish", mg.valve, narrow ? 104 : 120, 24, c.danger);
  geo.pump10 = chipBtn(ctx, c, bx, 72, "+10 yurish", false, narrow ? 84 : 96, 24);
  // kuchlar solishtirish
  if (!narrow) {
    const fx = w - 170, fy = 128, Fn = needF(), Fp = pullF(), Fm = Math.max(Fn, Fp, 1), bw = 150; ctx.save();
    ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = c.text2;
    ctx.fillText(`kerakli F = ${kN(Fn)}`, fx, fy); ctx.fillStyle = c.primary; ctx.fillRect(fx, fy + 7, (bw * Fn) / Fm, 8);
    ctx.fillStyle = c.text2; ctx.fillText(`tortish = ${kN(Fp)}`, fx, fy + 28); ctx.fillStyle = c.success; ctx.fillRect(fx, fy + 35, (bw * Fp) / Fm, 8); ctx.restore();
  }
  if (mg.result) tag(ctx, mg.result, cx, Math.max(16, cy - R - 34), { color: mg.apart ? "#fff" : c.text, bg: mg.apart ? c.success : c.bg2, font: BOLD, align: "center" });
}

/* ------------------------------------------------------------------ 3. Balandlik va barometr */

function drawAltScene(ctx, c, w, h) {
  const narrow = w < 560, ground = h - 18, top = 18, Y = (hm) => ground - (hm / 12000) * (ground - top), s = P.isa(al.h);
  const sky = ctx.createLinearGradient(0, top, 0, ground);
  sky.addColorStop(0, c.dark ? "#020617" : "#1e3a8a"); sky.addColorStop(0.5, c.dark ? "#1e3a8a" : "#3b82f6"); sky.addColorStop(1, c.dark ? "#1e40af" : "#bfdbfe");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // tog'lar (masshtabda)
  const mx0 = narrow ? w * 0.4 : w * 0.34, mw = w - mx0;
  const peaks = [[0, 455], [0.1, 700], [0.2, 3309], [0.3, 1800], [0.48, 7495], [0.6, 5200], [0.78, 8849], [0.9, 6000], [1, 4200]];
  ctx.fillStyle = c.dark ? "#334155" : "#64748b"; ctx.beginPath(); ctx.moveTo(mx0, ground);
  peaks.forEach(([u, hm]) => ctx.lineTo(mx0 + u * mw, Y(hm))); ctx.lineTo(w, ground); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f8fafc";
  for (const [u, hm] of peaks) if (hm > 5000) { const x = mx0 + u * mw, y = Y(hm); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 14, y + 26); ctx.lineTo(x + 14, y + 26); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = c.dark ? "#14532d" : "#4d7c0f"; ctx.fillRect(0, Y(455), mx0 + 2, ground - Y(455) + 20);
  // shahar
  ctx.fillStyle = c.dark ? "#475569" : "#e2e8f0"; for (let i = 0; i < 6; i++) { const bx = 48 + i * 14, bh = 8 + ((i * 7) % 5) * 4; ctx.fillRect(bx, Y(455) - bh, 10, bh); }
  if (!narrow) for (const [hm, name] of MARKS.slice(0, 4)) { const u = peaks.find((p) => p[1] === hm); const x = u ? mx0 + u[0] * mw : 80; tag(ctx, `${name} ${fmt(hm, 0)} m`, clamp(x, 60, w - 70), Y(hm) - 14, { color: "#0f172a", bg: "rgba(255,255,255,0.85)", font: SMALL, align: "center", pad: 4 }); }
  // samolyot
  const ay = Y(10500), axp = narrow ? w * 0.72 : w * 0.62;
  ctx.fillStyle = "#f8fafc"; ctx.beginPath(); ctx.ellipse(axp, ay, 22, 4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(axp - 4, ay); ctx.lineTo(axp - 12, ay + 12); ctx.lineTo(axp + 2, ay); ctx.fill(); ctx.beginPath(); ctx.moveTo(axp - 18, ay); ctx.lineTo(axp - 24, ay - 8); ctx.lineTo(axp - 16, ay - 2); ctx.fill();
  if (!narrow) tag(ctx, "samolyot 10–11 km", axp + 28, ay, { color: "#0f172a", bg: "rgba(255,255,255,0.85)", font: SMALL, pad: 4 });
  // balandlik shkalasi
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "600 9px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.lineWidth = 1;
  for (let km = 0; km <= 12; km += 2) { const y = Y(km * 1000); ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(12, y); ctx.stroke(); ctx.fillText(`${km} km`, 14, y); }
  // havo shari
  const bx = narrow ? w * 0.26 : mx0 - 40, by = Y(al.h);
  ctx.strokeStyle = "#78350f"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx - 9, by - 4); ctx.lineTo(bx - 6, by + 10); ctx.moveTo(bx + 9, by - 4); ctx.lineTo(bx + 6, by + 10); ctx.stroke();
  ctx.fillStyle = "#a16207"; ctx.fillRect(bx - 7, by + 10, 14, 9);
  const eg = ctx.createLinearGradient(bx - 18, 0, bx + 18, 0); eg.addColorStop(0, "#dc2626"); eg.addColorStop(0.5, "#fbbf24"); eg.addColorStop(1, "#dc2626");
  ctx.fillStyle = eg; ctx.beginPath(); ctx.moveTo(bx - 9, by - 4); ctx.bezierCurveTo(bx - 26, by - 18, bx - 22, by - 48, bx, by - 48); ctx.bezierCurveTo(bx + 22, by - 48, bx + 26, by - 18, bx + 9, by - 4); ctx.closePath(); ctx.fill();
  geo.balloon = { x: bx, y: by - 22, r: 30 };
  ctx.strokeStyle = "rgba(251,191,36,0.9)"; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(bx + 30, by + 14); ctx.lineTo(narrow ? w - 8 : mx0 - 6, by + 14); ctx.stroke(); ctx.setLineDash([]);
  tag(ctx, `h = ${fmt(al.h, 0)} m`, bx + 30, by - 36, { color: "#0f172a", bg: "rgba(255,255,255,0.9)", font: BOLD });
  // asboblar kartochkasi
  const cw = narrow ? 150 : 196, chh = narrow ? 92 : 178, cx0 = narrow ? w - cw - 6 : 52, cy0 = narrow ? h - 92 - 26 : 12;
  ctx.fillStyle = c.dark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.92)"; ctx.beginPath(); ctx.roundRect(cx0, cy0, cw, chh, 10); ctx.fill();
  const gR = narrow ? 30 : 44, gx = cx0 + gR + 12, gy = cy0 + gR + 14;
  gauge(ctx, c, gx, gy, gR, mm(s.p), 100, 800, 100, "mm sim. ust.", 200);
  // paket
  const ratio = P.bagRatio(s.p), pw = narrow ? 30 : 40, phh = (narrow ? 26 : 34) * Math.min(2.4, Math.sqrt(ratio)), pxx = cx0 + cw - pw - 12, pyy = cy0 + (narrow ? 40 : 66);
  ctx.fillStyle = "#facc15"; ctx.strokeStyle = "#a16207"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(pxx + pw / 2, pyy, pw / 2 + Math.min(8, (ratio - 1) * 4), phh / 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#dc2626"; ctx.fillRect(pxx - 2, pyy - phh / 2 - 4, pw + 4, 6); ctx.fillRect(pxx - 2, pyy + phh / 2 - 2, pw + 4, 6);
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`paket ×${fmt(ratio, 2)}`, pxx + pw / 2, pyy + phh / 2 + 8);
  ctx.textAlign = "left"; ctx.font = MID; ctx.fillStyle = c.text;
  const ly = cy0 + 2 * gR + 26;
  if (!narrow) ctx.fillText(`${fmt(s.p / 100, 0)} hPa · ${fmt(s.T - 273.15, 1)} °C`, cx0 + 10, ly);
  if (!narrow) ctx.fillText(`suv ${fmt(P.boilingPoint(s.p), 1)} °C da qaynaydi`, cx0 + 10, ly + 18);
}

/* ------------------------------------------------------------------ Chizish va grafik */

function draw(ctx, s) {
  const c = s.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, s.w, s.h);
  if (ui.mode === "torr") drawTorr(ctx, c, s.w, s.h);
  else if (ui.mode === "mag") drawMag(ctx, c, s.w, s.h);
  else drawAltScene(ctx, c, s.w, s.h);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.44, 320, 370)), graph: Math.round(clamp(vh * 0.28, 200, 260)) }; };
const stage = createStage($("#stage"), draw, { height: () => heights().stage });
function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "alt") return drawAlt(ctx, gs, { h: al.h, marks: MARKS, hover: ui.hover });
  if (ui.mode === "mag") { const s = sz(); return drawPump(ctx, gs, { V: V(), Vp: V() * s.Vp, pMin: s.pMin * P.P0, Rad: s.R, n: mg.n, pull: pullF(), hover: ui.hover }); }
  ctx.fillStyle = gs.colors.bg; ctx.fillRect(0, 0, gs.w, gs.h);
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  mag: ["Ajratish uchun kerakli kuch F(n)", "Har yurishda shar ichidagi havoning bir qismi so‘riladi va bosim kamayadi, kerakli kuch esa o‘sadi. Nasos ichkaridagi havoni to‘liq so‘ra olmaydi — kuch chegaraga yaqinlashadi. Yashil chiziq — tortuvchilar kuchi: u ko‘k chiziqdan yuqori bo‘lsa, sharlar ajraladi."],
  alt: ["Atmosfera bosimining balandlikka bog‘liqligi p(h)", "Pastki qatlamlar ustidagi havo og‘irligini ko‘taradi, shuning uchun bosim yer yaqinida eng katta. Har 5,5 km ko‘tarilganda bosim taxminan ikki marta kamayadi. Uzuq chiziq — darslikdagi «har 12 m da 1 mm sim. ust.» qoidasi: u faqat bir necha yuz metrgacha to‘g‘ri."],
};
function setTab() {
  const t = TABS[ui.mode], card = $("[data-graph-card]"); ui.hover = null;
  card.hidden = !t;
  if (t) { $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1]; graph.canvas.setAttribute("aria-label", t[0]); graph.render(); }
}

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;

function updateReadouts() {
  if (ui.mode === "torr") {
    const t = tubeNow(), liq = P.LIQUIDS[tr.liq], water = tr.liq === "water", p = pAtm();
    setRO("r1", "Atmosfera bosimi <i>p</i>", u(fmt(mm(p), 0), "mm sim. ust."), `${fmt(p / 1000, 2)} kPa = ${fmt(p, 0)} Pa`, "orange");
    setRO("r2", "Ustun balandligi <i>h</i> (vertikal)", tr.hole ? u("0", water ? "m" : "mm") : water ? u(fmt(t.hv, 2), "m") : u(fmt(t.hv * 1000, 0), "mm"), tr.hole ? "havo kirdi — ustun tushdi" : t.full ? "nay to‘liq to‘lgan" : "h = p/(ρg)", "green");
    setRO("r3", "Nay bo‘ylab uzunlik", tr.hole ? "—" : water ? u(fmt(t.len, 2), "m") : u(fmt(t.len * 1000, 0), "mm"), `nay qiyaligi ${fmt(tr.tilt, 0)}°`);
    setRO("r4", "Nay tepasidagi bosim", tr.hole ? u(fmt(mm(p), 0), "mm sim. ust.") : t.full ? u(fmt(mm(t.pTop), 0), "mm sim. ust.") : "≈ 0", tr.hole ? "teshikdan havo kirdi" : t.full ? "suyuqlik nay tepasini bosadi" : "Torichelli bo‘shlig‘i (vakuum)");
    setRO("r5", "Suyuqlik zichligi <i>ρ</i>", u(fmt(liq.rho, 0), "kg/m³"), liq.name);
    setRO("r6", "Joy balandligi", u(fmt(tr.alt, 0), "m"), tr.alt ? `dengiz sathidan ${fmt(760 - mm(p), 0)} mm kam` : "dengiz sathi");
    return;
  }
  if (ui.mode === "mag") {
    const s = sz(), S = Math.PI * s.R * s.R, Fn = needF(), Fp = pullF();
    setRO("r1", "Shar ichidagi bosim <i>p</i>", u(fmt(mg.p / 1000, 1), "kPa"), `${fmt((mg.p / P.P0) * 100, 0)} % · nasos ${mg.n} yurish`);
    setRO("r2", "Bosimlar farqi <i>p₀ − p</i>", u(fmt((P.P0 - mg.p) / 1000, 1), "kPa"), "tashqaridan havo bosadi");
    setRO("r3", "Kesim yuzasi <i>πR²</i>", u(fmt(S * 1e4, 0), "cm²"), `d = ${fmt(s.R * 200, 0)} cm`);
    setRO("r4", "Kerakli kuch <i>F</i>", kN(Fn).replace(/ (\S+)$/, "<small>$1</small>"), `≈ ${fmt(Fn / 9.81, 0)} kg yuk og‘irligi`, "orange");
    setRO("r5", "Tortish kuchi", kN(Fp).replace(/ (\S+)$/, "<small>$1</small>"), `${mg.team} ta ${s.who} × ${kN(s.puller)}${mg.tree ? ", daraxt" : ""}`, Fp > Fn ? "green" : "");
    setRO("r6", "Natija", mg.apart ? "ajraldi" : mg.result ? "ajralmadi" : "—", Fp > Fn ? "kuch yetarli" : `yana ${kN(Fn - Fp)} kerak`, mg.apart ? "green" : "");
    return;
  }
  const s = P.isa(al.h);
  setRO("r1", "Balandlik <i>h</i>", u(fmt(al.h, 0), "m"), al.h > 8000 ? "kislorod niqobi kerak" : "");
  setRO("r2", "Atmosfera bosimi <i>p</i>", u(fmt(s.p / 1000, 1), "kPa"), `${fmt((s.p / P.P0) * 100, 0)} % · ${fmt(s.p / 100, 0)} hPa`, "orange");
  setRO("r3", "Barometr ko‘rsatishi", u(fmt(mm(s.p), 0), "mm sim. ust."), `dengiz sathidan ${fmt(760 - mm(s.p), 0)} mm kam`);
  setRO("r4", "Havo temperaturasi", u(fmt(s.T - 273.15, 1), "°C"), "standart atmosfera");
  setRO("r5", "Havo zichligi <i>ρ</i>", u(fmt(s.rho, 3), "kg/m³"), `paket ${fmt(P.bagRatio(s.p), 2)} marta shishdi`);
  setRO("r6", "Suvning qaynash temperaturasi", u(fmt(P.boilingPoint(s.p), 1), "°C"), "pₛ(t) = p", "green");
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "torr") { const tt = tubeNow(); t = tr.hole ? "Havo kirdi — ustun tushdi" : tt.full ? "Nay to‘liq to‘ldi" : `h = ${tr.liq === "water" ? `${fmt(tt.hv, 2)} m` : `${fmt(tt.hv * 1000, 0)} mm`}`; tone = tr.hole ? "orange" : "green"; }
  else if (ui.mode === "mag") { t = mg.apart ? "Yarim sharlar ajraldi" : mg.pull > 0 ? "Tortilmoqda…" : mg.result || `F = ${kN(needF())}`; tone = mg.apart ? "green" : mg.result ? "orange" : "blue"; }
  else { t = `${fmt(mm(P.isa(al.h).p), 0)} mm sim. ust.`; tone = "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "torr") {
    const water = tr.liq === "water";
    p.push(`<p>1643-yilda Torichelli bir uchi berk 1 m li shisha nayni simob bilan to‘ldirib, ochiq uchini simobli idishga to‘ntardi. Simob to‘liq oqib tushmadi: ≈ 760 mm balandlikdagi ustun qoldi, uning ustida esa bo‘shliq (vakuum) hosil bo‘ldi. Idishdagi simob sirtini <b>atmosfera bosimi</b> bosadi va ustun og‘irligini muvozanatlaydi: p₀ = ρgh.</p>`);
    p.push(water ? "<p>Paskal suv bilan xuddi shunday tajribani o‘tkazgan: suv simobdan 13,6 marta yengil, shuning uchun suv ustuni 10,3 m — uch qavatli uydan baland bo‘ladi. Simob barometrda shuning uchun ishlatiladi.</p>" : `<p>Nayni qiyalatsangiz ham ustunning <b>vertikal balandligi</b> o‘zgarmaydi — nay bo‘ylab simob ko‘proq joy egallaydi. Nay tepasi 760 mm dan pastga tushsa bo‘shliq yo‘qoladi. Nay tepasi teshilsa, ichkariga havo kiradi va simob idishga tushadi. Tog‘ga chiqqan sari ustun pasayadi — bu barometr.</p>`);
  } else if (ui.mode === "mag") {
    p.push("<p>1654–1656-yillarda Magdeburg shahri burgomistri Otto fon Gerike ikki mis yarim sharni bir-biriga qo‘yib, ichidagi havoni nasos bilan so‘rdi. Ichkarida havo kam qolgach, sharlarni tashqi havo bosimi bir-biriga qattiq siqib qo‘ydi. Har tomonga 8 tadan ot qo‘shilganda ham ular sharlarni ajrata olmagan.</p>");
    p.push(`<p>Ajratish uchun kerakli kuch F = (p₀ − p)·πR² — bosimlar farqi va sharning kesim yuzasiga bog‘liq. Bir tomonni daraxtga bog‘lash natijani o‘zgartirmaydi: daraxt ham xuddi shunday kuch bilan qarshi tortadi (Nyutonning III qonuni). Jo‘mrak ochilsa, ichkariga havo kiradi va sharlar o‘zi ajraladi.</p>`);
  } else {
    p.push("<p>Atmosfera bosimi — yuqoridagi havo ustunining og‘irligi. Ko‘tarilgan sari ustimizdagi havo kamayadi va siyraklashadi, shuning uchun bosim kamayadi: Yer yaqinida har ≈ 12 m da 1 mm sim. ust. ga, 5,5 km da esa ikki marta. Aneroid barometr shu o‘zgarishni o‘lchaydi; balandlik o‘lchagich (altimetr) ham aslida barometr.</p>");
    p.push(`<p>Bosim kamaysa, suv pastroq temperaturada qaynaydi: Everest cho‘qqisida ≈ 70 °C da. Dengiz sathida yopilgan paket tog‘da shishib ketadi, chunki ichidagi havo bosimi tashqaridagidan katta. Samolyotlar 10–11 km da uchadi — u yerda bosim dengiz sathidagining to‘rtdan biricha, shuning uchun salonga havo damlanadi.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "torr" ? "<small>Torichelli</small> p₀ = ρgh ≈ 760 mm sim. ust." : ui.mode === "mag" ? "<small>Magdeburg sharlari</small> F = (p₀ − p)·πR²" : "<small>Balandlik</small> Δp ≈ 1 mm sim. ust. / 12 m";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "torr") { const target = tr.hole ? 0 : tubeNow().len; tr.col += (target - tr.col) * Math.min(1, dt * (tr.hole ? 3 : 6)); }
  else if (ui.mode === "mag") {
    if (mg.valve && !mg.apart) mg.p += (P.P0 - mg.p) * Math.min(1, dt * 4);
    if (mg.pull > 0) {
      mg.pull -= dt;
      if (pullF() > needF() && !mg.apart) { mg.apart = true; mg.p = P.P0; mg.result = "Yarim sharlar ajraldi!"; }
      if (mg.pull <= 0) { mg.pull = 0; if (!mg.apart) mg.result = `Ajrata olmadi: ${kN(pullF())} < ${kN(needF())}`; }
    }
    if (mg.apart) mg.sep = Math.min(1, mg.sep + dt * 2.5);
  }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.2) { uiTimer = 0; refresh(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom";
}
playBtn.addEventListener("click", () => { if (loop.running) { loop.stop(); playing = false; } else { loop.start(); playing = true; } });
function startIfNeeded() {
  if (prefersReducedMotion()) { tr.col = tr.hole ? 0 : tubeNow().len; loop.stop(); setPlayUI(false); return; }
  if (!playing) { loop.stop(); setPlayUI(false); } else loop.start();
}
function resetMag() { Object.assign(mg, { n: 0, p: P.P0, valve: false, handle: 1, armed: false, pull: 0, apart: false, sep: 0, result: "" }); }
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "torr") { tr.hole = false; tr.col = null; }
  else if (ui.mode === "mag") resetMag();
  refresh();
});

/* ------------------------------------------------------------------ Boshqaruv */

const aC = bindRange($("#tA"), $("#tAOut"), (v) => `${fmt(v, 0)}°`, (v) => { tr.tilt = v; customized(); refresh(); });
const hC = bindRange($("#tH"), $("#tHOut"), (v) => `${fmt(v, 0)} m`, (v) => { tr.alt = v; customized(); refresh(); });
const nC = bindRange($("#mN"), $("#mNOut"), (v) => `${fmt(v, 0)}`, (v) => { mg.team = v; mg.result = ""; customized(); refresh(); });
const altC = bindRange($("#aH"), $("#aHOut"), (v) => `${fmt(v, 0)} m`, (v) => { al.h = v; customized(); refresh(); });
const treeEl = $("[data-tree]");
treeEl.addEventListener("change", () => { mg.tree = treeEl.checked; mg.result = ""; customized(); refresh(); });
function setLiq(l) { tr.liq = l; tr.hole = false; tr.col = null; document.querySelectorAll("[data-liq-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.liqValue === l))); }
document.querySelectorAll("[data-liq-value]").forEach((b) => b.addEventListener("click", () => { setLiq(b.dataset.liqValue); customized(); refresh(); }));
function setSize(s) {
  mg.size = s; resetMag();
  document.querySelectorAll("[data-size-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sizeValue === s)));
  $("[data-team-label]").textContent = s === "big" ? "Har tomonda otlar soni" : "Har tomonda o‘quvchilar soni";
}
document.querySelectorAll("[data-size-value]").forEach((b) => b.addEventListener("click", () => { setSize(b.dataset.sizeValue); customized(); refresh(); }));
function stroke(k = 1) {
  if (mg.apart || mg.valve) return;
  const s = sz(); for (let i = 0; i < k; i++) { mg.n++; mg.p = P.pumped(1, V(), V() * s.Vp, mg.p, s.pMin * P.P0); }
  mg.result = "";
}

/* Sahnada surish va bosish */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function hit(p) {
  if (ui.mode === "torr") { if (inBox(p, geo.hole)) return { kind: "hole" }; const g = geo.tip; if (g && Math.hypot(p.x - g.x, p.y - g.y) <= 20) return { kind: "tip" }; }
  else if (ui.mode === "mag") {
    if (inBox(p, geo.pull)) return { kind: "pull" }; if (inBox(p, geo.valve)) return { kind: "valve" }; if (inBox(p, geo.pump10)) return { kind: "pump10" };
    const g = geo.handle; if (g && Math.abs(p.x - g.x) <= 26 && p.y >= g.y0 - 12 && p.y <= g.y1 + 14) return { kind: "handle" };
  } else { const g = geo.balloon; if (g && Math.hypot(p.x - g.x, p.y - g.y) <= g.r) return { kind: "balloon" }; }
  return null;
}
function applyDrag(h, p) {
  if (h.kind === "tip") { const g = geo.tip, a = Math.atan2(p.x - g.px, g.surf - p.y) / DEG; tr.tilt = clamp(Math.round(a), 0, 70); aC.set(tr.tilt); }
  else if (h.kind === "handle") {
    const g = geo.handle; mg.handle = clamp((g.y1 - p.y) / (g.y1 - g.y0), 0, 1);
    if (mg.handle < 0.12) mg.armed = true;
    if (mg.handle > 0.88 && mg.armed) { mg.armed = false; stroke(); }
  } else if (h.kind === "balloon") { const s = stage, ground = s.h - 18, top = 18; al.h = clamp(Math.round(((ground - (p.y + 22)) / (ground - top)) * 12000 / 10) * 10, 0, 12000); altC.set(al.h); }
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return;
  e.preventDefault(); customized();
  if (h.kind === "hole") { if (!tr.hole) tr.hole = true; refresh(); return; }
  if (h.kind === "pull") { if (!mg.apart && mg.pull <= 0) { mg.pull = 2.2; mg.result = ""; } if (!loop.running && !prefersReducedMotion()) { playing = true; loop.start(); } else if (prefersReducedMotion()) { if (pullF() > needF()) { mg.apart = true; mg.sep = 1; mg.p = P.P0; mg.result = "Yarim sharlar ajraldi!"; } else mg.result = `Ajrata olmadi: ${kN(pullF())} < ${kN(needF())}`; } refresh(); return; }
  if (h.kind === "valve") { if (!mg.apart) { mg.valve = !mg.valve; mg.result = ""; if (prefersReducedMotion() && mg.valve) mg.p = P.P0; } refresh(); return; }
  if (h.kind === "pump10") { stroke(10); refresh(); return; }
  applyDrag(h, p);
  drag = h; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } canvas.dataset.dragging = "true"; refresh();
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (!drag) { const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "handle" || h.kind === "balloon" ? "ns-resize" : h.kind === "tip" ? "grab" : "pointer"; return; }
  applyDrag(drag, p); refresh();
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const TR = (liq, tilt, alt, lesson, title) => ({ mode: "torr", title, lesson, set: () => { setLiq(liq); Object.assign(tr, { tilt, alt, hole: false, col: null }); } });
const MG = (size, team, n, tree, title, lesson) => ({ mode: "mag", title, lesson, set: () => { setSize(size); Object.assign(mg, { team, tree }); stroke(n); } });
const PRESETS = {
  torr: TR("hg", 0, 0, "Bir uchi berk 1 m li nay simob bilan to‘ldirilib, simobli idishga to‘ntarilgan. Simob ustuni 760 mm da to‘xtadi — uni idishdagi simob sirtiga ta’sir qilayotgan atmosfera bosimi ushlab turibdi.", "Torichelli tajribasi"),
  torrTilt: TR("hg", 30, 0, "Nay 30° ga qiyalatildi: nay bo‘ylab simob 878 mm ga cho‘zildi, ammo vertikal balandlik o‘sha 760 mm. Nayning uchini sahnada surib tekshiring: 40° dan ko‘proq qiyalatilsa nay to‘liq to‘ladi.", "Nayni qiyalatish"),
  torrFull: TR("hg", 55, 0, "Nay tepasi 760 mm dan pastga tushdi (1 m · cos 55° = 574 mm): bo‘shliq yo‘qoldi, simob nay tepasini ≈ 186 mm sim. ust. bosim bilan bosmoqda.", "Nay to‘liq to‘ldi"),
  torrHole: TR("hg", 0, 0, "«Teshish» tugmasini bosing: nay tepasiga havo kiradi, ustun ustidagi bosim ham p₀ ga teng bo‘ladi va simob idishga tushadi — xuddi ochiq tutash idishlardagidek.", "Nay tepasini teshish"),
  torrWater: TR("water", 0, 0, "Paskalning suvli barometri: suv simobdan 13,6 marta yengil, ustun 10,3 m — 4 qavatli binoning deyarli tomigacha.", "Suvli barometr (Paskal)"),
  torrTash: TR("hg", 0, 455, "Toshkent dengiz sathidan ≈ 455 m balandlikda: o‘rtacha bosim ≈ 719 mm sim. ust. Shuning uchun Toshkentdagi barometr 760 emas, 715–725 mm atrofida ko‘rsatadi.", "Toshkentda"),
  torrMount: TR("hg", 0, 3000, "3000 m balandlikdagi tog‘da simob ustuni ≈ 526 mm — dengiz sathidagidan 234 mm past. 1648-yilda Perye Paskal topshirig‘i bilan Pyui-de-Dom tog‘ida shunday o‘lchagan.", "Tog‘da: 3000 m"),
  magStart: MG("big", 8, 0, false, "Gerike yarim sharlari", "Ichida hali havo bor — sharlar osongina ajraladi. Nasos dastagini yuqoriga-pastga surib havoni so‘ring (yoki «+10 yurish»), kerakli kuch qanday o‘sishini kuzating."),
  magGuericke: MG("big", 8, 40, false, "8 + 8 ot ajrata olmaydi", "Havo so‘rib olindi: 51 cm li sharlarni ajratish uchun ≈ 18 kN (1,9 tonnalik yuk og‘irligi) kerak. 8 ta ot ≈ 14 kN bilan tortadi — «Tortish!» ni bosing."),
  magTree: MG("big", 8, 40, true, "Bir tomoni daraxtga bog‘langan", "Bir tomondagi 8 ta ot o‘rniga daraxt qo‘yildi. Natija o‘zgarmaydi: arqondagi taranglik baribir 8 ta otning kuchiga teng — daraxt ham xuddi shunday kuch bilan qarshi tortadi."),
  magMore: MG("big", 12, 40, false, "12 + 12 ot", "Har tomonga 12 tadan ot: tortish kuchi 21,6 kN — kerakli kuchdan katta. «Tortish!» ni bosing: sharlar katta shovqin bilan ajraladi."),
  magSchool: MG("small", 2, 20, false, "Maktab yarim sharlari", "Diametri 10 cm li yarim sharlar: kerakli kuch ≈ 730 N. Ikki o‘quvchi (≈ 800 N) zo‘rg‘a ajratadi. Jo‘mrakni ochib ko‘ring — kuch kerak bo‘lmay qoladi."),
  altSea: { mode: "alt", title: "Dengiz sathi", lesson: "Normal atmosfera bosimi: 760 mm sim. ust. = 101 325 Pa, havo zichligi 1,23 kg/m³, suv 100 °C da qaynaydi.", set: () => { al.h = 0; } },
  altChimyon: { mode: "alt", title: "Katta Chimyon (3309 m)", lesson: "Chimyon cho‘qqisida bosim ≈ 510 mm sim. ust., suv 89 °C da qaynaydi. Dengiz sathida yopilgan paket 1,5 marta shishgan.", set: () => { al.h = 3309; } },
  altEverest: { mode: "alt", title: "Everest cho‘qqisi (8849 m)", lesson: "Bosim dengiz sathidagining uchdan biri (≈ 236 mm sim. ust.), havo −42 °C. Suv ≈ 70 °C da qaynaydi — tuxumni pishirib bo‘lmaydi. Alpinistlar kislorod ballonidan foydalanadi.", set: () => { al.h = 8849; } },
  altPlane: { mode: "alt", title: "Samolyot balandligi (10,5 km)", lesson: "10,5 km da bosim ≈ 25 kPa, havo −53 °C. Samolyot saloniga havo damlanib, bosim 2–2,5 km balandlikdagidek ushlab turiladi.", set: () => { al.h = 10500; } },
};
const GROUPS = [["Torichelli tajribasi", ["torr", "torrTilt", "torrFull", "torrHole", "torrWater", "torrTash", "torrMount"]], ["Magdeburg yarim sharlari", ["magStart", "magGuericke", "magTree", "magMore", "magSchool"]], ["Balandlik va barometr", ["altSea", "altChimyon", "altEverest", "altPlane"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { torr: "Nay uchini suring", mag: "Nasos dastagini suring, «Tortish!»", alt: "Havo sharini suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { torr: "Simob yoki suv bilan to‘ldirilgan barometr nayi, idish va chizg‘ich", mag: "Magdeburg yarim sharlari, nasos, vakuummetr va tortayotgan otlar", alt: "Tog‘lar, havo shari, aneroid barometr va germetik paket" }[ui.mode]);
}
const MODE_DEFAULT = { torr: "torr", mag: "magStart", alt: "altSea" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null;
  ui.mode = p.mode; if (p.mode === "mag") resetMag(); p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  aC.set(tr.tilt); hC.set(tr.alt); nC.set(mg.team); altC.set(al.h); treeEl.checked = mg.tree;
  setTab(); startIfNeeded(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "torr");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
