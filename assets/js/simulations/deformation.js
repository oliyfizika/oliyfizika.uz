// ==========================================================================
// Qattiq jism deformatsiyasi — simulyatsiya (simulations/deformation.html)
// 1) Cho'zish mashinasi: d = 10 mm, l₀ = 100 mm namuna (po'lat, mis, alyuminiy, cho'yan) ikki qisqich orasida.
//    Pultdagi dastak (jog) bilan yuklash/yuksizlantirish, «Avto», «Yukni olish», «Yangi namuna».
//    Kuch datchigi va ekstenzometr (LCD), bo'yin hosil bo'lishi, uzilish. Grafik — σ(ε) diagrammasi.
// 2) Guk qonuni: shiftga mahkamlangan uzun sim, osmaga 1 kg li yuklar qo'yiladi, uzayishni indikator soati
//    (0,01 mm) o'lchaydi. Grafik F(Δl), o'lchangan nuqtalar bo'yicha k va E.
// 3) Deformatsiya turlari: cho'zilish, siqilish, siljish, egilish, buralish — to'rli jism, tutqichni surish,
//    elastik (rezina), plastik (plastilin), elastik-plastik (po'lat) materiallar.
// Fizika: deformation-physics.js (Node'da tekshirilgan: t_deformation.mjs).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, arrow, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { chipBtn, lcd, noise } from "./labkit.js";
import * as P from "./deformation-physics.js";
import { drawSE, drawHooke, lastFrame, niceStrain, fitK } from "./deformation-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const MPa = 1e6;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "tension", hover: null };
const D0 = 0.01, L0 = 0.1, S0 = P.area(D0);
const tn = { mat: "steel", s: 0, e: 0, sample: P.createSample(), path: [[0, 0]], auto: false, unload: false, lever: 0, xMax: 0.25 };
const hk = { mat: "steel", d: 0.8e-3, L: 2, mass: 0, sample: P.createSample(), e: 0, shown: 0, pts: [], fall: 0 };
const ty = { kind: "stretch", mat: "rubber", d: 0, res: 0, held: false };
let presetId = null, playing = true;
const geo = {};

const tm = () => P.MATERIALS[tn.mat];
const hm = () => P.MATERIALS[hk.mat];
const eOf = (s) => tm().ef * (s / 1000) ** 3;
const sOf = (e) => 1000 * Math.cbrt(clamp(e / tm().ef, 0, 1));
const tStress = () => P.stressAt(tn.sample, tm(), tn.e);
const hS = () => P.area(hk.d);
const hF = () => hk.mass * P.G;
const kTh = () => P.stiffness(hm().E, hS(), hk.L) / 1000; // N/mm
const dlRead = () => hk.e * hk.L * 1000 + (hk.mass > 0 || hk.e > 0 ? noise(hk.mass * 7.3, hk.d * 1e4 + hk.L) * 0.006 : 0);
const TMAT = {
  rubber: { name: "rezina", lim: 1, note: "elastik: kuch olinsa to‘liq tiklanadi", fill: ["#fca5a5", "#b91c1c"] },
  clay: { name: "plastilin", lim: 0.03, note: "plastik: shakli deyarli o‘zgarmay qoladi", fill: ["#86efac", "#15803d"] },
  steel: { name: "po‘lat", lim: 0.4, note: "elastik-plastik: chegaradan oshsa qoldiq qoladi", fill: ["#e2e8f0", "#475569"] },
};
const KIND = {
  stretch: { name: "Cho‘zilish", measure: "ε", life: "arqon, tros, ko‘tarma kran ilgagi, osma ko‘prik troslari" },
  compress: { name: "Siqilish", measure: "ε", life: "bino ustunlari va poydevori, stol oyoqlari" },
  shear: { name: "Siljish", measure: "γ", life: "parchin mix va boltlar, qaychi bilan kesish" },
  bend: { name: "Egilish", measure: "f", life: "ko‘prik to‘sinlari, tokcha, trampin taxtasi" },
  twist: { name: "Buralish", measure: "φ", life: "avtomobil vallari, vint va shurup burash, burama kalit" },
};

/* ------------------------------------------------------------------ 1. Cho'zish mashinasi */

function metalGrad(ctx, x0, x1, col) { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, col[1]); g.addColorStop(0.4, col[0]); g.addColorStop(1, col[2]); return g; }
function chrome(ctx, x0, x1) { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, "#64748b"); g.addColorStop(0.45, "#f1f5f9"); g.addColorStop(1, "#94a3b8"); return g; }

/** Namuna: chap chekka x, y0 dan pastga; width(y) funksiyasi; [ya, yb] oraliq */
function sampleBody(ctx, cx, ya, yb, wAt, fill) {
  const n = 60; ctx.beginPath();
  for (let i = 0; i <= n; i++) { const y = ya + ((yb - ya) * i) / n; ctx.lineTo(cx - wAt(y) / 2, y); }
  for (let i = n; i >= 0; i--) { const y = ya + ((yb - ya) * i) / n; ctx.lineTo(cx + wAt(y) / 2, y); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function grip(ctx, c, cx, y, W, H, up) {
  ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.roundRect(cx - W / 2, y, W, H, 3); ctx.fill();
  ctx.fillStyle = "#64748b"; ctx.fillRect(cx - W / 2 + 4, y + 3, W - 8, H - 6);
  ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1; for (let k = 0; k < 5; k++) { const yy = y + 5 + (k * (H - 10)) / 4; ctx.beginPath(); ctx.moveTo(cx - W / 2 + 6, yy); ctx.lineTo(cx - 6, yy + (up ? -3 : 3)); ctx.moveTo(cx + W / 2 - 6, yy); ctx.lineTo(cx + 6, yy + (up ? -3 : 3)); ctx.stroke(); }
}
function drawTension(ctx, c, w, h) {
  const narrow = w < 560, m = tm(), s = tn.sample, sig = tStress(), F = sig * S0;
  const mx = narrow ? Math.round(w * 0.3) : Math.round(w * 0.3), colX = narrow ? 50 : 76, base = h - 16;
  const yTop = 14, chH = 22, cellH = 14, gripH = 24, headH = 16, fil = 8;
  const L0px = Math.min(narrow ? 120 : 150, (base - yTop - chH - cellH - 2 * gripH - 2 * fil - 22 - 8) / (1 + m.ef + 0.02));
  const W0 = narrow ? 14 : 18, Wh = W0 * 1.7;
  // asos va kolonnalar (yo'naltiruvchi vintlar)
  ctx.fillStyle = c.dark ? "#1e293b" : "#cbd5e1"; ctx.beginPath(); ctx.roundRect(mx - colX - 30, base, 2 * colX + 60, 16, 4); ctx.fill();
  ctx.fillStyle = "#1d4ed8"; ctx.fillRect(mx - colX - 30, base + 4, 2 * colX + 60, 3);
  for (const sx of [-1, 1]) {
    const x = mx + sx * colX; ctx.fillStyle = chrome(ctx, x - 6, x + 6); ctx.fillRect(x - 6, yTop, 12, base - yTop);
    ctx.strokeStyle = "rgba(51,65,85,0.35)"; ctx.lineWidth = 1; for (let y = yTop + 30; y < base; y += 5) { ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y + 2); ctx.stroke(); }
  }
  // yuqori traversa + kuch datchigi
  const trav = (y) => { ctx.fillStyle = "#1e3a8a"; ctx.beginPath(); ctx.roundRect(mx - colX - 14, y, 2 * colX + 28, chH, 4); ctx.fill(); ctx.fillStyle = "#3b82f6"; ctx.fillRect(mx - colX - 14, y + 3, 2 * colX + 28, 3); };
  trav(yTop);
  ctx.fillStyle = chrome(ctx, mx - 15, mx + 15); ctx.fillRect(mx - 15, yTop + chH, 30, cellH);
  if (!narrow) { ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("kuch datchigi", mx + 20, yTop + chH + cellH / 2); }
  const yG1 = yTop + chH + cellH, yA = yG1 + gripH + fil;
  // namuna geometriyasi
  const eShow = s.broken ? s.emax : tn.e, uni = m.brittle ? 0 : Math.min(s.emax, m.eu), Wu = W0 / Math.sqrt(1 + uni);
  const neckF = !m.brittle && s.emax > m.eu ? (s.emax - m.eu) / (m.ef - m.eu) : 0;
  const Lpx = L0px * (1 + eShow), yB = yA + Lpx, yc = (yA + yB) / 2, nw = L0px * 0.09;
  const wGauge = (y) => Wu * (1 - 0.42 * neckF * Math.exp(-(((y - yc) / nw) ** 2)));
  const wAt = (y) => (y < yA ? Wu + (Wh - Wu) * Math.min(1, (yA - y) / fil) ** 2 : y > yB ? Wu + (Wh - Wu) * Math.min(1, (y - yB) / fil) ** 2 : wGauge(y));
  const yG2 = yB + fil, yC = yG2 + gripH;
  // pastki traversa
  trav(yC);
  geo.cross = { y: yC, x0: mx - colX - 14, x1: mx + colX + 14 };
  const fill = metalGrad(ctx, mx - Wh / 2, mx + Wh / 2, m.color);
  if (s.broken) {
    const gap = m.brittle ? 6 : 10, yb1 = yc - gap / 2, yb2 = yc + gap / 2;
    sampleBody(ctx, mx, yG1 + 4, yb1, (y) => (y < yA ? wAt(y) : wGauge(y + gap / 2)), fill);
    sampleBody(ctx, mx, yb2, yG2 + gripH - 4, (y) => (y > yB ? wAt(y) : wGauge(y - gap / 2)), fill);
    ctx.strokeStyle = c.danger; ctx.lineWidth = 1.4; for (const yy of [yb1, yb2]) { const ww = wGauge(yc) / 2; ctx.beginPath(); ctx.moveTo(mx - ww, yy); for (let k = 1; k <= 6; k++) ctx.lineTo(mx - ww + (k * 2 * ww) / 6, yy + (k % 2 ? 2 : -2) * (yy < yc ? 1 : -1)); ctx.stroke(); }
  } else sampleBody(ctx, mx, yG1 + 4, yG2 + gripH - 4, wAt, fill);
  // kerner belgilari (l₀ chegaralari)
  ctx.strokeStyle = c.dark ? "#0f172a" : "#1e293b"; ctx.lineWidth = 1.4;
  for (const yy of [yA, yB]) { const ww = wAt(yy) / 2; ctx.beginPath(); ctx.moveTo(mx - ww, yy); ctx.lineTo(mx - ww + 5, yy); ctx.moveTo(mx + ww - 5, yy); ctx.lineTo(mx + ww, yy); ctx.stroke(); }
  grip(ctx, c, mx, yG1, Wh + 18, gripH, true);
  grip(ctx, c, mx, yG2, Wh + 18, gripH, false);
  // o'lcham chizig'i
  const dx = mx - Wh / 2 - 22;
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(dx, yA); ctx.lineTo(dx, yB); ctx.moveTo(dx - 4, yA); ctx.lineTo(dx + 4, yA); ctx.moveTo(dx - 4, yB); ctx.lineTo(dx + 4, yB); ctx.stroke();
  const lmm = 100 * (1 + (s.broken ? P.residual(s) : tn.e));
  ctx.save(); ctx.translate(dx - 8, yc); ctx.rotate(-Math.PI / 2); ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(s.broken ? `l = ${fmt(lmm, 1)} mm` : tn.e < 0.002 ? "l₀ = 100 mm" : `l = ${fmt(lmm, 1)} mm`, 0, 0); ctx.restore();
  // kuch strelkalari
  if (!s.broken && F > 50) { const L = 10 + 26 * (sig / m.su); arrow(ctx, mx + Wh / 2 + 18, yC + chH + 4, 0, L, c.danger, { width: 2.2, head: 7 }); }
  if (neckF > 0.02 && !s.broken && !narrow) tag(ctx, "bo‘yin", mx + Wh / 2 + 6, yc, { color: c.warning, bg: c.bg2, font: SMALL, pad: 4 });
  if (s.broken) tag(ctx, m.brittle ? "mo‘rt uzilish" : "uzildi", mx + Wh / 2 + 8, yc, { color: "#fff", bg: c.danger, font: BOLD });
  // boshqaruv pulti
  const px0 = narrow ? Math.round(w * 0.56) : Math.round(w * 0.58), pw = w - px0 - (narrow ? 6 : 14), py0 = 8, ph = h - 16;
  ctx.fillStyle = c.dark ? "#1e293b" : "#e2e8f0"; ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 10); ctx.fill();
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.stroke();
  const ip = px0 + 8, iw = pw - 16, lh = narrow ? 46 : 46;
  lcd(ctx, ip, py0 + 8, iw, lh, "Kuch F", F >= 1000 ? fmt(F / 1000, 2) : fmt(F, 0), F >= 1000 ? "kN" : "N");
  lcd(ctx, ip, py0 + 14 + lh, iw, lh, "Uzayish Δl", fmt((s.broken ? P.residual(s) : tn.e) * 100, tn.e < 0.01 && !s.broken ? 3 : 2), "mm", "#fbbf24");
  if (!narrow) lcd(ctx, ip, py0 + 20 + 2 * lh, iw, lh, "Kuchlanish σ = F/S", fmt(sig / MPa, 0), "MPa", "#7dd3fc");
  // dastak
  const ly0 = py0 + (narrow ? 22 + 2 * lh : 28 + 3 * lh), ly1 = py0 + ph - 74, lx = ip + (narrow ? 22 : 30), lmid = (ly0 + ly1) / 2;
  ctx.fillStyle = c.dark ? "#0f172a" : "#94a3b8"; ctx.beginPath(); ctx.roundRect(lx - 5, ly0, 10, ly1 - ly0, 5); ctx.fill();
  const ky = lmid + tn.lever * (ly1 - ly0) / 2 * 0.92;
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(lx, lmid); ctx.lineTo(lx, ky); ctx.stroke();
  ctx.fillStyle = c.danger; ctx.beginPath(); ctx.arc(lx, ky, 11, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.arc(lx - 3, ky - 3, 4, 0, TAU); ctx.fill();
  geo.lever = { x: lx, y: ky, y0: ly0, y1: ly1, mid: lmid };
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText("↑ bo‘shatish", lx + 16, ly0 + 6); ctx.fillText("↓ cho‘zish", lx + 16, ly1 - 6);
  if (!narrow) ctx.fillText("dastak", lx + 16, lmid);
  const bw = iw, by = py0 + ph - 66;
  geo.auto = chipBtn(ctx, c, ip, by, tn.auto ? "■ Avto to‘xtat" : "▶ Avto-yuklash", tn.auto, narrow ? bw : bw / 2 - 3, 24, c.primary);
  geo.unl = chipBtn(ctx, c, narrow ? ip : ip + bw / 2 + 3, narrow ? by + 28 : by, "Yukni olish", tn.unload, narrow ? bw : bw / 2 - 3, 24, c.warning);
  if (!narrow) geo.fresh = chipBtn(ctx, c, ip, by + 30, "Yangi namuna", false, bw, 24);
  else geo.fresh = s.broken ? chipBtn(ctx, c, 6, 6, "Yangi namuna", true, 100, 24, c.primary) : null;
  ctx.font = SMALL; ctx.fillStyle = c.text3; ctx.textAlign = "left"; ctx.textBaseline = "top";
  if (!narrow) ctx.fillText(`${m.full}, d = 10 mm`, 10, h - 14 > base ? base + 2 : 4);
}

/* ------------------------------------------------------------------ 2. Guk qonuni: sim */

function disk(ctx, cx, y, W, H, half) {
  const g = ctx.createLinearGradient(cx - W / 2, 0, cx + W / 2, 0); g.addColorStop(0, "#475569"); g.addColorStop(0.4, "#cbd5e1"); g.addColorStop(1, "#334155");
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - W / 2, y, W, H, 2); ctx.fill();
  ctx.fillStyle = "#1e293b"; ctx.fillRect(cx - 2, y, 4, H);
  if (!half && H >= 7) { ctx.fillStyle = "#0f172a"; ctx.font = "700 7px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("1 kg", cx + W * 0.27, y + H / 2 + 0.5); }
}
function dial(ctx, c, cx, cy, R, mm) {
  ctx.save();
  ctx.fillStyle = "#94a3b8"; ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, TAU); ctx.fill();
  ctx.fillStyle = "#e2e8f0"; ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fffef7"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#1e293b"; ctx.fillStyle = "#1e293b"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `700 ${R > 40 ? 9 : 7}px Inter, system-ui, sans-serif`;
  for (let k = 0; k < 100; k++) { const a = -Math.PI / 2 + (k / 100) * TAU, maj = k % 10 === 0, r0 = R - (maj ? 9 : k % 5 === 0 ? 6 : 4); ctx.lineWidth = maj ? 1.3 : 0.7; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (R - 1), cy + Math.sin(a) * (R - 1)); ctx.stroke(); if (maj && R > 30) ctx.fillText(`${k}`, cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16)); }
  // kichik shkala (mm hisoblagich)
  const r2 = R * 0.26, c2y = cy + R * 0.38;
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(cx, c2y, r2, 0, TAU); ctx.stroke();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k / 10) * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r2 * 0.7, c2y + Math.sin(a) * r2 * 0.7); ctx.lineTo(cx + Math.cos(a) * r2, c2y + Math.sin(a) * r2); ctx.stroke(); }
  const a2 = -Math.PI / 2 + (Math.max(0, mm) / 10) * TAU; ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx, c2y); ctx.lineTo(cx + Math.cos(a2) * r2 * 0.85, c2y + Math.sin(a2) * r2 * 0.85); ctx.stroke();
  ctx.font = "600 7px Inter, system-ui, sans-serif"; ctx.fillStyle = "#475569"; if (R > 30) ctx.fillText("0,01 mm", cx, cy - R * 0.36);
  const a = -Math.PI / 2 + ((mm % 1 + 1) % 1) * TAU;
  ctx.strokeStyle = "#b91c1c"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 10, cy - Math.sin(a) * 10); ctx.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)); ctx.stroke();
  ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawHookeScene(ctx, c, w, h) {
  const narrow = w < 560, m = hm(), floor = h - 14, s = hk.sample;
  const wx = narrow ? Math.round(w * 0.42) : Math.round(w * 0.36), top = 22, DW = narrow ? 40 : 48, R = narrow ? 34 : 46, dx = wx + DW / 2 + R + 10;
  // shift va kronshteyn
  ctx.fillStyle = c.dark ? "#334155" : "#94a3b8"; ctx.fillRect(0, 0, w, 10);
  ctx.strokeStyle = c.dark ? "#475569" : "#64748b"; ctx.lineWidth = 1; for (let x = -10; x < w; x += 10) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x + 8, 0); ctx.stroke(); }
  ctx.fillStyle = "#334155"; ctx.fillRect(wx - 16, 10, 32, 10); ctx.fillStyle = "#64748b"; ctx.beginPath(); ctx.arc(wx, 22, 5, 0, TAU); ctx.fill();
  // pol
  ctx.fillStyle = c.dark ? "#3f2d1d" : "#d6b98c"; ctx.fillRect(0, floor, w, h - floor);
  const Lmax = floor - top - 150, Lpx = Lmax * (hk.L / 3);
  const yClamp = top + Lpx;
  const col = m.color, wd = clamp(hk.d * 2600, 1.2, 3.2);
  const broken = s.broken;
  // sim
  ctx.strokeStyle = metalGrad(ctx, wx - wd, wx + wd, col); ctx.lineWidth = wd;
  if (!broken) { ctx.beginPath(); ctx.moveTo(wx, top); ctx.lineTo(wx, yClamp); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(wx, top); ctx.lineTo(wx + 2, yClamp - 30); ctx.stroke(); }
  // masshtab: uzunlik
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; const lx = wx - 30; ctx.beginPath(); ctx.moveTo(lx, top); ctx.lineTo(lx, yClamp); ctx.moveTo(lx - 4, top); ctx.lineTo(lx + 4, top); ctx.moveTo(lx - 4, yClamp); ctx.lineTo(lx + 4, yClamp); ctx.stroke();
  ctx.save(); ctx.translate(lx - 6, (top + yClamp) / 2); ctx.rotate(-Math.PI / 2); ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(`l₀ = ${fmt(hk.L, 1)} m, d = ${fmt(hk.d * 1000, 1)} mm`, 0, 0); ctx.restore();
  // pastki qisqich + ko'rsatkich plastinasi + osma
  const fall = hk.fall, cy0 = broken ? Math.min(yClamp + fall, floor - 92) : yClamp;
  ctx.fillStyle = "#475569"; ctx.fillRect(wx - 9, cy0, 18, 14); ctx.fillStyle = "#cbd5e1"; ctx.fillRect(wx + 9, cy0 + 4, dx + 4 - wx - 9, 5);
  geo.plate = { x: dx, y: cy0 + 9 };
  ctx.strokeStyle = "#64748b"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(wx, cy0 + 14); ctx.lineTo(wx, cy0 + 30); ctx.stroke();
  ctx.fillStyle = "#334155"; ctx.fillRect(wx - 22, cy0 + 30, 44, 4);
  const nFull = Math.floor(hk.mass), half = hk.mass - nFull > 0.01, dH = narrow ? 7 : 8;
  let yy = cy0 + 34;
  ctx.fillStyle = "#64748b"; ctx.fillRect(wx - 2, yy, 4, Math.max(14, (nFull + (half ? 0.5 : 0)) * dH + 6));
  const stackBot = cy0 + 34 + Math.max(14, (nFull + (half ? 0.5 : 0)) * dH + 6);
  yy = stackBot - 6;
  for (let i = 0; i < nFull; i++) { yy -= dH; disk(ctx, wx, yy, DW, dH - 1, false); }
  if (half) { yy -= dH / 2; disk(ctx, wx, yy, DW, dH / 2 - 1, true); }
  ctx.fillStyle = "#334155"; ctx.fillRect(wx - 16, stackBot - 6, 32, 6);
  geo.hanger = { x0: wx - DW / 2 - 4, x1: wx + DW / 2 + 4, y0: cy0 + 30, y1: stackBot + 2 };
  // indikator soati va shtativ
  const dcy = yClamp + 9 + R + 34;
  ctx.fillStyle = "#475569"; ctx.fillRect(dx + R + 14, yClamp - 10, 8, floor - yClamp + 10); ctx.fillRect(dx + R - 6, floor - 6, 48, 6);
  ctx.fillRect(dx, dcy - 4, R + 18, 8);
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(geo.plate.x - 2, yClamp + 9, 4, dcy - R - 6 - (yClamp + 9));
  const dlmm = broken ? 0 : hk.shown;
  dial(ctx, c, dx, dcy, R, dlmm);
  if (!narrow) { ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("indikator soati", dx, dcy + R + 10); }
  // yuklar to'plami (polda)
  const sx = narrow ? w - 34 : w - 70, avail = Math.max(0, 10 - Math.ceil(hk.mass));
  ctx.fillStyle = c.dark ? "#1e293b" : "#e7e5e4"; ctx.fillRect(sx - 30, floor - 6, 60, 6);
  let ys = floor - 6; for (let i = 0; i < avail; i++) { ys -= dH; disk(ctx, sx, ys, DW, dH - 1, false); }
  ctx.fillStyle = "#64748b"; ctx.fillRect(sx - 2, Math.min(ys, floor - 20) - 8, 4, floor - 6 - Math.min(ys, floor - 20) + 8);
  geo.stack = { x0: sx - DW / 2 - 6, x1: sx + DW / 2 + 6, y0: Math.min(ys, floor - 30) - 14, y1: floor };
  ctx.font = SMALL; ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(avail ? "+1 kg" : "tugadi", sx, geo.stack.y0 - 2);
  // ma'lumot
  tag(ctx, `m = ${fmt(hk.mass, 1)} kg, F = ${fmt(hF(), 1)} N`, narrow ? 8 : 14, 26, { color: c.text, bg: c.bg2, font: narrow ? SMALL : MID });
  if (!broken) tag(ctx, `Δl = ${fmt(dlRead(), 3)} mm`, narrow ? 8 : 14, 52, { color: c.warning, bg: c.bg2, font: BOLD });
  if (broken) tag(ctx, "Sim uzildi!", narrow ? 8 : 14, 52, { color: "#fff", bg: c.danger, font: BOLD });
  const sg = hF() / hS();
  if (!broken && sg > (m.sp || m.su) && !narrow) tag(ctx, "Proporsionallik chegarasidan oshdi", 14, 78, { color: c.danger, bg: c.bg2, font: SMALL });
  geo.reset = broken ? chipBtn(ctx, c, narrow ? 8 : 14, narrow ? 78 : 104, "Yangi sim", false, 92, 24) : null;
}

/* ------------------------------------------------------------------ 3. Deformatsiya turlari */

function hatchWall(ctx, c, x, y0, y1, side) {
  ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.fillRect(side < 0 ? x - 14 : x, y0, 14, y1 - y0);
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); for (let y = y0; y < y1; y += 8) { ctx.moveTo(x + (side < 0 ? -14 : 0), y + 8); ctx.lineTo(x + (side < 0 ? 0 : 14), y); } ctx.stroke();
}
function drawTypes(ctx, c, w, h) {
  const narrow = w < 560, k = ty.kind, d = ty.d, mat = TMAT[ty.mat];
  const Lb = narrow ? Math.round(w * 0.5) : Math.min(440, Math.round(w * 0.46)), Hb = narrow ? 56 : 90;
  const x0 = narrow ? 44 : Math.round((w - Lb) / 2 - 40), cy = Math.round(h * 0.48), nx = 10, ny = 4;
  let map, handle, fixed;
  if (k === "stretch" || k === "compress") {
    const e = k === "stretch" ? 0.4 * d : -0.32 * d, nu = 0.4;
    map = (u, v) => { const x = u * Lb, y = (v - 0.5) * Hb, bulge = k === "compress" ? 1 + nu * -e * 1.6 * Math.sin(Math.PI * u) : 1 - nu * e * (u > 0.02 ? 1 : u / 0.02); return [x0 + x * (1 + e), cy + y * bulge]; };
    handle = map(1, 0.5); fixed = "left";
  } else if (k === "shear") {
    const g = 0.6 * d, Hs = Hb * 1.5, Ls = Lb * 0.62, bx = x0 + (Lb - Ls) / 2 + 10, by = cy + Hs / 2;
    map = (u, v) => [bx + u * Ls + g * (1 - v) * Hs, by - (1 - v) * Hs];
    handle = map(1, 0); handle = [handle[0] + 4, handle[1]]; fixed = "bottom";
  } else if (k === "bend") {
    const del = 0.42 * Lb * d;
    map = (u, v) => { const x = u * Lb, wv = (del * (3 * Lb * x * x - x ** 3)) / (2 * Lb ** 3), th = Math.atan((del * (6 * Lb * x - 3 * x * x)) / (2 * Lb ** 3)), y = (v - 0.5) * Hb * 0.6; return [x0 + x - y * Math.sin(th), cy + wv + y * Math.cos(th)]; };
    handle = map(1, 0.5); fixed = "left";
  } else {
    map = (u, v) => [x0 + u * Lb, cy + (v - 0.5) * Hb]; handle = [x0 + Lb + 24, cy - Hb * 0.5 - 36 + d * 72]; fixed = "left";
  }
  // tayanch
  if (fixed === "left") hatchWall(ctx, c, x0, cy - Hb, cy + Hb, -1);
  else { const [bx0] = map(0, 1), [bx1] = map(1, 1); ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.fillRect(bx0 - 30, map(0, 1)[1], bx1 - bx0 + 60, 14); }
  // deformatsiyagacha bo'lgan shakl (uzuq chiziq)
  if (d > 0.01) {
    ctx.save(); ctx.strokeStyle = c.text3; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
    if (k === "shear") { const Hs = Hb * 1.5, Ls = Lb * 0.62, bx = x0 + (Lb - Ls) / 2 + 10; ctx.strokeRect(bx, cy + Hs / 2 - Hs, Ls, Hs); }
    else if (k === "bend") ctx.strokeRect(x0, cy - Hb * 0.3, Lb, Hb * 0.6);
    else if (k !== "twist") ctx.strokeRect(x0, cy - Hb / 2, Lb, Hb);
    ctx.restore();
  }
  // jism (to'r)
  const fillG = ctx.createLinearGradient(0, cy - Hb, 0, cy + Hb); fillG.addColorStop(0, mat.fill[0]); fillG.addColorStop(1, mat.fill[1]);
  if (k === "twist") {
    const R = Hb / 2, phi = d * Math.PI * 0.75;
    const g = ctx.createLinearGradient(0, cy - R, 0, cy + R); g.addColorStop(0, mat.fill[1]); g.addColorStop(0.35, mat.fill[0]); g.addColorStop(1, mat.fill[1]);
    ctx.fillStyle = g; ctx.fillRect(x0, cy - R, Lb, 2 * R);
    ctx.beginPath(); ctx.ellipse(x0 + Lb, cy, R * 0.3, R, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = c.dark ? "rgba(15,23,42,0.75)" : "rgba(15,23,42,0.6)"; ctx.lineWidth = 1.2;
    for (let j = 0; j < 12; j++) { const a0 = (j / 12) * TAU; ctx.beginPath(); let on = false; for (let i = 0; i <= 60; i++) { const u = i / 60, a = a0 + phi * u; if (Math.cos(a) > 0) { const x = x0 + u * Lb, y = cy - R * Math.sin(a); if (on) ctx.lineTo(x, y); else ctx.moveTo(x, y); on = true; } else on = false; } ctx.stroke(); }
    for (let i = 0; i <= nx; i++) { const x = x0 + (i / nx) * Lb; ctx.beginPath(); ctx.ellipse(x, cy, R * 0.3, R, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
    // uchidagi radius belgisi
    ctx.strokeStyle = c.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + Lb, cy); ctx.lineTo(x0 + Lb + R * 0.3 * Math.sin(phi) * 0.9, cy - R * Math.cos(phi) * 0.9); ctx.stroke();
    // kalit
    ctx.strokeStyle = "#64748b"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x0 + Lb + 4, cy); ctx.lineTo(handle[0], handle[1]); ctx.stroke(); ctx.lineCap = "butt";
    if (phi > 0.02) { ctx.strokeStyle = c.primary; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x0 + Lb, cy, R * 0.3 + 10, R + 10, 0, -Math.PI / 2, -Math.PI / 2 + phi); ctx.stroke(); }
  } else {
    ctx.fillStyle = fillG; ctx.beginPath();
    for (let i = 0; i <= nx * 2; i++) { const [x, y] = map(i / (nx * 2), 0); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    for (let i = nx * 2; i >= 0; i--) { const [x, y] = map(i / (nx * 2), 1); ctx.lineTo(x, y); }
    ctx.closePath(); ctx.fill();
    // tolalar rangi (egilishda)
    if (k === "bend" && d > 0.02) {
      for (const [v, col] of [[0.06, "rgba(220,38,38,0.85)"], [0.94, "rgba(37,99,235,0.85)"]]) { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = map(i / 40, v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); }
      ctx.setLineDash([5, 4]); ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = map(i / 40, 0.5); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle = c.dark ? "rgba(15,23,42,0.7)" : "rgba(15,23,42,0.5)"; ctx.lineWidth = 1;
    for (let i = 0; i <= nx; i++) { ctx.beginPath(); for (let j = 0; j <= 10; j++) { const [x, y] = map(i / nx, j / 10); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); }
    for (let j = 0; j <= ny; j++) { ctx.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = map(i / 40, j / ny); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); }
  }
  // kuch strelkasi
  const Fl = 16 + 40 * d;
  if (d > 0.01) {
    if (k === "stretch") arrow(ctx, handle[0] + 14, handle[1], Fl, 0, c.danger, { width: 2.6, head: 9, label: "F" });
    else if (k === "compress") arrow(ctx, handle[0] + 14 + Fl, handle[1], -Fl, 0, c.danger, { width: 2.6, head: 9, label: "F" });
    else if (k === "shear") arrow(ctx, handle[0] + 14, handle[1] - 10, Fl, 0, c.danger, { width: 2.6, head: 9, label: "F" });
    else if (k === "bend") arrow(ctx, handle[0], handle[1] - Hb * 0.3 - 6 - Fl, 0, Fl, c.danger, { width: 2.6, head: 9, label: "F" });
  }
  // tutqich
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.danger; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(handle[0], handle[1], 9, 0, TAU); ctx.fill(); ctx.stroke();
  geo.thandle = { x: handle[0], y: handle[1], k, x0, Lb, Hb, cy };
  // izohlar
  const info = KIND[k];
  tag(ctx, `${info.name} · ${mat.name}`, narrow ? 8 : 14, 18, { color: c.text, bg: c.bg2, font: narrow ? SMALL : MID });
  if (ty.res > 0.005) tag(ctx, `qoldiq deformatsiya ${fmt(ty.res * 100, 0)} %`, narrow ? 8 : 14, 44, { color: c.warning, bg: c.bg2, font: SMALL });
  if (ty.mat === "steel" && !narrow) tag(ctx, "deformatsiya kattalashtirib ko‘rsatilgan", w - 14, h - 18, { color: c.text3, bg: c.bg2, font: SMALL, align: "right" });
  if (k === "bend" && d > 0.02) { const [x, y] = map(0.35, 0); tag(ctx, "cho‘ziladi", x, y - 14, { color: c.danger, bg: c.bg2, font: SMALL, pad: 4 }); const [x2, y2] = map(0.35, 1); tag(ctx, "siqiladi", x2, y2 + 14, { color: c.primary, bg: c.bg2, font: SMALL, pad: 4 }); }
}

/* ------------------------------------------------------------------ Chizish va grafik */

function draw(ctx, s) {
  const c = s.colors; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, s.w, s.h);
  if (ui.mode === "tension") drawTension(ctx, c, s.w, s.h);
  else if (ui.mode === "hooke") drawHookeScene(ctx, c, s.w, s.h);
  else drawTypes(ctx, c, s.w, s.h);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(vh * 0.46, 340, 390)), graph: Math.round(clamp(vh * 0.3, 210, 270)) }; };
const stage = createStage($("#stage"), draw, { height: () => heights().stage });
const DL_STEPS = [0.2, 0.5, 1, 2, 3, 5, 10, 20, 50, 100, 200];
function drawGraphCanvas(ctx, gs) {
  if (ui.mode === "tension") return drawSE(ctx, gs, { m: tm(), path: tn.path, e: tn.e, s: tStress(), xMax: tn.xMax, S: S0, hover: ui.hover });
  if (ui.mode === "hooke") {
    const Fmax = 100, need = Math.max(Fmax / kTh(), ...hk.pts.map((p) => p[0]), hk.sample.broken ? 0 : hk.shown) * 1.05;
    return drawHooke(ctx, gs, { pts: hk.pts, kTh: kTh(), dlMax: DL_STEPS.find((v) => v >= need) ?? 200, Fmax, dl: hk.shown, F: hF(), hover: ui.hover });
  }
  ctx.fillStyle = gs.colors.bg; ctx.fillRect(0, 0, gs.w, gs.h);
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  tension: ["Cho‘zilish diagrammasi σ(ε)", "Boshida kuchlanish deformatsiyaga proporsional (Guk qonuni) — chiziq deyarli tik, chunki E juda katta. Oquvchanlik chegarasidan keyin namuna kuch deyarli oshmasa ham cho‘ziladi, so‘ng mustahkamlanadi; σₘ dan keyin bo‘yin hosil bo‘ladi va namuna uziladi. Yukni olsangiz nuqta E qiyalikdagi to‘g‘ri chiziq bo‘ylab tushadi — qoldiq deformatsiya qoladi."],
  hooke: ["Kuch va uzayish F(Δl)", "Har bir yuk uchun indikator ko‘rsatishi nuqta bo‘lib yoziladi. Elastik sohada nuqtalar koordinata boshidan o‘tuvchi to‘g‘ri chiziqda yotadi: F = kΔl, k = ES/l₀. Chiziq qiyaligidan Yung moduli E = kl₀/S topiladi."],
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
const REGION = { elastic: "elastik deformatsiya (Guk qonuni)", yield: "oquvchanlik — kuch oshmasa ham cho‘zilmoqda", harden: "mustahkamlanish (plastik deformatsiya)", neck: "bo‘yin hosil bo‘lmoqda", unload: "yuksizlantirish — elastik qism tiklanmoqda", slack: "yuk yo‘q, qoldiq deformatsiya", broken: "namuna uzildi", brittle: "mo‘rt material — uzilishga yaqin" };

function updateReadouts() {
  if (ui.mode === "tension") {
    const m = tm(), s = tn.sample, sg = tStress(), F = sg * S0, reg = P.region(s, m, tn.e);
    setRO("r1", "Kuch <i>F</i>", F >= 1000 ? u(fmt(F / 1000, 2), "kN") : u(fmt(F, 0), "N"), `≈ ${fmt(F / P.G / 1000, 2)} t yuk og‘irligi`, "orange");
    setRO("r2", "Mexanik kuchlanish <i>σ = F/S</i>", u(fmt(sg / MPa, 0), "MPa"), `S = ${fmt(S0 * 1e6, 1)} mm²`, "green");
    const e = s.broken ? P.residual(s) : tn.e;
    setRO("r3", "Nisbiy uzayish <i>ε</i>", u(fmt(e * 100, e < 0.01 ? 3 : 2), "%"), `Δl = ${fmt(e * 100, e < 0.01 ? 3 : 2)} mm`);
    setRO("r4", "Yung moduli <i>E</i>", u(fmt(m.E / 1e9, 0), "GPa"), reg === "elastic" && tn.e > 1e-5 ? `σ/ε = ${fmt(sg / tn.e / 1e9, 0)} GPa` : "elastik qism qiyaligi");
    setRO("r5", "Qoldiq deformatsiya", u(fmt(P.residual(s) * 100, P.residual(s) < 0.01 ? 3 : 2), "%"), s.broken ? "uzilishdan keyingi nisbiy uzayish δ" : P.residual(s) > 0 ? "yuk olinganda qoladigan" : "yo‘q — hammasi elastik", P.residual(s) > 0 ? "orange" : "");
    setRO("r6", "Holat", REGION[reg].split(" — ")[0].split(" (")[0], REGION[reg], reg === "broken" ? "" : reg === "elastic" ? "green" : "");
    return;
  }
  if (ui.mode === "hooke") {
    const m = hm(), S = hS(), F = hF(), sg = F / S, dl = dlRead(), br = hk.sample.broken, k = fitK(hk.pts);
    setRO("r1", "Yuk og‘irligi <i>F = mg</i>", u(fmt(F, 1), "N"), `m = ${fmt(hk.mass, 1)} kg`, "orange");
    setRO("r2", "Uzayish <i>Δl</i>", br ? "—" : u(fmt(dl, 3), "mm"), br ? "sim uzildi" : "indikator soati", "green");
    setRO("r3", "Kuchlanish <i>σ = F/S</i>", u(fmt(sg / MPa, 0), "MPa"), `S = ${fmt(S * 1e6, 3)} mm²${m.sp ? `, σₚ = ${fmt(m.sp / MPa, 0)} MPa` : ""}`, sg > m.sp ? "orange" : "");
    setRO("r4", "Nisbiy uzayish <i>ε</i>", br ? "—" : u(fmt((dl / (hk.L * 1000)) * 100, 4), "%"), `l₀ = ${fmt(hk.L, 1)} m`);
    setRO("r5", "Bikrlik <i>k</i>", k ? u(fmt(k, 1), "N/mm") : "—", `nazariy ES/l₀ = ${fmt(kTh(), 1)} N/mm`);
    setRO("r6", "Yung moduli (o‘lchangan)", k ? u(fmt((k * 1000 * hk.L) / S / 1e9, 0), "GPa") : "—", `jadvalda ${m.name}: ${fmt(m.E / 1e9, 0)} GPa`, k ? "green" : "");
    return;
  }
  const info = KIND[ty.kind], mat = TMAT[ty.mat], dShow = ty.d;
  const meas = ty.kind === "twist" ? u(fmt(dShow * 135, 0), "°") : ty.kind === "bend" ? u(fmt(dShow * 42, 0), "% l") : ty.kind === "shear" ? u(fmt(Math.atan(0.6 * dShow) / (Math.PI / 180), 0), "°") : u(fmt((ty.kind === "stretch" ? 40 : -32) * dShow, 0), "%");
  setRO("r1", "Deformatsiya turi", info.name, ty.kind === "shear" ? "qatlamlar bir-biriga nisbatan siljiydi" : ty.kind === "bend" ? "bir tomoni cho‘ziladi, ikkinchisi siqiladi" : ty.kind === "twist" ? "ko‘ndalang kesimlar buriladi" : "uzunligi o‘zgaradi", "orange");
  setRO("r2", { stretch: "Nisbiy uzayish ε", compress: "Nisbiy siqilish ε", shear: "Siljish burchagi γ", bend: "Egilish (salqilik) f", twist: "Buralish burchagi φ" }[ty.kind], meas, "sahnadagi qiymat");
  setRO("r3", "Elastik qism", u(fmt(Math.max(0, ty.d - ty.res) * 100, 0), "%"), "kuch olinsa yo‘qoladi", "green");
  setRO("r4", "Qoldiq (plastik) qism", u(fmt(ty.res * 100, 0), "%"), ty.res > 0.005 ? "kuch olinsa ham qoladi" : "yo‘q", ty.res > 0.005 ? "orange" : "");
  setRO("r5", "Material", mat.name, mat.note);
  setRO("r6", "Hayotda", info.name, info.life);
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "tension") { const reg = P.region(tn.sample, tm(), tn.e); t = tn.sample.broken ? "Namuna uzildi" : `σ = ${fmt(tStress() / MPa, 0)} MPa`; tone = reg === "broken" ? "orange" : reg === "elastic" ? "green" : "blue"; }
  else if (ui.mode === "hooke") { t = hk.sample.broken ? "Sim uzildi" : `Δl = ${fmt(dlRead(), 3)} mm`; tone = hk.sample.broken ? "orange" : "green"; }
  else { t = ty.held ? "Kuch ta’sir qilmoqda" : ty.res > 0.005 ? "Qoldiq deformatsiya" : "Jism tinch"; tone = ty.res > 0.005 ? "orange" : "green"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "tension") {
    const m = tm(), reg = P.region(tn.sample, m, tn.e);
    p.push("<p>Cho‘zish mashinasi namunani asta-sekin cho‘zadi va har onda kuchni (kuch datchigi) hamda uzayishni (ekstenzometr) o‘lchaydi. Kuchni kesim yuzasiga bo‘lib <b>mexanik kuchlanish</b> σ = F/S, uzayishni boshlang‘ich uzunlikka bo‘lib <b>nisbiy uzayish</b> ε = Δl/l₀ topiladi. σ(ε) grafigi — <b>cho‘zilish diagrammasi</b> — materialning «pasporti».</p>");
    if (m.brittle) p.push("<p><b>Cho‘yan mo‘rt material</b>: u deyarli plastik deformatsiyasiz, ε ≈ 0,6 % da birdaniga uziladi — bo‘yin hosil bo‘lmaydi. Shisha, beton, g‘isht ham shunday. Mo‘rt materiallar siqilishga cho‘zilishdan bir necha marta yaxshi chidaydi.</p>");
    else if (reg === "elastic") p.push(`<p>Hozir <b>elastik soha</b>: σ = Eε (Guk qonuni). ${m.full} uchun E = ${fmt(m.E / 1e9, 0)} GPa, shuning uchun 100 mm li namuna atigi ${fmt((m.sp / m.E) * 100, 2)} mm cho‘zilganda proporsionallik chegarasiga (σₚ = ${fmt(m.sp / MPa, 0)} MPa) yetadi. Yukni olsangiz, namuna to‘liq avvalgi uzunligiga qaytadi.</p>`);
    else if (reg === "yield") p.push("<p><b>Oquvchanlik</b>: kristall panjaradagi qatlamlar bir-biriga nisbatan siljiy boshladi — kuch deyarli oshmasa ham namuna cho‘zilmoqda (diagrammadagi «maydoncha»). Endi yukni olsangiz, deformatsiyaning bir qismi qoladi — bu <b>plastik (qoldiq) deformatsiya</b>.</p>");
    else if (reg === "harden" || reg === "neck") p.push(`<p>Plastik deformatsiya natijasida material <b>mustahkamlanadi</b> — cho‘zishni davom ettirish uchun kuchni oshirish kerak. σₘ = ${fmt(m.su / MPa, 0)} MPa — <b>mustahkamlik chegarasi</b>: undan keyin namunaning bir joyida ingichka «bo‘yin» hosil bo‘ladi, kuch kamayadi va namuna o‘sha joyidan uziladi.</p>`);
    else if (reg === "unload" || reg === "slack") p.push("<p>Yuk kamaytirilganda nuqta diagramma bo‘ylab emas, <b>elastik qism bilan bir xil qiyalikdagi to‘g‘ri chiziq</b> bo‘ylab tushadi. Kuch nolga tenglashganda qolgan uzayish — qoldiq deformatsiya. Qayta yuklasangiz, namuna oldingi eng katta kuchlanishgacha elastik bo‘ladi: material «naklyop» bo‘ldi (sovuq holda mustahkamlandi).</p>");
    else p.push(`<p>Namuna uzildi. Uzilgandan keyingi nisbiy uzayish δ = ${fmt(P.residual(tn.sample) * 100, 1)} % — materialning <b>plastikligi</b> o‘lchovi. Konstruksiyalarda kuchlanish σₘ dan bir necha marta kichik qilib olinadi: n = σₘ/σ<sub>ruxsat</sub> — <b>mustahkamlik zaxirasi</b> (po‘lat uchun odatda 1,5–3).</p>`);
  } else if (ui.mode === "hooke") {
    p.push("<p>Uzun ingichka sim shiftga mahkamlangan, pastki uchiga yuk osiladi. Sim juda kam uzayadi — millimetrning bir necha qismi — shuning uchun uzayishni 0,01 mm aniqlikdagi <b>indikator soati</b> bilan o‘lchaymiz: katta strelka bir aylanishi 1 mm, kichik strelka millimetrlarni sanaydi.</p>");
    const m = hm(), sg = hF() / hS();
    p.push(sg <= m.sp ? `<p>Kuchlanish σ = ${fmt(sg / MPa, 0)} MPa proporsionallik chegarasidan (${fmt(m.sp / MPa, 0)} MPa) kichik — uzayish yukka proporsional: F = kΔl, bunda k = ES/l₀. Sim ikki marta uzun bo‘lsa, ikki marta ko‘p uzayadi; diametri ikki marta katta bo‘lsa, kesim yuzasi 4 marta katta — uzayish 4 marta kam.</p>` : `<p>Kuchlanish σ = ${fmt(sg / MPa, 0)} MPa proporsionallik chegarasidan (${fmt(m.sp / MPa, 0)} MPa) oshdi: nuqtalar to‘g‘ri chiziqdan chetga chiqadi, yukni olsangiz indikator nolga qaytmaydi — sim plastik cho‘zildi.${m.su ? ` σ > ${fmt(m.su / MPa, 0)} MPa bo‘lsa, sim uziladi.` : ""}</p>`);
  } else {
    const k = ty.kind;
    p.push("<p>Tashqi kuch ta’sirida jism shakli yoki o‘lchamlari o‘zgarishi — <b>deformatsiya</b>. Kuch olingach yo‘qoladigan deformatsiya <b>elastik</b>, qoladigani <b>plastik (qoldiq)</b> deformatsiya deyiladi. Rezina, po‘lat prujina — elastik; plastilin, qo‘rg‘oshin, ho‘l loy — plastik jismlar.</p>");
    p.push({ stretch: "<p><b>Cho‘zilish</b>: jism uzunligi ortadi, ko‘ndalang o‘lchami esa biroz kamayadi. Arqon, tros, kran ilgagi cho‘zilishga ishlaydi.</p>", compress: "<p><b>Siqilish</b>: jism qisqaradi va biroz yo‘g‘onlashadi (o‘rtasi bo‘rtib chiqadi). Bino ustunlari, poydevor, stol oyoqlari siqilishga ishlaydi.</p>", shear: "<p><b>Siljish</b>: pastki yuzasi mahkamlangan jismning yuqori qatlamlari kuch yo‘nalishida suriladi; to‘r kvadratlari rombga aylanadi, γ — siljish burchagi. Parchin mixlar, boltlar, qaychi bilan kesish — siljish.</p>", bend: "<p><b>Egilish</b>: to‘sinning qavariq tomonidagi tolalar cho‘ziladi (qizil), botiq tomonidagisi siqiladi (ko‘k), o‘rtadagi «neytral qatlam» uzunligi o‘zgarmaydi. Shuning uchun to‘sinlar o‘rtasi bo‘sh (quvur, qo‘shtavr) qilinadi — materialni tejaydi, mustahkamligi deyarli kamaymaydi.</p>", twist: "<p><b>Buralish</b>: bir uchi mahkamlangan sterjenning ikkinchi uchi buriladi; uzunlik bo‘yicha chizilgan chiziqlar vint chiziqqa aylanadi. Avtomobil vallari, burama kalit bilan burashda shunday deformatsiya bo‘ladi.</p>" }[k]);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "tension" ? "<small>Kuchlanish</small> σ = F/S,&nbsp; ε = Δl/l₀" : ui.mode === "hooke" ? "<small>Guk qonuni</small> σ = Eε,&nbsp; F = (ES/l₀)·Δl" : "<small>Deformatsiya</small> elastik + plastik";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Mantiq */

function setTensionS(s) {
  const m = tm(), smin = sOf(P.residual(tn.sample));
  if (tn.sample.broken) return;
  tn.s = clamp(s, smin, 1000); tn.e = eOf(tn.s);
  P.strainTo(tn.sample, m, tn.e);
  const sg = P.stressAt(tn.sample, m, tn.e), last = tn.path[tn.path.length - 1];
  if (tn.sample.broken) { tn.path.push([tn.e, last[1] * 0.98], [tn.e, 0]); tn.auto = false; tn.unload = false; }
  else if (Math.abs(tn.e - last[0]) > 1e-6 || Math.abs(sg - last[1]) > 0.2 * MPa) { tn.path.push([tn.e, sg]); if (tn.path.length > 5000) tn.path.splice(1, 1); }
  tn.xMax = Math.max(tn.xMax, niceStrain(Math.max(tn.e, tn.sample.emax) * 100 * 1.25));
  sC.set(tn.s);
}
function newSample() { tn.sample = P.createSample(); tn.s = 0; tn.e = 0; tn.path = [[0, 0]]; tn.auto = false; tn.unload = false; tn.lever = 0; tn.xMax = 0.25; sC.set(0); }
function newWire() { hk.sample = P.createSample(); hk.e = 0; hk.shown = 0; hk.pts = []; hk.fall = 0; hk.mass = 0; mC.set(0); }
function setMass(mass) {
  hk.mass = clamp(Math.round(mass * 2) / 2, 0, 10);
  if (hk.sample.broken) return;
  hk.e = P.strainFor(hk.sample, hm(), hF() / hS());
  if (hk.sample.broken) { hk.fall = 0; return; }
  if (prefersReducedMotion() || !loop.running) hk.shown = hk.e * hk.L * 1000;
  const rd = hk.e * hk.L * 1000 + (hk.mass > 0 || hk.e > 0 ? noise(hk.mass * 7.3, hk.d * 1e4 + hk.L) * 0.006 : 0);
  hk.pts = hk.pts.filter((p) => Math.abs(p[1] - hF()) > 1e-6); hk.pts.push([Math.max(0, rd), hF()]); hk.pts.sort((a, b) => a[1] - b[1]);
  mC.set(hk.mass);
}
function setTyD(d) {
  ty.d = clamp(d, 0, 1); const lim = TMAT[ty.mat].lim;
  if (ty.d > ty.res + lim) ty.res = ty.d - lim;
  if (ty.d < ty.res - lim) ty.res = Math.max(0, ty.d + lim);
  dC.set(Math.round(ty.d * 100));
}

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "tension" && !tn.sample.broken) {
    let rate = 0;
    if (tn.lever) rate = 260 * tn.lever * Math.abs(tn.lever);
    else if (tn.unload) rate = -240;
    else if (tn.auto) rate = 55;
    if (rate) { setTensionS(tn.s + rate * dt); if (tn.unload && tn.s <= sOf(P.residual(tn.sample)) + 1e-6) tn.unload = false; }
  } else if (ui.mode === "hooke") {
    if (hk.sample.broken) hk.fall = Math.min(400, hk.fall + dt * 600);
    else { const target = hk.e * hk.L * 1000; hk.shown += (target - hk.shown) * Math.min(1, dt * 5); }
  } else if (!ty.held && Math.abs(ty.d - ty.res) > 1e-4) { ty.d += (ty.res - ty.d) * Math.min(1, dt * (ty.mat === "rubber" ? 7 : 10)); dC.set(Math.round(ty.d * 100)); }
  stage.render(); if (ui.mode === "tension" && (tn.auto || tn.unload || tn.lever)) graph.render();
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
  if (prefersReducedMotion()) { loop.stop(); setPlayUI(false); return; }
  if (!playing) { loop.stop(); setPlayUI(false); } else loop.start();
}
$("[data-reset]").addEventListener("click", () => {
  if (ui.mode === "tension") newSample();
  else if (ui.mode === "hooke") newWire();
  else { ty.d = 0; ty.res = 0; dC.set(0); }
  refresh();
});

/* ------------------------------------------------------------------ Boshqaruv */

const sC = bindRange($("#tS"), $("#tSOut"), (v) => { const e = eOf(v); return `${fmt(e * 100, e < 0.01 ? 3 : 1)} mm`; }, (v) => { tn.auto = false; tn.unload = false; setTensionS(v); customized(); refresh(); });
const lC = bindRange($("#hL"), $("#hLOut"), (v) => `${fmt(v, 1)} m`, (v) => { hk.L = v; newWire(); customized(); refresh(); });
const mC = bindRange($("#hM"), $("#hMOut"), (v) => `${fmt(v, 1)} kg`, (v) => { setMass(v); customized(); refresh(); });
const dC = bindRange($("#tD"), $("#tDOut"), (v) => `${fmt(v, 0)} %`, (v) => { ty.held = v > 0; setTyD(v / 100); customized(); refresh(); });
function setSeg(attr, val) { document.querySelectorAll(`[data-${attr}-value]`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[`${attr.replace(/-./g, (x) => x[1].toUpperCase())}Value`] === String(val)))); }
function setMat(k) { tn.mat = k; setSeg("mat", k); newSample(); }
function setHMat(k) { hk.mat = k; setSeg("hmat", k); newWire(); }
function setD(dmm) { hk.d = dmm / 1000; setSeg("d", String(dmm)); newWire(); }
function setKind(k) { ty.kind = k; setSeg("kind", k); ty.d = 0; ty.res = 0; dC.set(0); }
function setTMat(k) { ty.mat = k; setSeg("tmat", k); ty.d = 0; ty.res = 0; dC.set(0); }
document.querySelectorAll("[data-mat-value]").forEach((b) => b.addEventListener("click", () => { setMat(b.dataset.matValue); customized(); refresh(); }));
document.querySelectorAll("[data-hmat-value]").forEach((b) => b.addEventListener("click", () => { setHMat(b.dataset.hmatValue); customized(); refresh(); }));
document.querySelectorAll("[data-d-value]").forEach((b) => b.addEventListener("click", () => { setD(Number(b.dataset.dValue)); customized(); refresh(); }));
document.querySelectorAll("[data-kind-value]").forEach((b) => b.addEventListener("click", () => { setKind(b.dataset.kindValue); customized(); refresh(); }));
document.querySelectorAll("[data-tmat-value]").forEach((b) => b.addEventListener("click", () => { setTMat(b.dataset.tmatValue); customized(); refresh(); }));

/* Sahnada surish va bosish */
const canvas = stage.canvas;
let drag = null;
const ptr = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function hit(p) {
  if (ui.mode === "tension") {
    if (inBox(p, geo.auto)) return { kind: "auto" }; if (inBox(p, geo.unl)) return { kind: "unl" }; if (inBox(p, geo.fresh)) return { kind: "fresh" };
    const g = geo.lever; if (g && Math.abs(p.x - g.x) <= 22 && p.y >= g.y0 - 12 && p.y <= g.y1 + 12) return { kind: "lever" };
  } else if (ui.mode === "hooke") {
    if (inBox(p, geo.reset)) return { kind: "wire" }; if (inBox(p, geo.stack)) return { kind: "add" }; if (inBox(p, geo.hanger)) return { kind: "remove" };
  } else { const g = geo.thandle; if (g && Math.hypot(p.x - g.x, p.y - g.y) <= 22) return { kind: "thandle" }; }
  return null;
}
function applyDrag(h, p) {
  if (h.kind === "lever") { const g = geo.lever, half = (g.y1 - g.y0) / 2; tn.lever = clamp((p.y - g.mid) / (half * 0.92), -1, 1); if (Math.abs(tn.lever) < 0.06) tn.lever = 0; tn.auto = false; tn.unload = false; if (prefersReducedMotion()) setTensionS(tn.s + 40 * tn.lever); }
  else if (h.kind === "thandle") {
    const g = geo.thandle; let d;
    if (g.k === "stretch") d = (p.x - (g.x0 + g.Lb)) / (0.4 * g.Lb);
    else if (g.k === "compress") d = ((g.x0 + g.Lb) - p.x) / (0.32 * g.Lb);
    else if (g.k === "shear") d = (p.x - h.x0) / (0.6 * g.Hb * 1.5) + h.d0;
    else if (g.k === "bend") d = (p.y - g.cy) / (0.42 * g.Lb);
    else d = (p.y - (g.cy - g.Hb * 0.5 - 36)) / 72;
    ty.held = true; setTyD(d);
  }
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(canvas, e), h = hit(p); if (!h) return;
  e.preventDefault(); customized();
  if (h.kind === "auto") { tn.auto = !tn.auto; tn.unload = false; if (prefersReducedMotion() && tn.auto) { setTensionS(1000); tn.auto = false; } refresh(); return; }
  if (h.kind === "unl") { tn.auto = false; tn.unload = true; if (prefersReducedMotion()) { setTensionS(0); tn.unload = false; } refresh(); return; }
  if (h.kind === "fresh") { newSample(); refresh(); return; }
  if (h.kind === "wire") { newWire(); refresh(); return; }
  if (h.kind === "add") { if (!hk.sample.broken) setMass(Math.min(10, Math.floor(hk.mass) + 1)); refresh(); return; }
  if (h.kind === "remove") { if (!hk.sample.broken) setMass(Math.max(0, Math.ceil(hk.mass) - 1)); refresh(); return; }
  if (h.kind === "thandle") { h.x0 = p.x; h.d0 = ty.d; }
  applyDrag(h, p);
  drag = h; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } canvas.dataset.dragging = "true"; refresh();
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(canvas, e);
  if (!drag) { const h = hit(p); canvas.style.cursor = !h ? "" : h.kind === "lever" ? "ns-resize" : h.kind === "thandle" ? "grab" : "pointer"; return; }
  applyDrag(drag, p); refresh();
});
const endDrag = () => { if (drag?.kind === "lever") tn.lever = 0; if (drag?.kind === "thandle") ty.held = false; drag = null; canvas.dataset.dragging = "false"; refresh(); };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

const gcv = graph.canvas;
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptr(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

/** Namunani berilgan ε gacha yuklaydi, keyin (ixtiyoriy) yukni oladi */
function runTension(mat, eLoad, unload, eBack) {
  setMat(mat);
  if (eLoad > 0) { const sT = sOf(Math.min(eLoad, tm().ef)); for (let s = 0; s <= sT; s += 2) setTensionS(s); setTensionS(sT); }
  if (unload) { for (let s = tn.s; s >= 0; s -= 2) setTensionS(s); setTensionS(0); }
  if (eBack != null) setTensionS(sOf(eBack));
}
function runWire(mat, dmm, L, masses) { setHMat(mat); setD(dmm); hk.L = L; lC.set(L); newWire(); for (const m of masses) setMass(m); hk.shown = hk.e * hk.L * 1000; }
const TN = (title, lesson, mat, eLoad, unload, eBack) => ({ mode: "tension", title, lesson, set: () => runTension(mat, eLoad, unload, eBack) });
const HK = (title, lesson, mat, dmm, L, masses) => ({ mode: "hooke", title, lesson, set: () => runWire(mat, dmm, L, masses) });
const TY = (title, lesson, kind, mat, d, res) => ({ mode: "types", title, lesson, set: () => { setKind(kind); setTMat(mat); ty.res = res; ty.d = d; ty.held = res === 0 && d > 0; dC.set(Math.round(d * 100)); } });
const PRESETS = {
  tSteel: TN("Po‘latni cho‘zish", "Po‘lat namuna mashinaga o‘rnatildi. «▶ Avto-yuklash» ni bosing (yoki dastakni pastga torting) va diagrammani kuzating: elastik qism, oquvchanlik maydonchasi, mustahkamlanish, bo‘yin va uzilish.", "steel", 0),
  tElastic: TN("Elastik soha", "Namuna σ ≈ 150 MPa gacha cho‘zildi — bu proporsionallik chegarasidan kichik. «Yukni olish» ni bosing: nuqta o‘sha chiziq bo‘ylab nolga qaytadi, qoldiq deformatsiya yo‘q.", "steel", 0.00075),
  tPlastic: TN("Qoldiq deformatsiya", "Namuna 5 % gacha cho‘zilib, so‘ng yuk to‘liq olindi. Diagrammada tushish chizig‘i elastik qismga parallel; 100 mm li namuna 4,8 mm uzunroq bo‘lib qoldi.", "steel", 0.05, true),
  tHarden: TN("Naklyop (qayta yuklash)", "Namuna 8 % gacha cho‘zilib, yuk olindi. Endi qayta yuklang: namuna ≈ 330 MPa gacha elastik bo‘ladi — oquvchanlik chegarasi oshdi. Simni bir necha marta egib-to‘g‘rilasangiz qattiqlashishi shu hodisa.", "steel", 0.08, true),
  tNeck: TN("Bo‘yin hosil bo‘lishi", "Mustahkamlik chegarasidan o‘tildi: namunaning o‘rtasida ingichka bo‘yin paydo bo‘ldi, kuch kamaymoqda. Yana ozgina cho‘zsangiz, namuna bo‘yindan uziladi.", "steel", 0.235),
  tCopper: TN("Mis — plastik metall", "Misda aniq oquvchanlik maydonchasi yo‘q: proporsionallik chegarasi juda past (≈ 40 MPa), keyin diagramma silliq egiladi. Mis 45 % gacha cho‘ziladi — undan sim cho‘zib olish oson.", "copper", 0),
  tAlu: TN("Alyuminiy", "Alyuminiyning E moduli po‘latnikidan ≈ 3 marta kichik — xuddi shu kuchlanishda u 3 marta ko‘p cho‘ziladi. Mustahkamligi ham kamroq, lekin juda yengil.", "alu", 0),
  tIron: TN("Cho‘yan — mo‘rt material", "Cho‘yan namunani cho‘zing: plastik qism deyarli yo‘q, bo‘yin hosil bo‘lmaydi, namuna ε ≈ 0,6 % da birdaniga uziladi.", "iron", 0),
  hSteel: HK("Po‘lat sim: Guk qonuni", "Po‘lat sim (l₀ = 2 m, d = 0,8 mm) ga 1 kg dan 5 kg gacha yuk osildi, har birida indikator ko‘rsatishi yozildi. Nuqtalar to‘g‘ri chiziqda yotadi: k ≈ 50 N/mm, E ≈ 200 GPa.", "steel", 0.8, 2, [1, 2, 3, 4, 5]),
  hThin: HK("Ingichka sim (d = 0,4 mm)", "Diametr 2 marta kichik — kesim yuzasi 4 marta kichik, shuning uchun bir xil yukda uzayish 4 marta katta. 2,5 kg dan ko‘p ossangiz, kuchlanish chegaradan oshadi.", "steel", 0.4, 2, [0.5, 1, 1.5, 2]),
  hLong: HK("Uzun sim (l₀ = 3 m)", "Sim 1,5 marta uzun — uzayish ham 1,5 marta katta, bikrlik k = ES/l₀ esa 1,5 marta kichik. Yung moduli esa o‘zgarmaydi: u simning o‘lchamlariga emas, materialiga bog‘liq.", "steel", 0.8, 3, [1, 2, 3, 4, 5]),
  hCopper: HK("Mis sim", "Mis simning E moduli po‘latnikidan ≈ 2 marta kichik — uzayish 2 marta katta. Mis tez «oqadi»: 2 kg dan ko‘p yukda proporsionallik chegarasidan o‘tadi.", "copper", 0.8, 2, [0.5, 1, 1.5, 2]),
  hOver: HK("Ortiqcha yuk: qoldiq uzayish", "Mis simga yuk 3,5 kg gacha osilib, so‘ng olindi: indikator nolga qaytmadi — sim ≈ 1,8 mm plastik cho‘zilib qoldi. Grafikda yuksizlantirish nuqtalari boshqa chiziqda yotadi.", "copper", 0.8, 2, [1, 2, 3, 3.5, 3, 2, 1, 0]),
  dStretch: TY("Cho‘zilish", "Rezina brusokning qizil tutqichini o‘ngga torting va qo‘yib yuboring: u cho‘ziladi, ingichkalashadi va kuch olinganda to‘liq tiklanadi.", "stretch", "rubber", 0.6, 0),
  dCompress: TY("Siqilish", "Brusok siqilmoqda: u qisqaradi va o‘rtasi bo‘rtib chiqadi. Tutqichni chapga suring.", "compress", "rubber", 0.6, 0),
  dShear: TY("Siljish", "Pastki yuzasi stolga yopishtirilgan rezina brusokning yuqori qirrasiga yon tomondan kuch berildi: kvadrat kataklar rombga aylandi.", "shear", "rubber", 0.6, 0),
  dBend: TY("Egilish", "Bir uchi devorga mahkamlangan to‘sin uchiga kuch berildi. Qavariq tomoni (qizil) cho‘ziladi, botiq tomoni (ko‘k) siqiladi.", "bend", "rubber", 0.6, 0),
  dTwist: TY("Buralish", "Sterjen uchi kalit bilan buraldi: to‘g‘ri chiziqlar vint chiziqqa aylandi. Kalitni yuqoriga-pastga suring.", "twist", "rubber", 0.6, 0),
  dPlastic: TY("Plastik deformatsiya", "Plastilin to‘sin egildi va qo‘yib yuborildi — u egilgan holicha qoldi. Rezina yoki po‘latni tanlab solishtiring.", "bend", "clay", 0.55, 0.52),
};
const GROUPS = [["Cho‘zish mashinasi", ["tSteel", "tElastic", "tPlastic", "tHarden", "tNeck", "tCopper", "tAlu", "tIron"]], ["Guk qonuni (sim)", ["hSteel", "hThin", "hLong", "hCopper", "hOver"]], ["Deformatsiya turlari", ["dStretch", "dCompress", "dShear", "dBend", "dTwist", "dPlastic"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { tension: "Dastakni pastga torting yoki «Avto-yuklash»", hooke: "Yuk to‘plamini bosing", types: "Qizil tutqichni suring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  stage.canvas.setAttribute("aria-label", { tension: "Cho‘zish mashinasi: qisqichlar orasidagi metall namuna, kuch datchigi, boshqaruv pulti va dastak", hooke: "Shiftga osilgan sim, yuklar, indikator soati", types: "To‘rli jism: cho‘zilish, siqilish, siljish, egilish yoki buralish" }[ui.mode]);
}
const MODE_DEFAULT = { tension: "tSteel", hooke: "hSteel", types: "dStretch" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.hover = null; ty.held = false; tn.lever = 0;
  ui.mode = p.mode; p.set();
  setModeUI(); presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  setTab(); startIfNeeded(); refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "tSteel");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
