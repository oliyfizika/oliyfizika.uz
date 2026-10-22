// ==========================================================================
// Elektron difraksiyasi — virtual laboratoriya (simulations/davisson-germer.html)
// 1) Devisson–Jermer: vakuum kamera, elektron to‘pi (U dastagi), nikel kristali, aylanuvchi kollektor (sudrash,
//    ±tugmalar, avtomatik aylantirish), galvanometr; qutb diagrammasi va I(φ) (har bir U — alohida egri chiziq).
// 2) Grafit plyonka: trubka sxemasi, lyuminessent ekrandagi Debay–Sherrer halqalari, shtangensirkul (jag‘lar
//    suriladi, 0,1 mm), shtangensirkul jurnali.
// 3) Laboratoriya daftari → LaTeX uslubidagi hisobot (KaTeX HTML → PDF, .tex manba).
// Fizika: dg-physics.js, hisob: dg-lab.js (Node’da tekshirilgan); hisobot: dg-report.js + labreport.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, angleArc, sci } from "./sim-kit.js";
import * as P from "./dg-physics.js";
import * as L from "./dg-lab.js";
import { buildDGDoc, SITE_URL, SITE_LABEL, DOC_LABEL } from "./dg-report.js";
import { renderHTML, renderTeX } from "./labreport.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const LBL = "italic 700 13px Inter, system-ui, sans-serif";
const MONO = (s) => `700 ${s}px "SFMono-Regular", Menlo, Consolas, ui-monospace, monospace`;
const PAL = ["#2563eb", "#ea580c", "#16a34a", "#9333ea", "#0891b2", "#e11d48", "#ca8a04", "#64748b"];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* xotira yo‘q */ } },
};

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "dg", t: 0 };
const dg = { U: 54, phi: 30, scan: false, cursor: null, curves: store.get("of-dg-curves-v1", {}) };
const gr = { U: 4, jL: -12, jR: 12, active: "R" };
const J_KEY = "of-dg-journal-v1";
let journal = store.get(J_KEY, []);
let presetId = null;
const geo = {};

/* ------------------------------------------------------------------ Yordamchilar */

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); }
function tagIn(ctx, text, x, y, cw, o) {
  ctx.save(); ctx.font = o.font || MID; const w = ctx.measureText(text).width + 2 * (o.pad ?? 6); ctx.restore();
  let x0 = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  x0 = clamp(x0, 4, cw - 4 - w); tag(ctx, text, x0, y, { ...o, align: "left" });
}
function chipBtn(ctx, c, x, y, text, on, w, h = 24) {
  ctx.save(); ctx.font = MID; const tw = w || ctx.measureText(text).width + 14;
  ctx.fillStyle = on ? c.primary : c.dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)"; ctx.beginPath(); ctx.roundRect(x, y, tw, h, 6); ctx.fill();
  ctx.fillStyle = on ? "#fff" : c.text; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x + tw / 2, y + h / 2 + 0.5); ctx.restore();
  return { x0: x, x1: x + tw, y0: y, y1: y + h };
}
function knob(ctx, c, x, y, r, frac, label) {
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.border; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, 405 * DEG); ctx.stroke();
  ctx.strokeStyle = c.primary; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, (135 + 270 * clamp(frac, 0, 1)) * DEG); ctx.stroke();
  const a = (135 + 270 * clamp(frac, 0, 1)) * DEG; ctx.strokeStyle = c.text; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3)); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(label, x, y + r + 8);
}
function lcd(ctx, x, y, w, h, title, value, unit, col = "#4ade80") {
  ctx.fillStyle = "#0b1220"; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.fillStyle = "#94a3b8"; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(title, x + 9, y + 15);
  ctx.fillStyle = col; ctx.font = MONO(Math.min(26, h * 0.5)); ctx.textAlign = "right"; ctx.fillText(value, x + w - 36, y + h - 11);
  ctx.fillStyle = "#cbd5e1"; ctx.font = BOLD; ctx.textAlign = "left"; ctx.fillText(unit, x + w - 30, y + h - 12);
}
const noise = (a, b) => { const h = Math.sin(a * 913.7 + b * 37.1) * 43758.5453; return h - Math.floor(h) - 0.5; };
const measuredI = (U, phi) => Math.max(0, P.dgCurrent(U, phi) * (1 + 0.006 * noise(U, phi)));

/* ================================================================== 1) Devisson–Jermer */

const curveKey = () => String(dg.U);
function recordDG() {
  const k = curveKey(), ph = Math.round(dg.phi * 10) / 10, I = measuredI(dg.U, ph);
  const arr = (dg.curves[k] ||= []), i = arr.findIndex((p) => Math.abs(p[0] - ph) < 1e-6);
  if (i >= 0) arr[i] = [ph, I]; else arr.push([ph, I]);
  const keys = Object.keys(dg.curves); if (keys.length > 8) delete dg.curves[keys.find((x) => x !== k)];
  saveCurves();
}
let cTimer = 0;
const saveCurves = () => { clearTimeout(cTimer); cTimer = setTimeout(() => store.set("of-dg-curves-v1", dg.curves), 400); };
function setPhi(v) { dg.phi = clamp(Math.round(v * 10) / 10, P.DG.phiMin, P.DG.phiMax); dPhiC.set(dg.phi); recordDG(); }
function setU(v) { dg.U = clamp(Math.round(v), P.DG.Umin, P.DG.Umax); dUC.set(dg.U); recordDG(); }
function stepDG(dt) {
  if (!dg.scan) return;
  const n = Math.max(1, Math.round((dt * 8) / 0.2)); // ~10 s
  for (let i = 0; i < n && dg.scan; i++) { setPhi(dg.phi + 0.2); if (dg.phi >= P.DG.phiMax - 1e-9) dg.scan = false; }
}
function drawDG(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560;
  const W = narrow ? cw - 16 : cw * 0.58, top = narrow ? 100 : 16, R = Math.min(W / 1.66, (ch - top - 30) / 1.16), cx = 8 + R * 0.5, cy = ch - 24;
  geo.dg = { cx, cy, R, chips: [] };
  // kamera (yarim doiraning o‘ng qismi)
  const a0 = 2 * Math.PI - Math.acos(-0.42 / 1.12);
  ctx.fillStyle = c.dark ? "#141b2b" : "#f3f6fb"; ctx.strokeStyle = c.text3; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - R * 0.42, cy); ctx.arc(cx, cy, R * 1.12, a0, 2 * Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("vakuum kamera", cx - R * 0.38, cy - 8);
  // burchak shkalasi (normaldan o‘ngga 0…90°)
  ctx.strokeStyle = c.text3; ctx.fillStyle = c.text3;
  for (let a = 0; a <= 90; a += 2) {
    const r0 = a % 10 === 0 ? R * 1.0 : R * 1.04, ang = -Math.PI / 2 + a * DEG;
    ctx.lineWidth = a % 10 === 0 ? 1.4 : 0.8; ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * R * 1.09, cy + Math.sin(ang) * R * 1.09); ctx.lineTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); ctx.stroke();
    if (a % 10 === 0) { ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${a}°`, cx + Math.cos(ang) * R * 0.92, cy + Math.sin(ang) * R * 0.92); }
  }
  // kristall
  ctx.fillStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.fillRect(cx - R * 0.22, cy - 6, R * 0.44, 12);
  ctx.fillStyle = c.dark ? "#cbd5e1" : "#334155"; for (let i = -5; i <= 5; i++) { circle(ctx, cx + i * R * 0.04, cy - 6, 2); ctx.fill(); }
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("Ni kristali (111)", cx, cy + 9);
  // elektron to‘pi (yuqoridan, normal bo‘ylab)
  const gy = cy - R * 0.98;
  ctx.fillStyle = c.dark ? "#475569" : "#334155"; ctx.beginPath(); ctx.roundRect(cx - 9, gy - 10, 18, R * 0.36, 4); ctx.fill();
  ctx.fillStyle = "#f97316"; circle(ctx, cx, gy - 4, 3); ctx.fill();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("elektron to‘pi", cx + 14, gy + 4);
  const by0 = gy + R * 0.36 - 10;
  ctx.save(); ctx.strokeStyle = "rgba(59,130,246,0.55)"; ctx.lineWidth = 4; ctx.setLineDash([2, 6]); ctx.lineDashOffset = -ui.t * 40; ctx.beginPath(); ctx.moveTo(cx, by0); ctx.lineTo(cx, cy - 8); ctx.stroke(); ctx.restore();
  // sochilgan to‘lqin (yorug‘lik bo‘lagi): qutb ko‘rinishi — joriy U uchun xira
  ctx.save(); ctx.globalAlpha = c.dark ? 0.22 : 0.15; ctx.fillStyle = PAL[0]; ctx.beginPath(); ctx.moveTo(cx, cy - 6);
  const imax = Math.max(...Array.from({ length: 81 }, (_, i) => P.dgCurrent(dg.U, 10 + i)));
  for (let a = 10; a <= 90; a += 1) { const r = (P.dgCurrent(dg.U, a) / imax) * R * 0.8, ang = -Math.PI / 2 + a * DEG; ctx.lineTo(cx + Math.cos(ang) * r, cy - 6 + Math.sin(ang) * r); }
  ctx.closePath(); ctx.fill(); ctx.restore();
  // kollektor
  const ang = -Math.PI / 2 + dg.phi * DEG, rc = R * 0.86;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + Math.cos(ang) * rc, cy - 6 + Math.sin(ang) * rc); ctx.stroke();
  ctx.save(); ctx.translate(cx + Math.cos(ang) * rc, cy - 6 + Math.sin(ang) * rc); ctx.rotate(ang);
  ctx.fillStyle = c.dark ? "#cbd5e1" : "#1e293b"; ctx.beginPath(); ctx.roundRect(0, -8, 22, 16, 3); ctx.fill(); ctx.fillStyle = "#facc15"; ctx.fillRect(-1, -4, 3, 8); ctx.restore();
  const hx = cx + Math.cos(ang) * (rc + 32), hy = cy - 6 + Math.sin(ang) * (rc + 32);
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2; circle(ctx, hx, hy, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.primary; circle(ctx, hx, hy, 2.5); ctx.fill();
  geo.dg.arm = { x: hx, y: hy, r: 18 };
  angleArc(ctx, cx, cy - 6, R * 0.3, -Math.PI / 2, ang, c.warning, { label: "φ", labelR: R * 0.3 + 14, font: LBL });
  ctx.save(); ctx.strokeStyle = c.text3; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy - R * 0.5); ctx.stroke(); ctx.restore();
  // asboblar
  if (narrow) {
    lcd(ctx, 8, 8, cw / 2 - 12, 48, "U, V", fmt(dg.U, 0), "V", "#60a5fa"); lcd(ctx, cw / 2 + 4, 8, cw / 2 - 12, 48, "GALVANOMETR", fmt(measuredI(dg.U, dg.phi), 3), "nA");
    const bw = (cw - 16 - 3 * 4) / 4; [["U −1", "U", -1], ["U +1", "U", 1], ["φ −0,5", "P", -0.5], ["φ +0,5", "P", 0.5]].forEach(([t, k, d], i) => { const b = chipBtn(ctx, c, 8 + i * (bw + 4), 62, t, false, bw, 26); geo.dg.chips.push({ ...b, k, d }); });
    tagIn(ctx, `φ = ${fmt(dg.phi, 1)}°`, cw - 10, cy - R * 0.4, cw, { color: c.warning, bg: c.bg, align: "right", font: BOLD, pad: 5 });
    return;
  }
  const px = cx + R * 1.2 + 14, pw = cw - px - 10;
  lcd(ctx, px, 10, pw, 52, "VOLTMETR · tezlatuvchi U", fmt(dg.U, 0), "V", "#60a5fa");
  lcd(ctx, px, 68, pw, 52, "GALVANOMETR · kollektor toki", fmt(measuredI(dg.U, dg.phi), 3), "nA");
  lcd(ctx, px, 126, pw, 44, "KOLLEKTOR BURCHAGI φ", fmt(dg.phi, 1), "°", "#fbbf24");
  const kr = 20, kx = px + kr + 10, ky = 180 + kr + 6;
  knob(ctx, c, kx, ky, kr, (dg.U - 20) / 80, "U dastagi"); geo.dg.knob = { x: kx, y: ky, r: kr + 10 };
  const bx = kx + kr + 18, bw = Math.max(40, (px + pw - bx - 8) / 2);
  [["U +1", "U", 1], ["U −1", "U", -1], ["φ +1°", "P", 1], ["φ −1°", "P", -1], ["φ +0,1°", "P", 0.1], ["φ −0,1°", "P", -0.1]].forEach(([t, k, d], i) => { const b = chipBtn(ctx, c, bx + (i % 2) * (bw + 6), 178 + Math.floor(i / 2) * 28, t, false, bw, 24); geo.dg.chips.push({ ...b, k, d }); });
  const sb = chipBtn(ctx, c, px, ch - 36, dg.scan ? "■ To‘xtatish" : "▶ Kollektorni aylantirish (10°→90°)", dg.scan, pw, 28); geo.dg.chips.push({ ...sb, k: "scan" });
  // atom qatorlari va yo‘l farqi (sxema)
  const iy = 270, ih = ch - 36 - 10 - iy;
  if (ih > 70) drawPathDiff(ctx, c, px, iy, Math.min(pw, ih / 0.62));
}
function drawPathDiff(ctx, c, x, y, w) {
  const h = w * 0.62, ph = dg.phi * DEG;
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
  const by = y + h - 18, d = w * 0.36, a1 = x + w * 0.22, a2 = a1 + d;
  ctx.fillStyle = c.text2; for (let i = -1; i <= 3; i++) { circle(ctx, a1 + i * d * 0.5, by, 3.2); ctx.fill(); }
  ctx.strokeStyle = PAL[0]; ctx.lineWidth = 1.5; const L = h * 0.7;
  [a1, a2].forEach((ax) => { ctx.beginPath(); ctx.moveTo(ax, by - L * 0.5); ctx.lineTo(ax, by); ctx.lineTo(ax + Math.sin(ph) * L, by - Math.cos(ph) * L); ctx.stroke(); });
  // yo‘l farqi d·sinφ
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a1, by); const fx = a1 + d * Math.sin(ph) * Math.sin(ph), fy = by - d * Math.sin(ph) * Math.cos(ph); ctx.lineTo(fx, fy); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("d", (a1 + a2) / 2, by + 5);
  ctx.textAlign = "left"; ctx.fillStyle = c.danger; ctx.fillText("Δ = d·sinφ", x + 6, y + 6);
}
function drawGraphDG(ctx, gst) {
  const { w, h, colors: c } = gst; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  const keys = Object.keys(dg.curves).filter((k) => dg.curves[k].length).sort((a, b) => +a - +b);
  const all = keys.flatMap((k) => dg.curves[k].map((p) => p[1])), imax = Math.max(1, ...all, measuredI(dg.U, dg.phi)) * 1.08;
  const narrow = w < 560, pr = narrow ? Math.min(w * 0.42, h - 30) : Math.min(h - 34, w * 0.34), ox = 16, oy = h - 14;
  // qutb diagrammasi
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.fillStyle = c.text3; ctx.font = SMALL;
  for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(ox, oy, (pr * k) / 4, -Math.PI / 2, 0); ctx.stroke(); }
  for (let a = 0; a <= 90; a += 10) { const an = -Math.PI / 2 + a * DEG; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(an) * pr, oy + Math.sin(an) * pr); ctx.stroke(); if (a % 30 === 0) { ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${a}°`, ox + Math.cos(an) * (pr + 12), oy + Math.sin(an) * (pr + 12)); } }
  geo.polar = { ox, oy, pr, imax };
  keys.forEach((k, i) => { const pts = dg.curves[k].slice().sort((a, b) => a[0] - b[0]); ctx.strokeStyle = PAL[i % PAL.length]; ctx.lineWidth = k === curveKey() ? 2.4 : 1.5; ctx.beginPath(); pts.forEach(([ph, I], j) => { const an = -Math.PI / 2 + ph * DEG, r = (I / imax) * pr; const X = ox + Math.cos(an) * r, Y = oy + Math.sin(an) * r; j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); });
  { const an = -Math.PI / 2 + dg.phi * DEG, r = (measuredI(dg.U, dg.phi) / imax) * pr; ctx.fillStyle = c.danger; circle(ctx, ox + Math.cos(an) * r, oy + Math.sin(an) * r, 4); ctx.fill(); }
  if (narrow) return;
  // I(φ)
  const x0 = ox + pr + 54, x1 = w - 14, y0 = 14, y1 = h - 30, X = (ph) => x0 + ((ph - 10) / 80) * (x1 - x0), Y = (I) => y1 - (I / imax) * (y1 - y0);
  geo.cart = { x0, x1, y0, y1 };
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.fillStyle = c.text3; ctx.font = SMALL;
  for (let ph = 10; ph <= 90; ph += 10) { ctx.beginPath(); ctx.moveTo(X(ph), y0); ctx.lineTo(X(ph), y1); ctx.stroke(); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(ph === 90 ? "90° φ" : `${ph}°`, X(ph), y1 + 5); }
  const step = imax > 3 ? 1 : 0.5; for (let I = 0; I <= imax; I += step) { ctx.beginPath(); ctx.moveTo(x0, Y(I)); ctx.lineTo(x1, Y(I)); ctx.stroke(); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(fmt(I, 1), x0 - 5, Y(I)); }
  ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("I, nA", x0 + 4, y0);
  ctx.strokeStyle = c.borderStrong; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  keys.forEach((k, i) => { const pts = dg.curves[k].slice().sort((a, b) => a[0] - b[0]); ctx.strokeStyle = PAL[i % PAL.length]; ctx.lineWidth = k === curveKey() ? 2.2 : 1.4; ctx.beginPath(); pts.forEach(([ph, I], j) => (j ? ctx.lineTo(X(ph), Y(I)) : ctx.moveTo(X(ph), Y(I)))); ctx.stroke(); });
  ctx.fillStyle = c.danger; circle(ctx, X(dg.phi), Y(measuredI(dg.U, dg.phi)), 4); ctx.fill();
  // afsona
  let lx = x0 + 8; keys.forEach((k, i) => { ctx.fillStyle = PAL[i % PAL.length]; ctx.fillRect(lx, y0 + 18, 14, 3); ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(`${k} V`, lx + 18, y0 + 20); lx += 54; });
  // kursor
  if (dg.cursor !== null) {
    const ph = clamp(10 + ((dg.cursor - x0) / (x1 - x0)) * 80, 10, 90), pts = dg.curves[curveKey()] || [];
    let best = null; pts.forEach((p) => { if (!best || Math.abs(p[0] - ph) < Math.abs(best[0] - ph)) best = p; });
    if (best) { ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(best[0]), y0); ctx.lineTo(X(best[0]), y1); ctx.stroke(); ctx.setLineDash([]); tagIn(ctx, `U = ${dg.U} V · φ = ${fmt(best[0], 1)}° · I = ${fmt(best[1], 3)} nA`, X(best[0]) + 8, y0 + 40, w, { color: c.text, bg: c.bg2, align: "left", font: BOLD, pad: 6 }); }
  }
  if (!keys.length) { ctx.fillStyle = c.text3; ctx.font = MID; ctx.textAlign = "center"; ctx.fillText("Kollektorni burang yoki «Kollektorni aylantirish» ni bosing", (x0 + x1) / 2, (y0 + y1) / 2); }
}

/* ================================================================== 2) Grafit plyonka */

function setGU(v) { gr.U = clamp(Math.round(v * 20) / 20, P.GRAPHITE.Umin, P.GRAPHITE.Umax); gUC.set(gr.U); }
function caliperD() { return Math.round((gr.jR - gr.jL) * 10) / 10; }
function drawGR(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560;
  const SR = narrow ? Math.min(cw / 2 - 14, (ch - 120) / 2) : Math.min(ch / 2 - 14, cw * 0.27), sx = narrow ? cw / 2 : cw - SR - 230 > 300 ? cw * 0.56 : cw - SR - 16, sy = narrow ? 12 + SR : ch / 2;
  const mm = SR / 52, X = (v) => sx + v * mm; // ekran diametri ~104 mm
  geo.gr = { sx, sy, mm, chips: [] };
  // trubka sxemasi
  if (!narrow) {
    const tx = 14, ty = sy - 50, tw = Math.max(160, sx - SR - 40 - tx);
    ctx.fillStyle = c.dark ? "rgba(148,163,184,0.10)" : "rgba(148,163,184,0.14)"; ctx.strokeStyle = c.text3; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx, ty + 34); ctx.lineTo(tx + tw * 0.45, ty + 34); ctx.lineTo(tx + tw, ty - 20); ctx.lineTo(tx + tw, ty + 120); ctx.lineTo(tx + tw * 0.45, ty + 66); ctx.lineTo(tx, ty + 66); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f97316"; circle(ctx, tx + 12, ty + 50, 3); ctx.fill();
    ctx.strokeStyle = "rgba(59,130,246,0.6)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx + 16, ty + 50); ctx.lineTo(tx + tw * 0.45, ty + 50); ctx.stroke();
    ctx.fillStyle = c.text; ctx.fillRect(tx + tw * 0.45 - 1, ty + 40, 3, 20);
    const lamb = P.lambdaNm(gr.U * 1000), Lp = tw * 0.55;
    P.GRAPHITE.d.forEach((d, i) => { const th2 = 2 * Math.asin(lamb / (2 * d)), dy = Math.tan(th2) * Lp * 4; ctx.strokeStyle = i ? "rgba(74,222,128,0.5)" : "rgba(74,222,128,0.8)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(tx + tw * 0.45, ty + 50); ctx.lineTo(tx + tw, ty + 50 - dy); ctx.moveTo(tx + tw * 0.45, ty + 50); ctx.lineTo(tx + tw, ty + 50 + dy); ctx.stroke(); });
    ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("elektron to‘pi", tx + 30, ty + 70); ctx.fillText("grafit", tx + tw * 0.45, ty + 72); ctx.fillText("ekran", tx + tw - 8, ty + 124);
    ctx.textBaseline = "bottom"; ctx.fillText(`L = ${P.GRAPHITE.L} mm`, tx + tw * 0.72, ty - 22);
    lcd(ctx, tx, ty + 150, Math.min(200, tw), 50, "YUQORI KUCHLANISH U", fmt(gr.U, 2), "kV", "#60a5fa");
    const kr = 20, kx = tx + kr + 6, ky = ty + 230; knob(ctx, c, kx, ky, kr, (gr.U - 2.5) / 2.5, "U dastagi"); geo.gr.knob = { x: kx, y: ky, r: kr + 10 };
    [["−0,1 kV", -0.1], ["+0,1 kV", 0.1]].forEach(([t, d], i) => { const b = chipBtn(ctx, c, kx + kr + 18 + i * 74, ky - 12, t, false, 70, 24); geo.gr.chips.push({ ...b, k: "U", d }); });
  }
  // ekran
  const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, SR);
  g.addColorStop(0, "rgba(74,222,128,0.18)"); g.addColorStop(1, "rgba(5,46,22,0.95)");
  ctx.fillStyle = "#03140a"; circle(ctx, sx, sy, SR); ctx.fill(); ctx.fillStyle = g; circle(ctx, sx, sy, SR); ctx.fill();
  // halqalar
  ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, SR, 0, TAU); ctx.clip();
  P.GRAPHITE.d.forEach((d, i) => {
    const r = (P.ringD(gr.U, d) / 2) * mm, wd = 0.45 * mm;
    for (let k = -3; k <= 3; k++) { ctx.strokeStyle = `rgba(134,239,172,${(i ? 0.42 : 0.6) * Math.exp(-(k * k) / 3)})`; ctx.lineWidth = Math.max(1, wd); circle(ctx, sx, sy, r + k * wd * 0.6); ctx.stroke(); }
  });
  const sp = ctx.createRadialGradient(sx, sy, 0, sx, sy, 5 * mm); sp.addColorStop(0, "rgba(220,252,231,0.95)"); sp.addColorStop(1, "rgba(134,239,172,0)"); ctx.fillStyle = sp; circle(ctx, sx, sy, 5 * mm); ctx.fill();
  // shtangensirkul
  const yL = sy; ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx - SR, yL); ctx.lineTo(sx + SR, yL); ctx.stroke();
  [["L", gr.jL], ["R", gr.jR]].forEach(([k, v]) => { ctx.strokeStyle = k === gr.active ? "#fbbf24" : "#fde68a"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X(v), sy - SR * 0.9); ctx.lineTo(X(v), sy + SR * 0.9); ctx.stroke(); });
  ctx.restore();
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 4; circle(ctx, sx, sy, SR + 2); ctx.stroke();
  // jag‘ tutqichlari (ekran ustida)
  [["L", gr.jL], ["R", gr.jR]].forEach(([k, v]) => {
    const hx = X(v), hy = sy - SR - 2; ctx.fillStyle = k === gr.active ? "#f59e0b" : c.bg; ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx, hy + 8); ctx.lineTo(hx - 8, hy - 6); ctx.lineTo(hx + 8, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    geo.gr[`j${k}`] = { x: hx, y: hy - 2, r: 16 };
  });
  // o‘lchov va tugmalar
  const rx = narrow ? 10 : sx + SR + 14, ry = narrow ? sy + SR + 12 : 12, rw = narrow ? cw - 20 : cw - rx - 10;
  if (rw > 120) {
    lcd(ctx, rx, ry, rw, 50, "SHTANGENSIRKUL D", fmt(caliperD(), 1), "mm", "#fbbf24");
    const bw = (rw - 4) / 2, rows = [[`◀ chap −0,1`, "L", -0.1], [`chap +0,1 ▶`, "L", 0.1], [`◀ o‘ng −0,1`, "R", -0.1], [`o‘ng +0,1 ▶`, "R", 0.1]];
    rows.forEach(([t, j, d], i) => { const b = chipBtn(ctx, c, rx + (i % 2) * (bw + 4), ry + 58 + Math.floor(i / 2) * 30, t, false, bw, 26); geo.gr.chips.push({ ...b, k: "J", j, d }); });
    if (!narrow) {
      ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(`chap jag‘: ${fmt(gr.jL, 1)} mm`, rx, ry + 124); ctx.fillText(`o‘ng jag‘: ${fmt(gr.jR, 1)} mm`, rx, ry + 140);
      const b = chipBtn(ctx, c, rx, ch - 36, "Yozib olish (D → jurnal)", true, rw, 28); geo.gr.chips.push({ ...b, k: "rec" });
    } else {
      const bw2 = (cw - 20 - 8) / 3; [["U −0,1", "U", -0.1], ["U +0,1", "U", 0.1]].forEach(([t, k, d], i) => { const b = chipBtn(ctx, c, 10 + i * (bw2 + 4), ry + 120, t, false, bw2, 26); geo.gr.chips.push({ ...b, k, d }); });
      tagIn(ctx, `U = ${fmt(gr.U, 2)} kV`, cw - 10, ry + 133, cw, { color: c.text, bg: c.bg2, align: "right", font: BOLD, pad: 6 });
    }
  }
}
function recordD() {
  journal.push({ id: (journal.at(-1)?.id || 0) + 1, U: gr.U, D: caliperD() });
  if (journal.length > 300) journal.shift(); store.set(J_KEY, journal); renderJournal(true); nbRecalc();
}

/* ------------------------------------------------------------------ Asosiy chizish */

function draw(ctx, st) { ctx.fillStyle = st.colors.bg; ctx.fillRect(0, 0, st.w, st.h); if (ui.mode === "dg") drawDG(ctx, st); else drawGR(ctx, st); }
const heights = (cw) => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(Math.min(cw * 0.5, vh * 0.52), 320, 420)), graph: Math.round(clamp(vh * 0.3, 200, 270)) }; };
const stage = createStage($("#stage"), draw, { height: (cw) => (cw < 560 ? (ui.mode === "gr" ? Math.round(cw + 190) : Math.round(cw * 0.75 + 110)) : heights(cw).stage) });
const graph = createStage($("#graph"), (ctx, gst) => (ui.mode === "dg" ? drawGraphDG(ctx, gst) : null), { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
function updateReadouts() {
  if (ui.mode === "dg") {
    const n = Object.keys(dg.curves).length;
    setRO("r1", "Tezlatuvchi kuchlanish <i>U</i>", u(fmt(dg.U, 0), "V"), `${P.DG.Umin}…${P.DG.Umax} V`);
    setRO("r2", "Kollektor toki <i>I</i>", u(fmt(measuredI(dg.U, dg.phi), 3), "nA"), "galvanometr");
    setRO("r3", "Kollektor burchagi <i>φ</i>", u(fmt(dg.phi, 1), "°"), "kristall normalidan");
    setRO("r4", "Yozib olingan egri chiziqlar", String(n), n ? Object.keys(dg.curves).map((k) => `${k} V`).join(", ") : "kollektorni burang", n ? "" : "muted");
    setRO("r5", "Kristall", u("Ni (111)", ""), `sirt qatorlari d = ${fmt(P.NI_D, 3)} nm`);
    setRO("r6", "Elektron impulsi <i>p</i>", u(sci(Math.sqrt(2 * P.ME * P.QE * dg.U), 3), "kg·m/s"), "p = √(2mₑeU)");
  } else {
    setRO("r1", "Yuqori kuchlanish <i>U</i>", u(fmt(gr.U, 2), "kV"), `${P.GRAPHITE.Umin}…${P.GRAPHITE.Umax} kV`);
    setRO("r2", "Shtangensirkul <i>D</i>", u(fmt(caliperD(), 1), "mm"), "jag‘lar orasidagi masofa");
    setRO("r3", "Jag‘lar", `${fmt(gr.jL, 1)} / ${fmt(gr.jR, 1)}<small> mm</small>`, "markazdan (chap / o‘ng)");
    setRO("r4", "Jurnal yozuvlari", String(journal.length), "o‘lchangan diametrlar");
    setRO("r5", "Grafit panjarasi", u("0,213 · 0,123", "nm"), "d₁ va d₂");
    setRO("r6", "Ekrangacha masofa <i>L</i>", u(String(P.GRAPHITE.L), "mm"), "plyonka → ekran");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t, tone = "blue";
  if (ui.mode === "dg") { t = dg.scan ? "Kollektor aylanmoqda…" : `U = ${dg.U} V egri chizig‘i: ${(dg.curves[curveKey()] || []).length} nuqta`; tone = dg.scan ? "green" : "blue"; }
  else { t = `D = ${fmt(caliperD(), 1)} mm`; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = ui.mode === "dg"
    ? ["<p>Elektron to‘pidan chiqqan elektronlar nikel kristaliga tik tushadi. Agar elektron faqat zarra bo‘lganda, kollektor toki burchak bilan silliq o‘zgarardi. Lekin ma’lum burchakda <b>«bo‘rtiq»</b> paydo bo‘ladi: kristall sirtidagi atom qatorlaridan qaytgan to‘lqinlar d·sinφ = λ shartida kuchayadi.</p>", "<p>U = 54 V da bo‘rtiq φ ≈ 50° da eng yaqqol. Kuchlanishni oshirsangiz, elektron to‘lqin uzunligi λ = h/√(2meU) kamayadi va maksimum kichik burchakka siljiydi — bu de Broyl gipotezasining isboti.</p>"]
    : ["<p>Yupqa grafit plyonka mayda kristallchalardan iborat. Bragg sharti 2d·sinθ = λ bajariladigan yo‘nalishlar konus hosil qiladi — ekranda ikkita yorug‘ <b>halqa</b> (d₁ = 0,213 nm, d₂ = 0,123 nm).</p>", "<p>Kuchlanish oshganda λ kamayadi va halqalar kichrayadi: D ~ 1/√U. Halqa diametrini shtangensirkul jag‘larini halqaning ikki chetiga keltirib o‘lchang va jurnalga yozing.</p>"];
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() { const html = ui.mode === "dg" ? "<small>De Broyl</small> λ = h/√(2meU)" : "<small>Bragg</small> 2d·sin θ = λ"; const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html; }
const actBtn = $("[data-action]"), resetBtn = $("[data-reset]");
function updateAction() {
  const t = ui.mode === "dg" ? (dg.scan ? "To‘xtatish" : "Kollektorni aylantirish") : "Yozib olish"; if (actBtn.textContent !== t) actBtn.textContent = t;
  const r = ui.mode === "dg" ? "Grafiklarni tozalash" : "Jag‘larni markazga"; if (resetBtn.textContent !== r) resetBtn.textContent = r;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); updateAction(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Jurnal */

const jEl = $("[data-journal]");
function renderJournal(fresh = false) { jEl.innerHTML = journal.slice().reverse().map((j, i) => `<li class="${fresh && i === 0 ? "is-new" : ""}"><span class="lab-journal__n">${j.id}</span><span class="lab-journal__m">U = ${fmt(j.U, 2)} kV</span><span class="lab-journal__v">D = ${fmt(j.D, 1)} mm</span></li>`).join(""); }
$("[data-journal-clear]").addEventListener("click", () => { if (!journal.length || !confirm("Shtangensirkul jurnalini tozalaysizmi?")) return; journal = []; store.set(J_KEY, journal); renderJournal(); nbRecalc(); });

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return; ui.t += dt;
  if (ui.mode === "dg") { stepDG(dt); if (dg.scan) graph.render(); }
  stage.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; updateReadouts(); updateStatus(); updateAction(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) { playBtn.setAttribute("aria-pressed", String(on)); playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play"); playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish"; }
playBtn.addEventListener("click", () => loop.toggle());
resetBtn.addEventListener("click", () => { if (ui.mode === "dg") { dg.scan = false; dg.curves = {}; saveCurves(); } else { gr.jL = -5; gr.jR = 5; } customized(); refresh(); });
function toggleScan() { if (dg.scan) dg.scan = false; else { if (dg.phi >= P.DG.phiMax - 0.05) setPhi(P.DG.phiMin); else if (dg.phi > 12) setPhi(P.DG.phiMin); dg.scan = true; if (!loop.running) loop.start(); } }
actBtn.addEventListener("click", () => { if (ui.mode === "dg") toggleScan(); else recordD(); customized(); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const dUC = bindRange($("#dU"), $("#dUOut"), (v) => `${fmt(v, 0)} V`, (v) => { dg.U = v; recordDG(); customized(); refresh(); });
const dPhiC = bindRange($("#dPhi"), $("#dPhiOut"), (v) => `${fmt(v, 1)}°`, (v) => { dg.phi = v; recordDG(); customized(); refresh(); });
const gUC = bindRange($("#gU"), $("#gUOut"), (v) => `${fmt(v, 2)} kV`, (v) => { gr.U = v; customized(); refresh(); });

const canvas = stage.canvas;
let drag = null, dragY0 = 0, dragV0 = 0;
const ptr = (e, cv = canvas) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
const hitR = (p, b) => b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r;
function hitTest(p) {
  if (ui.mode === "dg") {
    const g = geo.dg || {}; for (const ch of g.chips || []) if (inBox(p, ch)) return { k: "chip", ch };
    if (hitR(p, g.knob)) return { k: "knob" }; if (hitR(p, g.arm)) return { k: "arm" };
    if (g.cx !== undefined) { const a = Math.atan2(p.x - g.cx, -(p.y - (g.cy - 6))) / DEG, r = Math.hypot(p.x - g.cx, p.y - g.cy); if (r > g.R * 0.35 && r < g.R * 1.15 && Math.abs(a - dg.phi) < 5) return { k: "arm" }; }
    return null;
  }
  const g = geo.gr || {}; for (const ch of g.chips || []) if (inBox(p, ch)) return { k: "chip", ch };
  if (hitR(p, g.knob)) return { k: "knob" }; if (hitR(p, g.jL)) return { k: "jL" }; if (hitR(p, g.jR)) return { k: "jR" };
  if (g.sx !== undefined && Math.abs(p.y - g.sy) < 52 * g.mm) { const v = (p.x - g.sx) / g.mm; if (Math.abs(v - gr.jL) * g.mm < 8) return { k: "jL" }; if (Math.abs(v - gr.jR) * g.mm < 8) return { k: "jR" }; }
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  if (h.k === "chip") {
    const ch = h.ch;
    if (ui.mode === "dg") { if (ch.k === "scan") toggleScan(); else { dg.scan = false; ch.k === "U" ? setU(dg.U + ch.d) : setPhi(dg.phi + ch.d); } }
    else if (ch.k === "rec") recordD();
    else if (ch.k === "U") setGU(gr.U + ch.d);
    else if (ch.k === "J") { gr.active = ch.j; const key = ch.j === "L" ? "jL" : "jR"; gr[key] = clamp(Math.round((gr[key] + ch.d) * 10) / 10, -52, 52); }
    customized(); refresh(); return;
  }
  drag = h.k; dragY0 = p.y; dragV0 = ui.mode === "dg" ? dg.U : gr.U;
  if (drag === "jL" || drag === "jR") gr.active = drag === "jL" ? "L" : "R";
  if (ui.mode === "dg") dg.scan = false;
  canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  e.preventDefault(); onDrag(p);
});
function onDrag(p) {
  if (ui.mode === "dg") {
    if (drag === "knob") setU(dragV0 + (dragY0 - p.y) * 0.3);
    else if (drag === "arm") { const g = geo.dg, a = Math.atan2(p.x - g.cx, -(p.y - (g.cy - 6))) / DEG; setPhi(Math.round(a * 2) / 2); }
  } else {
    if (drag === "knob") setGU(dragV0 + (dragY0 - p.y) * 0.01);
    else if (drag === "jL" || drag === "jR") { const g = geo.gr, v = clamp(Math.round(((p.x - g.sx) / g.mm) * 10) / 10, -52, 52); gr[drag] = v; }
  }
  customized(); refresh();
}
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? (h.k === "chip" ? "pointer" : h.k === "knob" ? "ns-resize" : h.k === "jL" || h.k === "jR" ? "ew-resize" : "grab") : ""; return; } onDrag(p); });
function endDrag() { drag = null; canvas.dataset.dragging = "false"; refresh(); }
canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);
graph.canvas.addEventListener("pointermove", (e) => { const p = ptr(e, graph.canvas), g = geo.cart; dg.cursor = g && p.x >= g.x0 && p.x <= g.x1 ? p.x : null; graph.render(); });
graph.canvas.addEventListener("pointerleave", () => { dg.cursor = null; graph.render(); });

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  dg54: { mode: "dg", title: "Devisson–Jermer: U = 54 V", lesson: "1927-yildagi mashhur holat: 54 V da kollektor toki φ ≈ 50° da «bo‘rtiq» beradi. «Kollektorni aylantirish» ni bosing yoki kollektorni o‘zingiz burang; so‘ng kuchlanishni o‘zgartirib yangi egri chiziqlar oling.", set: () => Object.assign(dg, { U: 54, phi: 10 }) },
  dg40: { mode: "dg", title: "Kichikroq energiya: 40 V", lesson: "40 V da λ kattaroq — maksimum kattaroq burchakda (≈ 64°), lekin u kamroq yaqqol.", set: () => Object.assign(dg, { U: 40, phi: 10 }) },
  dg68: { mode: "dg", title: "Kattaroq energiya: 68 V", lesson: "68 V da maksimum ≈ 43° ga siljiydi. Turli U da olingan egri chiziqlarni qutb diagrammasida solishtiring.", set: () => Object.assign(dg, { U: 68, phi: 10 }) },
  gr4: { mode: "gr", title: "Grafit: U = 4 kV", lesson: "Ekranda ikkita halqa. Shtangensirkulning chap va o‘ng jag‘ini ichki halqaning ikki chetiga (yorug‘ chiziq markaziga) keltiring, «Yozib olish» ni bosing; so‘ng tashqi halqani o‘lchang.", set: () => Object.assign(gr, { U: 4, jL: -10, jR: 10 }) },
  gr25: { mode: "gr", title: "Grafit: U = 2,5 kV", lesson: "Kuchlanish kichik — λ katta, halqalar kattaroq. D ~ 1/√U ekanini tekshiring.", set: () => Object.assign(gr, { U: 2.5, jL: -14, jR: 14 }) },
};
const GROUPS = [["1. Devisson–Jermer", ["dg54", "dg40", "dg68"]], ["2. Grafit plyonka", ["gr4", "gr25"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }
function syncAll() { dUC.set(dg.U); dPhiC.set(dg.phi); gUC.set(gr.U); }
const MODE_HINT = { dg: "Kollektorni suring yoki tugmalar bilan burang; grafikda kursor bilan o‘qing", gr: "Shtangensirkul jag‘larini halqa chetlariga keltiring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  $("[data-graph-card]").hidden = ui.mode !== "dg"; $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  window.dispatchEvent(new Event("resize"));
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(b.dataset.modeValue === "dg" ? "dg54" : "gr4"); }));
function loadPreset(id) {
  const p = PRESETS[id]; drag = null; dg.scan = false; ui.mode = p.mode; p.set();
  setModeUI(); presetId = id; setPresetPressed(id); $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

/* ================================================================== Laboratoriya daftari */

const NB_KEY = "of-dg-nb-v1";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const blank1 = () => ({ U: "", phi: "", n: "1" }), blank2 = () => ({ U: "", D1: "", D2: "" });
const nb = Object.assign({ f: { name: "", group: "", school: "", teacher: "", date: today(), conclusion: "" }, t1: Array.from({ length: 4 }, blank1), t2: Array.from({ length: 4 }, blank2) }, store.get(NB_KEY, {}));
const saveNb = () => store.set(NB_KEY, nb);
const num = (s) => { const v = parseFloat(String(s).replace(",", ".").replace("−", "-")); return Number.isFinite(v) ? v : NaN; };
document.querySelectorAll("[data-f]").forEach((el) => { el.value = nb.f[el.dataset.f] || ""; el.addEventListener("input", () => { nb.f[el.dataset.f] = el.value; saveNb(); nbProgress(); }); });

const t1Body = $("[data-t1] tbody"), t2Body = $("[data-t2] tbody");
const inp = (key, val, mode = "decimal") => `<input data-k="${key}" inputmode="${mode}" value="${String(val ?? "").replace(/"/g, "&quot;")}" aria-label="${key}">`;
const sel = (key, val, opts) => `<select data-k="${key}" aria-label="${key}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(val) ? " selected" : ""}>${t}</option>`).join("")}</select>`;
function renderT1() { t1Body.innerHTML = nb.t1.map((r, i) => `<tr data-i="${i}"><td class="lab-idx">${i + 1}</td><td>${inp("U", r.U, "numeric")}</td><td>${inp("phi", r.phi)}</td><td>${sel("n", r.n, [[1, "1"], [2, "2"]])}</td><td class="lab-calc" data-o="lam"></td><td class="lab-calc" data-o="dB"></td><td class="lab-calc" data-o="dev"></td><td data-o="j"></td><td><button class="lab-del" type="button" data-del="t1" aria-label="Qatorni o‘chirish">×</button></td></tr>`).join(""); }
function renderT2() { t2Body.innerHTML = nb.t2.map((r, i) => `<tr data-i="${i}"><td class="lab-idx">${i + 1}</td><td>${inp("U", r.U)}</td><td>${inp("D1", r.D1)}</td><td>${inp("D2", r.D2)}</td><td class="lab-calc" data-o="l1"></td><td class="lab-calc" data-o="l2"></td><td class="lab-calc" data-o="dB"></td><td data-o="j"></td><td><button class="lab-del" type="button" data-del="t2" aria-label="Qatorni o‘chirish">×</button></td></tr>`).join(""); }
function onTableInput(e, tbl) { const el = e.target.closest("[data-k]"), tr = e.target.closest("tr[data-i]"); if (!el || !tr) return; nb[tbl][+tr.dataset.i][el.dataset.k] = el.value; saveNb(); nbRecalc(); }
t1Body.addEventListener("input", (e) => onTableInput(e, "t1")); t1Body.addEventListener("change", (e) => onTableInput(e, "t1")); t2Body.addEventListener("input", (e) => onTableInput(e, "t2"));
document.addEventListener("click", (e) => {
  const d = e.target.closest("[data-del]"); if (d) { const tbl = d.dataset.del, i = +d.closest("tr").dataset.i; nb[tbl].splice(i, 1); if (!nb[tbl].length) nb[tbl].push(tbl === "t1" ? blank1() : blank2()); saveNb(); tbl === "t1" ? renderT1() : renderT2(); nbRecalc(); return; }
  const a = e.target.closest("[data-add]"); if (a) { const tbl = a.dataset.add; if (nb[tbl].length >= 12) return; nb[tbl].push(tbl === "t1" ? blank1() : blank2()); saveNb(); tbl === "t1" ? renderT1() : renderT2(); nbRecalc(); }
});

let lastA = null, lastB = null, flags = { dg: [], gr: [] };
const summary = (el, items) => { el.innerHTML = items.map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b><small>${c}</small></div>`).join(""); };
function nbRecalc() {
  const r1 = nb.t1.map((r) => ({ U: num(r.U), phi: num(r.phi), n: +r.n })), A = L.analyzeDG(r1); lastA = A; flags.dg = [];
  let f1 = 0, b1 = 0;
  [...t1Body.rows].forEach((tr, i) => {
    const r = r1[i], raw = nb.t1[i], any = raw.U !== "" || raw.phi !== "", ck = L.checkDG(r), o = (k) => tr.querySelector(`[data-o="${k}"]`);
    tr.classList.toggle("is-bad", any && !ck.ok);
    if (ck.ok) { const q = A.rows[f1++]; o("lam").textContent = fmt(q.lam, 4); o("dB").textContent = fmt(q.lamDB, 4); o("dev").textContent = `${fmt(100 * q.dev, 1)}%`; const mt = L.matchDG(r); flags.dg.push(mt); o("j").innerHTML = mt ? '<span class="lab-ok" title="Haqiqiy maksimumga mos">✓</span>' : '<span class="lab-no" title="Haqiqiy maksimumdan ±1,5° dan ko‘p farq">?</span>'; }
    else { ["lam", "dB", "dev"].forEach((k) => { o(k).textContent = ""; }); o("j").textContent = any ? ck.err : ""; if (any) b1++; }
  });
  const m1 = $("[data-t1-msg]"); m1.textContent = `${f1} ta qator${b1 ? `, ${b1} ta xato` : ""}${f1 ? ` · ${flags.dg.filter(Boolean).length} tasi tekshiruvdan o‘tdi` : ""}`; m1.dataset.tone = b1 ? "red" : A.ok ? "green" : "";
  if (A.fit) summary($("[data-t1-sum]"), [["k = λ·√U", `${fmt(A.fit.k, 4)}`, `nm·V½ (nazariya ${fmt(P.K_NR, 4)})`], ["Plank doimiysi h", `${sci(A.h, 4)} J·s`, `farq ${fmt((100 * (A.h - P.H)) / P.H, 1)}%`]]); else $("[data-t1-sum]").innerHTML = "";
  const r2 = nb.t2.map((r) => ({ U: num(r.U), D1: num(r.D1), D2: num(r.D2) })), B = L.analyzeGr(r2); lastB = B; flags.gr = [];
  let f2 = 0, b2 = 0;
  [...t2Body.rows].forEach((tr, i) => {
    const r = r2[i], raw = nb.t2[i], any = raw.U !== "" || raw.D1 !== "" || raw.D2 !== "", ck = L.checkGr(r), o = (k) => tr.querySelector(`[data-o="${k}"]`);
    tr.classList.toggle("is-bad", any && !ck.ok);
    if (ck.ok) { const q = B.rows[f2++]; o("l1").textContent = q.l1 !== null ? fmt(q.l1 * 1000, 2) : "—"; o("l2").textContent = q.l2 !== null ? fmt(q.l2 * 1000, 2) : "—"; o("dB").textContent = fmt(q.lamDB * 1000, 2); const mt = L.matchGr(r, journal); flags.gr.push(mt); o("j").innerHTML = mt ? '<span class="lab-ok" title="Jurnalda bor">✓</span>' : '<span class="lab-no" title="Jurnalda topilmadi">?</span>'; }
    else { ["l1", "l2", "dB"].forEach((k) => { o(k).textContent = ""; }); o("j").textContent = any ? ck.err : ""; if (any) b2++; }
  });
  const m2 = $("[data-t2-msg]"); m2.textContent = `${f2} ta qator${b2 ? `, ${b2} ta xato` : ""}${f2 ? ` · ${flags.gr.filter(Boolean).length} tasi jurnal bilan mos` : ""}`; m2.dataset.tone = b2 ? "red" : B.ok ? "green" : "";
  if (B.fit) summary($("[data-t2-sum]"), [["k = λ·√U", `${fmt(B.fit.k, 4)}`, `nm·V½ (nazariya ${fmt(P.K_NR, 4)})`], ["Plank doimiysi h", `${sci(B.h, 4)} J·s`, `farq ${fmt((100 * (B.h - P.H)) / P.H, 1)}%`]]); else $("[data-t2-sum]").innerHTML = "";
  nbProgress();
}
function nbValid() {
  const e = [];
  if (!nb.f.name.trim()) e.push("F.I.Sh. kiritilmagan");
  if (!(lastA?.ok || lastB?.ok)) e.push("kamida bitta topshiriqda 3 xil kuchlanishdagi o‘lchovlar kerak");
  if (nb.f.conclusion.trim().length < 20) e.push("xulosa yozilmagan");
  return e;
}
let built = false;
function nbProgress() {
  const st = [["Bajaruvchi", !!nb.f.name.trim()], ["Devisson–Jermer", !!lastA?.ok], ["Grafit", !!lastB?.ok], ["Xulosa", nb.f.conclusion.trim().length >= 20], ["Hisobot", built]];
  $("[data-nb-progress]").innerHTML = st.map(([t, ok]) => `<span class="${ok ? "is-done" : ""}">${ok ? "✓ " : ""}${t}</span>`).join("");
}
$("[data-conclusion-hint]").addEventListener("click", () => { $("[data-hint-msg]").textContent = "Javob bering: 1) Kollektor tokida maksimum paydo bo‘ladimi va u nimani bildiradi? 2) U ortganda maksimum qaysi tomonga siljiydi? 3) O‘lchangan λ de Broyl formulasiga mosmi? 4) λ ~ 1/√U bajariladimi? 5) Topilgan h jadvaldagi qiymatga qanchalik yaqin?"; });

const buildMsg = $("[data-build-msg]"), preview = $("[data-preview]");
const KATEX_JS = new URL("../../vendor/katex/katex.min.js", import.meta.url).href, KATEX_CSS = new URL("../../vendor/katex/katex.min.css", import.meta.url).href;
let katexP = null;
function loadKatex() { if (window.katex) return Promise.resolve(window.katex); katexP ||= new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = KATEX_JS; sc.onload = () => res(window.katex); sc.onerror = () => { katexP = null; rej(new Error("katex")); }; document.head.append(sc); }); return katexP; }
const translit = (s) => s.normalize("NFKD").replace(/[ʻʼ‘’'`]/g, "").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9Ѐ-ӿ]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "talaba";
const fileBase = () => `Elektron-difraksiyasi-lab-${translit(nb.f.name)}`;
function makeDoc() {
  const e = nbValid(); if (e.length) { buildMsg.textContent = `Avval to‘ldiring: ${e.join("; ")}.`; buildMsg.dataset.tone = "red"; return null; }
  const A = lastA.ok ? lastA : { rows: [], ok: false }, B = lastB.ok ? lastB : { rows: [], ok: false };
  return buildDGDoc(nb, A, B, { dg: lastA.ok ? flags.dg : [], gr: lastB.ok ? flags.gr : [] }, dg.curves);
}
async function makeHTML(autoPrint) { const doc = makeDoc(); if (!doc) return null; const katex = await loadKatex(); return renderHTML(doc, { katex, katexCss: KATEX_CSS, title: fileBase(), docLabel: DOC_LABEL, autoPrint }); }
$("[data-build]").addEventListener("click", async () => {
  buildMsg.textContent = "Shakllantirilmoqda…"; buildMsg.dataset.tone = "";
  let html = null; try { html = await makeHTML(false); } catch { buildMsg.textContent = "Formulalar kutubxonasini yuklab bo‘lmadi. Qayta urinib ko‘ring."; buildMsg.dataset.tone = "red"; }
  if (!html) { built = false; preview.hidden = true; nbProgress(); return; }
  preview.innerHTML = ""; const fr = document.createElement("iframe"); fr.title = "Lab varaq ko‘rinishi"; fr.className = "lab-frame"; fr.srcdoc = html; preview.append(fr);
  preview.hidden = false; built = true; buildMsg.textContent = "Tayyor. Pastda ko‘rib chiqing, so‘ng PDF yoki LaTeX faylni yuklab oling."; buildMsg.dataset.tone = "green"; nbProgress();
});
$("[data-pdf]").addEventListener("click", async () => {
  if (nbValid().length) { makeDoc(); return; }
  const w = window.open("", "_blank"); buildMsg.textContent = "PDF tayyorlanmoqda…"; buildMsg.dataset.tone = "";
  try {
    const html = await makeHTML(true);
    if (!w) { buildMsg.textContent = "Brauzer yangi oynani blokladi — ruxsat bering yoki «Ko‘rib chiqish» dagi tugmadan foydalaning."; buildMsg.dataset.tone = "red"; return; }
    w.document.open(); w.document.write(html); w.document.close();
    buildMsg.textContent = "Yangi oynada chop etish oynasi ochildi: «Saqlash: PDF» (Save as PDF) ni tanlang."; buildMsg.dataset.tone = "green"; built = true; nbProgress();
  } catch { w?.close(); buildMsg.textContent = "Formulalar kutubxonasini yuklab bo‘lmadi. Qayta urinib ko‘ring."; buildMsg.dataset.tone = "red"; }
});
$("[data-tex]").addEventListener("click", () => {
  const doc = makeDoc(); if (!doc) return;
  const tex = renderTeX(doc, { docLabel: DOC_LABEL, url: SITE_URL, label: SITE_LABEL });
  const url = URL.createObjectURL(new Blob([tex], { type: "application/x-tex;charset=utf-8" })), a = document.createElement("a");
  a.href = url; a.download = `${fileBase()}.tex`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  buildMsg.textContent = "LaTeX fayl yuklab olindi. Overleaf (pdfLaTeX) yoki istalgan TeX tizimida kompilyatsiya qilinadi."; buildMsg.dataset.tone = "green";
});
document.querySelector("#labNotebook").addEventListener("input", () => { if (built) { built = false; buildMsg.textContent = "Ma’lumotlar o‘zgardi — hisobot yangi ma’lumotlar bilan tuziladi."; buildMsg.dataset.tone = ""; nbProgress(); } });

/* ------------------------------------------------------------------ Ishga tushirish */

setPlayUI(false);
renderT1(); renderT2(); renderJournal(); nbRecalc();
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "dg54");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
