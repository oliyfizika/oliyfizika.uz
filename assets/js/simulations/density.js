// ==========================================================================
// Massa, zichlik va suzish — virtual laboratoriya (simulations/density.html)
// 1) Massa: pallali tarozi; chap pallada jism, o'ng pallaga gira toshlari (100 g … 100 mg) sahnada suriladi.
// 2) Zichlik: elektron tarozi (m) va menzurka (V₂ − V₁, lupa bilan 2 mL bo'lim); ρ = m/V va jadvaldan modda.
// 3) Suzish: dinamometrga osilgan brusok suyuqlikka botiriladi (dinamometr sahnada suriladi), F_A, ipni kesish.
// Fizika: density-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow } from "./sim-kit.js";
import * as P from "./density-physics.js";
import { drawTable, drawForces, lastFrame } from "./density-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 13px Inter, system-ui, sans-serif";
const BODIES = {
  cu: { name: "Mis silindr", mat: "copper", m: 89.0, V: 10, shape: "cyl" },
  al: { name: "Alyuminiy brusok", mat: "alu", m: 54.0, V: 20, shape: "box" },
  st: { name: "Po‘lat sharcha", mat: "steel", m: 31.2, V: 4, shape: "ball" },
  gr: { name: "Granit bo‘lagi", mat: "granite", m: 78.0, V: 30, shape: "rock" },
  zn: { name: "Rux bo‘lagi", mat: "zinc", m: 63.9, V: 9, shape: "rock" },
  unk: { name: "Noma’lum metall silindr", mat: "lead", m: 113.0, V: 10, shape: "cyl" },
  wd: { name: "Yog‘och brusok", mat: "wood", m: 24.0, V: 48, shape: "box" },
};
const FBODY = { A: 16, H: 5 }; // suzish: 4 × 4 × 5 cm brusok
const F_MATS = ["cork", "wood", "ice", "paraffin", "egg", "plastic", "alu", "steel", "copper", "lead"];
const TABLE_KEYS = ["cork", "wood", "ice", "egg", "glass", "granite", "alu", "zinc", "steel", "copper", "silver", "lead", "gold"];
const DEPTH = 10; // idish chuqurligi (suyuqlik), cm
/** Suzish sahnasi masshtabi (px/cm): yuqorida dinamometr + ip + brusok (9,8 cm), pastda idish */
const floatScale = (h) => (h - 24) / (DEPTH + 9.8);

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "mass", tab: "tab", hover: null };
const mass = { body: "cu", pan: [], th: 0, w: 0 };
const dens = { body: "cu", V1: 100, inCyl: false, drop: 0 };
const fl = { mat: "alu", liq: "water", d: 0, free: false, y: 0, v: 0 };
let presetId = null, running = false;
const geo = {};

const panMass = () => P.sumWeights(mass.pan.map((i) => P.WEIGHTS[i]));
const bodyM = (k) => BODIES[k].m;
const flM = () => P.MATERIALS[fl.mat].rho * FBODY.A * FBODY.H;
const flRhoL = () => P.LIQUIDS[fl.liq].rho;
/** Jismning haqiqiy botish chuqurligi (cm): ip bilan — dinamometr, suzsa ortiqcha botmaydi; erkin — dinamikadan */
function flDepth() {
  if (fl.free) return fl.y;
  const fd = P.floatDepth({ m: flM(), A: FBODY.A, H: FBODY.H, rhoL: flRhoL() });
  return fd !== null ? Math.min(fl.d, fd) : fl.d;
}
const flCfg = () => ({ m: flM(), A: FBODY.A, H: FBODY.H, rhoL: flRhoL(), d: flDepth() });

/* ------------------------------------------------------------------ Chizish yordamchilari */

function body(ctx, c, k, x, y, s) { // markazi (x, y), o'lcham s
  const b = BODIES[k] || { shape: "box", mat: k }, col = P.MATERIALS[b.mat].color;
  const g = ctx.createLinearGradient(x - s, y - s, x + s, y + s); g.addColorStop(0, col); g.addColorStop(1, shade(col, -0.3));
  ctx.fillStyle = g; ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 1.2; ctx.beginPath();
  if (b.shape === "ball") ctx.arc(x, y, s * 0.7, 0, TAU);
  else if (b.shape === "cyl") ctx.roundRect(x - s * 0.55, y - s, s * 1.1, s * 2, 4);
  else if (b.shape === "rock") { ctx.moveTo(x - s, y + s * 0.6); ctx.lineTo(x - s * 0.8, y - s * 0.5); ctx.lineTo(x - s * 0.1, y - s * 0.9); ctx.lineTo(x + s * 0.9, y - s * 0.4); ctx.lineTo(x + s, y + s * 0.5); ctx.lineTo(x + s * 0.2, y + s * 0.9); ctx.closePath(); }
  else ctx.rect(x - s, y - s * 0.7, s * 2, s * 1.4);
  ctx.fill(); ctx.stroke();
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, t = f < 0 ? 0 : 255, p = Math.abs(f);
  return `rgb(${Math.round((t - r) * p + r)},${Math.round((t - g) * p + g)},${Math.round((t - b) * p + b)})`;
}
function weightShape(ctx, c, x, yb, wg) { // yb — taglik
  const big = wg >= 1, hh = big ? 8 + Math.cbrt(wg) * 4.5 : 3, ww = big ? 9 + Math.cbrt(wg) * 4.5 : 14;
  if (big) {
    const g = ctx.createLinearGradient(x - ww / 2, 0, x + ww / 2, 0); g.addColorStop(0, "#fbbf24"); g.addColorStop(1, "#b45309");
    ctx.fillStyle = g; ctx.fillRect(x - ww / 2, yb - hh, ww, hh); ctx.fillRect(x - ww * 0.18, yb - hh - 5, ww * 0.36, 5);
    ctx.beginPath(); ctx.arc(x, yb - hh - 7, ww * 0.16, 0, TAU); ctx.fill();
  } else { ctx.fillStyle = c.dark ? "#cbd5e1" : "#94a3b8"; ctx.beginPath(); ctx.moveTo(x - ww / 2, yb); ctx.lineTo(x + ww / 2, yb); ctx.lineTo(x + ww / 2, yb - hh); ctx.lineTo(x - ww / 2 + 4, yb - hh); ctx.closePath(); ctx.fill(); }
  return { w: ww, h: hh + (big ? 9 : 0) };
}
const wLabel = (wg) => (wg >= 1 ? `${fmt(wg, 0)} g` : `${fmt(wg * 1000, 0)} mg`);

/* ------------------------------------------------------------------ 1. Tarozi */

function drawMassStage(ctx, c, w, h) {
  const narrow = w < 560, cx = narrow ? w * 0.4 : w * 0.34, py = 64, Lb = Math.min(150, w * (narrow ? 0.34 : 0.24)), th = mass.th;
  // tirgak
  ctx.fillStyle = c.dark ? "#475569" : "#94a3b8"; ctx.fillRect(cx - 5, py, 10, h - py - 26); ctx.fillRect(cx - 60, h - 28, 120, 10);
  // shkala va strelka
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, py, 60, Math.PI / 2 - 0.3, Math.PI / 2 + 0.3); ctx.stroke();
  for (let k = -3; k <= 3; k++) { const a = Math.PI / 2 + k * 0.1; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 56, py + Math.sin(a) * 56); ctx.lineTo(cx + Math.cos(a) * (k ? 62 : 66), py + Math.sin(a) * (k ? 62 : 66)); ctx.stroke(); }
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, py); ctx.lineTo(cx + Math.sin(th) * 58, py + Math.cos(th) * 58); ctx.stroke();
  // shayin
  const lx = cx - Lb * Math.cos(th), ly = py + Lb * Math.sin(th), rx = cx + Lb * Math.cos(th), ry = py - Lb * Math.sin(th);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.stroke(); ctx.lineCap = "butt";
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.moveTo(cx, py - 4); ctx.lineTo(cx - 7, py + 8); ctx.lineTo(cx + 7, py + 8); ctx.closePath(); ctx.fill();
  // pallalar
  const pw = Math.min(92, Lb * 0.75), drop = Math.min(96, h * 0.32);
  const pan = (x, y) => {
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - pw / 2, y + drop); ctx.moveTo(x, y); ctx.lineTo(x + pw / 2, y + drop); ctx.stroke();
    ctx.fillStyle = c.dark ? "#64748b" : "#cbd5e1"; ctx.beginPath(); ctx.ellipse(x, y + drop + 3, pw / 2 + 4, 6, 0, 0, TAU); ctx.fill();
    return y + drop;
  };
  const lb = pan(lx, ly), rb = pan(rx, ry);
  body(ctx, c, mass.body, lx, lb - 16, 15);
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(BODIES[mass.body].name, lx, lb + 12);
  // o'ng pallada toshlar
  geo.panItems = []; let px0 = rx - pw / 2 + 8, row = 0, cxw = px0;
  mass.pan.forEach((i) => {
    const wg = P.WEIGHTS[i], wd = wg >= 1 ? 9 + Math.cbrt(wg) * 4.5 : 14;
    if (cxw + wd > rx + pw / 2 - 4) { row++; cxw = px0; }
    const sz = weightShape(ctx, c, cxw + wd / 2, rb - row * 26, wg);
    geo.panItems.push({ i, x: cxw, y: rb - row * 26 - sz.h, w: wd, h: sz.h });
    cxw += wd + 3;
  });
  geo.pan = { x: rx - pw / 2 - 16, y: ry - 10, w: pw + 32, h: drop + 50 }; // tosh tashlanadigan zona (keng)
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`toshlar: ${fmt(panMass(), 1)} g`, rx, rb + 12);
  // toshlar qutisi
  const bx = narrow ? 8 : cx + Lb + 70, bw = narrow ? w - 16 : w - bx - 12, by = narrow ? h - 70 : 20;
  geo.box = [];
  if (!narrow) {
    ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(bx, by, bw, h - by - 16, 8); ctx.fill(); ctx.stroke();
    ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("Toshlar qutisi (gira)", bx + 8, by + 6);
    const cols = Math.max(2, Math.floor((bw - 12) / 48)), cell = (bw - 12) / cols;
    P.WEIGHTS.forEach((wg, i) => {
      const k = i, gx = bx + 6 + (k % cols) * cell + cell / 2, gy = by + 30 + Math.floor(k / cols) * 46 + 30;
      const on = mass.pan.includes(i);
      ctx.globalAlpha = on ? 0.18 : 1; weightShape(ctx, c, gx, gy, wg); ctx.globalAlpha = 1;
      ctx.font = SMALL; ctx.fillStyle = on ? c.text3 : c.text; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(wLabel(wg), gx, gy + 3);
      if (!on) geo.box.push({ i, x: gx - cell / 2 + 2, y: gy - 36, w: cell - 4, h: 50 });
    });
  }
  if (geo.dragW) { weightShape(ctx, c, geo.dragW.x, geo.dragW.y, P.WEIGHTS[geo.dragW.i]); }
  // holat yozuvi
  const dm = panMass() - bodyM(mass.body), bal = P.balanceAngle(dm) === 0;
  tag(ctx, bal ? `Muvozanat: m = ${fmt(panMass(), 1)} g` : dm < 0 ? "Chap palla og‘ir — tosh qo‘shing" : "O‘ng palla og‘ir — toshni oling", cx, 18, { color: bal ? c.success : c.text, bg: c.bg2, align: "center", font: BOLD });
}

/* ------------------------------------------------------------------ 2. Zichlik */

function drawDensStage(ctx, c, w, h) {
  const narrow = w < 560, B = BODIES[dens.body], cylX = narrow ? w * 0.5 : w * 0.42, cw = 64, top = 24, bot = h - 26, cap = 250, H = bot - top;
  const Y = (V) => bot - (V / cap) * H, V2 = dens.V1 + (dens.inCyl ? B.V : 0);
  // elektron tarozi
  const sx = narrow ? 14 : 30, sy = h - 40, sw = narrow ? 92 : 130;
  ctx.fillStyle = c.dark ? "#334155" : "#e2e8f0"; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(sx, sy, sw, 26, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.dark ? "#052e16" : "#ecfdf5"; ctx.fillRect(sx + 10, sy + 5, sw - 20, 16);
  ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace"; ctx.fillStyle = c.success; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillText(`${fmt(dens.inCyl ? 0 : B.m, 1)} g`, sx + sw - 14, sy + 13);
  ctx.fillStyle = c.dark ? "#475569" : "#cbd5e1"; ctx.fillRect(sx + 10, sy - 4, sw - 20, 4);
  geo.scale = { x: sx, y: sy - 50, w: sw, h: 60 };
  // menzurka: suv
  const col = P.LIQUIDS.water.color;
  ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${c.dark ? 0.3 : 0.35})`; ctx.fillRect(cylX - cw / 2, Y(V2), cw, bot - Y(V2));
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cylX - cw / 2, Y(V2) + 3); ctx.quadraticCurveTo(cylX, Y(V2) + 7, cylX + cw / 2, Y(V2) + 3); ctx.stroke();
  // jism
  if (dens.inCyl) {
    const s = Math.min(18, cw * 0.28), by = bot - s - 2 - dens.drop * (bot - Y(V2) - 2 * s);
    if (B.mat === "wood") { ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cylX + 4, by - s); ctx.lineTo(cylX + 30, top - 8); ctx.stroke(); }
    body(ctx, c, dens.body, cylX, by, s);
    geo.bodyAt = { x: cylX, y: by, r: s + 8 };
  } else if (!geo.dragBody) { body(ctx, c, dens.body, sx + sw / 2, sy - 22, 18); geo.bodyAt = { x: sx + sw / 2, y: sy - 22, r: 26 }; }
  if (geo.dragBody) body(ctx, c, dens.body, geo.dragBody.x, geo.dragBody.y, 18);
  // shisha va shkala
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cylX - cw / 2 - 6, top - 6); ctx.lineTo(cylX - cw / 2, top); ctx.lineTo(cylX - cw / 2, bot); ctx.lineTo(cylX + cw / 2, bot); ctx.lineTo(cylX + cw / 2, top); ctx.stroke();
  ctx.fillRect(cylX - cw / 2 - 12, bot, cw + 24, 6);
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.lineWidth = 1;
  for (let v = 10; v <= cap; v += 10) { const y = Y(v), big = v % 50 === 0; ctx.strokeStyle = c.text3; ctx.beginPath(); ctx.moveTo(cylX - cw / 2, y); ctx.lineTo(cylX - cw / 2 + (big ? 16 : 8), y); ctx.stroke(); if (big) ctx.fillText(String(v), cylX - cw / 2 - 4, y); }
  ctx.textAlign = "left"; ctx.fillText("mL", cylX - cw / 2 - 4, top - 14);
  geo.cyl = { x: cylX - cw / 2 - 10, y: top - 10, w: cw + 20, h: bot - top + 10 };
  // lupa: sath atrofida 2 mL bo'limli shkala
  const lx = cylX + cw / 2 + (narrow ? 14 : 40), lw = narrow ? w - lx - 8 : Math.min(150, w - lx - 180), ly = top + 6, lh = Math.min(150, h - 70);
  if (lw > 60) {
    ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 10); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(lx + 1, ly + 1, lw - 2, lh - 2, 9); ctx.clip();
    const k = lh / 24, Yz = (v) => ly + lh / 2 - (v - V2) * k;
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${c.dark ? 0.3 : 0.35})`; ctx.fillRect(lx, Yz(V2) + 4, lw, lh);
    ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, Yz(V2) - 2); ctx.quadraticCurveTo(lx + lw / 2, Yz(V2) + 8, lx + lw, Yz(V2) - 2); ctx.stroke();
    ctx.strokeStyle = c.text2; ctx.fillStyle = c.text; ctx.lineWidth = 1; ctx.font = MID; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (let v = Math.floor((V2 - 14) / 2) * 2; v <= V2 + 14; v += 2) { const y = Yz(v), big = v % 10 === 0; ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx + (big ? 26 : 14), y); ctx.stroke(); if (big) ctx.fillText(`${v} mL`, lx + 30, y); }
    ctx.restore();
    ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("lupa: bo‘lim 2 mL, sath botiq yuza (menisk) pastidan o‘qiladi", lx, ly + lh + 4);
  }
  // natija
  if (!narrow && w - (lx + lw) > 160) {
    const ix = lx + lw + 18; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = MID; ctx.fillStyle = c.text2;
    const Vr = P.readCylinder(V2) - P.readCylinder(dens.V1);
    [`m = ${fmt(B.m, 1)} g (tarozida)`, `V₁ = ${P.readCylinder(dens.V1)} mL`, dens.inCyl ? `V₂ = ${P.readCylinder(V2)} mL` : "V₂ = ? (jismni soling)", dens.inCyl ? `V = V₂ − V₁ = ${Vr} cm³` : "", dens.inCyl ? `ρ = m/V = ${fmt(B.m / Vr, 2)} g/cm³` : ""].filter(Boolean).forEach((l, k) => ctx.fillText(l, ix, top + 4 + k * 18));
  }
}

/* ------------------------------------------------------------------ 3. Suzish */

function drawFloatStage(ctx, c, w, h) {
  const narrow = w < 560, cx = narrow ? w * 0.42 : w * 0.34, k = floatScale(h), ys = 10 + 9.8 * k, bot = ys + DEPTH * k;
  const tw = Math.min(250, w * 0.46), liq = P.LIQUIDS[fl.liq], cfg = flCfg(), d = cfg.d, read = fl.free ? 0 : P.springReading(cfg);
  const bw = 4 * k, bh = FBODY.H * k, bodyTop = ys + d * k - bh;
  // idish
  ctx.fillStyle = `rgba(${liq.color[0]},${liq.color[1]},${liq.color[2]},${c.dark ? 0.3 : 0.4})`; ctx.fillRect(cx - tw / 2, ys, tw, bot - ys);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - tw / 2, ys - 3 * k); ctx.lineTo(cx - tw / 2, bot); ctx.lineTo(cx + tw / 2, bot); ctx.lineTo(cx + tw / 2, ys - 3 * k); ctx.stroke();
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(`${liq.name}, ρ = ${fmt(liq.rho * 1000, 0)} kg/m³`, cx - tw / 2 + 4, bot - 4);
  // dinamometr
  const dynBot = fl.free ? 22 + 4.5 * k : bodyTop - 0.5 * k, dynH = 4 * k, dynY = Math.max(4, dynBot - dynH - (fl.free ? 0 : 0));
  const pMax = 10, frac = clamp(read / pMax, 0, 1);
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(cx - 22, dynY - dynH * 0.2, 44, dynH, 6); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.font = "500 8px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text3; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  const s0 = dynY - dynH * 0.2 + 8, s1 = dynY + dynH * 0.8 - 8;
  for (let n = 0; n <= pMax; n += 2) { const yy = s0 + (n / pMax) * (s1 - s0); ctx.beginPath(); ctx.moveTo(cx + 4, yy); ctx.lineTo(cx + 12, yy); ctx.stroke(); ctx.fillText(String(n), cx + 2, yy); }
  ctx.fillStyle = c.danger; ctx.fillRect(cx + 4, s0 + frac * (s1 - s0) - 1.5, 12, 3);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, dynY - dynH * 0.2); ctx.lineTo(cx, 0); ctx.stroke();
  geo.dyn = { x: cx - 26, y: dynY - dynH * 0.2 - 6, w: 52, h: dynH + 12 };
  tag(ctx, `${fmt(read, 2)} N`, cx + 24, dynY + dynH * 0.3, { color: c.text, bg: c.bg2, font: BOLD });
  // ip
  const hookY = dynY + dynH * 0.8;
  if (!fl.free) {
    const taut = read > 1e-6; ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, hookY);
    if (taut) ctx.lineTo(cx, bodyTop); else ctx.quadraticCurveTo(cx + 14, (hookY + bodyTop) / 2, cx, bodyTop); ctx.stroke();
  } else { ctx.strokeStyle = c.text3; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx, hookY); ctx.lineTo(cx, hookY + 12); ctx.stroke(); ctx.setLineDash([]); }
  // jism
  const mat = P.MATERIALS[fl.mat];
  ctx.fillStyle = mat.color; ctx.strokeStyle = shade(mat.color, -0.45); ctx.lineWidth = 1.5;
  if (fl.mat === "egg") { ctx.beginPath(); ctx.ellipse(cx, bodyTop + bh / 2, bw / 2, bh / 2, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
  else { ctx.fillRect(cx - bw / 2, bodyTop, bw, bh); ctx.strokeRect(cx - bw / 2, bodyTop, bw, bh); }
  // botgan qism chizig'i
  ctx.strokeStyle = `rgba(${liq.color[0]},${liq.color[1]},${liq.color[2]},0.9)`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - tw / 2, ys); ctx.lineTo(cx + tw / 2, ys); ctx.stroke();
  // kuchlar
  const mid = bodyTop + bh / 2, b = P.buoyancy(cfg), mg = P.weight(cfg.m), Fsc = 56 / Math.max(mg, b.FA, 0.05); // eng katta kuch 56 px
  arrow(ctx, cx - bw / 2 - 16, mid, 0, mg * Fsc, c.danger, { width: 2.5, head: 8, label: "mg" });
  if (b.FA > 1e-4) arrow(ctx, cx + bw / 2 + 16, mid, 0, -b.FA * Fsc, c.primary, { width: 2.5, head: 8, label: "F_A" });
  if (read > 1e-4) arrow(ctx, cx, bodyTop - 2, 0, -read * Fsc, c.success, { width: 2.2, head: 7, label: narrow ? "" : "T" });
  // ma'lumot
  if (narrow) return;
  const ix = cx + tw / 2 + 30; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = "700 14px Inter, system-ui, sans-serif"; ctx.fillStyle = c.text;
  ctx.fillText(`${mat.name} brusok (4×4×5 cm)`, ix, 14);
  ctx.font = MID; ctx.fillStyle = c.text2;
  const fd = P.floatDepth({ m: cfg.m, A: FBODY.A, H: FBODY.H, rhoL: liq.rho });
  [`m = ${fmt(cfg.m, 0)} g, P = mg = ${fmt(mg, 2)} N`, `ρ jism = ${fmt(mat.rho * 1000, 0)} kg/m³`, `ρ suyuqlik = ${fmt(liq.rho * 1000, 0)} kg/m³`, `V_bot = ${fmt(b.Vsub, 1)} cm³ → F_A = ${fmt(b.FA, 3)} N`, fl.free ? "ip kesilgan" : `dinamometr: P − F_A = ${fmt(read, 3)} N`, fd !== null ? `suzadi: ${fmt((fd / FBODY.H) * 100, 0)} % botib` : "cho‘kadi (ρ jism > ρ suyuqlik)"].forEach((l, k2) => ctx.fillText(l, ix, 40 + k2 * 18));
}

/* ------------------------------------------------------------------ Asosiy chizish va grafik */

function draw(ctx, st) {
  const c = st.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "mass") drawMassStage(ctx, c, st.w, st.h);
  else if (ui.mode === "dens") drawDensStage(ctx, c, st.w, st.h);
  else drawFloatStage(ctx, c, st.w, st.h);
}
const heights = () => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(vh * 0.42, 300, 350)), graph: Math.round(clamp(vh * 0.3, 220, 280)) };
};
const stage = createStage($("#stage"), draw, { height: () => heights().stage });

function drawGraphCanvas(ctx, gst) {
  if (ui.mode === "dens") {
    const B = BODIES[dens.body], Vr = P.readCylinder(dens.V1 + B.V) - P.readCylinder(dens.V1);
    return drawTable(ctx, gst, { keys: TABLE_KEYS, measured: dens.inCyl ? B.m / Vr : null, liquid: null, hover: ui.hover });
  }
  if (ui.mode === "float") {
    if (ui.tab === "tab") return drawTable(ctx, gst, { keys: F_MATS.concat(["glass"]).filter((k, i, a) => a.indexOf(k) === i), measured: P.MATERIALS[fl.mat].rho, liquid: flRhoL(), hover: ui.hover });
    return drawForces(ctx, gst, { ...flCfg(), d: fl.free ? flDepth() : fl.d, dMax: 8, hover: ui.hover });
  }
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });

const TABS = {
  mass: {},
  dens: { tab: ["Moddalar zichligi jadvali", "O‘lchangan zichlik (sariq shtrix) jadvaldagi qaysi moddaga eng yaqin? Kursor bilan qiymat o‘qing."] },
  float: { F: ["Kuchlar va botish chuqurligi", "Jism botgan sari Arximed kuchi ortadi va dinamometr ko‘rsatishi kamayadi. To‘liq botgandan keyin ikkalasi ham o‘zgarmaydi. Kursor bilan qiymat o‘qing."], tab: ["Jism va suyuqlik zichligi", "Jism zichligi suyuqlikniki­dan kichik bo‘lsa — suzadi, katta bo‘lsa — cho‘kadi. Ko‘k shtrix — suyuqlik zichligi."] },
};
const TAB_LABEL = { tab: "Zichliklar", F: "F(h)" };
function setTab(tab) {
  const keys = Object.keys(TABS[ui.mode]), card = $(".sim-graph");
  card.hidden = !keys.length; if (!keys.length) return;
  ui.tab = TABS[ui.mode][tab] ? tab : keys[0];
  const t = TABS[ui.mode][ui.tab];
  $("[data-tabs]").innerHTML = keys.length > 1 ? keys.map((k) => `<button type="button" data-tab-value="${k}" aria-pressed="${k === ui.tab}">${TAB_LABEL[k]}</button>`).join("") : "";
  $("[data-graph-title]").textContent = t[0]; $("[data-graph-sub]").textContent = t[1];
  graph.canvas.setAttribute("aria-label", t[0]); ui.hover = null; graph.render();
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

function updateReadouts() {
  if (ui.mode === "mass") {
    const m = bodyM(mass.body), s = panMass(), dm = s - m, bal = P.balanceAngle(dm) === 0;
    setRO("r1", "Chap pallada", BODIES[mass.body].name, "massasi noma’lum — tortib aniqlang");
    setRO("r2", "O‘ng pallada toshlar", u(fmt(s, 1), "g"), mass.pan.length ? mass.pan.map((i) => wLabel(P.WEIGHTS[i])).join(" + ") : "toshlar yo‘q");
    setRO("r3", "Tarozi holati", bal ? "muvozanat" : dm < 0 ? "chap og‘ir" : "o‘ng og‘ir", bal ? "momentlar teng" : dm < 0 ? "tosh qo‘shing" : "eng kichik toshlardan oling", bal ? "orange" : "");
    setRO("r4", "Jism massasi <i>m</i>", bal ? u(fmt(s, 1), "g") : "?", bal ? `= ${fmt(s / 1000, 4)} kg = ${fmt(s * 1000, 0)} mg` : "muvozanatga keltiring");
    setRO("r5", "Tarozi aniqligi", u("50", "mg"), "eng kichik tosh 100 mg");
    setRO("r6", "Og‘irlik <i>P = mg</i>", bal ? u(fmt(P.weight(s), 3), "N") : "?", "g = 9,81 N/kg");
    return;
  }
  if (ui.mode === "dens") {
    const B = BODIES[dens.body], V1 = P.readCylinder(dens.V1), V2 = P.readCylinder(dens.V1 + (dens.inCyl ? B.V : 0)), V = V2 - V1, rho = dens.inCyl && V > 0 ? B.m / V : null, id = rho ? P.identify(rho) : null;
    setRO("r1", "Massa <i>m</i>", u(fmt(B.m, 1), "g"), "elektron tarozida");
    setRO("r2", "Suv hajmi <i>V₁</i>", u(V1, "mL"), "jismsiz");
    setRO("r3", "Suv + jism <i>V₂</i>", dens.inCyl ? u(V2, "mL") : "?", dens.inCyl ? "menzurka shkalasi bo‘yicha" : "jismni menzurkaga soling");
    setRO("r4", "Jism hajmi <i>V</i>", dens.inCyl ? u(V, "cm³") : "?", "V = V₂ − V₁ (1 mL = 1 cm³)");
    setRO("r5", "Zichlik <i>ρ = m/V</i>", rho ? u(fmt(rho, 2), "g/cm³") : "?", rho ? `= ${fmt(rho * 1000, 0)} kg/m³` : "", "orange");
    setRO("r6", "Jadval bo‘yicha", id ? id.mat.name : "?", id ? `${fmt(id.mat.rho, 1)} g/cm³, farqi ${fmt(id.err * 100, 1)} %` : "zichlikni o‘lchang");
    return;
  }
  const cfg = flCfg(), b = P.buoyancy(cfg), mg = P.weight(cfg.m), read = fl.free ? 0 : P.springReading(cfg), fd = P.floatDepth({ m: cfg.m, A: FBODY.A, H: FBODY.H, rhoL: cfg.rhoL });
  setRO("r1", "Havodagi og‘irlik <i>P</i>", u(fmt(mg, 3), "N"), `m = ${fmt(cfg.m, 0)} g`);
  setRO("r2", "Dinamometr", u(fmt(read, 3), "N"), fl.free ? "ip kesilgan" : read < 1e-6 ? "ip bo‘shashgan — jism suzmoqda" : "P − F_A", "orange");
  setRO("r3", "Arximed kuchi <i>F<sub>A</sub></i>", u(fmt(b.FA, 3), "N"), `ρ_s·g·V_bot`);
  setRO("r4", "Botgan hajm <i>V<sub>bot</sub></i>", u(fmt(b.Vsub, 1), "cm³"), `h = ${fmt(cfg.d, 2)} cm (jism 80 cm³)`);
  setRO("r5", "Zichliklar", `${fmt(P.MATERIALS[fl.mat].rho, 2)} / ${fmt(cfg.rhoL, 2)}`, "jism / suyuqlik, g/cm³");
  setRO("r6", "Natija", fd !== null ? "suzadi" : "cho‘kadi", fd !== null ? `${fmt((fd / FBODY.H) * 100, 0)} % botib suzadi (ρ_j/ρ_s)` : `suvda «yengillashadi»: ${fmt((b.FA / mg) * 100, 0)} %`);
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "mass") { const bal = P.balanceAngle(panMass() - bodyM(mass.body)) === 0; t = bal ? "Muvozanat" : "Muvozanatga keltiring"; tone = bal ? "green" : "blue"; }
  else if (ui.mode === "dens") { t = dens.inCyl ? "Hajm o‘lchandi" : "Jismni menzurkaga soling"; tone = dens.inCyl ? "green" : "blue"; }
  else { const fd = P.floatDepth({ m: flM(), A: FBODY.A, H: FBODY.H, rhoL: flRhoL() }); t = fl.free ? (fd !== null ? "Jism suzmoqda" : "Jism cho‘kdi") : flDepth() <= 0 ? "Jism havoda" : "Jism suyuqlikda"; tone = fl.free ? (fd !== null ? "green" : "orange") : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "mass") {
    p.push("<p><b>Massa</b> — jismning inertligi o‘lchovi; SI birligi — kilogramm. Pallali (richagli) tarozida jism massasi ma’lum massali <b>toshlar (gira)</b> bilan taqqoslanadi: elkalar teng bo‘lgani uchun muvozanatda palladagi massalar teng.</p>");
    p.push("<p>Tortish tartibi: avval eng katta toshni qo‘ying; agar o‘ng palla og‘ir bo‘lsa — uni olib, kichikrog‘ini qo‘ying. Shunday qilib kichik toshlargacha davom eting. Massa — barcha toshlar yig‘indisi.</p>");
  } else if (ui.mode === "dens") {
    const B = BODIES[dens.body];
    p.push("<p><b>Zichlik</b> — birlik hajmdagi massa: ρ = m/V. Bir xil moddadan yasalgan jismlarning zichligi bir xil, shuning uchun zichlik bo‘yicha moddani aniqlash mumkin.</p>");
    p.push("<p>Noto‘g‘ri shakldagi jism hajmini <b>menzurka</b> bilan o‘lchaymiz: jism botirilganda suv sathi uning hajmicha ko‘tariladi, V = V₂ − V₁. Shkala bo‘limi 2 mL — o‘lchash xatoligi ±1 mL; kichik jismlarda nisbiy xato kattaroq.</p>");
    if (B.mat === "wood") p.push("<p>Yog‘och suvda suzadi, shuning uchun uni ingichka igna bilan to‘liq botirib hajmini o‘lchaymiz.</p>");
  } else {
    p.push("<p>Suyuqlikka botirilgan jismga yuqoriga yo‘nalgan <b>itaruvchi (Arximed) kuch</b> ta’sir qiladi: u jism siqib chiqargan suyuqlik og‘irligiga teng, F_A = ρ_s·g·V_bot. Shuning uchun dinamometr suvda kamroq ko‘rsatadi.</p>");
    p.push(`<p><b>Suzish sharti</b>: agar jism zichligi suyuqlik zichligidan kichik bo‘lsa — jism suzadi va shunchalik botadiki, F_A = mg bo‘ladi; botgan qism ulushi ρ_jism/ρ_s. ${fl.mat === "ice" ? "Muz suvda 90 % botadi — aysbergning faqat o‘ndan bir qismi ko‘rinadi." : fl.mat === "egg" ? "Tuxum chuchuk suvdan og‘irroq, lekin to‘yingan sho‘r suvdan yengil — sho‘r suvda suzadi." : ""}</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "mass" ? "<small>Tarozi</small> m<sub>jism</sub> = Σ m<sub>tosh</sub>" : ui.mode === "dens" ? "<small>Zichlik</small> ρ = m/V" : "<small>Arximed kuchi</small> F<sub>A</sub> = ρ<sub>s</sub>gV";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); if (!$(".sim-graph").hidden) graph.render(); }

/* ------------------------------------------------------------------ Vaqt (tarozi tebranishi, jism tushishi, erkin jism) */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  let moving = false;
  if (ui.mode === "mass") {
    const target = P.balanceAngle(panMass() - bodyM(mass.body));
    mass.w += (-(mass.th - target) * 60 - mass.w * 5) * dt; mass.th += mass.w * dt;
    moving = Math.abs(mass.th - target) > 1e-4 || Math.abs(mass.w) > 1e-3;
    if (!moving) { mass.th = target; mass.w = 0; }
  } else if (ui.mode === "dens") {
    if (dens.inCyl && dens.drop > 0) { dens.drop = Math.max(0, dens.drop - dt * 1.6); moving = true; }
  } else if (fl.free) {
    const cfg = { m: flM(), A: FBODY.A, H: FBODY.H, rhoL: flRhoL() }, mkg = cfg.m / 1000;
    const Fnet = P.weight(cfg.m) - P.buoyancy({ ...cfg, d: fl.y }).FA; // pastga musbat
    fl.v += ((Fnet / mkg) * 100 - fl.v * 24) * dt * 0.25; // cm/s, sekinlashtirilgan; suyuqlik qarshiligi (so'nish ≈ 0,4)
    fl.y += fl.v * dt;
    if (fl.y > DEPTH) { fl.y = DEPTH; fl.v = 0; } // tubga yetdi
    if (fl.y < 0 && fl.v < 0) { fl.y = 0; fl.v = 0; }
    moving = Math.abs(fl.v) > 0.01 || Math.abs(Fnet) > 1e-3 && fl.y < DEPTH;
  }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.12) { uiTimer = 0; refresh(); }
  if (!moving) { loop.stop(); refresh(); }
}, { onStateChange: setPlayUI });
const kick = () => { if (prefersReducedMotion()) { settle(); refresh(); } else loop.start(); };
function settle() {
  mass.th = P.balanceAngle(panMass() - bodyM(mass.body)); mass.w = 0; dens.drop = 0;
  if (fl.free) { const fd = P.floatDepth({ m: flM(), A: FBODY.A, H: FBODY.H, rhoL: flRhoL() }); fl.y = fd !== null ? fd : DEPTH; fl.v = 0; }
}
const playBtn = $("[data-play]");
function setPlayUI(on) {
  running = on;
  playBtn.hidden = true; // bu sahifada animatsiya o'zi boshqariladi
}
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "mass") mass.pan = [];
  else if (ui.mode === "dens") { dens.inCyl = false; dens.drop = 0; }
  else { fl.free = false; fl.d = 0; fl.y = 0; fl.v = 0; fDC.set(0); }
  kick(); refresh();
});

/* ------------------------------------------------------------------ Boshqaruv */

const bodySel = $("#body");
bodySel.innerHTML = Object.entries(BODIES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("");
bodySel.addEventListener("change", () => { customized(); if (ui.mode === "mass") { mass.body = bodySel.value; mass.pan = []; } else { dens.body = bodySel.value; dens.inCyl = false; } kick(); refresh(); });
const wBox = $("[data-weights]");
wBox.innerHTML = P.WEIGHTS.map((wg, i) => `<button class="sim-preset" type="button" data-w="${i}" aria-pressed="false">${wLabel(wg)}</button>`).join("");
wBox.addEventListener("click", (e) => { const b = e.target.closest("[data-w]"); if (!b) return; toggleWeight(+b.dataset.w); });
function toggleWeight(i) { customized(); if (mass.pan.includes(i)) mass.pan = mass.pan.filter((x) => x !== i); else mass.pan.push(i); syncWeights(); kick(); refresh(); }
const syncWeights = () => document.querySelectorAll("[data-w]").forEach((b) => b.setAttribute("aria-pressed", String(mass.pan.includes(+b.dataset.w))));
$("[data-clear-weights]").addEventListener("click", () => { mass.pan = []; customized(); syncWeights(); kick(); refresh(); });
const v1C = bindRange($("#v1"), $("#v1Out"), (v) => `${fmt(v, 0)} mL`, (v) => { dens.V1 = v; customized(); refresh(); });
const fMat = $("#fMat"), fLiq = $("#fLiq");
fMat.innerHTML = F_MATS.map((k) => `<option value="${k}">${P.MATERIALS[k].name} (${fmt(P.MATERIALS[k].rho * 1000, 0)} kg/m³)</option>`).join("");
fLiq.innerHTML = Object.entries(P.LIQUIDS).map(([k, v]) => `<option value="${k}">${v.name} (${fmt(v.rho * 1000, 0)} kg/m³)</option>`).join("");
fMat.addEventListener("change", () => { fl.mat = fMat.value; customized(); if (fl.free) kick(); refresh(); });
fLiq.addEventListener("change", () => { fl.liq = fLiq.value; customized(); if (fl.free) kick(); refresh(); });
const fDC = bindRange($("#fD"), $("#fDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { if (fl.free) { fl.free = false; } fl.d = v; customized(); refresh(); });
$("[data-cut]").addEventListener("click", () => { customized(); if (fl.free) { fl.free = false; fl.d = 0; fDC.set(0); refresh(); return; } fl.free = true; fl.y = flDepth(); fl.v = 0; kick(); refresh(); });
function syncCut() { $("[data-cut]").textContent = fl.free ? "Jismni qayta osish" : "Ipni kesish"; }

/* Sahnada: toshlar, jism, dinamometr */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inR = (p, r) => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
function hit(p) {
  if (ui.mode === "mass") {
    const pi = (geo.panItems || []).find((q) => inR(p, { x: q.x - 2, y: q.y - 4, w: q.w + 4, h: q.h + 8 })); if (pi) return { kind: "panW", i: pi.i };
    const bi = (geo.box || []).find((q) => inR(p, q)); if (bi) return { kind: "boxW", i: bi.i, x0: p.x, y0: p.y };
  } else if (ui.mode === "dens") { const b = geo.bodyAt; if (b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r) return { kind: "body" }; }
  else if (inR(p, geo.dyn)) return { kind: "dyn", y0: p.y, d0: fl.free ? 0 : fl.d };
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return;
  drag = h; customized(); e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  canvas.dataset.dragging = "true";
  if (h.kind === "panW") { toggleWeight(h.i); drag = null; }
  if (h.kind === "dyn" && fl.free) { fl.free = false; fl.d = 0; drag.d0 = 0; syncCut(); }
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (!drag) { const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "dyn" ? "ns-resize" : h.kind === "panW" ? "pointer" : "grab"; return; }
  if (drag.kind === "boxW") { if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > 4) drag.moved = true; geo.dragW = { i: drag.i, x: p.x, y: p.y + 8 }; stage.render(); }
  else if (drag.kind === "body") { geo.dragBody = { x: p.x, y: p.y }; stage.render(); }
  else if (drag.kind === "dyn") { const k = floatScale(stage.h); fl.d = clamp(Math.round((drag.d0 + (p.y - drag.y0) / k) * 10) / 10, 0, 8); fDC.set(fl.d); refresh(); }
});
function endDrag(e) {
  if (!drag) return;
  const p = e ? ptr(canvas, e) : null;
  if (drag.kind === "boxW") { if (!drag.moved || (p && inR(p, geo.pan))) toggleWeight(drag.i); geo.dragW = null; stage.render(); }
  else if (drag.kind === "body") {
    const into = p && inR(p, geo.cyl);
    if (into && !dens.inCyl) { dens.inCyl = true; dens.drop = 1; kick(); }
    else if (!into && dens.inCyl && p) { dens.inCyl = false; dens.drop = 0; }
    geo.dragBody = null; refresh();
  }
  drag = null; canvas.dataset.dragging = "false";
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", () => { geo.dragW = null; geo.dragBody = null; drag = null; stage.render(); });

/* Grafikda kursor */
const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => {
  const f = lastFrame(); if (!f) return;
  const p = ptr(gcv, e), r = f.rect;
  ui.hover = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y - 10 && p.y <= r.y + r.h + 10 ? (ui.tab === "F" ? ((p.x - r.x) / r.w) * f.xMax : (p.x - r.x) / r.w) : null;
  gcv.style.cursor = ui.hover !== null ? "crosshair" : ""; graph.render();
});
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  weigh: { mode: "mass", title: "Mis silindrni tortish", lesson: "Chap pallada mis silindr. Toshlarni qutidan o‘ng pallaga suring: avval 100 g — palla og‘irlashsa, oling va 50 g qo‘ying va hokazo. Tarozi muvozanatga kelganda massani yozing.", set: () => Object.assign(mass, { body: "cu", pan: [] }) },
  weighSmall: { mode: "mass", title: "Po‘lat sharcha: milligrammlar", lesson: "Sharcha massasi butun grammga teng emas — milligrammli toshlar (500, 200, 100 mg) ham kerak bo‘ladi. Tarozi 50 mg dan kichik farqni sezmaydi.", set: () => Object.assign(mass, { body: "st", pan: [] }) },
  weighDone: { mode: "mass", title: "Tortilgan: granit bo‘lagi", lesson: "Granit bo‘lagi tortilgan: 50 + 20 + 5 + 2 + 1 = 78 g. Bitta toshni olib ko‘ring — tarozi og‘adi.", set: () => Object.assign(mass, { body: "gr", pan: [1, 2, 5, 6, 8] }) },
  copper: { mode: "dens", title: "Mis silindr zichligi", lesson: "Silindr massasi 89,0 g. Uni menzurkaga suring: suv sathi 100 mL dan 110 mL ga ko‘tariladi. ρ = 89 / 10 = 8,9 g/cm³ — jadvalda mis.", set: () => Object.assign(dens, { body: "cu", V1: 100, inCyl: false }) },
  alu: { mode: "dens", title: "Alyuminiy brusok", lesson: "54 g, hajmi menzurkada o‘lchanadi. ρ = 2,7 g/cm³ = 2700 kg/m³.", set: () => Object.assign(dens, { body: "al", V1: 80, inCyl: true, drop: 0 }) },
  stone: { mode: "dens", title: "Noto‘g‘ri shakldagi jism: granit", lesson: "Toshning hajmini chizg‘ich bilan o‘lchab bo‘lmaydi — menzurka yordam beradi. 78 g / 30 cm³ = 2,6 g/cm³ — granit.", set: () => Object.assign(dens, { body: "gr", V1: 100, inCyl: false }) },
  unknown: { mode: "dens", title: "Noma’lum metall: moddani aniqlang", lesson: "Massa va hajmni o‘lchab zichlikni hisoblang va jadvaldan moddani toping. Bu — darslikdagi «Jismlar zichligini aniqlash» laboratoriya ishining tartibi.", set: () => Object.assign(dens, { body: "unk", V1: 100, inCyl: false }) },
  zinc: { mode: "dens", title: "Shkala bo‘limi va xatolik", lesson: "Rux bo‘lagining hajmi 9 cm³, lekin menzurka bo‘limi 2 mL: o‘qilgan hajm 8 yoki 10 mL bo‘ladi va zichlik 10 % gacha xato chiqadi. Kichik jismlar uchun bo‘limi kichik menzurka kerak.", set: () => Object.assign(dens, { body: "zn", V1: 100, inCyl: true, drop: 0 }) },
  wood: { mode: "dens", title: "Yog‘och: igna bilan botirish", lesson: "Yog‘och suzadi, shuning uchun u igna bilan to‘liq botirilgan. 24 g / 48 cm³ = 0,5 g/cm³ — suvdan yengil.", set: () => Object.assign(dens, { body: "wd", V1: 100, inCyl: true, drop: 0 }) },
  archimedes: { mode: "float", title: "Arximed kuchi: alyuminiy suvda", lesson: "Havoda dinamometr 2,12 N ko‘rsatadi. Dinamometrni pastga suring: jism botgan sari ko‘rsatish kamayadi. To‘liq botganda 0,78 N ga kamaydi — bu siqib chiqarilgan 80 cm³ suv og‘irligi.", set: () => Object.assign(fl, { mat: "alu", liq: "water", d: 3, free: false }), tab: "F" },
  kerosene: { mode: "float", title: "Kerosinda Arximed kuchi kichik", lesson: "Xuddi shu brusok kerosinda: suyuqlik zichligi 800 kg/m³ — Arximed kuchi 20 % kichik, dinamometr ko‘proq ko‘rsatadi.", set: () => Object.assign(fl, { mat: "alu", liq: "kerosene", d: 6, free: false }), tab: "F" },
  woodFloat: { mode: "float", title: "Yog‘och suzadi", lesson: "Yog‘och brusok suvda yarmigacha botib suzadi: ip bo‘shashdi, dinamometr nolni ko‘rsatadi. «Ipni kesish» ni bosing.", set: () => Object.assign(fl, { mat: "wood", liq: "water", d: 5, free: false }) },
  ice: { mode: "float", title: "Muz: aysberg", lesson: "Muz zichligi 900 kg/m³ — suvda 90 % botib suzadi. Ip kesildi.", set: () => Object.assign(fl, { mat: "ice", liq: "water", d: 0, free: true, y: 0, v: 0 }) },
  egg: { mode: "float", title: "Tuxum: chuchuk va sho‘r suv", lesson: "Tuxum chuchuk suvda cho‘kadi. Suyuqlikni «Sho‘r suv (to‘yingan)» ga almashtiring — tuxum qalqib chiqadi.", set: () => Object.assign(fl, { mat: "egg", liq: "water", d: 0, free: true, y: 0, v: 0 }), tab: "tab" },
  mercury: { mode: "float", title: "Po‘lat simobda suzadi", lesson: "Simob zichligi 13 600 kg/m³ — po‘latdan ham, misdan ham katta. Shuning uchun temir buyumlar simobda suzadi, qo‘rg‘oshin ham.", set: () => Object.assign(fl, { mat: "steel", liq: "mercury", d: 0, free: true, y: 0, v: 0 }), tab: "tab" },
};
const GROUPS = [["Massa: tarozi", ["weigh", "weighSmall", "weighDone"]], ["Zichlik: menzurka", ["copper", "alu", "stone", "unknown", "zinc", "wood"]], ["Suzish", ["archimedes", "kerosene", "woodFloat", "ice", "egg", "mercury"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } syncCut(); }

const MODE_HINT = { mass: "Toshlarni o‘ng pallaga suring", dens: "Jismni menzurkaga suring", float: "Dinamometrni pastga suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { mass: "Pallali tarozi va toshlar qutisi", dens: "Elektron tarozi va suvli menzurka, lupa", float: "Dinamometrga osilgan brusok va suyuqlikli idish" }[ui.mode]);
}
function syncAll() { bodySel.value = ui.mode === "mass" ? mass.body : dens.body; syncWeights(); v1C.set(dens.V1); fMat.value = fl.mat; fLiq.value = fl.liq; fDC.set(fl.d); syncCut(); }
const MODE_DEFAULT = { mass: "weigh", dens: "copper", float: "archimedes" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null; geo.dragW = null; geo.dragBody = null;
  ui.mode = p.mode; p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || Object.keys(TABS[ui.mode])[0]);
  settle(); if (ui.mode === "mass") { mass.th = 0; }
  if (fl.free && ui.mode === "float") { fl.y = 0; fl.v = 0; }
  kick(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "weigh");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
