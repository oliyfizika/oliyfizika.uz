// ==========================================================================
// LED orqali Plank doimiysini aniqlash — virtual laboratoriya (simulations/led-planck.html)
// 1) «VAX» rejimi: manba E → R = 150 Ω → mA-metr → LED (qorong‘i qutida), voltmetr LED ga parallel.
//    E ni dastak / ±1, ±0,1, ±0,01 V tugmalari bilan o‘zgartirib I(U) yoziladi (grafik), chiziqli qism → U₀.
// 2) «Spektrometr» rejimi: kollimator → difraksion panjara (600 chiziq/mm) → aylanuvchi ko‘rish trubasi;
//    okulyarda spektr chizig‘i va vizir, φ burchak noniusdan o‘qiladi → λ = d·sin φ / m.
// Daftar: labnotebook.js; hisobot: led-report.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { createStage, createLoop, prefersReducedMotion } from "./sim-kit.js";
import { DEG, TAU, SMALL, MID, BOLD, circle, tagIn, chipBtn, knob, lcd, chipGrid, readouts, u, noise, clamp, fmt } from "./labkit.js";
import * as P from "./led-physics.js";
import * as L from "./led-lab.js";
import { createNotebook, num, translit } from "./labnotebook.js";
import { buildLedDoc, SITE, DOC_LABEL } from "./led-report.js";

const $ = (s) => document.querySelector(s);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };

const st = { mode: "vax", led: "R", E: 0, phi: 0, scan: false, cursor: null, t: 0 };
const REC = "of-led-rec-v1";
let curves = store.get(REC, {});
const LED = () => P.ledById(st.led);
/** Asbob ko‘rsatkichlari (kichik deterministik shovqin bilan). */
function meter() { const c = P.circuit(LED(), st.E); return { U: c.U + 0.0004 * noise(st.E, 3), I: c.I * (1 + 0.002 * noise(st.E, 5)), Itrue: c.I, Utrue: c.U }; }
const geo = {};
let presetId = null;

function record() {
  const m = meter(); if (m.I < 0.005 && m.U < 0.3) return;
  const c = (curves[st.led] ||= { pts: [] }), U = Math.round(m.U * 1000) / 1000, I = Math.round(m.I * 100) / 100, i = c.pts.findIndex((p) => Math.abs(p[0] - U) < 5e-4);
  if (i >= 0) c.pts[i] = [U, I]; else c.pts.push([U, I]);
  if (c.pts.length > 600) c.pts.splice(0, c.pts.length - 600);
  clearTimeout(record.t); record.t = setTimeout(() => store.set(REC, curves), 400);
}
const setE = (v) => { st.E = clamp(Math.round(v * 100) / 100, 0, P.E_MAX); record(); };
const setPhi = (v) => { st.phi = clamp(Math.round(v * 100) / 100, 0, 80); };

/* ------------------------------------------------------------------ Chizish yordamchilari */
const rgb = (a, al = 1) => `rgba(${a[0]},${a[1]},${a[2]},${al})`;
function ledBody(ctx, c, x, y, s, Ld, g) {
  // 5 mm LED: oyoqlar, gardish, gumbaz; yorug‘lik g (0…1)
  const col = Ld.color;
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.moveTo(x - 5 * s, y + 10 * s); ctx.lineTo(x - 5 * s, y + 40 * s); ctx.moveTo(x + 5 * s, y + 10 * s); ctx.lineTo(x + 5 * s, y + 34 * s); ctx.stroke();
  if (g > 0.002) {
    const vis = Ld.vis ? 1 : 0.25, R = (26 + 70 * Math.sqrt(g)) * s, gr = ctx.createRadialGradient(x, y - 8 * s, 2, x, y - 8 * s, R);
    gr.addColorStop(0, `rgba(255,255,255,${0.9 * Math.min(1, g * 3) * vis})`); gr.addColorStop(0.18, col + Math.round(clamp(0.95 * Math.sqrt(g) * vis, 0, 1) * 255).toString(16).padStart(2, "0")); gr.addColorStop(1, col + "00");
    ctx.fillStyle = gr; circle(ctx, x, y - 8 * s, R); ctx.fill();
  }
  ctx.fillStyle = col; ctx.globalAlpha = 0.55 + 0.45 * Math.min(1, g * 4); ctx.beginPath(); ctx.moveTo(x - 9 * s, y + 10 * s); ctx.lineTo(x - 9 * s, y - 10 * s); ctx.arc(x, y - 10 * s, 9 * s, Math.PI, 0); ctx.lineTo(x + 9 * s, y + 10 * s); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = col; ctx.fillRect(x - 11 * s, y + 8 * s, 22 * s, 4 * s);
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(x - 6 * s, y - 12 * s, 2.5 * s, 16 * s);
}

/* ------------------------------------------------------------------ Sahna: VAX */
function drawVax(ctx, S) {
  const { w: cw, h: ch, colors: c } = S, narrow = cw < 560, Ld = LED(), m = meter();
  const benchW = narrow ? cw - 16 : cw * 0.6, k = Math.min(benchW / 450, (narrow ? 230 : ch - 20) / 200);
  const ox = narrow ? 8 : 10 + (benchW - 450 * k) / 2, oy = narrow ? 16 - 22 * k : (ch - 200 * k) / 2 - 22 * k;
  const X = (x) => ox + x * k, Y = (y) => oy + y * k;
  geo.chips = [];
  const wire = c.text2, lw = 1.8;
  const line = (pts) => { ctx.strokeStyle = wire; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke(); };
  const dot = (x, y) => { ctx.fillStyle = wire; circle(ctx, X(x), Y(y), 3); ctx.fill(); };
  // simlar: + → R → mA → LED anodi; LED katodi → −; voltmetr LED ga parallel
  line([[92, 92], [120, 92], [120, 40], [330, 40], [330, 88]]);
  line([[330, 160], [330, 205], [120, 205], [120, 150], [92, 150]]);
  line([[330, 64], [410, 64], [410, 106]]); line([[410, 140], [410, 182], [330, 182]]); dot(330, 64); dot(330, 182);
  // manba
  ctx.fillStyle = c.dark ? "#1e293b" : "#334155"; ctx.beginPath(); ctx.roundRect(X(8), Y(60), 84 * k, 124 * k, 8); ctx.fill();
  ctx.fillStyle = "#0b1220"; ctx.beginPath(); ctx.roundRect(X(16), Y(72), 68 * k, 28 * k, 4); ctx.fill();
  ctx.fillStyle = "#fbbf24"; ctx.font = `700 ${Math.round(13 * Math.min(1.2, k))}px ui-monospace, Menlo, monospace`; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(`${fmt(st.E, 2)} V`, X(80), Y(86));
  ctx.fillStyle = "#cbd5e1"; ctx.font = SMALL; ctx.textAlign = "center"; ctx.fillText("MANBA  E", X(50), Y(112));
  ctx.fillStyle = "#ef4444"; circle(ctx, X(88), Y(92), 4 * k); ctx.fill(); ctx.fillStyle = "#e2e8f0"; circle(ctx, X(88), Y(150), 4 * k); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = BOLD; ctx.fillText("+", X(74), Y(132)); ctx.fillText("−", X(74), Y(160));
  knob(ctx, { ...c, bg2: "#475569", text: "#f8fafc", text2: "#cbd5e1" }, X(36), Y(150), 12 * k, st.E / P.E_MAX, "");
  // rezistor
  ctx.fillStyle = c.bg; ctx.fillRect(X(150), Y(32), 60 * k, 16 * k); ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.strokeRect(X(150), Y(32), 60 * k, 16 * k);
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(`R = ${P.R_LIM} Ω`, X(180), Y(30));
  // ampermetr
  const meterSym = (x, y, t, val) => { ctx.fillStyle = c.bg; ctx.strokeStyle = c.text; ctx.lineWidth = 2; circle(ctx, X(x), Y(y), 15 * k); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.text; ctx.font = BOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t, X(x), Y(y) + 0.5); if (val) { ctx.font = SMALL; ctx.fillStyle = c.primary; ctx.textBaseline = "top"; ctx.fillText(val, X(x), Y(y) + 17 * k); } };
  meterSym(262, 40, "mA"); meterSym(410, 123, "V");
  // qorong‘i quti va LED
  ctx.fillStyle = "#0b1020"; ctx.beginPath(); ctx.roundRect(X(282), Y(76), 96 * k, 96 * k, 8); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(X(282), Y(76), 96 * k, 96 * k, 8); ctx.clip();
  ledBody(ctx, c, X(330), Y(118), k, Ld, P.glow(Ld, m.Itrue)); ctx.restore();
  ctx.fillStyle = "#94a3b8"; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(Ld.vis ? "qorong‘i quti" : "IK: ko‘zga ko‘rinmaydi", X(286), Y(79));
  ctx.fillStyle = c.text2; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`${Ld.short} LED · λ = ${Ld.nm} nm`, X(330), Y(210));
  if (m.Itrue > 30) tagIn(ctx, "I > 30 mA — diod qiziydi!", X(330), Y(2), cw, { color: c.danger, bg: c.bg, align: "center", font: SMALL, pad: 4 });
  // asboblar
  if (narrow) {
    const y0 = Y(228);
    lcd(ctx, 8, y0, cw / 2 - 12, 48, "VOLTMETR (LED)", fmt(m.U, 3), "V", "#60a5fa"); lcd(ctx, cw / 2 + 4, y0, cw / 2 - 12, 48, "MILLIAMPERMETR", fmt(m.I, 2), "mA");
    geo.chips.push(...chipGrid(ctx, c, 8, y0 + 56, cw - 16, [["E −1", -1], ["−0,1", -0.1], ["−0,01", -0.01], ["+0,01", 0.01], ["+0,1", 0.1], ["E +1", 1]], 6, 26).map((b) => ({ ...b, k: "dE" })));
    geo.chips.push(...ledChips(ctx, c, 8, y0 + 88, cw - 16, 7));
    return;
  }
  const rx = ox + 450 * k + 14, rw = cw - rx - 10;
  lcd(ctx, rx, 10, rw, 52, "VOLTMETR · LED kuchlanishi U", fmt(m.U, 3), "V", "#60a5fa");
  lcd(ctx, rx, 68, rw, 52, "MILLIAMPERMETR · tok I", fmt(m.I, 2), "mA");
  const kr = 20, kx = rx + kr + 8, ky = 152; knob(ctx, c, kx, ky, kr, st.E / P.E_MAX, "manba E"); geo.knob = { x: kx, y: ky, r: kr + 10 };
  geo.chips.push(...chipGrid(ctx, c, kx + kr + 16, 130, rx + rw - (kx + kr + 16), [["+1 V", 1], ["−1 V", -1], ["+0,1", 0.1], ["−0,1", -0.1], ["+0,01", 0.01], ["−0,01", -0.01]], 2, 24).map((b) => ({ ...b, k: "dE" })));
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("Yorug‘lik diodi", rx, 232);
  geo.chips.push(...ledChips(ctx, c, rx, 238, rw, 4));
  const sb = chipBtn(ctx, c, rx, ch - 34, st.scan ? "■ To‘xtatish" : `▶ Avtomatik skanerlash (E: 0 → ${P.E_MAX} V)`, st.scan, rw, 26); geo.chips.push({ ...sb, k: "scan" });
}
function ledChips(ctx, c, x, y, w, cols, onlyVis = false) {
  const items = P.LEDS.filter((l) => !onlyVis || l.vis), gap = 4, bw = (w - gap * (cols - 1)) / cols, out = [];
  items.forEach((l, i) => { const b = chipBtn(ctx, c, x + (i % cols) * (bw + gap), y + Math.floor(i / cols) * 28, l.id === "IR" ? "IK" : `${l.nm}`, l.id === st.led, bw, 24, l.color); if (l.id !== st.led) { ctx.fillStyle = l.color; circle(ctx, b.x0 + 8, (b.y0 + b.y1) / 2, 3.5); ctx.fill(); } out.push({ ...b, v: l.id, k: "led" }); });
  return out;
}

/* ------------------------------------------------------------------ Sahna: spektrometr */
function drawSpec(ctx, S) {
  const { w: cw, h: ch, colors: c } = S, narrow = cw < 560, Ld = LED();
  const benchW = narrow ? cw - 16 : cw * 0.6, k = Math.min(benchW / 420, (narrow ? 210 : ch - 16) / 214);
  const ox = narrow ? 8 : 10 + (benchW - 420 * k) / 2, oy = narrow ? 4 : (ch - 214 * k) / 2;
  const X = (x) => ox + x * k, Y = (y) => oy + y * k, cx = X(200), cy = Y(196);
  geo.chips = []; geo.tele = { x: cx, y: cy };
  // limb (shkala)
  const Rl = 186 * k;
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, Rl, -82 * DEG, 2 * DEG); ctx.stroke();
  for (let a = 0; a <= 80; a += 1) { const r1 = Rl, r2 = Rl - (a % 10 === 0 ? 9 : a % 5 === 0 ? 6 : 3) * k, an = -a * DEG; ctx.strokeStyle = a % 10 === 0 ? c.text2 : c.text3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); ctx.lineTo(cx + Math.cos(an) * r2, cy + Math.sin(an) * r2); ctx.stroke(); if (a % 10 === 0) { ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${a}°`, cx + Math.cos(an) * (Rl + 12 * k), cy + Math.sin(an) * (Rl + 10 * k)); } }
  // manba + kollimator
  ctx.fillStyle = "#0b1020"; ctx.beginPath(); ctx.roundRect(X(2), cy - 22 * k, 40 * k, 44 * k, 6); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.roundRect(X(2), cy - 22 * k, 40 * k, 44 * k, 6); ctx.clip(); ledBody(ctx, c, X(22), cy + 4 * k, 0.75 * k, Ld, 0.6); ctx.restore();
  ctx.fillStyle = c.dark ? "#475569" : "#64748b"; ctx.fillRect(X(46), cy - 8 * k, 120 * k, 16 * k); ctx.fillStyle = c.text3; ctx.fillRect(X(46), cy - 10 * k, 4 * k, 20 * k);
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("kollimator (tirqish)", X(106), cy - 12 * k);
  // nurlar: 0-tartib va m = 1, 2
  const ray = (ang, col, al, wd) => { ctx.strokeStyle = col; ctx.globalAlpha = al; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(-ang * DEG) * Rl * 0.96, cy + Math.sin(-ang * DEG) * Rl * 0.96); ctx.stroke(); ctx.globalAlpha = 1; };
  if (Ld.vis) {
    ray(0, Ld.color, 0.5, 3);
    for (const mo of [1, 2]) for (let dl = -1.2; dl <= 1.2; dl += 0.2) { const nm = Ld.nm + dl * Ld.fw * 0.85, t = P.thetaOf(nm, mo); if (t !== null && t < 82) ray(t, rgb(P.nmRGB(nm)), (mo === 1 ? 0.5 : 0.18) * P.spec(Ld, nm), 1.6); }
  }
  // stolcha va panjara
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; circle(ctx, cx, cy, 22 * k); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.text; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - 16 * k); ctx.lineTo(cx, cy + 16 * k); ctx.stroke();
  if (!narrow) { ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`panjara ${P.GRATING} chiz./mm`, cx - 20 * k, cy + 26 * k); }
  // ko‘rish trubasi
  const an = -st.phi * DEG, ca = Math.cos(an), sa = Math.sin(an), along = (r) => [cx + ca * r * k, cy + sa * r * k], nx = -sa, ny = ca;
  const tube = (r0, r1, wd, col) => { const [x0, y0] = along(r0), [x1, y1] = along(r1); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 + nx * wd * k, y0 + ny * wd * k); ctx.lineTo(x1 + nx * wd * k, y1 + ny * wd * k); ctx.lineTo(x1 - nx * wd * k, y1 - ny * wd * k); ctx.lineTo(x0 - nx * wd * k, y0 - ny * wd * k); ctx.closePath(); ctx.fill(); };
  ctx.strokeStyle = c.text3; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...along(52)); ctx.stroke();
  tube(52, 160, 9, c.dark ? "#64748b" : "#475569"); tube(160, 178, 6, c.dark ? "#94a3b8" : "#1e293b");
  const [hx, hy] = along(Rl / k - 2); ctx.fillStyle = c.danger; circle(ctx, hx, hy, 3.5); ctx.fill();
  geo.teleR = [52 * k, 182 * k];
  tagIn(ctx, `φ = ${fmt(st.phi, 2)}°`, ...along(118).map((v, i) => (i ? v - 22 : v)), cw, { color: c.primary, bg: c.bg, align: "center", font: BOLD, pad: 5 });
  // okulyar ko‘rinishi va asboblar
  if (narrow) {
    const y0 = Y(214) + 8, r = 46; eyepiece(ctx, c, 8 + r, y0 + r, r, Ld);
    lcd(ctx, 8 + 2 * r + 10, y0, cw - 2 * r - 26, 46, "BURChAK φ (nonius)", fmt(st.phi, 2), "°", "#60a5fa");
    geo.chips.push(...chipGrid(ctx, c, 8 + 2 * r + 10, y0 + 52, cw - 2 * r - 26, [["−1°", -1], ["−0,1", -0.1], ["−0,05", -0.05], ["+0,05", 0.05], ["+0,1", 0.1], ["+1°", 1]], 3, 22).map((b) => ({ ...b, k: "dP" })));
    geo.chips.push(...ledChips(ctx, c, 8, y0 + 2 * r + 8, cw - 16, 7));
    return;
  }
  const rx = ox + 420 * k + 14, rw = cw - rx - 10, r = Math.min(62, rw / 2 - 40);
  eyepiece(ctx, c, rx + r + 2, 12 + r, r, Ld);
  lcd(ctx, rx + 2 * r + 14, 12, rw - 2 * r - 14, 50, "BURChAK φ", fmt(st.phi, 2), "°", "#60a5fa");
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("okulyar: chiziq markazini", rx + 2 * r + 14, 70); ctx.fillText("vizir chizig‘iga keltiring", rx + 2 * r + 14, 83);
  geo.chips.push(...chipGrid(ctx, c, rx, 2 * r + 24, rw, [["+5°", 5], ["+1°", 1], ["+0,1°", 0.1], ["+0,05°", 0.05], ["−5°", -5], ["−1°", -1], ["−0,1°", -0.1], ["−0,05°", -0.05]], 4, 24).map((b) => ({ ...b, k: "dP" })));
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("Yorug‘lik diodi", rx, 2 * r + 92);
  geo.chips.push(...ledChips(ctx, c, rx, 2 * r + 98, rw, 4));
}
function eyepiece(ctx, c, x, y, r, Ld) {
  ctx.save(); ctx.fillStyle = "#020617"; circle(ctx, x, y, r); ctx.fill(); ctx.clip();
  if (Ld.vis) {
    const fov = 1.3;
    for (let px = -r; px <= r; px += 1.5) {
      const a = st.phi + (px / r) * fov; let R = 0, G = 0, B = 0;
      for (const s of P.seenAt(Ld, a)) { const q = P.nmRGB(s.nm); R += q[0] * s.I; G += q[1] * s.I; B += q[2] * s.I; }
      if (st.phi + (px / r) * fov < 0.6 && st.phi + (px / r) * fov > -0.6) { const z = Math.exp(-((a / 0.25) ** 2)); const q = P.nmRGB(Ld.nm); R += q[0] * z; G += q[1] * z; B += q[2] * z; }
      const mx = Math.max(R, G, B); if (mx < 3) continue; const sc = mx > 255 ? 255 / mx : 1;
      ctx.fillStyle = `rgb(${R * sc | 0},${G * sc | 0},${B * sc | 0})`; ctx.fillRect(x + px, y - r * 0.62, 1.6, r * 1.24);
    }
  }
  ctx.strokeStyle = "rgba(250,250,250,0.85)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.moveTo(x - r, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + r, y); ctx.stroke();
  if (!Ld.vis) { ctx.fillStyle = "#94a3b8"; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("IK nur ko‘rinmaydi", x, y + r * 0.45); }
  ctx.restore(); ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 3; circle(ctx, x, y, r); ctx.stroke();
}
const draw = (ctx, S) => (st.mode === "vax" ? drawVax(ctx, S) : drawSpec(ctx, S));

/* ------------------------------------------------------------------ Grafik I(U) */
function drawGraph(ctx, G) {
  const { w, h, colors: c } = G; ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
  const keys = Object.keys(curves).filter((k) => curves[k].pts.length), m = meter();
  const Imax = Math.max(10, ...keys.flatMap((k) => curves[k].pts.map((p) => p[1])), m.I) * 1.08;
  const x0 = 46, x1 = w - 12, y0 = 14, y1 = h - 30, X = (U) => x0 + (U / 4) * (x1 - x0), Y = (I) => y1 - (I / Imax) * (y1 - y0);
  geo.g = { x0, x1, X, Y };
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.fillStyle = c.text3; ctx.font = SMALL;
  for (let U = 0; U <= 4.001; U += 0.25) { ctx.beginPath(); ctx.moveTo(X(U), y0); ctx.lineTo(X(U), y1); ctx.stroke(); if (Math.abs(U - Math.round(U * 2) / 2) < 1e-6) { ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(fmt(U, 1), X(U), y1 + 5); } }
  const stp = Imax > 30 ? 10 : 5;
  for (let I = 0; I <= Imax; I += stp) { ctx.beginPath(); ctx.moveTo(x0, Y(I)); ctx.lineTo(x1, Y(I)); ctx.stroke(); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(fmt(I, 0), x0 - 5, Y(I)); }
  ctx.strokeStyle = c.borderStrong; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("I, mA", x0 + 4, y0 + 2); ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("U, V", x1 - 4, y1 - 3);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  keys.forEach((k) => { const Ld = P.ledById(k), on = k === st.led, pts = curves[k].pts.slice().sort((a, b) => a[0] - b[0]); ctx.strokeStyle = Ld.color; ctx.globalAlpha = on ? 1 : 0.5; ctx.lineWidth = on ? 2.2 : 1.4; ctx.beginPath(); pts.forEach(([U, I], j) => (j ? ctx.lineTo(X(U), Y(I)) : ctx.moveTo(X(U), Y(I)))); ctx.stroke();
    if (pts.length) { const [U, I] = pts.at(-1); ctx.fillStyle = Ld.color; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(Ld.id === "IR" ? "IK" : `${Ld.nm}`, Math.min(X(U) + 3, x1 - 26), Math.max(Y(I) - 2, y0 + 12)); } });
  ctx.globalAlpha = 1; ctx.fillStyle = c.danger; circle(ctx, X(m.U), Y(m.I), 4); ctx.fill();
  ctx.restore();
  const cur = curves[st.led]?.pts || [];
  if (st.cursor !== null && cur.length) {
    const U = ((st.cursor - x0) / (x1 - x0)) * 4; let b = cur[0]; cur.forEach((p) => { if (Math.abs(p[0] - U) < Math.abs(b[0] - U)) b = p; });
    ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(b[0]), y0); ctx.lineTo(X(b[0]), y1); ctx.stroke(); ctx.setLineDash([]);
    tagIn(ctx, `U = ${fmt(b[0], 3)} V · I = ${fmt(b[1], 2)} mA`, X(b[0]) - 8, y0 + 26, w, { color: c.text, bg: c.bg2, align: "right", font: BOLD, pad: 6 });
  }
  if (!keys.length) { ctx.fillStyle = c.text3; ctx.font = MID; ctx.textAlign = "center"; ctx.fillText("Manba kuchlanishini oshiring yoki «Avtomatik skanerlash» ni bosing", (x0 + x1) / 2, (y0 + y1) / 2); }
}
const heights = (cw) => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { stage: Math.round(clamp(Math.min(cw * 0.48, vh * 0.48), 320, 390)), graph: Math.round(clamp(vh * 0.3, 200, 270)) }; };
const stage = createStage($("#stage"), draw, { height: (cw) => (cw < 560 ? Math.round(((cw - 16) / 450) * 206 + 162) : heights(cw).stage) });
const graph = createStage($("#graph"), drawGraph, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */
const setRO = readouts($("[data-readouts]"));
function updateReadouts() {
  const Ld = LED();
  if (st.mode === "vax") {
    const m = meter();
    setRO("r1", "LED kuchlanishi <i>U</i>", u(fmt(m.U, 3), "V"), "voltmetr");
    setRO("r2", "Tok <i>I</i>", u(fmt(m.I, 2), "mA"), m.I > 30 ? "ruxsat etilganidan katta!" : "milliampermetr", m.I > 30 ? "red" : "");
    setRO("r3", "Manba <i>E</i>", u(fmt(st.E, 2), "V"), `R = ${P.R_LIM} Ω orqali`);
    setRO("r4", "Diod", Ld.short, Ld.name);
    setRO("r5", "Pasport <i>λ</i>", u(String(Ld.nm), "nm"), `Δλ ≈ ${Ld.fw} nm`);
    setRO("r6", "<i>hc/λ</i>", u(fmt(P.photonEv(Ld.nm), 3), "eV"), "foton energiyasi");
  } else {
    const lam = (P.D_NM * Math.sin(st.phi * DEG));
    setRO("r1", "Burchak <i>φ</i>", u(fmt(st.phi, 2), "°"), "nonius");
    setRO("r2", "<i>d</i>·sin <i>φ</i>", u(fmt(lam, 1), "nm"), "m = 1 bo‘lsa — λ");
    setRO("r3", "Panjara doimiysi <i>d</i>", u(fmt(P.D_NM, 1), "nm"), `${P.GRATING} chiziq/mm`);
    setRO("r4", "Diod", Ld.short, Ld.vis ? Ld.name : "IK — ko‘rinmaydi");
    setRO("r5", "Pasport <i>λ</i>", u(String(Ld.nm), "nm"), "taqqoslash uchun");
    setRO("r6", "1-tartib burchagi", Ld.vis ? "toping" : "—", "chiziq vizirda bo‘lsin");
  }
}
function updateStatus() { const el = $("[data-status]"), t = st.mode === "spec" ? "Spektrometr" : st.scan ? "Skanerlanmoqda…" : `I(U): ${(curves[st.led]?.pts || []).length} nuqta`; if (el.textContent !== t) el.textContent = t; el.dataset.tone = st.scan ? "green" : "blue"; }
let lastEx = "";
function updateExplain() {
  const Ld = LED();
  const html = st.mode === "vax"
    ? `<p>LED dagi p–n o‘tishdan tok o‘tganda elektronlar kovaklar bilan rekombinatsiyalanadi va energiyasi taqiqlangan zona kengligi <b>E<sub>g</sub></b> ga yaqin foton chiqadi. Diod deyarli <b>eU ≈ E<sub>g</sub> ≈ hc/λ</b> bo‘lganda «ochiladi».</p><p>VAX ning chiziqli qismida (I ≈ 5…20 mA) ikki nuqtani yozib oling va to‘g‘ri chiziqni I = 0 gacha davom ettiring — bo‘sag‘a <b>U₀</b>. Turli rangdagi diodlar uchun U₀(ν) qiyaligi <b>h/e</b>. Hozir: ${Ld.short}, hc/λ = ${fmt(P.photonEv(Ld.nm), 3)} eV.</p>`
    : `<p>Kollimatordan chiqqan parallel dasta difraksion panjarada og‘adi: <b>d·sin φ = mλ</b>. LED spektri bir necha o‘n nanometr kenglikdagi polosa — ko‘rish trubasini burib, polosaning eng yorug‘ markazini vizir chizig‘iga keltiring.</p><p>2-tartib (m = 2) xiraroq va ikki baravar katta burchakda. Hozir: ${Ld.short}${Ld.vis ? `, 1-tartib ≈ ${fmt(P.thetaOf(Ld.nm), 0)}° atrofida` : " — IK nurni ko‘z ko‘rmaydi, uning λ pasportdan olinadi"}.</p>`;
  if (html !== lastEx) { $("[data-explain]").innerHTML = html; lastEx = html; }
}
const actBtn = $("[data-action]"), resetBtn = $("[data-reset]");
function updateAction() {
  const t = st.mode === "vax" ? (st.scan ? "To‘xtatish" : "Avtomatik skanerlash") : "Keyingi diod";
  if (actBtn.textContent !== t) actBtn.textContent = t; resetBtn.textContent = st.mode === "vax" ? "Grafikni tozalash" : "Trubani 0° ga";
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateAction(); syncUI(); stage.render(); if (st.mode === "vax") graph.render(); }

/* ------------------------------------------------------------------ Vaqt */
let uiT = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return; st.t += dt;
  if (st.scan) { const n = Math.max(1, Math.round(dt / 0.02)); for (let i = 0; i < n && st.scan; i++) { setE(st.E + 0.02); if (st.E >= P.E_MAX - 1e-9) st.scan = false; } graph.render(); }
  stage.render();
  uiT += dt; if (uiT > 0.15) { uiT = 0; updateReadouts(); updateStatus(); updateAction(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) { playBtn.setAttribute("aria-pressed", String(on)); playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play"); playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish"; }
playBtn.addEventListener("click", () => loop.toggle());
function toggleScan() { if (st.scan) st.scan = false; else { setE(0); st.scan = true; if (!loop.running) loop.start(); } }
actBtn.addEventListener("click", () => {
  if (st.mode === "vax") toggleScan(); else { const vis = P.LEDS.filter((l) => l.vis), i = vis.findIndex((l) => l.id === st.led); st.led = vis[(i + 1) % vis.length].id; }
  customized(); refresh();
});
resetBtn.addEventListener("click", () => { if (st.mode === "vax") { st.scan = false; curves = {}; store.set(REC, curves); } else setPhi(0); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */
$("[data-ledset]").innerHTML = P.LEDS.map((l) => `<button type="button" data-led="${l.id}" title="${l.name}"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${l.color}"></span>${l.id === "IR" ? "IK 940" : l.nm} nm</button>`).join("");
const setLed = (id) => { st.led = id; st.scan = false; record(); customized(); refresh(); };
document.addEventListener("click", (e) => { const b = e.target.closest("[data-led]"); if (b && b.closest(".sim-panel")) setLed(b.dataset.led); });
const eIn = $("#pE"), eOut = $("#pEOut"), fIn = $("#pPhi"), fOut = $("#pPhiOut");
eIn.addEventListener("input", () => { st.scan = false; setE(+eIn.value); customized(); refresh(); });
fIn.addEventListener("input", () => { setPhi(+fIn.value); customized(); refresh(); });
function syncUI() {
  document.querySelectorAll("[data-led]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.led === st.led)));
  if (+eIn.value !== st.E) eIn.value = st.E; eOut.textContent = `${fmt(st.E, 2)} V`;
  if (+fIn.value !== st.phi) fIn.value = st.phi; fOut.textContent = `${fmt(st.phi, 2)}°`;
  document.querySelectorAll("[data-only]").forEach((el) => { el.hidden = el.dataset.only !== st.mode; });
}
const canvas = stage.canvas;
let drag = null, dragY0 = 0, dragV0 = 0;
const ptr = (e, cv = canvas) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function hit(p) {
  for (const ch of geo.chips || []) if (inBox(p, ch)) return { k: "chip", ch };
  if (st.mode === "vax" && geo.knob && Math.hypot(p.x - geo.knob.x, p.y - geo.knob.y) <= geo.knob.r) return { k: "knob" };
  if (st.mode === "spec" && geo.tele) { const dx = p.x - geo.tele.x, dy = geo.tele.y - p.y, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx) / DEG; if (r > geo.teleR[0] && r < geo.teleR[1] + 10 && Math.abs(a - st.phi) < 6) return { k: "tele" }; }
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hit(p); if (!h) return;
  if (h.k === "chip") { const ch = h.ch; if (ch.k === "dE") { st.scan = false; setE(st.E + ch.v); } else if (ch.k === "dP") setPhi(st.phi + ch.v); else if (ch.k === "led") { setLed(ch.v); return; } else if (ch.k === "scan") toggleScan(); customized(); refresh(); return; }
  drag = h.k; dragY0 = p.y; dragV0 = st.E; st.scan = false; canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } e.preventDefault();
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(e);
  if (!drag) { const h = hit(p); canvas.style.cursor = h ? (h.k === "knob" ? "ns-resize" : h.k === "tele" ? "grab" : "pointer") : ""; return; }
  if (drag === "knob") setE(dragV0 + (dragY0 - p.y) * 0.02);
  else { const a = Math.atan2(geo.tele.y - p.y, p.x - geo.tele.x) / DEG; setPhi(Math.round(a * 20) / 20); }
  customized(); refresh();
});
const end = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
graph.canvas.addEventListener("pointermove", (e) => { const p = ptr(e, graph.canvas); st.cursor = geo.g && p.x >= geo.g.x0 && p.x <= geo.g.x1 ? p.x : null; graph.render(); });
graph.canvas.addEventListener("pointerleave", () => { st.cursor = null; graph.render(); });

/* ------------------------------------------------------------------ Rejim va tayyor tajribalar */
const MODE_HINT = { vax: "Manba kuchlanishini dastak yoki tugmalar bilan o‘zgartiring", spec: "Ko‘rish trubasini sudrang yoki tugmalar bilan buring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === st.mode)));
  $("[data-graph-card]").hidden = st.mode !== "vax"; $("[data-mode-hint]").textContent = MODE_HINT[st.mode];
  $("[data-formula]").innerHTML = st.mode === "vax" ? "<small>Bo‘sag‘a</small> eU₀ ≈ hc/λ" : "<small>Panjara</small> d·sin φ = mλ";
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== st.mode) loadPreset(b.dataset.modeValue === "vax" ? "red" : "specG"); }));
const PRESETS = {
  red: { title: "Qizil LED: VAX", lesson: "E ni 0 dan oshiring: U ≈ 1,8 V gacha tok deyarli yo‘q, so‘ng keskin o‘sadi. I ≈ 5 va 15 mA bo‘lgan ikki nuqtani yozing — ular VAX ning chiziqli qismida.", set: () => Object.assign(st, { mode: "vax", led: "R", E: 2.6 }) },
  violet: { title: "Binafsha LED: katta bo‘sag‘a", lesson: "405 nm diod ≈ 3,1 V da ochiladi — foton energiyasi katta. Barcha diodlar uchun U₀ ni toping va ν ga qarab grafik chizing.", set: () => Object.assign(st, { mode: "vax", led: "V", E: 4.5 }) },
  ir: { title: "Infraqizil LED", lesson: "940 nm diod ≈ 1,3 V da ochiladi; nuri ko‘zga ko‘rinmaydi (telefon kamerasi uni ko‘radi). U₀ < 1,5 V.", set: () => Object.assign(st, { mode: "vax", led: "IR", E: 2.5 }) },
  specG: { title: "Spektrometr: yashil LED", lesson: "Trubani 18° atrofiga buring. Polosaning eng yorug‘ joyini vizirga keltirib, φ ni yozing: λ = d·sin φ.", set: () => Object.assign(st, { mode: "spec", led: "G", phi: 15 }) },
  spec2: { title: "Spektrometr: 2-tartib", lesson: "Qizil LED ning 2-tartib spektri ≈ 49° da — xiraroq. sin φ₂ = 2λ/d formulasi bilan λ ni qayta hisoblang.", set: () => Object.assign(st, { mode: "spec", led: "R", phi: 47 }) },
};
const presetBox = $("[data-presets]");
presetBox.innerHTML = Object.entries(PRESETS).map(([id, p]) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${p.title}</button>`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPP = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPP(null); $("[data-lesson]").textContent = ""; } }
function loadPreset(id) {
  const p = PRESETS[id]; st.scan = false; p.set(); if (st.mode === "vax") record();
  setModeUI(); presetId = id; setPP(id); $("[data-lesson]").textContent = p.lesson;
  refresh(); if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* */ }
}

/* ------------------------------------------------------------------ Laboratoriya daftari */
const ledOpts = [["", "— diod —"], ...P.LEDS.map((l) => [l.id, `${l.short} (${l.nm} nm)`])];
const visOpts = [["", "— diod —"], ...P.LEDS.filter((l) => l.vis).map((l) => [l.id, `${l.short} (${l.nm} nm)`])];
const sciH = (h) => `${(h / 1e-34).toFixed(3).replace(".", ",")}·10⁻³⁴ J·s`;
createNotebook($("[data-notebook]"), {
  key: "led", docLabel: DOC_LABEL, site: SITE,
  intro: "Avval spektrometrda diodlar nurining to‘lqin uzunligini o‘lchang (ixtiyoriy, aks holda pasport qiymati olinadi), so‘ng VAX dan bo‘sag‘a kuchlanishni toping. Hisoblashlar avtomatik bajariladi.",
  conclusionPh: "U₀ chastotaga chiziqli bog‘liqmi? Topilgan h jadval qiymatidan qancha farq qiladi va nima uchun? O‘lchangan λ pasportdagiga mosmi?",
  hint: "Javob bering: 1) U₀(ν) grafigi to‘g‘ri chiziqmi, qiyaligi nimaga teng? 2) h ning ikki usul (EKK va o‘rtacha h_i) bilan topilgan qiymatlari va jadval qiymati bilan farqi. 3) Nima uchun eU₀ hc/λ ga aniq teng emas (issiqlik, kontakt kuchlanishi, spektr kengligi)? 4) Spektrometrda o‘lchangan λ pasport qiymatiga qanchalik mos?",
  fileBase: (nb) => `LED-Plank-lab-${translit(nb.f.name)}`,
  minTables: 1,
  tables: [
    { key: "t1", okLabel: "λ (spektrometr)", need: "1-jadvalda kamida 3 xil diod", title: "1-topshiriq. Nurlanish to‘lqin uzunligini difraksion panjara bilan o‘lchash",
      desc: `«Spektrometr» rejimida ko‘rish trubasini buring va spektr polosasining eng yorug‘ markazi vizirga tushgan φ burchakni yozing. Panjara: ${P.GRATING} chiziq/mm (d = ${fmt(P.D_NM, 1)} nm). Ixtiyoriy — o‘lchanmagan diodlar uchun pasport λ olinadi.`,
      head: ["Diod", "m", "φ, °", "sin φ", "λ = d·sin φ/m, nm", "Tekshiruv"], cols: [{ k: "led", kind: "sel", opts: visOpts }, { k: "m", kind: "sel", opts: [[1, "1"], [2, "2"]] }, { k: "phi", kind: "num" }], outs: ["sin", "lam"],
      blank: (i) => ({ led: ["R", "Y", "G", "B", "V", "O"][i] || "", m: "1", phi: "" }), rows: 4, max: 10, narrow: true,
      parse: (r) => ({ led: r.led, m: +r.m, phi: num(r.phi) }), check: L.check1, analyze: (rows) => L.analyze1(rows),
      out: (A, j) => { const r = A.rows[j]; return { sin: fmt(Math.sin(r.phi * DEG), 4), lam: fmt(r.lam, 1) }; },
      match: (r) => L.match1(r), noMatch: "Polosa markazidan ±0,3° dan ko‘p farq",
      summary: (A) => Object.entries(A.lam).slice(0, 6).map(([id, lam]) => [P.ledById(id).short, `${fmt(lam, 1)} nm`, `pasport ${P.ledById(id).nm} nm`]),
      ok: (A) => A.ok },
    { key: "t2", req: true, okLabel: "U₀(ν)", need: "2-jadvalda kamida 3 xil diod", title: "2-topshiriq. Volt-amper xarakteristikasi va bo‘sag‘a kuchlanishi",
      desc: "Har bir diod uchun VAX ning chiziqli qismidan (I ≈ 5…20 mA) ikki nuqta (U₁, I₁) va (U₂, I₂) ni yozing. Bo‘sag‘a: U₀ = U₁ − I₁(U₂ − U₁)/(I₂ − I₁). Kamida 3 xil diod.",
      head: ["Diod", "U₁, V", "I₁, mA", "U₂, V", "I₂, mA", "U₀, V", "λ, nm", "ν, 10¹⁴ Hz", "Tekshiruv"], cols: [{ k: "led", kind: "sel", opts: ledOpts }, { k: "U1", kind: "num" }, { k: "I1", kind: "num" }, { k: "U2", kind: "num" }, { k: "I2", kind: "num" }], outs: ["U0", "lam", "nu"],
      blank: (i) => ({ led: ["R", "Y", "G", "B", "V", "IR", "O"][i] || "", U1: "", I1: "", U2: "", I2: "" }), rows: 4, max: 10,
      parse: (r) => ({ led: r.led, U1: num(r.U1), I1: num(r.I1), U2: num(r.U2), I2: num(r.I2) }), check: L.check2,
      analyze: (rows, c, res) => L.analyze2(rows, res?.t1?.A?.lam || {}),
      out: (A, j) => { const r = A.rows[j]; return { U0: fmt(r.U0, 3), lam: `${fmt(r.lam, 1)}${r.meas ? "" : "*"}`, nu: fmt(r.nu14, 3) }; },
      match: (r) => L.match2(r), noMatch: "Nuqta qurilmadagi VAX ustida emas (I ±2 % yoki U ±3 mV)",
      summary: (A) => A.fit ? [["h = e·k (EKK)", sciH(A.h), `farq ${fmt((100 * (A.h - P.H)) / P.H, 1)}%`], ["h_i o‘rtacha", sciH(A.hm), `± ${fmt(A.hsd / 1e-34, 3)}·10⁻³⁴`], ["λ manbai", A.rows.some((r) => !r.meas) ? "* — pasport" : "spektrometr", ""]] : null,
      ok: (A) => A.ok && !!A.fit },
  ],
  build: (nb, res) => buildLedDoc(nb, res, Object.fromEntries(Object.entries(curves).filter(([, v]) => v.pts.length >= 20).map(([k, v]) => [k, { pts: v.pts }]))),
});

/* ------------------------------------------------------------------ Ishga tushirish */
setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "red");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
