// ==========================================================================
// Linzalar va optik asboblar — virtual laboratoriya (simulations/lens.html)
// 1) Tasvir yasash: yig'uvchi/sochuvchi linza, xarakterli nurlar va dasta, ekranda tasvirni ushlash, optik kuch.
// 2) Optik asboblar: lupa, mikroskop, teleskop (Kepler), fotoapparat, proyektor — ketma-ket linzalar orqali nurlar.
// 3) Ko'z: akkomodatsiya, yaqindan/uzoqdan ko'rmaslik, ko'zoynak bilan tuzatish.
// Fizika: optics-physics.js (Node'da tekshirilgan). Grafiklar: lens-plots.js.
// ==========================================================================

import { clamp, fmt, createStage, tag, bindRange, arrow } from "./sim-kit.js";
import * as O from "./optics-physics.js";
import { drawFD, drawInv, drawGamma, drawEyeBlur, drawInstrMag } from "./lens-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const RAY = ["#ef4444", "#16a34a", "#2563eb"];

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "bench", tab: "fd", rays: true, fan: false };
const bench = { type: "conv", F: 10, d: 30, h: 4, screen: false, xs: 20, pts: [] };
const ins = { kind: "micro", F1: 4, F2: 8, L: 30, d: 4.8 };
const eye = { defect: "normal", k: 100, glasses: false, G: 0 };
let presetId = null;

const Fb = () => (bench.type === "conv" ? bench.F : -bench.F);
const eyeD = () => (eye.k >= 100 ? Infinity : 0.1 * Math.pow(10, (eye.k / 100) * 2.3));

/* ------------------------------------------------------------------ Ko'rinish (dunyo: cm) */

const view = { s: 1, sy: 1, ox: 0, oy: 0, xMin: -60, xMax: 60 };
const X = (x) => view.ox + (x - view.xMin) * view.s;
const Y = (y) => view.oy - y * view.sy; // vertikal masshtab kattaroq (optik sxemalardagi kabi)
function setView(cw, ch, xMin, xMax) {
  view.xMin = xMin; view.xMax = xMax;
  view.s = (cw - 30) / (xMax - xMin);
  view.ox = 15; view.oy = ch * 0.5;
  view.sy = Math.max(view.s, (ch * 0.4) / 10);
}

function lensSymbol(ctx, c, x, F, H, label) {
  const px = X(x), y0 = Y(H), y1 = Y(-H);
  ctx.save();
  ctx.fillStyle = "rgba(125,211,252,0.18)";
  ctx.beginPath();
  if (F > 0) { ctx.moveTo(px, y0); ctx.quadraticCurveTo(px + 12, (y0 + y1) / 2, px, y1); ctx.quadraticCurveTo(px - 12, (y0 + y1) / 2, px, y0); }
  else { ctx.moveTo(px - 7, y0); ctx.lineTo(px + 7, y0); ctx.quadraticCurveTo(px + 1, (y0 + y1) / 2, px + 7, y1); ctx.lineTo(px - 7, y1); ctx.quadraticCurveTo(px - 1, (y0 + y1) / 2, px - 7, y0); }
  ctx.fill();
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y1); ctx.stroke();
  const hd = 7;
  ctx.beginPath();
  if (F > 0) { ctx.moveTo(px - hd, y0 + hd); ctx.lineTo(px, y0); ctx.lineTo(px + hd, y0 + hd); ctx.moveTo(px - hd, y1 - hd); ctx.lineTo(px, y1); ctx.lineTo(px + hd, y1 - hd); }
  else { ctx.moveTo(px - hd, y0 - hd); ctx.lineTo(px, y0); ctx.lineTo(px + hd, y0 - hd); ctx.moveTo(px - hd, y1 + hd); ctx.lineTo(px, y1); ctx.lineTo(px + hd, y1 + hd); }
  ctx.stroke();
  ctx.restore();
  if (label) tag(ctx, label, px, y0 - 14, { color: c.primary, bg: c.bg, align: "center", font: "700 10.5px Inter, system-ui, sans-serif" });
}

function focusMarks(ctx, c, x, F, color, onlyF = false) {
  const a = Math.abs(F);
  [[x - a, "F"], [x + a, "F"], [x - 2 * a, "2F"], [x + 2 * a, "2F"]].filter(([, l]) => !onlyF || l === "F").forEach(([fx, l]) => {
    if (fx < view.xMin || fx > view.xMax) return;
    ctx.fillStyle = color || c.text2; ctx.beginPath(); ctx.arc(X(fx), Y(0), l === "F" ? 3.5 : 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = c.text3; ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(l, X(fx), Y(0) + 6);
  });
}

function objArrow(ctx, c, x, h, color, dashed = false, candle = false) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3; if (dashed) { ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.85; }
  ctx.beginPath(); ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(h)); ctx.stroke(); ctx.setLineDash([]);
  const dir = h >= 0 ? 1 : -1, hd = 8;
  ctx.beginPath(); ctx.moveTo(X(x), Y(h)); ctx.lineTo(X(x) - hd * 0.6, Y(h) + dir * hd); ctx.lineTo(X(x) + hd * 0.6, Y(h) + dir * hd); ctx.closePath(); ctx.fill();
  if (candle) { const g = ctx.createRadialGradient(X(x), Y(h) - 6, 1, X(x), Y(h) - 6, 12); g.addColorStop(0, "rgba(253,224,71,0.9)"); g.addColorStop(1, "rgba(253,224,71,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(x), Y(h) - 6, 12, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function polyline(ctx, pts, color, width = 1.75, dash = null, alpha = 1) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha; ctx.setLineDash(dash || []);
  ctx.beginPath(); pts.forEach(([x, y], k) => { if (k === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y)); }); ctx.stroke(); ctx.restore();
}

/** Nurlar: chiqishdagi kesmalarni mavhum tasvir tomon orqaga davom ettirish. */
function drawRaySet(ctx, c, lenses, starts, xEnd, finalImg) {
  starts.forEach((r) => {
    const tr = O.traceRay(lenses, r.x, r.y, r.u, xEnd);
    polyline(ctx, tr.pts, r.color, r.w || 1.75, null, r.alpha ?? 1);
    // mavhum tasvir: oxirgi linzadan chiqqan nurni orqaga uzaytirish
    if (finalImg && !finalImg.real && Number.isFinite(finalImg.x)) {
      const n = tr.pts.length, [xl, yl] = tr.pts[n - 2];
      const yv = yl + tr.slope * (finalImg.x - xl);
      polyline(ctx, [[xl, yl], [finalImg.x, yv]], r.color, 1.25, [4, 4], 0.6 * (r.alpha ?? 1));
    }
  });
}

/* ------------------------------------------------------------------ 1) Tasvir yasash */

function benchStarts(F, d, h, lensH) {
  const out = [];
  if (ui.rays) {
    out.push({ x: -d, y: h, u: 0, color: RAY[0], w: 2 });
    out.push({ x: -d, y: h, u: -h / d, color: RAY[1], w: 2 });
    if (Math.abs(d - Math.abs(F)) > 0.3) out.push({ x: -d, y: h, u: -h / (d - F), color: RAY[2], w: 2 }); // fokus orqali (sochuvchida — narigi fokusga yo'naltirilgan)
  }
  if (ui.fan) for (let k = 0; k <= 8; k++) { const yl = -lensH + (2 * lensH * k) / 8; out.push({ x: -d, y: h, u: (yl - h) / d, color: "#f59e0b", w: 1.1, alpha: 0.6 }); }
  return out;
}

function drawBench(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  setView(cw, ch, -60, 60);
  const F = Fb(), d = bench.d, h = bench.h, lensH = 9;
  ctx.save(); ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(X(-60), Y(0)); ctx.lineTo(X(60), Y(0)); ctx.stroke(); ctx.restore();
  focusMarks(ctx, c, 0, F);
  const img = O.thinLens(F, d);
  const xEnd = bench.screen ? bench.xs : 60;
  drawRaySet(ctx, c, [{ x: 0, F }], benchStarts(F, d, h, lensH), xEnd, img.inf ? null : { x: img.f, real: img.real });
  lensSymbol(ctx, c, 0, F, lensH, F > 0 ? "yig‘uvchi" : "sochuvchi");
  objArrow(ctx, c, -d, h, c.warning, false, true);
  tag(ctx, "buyum", X(-d), Y(0) + 18, { color: c.text2, bg: c.bg, align: "center", font: "600 10px Inter, system-ui, sans-serif" });
  if (!img.inf && Math.abs(img.f) < 200) {
    const H = img.m * h;
    if (img.f > view.xMin && img.f < view.xMax && Math.abs(H) < 30) {
      objArrow(ctx, c, img.f, H, c.special, !img.real);
      tag(ctx, img.real ? "haqiqiy tasvir" : "mavhum tasvir", X(img.f), Y(0) + (H > 0 ? 16 : -16), { color: c.special, bg: c.bg, align: "center", font: "600 10px Inter, system-ui, sans-serif" });
    } else tag(ctx, `Tasvir maydondan tashqarida (f = ${fmt(img.f, 0)} cm)`, cw - 12, 16, { color: c.special, bg: c.bg2, align: "right", font: "600 10.5px Inter, system-ui, sans-serif" });
  } else tag(ctx, "Buyum fokusda: nurlar parallel — tasvir yo‘q (cheksizlikda)", cw / 2, 16, { color: c.special, bg: c.bg2, align: "center", font: "600 11px Inter, system-ui, sans-serif" });
  if (bench.screen) {
    const xs = bench.xs;
    ctx.save(); ctx.fillStyle = c.text3; ctx.fillRect(X(xs) - 3, Y(lensH * 1.15), 6, 2 * lensH * 1.15 * view.sy); ctx.restore();
    tag(ctx, "ekran", X(xs), Y(-lensH * 1.15) + 12, { color: c.text2, bg: c.bg, align: "center", font: "600 10px Inter, system-ui, sans-serif" });
    // ekrandagi ko'rinish
    const bw = 120, bh = 84, bx = cw - bw - 10, by = ch - bh - 10;
    ctx.save(); ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill();
    const blur = O.blurDiameter(F, d, lensH * 0.6, xs);
    if (img.real && !img.inf) {
      const scale = xs / img.f, H = img.m * h * scale;
      const px = clamp(Math.abs(blur) * 2.2, 0, 14);
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip(); ctx.filter = `blur(${px.toFixed(1)}px)`;
      const k = Math.min(1, 34 / Math.max(Math.abs(H), 1e-6)) * 3.2;
      ctx.strokeStyle = "#fde68a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx + bw / 2, by + bh / 2 - 0); ctx.lineTo(bx + bw / 2, by + bh / 2 - H * k); ctx.stroke();
      ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.arc(bx + bw / 2, by + bh / 2 - H * k, 5, 0, TAU); ctx.fill();
      ctx.restore();
    } else { ctx.fillStyle = "rgba(253,230,138,0.25)"; ctx.beginPath(); ctx.arc(bx + bw / 2, by + bh / 2, 26, 0, TAU); ctx.fill(); }
    ctx.restore();
    const sharp = img.real && Math.abs(xs - img.f) < 0.6;
    tag(ctx, sharp ? "Ekranda: aniq tasvir" : "Ekranda: xira dog‘", bx + bw / 2, by - 12, { color: sharp ? c.success : c.text2, bg: c.bg, align: "center", font: "700 10.5px Inter, system-ui, sans-serif" });
  }
}

/* ------------------------------------------------------------------ 2) Optik asboblar */

function instrLenses() {
  if (ins.kind === "loupe" || ins.kind === "camera" || ins.kind === "projector") return [{ x: 0, F: ins.F1 }];
  return [{ x: 0, F: ins.F1 }, { x: ins.L, F: ins.F2 }];
}
function instrView() {
  if (ins.kind === "tele") return [-12, ins.L + 22];
  if (ins.kind === "loupe") return [-Math.max(ins.d * 2.6, 22), 22];
  if (ins.kind === "camera" || ins.kind === "projector") { const im = O.thinLens(ins.F1, ins.d); return [-ins.d - 6, Math.max(12, Math.min(90, im.inf ? 40 : im.f + 8))]; }
  return [-Math.max(ins.d + 6, 10), ins.L + 22];
}

function eyeIcon(ctx, c, x) {
  const px = X(x), py = Y(0);
  ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.fillStyle = c.bg;
  ctx.beginPath(); ctx.moveTo(px - 14, py); ctx.quadraticCurveTo(px, py - 14, px + 14, py); ctx.quadraticCurveTo(px, py + 14, px - 14, py); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.text; ctx.beginPath(); ctx.arc(px - 2, py, 4.5, 0, TAU); ctx.fill(); ctx.restore();
}

function drawInstr(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const [x0, x1] = instrView();
  setView(cw, ch, x0, x1);
  const L = instrLenses(), lensH = 8;
  ctx.save(); ctx.strokeStyle = c.borderStrong; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(X(x0), Y(0)); ctx.lineTo(X(x1), Y(0)); ctx.stroke(); ctx.restore();
  L.forEach((l) => focusMarks(ctx, c, l.x, l.F, c.text3, true));
  const xEnd = x1;
  if (ins.kind === "tele") {
    const a = -0.06, starts = [];
    for (let k = -3; k <= 3; k++) starts.push({ x: x0, y: (k * lensH) / 4 - a * (0 - x0), u: a, color: k === 0 ? RAY[1] : "#f59e0b", w: k === 0 ? 2 : 1.3, alpha: k === 0 ? 1 : 0.75 });
    drawRaySet(ctx, c, L, starts, xEnd, null);
    const yi = a * ins.F1; // fokal tekislikdagi oraliq tasvir
    objArrow(ctx, c, ins.F1, yi, c.special, false);
    tag(ctx, "oraliq tasvir", X(ins.F1), Y(yi) + 16, { color: c.special, bg: c.bg, align: "center", font: "600 10px Inter, system-ui, sans-serif" });
    tag(ctx, "uzoqdagi buyumdan parallel nurlar", X(x0) + 6, Y(-lensH) + 16, { color: c.text2, bg: c.bg, font: "600 10px Inter, system-ui, sans-serif" });
  } else {
    const h = ins.kind === "camera" ? 3 : ins.kind === "projector" ? 1.5 : 2;
    const d = ins.d;
    const sys = O.systemImage(L, -d, h);
    const starts = [];
    if (ui.rays) {
      starts.push({ x: -d, y: h, u: 0, color: RAY[0], w: 2 });
      starts.push({ x: -d, y: h, u: -h / d, color: RAY[1], w: 2 });
    }
    if (ui.fan || !ui.rays) for (let k = 0; k <= 6; k++) { const yl = -lensH * 0.8 + (1.6 * lensH * k) / 6; starts.push({ x: -d, y: h, u: (yl - h) / d, color: "#f59e0b", w: 1.1, alpha: 0.6 }); }
    const last = sys.steps[sys.steps.length - 1];
    drawRaySet(ctx, c, L, starts, ins.kind === "camera" || ins.kind === "projector" ? (last && last.real ? last.x : xEnd) : xEnd, last && !last.inf ? { x: last.x, real: last.real } : null);
    objArrow(ctx, c, -d, h, c.warning, false, true);
    sys.steps.forEach((s, k) => {
      const isLast = k === sys.steps.length - 1;
      if (!Number.isFinite(s.x) || s.x < x0 || s.x > x1 || Math.abs(s.y) > 11) { if (isLast && Number.isFinite(s.x)) { const lx = L[L.length - 1].x, rel = s.x - lx, nm = L.length > 1 ? "okulyardan" : ins.kind === "loupe" ? "lupadan" : "obyektivdan"; tag(ctx, `Yakuniy ${s.real ? "haqiqiy" : "mavhum"} tasvir: ${nm} ${fmt(Math.abs(rel), 0)} cm ${rel < 0 ? "chapda" : "o‘ngda"}, ${fmt(Math.abs(s.y / h), 1)}× katta`, cw - 12, 16, { color: c.special, bg: c.bg2, align: "right", font: "600 10.5px Inter, system-ui, sans-serif" }); } return; }
      objArrow(ctx, c, s.x, s.y, c.special, !s.real);
      tag(ctx, isLast ? (s.real ? "tasvir" : "mavhum tasvir") : "oraliq tasvir", X(s.x), Y(0) + (s.y > 0 ? 16 : -16), { color: c.special, bg: c.bg, align: "center", font: "600 10px Inter, system-ui, sans-serif" });
    });
    if (ins.kind === "camera" || ins.kind === "projector") {
      const xs = last && last.real ? last.x : x1 - 4;
      ctx.save(); ctx.fillStyle = c.text3; ctx.fillRect(X(xs) - 3, Y(lensH * 1.2), 6, 2 * lensH * 1.2 * view.sy); ctx.restore();
      tag(ctx, ins.kind === "camera" ? "matritsa (fotoplyonka)" : "ekran", X(xs), Y(-lensH * 1.2) + 12, { color: c.text2, bg: c.bg, align: "center", font: "600 10px Inter, system-ui, sans-serif" });
    }
  }
  L.forEach((l, k) => lensSymbol(ctx, c, l.x, l.F, lensH, L.length > 1 ? (k === 0 ? "obyektiv" : "okulyar") : ins.kind === "loupe" ? "lupa" : "obyektiv"));
  if (ins.kind === "loupe" || ins.kind === "micro" || ins.kind === "tele") eyeIcon(ctx, c, x1 - 6);
}

/* ------------------------------------------------------------------ 3) Ko'z */

function drawEye(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const d = eyeD(), G = eye.glasses ? eye.G : 0;
  const v = O.eyeView(d, eye.defect, G);
  const narrow = cw < 560;
  const ex = narrow ? cw * 0.62 : cw * 0.6, ey = ch * 0.44, Re = Math.min(ch * 0.3, cw * 0.17);
  const lensX = ex - Re * 0.78, retX = ex + Re * 0.95;
  // ko'z soqqasi
  ctx.save(); ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(ex, ey, Re * (eye.defect === "myopia" ? 1.06 : eye.defect === "hyperopia" ? 0.94 : 1), Re, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex, ey, Re * (eye.defect === "myopia" ? 1.06 : eye.defect === "hyperopia" ? 0.94 : 1) - 2, -0.6, 0.6); ctx.stroke();
  ctx.restore();
  const retinaX = ex + (Re * (eye.defect === "myopia" ? 1.06 : eye.defect === "hyperopia" ? 0.94 : 1) - 2) * Math.cos(0);
  tag(ctx, "to‘r parda", retinaX + 4, ey - Re * 0.75, { color: "#ef4444", bg: c.bg, font: "600 10px Inter, system-ui, sans-serif" });
  // gavhar (linza) — akkomodatsiya bilan qalinlashadi
  const thick = 7 + v.accommodation * 2.2;
  ctx.save(); ctx.fillStyle = "rgba(125,211,252,0.45)"; ctx.strokeStyle = c.primary; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(lensX, ey, thick, Re * 0.42, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
  tag(ctx, "gavhar", lensX, ey + Re * 0.42 + 14, { color: c.primary, bg: c.bg, align: "center", font: "600 10px Inter, system-ui, sans-serif" });
  // ko'z ichida nurlar: tasvir nuqtasi
  const scaleIn = (retinaX - lensX) / v.Lr;
  const ix = Number.isFinite(v.img) ? lensX + v.img * scaleIn : retinaX + 400;
  const ap = Re * 0.32;
  // tashqi nurlar
  const gx = lensX - (narrow ? 40 : 60);
  const srcX = Number.isFinite(v.V) && Math.abs(v.V) > 0.02 ? lensX - clamp(1 / Math.abs(v.V), 0.05, 8) * (narrow ? 60 : 90) : -1e4;
  ctx.save(); ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.85;
  [-1, -0.5, 0, 0.5, 1].forEach((t) => {
    const yl = ey + t * ap;
    // kiruvchi
    let x0 = 10, y0;
    if (srcX > -1e3 && v.V < 0) { const k = (lensX - x0) / (lensX - srcX); y0 = ey + t * ap * k; } else if (srcX > -1e3 && v.V > 0) { const k = (srcX - x0) / (srcX - lensX); y0 = ey + t * ap * (k); } else y0 = yl;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lensX, yl);
    // ichida
    const endX = Math.min(ix, retinaX + Re * 0.3);
    const yEnd = ey + t * ap * (1 - (endX - lensX) / (ix - lensX));
    ctx.lineTo(endX, yEnd); ctx.stroke();
  });
  ctx.restore();
  if (Number.isFinite(v.img) && ix < retinaX + Re * 0.3) { ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(ix, ey, 3.5, 0, TAU); ctx.fill(); }
  // ko'zoynak
  if (eye.glasses && G !== 0) {
    setView(cw, ch, -60, 60); // faqat lensSymbol uchun
    const H = Re * 0.55 / view.sy;
    const gxw = (gx - view.ox) / view.s + view.xMin;
    view.oy = ey;
    lensSymbol(ctx, c, gxw, G, H, `${G > 0 ? "+" : ""}${fmt(G, 2)} D`);
  }
  // to'r pardadagi dog'
  const blurPx = clamp(v.blur * 1e6 / 6, 0, 18);
  ctx.save(); ctx.fillStyle = "rgba(245,158,11,0.35)"; ctx.beginPath(); ctx.ellipse(retinaX - 2, ey, 3, Math.max(2, blurPx), 0, 0, TAU); ctx.fill(); ctx.restore();
  // ko'z ko'rgan tasvir
  const bw = narrow ? 104 : 150, bh = 60, bx = 10, by = ch - bh - 10;
  ctx.save(); ctx.fillStyle = "#f8fafc"; ctx.strokeStyle = c.border; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
  ctx.filter = `blur(${(blurPx * 0.35).toFixed(1)}px)`; ctx.fillStyle = "#0f172a"; ctx.font = `800 ${narrow ? 15 : 20}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("OLIYFIZIKA", bx + bw / 2, by + bh / 2);
  ctx.restore();
  tag(ctx, v.sharp ? "Ko‘z aniq ko‘radi" : "Xira ko‘rinadi", bx + bw / 2, by - 12, { color: v.sharp ? c.success : c.danger, bg: c.bg, align: "center", font: "700 10.5px Inter, system-ui, sans-serif" });
  tag(ctx, `Buyum: ${Number.isFinite(d) ? (d < 1 ? `${fmt(d * 100, 0)} cm` : `${fmt(d, 1)} m`) : "∞ (uzoqda)"}`, 12, 16, { color: c.text, bg: c.bg2, font: "700 11px Inter, system-ui, sans-serif" });
}

function draw(ctx, stage) {
  ctx.fillStyle = stage.colors.bg; ctx.fillRect(0, 0, stage.w, stage.h);
  if (ui.mode === "bench") drawBench(ctx, stage); else if (ui.mode === "instr") drawInstr(ctx, stage); else drawEye(ctx, stage);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.42, vh * 0.42), 240, 340)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  bench: [["fd", "f(d)", "Tasvirgacha masofa f(d)", "Buyum fokusga yaqinlashgan sari tasvir uzoqlashadi (d = F da — cheksizlikda). d < F bo‘lsa, tasvir mavhum (f < 0)."], ["inv", "1/f(1/d)", "Lab: linzaning optik kuchini aniqlash", "1/d + 1/f = D — to‘g‘ri chiziq. Buyum va ekranni siljitib, aniq tasvir hosil bo‘lganda «O‘lchovni yozish» ni bosing; chiziq o‘qlarni D nuqtasida kesadi."], ["gamma", "Γ(d)", "Kattalashtirish Γ = f/d", "d > 2F — kichraygan, F < d < 2F — kattalashgan haqiqiy, d < F — kattalashgan mavhum tasvir (lupa)."]],
  instr: [["mag", "Γ", "Asbobning kattalashtirishi", "Okulyar (yoki lupa) fokus masofasi kichik bo‘lsa, kattalashtirish ortadi."]],
  eye: [["blur", "Aniqlik", "Buyumgacha masofa va ko‘rish aniqligi", "Yashil soha — ko‘z aniq ko‘radigan masofalar (yaqin nuqtadan uzoq nuqtagacha). Ko‘zoynak bu sohani siljitadi."]],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[ui.mode].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const t = TABS[ui.mode].find((x) => x[0] === tab) || TABS[ui.mode][0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  $("[data-meas-tools]").hidden = !(ui.mode === "bench" && ui.tab === "inv");
  graph.render();
}
function drawGraphCanvas(ctx, st) {
  if (ui.mode === "bench") {
    if (ui.tab === "inv") drawInv(ctx, st, { F: Fb(), pts: bench.pts, d: bench.d });
    else if (ui.tab === "gamma") drawGamma(ctx, st, { F: Fb(), d: bench.d });
    else drawFD(ctx, st, { F: Fb(), d: bench.d });
  } else if (ui.mode === "instr") drawInstrMag(ctx, st, { ...ins });
  else drawEyeBlur(ctx, st, { defect: eye.defect, G: eye.glasses ? eye.G : 0, d: eyeD() });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const cm = (x, dd = 1) => (Number.isFinite(x) ? `${fmt(x, dd)}<small>cm</small>` : "∞");

function describe(img, F) {
  if (img.inf) return "tasvir yo‘q (cheksizlikda)";
  const size = Math.abs(img.m) > 1.001 ? "kattalashgan" : Math.abs(img.m) < 0.999 ? "kichraygan" : "teng";
  return `${img.real ? "haqiqiy" : "mavhum"}, ${img.upright ? "to‘g‘ri" : "teskari"}, ${size}`;
}

function updateReadouts() {
  if (ui.mode === "bench") {
    const F = Fb(), img = O.thinLens(F, bench.d);
    setRO("r1", "Buyumgacha <i>d</i>", cm(bench.d), `F = ${fmt(F, 1)} cm`);
    setRO("r2", "Tasvirgacha <i>f</i>", img.inf ? "∞" : cm(img.f), img.inf ? "d = F" : img.real ? "haqiqiy tasvir (linzaning narigi tomonida)" : "mavhum tasvir (buyum tomonida)");
    setRO("r3", "Kattalashtirish <i>Γ</i>", img.inf ? "∞" : `${fmt(Math.abs(img.m), 2)}`, img.inf ? "" : `H = Γ·h = ${fmt(Math.abs(img.m * bench.h), 1)} cm`);
    setRO("r4", "Tasvir xarakteri", img.inf ? "—" : (img.real ? "haqiqiy" : "mavhum"), describe(img, F));
    setRO("r5", "Optik kuch <i>D</i>", `${fmt(100 / F, 1)}<small>dptr</small>`, "D = 1/F (F metrda)");
    if (bench.screen) {
      const sharp = img.real && Math.abs(bench.xs - img.f) < 0.6;
      setRO("r6", "Ekran", `${fmt(bench.xs, 1)}<small>cm</small>`, sharp ? "Aniq tasvir — ekran tasvir joyida" : img.real ? `Aniq bo‘lishi uchun ${fmt(img.f, 1)} cm ga suring` : "Mavhum tasvirni ekranda ushlab bo‘lmaydi", sharp ? "" : "muted");
    } else setRO("r6", "Tekshiruv: 1/d + 1/f", `${fmt(100 * (1 / bench.d + (img.inf ? 0 : 1 / img.f)), 2)}<small>dptr</small>`, `= 1/F = ${fmt(100 / F, 2)} dptr`);
  } else if (ui.mode === "instr") {
    const L = instrLenses();
    const k = ins.kind;
    if (k === "tele") {
      setRO("r1", "Kattalashtirish <i>Γ</i>", `${fmt(O.telescopeMag(ins.F1, ins.F2), 1)}<small>×</small>`, "Γ = F₁/F₂ (burchakli)");
      setRO("r2", "Obyektiv <i>F</i>₁", cm(ins.F1), "Uzun fokusli");
      setRO("r3", "Okulyar <i>F</i>₂", cm(ins.F2), "Qisqa fokusli");
      setRO("r4", "Teleskop uzunligi", cm(ins.L), `Normal sozlash: F₁ + F₂ = ${fmt(ins.F1 + ins.F2, 1)} cm`);
      const ok = Math.abs(ins.L - ins.F1 - ins.F2) < 0.6;
      setRO("r5", "Chiqish dastasi", ok ? "parallel" : "parallel emas", ok ? "Ko‘z zo‘riqmasdan ko‘radi" : "Okulyarni siljiting (L = F₁ + F₂)", ok ? "" : "muted");
      setRO("r6", "Oraliq tasvir", cm(ins.F1), "Obyektivning fokal tekisligida, teskari");
    } else {
      const h = 1, sys = O.systemImage(L, -ins.d, h), last = sys.steps[sys.steps.length - 1], first = sys.steps[0];
      const Gamma = k === "loupe" ? O.loupeMag(ins.F1 / 100) : k === "micro" ? O.microscopeMag(ins.F1 / 100, ins.F2 / 100, ins.L / 100) : Math.abs(last.y / h);
      setRO("r1", "Kattalashtirish <i>Γ</i>", `${fmt(Gamma, 1)}<small>×</small>`, k === "loupe" ? "Γ = d₀/F (d₀ = 25 cm)" : k === "micro" ? "Γ ≈ (Δ/F₁)·(d₀/F₂)" : "Γ = f/d (chiziqli)");
      setRO("r2", L.length > 1 ? "Obyektiv <i>F</i>₁" : "Linza <i>F</i>", cm(ins.F1), `D = ${fmt(100 / ins.F1, 1)} dptr`);
      setRO("r3", "Buyumgacha <i>d</i>", cm(ins.d), k === "loupe" ? "Buyum fokus ichida (d < F)" : k === "micro" ? "F₁ < d < 2F₁" : "");
      setRO("r4", L.length > 1 ? "Oraliq tasvir" : "Tasvir", first.inf ? "∞" : cm(first.x), first.real ? "haqiqiy" : "mavhum");
      setRO("r5", L.length > 1 ? "Okulyar <i>F</i>₂" : "Tasvir balandligi", L.length > 1 ? cm(ins.F2) : `${fmt(Math.abs(first.y * 3), 1)}<small>cm</small>`, L.length > 1 ? `Linzalar oralig‘i L = ${fmt(ins.L, 1)} cm` : "buyum 3 cm");
      setRO("r6", "Yakuniy tasvir", last.inf ? "∞" : cm(last.x), last.inf ? "Ko‘zga parallel nurlar" : last.real ? "haqiqiy" : "mavhum — ko‘z ko‘radi");
    }
  } else {
    const d = eyeD(), G = eye.glasses ? eye.G : 0, v = O.eyeView(d, eye.defect, G), fn = O.farNear(eye.defect);
    setRO("r1", "Buyumgacha", Number.isFinite(d) ? (d < 1 ? cm(d * 100, 0) : `${fmt(d, 1)}<small>m</small>`) : "∞", v.sharp ? "aniq ko‘rinadi" : "xira", v.sharp ? "" : "orange");
    setRO("r2", "Akkomodatsiya", `${fmt(v.accommodation, 2)}<small>dptr</small>`, `Ko‘z optik kuchi ${fmt(v.P, 1)} D (max +${O.EYE.A} D)`);
    setRO("r3", "Uzoq nuqta", Number.isFinite(fn.far) ? cm(fn.far * 100, 0) : "∞", "Ko‘zoynaksiz");
    setRO("r4", "Yaqin nuqta", cm(fn.near * 100, 0), "Normal ko‘zda ≈ 25 cm (maktab: d₀)");
    setRO("r5", "To‘r pardadagi dog‘", `${fmt(v.blur * 1e6, 1)}<small>μm</small>`, "≤ 6 μm — aniq");
    const rx = O.prescription(eye.defect);
    setRO("r6", "Ko‘zoynak", eye.glasses ? `${G > 0 ? "+" : ""}${fmt(G, 2)}<small>D</small>` : "yo‘q", eye.defect === "normal" ? "Normal ko‘zga kerak emas" : `Kerakli: ${rx > 0 ? "+" : ""}${fmt(rx, 2)} D (${rx > 0 ? "yig‘uvchi" : "sochuvchi"})`);
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "bench") { const img = O.thinLens(Fb(), bench.d); t = img.inf ? "Tasvir yo‘q" : img.real ? "Haqiqiy tasvir" : "Mavhum tasvir"; tone = img.real ? "green" : "purple"; }
  else if (ui.mode === "instr") { t = { loupe: "Lupa", micro: "Mikroskop", tele: "Teleskop", camera: "Fotoapparat", projector: "Proyektor" }[ins.kind]; tone = "blue"; }
  else { const v = O.eyeView(eyeD(), eye.defect, eye.glasses ? eye.G : 0); t = v.sharp ? "Aniq ko‘radi" : "Xira ko‘radi"; tone = v.sharp ? "green" : "orange"; }
  el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "bench") {
    const F = Fb(), d = bench.d, img = O.thinLens(F, d);
    p.push(`<p>Tasvir uchta <b>xarakterli nur</b> yordamida yasaladi: <span style="color:${RAY[0]}">optik o‘qqa parallel nur</span> linzadan keyin fokusdan o‘tadi; <span style="color:${RAY[1]}">optik markazdan o‘tgan nur</span> sinmaydi; <span style="color:${RAY[2]}">fokusdan o‘tgan nur</span> linzadan keyin o‘qqa parallel ketadi.${F < 0 ? " Sochuvchi linzada nurlar «go‘yo fokusdan chiqqandek» tarqaladi — tasvir doim mavhum, to‘g‘ri va kichraygan." : ""}</p>`);
    if (F > 0) p.push(`<p>${d > 2 * F ? "d > 2F: tasvir haqiqiy, teskari, kichraygan (fotoapparat, ko‘z)." : Math.abs(d - 2 * F) < 0.3 ? "d = 2F: tasvir haqiqiy, teskari, buyumga teng." : d > F + 0.3 ? "F < d < 2F: tasvir haqiqiy, teskari, kattalashgan (proyektor)." : Math.abs(d - F) <= 0.3 ? "d = F: nurlar parallel, tasvir hosil bo‘lmaydi." : "d < F: tasvir mavhum, to‘g‘ri, kattalashgan (lupa)."}</p>`);
    if (bench.screen) p.push("<p>Haqiqiy tasvirni ekranda ushlash mumkin: ekran tasvir joyida bo‘lsa aniq, aks holda xira dog‘ ko‘rinadi. Mavhum tasvir ekranda hosil bo‘lmaydi.</p>");
    void img;
  } else if (ui.mode === "instr") {
    const k = ins.kind;
    if (k === "loupe") p.push("<p><b>Lupa</b> — qisqa fokusli yig‘uvchi linza. Buyum fokus ichiga qo‘yiladi, ko‘z kattalashgan mavhum to‘g‘ri tasvirni ko‘radi. Γ = 25 cm / F.</p>");
    if (k === "micro") p.push("<p><b>Mikroskop</b>: obyektiv buyumning kattalashgan haqiqiy teskari (oraliq) tasvirini beradi, okulyar uni lupa kabi yana kattalashtiradi. Umumiy kattalashtirish — ikkalasining ko‘paytmasi.</p>");
    if (k === "tele") p.push("<p><b>Kepler teleskopi</b>: uzun fokusli obyektiv uzoqdagi buyumning tasvirini fokal tekisligida hosil qiladi, okulyar uni burchakli kattalashtiradi: Γ = F₁/F₂. Chiqishda nurlar parallel — ko‘z zo‘riqmaydi.</p>");
    if (k === "camera") p.push("<p><b>Fotoapparat</b>: uzoqdagi buyumning kichraygan haqiqiy teskari tasviri matritsada hosil bo‘ladi. Fokuslash — obyektivni matritsaga nisbatan siljitish.</p>");
    if (k === "projector") p.push("<p><b>Proyektor</b>: slayd F va 2F orasida joylashadi — ekranda kattalashgan haqiqiy teskari tasvir (shuning uchun slayd teskari qo‘yiladi).</p>");
  } else {
    p.push("<p>Ko‘z — optik tizim: gavhar to‘r pardada buyumning tasvirini hosil qiladi. Turli masofadagi buyumlarni ko‘rish uchun gavhar egriligini o‘zgartiradi — bu <b>akkomodatsiya</b>.</p>");
    if (eye.defect === "myopia") p.push("<p><b>Yaqindan ko‘ruvchi (miopiya)</b>: ko‘z soqqasi uzunroq, uzoqdagi buyum tasviri to‘r parda oldida hosil bo‘ladi. Tuzatish — <b>sochuvchi</b> linzali ko‘zoynak (manfiy dioptriya).</p>");
    if (eye.defect === "hyperopia") p.push("<p><b>Uzoqdan ko‘ruvchi (gipermetropiya)</b>: ko‘z soqqasi qisqaroq, yaqindagi buyum tasviri to‘r parda orqasida hosil bo‘ladi. Tuzatish — <b>yig‘uvchi</b> linzali ko‘zoynak (musbat dioptriya).</p>");
  }
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const f = $("[data-formula]");
  const html = ui.mode === "bench" ? "<small>Linza formulasi</small> 1/F = 1/d + 1/f" : ui.mode === "instr" ? (ins.kind === "tele" ? "<small>Teleskop</small> Γ = F₁ / F₂" : ins.kind === "micro" ? "<small>Mikroskop</small> Γ = Γ₁·Γ₂" : ins.kind === "loupe" ? "<small>Lupa</small> Γ = d₀ / F" : "<small>Linza formulasi</small> 1/F = 1/d + 1/f") : "<small>Optik kuch</small> D = 1/F";
  if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Boshqaruv */

const bFc = bindRange($("#bF"), $("#bFOut"), (v) => `${fmt(v, 1)} cm`, (v) => { bench.F = v; customized(); refresh(); });
const bDc = bindRange($("#bD"), $("#bDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { bench.d = v; customized(); refresh(); });
const bHc = bindRange($("#bH"), $("#bHOut"), (v) => `${fmt(v, 1)} cm`, (v) => { bench.h = v; customized(); refresh(); });
const bSc = bindRange($("#bS"), $("#bSOut"), (v) => `${fmt(v, 1)} cm`, (v) => { bench.xs = v; customized(); refresh(); });
document.querySelectorAll("[data-ltype-value]").forEach((b) => b.addEventListener("click", () => { bench.type = b.dataset.ltypeValue; syncAll(); customized(); refresh(); }));
$("[data-screen]").addEventListener("change", (e) => { bench.screen = e.target.checked; syncAll(); customized(); refresh(); });
$("[data-rays]").addEventListener("change", (e) => { ui.rays = e.target.checked; refresh(); });
$("[data-fan]").addEventListener("change", (e) => { ui.fan = e.target.checked; refresh(); });
$("[data-meas-add]").addEventListener("click", () => { const img = O.thinLens(Fb(), bench.d); if (img.real && !img.inf) { const f = bench.screen ? bench.xs : img.f; bench.pts.push({ d: bench.d, f }); } graph.render(); });
$("[data-meas-clear]").addEventListener("click", () => { bench.pts = []; graph.render(); });

const iF1 = bindRange($("#iF1"), $("#iF1Out"), (v) => `${fmt(v, 1)} cm`, (v) => { ins.F1 = v; customized(); refresh(); });
const iF2 = bindRange($("#iF2"), $("#iF2Out"), (v) => `${fmt(v, 1)} cm`, (v) => { ins.F2 = v; customized(); refresh(); });
const iL = bindRange($("#iL"), $("#iLOut"), (v) => `${fmt(v, 1)} cm`, (v) => { ins.L = v; customized(); refresh(); });
const iD = bindRange($("#iD"), $("#iDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { ins.d = v; customized(); refresh(); });

const eDc = bindRange($("#eD"), $("#eDOut"), (v) => { const d = v >= 100 ? Infinity : 0.1 * Math.pow(10, (v / 100) * 2.3); return Number.isFinite(d) ? (d < 1 ? `${fmt(d * 100, 0)} cm` : `${fmt(d, 1)} m`) : "∞"; }, (v) => { eye.k = v; customized(); refresh(); });
const eGc = bindRange($("#eG"), $("#eGOut"), (v) => `${v > 0 ? "+" : ""}${fmt(v, 2)} D`, (v) => { eye.G = v; customized(); refresh(); });
document.querySelectorAll("[data-defect-value]").forEach((b) => b.addEventListener("click", () => { eye.defect = b.dataset.defectValue; syncAll(); customized(); refresh(); }));
$("[data-glasses]").addEventListener("change", (e) => { eye.glasses = e.target.checked; syncAll(); customized(); refresh(); });
$("[data-rx]").addEventListener("click", () => { eye.glasses = eye.defect !== "normal"; eye.G = Math.round(O.prescription(eye.defect) * 4) / 4; syncAll(); customized(); refresh(); });

// Sudrash: buyum va ekran
let drag = null;
stage.canvas.addEventListener("pointerdown", (ev) => {
  if (ui.mode !== "bench") return;
  const r = stage.canvas.getBoundingClientRect(), px = ev.clientX - r.left;
  const dObj = Math.abs(px - X(-bench.d)), dScr = bench.screen ? Math.abs(px - X(bench.xs)) : 1e9;
  if (Math.min(dObj, dScr) > 22) return;
  drag = dScr < dObj ? "screen" : "obj";
  try { stage.canvas.setPointerCapture(ev.pointerId); } catch { /* */ }
});
stage.canvas.addEventListener("pointermove", (ev) => {
  if (ui.mode !== "bench") return;
  const r = stage.canvas.getBoundingClientRect(), px = ev.clientX - r.left;
  if (!drag) { const near = Math.abs(px - X(-bench.d)) < 22 || (bench.screen && Math.abs(px - X(bench.xs)) < 22); stage.canvas.style.cursor = near ? "ew-resize" : ""; return; }
  const x = (px - view.ox) / view.s + view.xMin;
  if (drag === "obj") { bench.d = Math.round(clamp(-x, 1, 58) * 2) / 2; bDc.set(bench.d); }
  else { bench.xs = Math.round(clamp(x, 2, 58) * 2) / 2; bSc.set(bench.xs); }
  customized(); refresh();
});
const endDrag = () => { drag = null; };
stage.canvas.addEventListener("pointerup", endDrag);
stage.canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  far: { mode: "bench", title: "Buyum 2F dan uzoqda", lesson: "d > 2F: tasvir haqiqiy, teskari, kichraygan — fotoapparat va ko‘z shunday ishlaydi. Buyumni linzaga yaqinlashtirib, tasvir qanday o‘zgarishini kuzating.", set: () => Object.assign(bench, { type: "conv", F: 10, d: 30, h: 4, screen: false }) },
  between: { mode: "bench", title: "Buyum F va 2F orasida", lesson: "F < d < 2F: tasvir haqiqiy, teskari, kattalashgan va 2F dan uzoqda hosil bo‘ladi — proyektor prinsipi.", set: () => Object.assign(bench, { type: "conv", F: 10, d: 15, h: 3, screen: false }) },
  inside: { mode: "bench", title: "Buyum fokus ichida (lupa)", lesson: "d < F: nurlar linzadan keyin tarqaladi, ularning davomi (punktir) kesishgan joyda mavhum, to‘g‘ri, kattalashgan tasvir hosil bo‘ladi.", set: () => Object.assign(bench, { type: "conv", F: 12, d: 7, h: 3, screen: false }) },
  diverging: { mode: "bench", title: "Sochuvchi linza", lesson: "Sochuvchi linza har doim mavhum, to‘g‘ri, kichraygan tasvir beradi. Buyumni har qanday masofaga qo‘yib tekshiring.", set: () => Object.assign(bench, { type: "div", F: 12, d: 25, h: 5, screen: false }) },
  lab: { mode: "bench", title: "Lab: linzaning optik kuchi", lesson: "Ekranni suring va aniq tasvir hosil qiling, so‘ng «O‘lchovni yozish» ni bosing. Buyumni boshqa joyga qo‘yib takrorlang. 1/d + 1/f = D — grafikdagi chiziq optik kuchni beradi.", set: () => Object.assign(bench, { type: "conv", F: 12.5, d: 30, h: 3, screen: true, xs: 15, pts: [] }), tab: "inv" },
  loupe: { mode: "instr", title: "Lupa", lesson: "Buyum lupaning fokusi ichida: ko‘z kattalashgan mavhum to‘g‘ri tasvirni ko‘radi.", set: () => Object.assign(ins, { kind: "loupe", F1: 8, d: 5.5 }) },
  micro: { mode: "instr", title: "Mikroskop", lesson: "Obyektiv (F₁ = 4 cm) oraliq haqiqiy tasvir beradi, okulyar (F₂ = 8 cm) uni lupa kabi kattalashtiradi.", set: () => Object.assign(ins, { kind: "micro", F1: 4, F2: 8, L: 30, d: 4.8 }) },
  tele: { mode: "instr", title: "Teleskop (Kepler)", lesson: "Uzoqdagi buyumdan parallel nurlar keladi. Obyektiv tasvirni fokal tekislikda beradi, okulyar burchakni kattalashtiradi: Γ = F₁/F₂.", set: () => Object.assign(ins, { kind: "tele", F1: 40, F2: 8, L: 48 }) },
  camera: { mode: "instr", title: "Fotoapparat", lesson: "Buyum uzoqda (d > 2F): matritsada kichraygan teskari haqiqiy tasvir.", set: () => Object.assign(ins, { kind: "camera", F1: 5, d: 40 }) },
  projector: { mode: "instr", title: "Proyektor", lesson: "Slayd F va 2F orasida: ekranda kattalashgan teskari tasvir.", set: () => Object.assign(ins, { kind: "projector", F1: 8, d: 10 }) },
  eyeNormal: { mode: "eye", title: "Normal ko‘z va akkomodatsiya", lesson: "Buyumni yaqinlashtiring: gavhar qalinlashadi (akkomodatsiya) va tasvir to‘r pardada qoladi — 25 cm gacha aniq.", set: () => Object.assign(eye, { defect: "normal", k: 100, glasses: false, G: 0 }) },
  myopia: { mode: "eye", title: "Yaqindan ko‘ruvchi ko‘z", lesson: "Uzoqdagi buyum xira: tasvir to‘r parda oldida. «Kerakli ko‘zoynakni tanlash» ni bosing — sochuvchi linza tasvirni to‘r pardaga suradi.", set: () => Object.assign(eye, { defect: "myopia", k: 100, glasses: false, G: 0 }) },
  hyperopia: { mode: "eye", title: "Uzoqdan ko‘ruvchi ko‘z", lesson: "Kitob (25 cm) xira: tasvir to‘r parda orqasida. Yig‘uvchi linzali ko‘zoynak buni tuzatadi.", set: () => Object.assign(eye, { defect: "hyperopia", k: Math.round((Math.log10(0.25 / 0.1) / 2.3) * 100), glasses: false, G: 0 }) },
};
const GROUPS = [["Tasvir yasash", ["far", "between", "inside", "diverging", "lab"]], ["Optik asboblar", ["loupe", "micro", "tele", "camera", "projector"]], ["Ko‘z", ["eyeNormal", "myopia", "hyperopia"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([g, ids]) => `<span class="sim-presets__label">${g}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const INSTR_TITLE = { loupe: "Lupa", micro: "Mikroskop", tele: "Teleskop", camera: "Fotoapparat", projector: "Proyektor" };
function syncAll() {
  document.querySelectorAll("[data-ltype-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ltypeValue === bench.type)));
  bFc.set(bench.F); bDc.set(bench.d); bHc.set(bench.h); bSc.set(bench.xs); $("[data-screen]").checked = bench.screen; $("[data-screen-ctl]").hidden = !bench.screen;
  $("[data-instr-title]").textContent = INSTR_TITLE[ins.kind];
  const two = ins.kind === "micro" || ins.kind === "tele";
  document.querySelector('[data-ictl="F2"]').hidden = !two; document.querySelector('[data-ictl="L"]').hidden = !two; document.querySelector('[data-ictl="d"]').hidden = ins.kind === "tele";
  $("[data-f1-label]").textContent = two ? "Obyektiv F₁" : "Linza F";
  const dIn = $("#iD"); dIn.max = ins.kind === "camera" ? 60 : ins.kind === "projector" ? 30 : 20;
  iF1.set(ins.F1); iF2.set(ins.F2); iL.set(ins.L); iD.set(ins.d);
  document.querySelectorAll("[data-defect-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.defectValue === eye.defect)));
  eDc.set(eye.k); eGc.set(eye.G); $("[data-glasses]").checked = eye.glasses; $("[data-glass-ctl]").hidden = !eye.glasses;
  $("[data-rays]").checked = ui.rays; $("[data-fan]").checked = ui.fan;
}
const MODE_HINT = { bench: "Buyumni va ekranni suring — tasvir qanday o‘zgaradi?", instr: "Optik asboblarda nurlar yo‘li", eye: "Ko‘z, akkomodatsiya va ko‘zoynak" };
function setMode(m) {
  ui.mode = m;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(m); });
  $("[data-mode-hint]").textContent = MODE_HINT[m];
  setupTabs(); setTab(TABS[m][0][0]);
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset({ bench: "far", instr: "micro", eye: "eyeNormal" }[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  setMode(p.mode); p.set();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll();
  if (p.tab) setTab(p.tab);
  refresh();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "far");
void arrow;
