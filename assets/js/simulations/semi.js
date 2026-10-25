// ==========================================================================
// Yarimo'tkazgichlar va p–n o'tish — virtual laboratoriya (simulations/semiconductor.html)
// 1) Metall va yarimo'tkazgich: plitkadagi suvli stakanda mis g'altak va termorezistor, ikkita multimetr (R(t));
//    fotorezistor optik skamyada (lampa, luksmetr). Mikroskopik ko'rinish: ionlar tebranishi / erkin elektronlar.
// 2) O'tkazuvchanlik: kremniy (germaniy) panjarasi, kovalent bog'lar, elektron-kovak juftlari, fosfor (n-tip) va bor
//    (p-tip) atomlari; batareya ulansa elektronlar va kovaklar qarama-qarshi tomonga dreyf qiladi.
// 3) Diod va tranzistor: diod VAX ni o'lchash (manba, qutb almashtirgich, rezistor, ampermetr, voltmetr; p–n o'tish
//    kesimi), yarim/to'liq davrli to'g'rilagich (transformator, diod ko'prigi, kondensator, ossillograf),
//    tranzistor kalit va kuchaytirgich (potensiometr, baza va kollektor toklari, lampa).
// Dunyo koordinatalari 520×300 (shartli birlik). Fizika: semi-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { analogMeter, powerSupply, wire, terminal, multimeter, plug } from "./instruments.js";
import { tempRGB } from "./bb-physics.js";
import * as P from "./semi-physics.js";
import { drawRT, drawPhoto, drawCarriers, drawVAX, drawWave, drawTr, lastFrame, fI, fR, p10 } from "./semi-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const hash = (k) => { const h = Math.sin(k * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };

/* ------------------------------------------------------------------ Holat */

const WORLD = [520, 300];
const ui = { mode: "rt", kind: { rt: "thermo", pn: "vax" }, view: { thermo: "R", photo: "R", lat: "n", vax: "I", rect: "u", tr: "I" }, hover: null, speed: 5 };
const rt = { T: 20, level: 1, heat: true, hist: [], t: 0, lampOn: true, d: 30, room: 150 };
const lat = { mat: "si", dope: "i", logN: 21, T: 300, field: false, atoms: [], e: [], h: [], fx: [], acc: 0, flow: 0 };
const dio = { type: "si", pol: 1, E: 2, T: 20, pts: [] };
const rec = { bridge: false, C: 0, R: 100, ph: 0, res: null };
const trs = { U: 1.5, Rb: 2000 };
const R_LIM = 101, UCC = 6, R_LAMP = 40;
let presetId = null;
let running = false;
let CW = 800, anim = 0;
const hits = {};
const kind = () => (ui.mode === "lat" ? "lat" : ui.kind[ui.mode]);

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
const F = (w, px) => `${w} ${Math.max(6, px * view.s)}px Inter, system-ui, sans-serif`;
const COL = (c) => ({ red: c.dark ? "#f87171" : "#b91c1c", black: c.dark ? "#cbd5e1" : "#1f2937", blue: c.dark ? "#60a5fa" : "#1d4ed8", yellow: c.dark ? "#facc15" : "#a16207" });
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
/** Egiluvchan o'lchov simi (silliq egri chiziq) */
function cable(ctx, pts, color, w = 2.2) {
  const q = S(pts);
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  const path = () => { ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length - 1; i++) ctx.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2); ctx.lineTo(q.at(-1)[0], q.at(-1)[1]); };
  path(); ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = Math.max(2, (w + 1.4) * view.s); ctx.stroke();
  path(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.4, w * view.s); ctx.stroke();
  ctx.restore();
}
/** Krokodil qisqich */
function clip(ctx, x, y, color) {
  const s = view.s; ctx.save();
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(X(x - 3), Y(y - 10), 6 * s, 9 * s, 1.5 * s); ctx.fill();
  ctx.fillStyle = "#a1a1aa"; ctx.beginPath(); ctx.moveTo(X(x - 3), Y(y - 1)); ctx.lineTo(X(x + 3), Y(y - 1)); ctx.lineTo(X(x + 1), Y(y + 3)); ctx.lineTo(X(x - 1), Y(y + 3)); ctx.closePath(); ctx.fill();
  ctx.restore();
}
/** Rezistor (rangli halqalar bilan) — a, b uchlari (dunyo), bands — ranglar */
function resistor(ctx, c, a, b, bands, { body = "#e7d3a7", len = 30 } = {}) {
  const s = view.s, [ax, ay] = a, [bx, by] = b, L = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
  ctx.save(); ctx.translate(X(ax), Y(ay)); ctx.rotate(ang);
  ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = Math.max(1, 1.3 * s); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * s, 0); ctx.stroke();
  const x0 = ((L - len) / 2) * s, h = 9 * s;
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, "#fff7e6"); g.addColorStop(0.4, body); g.addColorStop(1, "#a8875a");
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x0, -h / 2, len * s, h, h / 2); ctx.fill();
  bands.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(x0 + (i < 3 ? (5 + i * 5) : len - 7) * s, -h / 2, 2.4 * s, h); });
  ctx.restore();
}
const BANDS = { 100: ["#7c2d12", "#111827", "#7c2d12", "#d4a017"], 1000: ["#7c2d12", "#111827", "#dc2626", "#d4a017"], 2000: ["#dc2626", "#111827", "#dc2626", "#d4a017"], 4700: ["#eab308", "#7c3aed", "#dc2626", "#d4a017"], 10000: ["#7c2d12", "#111827", "#f97316", "#d4a017"] };
/** O'q bo'ylab joylashgan diod (1N4007): a — anod, b — katod; on — tok o'tmoqda */
function axialDiode(ctx, c, a, b, on = false, glass = false) {
  const s = view.s, [ax, ay] = a, [bx, by] = b, L = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax), len = glass ? 20 : 24, h = glass ? 7 : 10;
  ctx.save(); ctx.translate(X(ax), Y(ay)); ctx.rotate(ang);
  ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = Math.max(1, 1.3 * s); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * s, 0); ctx.stroke();
  const x0 = ((L - len) / 2) * s;
  if (on) { ctx.shadowColor = c.dark ? "rgba(250,204,21,0.9)" : "rgba(234,179,8,0.9)"; ctx.shadowBlur = 10 * s; }
  if (glass) {
    ctx.fillStyle = "rgba(226,232,240,0.55)"; ctx.strokeStyle = "rgba(148,163,184,0.9)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x0, (-h / 2) * s, len * s, h * s, (h / 2) * s); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#b45309"; ctx.fillRect(x0 + 3 * s, -1.2 * s, (len - 6) * s * 0.55, 2.4 * s);
    ctx.strokeStyle = "#78716c"; ctx.lineWidth = Math.max(0.8, 0.8 * s); ctx.beginPath(); ctx.moveTo(x0 + (len * 0.62) * s, 0); ctx.lineTo(x0 + (len * 0.8) * s, -2 * s); ctx.stroke();
    ctx.fillStyle = "#dc2626"; ctx.fillRect(x0 + (len - 5) * s, (-h / 2) * s, 2 * s, h * s);
  } else {
    const g = ctx.createLinearGradient(0, (-h / 2) * s, 0, (h / 2) * s); g.addColorStop(0, "#52525b"); g.addColorStop(0.35, "#18181b"); g.addColorStop(1, "#09090b");
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x0, (-h / 2) * s, len * s, h * s, 2 * s); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#d4d4d8"; ctx.fillRect(x0 + (len - 6) * s, (-h / 2) * s, 3 * s, h * s);
  }
  ctx.restore();
}
/** Tok yo'nalishidagi harakatlanuvchi nuqtalar (zanjir bo'ylab) */
function flowDots(ctx, c, pts, phase, n, color) {
  let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); seg.push(d); L += d; }
  if (L <= 0) return;
  ctx.fillStyle = color || (c.dark ? "#fde68a" : "#f59e0b");
  for (let k = 0; k < n; k++) {
    let u = (((k / n + phase) % 1) + 1) % 1 * L, i = 0; while (i < seg.length - 1 && u > seg[i]) { u -= seg[i]; i++; }
    const t = seg[i] ? u / seg[i] : 0, x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
    ctx.beginPath(); ctx.arc(X(x), Y(y), Math.max(1.2, 1.7 * view.s), 0, TAU); ctx.fill();
  }
}

/* ------------------------------------------------------------------ 1a) Qizdirish */

function resetRT() { rt.T = 20; rt.t = 0; rt.hist = [{ T: 20, Rm: P.metalR(20), Rs: P.ntcR(20) }]; }
function stepRT(dt) {
  rt.t += dt; rt.T = P.bathStep(rt.T, dt, rt.heat ? rt.level : 0);
  const lastT = rt.hist.length ? rt.hist.at(-1).T : -99;
  if (Math.abs(rt.T - lastT) >= 5 || (rt.T >= 100 && lastT < 99.9)) { const T = Math.round(rt.T * 10) / 10; rt.hist.push({ T, Rm: P.metalR(T), Rs: P.ntcR(T) }); if (rt.hist.length > 60) rt.hist.shift(); }
}

function insetMetal(ctx, c, x, y, w, h, T) {
  const s = view.s, amp = 0.5 + (2.6 * (T - 20)) / 80;
  ctx.save(); rr(ctx, x, y, w, h, 6); ctx.fillStyle = c.dark ? "#0f172a" : "#f8fafc"; ctx.fill(); ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.stroke(); ctx.clip();
  for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) {
    const k = i * 3 + j, cx = x + 14 + i * 19 + amp * Math.sin(anim * 17 + k * 1.7), cy = y + 30 + j * 20 + amp * Math.cos(anim * 13 + k * 2.3);
    const g = ctx.createRadialGradient(X(cx - 2), Y(cy - 2), 1, X(cx), Y(cy), 6 * s); g.addColorStop(0, "#fed7aa"); g.addColorStop(1, "#c2410c");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(cx), Y(cy), 5.5 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = F(800, 6.5); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("+", X(cx), Y(cy));
  }
  ctx.fillStyle = c.dark ? "#93c5fd" : "#2563eb";
  for (let k = 0; k < 22; k++) {
    const ex = x + 4 + ((hash(k) * (w - 8) + anim * 6 + amp * 4 * Math.sin(anim * (3 + hash(k + 9) * 4) + k)) % (w - 8) + (w - 8)) % (w - 8);
    const ey = y + 18 + (((hash(k + 3) * (h - 24) + 7 * Math.sin(anim * (2 + hash(k + 5) * 3) + k * 2)) % (h - 24)) + (h - 24)) % (h - 24);
    ctx.beginPath(); ctx.arc(X(ex), Y(ey), 1.8 * s, 0, TAU); ctx.fill();
  }
  ctx.restore();
  label(ctx, c, "Mis: ionlar tebranishi ortadi", X(x + 4), Y(y + 9), "left", c.text);
}
function insetSemi(ctx, c, x, y, w, h, T) {
  const s = view.s, n = clamp(Math.round(1 + 6 * Math.log10(P.ntcR(20) / P.ntcR(T))), 1, 11);
  ctx.save(); rr(ctx, x, y, w, h, 6); ctx.fillStyle = c.dark ? "#0f172a" : "#f8fafc"; ctx.fill(); ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.stroke(); ctx.clip();
  const ax = (i) => x + 14 + i * 22.5, ay = (j) => y + 32 + j * 21;
  ctx.strokeStyle = c.dark ? "#475569" : "#94a3b8"; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
    if (i < 5) for (const d of [-2, 2]) { ctx.beginPath(); ctx.moveTo(X(ax(i)), Y(ay(j) + d)); ctx.lineTo(X(ax(i + 1)), Y(ay(j) + d)); ctx.stroke(); }
    if (j < 2) for (const d of [-2, 2]) { ctx.beginPath(); ctx.moveTo(X(ax(i) + d), Y(ay(j))); ctx.lineTo(X(ax(i) + d), Y(ay(j + 1))); ctx.stroke(); }
  }
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = c.dark ? "#64748b" : "#cbd5e1"; ctx.beginPath(); ctx.arc(X(ax(i)), Y(ay(j)), 5.5 * s, 0, TAU); ctx.fill(); }
  for (let k = 0; k < n; k++) {
    const slot = Math.floor(anim * 0.4 + hash(k * 7) * 5), b = Math.floor(hash(k * 13 + slot) * 25), bi = b % 5, bj = Math.floor(b / 5) % 3;
    ctx.strokeStyle = c.danger; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(X((ax(bi) + ax(bi + 1)) / 2), Y(ay(bj)), 3 * s, 0, TAU); ctx.stroke();
    const ex = x + 4 + ((hash(k + 1) * (w - 8) + anim * (14 + 6 * hash(k + 2)) * (hash(k + 4) > 0.5 ? 1 : -1)) % (w - 8) + (w - 8)) % (w - 8);
    const ey = y + 18 + (((hash(k + 3) * (h - 24) + 9 * Math.sin(anim * 3 + k)) % (h - 24)) + (h - 24)) % (h - 24);
    ctx.fillStyle = c.dark ? "#93c5fd" : "#2563eb"; ctx.beginPath(); ctx.arc(X(ex), Y(ey), 2.2 * s, 0, TAU); ctx.fill();
  }
  ctx.restore();
  label(ctx, c, "Yarimo‘tkazgich: erkin elektronlar ko‘payadi", X(x + 4), Y(y + 9), "left", c.text);
}

function hotplate(ctx, c, power) {
  const s = view.s, x = 170, y = 246, w = 180, h = 40;
  const g = ctx.createLinearGradient(0, Y(y), 0, Y(y + h)); g.addColorStop(0, c.dark ? "#e5e7eb" : "#f9fafb"); g.addColorStop(1, c.dark ? "#9ca3af" : "#d1d5db");
  ctx.fillStyle = g; rr(ctx, x, y, w, h, 6); ctx.fill(); ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#27272a"; ctx.beginPath(); ctx.ellipse(X(260), Y(y + 2), 72 * s, 5 * s, 0, 0, TAU); ctx.fill();
  if (power > 0) { ctx.fillStyle = `rgba(239,68,68,${0.25 + 0.5 * power})`; ctx.beginPath(); ctx.ellipse(X(260), Y(y + 2), 70 * s, 4 * s, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = power > 0 ? "#f97316" : "#78716c"; ctx.beginPath(); ctx.arc(X(190), Y(y + 22), 3.5 * s, 0, TAU); ctx.fill();
  if (power > 0) { ctx.fillStyle = "rgba(249,115,22,0.3)"; ctx.beginPath(); ctx.arc(X(190), Y(y + 22), 7 * s, 0, TAU); ctx.fill(); }
  ctx.fillStyle = "#374151"; ctx.font = F(700, 7.5); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("Elektr plitka 800 W", X(202), Y(y + 22));
  // dasta
  const kx = 330, ky = y + 22, f = rt.level, a = (-135 + 270 * f) * DEG - Math.PI / 2;
  ctx.fillStyle = "#6b7280"; ctx.font = F(700, 6); ctx.textAlign = "center";
  ["0", "1", "2", "3"].forEach((t, i) => { const b = (-135 + 90 * i) * DEG - Math.PI / 2; ctx.fillText(t, X(kx + Math.cos(b) * 15), Y(ky + Math.sin(b) * 14)); });
  ctx.fillStyle = "#1f2937"; ctx.beginPath(); ctx.arc(X(kx), Y(ky), 9 * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1.5, 2 * s); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(X(kx), Y(ky)); ctx.lineTo(X(kx + Math.cos(a) * 8), Y(ky + Math.sin(a) * 8)); ctx.stroke();
  hits.knob = { x: kx, y: ky, r: 16 };
}

function drawThermo(ctx, c) {
  const s = view.s, T = rt.T, power = rt.heat ? rt.level : 0, col = COL(c);
  table(ctx, c, 286);
  insetMetal(ctx, c, 112, 6, 140, 78, T);
  insetSemi(ctx, c, 268, 6, 140, 78, T);
  hotplate(ctx, c, power);
  // stakan: orqa devor, suv
  const bx = 196, by = 116, bw = 128, bb = 245, surf = 146;
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.10)" : "rgba(226,232,240,0.35)"; rr(ctx, bx, by, bw, bb - by, 6); ctx.fill();
  const gw = ctx.createLinearGradient(0, Y(surf), 0, Y(bb));
  const warm = clamp((T - 20) / 80, 0, 1);
  gw.addColorStop(0, c.dark ? `rgba(56,189,248,${0.35 + 0.1 * warm})` : `rgba(125,211,252,${0.5 + 0.1 * warm})`); gw.addColorStop(1, c.dark ? "rgba(14,116,144,0.65)" : "rgba(56,189,248,0.7)");
  ctx.fillStyle = gw; ctx.beginPath(); ctx.roundRect(X(bx + 2), Y(surf), (bw - 4) * s, (bb - surf - 2) * s, [0, 0, 5 * s, 5 * s]); ctx.fill();
  ctx.strokeStyle = c.dark ? "rgba(186,230,253,0.8)" : "rgba(2,132,199,0.7)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(bx + 2), Y(surf)); ctx.lineTo(X(bx + bw - 2), Y(surf)); ctx.stroke();
  // konveksiya va pufakchalar
  if (power > 0.05 && T < 99.5) {
    ctx.save(); ctx.strokeStyle = c.dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.6)"; ctx.lineWidth = 1;
    for (const dx of [-40, 46]) { ctx.beginPath(); for (let y = 236; y >= surf + 6; y -= 3) { const x = 260 + dx + Math.sin(y * 0.22 + anim * 4 + dx) * 2; y === 236 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)); } ctx.stroke(); }
    ctx.restore();
  }
  if (T > 80) {
    const nb = Math.round(((T - 80) / 20) * 18);
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1;
    for (let k = 0; k < nb; k++) { const ph = (anim * (0.5 + (k % 4) * 0.15) + k * 0.37) % 1, x = bx + 8 + ((k * 29) % (bw - 16)), y = bb - 6 - ph * (bb - surf - 10); ctx.beginPath(); ctx.arc(X(x), Y(y), (1 + (k % 3) * 0.7) * s, 0, TAU); ctx.stroke(); }
  }
  // mis g'altak (plastik karkasda)
  ctx.fillStyle = c.dark ? "#e5e7eb" : "#f8fafc"; ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1;
  rr(ctx, 210, 196, 36, 4, 1); ctx.fill(); ctx.stroke(); rr(ctx, 210, 232, 36, 4, 1); ctx.fill(); ctx.stroke();
  const gc = ctx.createLinearGradient(X(214), 0, X(242), 0); gc.addColorStop(0, "#7c2d12"); gc.addColorStop(0.45, "#f59e0b"); gc.addColorStop(1, "#9a3412");
  ctx.fillStyle = gc; ctx.fillRect(X(214), Y(200), 28 * s, 32 * s);
  ctx.strokeStyle = "rgba(124,45,18,0.55)"; ctx.lineWidth = 0.7; for (let yy = 202; yy < 232; yy += 2.2) { ctx.beginPath(); ctx.moveTo(X(214), Y(yy)); ctx.lineTo(X(242), Y(yy + 0.6)); ctx.stroke(); }
  ctx.strokeStyle = "#b45309"; ctx.lineWidth = Math.max(1, 1.2 * s);
  ctx.beginPath(); ctx.moveTo(X(220), Y(196)); ctx.lineTo(X(220), Y(102)); ctx.moveTo(X(236), Y(196)); ctx.lineTo(X(236), Y(102)); ctx.stroke();
  // termorezistor shisha tayoqchaga yopishtirilgan
  ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.5)" : "rgba(148,163,184,0.8)"; ctx.lineWidth = 3.4 * s; ctx.beginPath(); ctx.moveTo(X(268), Y(96)); ctx.lineTo(X(268), Y(226)); ctx.stroke();
  ctx.strokeStyle = "#a1a1aa"; ctx.lineWidth = Math.max(0.8, 1 * s);
  ctx.beginPath(); ctx.moveTo(X(266), Y(230)); ctx.lineTo(X(266), Y(102)); ctx.lineTo(X(262), Y(98)); ctx.moveTo(X(270), Y(230)); ctx.lineTo(X(270), Y(102)); ctx.lineTo(X(274), Y(98)); ctx.stroke();
  const gb = ctx.createRadialGradient(X(267), Y(232), 0.5, X(268), Y(233), 5 * s); gb.addColorStop(0, "#60a5fa"); gb.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = gb; ctx.beginPath(); ctx.ellipse(X(268), Y(234), 4.2 * s, 5 * s, 0, 0, TAU); ctx.fill();
  // termometr
  const ty = (v) => 226 - v * 1.2;
  ctx.fillStyle = c.dark ? "rgba(226,232,240,0.25)" : "rgba(255,255,255,0.85)"; ctx.strokeStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.lineWidth = 1;
  rr(ctx, 297, 88, 6, 150, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(X(300), Y(238), 4.5 * s, 0, TAU); ctx.fill();
  ctx.fillRect(X(298.9), Y(ty(T)), 2.2 * s, (238 - ty(T)) * s);
  ctx.strokeStyle = c.dark ? "#e2e8f0" : "#1c1917"; ctx.fillStyle = ctx.strokeStyle; ctx.font = F(600, 7); ctx.textAlign = "left"; ctx.textBaseline = "middle";
  for (let v = 0; v <= 100; v += 10) { const yy = Y(ty(v)); ctx.beginPath(); ctx.moveTo(X(303), yy); ctx.lineTo(X(303 + (v % 50 ? 2.5 : 4.5)), yy); ctx.stroke(); if (v % 50 === 0) ctx.fillText(String(v), X(309), yy); }
  // stakan old devori (shisha, shkala)
  ctx.strokeStyle = c.dark ? "rgba(203,213,225,0.75)" : "rgba(100,116,139,0.85)"; ctx.lineWidth = Math.max(1.2, 1.6 * s);
  ctx.beginPath(); ctx.moveTo(X(bx - 3), Y(by - 2)); ctx.lineTo(X(bx), Y(by + 2)); ctx.lineTo(X(bx), Y(bb - 6)); ctx.quadraticCurveTo(X(bx), Y(bb), X(bx + 6), Y(bb)); ctx.lineTo(X(bx + bw - 6), Y(bb)); ctx.quadraticCurveTo(X(bx + bw), Y(bb), X(bx + bw), Y(bb - 6)); ctx.lineTo(X(bx + bw), Y(by + 2)); ctx.lineTo(X(bx + bw + 3), Y(by - 2)); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(X(bx + 8), Y(by + 12)); ctx.lineTo(X(bx + 8), Y(bb - 14)); ctx.stroke();
  ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.6)" : "rgba(71,85,105,0.7)"; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1; ctx.font = F(600, 6); ctx.textAlign = "right";
  [150, 175, 200, 225].forEach((yy) => { ctx.beginPath(); ctx.moveTo(X(bx + bw - 9), Y(yy)); ctx.lineTo(X(bx + bw - 3), Y(yy)); ctx.stroke(); });
  ctx.textAlign = "left"; ctx.fillText("600 ml", X(bx + 12), Y(by + 10));
  // bug'
  if (T >= 99.5) {
    ctx.save(); ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.35)" : "rgba(100,116,139,0.35)"; ctx.lineWidth = 2;
    for (const dx of [-46, -10, 40]) { ctx.beginPath(); for (let yy = by - 2; yy > 92; yy -= 3) { const xx = 260 + dx + Math.sin(yy * 0.18 - anim * 5 + dx) * 3; yy === by - 2 ? ctx.moveTo(X(xx), Y(yy)) : ctx.lineTo(X(xx), Y(yy)); } ctx.stroke(); }
    ctx.restore();
  }
  // multimetrlar
  const rm = fmt(P.metalR(T), 2), um = "Ω", [rs, us] = fR(P.ntcR(T));
  const m1 = multimeter(ctx, c, X(10), Y(26), 86 * s, { text: rm, unit: um, mode: "Ω" });
  const m2 = multimeter(ctx, c, X(424), Y(26), 86 * s, { text: rs, unit: us, mode: "Ω" });
  const a1 = wd(m1.red), b1 = wd(m1.com), a2 = wd(m2.red), b2 = wd(m2.com);
  cable(ctx, [a1, [a1[0] + 4, 196], [150, 194], [176, 112], [206, 90], [220, 100]], col.red);
  cable(ctx, [b1, [b1[0] + 2, 206], [140, 214], [170, 120], [222, 80], [236, 100]], "#1f2937");
  cable(ctx, [a2, [a2[0] - 2, 196], [400, 204], [352, 118], [300, 80], [274, 96]], col.red);
  cable(ctx, [b2, [b2[0] - 2, 188], [384, 190], [340, 108], [286, 74], [262, 96]], "#1f2937");
  [m1.red, m2.red].forEach((p) => plug(ctx, p[0], p[1], 3.4 * s, "#dc2626")); [m1.com, m2.com].forEach((p) => plug(ctx, p[0], p[1], 3.4 * s, "#18181b"));
  clip(ctx, 220, 104, "#dc2626"); clip(ctx, 236, 104, "#18181b"); clip(ctx, 274, 100, "#dc2626"); clip(ctx, 262, 100, "#18181b");
  label(ctx, c, "mis g‘altak", X(53), Y(178), "center", c.primary);
  label(ctx, c, "termorezistor", X(467), Y(178), "center", c.warning);
  label(ctx, c, `${fmt(T, 1)} °C`, X(300), Y(80), "center", c.text);
}

/* ------------------------------------------------------------------ 1b) Yoritish */

const PX_CM = 4.4, LDR_X = 430, AXIS_Y = 168;
const lampX = () => LDR_X - rt.d * PX_CM;
const photoE = () => rt.room + (rt.lampOn ? P.illum(80, rt.d / 100) : 0);

function drawPhotoStage(ctx, c) {
  const s = view.s, col = COL(c), lx = lampX(), E = photoE(), dark = rt.room < 10;
  table(ctx, c, 278);
  if (dark) { ctx.fillStyle = `rgba(2,6,23,${rt.room < 1 ? 0.55 : 0.32})`; ctx.fillRect(X(0), Y(0), WORLD[0] * s, WORLD[1] * s); }
  // yorug'lik dastasi
  if (rt.lampOn) {
    const g = ctx.createLinearGradient(X(lx), 0, X(LDR_X), 0);
    g.addColorStop(0, "rgba(253,224,71,0.45)"); g.addColorStop(1, "rgba(253,224,71,0.08)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X(lx + 8), Y(AXIS_Y - 20)); ctx.lineTo(X(LDR_X + 30), Y(AXIS_Y - 20 - (LDR_X - lx) * 0.22)); ctx.lineTo(X(LDR_X + 30), Y(AXIS_Y + 20 + (LDR_X - lx) * 0.22)); ctx.lineTo(X(lx + 8), Y(AXIS_Y + 20)); ctx.closePath(); ctx.fill();
  }
  // optik skamya (chizg'ichli)
  const gr = ctx.createLinearGradient(0, Y(252), 0, Y(264)); gr.addColorStop(0, "#e5e7eb"); gr.addColorStop(1, "#9ca3af");
  ctx.fillStyle = gr; rr(ctx, 26, 252, 432, 12, 2); ctx.fill(); ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = "#374151"; ctx.fillStyle = "#374151"; ctx.font = F(600, 6); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let d = 0; d <= 90; d += 5) { const x = LDR_X - d * PX_CM; if (x < 28) break; ctx.beginPath(); ctx.moveTo(X(x), Y(252)); ctx.lineTo(X(x), Y(d % 10 ? 255 : 257)); ctx.stroke(); if (d % 10 === 0) ctx.fillText(String(d), X(x), Y(260)); }
  ctx.fillText("cm", X(448), Y(260));
  // lampa aravachasi
  ctx.fillStyle = "#475569"; rr(ctx, lx - 14, 242, 28, 10, 2); ctx.fill();
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(X(lx - 2), Y(AXIS_Y + 14), 4 * s, (242 - AXIS_Y - 14) * s);
  ctx.strokeStyle = c.dark ? "#a1a1aa" : "#27272a"; ctx.lineWidth = 2.4 * s; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(X(lx - 16), Y(AXIS_Y)); ctx.bezierCurveTo(X(lx - 40), Y(AXIS_Y + 10), X(lx - 30), Y(272), X(lx - 60), Y(276)); ctx.stroke();
  if (rt.lampOn) { const hg = ctx.createRadialGradient(X(lx + 6), Y(AXIS_Y), 2, X(lx + 6), Y(AXIS_Y), 40 * s); hg.addColorStop(0, "rgba(254,240,138,0.9)"); hg.addColorStop(1, "rgba(254,240,138,0)"); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(X(lx + 6), Y(AXIS_Y), 40 * s, 0, TAU); ctx.fill(); }
  const rg = ctx.createLinearGradient(0, Y(AXIS_Y - 22), 0, Y(AXIS_Y + 22)); rg.addColorStop(0, "#cbd5e1"); rg.addColorStop(0.5, "#64748b"); rg.addColorStop(1, "#1e293b");
  ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(X(lx - 18), Y(AXIS_Y - 9)); ctx.lineTo(X(lx + 8), Y(AXIS_Y - 22)); ctx.lineTo(X(lx + 8), Y(AXIS_Y + 22)); ctx.lineTo(X(lx - 18), Y(AXIS_Y + 9)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rt.lampOn ? "#fef9c3" : c.dark ? "#475569" : "#e2e8f0"; ctx.beginPath(); ctx.ellipse(X(lx + 8), Y(AXIS_Y), 4 * s, 21 * s, 0, 0, TAU); ctx.fill();
  hits.lamp = { x: lx, y: AXIS_Y, r: 28 };
  // fotorezistor tayanchda
  ctx.fillStyle = "#475569"; rr(ctx, LDR_X - 12, 242, 24, 10, 2); ctx.fill();
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(X(LDR_X - 2), Y(AXIS_Y + 16), 4 * s, (242 - AXIS_Y - 16) * s);
  ctx.fillStyle = "#1f2937"; rr(ctx, LDR_X - 7, AXIS_Y + 10, 14, 7, 1.5); ctx.fill();
  ctx.strokeStyle = "#a1a1aa"; ctx.lineWidth = Math.max(0.8, 1 * s); ctx.beginPath(); ctx.moveTo(X(LDR_X - 3), Y(AXIS_Y + 4)); ctx.lineTo(X(LDR_X - 3), Y(AXIS_Y + 11)); ctx.moveTo(X(LDR_X + 3), Y(AXIS_Y + 4)); ctx.lineTo(X(LDR_X + 3), Y(AXIS_Y + 11)); ctx.stroke();
  ctx.fillStyle = "#f5f5f4"; ctx.beginPath(); ctx.arc(X(LDR_X), Y(AXIS_Y - 4), 9 * s, 0, TAU); ctx.fill(); ctx.strokeStyle = "#a8a29e"; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = "#c2410c"; ctx.lineWidth = Math.max(0.8, 1.1 * s); ctx.beginPath();
  for (let k = 0; k <= 8; k++) { const yy = AXIS_Y - 10 + k * 1.5, x0 = LDR_X - Math.sqrt(Math.max(0, 49 - (yy - AXIS_Y + 4) ** 2)), x1 = 2 * LDR_X - x0; k % 2 ? (ctx.lineTo(X(x1), Y(yy)), ctx.lineTo(X(x1), Y(yy + 1.5))) : (ctx.lineTo(X(x0), Y(yy)), ctx.lineTo(X(x0), Y(yy + 1.5))); }
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(X(LDR_X - 3), Y(AXIS_Y - 8), 3 * s, 0, TAU); ctx.fill();
  // luksmetr datchigi va asbobi
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(X(463), Y(204), 3 * s, 38 * s); ctx.fillStyle = "#475569"; rr(ctx, 454, 242, 22, 10, 2); ctx.fill();
  ctx.fillStyle = "#f8fafc"; rr(ctx, 456, 192, 18, 14, 3); ctx.fill(); ctx.strokeStyle = "#64748b"; ctx.stroke();
  ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.ellipse(X(465), Y(195), 7 * s, 2.4 * s, 0, 0, TAU); ctx.fill();
  cable(ctx, [[474, 200], [494, 206], [500, 216]], "#334155", 1.6);
  ctx.fillStyle = c.dark ? "#334155" : "#475569"; rr(ctx, 478, 214, 38, 34, 4); ctx.fill();
  ctx.fillStyle = "#b5c4a1"; rr(ctx, 481, 218, 32, 14, 2); ctx.fill();
  ctx.fillStyle = "#1a2e05"; ctx.font = `700 ${Math.max(6, 8.5 * s)}px "SFMono-Regular", Menlo, Consolas, ui-monospace, monospace`; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillText(fmt(E, E < 10 ? 1 : 0), X(511), Y(225.5));
  ctx.fillStyle = "#e2e8f0"; ctx.font = F(700, 6); ctx.textAlign = "center"; ctx.fillText("Luksmetr, lk", X(497), Y(240));
  // multimetr
  const [rv, ru] = fR(P.ldrR(E)), mm = multimeter(ctx, c, X(436), Y(6), 76 * s, { text: rv, unit: ru, mode: "Ω" });
  const a = wd(mm.red), b = wd(mm.com);
  cable(ctx, [a, [a[0], 150], [452, 164], [434, AXIS_Y + 14]], col.red, 1.8);
  cable(ctx, [b, [b[0], 152], [420, 168], [426, AXIS_Y + 14]], "#1f2937", 1.8);
  plug(ctx, mm.red[0], mm.red[1], 3 * s, "#dc2626"); plug(ctx, mm.com[0], mm.com[1], 3 * s, "#18181b");
  label(ctx, c, `r = ${fmt(rt.d, 0)} cm`, X((lx + LDR_X) / 2), Y(236), "center", c.text);
  label(ctx, c, "fotorezistor", X(LDR_X), Y(AXIS_Y - 26), "center", c.warning);
  label(ctx, c, rt.lampOn ? "lampa 60 W" : "lampa o‘chiq", X(lx), Y(AXIS_Y - 34), "center", c.text2);
}

/* ------------------------------------------------------------------ 2) Panjara */

const LC = 9, LR = 5, LX0 = 78, LDX = 45.5, LY0 = 74, LDY = 40;
const atomXY = (i) => [LX0 + (i % LC) * LDX, LY0 + Math.floor(i / LC) * LDY];
const BONDS = [];
for (let i = 0; i < LC * LR; i++) { const c0 = i % LC, r0 = Math.floor(i / LC); if (c0 < LC - 1) BONDS.push({ a: i, b: i + 1, h: true }); if (r0 < LR - 1) BONDS.push({ a: i, b: i + LC, h: false }); }
BONDS.forEach((b) => { const [x1, y1] = atomXY(b.a), [x2, y2] = atomXY(b.b); b.x = (x1 + x2) / 2; b.y = (y1 + y2) / 2; });
const NEIGH = BONDS.map((b, k) => BONDS.map((q, j) => (j !== k && (q.a === b.a || q.a === b.b || q.b === b.a || q.b === b.b) ? j : -1)).filter((j) => j >= 0));
const slotXY = (bi, sl) => { const b = BONDS[bi], d = sl ? 3.4 : -3.4; return b.h ? [b.x, b.y + d] : [b.x + d, b.y]; };
const LXMIN = 46, LXMAX = 474, LYMIN = 52, LYMAX = 256;

const latMat = () => P.MATS[lat.mat];
const latN = () => 10 ** lat.logN;
const latCond = () => P.conductivity(latMat(), lat.T, lat.dope === "n" ? latN() : 0, lat.dope === "p" ? latN() : 0);
const nDon = () => lat.atoms.filter((a) => a === "d").length, nAcc = () => lat.atoms.filter((a) => a === "a").length;
const vis = (x) => clamp(Math.round(2.5 * Math.log10(x / 1e15)), 0, 12);
const minority = () => { const k = latCond(); return vis(lat.dope === "n" ? k.p : lat.dope === "p" ? k.n : k.ni); };
const latI = () => (lat.field ? latCond().sigma * (4.5 / 0.01) * 1e-6 : 0);

function freeBondNear(i) { const opts = BONDS.map((b, k) => ((b.a === i || b.b === i) && !lat.h.some((h) => h.b === k) ? k : -1)).filter((k) => k >= 0); return opts.length ? opts[Math.floor(Math.random() * opts.length)] : -1; }
function addElectron(x, y) { const a = Math.random() * TAU, v = 30 * Math.sqrt(lat.T / 300); lat.e.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: Math.random() * 0.3, tgt: -1 }); }
function addHole(bi) { const sl = Math.random() < 0.5 ? 0 : 1, [x, y] = slotXY(bi, sl); lat.h.push({ b: bi, sl, x, y, fx: x, fy: y, k: 1, t: Math.random() * 0.5, busy: false }); }
function resetLattice(dopants = []) {
  lat.atoms = Array(LC * LR).fill("s"); lat.e = []; lat.h = []; lat.fx = [];
  dopants.forEach((i) => { lat.atoms[i] = lat.dope === "n" ? "d" : "a"; });
  if (lat.dope === "n") dopants.forEach((i) => { const [x, y] = atomXY(i); addElectron(x + 14, y - 10); });
  if (lat.dope === "p") dopants.forEach((i) => { const b = freeBondNear(i); if (b >= 0) addHole(b); });
  const m = minority();
  for (let k = 0; k < m; k++) generate(false);
}
function generate(flash = true) {
  const free = BONDS.map((_, k) => k).filter((k) => !lat.h.some((h) => h.b === k) && lat.atoms[BONDS[k].a] === "s" && lat.atoms[BONDS[k].b] === "s");
  if (!free.length) return;
  const bi = free[Math.floor(Math.random() * free.length)]; addHole(bi);
  const hh = lat.h.at(-1); addElectron(hh.x, hh.y);
  if (flash) lat.fx.push({ x: hh.x, y: hh.y, t: 0, kind: "gen" });
}
function toggleAtom(i) {
  if (lat.dope === "i") { flashStatus("Avval n- yoki p-tipni tanlang — so‘ng atomni bosing"); return; }
  const want = lat.dope === "n" ? "d" : "a", [x, y] = atomXY(i);
  if (lat.atoms[i] === want) {
    lat.atoms[i] = "s";
    const pool = lat.dope === "n" ? lat.e : lat.h; if (pool.length) { let best = 0, bd = 1e9; pool.forEach((p, k) => { const d = dist(p.x, p.y, x, y); if (d < bd) { bd = d; best = k; } }); pool.splice(best, 1); }
  } else {
    lat.atoms[i] = want;
    if (want === "d") addElectron(x + 14, y - 10); else { const b = freeBondNear(i); if (b >= 0) addHole(b); }
  }
  customized(); refresh();
}
function stepLat(dt) {
  const m = latMat(), mu = P.mobility(m, lat.T), vth = 34 * Math.sqrt(lat.T / 300), vdE = lat.field ? -26 * (mu.n / 0.135) : 0, hopRate = 1.2 + (lat.field ? 3 * Math.min(3, mu.p / 0.048) : 0);
  // erkin elektronlar
  for (const e of lat.e) {
    if (e.tgt >= 0) {
      const h = lat.h[e.tgt]; if (!h) { e.tgt = -1; continue; }
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy); if (d < 3) { e.dead = true; h.dead = true; lat.fx.push({ x: h.x, y: h.y, t: 0, kind: "rec" }); continue; }
      const v = Math.min(d / dt, 60); e.x += (dx / d) * v * dt; e.y += (dy / d) * v * dt; continue;
    }
    e.t -= dt; if (e.t <= 0) { const a = Math.random() * TAU; e.vx = Math.cos(a) * vth; e.vy = Math.sin(a) * vth; e.t = 0.18 + Math.random() * 0.3; }
    e.x += (e.vx + vdE) * dt; e.y += e.vy * dt;
    if (e.y < LYMIN) { e.y = LYMIN; e.vy = Math.abs(e.vy); } if (e.y > LYMAX) { e.y = LYMAX; e.vy = -Math.abs(e.vy); }
    if (lat.field) { if (e.x < LXMIN) { e.x = LXMAX - 2; e.y = LYMIN + Math.random() * (LYMAX - LYMIN); lat.flow++; } if (e.x > LXMAX) e.x = LXMAX; }
    else { if (e.x < LXMIN) { e.x = LXMIN; e.vx = Math.abs(e.vx); } if (e.x > LXMAX) { e.x = LXMAX; e.vx = -Math.abs(e.vx); } }
  }
  // kovaklar (bog'dan bog'ga sakraydi)
  for (const h of lat.h) {
    if (h.k < 1) { h.k = Math.min(1, h.k + dt / 0.22); const [tx, ty] = slotXY(h.b, h.sl); h.x = h.fx + (tx - h.fx) * h.k; h.y = h.fy + (ty - h.fy) * h.k; continue; }
    if (lat.e.some((e) => e.tgt >= 0 && lat.h[e.tgt] === h)) continue;
    h.t -= dt; if (h.t > 0) continue; h.t = (0.5 + Math.random()) / hopRate;
    const cur = BONDS[h.b];
    if (lat.field && cur.x > LXMAX - 40 && Math.random() < 0.5) { h.dead = true; const left = BONDS.map((b, k) => (b.x < LX0 + 20 && !lat.h.some((q) => q.b === k) ? k : -1)).filter((k) => k >= 0 && lat.atoms[BONDS[k].a] === "s"); if (left.length) addHole(left[Math.floor(Math.random() * left.length)]); continue; }
    const opts = NEIGH[h.b].filter((k) => !lat.h.some((q) => q.b === k)); if (!opts.length) continue;
    const w = opts.map((k) => Math.exp((lat.field ? 0.07 : 0) * (BONDS[k].x - cur.x))), tot = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot, pick = opts[0]; for (let j = 0; j < opts.length; j++) { r -= w[j]; if (r <= 0) { pick = opts[j]; break; } }
    h.fx = h.x; h.fy = h.y; h.b = pick; h.sl = Math.random() < 0.5 ? 0 : 1; h.k = 0;
  }
  // rekombinatsiya / generatsiya
  const keep = lat.h.map((h) => !h.dead);
  lat.e.forEach((e) => { if (e.tgt >= 0 && !keep[e.tgt]) e.tgt = -1; });
  const idx = []; let j = 0; lat.h.forEach((h, k) => { idx[k] = h.dead ? -1 : j; if (!h.dead) j++; });
  lat.e = lat.e.filter((e) => !e.dead); lat.e.forEach((e) => { if (e.tgt >= 0) e.tgt = idx[e.tgt]; });
  lat.h = lat.h.filter((h) => !h.dead);
  lat.acc += dt;
  if (lat.acc > 0.35) {
    lat.acc = 0;
    const want = minority(), pairs = lat.dope === "n" ? lat.e.length - nDon() : lat.dope === "p" ? lat.h.length - nAcc() : Math.min(lat.e.length, lat.h.length);
    if (pairs < want && Math.random() < 0.8) generate();
    else if (pairs > want && lat.e.length && lat.h.length) {
      const freeE = lat.e.filter((e) => e.tgt < 0); const e = freeE[Math.floor(Math.random() * freeE.length)];
      if (e) { let best = -1, bd = 1e9; lat.h.forEach((h, k) => { if (lat.e.some((q) => q.tgt === k)) return; const d = dist(h.x, h.y, e.x, e.y); if (d < bd) { bd = d; best = k; } }); if (best >= 0) e.tgt = best; }
    }
  }
  lat.fx.forEach((f) => { f.t += dt; }); lat.fx = lat.fx.filter((f) => f.t < 0.7);
}

function battery45(ctx, c, x, y) {
  const s = view.s;
  const g = ctx.createLinearGradient(0, Y(y), 0, Y(y + 26)); g.addColorStop(0, "#dc2626"); g.addColorStop(1, "#7f1d1d");
  ctx.fillStyle = g; rr(ctx, x, y, 92, 26, 3); ctx.fill();
  ctx.fillStyle = "#1e3a8a"; ctx.fillRect(X(x), Y(y + 17), 92 * s, 9 * s);
  ctx.fillStyle = "#fde68a"; ctx.font = F(800, 8); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("4,5 V", X(x + 46), Y(y + 9));
  ctx.fillStyle = "#fff"; ctx.font = F(600, 5.5); ctx.fillText("3336 · batareya", X(x + 46), Y(y + 21.5));
  ctx.fillStyle = "#d4a017"; ctx.fillRect(X(x + 14), Y(y - 6), 6 * s, 7 * s); ctx.fillRect(X(x + 70), Y(y - 8), 10 * s, 9 * s);
  ctx.fillStyle = "#fff"; ctx.font = F(900, 7); ctx.fillText("+", X(x + 8), Y(y + 6)); ctx.fillText("−", X(x + 86), Y(y + 6));
  return { plus: [x + 17, y - 6], minus: [x + 75, y - 8] };
}
function drawLattice(ctx, c) {
  const s = view.s, m = latMat(), col = COL(c), field = lat.field, I = latI();
  ctx.fillStyle = c.dark ? "rgba(30,41,59,0.55)" : "rgba(241,245,249,0.9)"; rr(ctx, 42, 46, 436, 216, 6); ctx.fill();
  // kontaktlar
  const metal = (x0) => { const g = ctx.createLinearGradient(X(x0), 0, X(x0 + 12), 0); g.addColorStop(0, "#64748b"); g.addColorStop(0.5, "#e2e8f0"); g.addColorStop(1, "#475569"); return g; };
  ctx.fillStyle = metal(30); ctx.fillRect(X(30), Y(46), 12 * s, 216 * s); ctx.fillStyle = metal(478); ctx.fillRect(X(478), Y(46), 12 * s, 216 * s);
  // batareya, kalit va ampermetr
  const bt = battery45(ctx, c, 214, 10);
  const on = field;
  wire(ctx, c, S([bt.plus, [bt.plus[0], 6], [36, 6], [36, 46]]), { color: col.red, on });
  wire(ctx, c, S([bt.minus, [bt.minus[0], 4], [330, 4], [330, 14]]), { color: col.black, on });
  wire(ctx, c, S([[372, 14], [372, 4], [484, 4], [484, 46]]), { color: col.black, on });
  // tugmali kalit
  ctx.fillStyle = c.dark ? "#334155" : "#e5e7eb"; rr(ctx, 322, 12, 58, 22, 4); ctx.fill(); ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.stroke();
  terminal(ctx, X(330), Y(16), 3 * s, "#a1a1aa"); terminal(ctx, X(372), Y(16), 3 * s, "#a1a1aa");
  ctx.fillStyle = on ? "#16a34a" : "#dc2626"; ctx.beginPath(); ctx.arc(X(351), Y(23), 7 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = F(800, 6); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(on ? "ON" : "OFF", X(351), Y(23));
  hits.btn = { x: 322, y: 10, w: 58, h: 26 };
  const [iv, iu] = fI(I);
  ctx.fillStyle = c.dark ? "#334155" : "#475569"; rr(ctx, 396, 10, 76, 26, 4); ctx.fill();
  ctx.fillStyle = "#b5c4a1"; rr(ctx, 399, 13, 70, 20, 2); ctx.fill();
  ctx.fillStyle = "#1a2e05"; ctx.font = `700 ${Math.max(6, 10 * s)}px "SFMono-Regular", Menlo, Consolas, ui-monospace, monospace`; ctx.textAlign = "right"; ctx.fillText(on ? iv : "0", X(452), Y(23.5));
  ctx.font = F(800, 7); ctx.textAlign = "left"; ctx.fillText(on ? iu : "nA", X(454), Y(23.5));
  // kovalent bog'lar va elektron juftlari
  const holeAt = new Set(lat.h.filter((h) => h.k >= 1).map((h) => `${h.b}:${h.sl}`));
  ctx.strokeStyle = c.dark ? "#64748b" : "#94a3b8"; ctx.lineWidth = Math.max(0.8, 1 * s);
  BONDS.forEach((b) => {
    const [x1, y1] = atomXY(b.a), [x2, y2] = atomXY(b.b);
    for (const d of [-2.2, 2.2]) { ctx.beginPath(); if (b.h) { ctx.moveTo(X(x1), Y(y1 + d)); ctx.lineTo(X(x2), Y(y2 + d)); } else { ctx.moveTo(X(x1 + d), Y(y1)); ctx.lineTo(X(x2 + d), Y(y2)); } ctx.stroke(); }
  });
  for (let i = 0; i < LC * LR; i++) { const [x, y] = atomXY(i), c0 = i % LC, r0 = Math.floor(i / LC); const stubs = []; if (r0 === 0) stubs.push([0, -1]); if (r0 === LR - 1) stubs.push([0, 1]); stubs.forEach(([dx, dy]) => { for (const d of [-2.2, 2.2]) { ctx.beginPath(); ctx.moveTo(X(x + d), Y(y)); ctx.lineTo(X(x + d + dx * 16), Y(y + dy * 16)); ctx.stroke(); } }); if (c0 === 0 || c0 === LC - 1) { const dx = c0 === 0 ? -1 : 1; for (const d of [-2.2, 2.2]) { ctx.beginPath(); ctx.moveTo(X(x), Y(y + d)); ctx.lineTo(X(x + dx * 22), Y(y + d)); ctx.stroke(); } } }
  ctx.fillStyle = c.dark ? "#93c5fd" : "#1d4ed8";
  BONDS.forEach((b, k) => { const ac = lat.atoms[b.a] === "a" || lat.atoms[b.b] === "a"; for (const sl of [0, 1]) { if (holeAt.has(`${k}:${sl}`)) continue; const [x, y] = slotXY(k, sl); ctx.globalAlpha = ac ? 0.9 : 0.75; ctx.beginPath(); ctx.arc(X(x), Y(y), 1.7 * s, 0, TAU); ctx.fill(); } });
  ctx.globalAlpha = 1;
  // atomlar
  for (let i = 0; i < LC * LR; i++) {
    const [x, y] = atomXY(i), t = lat.atoms[i], R = 12.5;
    const base = t === "d" ? ["#fdba74", "#c2410c"] : t === "a" ? ["#86efac", "#15803d"] : c.dark ? ["#94a3b8", "#334155"] : ["#e2e8f0", "#64748b"];
    const g = ctx.createRadialGradient(X(x - 4), Y(y - 4), 1, X(x), Y(y), R * s); g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(x), Y(y), R * s, 0, TAU); ctx.fill();
    ctx.fillStyle = t === "s" ? (c.dark ? "#f1f5f9" : "#0f172a") : "#fff"; ctx.font = F(800, 8.5); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(t === "d" ? "P" : t === "a" ? "B" : m.sym, X(x), Y(y + 0.5));
    if (t !== "s") { const bx = x + 9, by = y - 9; ctx.fillStyle = t === "d" ? "#dc2626" : "#1d4ed8"; ctx.beginPath(); ctx.arc(X(bx), Y(by), 4.4 * s, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = F(900, 7); ctx.fillText(t === "d" ? "+" : "−", X(bx), Y(by)); }
  }
  // chaqnashlar (generatsiya — sariq, rekombinatsiya — yashil)
  lat.fx.forEach((f) => { ctx.strokeStyle = f.kind === "gen" ? `rgba(250,204,21,${1 - f.t / 0.7})` : `rgba(74,222,128,${1 - f.t / 0.7})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), (4 + f.t * 22) * s, 0, TAU); ctx.stroke(); });
  // kovaklar
  lat.h.forEach((h) => { ctx.fillStyle = c.dark ? "#0f172a" : "#fff"; ctx.strokeStyle = c.danger; ctx.lineWidth = Math.max(1.2, 1.6 * s); ctx.beginPath(); ctx.arc(X(h.x), Y(h.y), 3.6 * s, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.danger; ctx.font = F(900, 5.5); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("+", X(h.x), Y(h.y + 0.3)); });
  // erkin elektronlar
  lat.e.forEach((e) => { const g = ctx.createRadialGradient(X(e.x - 1), Y(e.y - 1), 0.5, X(e.x), Y(e.y), 4 * s); g.addColorStop(0, "#bfdbfe"); g.addColorStop(1, "#1d4ed8"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), 3.4 * s, 0, TAU); ctx.fill(); });
  // maydon yo'nalishi va yorliqlar
  if (field) {
    ctx.strokeStyle = c.dark ? "rgba(250,204,21,0.7)" : "rgba(161,98,7,0.7)"; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(200), Y(270)); ctx.lineTo(X(320), Y(270)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(324), Y(270)); ctx.lineTo(X(316), Y(266)); ctx.lineTo(X(316), Y(274)); ctx.closePath(); ctx.fill();
    label(ctx, c, "E", X(328), Y(270), "left", c.warning);
    label(ctx, c, "← elektronlar", X(150), Y(270), "center", c.primary); label(ctx, c, "kovaklar →", X(390), Y(270), "center", c.danger);
  }
  label(ctx, c, "+", X(36), Y(270), "center", c.danger); label(ctx, c, "−", X(484), Y(270), "center", c.text);
  label(ctx, c, `T = ${fmt(lat.T, 0)} K (${fmt(lat.T - P.T0, 0)} °C)`, X(46), Y(23), "left", c.text);
  label(ctx, c, `${lat.dope === "i" ? `sof ${m.sym}` : lat.dope === "n" ? `n-tip: ${m.sym} + P` : `p-tip: ${m.sym} + B`}`, X(46), Y(285), "left", lat.dope === "n" ? c.primary : lat.dope === "p" ? c.danger : c.text2);
  label(ctx, c, `erkin elektronlar ${lat.e.length} · kovaklar ${lat.h.length}`, X(474), Y(285), "right", c.text2);
}

/* ------------------------------------------------------------------ 3a) Diod VAX */

const dObj = () => P.DIODES[dio.type];
const dTK = () => dio.T + P.T0;
const dEmax = () => (dio.pol < 0 ? 30 : 5);
const dCirc = () => P.diodeCircuit(dObj(), dio.pol * dio.E, R_LIM, dTK());
const RANGES_MA = [1, 2, 5, 10, 20, 50, 100], RANGES_UA = [1, 2, 5, 10, 20, 50, 100];
const pickR = (list, v) => list.find((r) => r >= v * 1.04) || list.at(-1);
const mOpt = (r) => { const m = Math.round(r / 10 ** Math.floor(Math.log10(r) + 1e-9)), two = m === 2; return { max: r, ticks: two ? 4 : 5, digits: r < 5 && m !== 2 ? 1 : 0 }; };

function pnInset(ctx, c, x, y, w, h, d, Uj, I) {
  const s = view.s, jx = x + w / 2, wz = clamp(44 * P.depletion(d, Uj), 6, 170), z0 = jx - wz / 2, z1 = jx + wz / 2;
  ctx.save(); rr(ctx, x, y, w, h, 6); ctx.clip();
  ctx.fillStyle = c.dark ? "rgba(248,113,113,0.16)" : "rgba(254,202,202,0.6)"; ctx.fillRect(X(x), Y(y), (jx - x) * s, h * s);
  ctx.fillStyle = c.dark ? "rgba(96,165,250,0.16)" : "rgba(191,219,254,0.7)"; ctx.fillRect(X(jx), Y(y), (x + w - jx) * s, h * s);
  ctx.fillStyle = c.dark ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.75)"; ctx.fillRect(X(z0), Y(y), wz * s, h * s);
  // ionlar (qo'zg'almas)
  ctx.font = F(800, 6); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let gx = jx - 5.5 - 11 * Math.floor((wz / 2 - 5.5) / 11); gx < z1; gx += 11) for (let gy = y + 18; gy < y + h - 4; gy += 13) {
    if (gx < z0 || gx > z1) continue; const p = gx < jx; ctx.fillStyle = p ? (c.dark ? "rgba(147,197,253,0.6)" : "rgba(29,78,216,0.5)") : (c.dark ? "rgba(252,165,165,0.6)" : "rgba(185,28,28,0.5)");
    ctx.fillText(p ? "⊖" : "⊕", X(gx), Y(gy));
  }
  // asosiy zaryad tashuvchilar (zonadan tashqarida) va o'tayotganlari
  const flux = I > 1e-7 ? clamp(Math.log10(I / 1e-7) / 5, 0, 1) : 0;
  for (let k = 0; k < 34; k++) {
    const p = k % 2 === 0, yy = y + 16 + hash(k * 3) * (h - 22);
    let xx;
    if (flux > 0 && hash(k * 7) < 0.25 + 0.6 * flux) {
      const ph = (anim * (0.18 + 0.5 * flux) + hash(k)) % 1;
      xx = p ? x + 6 + ph * (w * 0.72) : x + w - 6 - ph * (w * 0.72);
      const past = p ? xx - z1 : z0 - xx; if (past > 0) ctx.globalAlpha = clamp(1 - past / 50, 0, 1);
    } else {
      const base = hash(k * 5), jig = 2.5 * Math.sin(anim * 5 + k);
      xx = p ? x + 6 + base * (z0 - x - 10) + jig : z1 + 4 + base * (x + w - z1 - 10) + jig;
    }
    if (p) { ctx.strokeStyle = c.danger; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(X(xx), Y(yy), 2.8 * s, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = c.dark ? "#93c5fd" : "#1d4ed8"; ctx.beginPath(); ctx.arc(X(xx), Y(yy), 2.6 * s, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; rr(ctx, x, y, w, h, 6); ctx.stroke();
  ctx.strokeStyle = c.text3; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(z0), Y(y + 12)); ctx.lineTo(X(z0), Y(y + h)); ctx.moveTo(X(z1), Y(y + 12)); ctx.lineTo(X(z1), Y(y + h)); ctx.stroke(); ctx.setLineDash([]);
  label(ctx, c, "p", X(x + 6), Y(y + 9), "left", c.danger); label(ctx, c, "n", X(x + w - 6), Y(y + 9), "right", c.primary);
  label(ctx, c, wz > 40 ? "kambag‘allashgan qatlam" : "qatlam", X(jx), Y(y + 9), "center", c.text2);
}
function ledShape(ctx, c, x, y, d, I) {
  const s = view.s, [r, g, b] = d.led, br = clamp(I / 0.02, 0, 1.5);
  if (br > 0.01) { const hg = ctx.createRadialGradient(X(x), Y(y - 8), 2, X(x), Y(y - 8), (22 + 40 * Math.sqrt(br)) * s); hg.addColorStop(0, `rgba(${r},${g},${b},${0.55 * Math.min(1, br) + 0.15})`); hg.addColorStop(1, `rgba(${r},${g},${b},0)`); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(X(x), Y(y - 8), (22 + 40 * Math.sqrt(br)) * s, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = "#a1a1aa"; ctx.lineWidth = Math.max(1, 1.2 * s); ctx.beginPath(); ctx.moveTo(X(x - 3), Y(y + 4)); ctx.lineTo(X(x - 3), Y(y + 20)); ctx.moveTo(X(x + 3), Y(y + 4)); ctx.lineTo(X(x + 3), Y(y + 16)); ctx.stroke();
  const a = br > 0.01 ? 0.75 + 0.25 * Math.min(1, br) : 0.45;
  ctx.fillStyle = `rgba(${r},${g},${b},${a})`; ctx.beginPath(); ctx.moveTo(X(x - 6.5), Y(y + 4)); ctx.lineTo(X(x - 6.5), Y(y - 10)); ctx.arc(X(x), Y(y - 10), 6.5 * s, Math.PI, 0); ctx.lineTo(X(x + 6.5), Y(y + 4)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(${r},${g},${b},${a})`; rr(ctx, x - 8, y + 2, 16, 3, 1); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.ellipse(X(x - 3), Y(y - 11), 1.6 * s, 4 * s, 0, 0, TAU); ctx.fill();
  if (br > 0.05) { ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.arc(X(x), Y(y - 4), 1.8 * s, 0, TAU); ctx.fill(); }
}
function drawVaxStage(ctx, c) {
  const s = view.s, col = COL(c), d = dObj(), r = dCirc(), rev = dio.pol < 0, on = Math.abs(r.I) > 1e-6;
  table(ctx, c, 286);
  pnInset(ctx, c, 142, 6, 370, 80, d, r.U - r.I * d.Rs, r.I);
  const ps = powerSupply(ctx, c, X(8), Y(8), 122 * s, 100 * s, { value: dio.E, unit: "V", frac: dio.E / dEmax(), title: rev ? "Manba 0–30 V" : "Manba 0–5 V", on: true });
  const kw = wd([ps.knob.x, ps.knob.y]); hits.knob = { x: kw[0], y: kw[1], r: ps.knob.r / s + 4 };
  const pp = wd(ps.plus), pm = wd(ps.minus);
  // qutb almashtirgich
  ctx.fillStyle = c.dark ? "#334155" : "#e5e7eb"; rr(ctx, 18, 136, 86, 48, 5); ctx.fill(); ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.stroke();
  const ins = [[40, 142], [82, 142]], outs = [[104, 152], [104, 172]];
  ctx.strokeStyle = c.dark ? "#cbd5e1" : "#57534e"; ctx.lineWidth = 2 * s; ctx.lineCap = "round"; ctx.beginPath();
  if (!rev) { ctx.moveTo(X(40), Y(146)); ctx.lineTo(X(94), Y(152)); ctx.moveTo(X(82), Y(146)); ctx.lineTo(X(94), Y(172)); }
  else { ctx.moveTo(X(40), Y(146)); ctx.lineTo(X(94), Y(172)); ctx.moveTo(X(82), Y(146)); ctx.lineTo(X(94), Y(152)); }
  ctx.stroke();
  ctx.fillStyle = "#111827"; rr(ctx, 30, rev ? 166 : 156, 22, 10, 2); ctx.fill();
  ctx.fillStyle = c.text2; ctx.font = F(700, 6.5); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(rev ? "teskari" : "to‘g‘ri", X(56), Y(rev ? 171 : 161));
  hits.pol = { x: 18, y: 136, w: 86, h: 48 };
  wire(ctx, c, S([pp, [pp[0], 124], [40, 124], ins[0]]), { color: col.red, on });
  wire(ctx, c, S([pm, [pm[0], 130], [82, 130], ins[1]]), { color: col.black, on });
  // rezistor 100 Ω
  const am = analogMeter(ctx, c, X(194), Y(112), 80 * s, rev ? { value: Math.abs(r.I) * 1e6, sym: "μA", label: `0–${pickR(RANGES_UA, Math.abs(r.I) * 1e6)} μA`, plusLeft: true, ...mOpt(pickR(RANGES_UA, Math.abs(r.I) * 1e6)) } : { value: r.I * 1e3, sym: "mA", label: `0–${pickR(RANGES_MA, r.I * 1e3)} mA`, plusLeft: true, ...mOpt(pickR(RANGES_MA, r.I * 1e3)) });
  const vmax = rev ? 30 : d.led ? 5 : 1;
  const vm = analogMeter(ctx, c, X(424), Y(108), 80 * s, { value: Math.abs(r.U), max: vmax, sym: "V", label: `0–${vmax} V`, ticks: vmax === 30 ? 3 : 5, digits: vmax === 1 ? 1 : 0, plusLeft: true });
  const ap = wd(am.plus), an = wd(am.minus), vp = wd(vm.plus), vn = wd(vm.minus);
  const A = [318, 254], K = [402, 254];
  wire(ctx, c, S([outs[0], [124, 152], [124, 196], [134, 196]]), { color: col.red, on });
  resistor(ctx, c, [134, 196], [184, 196], BANDS[100]);
  wire(ctx, c, S([[184, 196], [ap[0], 196], ap]), { color: col.red, on });
  wire(ctx, c, S([an, [an[0], 202], [292, 202], [292, 254], A]), { color: col.red, on });
  wire(ctx, c, S([K, [446, 254], [446, 282], [114, 282], [114, 172], outs[1]]), { color: col.black, on });
  wire(ctx, c, S([vp, [vp[0], 226], [318, 226], [318, 240]]), { color: col.blue, width: 1.8 });
  wire(ctx, c, S([vn, [vn[0], 240], [402, 240]]), { color: col.blue, width: 1.8 });
  // diod taxtachasi
  ctx.fillStyle = c.dark ? "#7c5a3a" : "#c08a55"; rr(ctx, 304, 236, 112, 34, 4); ctx.fill(); ctx.strokeStyle = c.dark ? "#5b4029" : "#9a6a3e"; ctx.lineWidth = 1; ctx.stroke();
  const Id = r.I;
  if (d.led) { ledShape(ctx, c, 360, 238, d, Id); ctx.strokeStyle = "#a1a1aa"; ctx.lineWidth = Math.max(1, 1.2 * s); ctx.beginPath(); ctx.moveTo(X(357), Y(258)); ctx.lineTo(X(357), Y(262)); ctx.lineTo(X(A[0]), Y(262)); ctx.lineTo(X(A[0]), Y(A[1])); ctx.moveTo(X(363), Y(254)); ctx.lineTo(X(K[0]), Y(K[1])); ctx.stroke(); }
  else axialDiode(ctx, c, A, K, Id > 1e-4, dio.type === "ge");
  [A, K].forEach((p) => terminal(ctx, X(p[0]), Y(p[1]), 4 * s, "#a1a1aa"));
  [ps.plus, ps.minus].forEach((p, i) => terminal(ctx, p[0], p[1], Math.max(4, 6 * s), i ? "#334155" : "#dc2626"));
  [am.plus, am.minus, vm.plus, vm.minus].forEach((p, i) => terminal(ctx, p[0], p[1], 4.4 * s, i % 2 ? "#334155" : "#dc2626"));
  [...ins, ...outs].forEach((p) => terminal(ctx, X(p[0]), Y(p[1]), 3.4 * s, "#a1a1aa"));
  if (on) flowDots(ctx, c, [[124, 196], [ap[0], 196], ap, an, [an[0], 202], [292, 202], [292, 254], A, K, [446, 254], [446, 282], [114, 282]], anim * (rev ? 0.05 : 0.12 + 0.3 * clamp(r.I / 0.03, 0, 1)) * (rev ? 1 : 1), rev ? 6 : 18);
  label(ctx, c, "R = 100 Ω", X(159), Y(212), "center", c.text2);
  label(ctx, c, d.short, X(360), Y(292), "center", c.text);
  label(ctx, c, rev ? "anod «−» ga, katod «+» ga" : "anod «+» ga, katod «−» ga", X(470), Y(206), "center", rev ? c.danger : c.success);
}

/* ------------------------------------------------------------------ 3b) To'g'rilagich */

function recCalc() { rec.res = P.rectifier({ Um: 12 * Math.SQRT2, R: rec.R, C: rec.C * 1e-6, bridge: rec.bridge, N: 300 }); }
function recAt(ph) { const r = rec.res, i = clamp(Math.round((ph / 2) * (r.t.length - 1)), 0, r.t.length - 1); return { u: r.uin[i], v: r.uout[i], id: r.id[i] }; }
function transformer(ctx, c) {
  const s = view.s;
  const g = ctx.createLinearGradient(X(14), 0, X(120), 0); g.addColorStop(0, "#475569"); g.addColorStop(0.5, "#94a3b8"); g.addColorStop(1, "#334155");
  ctx.fillStyle = g; ctx.fillRect(X(14), Y(126), 106 * s, 114 * s);
  ctx.fillStyle = c.dark ? "#0f172a" : "#e7e5e4"; ctx.fillRect(X(36), Y(146), 20 * s, 74 * s); ctx.fillRect(X(78), Y(146), 20 * s, 74 * s);
  ctx.strokeStyle = "rgba(15,23,42,0.35)"; ctx.lineWidth = 0.7; for (let y = 128; y < 240; y += 3) { ctx.beginPath(); ctx.moveTo(X(14), Y(y)); ctx.lineTo(X(120), Y(y)); ctx.stroke(); }
  const coil = (x0, w, n, thick) => { const gc = ctx.createLinearGradient(X(x0), 0, X(x0 + w), 0); gc.addColorStop(0, "#7c2d12"); gc.addColorStop(0.5, "#f59e0b"); gc.addColorStop(1, "#7c2d12"); ctx.fillStyle = gc; ctx.fillRect(X(x0), Y(150), w * s, 66 * s); ctx.strokeStyle = "rgba(120,53,15,0.6)"; ctx.lineWidth = thick; for (let k = 0; k < n; k++) { const y = 152 + (k * 62) / n; ctx.beginPath(); ctx.moveTo(X(x0), Y(y)); ctx.lineTo(X(x0 + w), Y(y + 1)); ctx.stroke(); } };
  coil(26, 22, 30, 0.6); coil(66, 22, 12, 1.4);
  ctx.strokeStyle = c.dark ? "#a1a1aa" : "#27272a"; ctx.lineWidth = 3 * s; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(X(26), Y(232)); ctx.bezierCurveTo(X(10), Y(250), X(14), Y(276), X(4), Y(294)); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = F(700, 7); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("220 V", X(37), Y(256)); ctx.fillText("12 V", X(77), Y(256)); ctx.fillText("Transformator", X(67), Y(118));
  wire(ctx, c, S([[88, 150], [88, 140], [124, 140]]), { color: "#b45309", width: 1.6 }); wire(ctx, c, S([[88, 216], [88, 226], [124, 226]]), { color: "#b45309", width: 1.6 });
}
function capacitor(ctx, c, x, y0, y1, uF) {
  const s = view.s, cy = (y0 + y1) / 2, h = uF >= 1000 ? 38 : uF >= 470 ? 32 : 26, w = uF >= 1000 ? 18 : 14;
  ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = Math.max(1, 1.3 * s); ctx.beginPath(); ctx.moveTo(X(x), Y(y0)); ctx.lineTo(X(x), Y(cy - h / 2)); ctx.moveTo(X(x), Y(cy + h / 2)); ctx.lineTo(X(x), Y(y1)); ctx.stroke();
  const g = ctx.createLinearGradient(X(x - w / 2), 0, X(x + w / 2), 0); g.addColorStop(0, "#1e3a8a"); g.addColorStop(0.45, "#3b82f6"); g.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = g; rr(ctx, x - w / 2, cy - h / 2, w, h, 3); ctx.fill();
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(X(x + w / 2 - 4), Y(cy - h / 2), 3 * s, h * s);
  ctx.fillStyle = "#94a3b8"; ctx.beginPath(); ctx.ellipse(X(x), Y(cy - h / 2), (w / 2) * s, 2 * s, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(X(x - 1), Y(cy)); ctx.rotate(-Math.PI / 2); ctx.fillStyle = "#e0f2fe"; ctx.font = F(700, 5.5); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${uF} μF 25 V`, 0, 0); ctx.restore();
}
function scope(ctx, c, x, y, w, h) {
  const s = view.s, r = rec.res, sx = x + 8, sy = y + 8, sw = w * 0.62, sh = h - 16;
  const g = ctx.createLinearGradient(0, Y(y), 0, Y(y + h)); g.addColorStop(0, c.dark ? "#64748b" : "#e5e7eb"); g.addColorStop(1, c.dark ? "#334155" : "#9ca3af");
  ctx.fillStyle = g; rr(ctx, x, y, w, h, 6); ctx.fill(); ctx.strokeStyle = "#6b7280"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#06281a"; rr(ctx, sx, sy, sw, sh, 4); ctx.fill();
  ctx.strokeStyle = "rgba(74,222,128,0.18)"; ctx.lineWidth = 0.7;
  for (let k = 0; k <= 10; k++) { ctx.beginPath(); ctx.moveTo(X(sx + (sw * k) / 10), Y(sy)); ctx.lineTo(X(sx + (sw * k) / 10), Y(sy + sh)); ctx.stroke(); }
  for (let k = 0; k <= 8; k++) { ctx.beginPath(); ctx.moveTo(X(sx), Y(sy + (sh * k) / 8)); ctx.lineTo(X(sx + sw), Y(sy + (sh * k) / 8)); ctx.stroke(); }
  const VY = (v) => sy + sh / 2 - (v / 5) * (sh / 8), TX = (i) => sx + (i / (r.t.length - 1)) * sw;
  ctx.save(); ctx.beginPath(); ctx.rect(X(sx), Y(sy), sw * s, sh * s); ctx.clip();
  const tr = (arr, color) => { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, 1.4 * s); ctx.shadowColor = color; ctx.shadowBlur = 4; ctx.beginPath(); arr.forEach((v, i) => (i ? ctx.lineTo(X(TX(i)), Y(VY(v))) : ctx.moveTo(X(TX(i)), Y(VY(v))))); ctx.stroke(); ctx.shadowBlur = 0; };
  tr(r.uin, "#facc15"); tr(r.uout, "#22d3ee");
  const i = Math.round((rec.ph / 2) * (r.t.length - 1)); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(X(TX(i)), Y(VY(r.uout[i])), 2 * s, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = c.dark ? "#f1f5f9" : "#1f2937"; ctx.font = F(700, 6); ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const kx = sx + sw + 8;
  ctx.fillText("OSSILLOGRAF", X(kx), Y(y + 10));
  [["CH1 5 V/bo‘l", "#facc15", 26], ["CH2 5 V/bo‘l", "#22d3ee", 46], ["4 ms/bo‘l", "#a1a1aa", 66]].forEach(([t, cl, yy]) => { ctx.fillStyle = "#1f2937"; ctx.beginPath(); ctx.arc(X(kx + 6), Y(y + yy), 5 * s, 0, TAU); ctx.fill(); ctx.fillStyle = cl; ctx.fillRect(X(kx + 5), Y(y + yy - 4), 2 * s, 4 * s); ctx.fillStyle = c.dark ? "#e2e8f0" : "#1f2937"; ctx.fillText(t, X(kx + 14), Y(y + yy)); });
  return { ch1: [x + 14, y + h], ch2: [x + 40, y + h] };
}
function drawRect(ctx, c) {
  const s = view.s, col = COL(c), r = rec.res, at = recAt(rec.ph), cond = at.id > 0.002, pos = at.u > 0;
  table(ctx, c, 286);
  transformer(ctx, c);
  ctx.fillStyle = c.dark ? "#14532d" : "#166534"; rr(ctx, 136, 108, 196, 168, 6); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.25)"; for (let x = 142; x < 330; x += 8) for (let y = 114; y < 272; y += 8) { ctx.beginPath(); ctx.arc(X(x), Y(y), 0.9 * s, 0, TAU); ctx.fill(); }
  const AC1 = [124, 140], AC2 = [124, 226], TOP = 132, BOT = 252, RX = 470;
  let act = [];
  if (rec.bridge) {
    const L = [176, 192], R = [286, 192], T = [231, TOP], B = [231, BOT];
    wire(ctx, c, S([AC1, [150, 140], [150, 192], L]), { color: "#b45309", on: cond });
    wire(ctx, c, S([AC2, [140, 226], [140, 268], [312, 268], [312, 192], R]), { color: "#b45309", on: cond });
    const ds = [[L, T], [R, T], [B, L], [B, R]], on = [cond && pos, cond && !pos, cond && !pos, cond && pos];
    ds.forEach(([a, b], k) => axialDiode(ctx, c, a, b, on[k]));
    ["D1", "D2", "D3", "D4"].forEach((t, k) => { const [a, b] = ds[k]; label(ctx, c, t, X((a[0] + b[0]) / 2 + (k % 2 ? 14 : -14)), Y((a[1] + b[1]) / 2 + (k < 2 ? -8 : 8)), "center", on[k] ? c.warning : c.text3); });
    wire(ctx, c, S([T, [RX, TOP]]), { color: col.red, on: true });
    wire(ctx, c, S([B, [306, BOT]]), { color: col.black, on: true });
    ctx.strokeStyle = col.black; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(X(306), Y(BOT)); ctx.arc(X(312), Y(BOT), 6 * s, Math.PI, 0); ctx.stroke();
    wire(ctx, c, S([[318, BOT], [RX, BOT]]), { color: col.black, on: true });
    if (cond) act = pos ? [AC1, [150, 140], [150, 192], L, T, [RX, TOP]] : [AC2, [140, 226], [140, 268], [312, 268], [312, 192], R, T, [RX, TOP]];
    [L, R, T, B].forEach((p) => { ctx.fillStyle = c.dark ? "#e2e8f0" : "#1f2937"; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 2.4 * s, 0, TAU); ctx.fill(); });
  } else {
    wire(ctx, c, S([AC1, [150, 140], [150, TOP], [180, TOP]]), { color: "#b45309", on: cond });
    axialDiode(ctx, c, [180, TOP], [250, TOP], cond);
    label(ctx, c, "D1", X(215), Y(TOP - 14), "center", cond ? c.warning : c.text3);
    wire(ctx, c, S([[250, TOP], [RX, TOP]]), { color: col.red, on: true });
    wire(ctx, c, S([AC2, [150, 226], [150, BOT], [RX, BOT]]), { color: col.black, on: true });
    if (cond) act = [AC1, [150, 140], [150, TOP], [RX, TOP]];
  }
  if (rec.C > 0) { capacitor(ctx, c, 380, TOP, BOT, rec.C); [[380, TOP], [380, BOT]].forEach((p) => { ctx.fillStyle = c.dark ? "#e2e8f0" : "#1f2937"; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 2.4 * s, 0, TAU); ctx.fill(); }); }
  resistor(ctx, c, [RX, TOP], [RX, BOT], BANDS[100], { body: "#d6d3d1", len: 44 });
  label(ctx, c, `R = ${fmt(rec.R, 0)} Ω`, X(RX + 6), Y((TOP + BOT) / 2 + 30), "right", c.text2);
  const vi = clamp(at.v / 17, 0, 1);
  if (cond && act.length) flowDots(ctx, c, act, anim * 0.6, 10);
  if (vi > 0.01) flowDots(ctx, c, [[RX, TOP + 30], [RX, BOT - 30]], anim * (0.3 + 0.8 * vi), 4, c.dark ? "#67e8f9" : "#0891b2");
  const sc = scope(ctx, c, 332, 4, 184, 104);
  cable(ctx, [sc.ch2, [sc.ch2[0] + 30, 120], [RX - 6, TOP - 8], [RX, TOP]], "#22d3ee", 1.4);
  cable(ctx, [sc.ch1, [300, 116], [140, 110], [124, 136]], "#facc15", 1.4);
  label(ctx, c, `chiqish ${fmt(at.v, 1)} V`, X(420), Y(BOT + 20), "center", c.primary);
  label(ctx, c, `kirish ${fmt(at.u, 1)} V`, X(67), Y(272), "center", c.warning);
}

/* ------------------------------------------------------------------ 3c) Tranzistor */

const trCalc = () => P.transistor(trs.U, trs.Rb, UCC, R_LAMP);
function drawTrStage(ctx, c) {
  const s = view.s, col = COL(c), t = trCalc(), onB = t.Ib > 1e-6, onC = t.Ic > 1e-5;
  table(ctx, c, 286);
  // batareyalar (4 × 1,5 V)
  ctx.fillStyle = "#1f2937"; rr(ctx, 16, 244, 140, 32, 4); ctx.fill();
  for (let k = 0; k < 4; k++) { const x = 22 + k * 33, g = ctx.createLinearGradient(0, Y(250), 0, Y(270)); g.addColorStop(0, "#fbbf24"); g.addColorStop(0.5, "#78350f"); g.addColorStop(1, "#1c1917"); ctx.fillStyle = g; rr(ctx, x, 250, 28, 20, 4); ctx.fill(); ctx.fillStyle = "#e5e7eb"; ctx.fillRect(X(x + (k % 2 ? 0 : 27)), Y(256), 2 * s, 8 * s); ctx.fillStyle = "#fff"; ctx.font = F(700, 5.5); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("1,5 V", X(x + 14), Y(260)); }
  ctx.fillStyle = c.text2; ctx.font = F(700, 7); ctx.fillText("6 V", X(86), Y(284));
  const BP = [16, 260], BM = [156, 260];
  // potensiometr
  const px = 66, py = 140, f = trs.U / UCC, a = (-135 + 270 * f) * DEG - Math.PI / 2;
  ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.arc(X(px), Y(py), 28 * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(px), Y(py), 31 * s, (-135 - 90) * DEG, (-135 - 90 + 270 * f) * DEG); ctx.stroke();
  const gk = ctx.createRadialGradient(X(px - 5), Y(py - 5), 2, X(px), Y(py), 18 * s); gk.addColorStop(0, "#f4f4f5"); gk.addColorStop(1, "#a1a1aa");
  ctx.fillStyle = gk; ctx.beginPath(); ctx.arc(X(px), Y(py), 17 * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#dc2626"; ctx.lineWidth = Math.max(1.5, 2.4 * s); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(X(px), Y(py)); ctx.lineTo(X(px + Math.cos(a) * 15), Y(py + Math.sin(a) * 15)); ctx.stroke();
  hits.pot = { x: px, y: py, r: 34 };
  const lug = [[98, 124], [98, 140], [98, 156]];
  lug.forEach(([x, y]) => { ctx.fillStyle = "#d4d4d8"; ctx.fillRect(X(x - 6), Y(y - 2), 8 * s, 4 * s); });
  ctx.fillStyle = c.text2; ctx.font = F(700, 7); ctx.textAlign = "center"; ctx.fillText("potensiometr", X(px), Y(py + 40));
  // baza zanjiri: potensiometr → mA-metr → R_B → B
  const bm = analogMeter(ctx, c, X(110), Y(112), 70 * s, { value: t.Ib * 1e3, sym: "mA", label: "baza 0–3 mA", max: 3, ticks: 3, digits: 0, plusLeft: true });
  const bp = wd(bm.plus), bn = wd(bm.minus);
  wire(ctx, c, S([lug[1], [106, 140], [106, 178], [bp[0], 178], bp]), { color: col.red, on: onB });
  wire(ctx, c, S([bn, [bn[0], 190], [184, 190]]), { color: col.red, on: onB });
  resistor(ctx, c, [184, 190], [240, 190], BANDS[trs.Rb] || BANDS[2000]);
  label(ctx, c, `${trs.Rb >= 1000 ? `${fmt(trs.Rb / 1000, trs.Rb % 1000 ? 1 : 0)} kΩ` : `${trs.Rb} Ω`}`, X(212), Y(206), "center", c.text2);
  wire(ctx, c, S([[240, 190], [272, 190]]), { color: col.red, on: onB });
  // + va − simlar
  wire(ctx, c, S([BP, [8, 260], [8, 30], [412, 30], [412, 118], [428, 118]]), { color: col.red, on: onC || onB });
  wire(ctx, c, S([lug[0], [98, 30]]), { color: col.red, on: onB });
  wire(ctx, c, S([lug[2], [98, 236], [164, 236], [164, 260], BM]), { color: col.black });
  wire(ctx, c, S([[300, 226], [300, 260], BM]), { color: col.black, on: onC || onB });
  // tranzistor plata (BC337)
  ctx.fillStyle = c.dark ? "#14532d" : "#15803d"; rr(ctx, 266, 150, 68, 80, 5); ctx.fill();
  ctx.strokeStyle = "#d97706"; ctx.lineWidth = Math.max(1.5, 2.6 * s); ctx.lineCap = "round"; ctx.beginPath();
  ctx.moveTo(X(292), Y(206)); ctx.lineTo(X(292), Y(214)); ctx.lineTo(X(278), Y(214)); ctx.lineTo(X(278), Y(190)); ctx.lineTo(X(272), Y(190));
  ctx.moveTo(X(300), Y(206)); ctx.lineTo(X(300), Y(226));
  ctx.moveTo(X(308), Y(206)); ctx.lineTo(X(308), Y(214)); ctx.lineTo(X(322), Y(214)); ctx.lineTo(X(322), Y(160)); ctx.lineTo(X(300), Y(160)); ctx.lineTo(X(300), Y(154));
  ctx.stroke();
  ctx.strokeStyle = "#d4d4d8"; ctx.lineWidth = Math.max(1, 1.4 * s); ctx.beginPath(); [292, 300, 308].forEach((x) => { ctx.moveTo(X(x), Y(196)); ctx.lineTo(X(x), Y(207)); }); ctx.stroke();
  const tg = ctx.createLinearGradient(X(288), 0, X(312), 0); tg.addColorStop(0, "#09090b"); tg.addColorStop(0.5, "#3f3f46"); tg.addColorStop(1, "#09090b");
  ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(X(288), Y(198)); ctx.lineTo(X(288), Y(176)); ctx.arc(X(300), Y(176), 12 * s, Math.PI, 0); ctx.lineTo(X(312), Y(198)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d4d4d8"; ctx.font = F(700, 5); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("BC", X(300), Y(178)); ctx.fillText("337", X(300), Y(185));
  ctx.fillStyle = "#fff"; ctx.font = F(800, 6.5); ctx.fillText("K", X(292), Y(160)); ctx.fillText("B", X(272), Y(178)); ctx.fillText("E", X(312), Y(226));
  [[272, 190], [300, 154], [300, 226]].forEach((p) => terminal(ctx, X(p[0]), Y(p[1]), 3.6 * s, "#a1a1aa"));
  // kollektor zanjiri: + → lampa → mA-metr → K
  const lampP = t.Ic * t.Ic * R_LAMP, br = clamp(lampP / 0.9, 0, 1.3), T = 300 + 2400 * Math.pow(Math.min(1, br), 0.35), rgb = tempRGB(Math.max(1000, T));
  if (br > 0.02) { const g = ctx.createRadialGradient(X(440), Y(80), 3, X(440), Y(80), (30 + 50 * Math.sqrt(br)) * s); g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(0.75, 0.6 * br + 0.1)})`); g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(440), Y(80), (30 + 50 * Math.sqrt(br)) * s, 0, TAU); ctx.fill(); }
  ctx.fillStyle = br > 0.02 ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.2 + 0.6 * Math.min(1, br)})` : c.dark ? "rgba(226,232,240,0.15)" : "rgba(226,232,240,0.6)";
  ctx.beginPath(); ctx.arc(X(440), Y(80), 16 * s, 0, TAU); ctx.fill(); ctx.strokeStyle = c.dark ? "rgba(203,213,225,0.7)" : "rgba(100,116,139,0.8)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = br > 0.05 ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : "#57534e"; ctx.lineWidth = Math.max(1, 1.4 * s); ctx.beginPath(); for (let k = 0; k <= 16; k++) { const xx = 434 + (12 * k) / 16, yy = 78 + Math.sin(k * 2.4) * 1.5; k ? ctx.lineTo(X(xx), Y(yy)) : ctx.moveTo(X(xx), Y(yy)); } ctx.stroke();
  const g2 = ctx.createLinearGradient(X(432), 0, X(448), 0); g2.addColorStop(0, "#a16207"); g2.addColorStop(0.45, "#fde68a"); g2.addColorStop(1, "#854d0e");
  ctx.fillStyle = g2; ctx.fillRect(X(433), Y(94), 14 * s, 10 * s); ctx.fillStyle = "#1c1917"; rr(ctx, 424, 104, 32, 14, 3); ctx.fill();
  [[428, 118], [452, 118]].forEach((p) => terminal(ctx, X(p[0]), Y(p[1]), 3.4 * s, "#a1a1aa"));
  label(ctx, c, "lampa 6,3 V", X(440), Y(56), "center", br > 0.05 ? c.warning : c.text3);
  const cm = analogMeter(ctx, c, X(338), Y(84), 76 * s, { value: t.Ic * 1e3, sym: "mA", label: "kollektor 0–200 mA", max: 200, ticks: 4, digits: 0, plusLeft: false });
  const cp = wd(cm.plus), cn = wd(cm.minus);
  wire(ctx, c, S([[452, 118], [462, 118], [462, 150], [cp[0], 150], cp]), { color: col.red, on: onC });
  wire(ctx, c, S([cn, [cn[0], 150], [300, 150], [300, 154]]), { color: col.red, on: onC });
  [bm.plus, bm.minus, cm.plus, cm.minus].forEach((p, i) => terminal(ctx, p[0], p[1], 4 * s, i === 0 || i === 2 ? "#dc2626" : "#334155"));
  if (onC) flowDots(ctx, c, [[412, 30], [412, 118], [428, 118], [452, 118], [462, 118], [462, 150], cp, cn, [cn[0], 150], [300, 150], [300, 260], BM], anim * (0.1 + 0.5 * clamp(t.Ic / 0.15, 0, 1)), 18);
  if (onB) flowDots(ctx, c, [lug[1], [106, 140], [106, 178], bp, bn, [bn[0], 190], [272, 190]], anim * (0.05 + 0.2 * clamp(t.Ib / 0.002, 0, 1)), 5, c.dark ? "#67e8f9" : "#0891b2");
  label(ctx, c, t.cut ? "yopiq" : t.sat ? "to‘yinish (kalit ochiq)" : "kuchaytirish", X(300), Y(140), "center", t.cut ? c.text3 : t.sat ? c.success : c.warning);
}

/* ------------------------------------------------------------------ Sahna */

function draw(ctx, stg) {
  CW = stg.w;
  const c = stg.colors;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, stg.w, stg.h);
  fit(stg.w, stg.h);
  for (const k of Object.keys(hits)) delete hits[k];
  const k = kind();
  if (k === "thermo") drawThermo(ctx, c);
  else if (k === "photo") drawPhotoStage(ctx, c);
  else if (k === "lat") drawLattice(ctx, c);
  else if (k === "vax") drawVaxStage(ctx, c);
  else if (k === "rect") drawRect(ctx, c);
  else drawTrStage(ctx, c);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { graph: Math.round(clamp(vh * 0.28, 190, 250)) }; };
const stage = createStage($("#stage"), draw, { height: (cw) => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return Math.round(clamp(Math.min(cw * 0.62, vh * 0.46), 240, 340)); } });

/* ------------------------------------------------------------------ Grafik */

function latDop() { return { Nd: lat.dope === "n" ? latN() : 0, Na: lat.dope === "p" ? latN() : 0 }; }
function drawGraphCanvas(ctx, gs) {
  const k = kind(), v = ui.view[k];
  if (k === "thermo") return drawRT(ctx, gs, { view: v, hist: rt.hist, T: rt.T, hover: ui.hover });
  if (k === "photo") return drawPhoto(ctx, gs, { E: photoE(), hover: ui.hover });
  if (k === "lat") return drawCarriers(ctx, gs, { view: v, mat: latMat(), ...latDop(), T: lat.T, hover: ui.hover });
  if (k === "vax") { const r = dCirc(); return drawVAX(ctx, gs, { d: dObj(), T: dTK(), pts: dio.pts, U: r.U, I: r.I, hover: ui.hover }); }
  if (k === "rect") return drawWave(ctx, gs, { r: rec.res, ph: rec.ph / 2, hover: ui.hover });
  const t = trCalc(); return drawTr(ctx, gs, { Ucc: UCC, Rk: R_LAMP, Ib: t.Ib, Ic: t.Ic, hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  thermo: [["R", "R(t)", "Qarshilikning temperaturaga bog‘liqligi", "Nuqtalar — multimetrlar ko‘rsatishi (har 5 °C da), shtrix — nazariya. Misning qarshiligi qizdirilganda chiziqli ortadi (α = 0,0043 1/K), termorezistorniki esa keskin kamayadi: 20 °C dan 100 °C gacha ~15 marta."],
    ["ln", "ln R(1/T)", "Termorezistor: ln R ning 1/T ga bog‘liqligi", "Yarimo‘tkazgichda R ∝ e^(B/T): ln R ning 1/T ga bog‘liqligi to‘g‘ri chiziq. Qiyalik B = E/(2k) dan zaryad tashuvchilarni hosil qilish energiyasi E ≈ 0,68 eV topiladi."]],
  photo: [["R", "R(E)", "Fotorezistor qarshiligining yoritilganlikka bog‘liqligi", "Ikkala o‘q logarifmik. Yorug‘lik fotonlari bog‘lardagi elektronlarni uzib, elektron-kovak juftlarini hosil qiladi — qarshilik qorong‘idagi 1 MΩ dan yorug‘da bir necha yuz Ω gacha kamayadi."]],
  lat: [["n", "n(T)", "Zaryad tashuvchilar konsentratsiyasi", "Logarifmik shkala. Sof yarimo‘tkazgichda n = p = nᵢ temperatura bilan eksponensial ortadi. Aralashmali yarimo‘tkazgichda asosiy tashuvchilar soni aralashma konsentratsiyasiga teng, asosiy bo‘lmaganlari n·p = nᵢ² dan topiladi; juda qizdirilsa yana xususiy bo‘lib qoladi."],
    ["s", "σ(T)", "Solishtirma o‘tkazuvchanlik", "σ = e(nμₙ + pμₚ). Aralashma qo‘shilsa o‘tkazuvchanlik millionlab marta ortadi. Aralashmali sohada qizdirilganda σ biroz kamayadi (harakatchanlik kamayadi), yuqori temperaturada esa xususiy o‘tkazuvchanlik ustun keladi."]],
  vax: [["I", "I(U)", "Diodning volt-amper xarakteristikasi", "O‘ngda — to‘g‘ri yo‘nalish (mA), chapda — teskari yo‘nalish (μA yoki nA): masshtablar har xil! Nuqtalar — siz yozgan o‘lchashlar, shtrix — nazariya. To‘g‘ri yo‘nalishda tok ~0,5 V (Ge da ~0,2 V) dan keyin keskin ortadi, teskari yo‘nalishda deyarli o‘tmaydi."]],
  rect: [["u", "u(t)", "Kuchlanish ossillogrammasi", "Sariq shtrix — transformatordan kirayotgan o‘zgaruvchan kuchlanish, ko‘k — yuklamadagi kuchlanish, yashil — uning o‘rtacha qiymati. Kondensator diod yopiq paytda yuklamani o‘zi ta’minlaydi va pulsatsiyani kamaytiradi."]],
  tr: [["I", "Kollektor toki", "Kollektor tokining baza tokiga bog‘liqligi", "Kuchaytirish sohasida kollektor toki baza tokidan β = 160 marta katta. Baza toki yetarlicha katta bo‘lsa, kollektor toki lampa qarshiligi bilan cheklanadi (to‘yinish) — tranzistor ochiq kalit kabi ishlaydi."]],
};
function setTabs() {
  const k = kind(), box = $("[data-tabs]"), tabs = TABS[k], cur = ui.view[k], t = tabs.find((x) => x[0] === cur) || tabs[0];
  box.innerHTML = tabs.map(([v, name]) => `<button type="button" data-tab-value="${v}" aria-pressed="${v === t[0]}">${name}</button>`).join("");
  box.hidden = tabs.length < 2;
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.canvas.setAttribute("aria-label", t[2]); ui.hover = null; graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (!b) return; ui.view[kind()] = b.dataset.tabValue; setTabs(); });
const gcv = graph.canvas;
const ptrIn = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptrIn(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.inv(p.x) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const uR = (R) => { const [v, un] = fR(R); return u(v, un); };
const uI = (I) => { const [v, un] = fI(I); return u(v, un); };
const sciH = (v) => { if (!(v > 0)) return "0"; const e = Math.floor(Math.log10(v)), m = v / 10 ** e; return `${fmt(m, 2)}·${p10(e)}`; };

function updateReadouts() {
  const k = kind();
  if (k === "thermo") {
    const T = rt.T, Rm = P.metalR(T), Rs = P.ntcR(T);
    setRO("r1", "Suv temperaturasi <i>t</i>", u(fmt(T, 1), "°C"), T >= 99.9 ? "suv qaynamoqda" : rt.heat && rt.level > 0 ? `plitka ${fmt(rt.level * 100, 0)} % — isimoqda` : "plitka o‘chiq — sovimoqda", T >= 99.9 ? "red" : "orange");
    setRO("r2", "Mis g‘altak <i>R</i><sub>m</sub>", uR(Rm), `R₂₀ = 10 Ω; ${fmt(Rm / 10, 3)}·R₂₀ (+${fmt((Rm / 10 - 1) * 100, 1)} %)`, "blue");
    setRO("r3", "Termorezistor <i>R</i><sub>t</sub>", uR(Rs), `${fmt(Rs / P.ntcR(20), 3)}·R₂₀ (${fmt((1 - Rs / P.ntcR(20)) * 100, 0)} % kamaydi)`, "orange");
    setRO("r4", "Misning temperatura koeffitsiyenti", u(fmt(((Rm - 10) / (10 * Math.max(0.01, T - 20))) * 1000, 2), "·10⁻³ 1/K"), "α = (R − R₂₀)/(R₂₀Δt)");
    setRO("r5", "Termorezistor: erkin tashuvchilar", u(`×${fmt(P.ntcR(20) / Rs, Rs > P.ntcR(20) / 10 ? 2 : 1)}`, ""), "20 °C dagiga nisbatan (σ ∝ n, n ∝ 1/R)", "green");
    setRO("r6", "Yozilgan nuqtalar", u(String(rt.hist.length), "ta"), `vaqt ${Math.floor(rt.t / 60)} min ${Math.floor(rt.t % 60)} s (tezlik ${ui.speed}×)`);
  } else if (k === "photo") {
    const E = photoE(), R = P.ldrR(E);
    setRO("r1", "Yoritilganlik <i>E</i> (luksmetr)", u(fmt(E, E < 10 ? 1 : 0), "lk"), rt.lampOn ? `lampadan E = I/r² = 80/${fmt((rt.d / 100) ** 2, 4)} + xona ${fmt(rt.room, rt.room < 1 ? 1 : 0)} lk` : "lampa o‘chiq — faqat xona yorug‘ligi", "orange");
    setRO("r2", "Fotorezistor qarshiligi <i>R</i>", uR(R), `qorong‘ida 1 MΩ; ${fmt(1e6 / R, 0)} marta kichik`, "blue");
    setRO("r3", "Lampagacha masofa <i>r</i>", u(fmt(rt.d, 0), "cm"), "masofa 2 marta oshsa, E 4 marta kamayadi");
    setRO("r4", "O‘tkazuvchanlik <i>G</i> = 1/<i>R</i>", u(fmt((1 / R) * 1e6, (1 / R) * 1e6 < 10 ? 2 : 0), "μS"), "fotonlar hosil qilgan juftlar soniga proporsional", "green");
    setRO("r5", "1,5 V batareyadan tok", uI(1.5 / R), "agar fotorezistor batareyaga ulansa: I = U/R");
    setRO("r6", "Qayerda ishlatiladi", "avtomat", "ko‘cha chiroqlari, kamera eksponometri, turniket");
  } else if (k === "lat") {
    const q = latCond(), m = latMat(), I = latI();
    setRO("r1", "Xususiy konsentratsiya <i>n</i>ᵢ", u(sciH(q.ni), "m⁻³"), `${m.name}, T = ${fmt(lat.T, 0)} K; taqiqlangan zona ${fmt(m.Eg, 2)} eV`);
    setRO("r2", "Elektronlar <i>n</i>", u(sciH(q.n), "m⁻³"), lat.dope === "n" ? "asosiy tashuvchilar (donor — fosfor)" : lat.dope === "p" ? "asosiy bo‘lmagan tashuvchilar" : "n = p = nᵢ", "blue");
    setRO("r3", "Kovaklar <i>p</i>", u(sciH(q.p), "m⁻³"), lat.dope === "p" ? "asosiy tashuvchilar (akseptor — bor)" : lat.dope === "n" ? "asosiy bo‘lmagan tashuvchilar" : "har bir uzilgan bog‘ — bitta kovak", "red");
    setRO("r4", "Solishtirma o‘tkazuvchanlik σ", u(sciH(q.sigma), "S/m"), `ρ = 1/σ = ${sciH(1 / q.sigma)} Ω·m; elektron ulushi ${fmt((q.sn / q.sigma) * 100, 0)} %`, "green");
    setRO("r5", "Namunadagi tok <i>I</i>", lat.field ? uI(I) : u("0", "A"), lat.field ? `U = 4,5 V, R = ${fR(4.5 / I).join(" ")}` : "batareya uzilgan", lat.field ? "orange" : "");
    setRO("r6", "Harakatchanlik μ", u(`${fmt(q.mu.n * 1e4, 0)} | ${fmt(q.mu.p * 1e4, 0)}`, "cm²/(V·s)"), "elektron | kovak; dreyf tezligi v = μE");
  } else if (k === "vax") {
    const d = dObj(), r = dCirc(), n = dio.pts.length;
    setRO("r1", "Diodagi kuchlanish <i>U</i>", u(fmt(r.U, Math.abs(r.U) < 2 ? 3 : 2), "V"), dio.pol > 0 ? "to‘g‘ri yo‘nalish (voltmetr)" : "teskari yo‘nalish (voltmetr)", "blue");
    setRO("r2", "Tok kuchi <i>I</i>", uI(r.I), dio.pol > 0 ? `I = (E − U)/R = (${fmt(dio.E, 2)} − ${fmt(r.U, 2)})/100` : "teskari tok — asosiy bo‘lmagan tashuvchilar oqimi", "orange");
    setRO("r3", "Statik qarshilik <i>U</i>/<i>I</i>", Math.abs(r.I) > 1e-12 ? uR(Math.abs(r.U / r.I)) : u("∞", "Ω"), dio.pol > 0 ? "to‘g‘ri yo‘nalishda kichik" : "teskari yo‘nalishda juda katta");
    setRO("r4", "Differensial qarshilik Δ<i>U</i>/Δ<i>I</i>", uR(P.diffR(d, r.U, dTK())), "VAX qiyaligiga teskari");
    setRO("r5", "To‘g‘rilash koeffitsiyenti", u(sciH(P.diodeI(d, 1, dTK()) / Math.abs(P.diodeI(d, -1, dTK()))), ""), "I(+1 V)/|I(−1 V)| — diod tokni bir tomonga o‘tkazadi", "green");
    setRO("r6", "Jadvalda", u(String(n), "nuqta"), n ? `oxirgisi: ${fmt(dio.pts.at(-1).U, 2)} V; ${fI(dio.pts.at(-1).I).join(" ")}` : "«Nuqtani yozish» tugmasini bosing", n ? "green" : "");
    if (d.led) setRO("r5", "Foton energiyasi <i>hν</i>", u(fmt(P.photonEV(d.nm), 2), "eV"), `λ = ${d.nm} nm; eU ≈ hν — LED ${fmt(P.photonEV(d.nm), 1)} V atrofida yona boshlaydi`, "green");
  } else if (k === "rect") {
    const r = rec.res;
    setRO("r1", "Kirish (transformator)", u("12", "V"), `ta’sir etuvchi qiymat; amplituda ${fmt(12 * Math.SQRT2, 1)} V, 50 Hz`, "orange");
    setRO("r2", "Chiqishning o‘rtacha qiymati", u(fmt(r.Uavg, 2), "V"), rec.C ? "kondensator bilan" : `ideal diodda ${fmt(rec.bridge ? P.avgFull(17) : P.avgHalf(17), 2)} V (${rec.bridge ? "2Uₘ/π" : "Uₘ/π"})`, "blue");
    setRO("r3", "Maksimal kuchlanish", u(fmt(r.Umax, 2), "V"), `Uₘ − ${rec.bridge ? "2" : "1"}·0,7 V (diodlardagi kuchlanish)`);
    setRO("r4", "Pulsatsiya Δ<i>U</i>", u(fmt(r.ripple, 2), "V"), rec.C ? `taxminan U/(${rec.bridge ? "2" : ""}fRC) = ${fmt(P.rippleEst(r.Umax, 50, rec.R, rec.C * 1e-6, rec.bridge), 2)} V` : "kondensatorsiz — to‘liq pulsatsiya", rec.C ? "green" : "red");
    setRO("r5", "Yuklama toki (o‘rtacha)", uI(r.Uavg / rec.R), `I = U/R, R = ${fmt(rec.R, 0)} Ω`);
    setRO("r6", "Pulsatsiya chastotasi", u(rec.bridge ? "100" : "50", "Hz"), rec.bridge ? "har yarim davrda bir impuls" : "faqat musbat yarim davrlar o‘tadi");
  } else {
    const t = trCalc(), P_l = t.Ic * t.Ic * R_LAMP;
    setRO("r1", "Baza kuchlanishi (potensiometr)", u(fmt(trs.U, 2), "V"), t.cut ? "0,65 V dan kichik — baza-emitter o‘tishi yopiq" : "baza toki = (U − 0,65 V)/R");
    setRO("r2", "Baza toki <i>I</i><sub>B</sub>", uI(t.Ib), "kichik tok — boshqaruvchi", "blue");
    setRO("r3", "Kollektor toki <i>I</i><sub>K</sub>", uI(t.Ic), t.sat ? `lampa bilan cheklangan: (6 − 0,2)/40 = ${fmt(((UCC - 0.2) / R_LAMP) * 1000, 0)} mA` : `β · baza toki = 160 · ${fI(t.Ib).join(" ")}`, "orange");
    setRO("r4", "Tok kuchaytirish koeffitsiyenti", u(t.Ib > 0 ? fmt(t.gain, 0) : "—", ""), t.sat ? "to‘yinishda kollektor/baza toklari nisbati β dan kichik" : `β = ${P.TRANSISTOR.beta}`, "green");
    setRO("r5", "Kollektor–emitter kuchlanishi", u(fmt(t.Uce, 2), "V"), t.sat ? "to‘yinish: tranzistor deyarli qisqa tutashgan" : t.cut ? "yopiq: barcha kuchlanish tranzistorda" : "kuchaytirish rejimi");
    setRO("r6", "Lampa quvvati", u(fmt(P_l, 2), "W"), `nominal ~0,9 W; emitter toki ${fI(t.Ie).join(" ")}`, P_l > 0.3 ? "orange" : "");
  }
}
function updateStatus() {
  if (flashUntil > Date.now()) return;
  const el = $("[data-status]"), k = kind(); let t, tone = "blue";
  if (k === "thermo") { t = rt.T >= 99.9 ? "Suv qaynamoqda — temperatura o‘zgarmaydi" : rt.heat && rt.level > 0 ? `Suv isimoqda (${ui.speed}×)` : "Plitka o‘chiq"; tone = rt.T >= 99.9 ? "red" : rt.heat ? "orange" : ""; }
  else if (k === "photo") { const E = photoE(); t = E > 500 ? "Kuchli yoritilgan — qarshilik kichik" : E > 20 ? "O‘rtacha yoritilganlik" : "Qorong‘i — qarshilik katta"; tone = E > 500 ? "orange" : E > 20 ? "blue" : ""; }
  else if (k === "lat") { t = lat.field ? "Tok o‘tmoqda: elektronlar «+» ga, kovaklar «−» ga" : "Batareya uzilgan — tartibsiz issiqlik harakati"; tone = lat.field ? "orange" : ""; }
  else if (k === "vax") { const r = dCirc(); t = dio.pol < 0 ? "Teskari yo‘nalish — diod yopiq" : r.I > 1e-3 ? "To‘g‘ri yo‘nalish — diod ochiq" : "To‘g‘ri yo‘nalish — tok hali kichik"; tone = dio.pol < 0 ? "red" : r.I > 1e-3 ? "green" : ""; if (dObj().led && r.I > 0.03) { t = "LED nominal tokidan (20 mA) oshdi!"; tone = "red"; } }
  else if (k === "rect") { t = rec.bridge ? "To‘liq davrli to‘g‘rilagich" : "Yarim davrli to‘g‘rilagich"; tone = "orange"; }
  else { const s = trCalc(); t = s.cut ? "Tranzistor yopiq — lampa o‘chiq" : s.sat ? "Tranzistor to‘liq ochiq — lampa yonmoqda" : "Kuchaytirish: kollektor toki baza tokidan β marta katta"; tone = s.cut ? "" : s.sat ? "green" : "orange"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let flashUntil = 0;
function flashStatus(t) { const el = $("[data-status]"); el.textContent = t; el.dataset.tone = "red"; flashUntil = Date.now() + 2200; }

let lastExplain = "";
function updateExplain() {
  const p = [], k = kind();
  if (k === "thermo") {
    p.push("<p><b>Metallda</b> erkin elektronlar juda ko‘p (har bir atomga ~1 ta) va ularning soni temperaturaga bog‘liq emas. Qizdirilganda kristall panjara ionlari kuchliroq tebranadi, elektronlar ularga tez-tez urilib, tartibli harakati qiyinlashadi — <b>qarshilik ortadi</b>: R = R₀(1 + αΔt).</p>");
    p.push("<p><b>Yarimo‘tkazgichda</b> elektronlar atomlar orasidagi kovalent bog‘larda ushlanib turadi; xona temperaturasida erkin elektronlar juda kam. Qizdirilganda issiqlik harakati energiyasi bog‘larni uza boshlaydi — erkin elektronlar va kovaklar soni eksponensial ortadi va <b>qarshilik keskin kamayadi</b>. Termorezistorlar shu xossa asosida termometr va temperatura datchiklari sifatida ishlatiladi.</p>");
    if (rt.T > 60) p.push(`<p>Hozir ${fmt(rt.T, 0)} °C: mis qarshiligi ${fmt((P.metalR(rt.T) / 10 - 1) * 100, 0)} % ortdi, termorezistorniki esa ${fmt(P.ntcR(20) / P.ntcR(rt.T), 1)} marta kamaydi. Plitkani o‘chirib, sovishini kuzating — jarayon qaytuvchan.</p>`);
  } else if (k === "photo") {
    p.push("<p>Yarimo‘tkazgichdagi bog‘ni faqat issiqlik emas, <b>yorug‘lik</b> ham uzishi mumkin: energiyasi taqiqlangan zona kengligidan katta bo‘lgan foton bog‘dagi elektronni urib chiqaradi va elektron-kovak jufti hosil bo‘ladi. Bu <b>ichki fotoeffekt</b>. Yorug‘lik qancha kuchli bo‘lsa, juftlar shuncha ko‘p, qarshilik shuncha kichik.</p>");
    p.push(`<p>Lampani yaqinlashtiring: yoritilganlik E = I/r² — masofa 2 marta kamaysa, 4 marta ortadi. Hozir E = ${fmt(photoE(), 0)} lk, R = ${fR(P.ldrR(photoE())).join(" ")}. Xonani qorong‘i qilib, lampani o‘chiring — qarshilik megaomga yetadi.</p>`);
  } else if (k === "lat") {
    const m = latMat(), q = latCond();
    p.push(`<p>${m.name} atomining tashqi qobig‘ida 4 ta valent elektron bor; kristallda har bir atom 4 ta qo‘shnisi bilan juft elektronli <b>kovalent bog‘</b> hosil qiladi. Issiqlik harakati ba’zi bog‘larni uzadi: bo‘shagan elektron erkin bo‘ladi (ko‘k), uning o‘rnida musbat zaryadli <b>kovak</b> qoladi (qizil halqa). Qo‘shni bog‘dagi elektron kovakka o‘tsa, kovak boshqa joyga ko‘chadi — xuddi musbat zaryad harakatlanayotgandek.</p>`);
    if (lat.dope === "n") p.push("<p><b>n-tip</b>: 5 valentli fosfor atomining 4 ta elektroni bog‘ hosil qiladi, 5-elektroni ortiqcha va oson ajraladi (fosfor — <b>donor</b>, o‘zi musbat ionga aylanadi). Asosiy tashuvchilar — elektronlar.</p>");
    else if (lat.dope === "p") p.push("<p><b>p-tip</b>: 3 valentli bor atomiga bitta bog‘ uchun elektron yetishmaydi — u qo‘shni bog‘dan elektronni tortib oladi (bor — <b>akseptor</b>, manfiy ionga aylanadi), u yerda kovak paydo bo‘ladi. Asosiy tashuvchilar — kovaklar.</p>");
    else p.push(`<p>Sof (xususiy) yarimo‘tkazgichda elektronlar va kovaklar soni teng: n = p = nᵢ = ${sciH(q.ni)} m⁻³. Bu ${m.sym} atomlari sonidan (5·10²⁸ m⁻³) milliardlab marta kam — shuning uchun sof yarimo‘tkazgich yomon o‘tkazadi. Temperaturani oshiring.</p>`);
    p.push(lat.field ? "<p>Batareya ulangan: elektr maydon elektronlarni «+» kontaktga, kovaklarni «−» kontaktga suradi. Tok ikkala turdagi tashuvchilar harakatidan iborat.</p>" : "<p>Batareyani ulang: tartibsiz harakatga maydon yo‘nalishidagi dreyf qo‘shiladi.</p>");
  } else if (k === "vax") {
    const d = dObj(), r = dCirc();
    p.push("<p>Diod — p va n tipli yarimo‘tkazgichlar tutashgan joy (<b>p–n o‘tish</b>). Chegarada elektronlar va kovaklar bir-biriga diffuziyalanib rekombinatsiyalanadi, tashuvchilardan xoli <b>kambag‘allashgan qatlam</b> va uning ichki maydoni hosil bo‘ladi (yuqoridagi kesim).</p>");
    p.push(dio.pol > 0 ? `<p><b>To‘g‘ri yo‘nalishda</b> (p ga «+») tashqi maydon ichki maydonga qarshi: qatlam torayadi, asosiy tashuvchilar o‘tishdan oqib o‘tadi — tok tez ortadi. Hozir U = ${fmt(r.U, 3)} V, I = ${fI(r.I).join(" ")}.</p>` : `<p><b>Teskari yo‘nalishda</b> qatlam kengayadi va asosiy tashuvchilarni o‘tkazmaydi. Faqat issiqlik hosil qilgan asosiy bo‘lmagan tashuvchilar kichik teskari tok beradi: ${fI(r.I).join(" ")}. ${dio.type === "ge" ? "Germaniyda u kremniydagidan ming marta katta va temperatura bilan tez ortadi." : ""}</p>`);
    if (d.led) p.push(`<p><b>Yorug‘lik diodida</b> o‘tishdan o‘tgan elektronlar kovaklar bilan rekombinatsiyalanib, energiyasini foton sifatida chiqaradi: hν ≈ E<sub>g</sub> (taqiqlangan zona kengligi). Shuning uchun qizil LED ~1,8 V da, ko‘k LED ~2,8 V da yona boshlaydi.</p>`);
  } else if (k === "rect") {
    p.push(rec.bridge ? "<p><b>Diod ko‘prigi</b>: musbat yarim davrda D1 va D4, manfiy yarim davrda D2 va D3 ochiq (sahnada yorishadi). Ikkala holatda ham yuklamadan tok bir xil yo‘nalishda o‘tadi — ikkala yarim to‘lqin ham ishlatiladi.</p>" : "<p><b>Bitta diod</b>: faqat musbat yarim davrda ochiq, manfiy yarim davrda tok o‘tmaydi. Yuklamada bir yo‘nalishli, lekin uzlukli (pulsatsiyalanuvchi) kuchlanish hosil bo‘ladi.</p>");
    p.push(rec.C ? `<p>Kondensator kuchlanish cho‘qqisida zaryadlanadi va diod yopiq paytda yuklama orqali sekin razryadlanadi — kuchlanish tekislanadi. C va R qancha katta bo‘lsa, pulsatsiya shuncha kichik (τ = RC = ${fmt(rec.R * rec.C * 1e-3, 0)} ms).</p>` : "<p>Pulsatsiyani kamaytirish uchun yuklamaga parallel kondensator (filtr) ulang. Elektronika qurilmalari quvvat bloklari aynan shunday ishlaydi.</p>");
  } else {
    p.push("<p><b>Tranzistor</b> — ikkita p–n o‘tishli asbob (n-p-n): emitter, baza (juda yupqa) va kollektor. Baza-emitter o‘tishi to‘g‘ri yo‘nalishda ulansa, emitterdan bazaga o‘tgan elektronlarning deyarli hammasi yupqa bazadan o‘tib, kollektorga yetadi. Kichik baza toki katta kollektor tokini boshqaradi: <b>I<sub>K</sub> = βI<sub>B</sub></b>.</p>");
    p.push("<p>Potensiometrni burang: baza kuchlanishi 0,65 V dan kichik bo‘lsa tranzistor <b>yopiq</b>, undan keyin kollektor toki baza tokiga proporsional (<b>kuchaytirish</b>), baza toki katta bo‘lsa — <b>to‘yinish</b>: lampa to‘liq yonadi, tranzistor yopiq yoki ochiq <b>kalit</b> kabi ishlaydi. Kompyuter mikrosxemalarida milliardlab tranzistorlar aynan kalit sifatida ishlaydi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
const FORMULA = { thermo: "<small>Qarshilik</small> metall: R = R₀(1 + αΔt)", photo: "<small>Yoritilganlik</small> E = I/r²", lat: "<small>O‘tkazuvchanlik</small> σ = e(nμₙ + pμₚ)", vax: "<small>Diod</small> I = Iₛ(e^(eU/kT) − 1)", rect: "<small>To‘g‘rilagich</small> U = 2Uₘ/π", tr: "<small>Tranzistor</small> Iₖ = β·I(baza)" };
function updateFormula() { const html = FORMULA[kind()]; const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); syncTools(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  dt = Math.min(dt, 0.05); anim += dt;
  const k = kind();
  if (k === "thermo") stepRT(dt * ui.speed);
  else if (k === "lat") stepLat(dt);
  else if (k === "rect") rec.ph = (rec.ph + dt * 0.5) % 2;
  stage.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; updateReadouts(); updateStatus(); if (k === "thermo" || k === "rect") graph.render(); if (k === "thermo" || k === "lat") updateExplain(); }
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
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || defaultFor(), false));
document.querySelectorAll("[data-speed-value]").forEach((b) => b.addEventListener("click", () => { ui.speed = Number(b.dataset.speedValue); syncSpeed(); refresh(); }));
const syncSpeed = () => document.querySelectorAll("[data-speed-value]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.speedValue) === ui.speed)));

/* ------------------------------------------------------------------ Boshqaruv */

// 1) Qarshilik
const HL = bindRange($("#hL"), $("#hLOut"), (v) => `${fmt(v, 0)} %`, (v) => { rt.level = v / 100; customized(); refresh(); });
const PD = bindRange($("#pD"), $("#pDOut"), (v) => `${fmt(v, 0)} cm`, (v) => { rt.d = v; customized(); refresh(); });
const roomSel = $("#pRoom");
roomSel.addEventListener("change", () => { rt.room = Number(roomSel.value); customized(); refresh(); });
$("[data-heat]").addEventListener("click", () => { rt.heat = !rt.heat; customized(); refresh(); if (!prefersReducedMotion()) loop.start(); });
$("[data-lamp]").addEventListener("click", () => { rt.lampOn = !rt.lampOn; customized(); refresh(); });
function syncRT() { HL.set(Math.round(rt.level * 100)); PD.set(rt.d); roomSel.value = String(rt.room); }

// 2) Panjara
const matSel = $("#lM");
matSel.addEventListener("change", () => { lat.mat = matSel.value; resetLattice(dopIdx()); customized(); refresh(); });
const LN = bindRange($("#lN"), $("#lNOut"), (v) => `${fmt(10 ** (v - Math.floor(v)), 1)}·${p10(Math.floor(v))} m⁻³`, (v) => { lat.logN = v; customized(); refresh(); });
const LT = bindRange($("#lT"), $("#lTOut"), (v) => `${fmt(v, 0)} K (${fmt(v - P.T0, 0)} °C)`, (v) => { lat.T = v; customized(); refresh(); });
const DEF_DOP = [11, 24, 33];
const dopIdx = () => lat.atoms.map((a, i) => (a !== "s" ? i : -1)).filter((i) => i >= 0);
document.querySelectorAll("[data-dope-value]").forEach((b) => b.addEventListener("click", () => { if (lat.dope === b.dataset.dopeValue) return; lat.dope = b.dataset.dopeValue; resetLattice(lat.dope === "i" ? [] : DEF_DOP); customized(); syncLat(); refresh(); }));
$("[data-field]").addEventListener("click", () => { lat.field = !lat.field; customized(); refresh(); if (!prefersReducedMotion()) loop.start(); });
function syncLat() {
  matSel.value = lat.mat; LN.set(lat.logN); LT.set(lat.T);
  document.querySelectorAll("[data-dope-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dopeValue === lat.dope)));
  $("[data-dopectl]").hidden = lat.dope === "i";
}

// 3a) Diod
const dSel = $("#dType");
dSel.innerHTML = Object.entries(P.DIODES).map(([id, d]) => `<option value="${id}">${d.name}</option>`).join("");
const DE = bindRange($("#dE"), $("#dEOut"), (v) => `${fmt(v, 2)} V`, (v) => { dio.E = v; customized(); refresh(); });
const DT = bindRange($("#dT"), $("#dTOut"), (v) => `${fmt(v, 0)} °C`, (v) => { dio.T = v; customized(); refresh(); });
dSel.addEventListener("change", () => { dio.type = dSel.value; dio.pts = []; customized(); refresh(); });
function setPol(p) { if (dio.pol === p) return; dio.pol = p; dio.E = Math.min(dio.E, dEmax()); if (p < 0 && dio.E < 1) dio.E = 10; customized(); syncDio(); refresh(); }
document.querySelectorAll("[data-pol-value]").forEach((b) => b.addEventListener("click", () => setPol(Number(b.dataset.polValue))));
$("[data-rec]").addEventListener("click", () => { const r = dCirc(); dio.pts.push({ U: r.U, I: r.I }); dio.pts.sort((a, b) => a.U - b.U); flashUntil = 0; refresh(); });
$("[data-clear]").addEventListener("click", () => { dio.pts = []; refresh(); });
function syncDio() {
  dSel.value = dio.type; const inp = $("#dE"); inp.max = String(dEmax()); inp.step = dio.pol < 0 ? "0.1" : "0.01"; DE.set(dio.E); DT.set(dio.T);
  document.querySelectorAll("[data-pol-value]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.polValue) === dio.pol)));
}

// 3b) To'g'rilagich
const rcSel = $("#rC");
rcSel.addEventListener("change", () => { rec.C = Number(rcSel.value); recCalc(); customized(); refresh(); });
const RR = bindRange($("#rR"), $("#rROut"), (v) => `${fmt(v, 0)} Ω`, (v) => { rec.R = v; recCalc(); customized(); refresh(); });
document.querySelectorAll("[data-rk-value]").forEach((b) => b.addEventListener("click", () => { rec.bridge = b.dataset.rkValue === "bridge"; recCalc(); customized(); syncRec(); refresh(); }));
function syncRec() { rcSel.value = String(rec.C); RR.set(rec.R); document.querySelectorAll("[data-rk-value]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.rkValue === "bridge") === rec.bridge))); }

// 3c) Tranzistor
const TU = bindRange($("#tU"), $("#tUOut"), (v) => `${fmt(v, 2)} V`, (v) => { trs.U = v; customized(); refresh(); });
const rbSel = $("#tRb");
rbSel.addEventListener("change", () => { trs.Rb = Number(rbSel.value); customized(); refresh(); });
function syncTr() { TU.set(trs.U); rbSel.value = String(trs.Rb); }

function syncTools() {
  const k = kind();
  $("[data-heat]").textContent = rt.heat ? "Plitkani o‘chirish" : "Plitkani yoqish";
  $("[data-lamp]").textContent = rt.lampOn ? "Lampani o‘chirish" : "Lampani yoqish";
  const fb = $("[data-field]"); fb.textContent = lat.field ? "Batareyani uzish" : "Batareyani ulash"; fb.setAttribute("aria-pressed", String(lat.field));
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = el.dataset.tool !== k; });
}

/* ------------------------------------------------------------------ Sahnada boshqarish */

const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); };
const inBox = (p, b) => b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
const near = (p, h, extra = 0) => h && dist(p.x, p.y, h.x, h.y) <= h.r + extra;
const POT_C = { x: 66, y: 140 };
const angF = (p, h) => { const a = ((Math.atan2(p.y - h.y, p.x - h.x) / DEG + 90 + 135 + 720) % 360) / 270; return a > 1 ? (a < 1 + 45 / 270 ? 1 : 0) : a; };
function hitTest(p) {
  const k = kind();
  if (k === "thermo") return near(p, hits.knob) ? { k: "heat" } : null;
  if (k === "photo") return near(p, hits.lamp) ? { k: "lamp" } : null;
  if (k === "lat") {
    if (inBox(p, hits.btn)) return { k: "btn" };
    for (let i = 0; i < LC * LR; i++) { const [x, y] = atomXY(i); if (dist(p.x, p.y, x, y) <= 13) return { k: "atom", i }; }
    return null;
  }
  if (k === "vax") { if (inBox(p, hits.pol)) return { k: "pol" }; return near(p, hits.knob, 4) ? { k: "knob" } : null; }
  if (k === "tr") return near(p, hits.pot) ? { k: "pot" } : null;
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  e.preventDefault();
  if (h.k === "btn") { lat.field = !lat.field; customized(); refresh(); if (!prefersReducedMotion()) loop.start(); return; }
  if (h.k === "atom") return toggleAtom(h.i);
  if (h.k === "pol") return setPol(-dio.pol);
  drag = { ...h, y0: p.y, x0: p.x, E0: dio.E, d0: rt.d, f: h.k === "heat" ? rt.level : h.k === "pot" ? trs.U / UCC : 0 };
  canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  if (h.k === "heat" || h.k === "pot") { drag.f = angF(p, h.k === "heat" ? hits.knob : POT_C); onDrag(p); }
});
function onDrag(p) {
  if (drag.k === "heat") { const f = angF(p, hits.knob || { x: 330, y: 268 }); if (Math.abs(f - drag.f) > 0.5) return; drag.f = f; rt.level = Math.round(f * 100) / 100; HL.set(Math.round(rt.level * 100)); }
  else if (drag.k === "pot") { const f = angF(p, POT_C); if (Math.abs(f - drag.f) > 0.5) return; drag.f = f; trs.U = Math.round(f * UCC * 100) / 100; TU.set(trs.U); }
  else if (drag.k === "lamp") { rt.d = clamp(Math.round(drag.d0 - (p.x - drag.x0) / PX_CM), 10, 80); PD.set(rt.d); }
  else if (drag.k === "knob") { const st = dio.pol < 0 ? 0.1 : 0.01; dio.E = clamp(Math.round((drag.E0 + ((drag.y0 - p.y) * dEmax()) / 120) / st) * st, 0, dEmax()); DE.set(dio.E); }
  customized(); refresh();
}
const CURSOR = { heat: "grab", lamp: "ew-resize", btn: "pointer", atom: "pointer", pol: "pointer", knob: "ns-resize", pot: "grab" };
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? CURSOR[h.k] : ""; return; } onDrag(p); });
function endDrag() { if (!drag) return; drag = null; canvas.dataset.dragging = "false"; refresh(); }
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const setThermo = (level, speed = 5, view = "R") => () => { ui.kind.rt = "thermo"; Object.assign(rt, { level, heat: true }); ui.speed = speed; ui.view.thermo = view; resetRT(); };
const setPhoto = (d, room, lampOn = true) => () => { ui.kind.rt = "photo"; Object.assign(rt, { d, room, lampOn }); };
const setLat = (mat, dope, T, field, logN = 21, dops = DEF_DOP, view = "n") => () => { Object.assign(lat, { mat, dope, T, field, logN }); ui.view.lat = view; resetLattice(dope === "i" ? [] : dops); };
const setVax = (type, pol, E, T = 20, pts = null) => () => { ui.kind.pn = "vax"; Object.assign(dio, { type, pol, E, T }); dio.pts = pts ? pts.map((U) => { const d = P.DIODES[type], c0 = P.diodeCircuit(d, U, R_LIM, T + P.T0); return { U: c0.U, I: c0.I }; }).sort((a, b) => a.U - b.U) : []; };
const setRec = (bridge, C, R = 100) => () => { ui.kind.pn = "rect"; Object.assign(rec, { bridge, C, R, ph: 0 }); recCalc(); };
const setTr = (U, Rb = 2000) => () => { ui.kind.pn = "tr"; Object.assign(trs, { U, Rb }); };
const PRESETS = {
  heat: { mode: "rt", title: "Qizdirish: metall va termorezistor", lesson: "Plitka to‘liq quvvatda. Multimetrlarni kuzating: misning qarshiligi sekin ortadi, termorezistorniki esa tez kamayadi. 100 °C da mis +34 %, termorezistor ~15 marta kichik.", set: setThermo(1, 5) },
  half: { mode: "rt", title: "Plitka 30 %: muvozanat", lesson: "Plitka 30 % quvvatda: suv ~57 °C gacha isiydi va shu temperaturada to‘xtaydi (keltirilgan va yo‘qotilgan issiqlik tenglashadi).", set: setThermo(0.3, 20) },
  lnR: { mode: "rt", title: "ln R(1/T) — energiyani topish", lesson: "«ln R(1/T)» grafigi ochiq: termorezistor nuqtalari to‘g‘ri chiziqda yotadi. Qiyalikdan E = 2kB ≈ 0,68 eV — bog‘ni uzish uchun kerak bo‘lgan energiya.", set: setThermo(1, 20, "ln") },
  photo: { mode: "rt", title: "Fotorezistor: 30 cm", lesson: "Lampani sahnada suring va multimetr ko‘rsatishini kuzating. Luksmetr yoritilganlikni o‘lchaydi; grafikda nuqta R(E) egri chizig‘i bo‘ylab siljiydi.", set: setPhoto(30, 150) },
  near: { mode: "rt", title: "Lampa yaqin: 10 cm", lesson: "10 cm da yoritilganlik ~8000 lk (quyoshli kunga yaqin): fotorezistor qarshiligi bir necha yuz omgacha kamaydi.", set: setPhoto(10, 150) },
  dark: { mode: "rt", title: "Qorong‘i xona", lesson: "Xona qorong‘i, lampa o‘chiq: fotorezistor qarshiligi ~1 MΩ ga yaqin. Lampani yoqing — qarshilik ming marta kamayadi. Ko‘cha chiroqlari shu tamoyilda o‘zi yonadi.", set: setPhoto(50, 0.3, false) },
  pure: { mode: "lat", title: "Sof kremniy, 300 K", lesson: "Xona temperaturasida bog‘larning juda oz qismi uzilgan: bir nechta elektron-kovak jufti. Sariq chaqnash — bog‘ uzildi (generatsiya), yashil — elektron kovakka tushdi (rekombinatsiya).", set: setLat("si", "i", 300, false) },
  hot: { mode: "lat", title: "Sof kremniy qizdirilgan", lesson: "T = 450 K (177 °C): juftlar soni ming martalab ortdi, o‘tkazuvchanlik keskin oshdi. «σ(T)» grafigini oching.", set: setLat("si", "i", 450, true, 21, DEF_DOP, "s") },
  ge: { mode: "lat", title: "Germaniy, 300 K", lesson: "Germaniyda taqiqlangan zona kichik (0,66 eV): xona temperaturasida ham juftlar kremniydagidan ~2000 marta ko‘p.", set: setLat("ge", "i", 300, true) },
  ntype: { mode: "lat", title: "n-tip: fosfor qo‘shilgan", lesson: "Uchta fosfor atomi: har biri bitta ortiqcha elektron beradi va musbat ionga aylanadi. Batareya ulangan — elektronlar «+» kontaktga oqadi. Boshqa atomlarni bosib, yana fosfor qo‘shing.", set: setLat("si", "n", 300, true) },
  ptype: { mode: "lat", title: "p-tip: bor qo‘shilgan", lesson: "Bor atomlari qo‘shni bog‘dan elektron oladi — kovaklar paydo bo‘ladi va maydon yo‘nalishida «−» kontaktga siljiydi. Aslida bog‘dan bog‘ga elektronlar sakraydi, kovak esa teskari tomonga ko‘chadi.", set: setLat("si", "p", 300, true) },
  vaxSi: { mode: "pn", title: "Kremniy diod VAX", lesson: "Laboratoriya ishi: manba kuchlanishini 0 dan 5 V gacha oshirib boring va har safar «Nuqtani yozish» ni bosing. So‘ng teskari yo‘nalishga o‘tib, 0–30 V da takrorlang. Bir nechta nuqta allaqachon yozilgan.", set: setVax("si", 1, 2, 20, [0.4, 0.6, 0.8, 1, 1.5, 2]) },
  vaxGe: { mode: "pn", title: "Germaniy diod: teskari tok", lesson: "Germaniy diod teskari ulangan: teskari tok mikroamperlarda — kremniydagidan ~1000 marta katta. Diod temperaturasini 60 °C ga oshiring: teskari tok 16 marta ortadi.", set: setVax("ge", -1, 10, 20, [-2, -5, -10, -20]) },
  led: { mode: "pn", title: "Yorug‘lik diodi", lesson: "Qizil LED: ~1,7 V dan keyin yona boshlaydi. Diod ro‘yxatidan yashil va ko‘k LEDni tanlang — ular kattaroq kuchlanishda yonadi, chunki ularning fotoni energiyasi katta (hν ≈ eU).", set: setVax("red", 1, 4) },
  rhalf: { mode: "pn", title: "Yarim davrli to‘g‘rilagich", lesson: "Bitta diod: faqat musbat yarim to‘lqinlar o‘tadi. Ossillografda sariq — kirish, ko‘k — chiqish. O‘rtacha kuchlanish Uₘ/π ga yaqin.", set: setRec(false, 0) },
  bridge: { mode: "pn", title: "Diod ko‘prigi + kondensator", lesson: "To‘liq davrli to‘g‘rilagich 1000 μF filtr bilan: chiqishda deyarli o‘zgarmas kuchlanish (~15 V). Kondensatorni ajrating va farqni ko‘ring.", set: setRec(true, 1000) },
  trAmp: { mode: "pn", title: "Tranzistor: kuchaytirish", lesson: "Baza toki ~0,4 mA, kollektor toki β = 160 marta katta (~68 mA): lampa xira yonadi. Potensiometrni sekin burab, ikkala ampermetrni solishtiring.", set: setTr(1.5) },
  trSwitch: { mode: "pn", title: "Tranzistor: kalit", lesson: "Potensiometr 0 da — tranzistor yopiq, lampa o‘chiq. Uni oxirigacha burang: tranzistor to‘yinadi va lampa to‘liq yonadi. Kichik baza toki katta tokni yoqib-o‘chiradi.", set: setTr(0) },
};
const GROUPS = [["Metall va yarimo‘tkazgich", ["heat", "half", "lnR", "photo", "near", "dark"]], ["O‘tkazuvchanlik", ["pure", "hot", "ge", "ntype", "ptype"]], ["Diod va tranzistor", ["vaxSi", "vaxGe", "led", "rhalf", "bridge", "trAmp", "trSwitch"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { thermo: "Plitka dastasini aylantiring", photo: "Lampani optik skamya bo‘ylab suring", lat: "Atomni bosing — aralashma qo‘shing; kalitni bosing", vax: "Manba dastasini suring, qutb almashtirgichni bosing", rect: "Kondensator va diod ko‘prigini tanlang", tr: "Potensiometr dastasini aylantiring" };
const KIND_DEFAULT = { thermo: "heat", photo: "photo", vax: "vaxSi", rect: "rhalf", tr: "trAmp" };
const MODE_DEFAULT = { rt: "heat", lat: "ntype", pn: "vaxSi" };
const defaultFor = () => (ui.mode === "lat" ? MODE_DEFAULT.lat : KIND_DEFAULT[ui.kind[ui.mode]]);
function setModeUI() {
  const k = kind();
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-kind-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kindValue === k)));
  document.querySelectorAll("[data-kctl]").forEach((el) => { el.hidden = el.dataset.kctl !== k; });
  $("[data-mode-hint]").textContent = MODE_HINT[k];
  setTabs();
}
document.querySelectorAll("[data-kind-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.kindValue !== kind()) loadPreset(KIND_DEFAULT[b.dataset.kindValue]); }));
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { const m = b.dataset.modeValue; if (m !== ui.mode) loadPreset(m === "lat" ? MODE_DEFAULT.lat : KIND_DEFAULT[ui.kind[m]] || MODE_DEFAULT[m]); }));
function loadPreset(id, mark = true) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; ui.hover = null; flashUntil = 0;
  p.set();
  if (!rec.res) recCalc();
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncRT(); syncLat(); syncDio(); syncRec(); syncTr(); syncSpeed(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  if (mark) { try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ } }
}

resetRT(); recCalc(); resetLattice([]);
setPlayUI(false);
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "heat");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });

// Node/Playwright tekshiruvi uchun
window.__semi = { rt, lat, dio, rec, trs, ui, loadPreset, refresh, stepRT, stepLat, dCirc, trCalc, kind, get drag() { return drag; } };
