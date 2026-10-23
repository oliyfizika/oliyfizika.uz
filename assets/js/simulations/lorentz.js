// ==========================================================================
// Magnit maydonda zaryadli zarra — virtual laboratoriya (simulations/lorentz.html)
// 1) Lorens kuchi: v ⊥ B — manba, v vektori uchi, maydon chegarasi sudraladi, B yo'nalishi bosib almashtiriladi;
//    aylana, davr tezlikka bog'liq emas; vint chiziq — v B ga α burchak ostida (qiya proyeksiya).
// 2) Mass-spektrometr: ion manbai, tezlatuvchi kuchlanish (dastak), tezlik selektori (E ⊥ B₁), yarim aylana,
//    fotoplastinkadagi dog'lar, o'lchagich bilan massani aniqlash.
// 3) Siklotron: duantlar, generator (chastota dastagi, rezonans), spiral, energiya W(N) grafigi.
// Fizika: lorentz-physics.js (Node'da tekshirilgan). Harakat sekinlashtirib ko'rsatiladi.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow, sci } from "./sim-kit.js";
import * as P from "./lorentz-physics.js";
import { frame, ticks, legend } from "./pendulum-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const LBL = "italic 700 13px Inter, system-ui, sans-serif";
const MEV = 1e6 * P.E;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "lor", show: { vec: true } };
// Zarralar uchun tayanch qiymatlar: r ≈ 6…10 cm, ko'rinadigan davr 3 s
const REF = { e: { v: 1e7, B: 1e-3 }, p: { v: 1e6, B: 0.1 }, a: { v: 5e5, B: 0.1 } };
const lor = { part: "p", view: "plane", kv: 1, kb: 1, Bs: 1, alpha: 60 * DEG, ys: 0, th: 0, xB: 18, p: null, v: null, t: 0, trail: [], wait: 0, inField: false, turns: 0 };
const MS = {
  H: { label: "H, D, T", iso: [["¹H", 1.00783], ["²H (D)", 2.0141], ["³H (T)", 3.01605]] },
  C: { label: "¹²C, ¹³C", iso: [["¹²C", 12], ["¹³C", 13.00335]] },
  Ne: { label: "²⁰Ne, ²²Ne", iso: [["²⁰Ne", 19.99244], ["²²Ne", 21.99139]] },
  Cl: { label: "³⁵Cl, ³⁷Cl", iso: [["³⁵Cl", 34.96885], ["³⁷Cl", 36.9659]] },
};
const ISO_COL = ["#2563eb", "#dc2626", "#16a34a"];
const B1 = 0.1, SEL_L = 0.08, SEL_HALF = 0.0005;
const ms = { set: "Ne", U: 1000, B: 0.2, sel: false, Ef: 9800, ions: [], hits: [], emit: 0, ruler: 20, seq: 0 };
const CYC_R = 0.25;
const cyc = { part: "p", B: 1, U0: 100e3, fgen: 0, p: [0, 0], v: [0, 0], W: 0, t: 0, k: 0, out: false, trail: [], hist: [], wait: 0, done: false };
let presetId = null;
const geo = {};

const part = (k) => P.PARTICLES[k];
const lorV = () => REF[lor.part].v * lor.kv, lorB = () => REF[lor.part].B * lor.kb;
const lorK = () => P.period(part(lor.part).m, part(lor.part).q, REF[lor.part].B) / 3; // real s / ko'rinadigan s
const cycFc = () => P.cycFreq(part(cyc.part).m, part(cyc.part).q, cyc.B);
const cycK = () => P.period(part(cyc.part).m, part(cyc.part).q, 1) / 0.8;
const fmtB = (B) => (B < 0.01 ? `${fmt(B * 1000, 2)} mT` : `${fmt(B, 3)} T`);
const fmtV = (v) => `${sci(v, 3)} m/s`;

/* ------------------------------------------------------------------ Dunyo → ekran */

const view = { s: 1, ox: 0, oy: 0, x0: 0, y1: 0 };
function fit(cw, ch, x0, x1, y0, y1, pad = 6) {
  const s = Math.min((cw - 2 * pad) / (x1 - x0), (ch - 2 * pad) / (y1 - y0));
  view.s = s; view.ox = (cw - (x1 - x0) * s) / 2; view.oy = (ch - (y1 - y0) * s) / 2; view.x0 = x0; view.y1 = y1;
}
const SX = (x) => view.ox + (x - view.x0) * view.s;
const SY = (y) => view.oy + (view.y1 - y) * view.s;
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s + view.x0, y: view.y1 - (py - view.oy) / view.s });

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); }
function tagIn(ctx, text, x, y, cw, o) {
  ctx.save(); ctx.font = o.font || MID; const w = ctx.measureText(text).width + 2 * (o.pad ?? 6); ctx.restore();
  let x0 = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  x0 = clamp(x0, 4, cw - 4 - w); tag(ctx, text, x0, y, { ...o, align: "left" });
}
/** B belgisi: ⊙ (ekrandan bizga) yoki ⊗ (ekranga). */
function bSym(ctx, x, y, r, out, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 1; circle(ctx, x, y, r); ctx.stroke();
  if (out) { ctx.fillStyle = col; circle(ctx, x, y, r * 0.3); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.moveTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x - r * 0.6, y + r * 0.6); ctx.stroke(); }
}
function particle(ctx, x, y, q, r = 7) {
  ctx.fillStyle = q > 0 ? "#dc2626" : "#2563eb"; circle(ctx, x, y, r); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.round(r * 1.5)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(q > 0 ? "+" : "−", x, y + 0.5);
}
/** Aylantiriladigan dastak (sahnadagi boshqaruv): frac 0…1 (270°). */
function knob(ctx, c, x, y, r, frac, label, val) {
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.border; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, 405 * DEG); ctx.stroke();
  ctx.strokeStyle = c.primary; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, (135 + 270 * frac) * DEG); ctx.stroke();
  const a = (135 + 270 * frac) * DEG; ctx.strokeStyle = c.text; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3)); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(label, x, y + r + 8);
  if (val) { ctx.fillStyle = c.text; ctx.font = MID; ctx.fillText(val, x, y + r + 20); }
}
function chipBtn(ctx, c, x, y, text, { fill, color, w } = {}) {
  ctx.font = BOLD; const ww = w || ctx.measureText(text).width + 16;
  ctx.fillStyle = fill || c.bg; ctx.strokeStyle = color || c.primary; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x - ww / 2, y - 12, ww, 24, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color || c.primary; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y + 0.5);
  return { x0: x - ww / 2, x1: x + ww / 2, y0: y - 12, y1: y + 12 };
}

/* ================================================================== 1) Lorens kuchi (v ⊥ B) */

const LOR_H = 13; // dunyo: y ∈ [−13, 13] cm
function launchLor() {
  const v = lorV() * 100; // cm/s (real)
  const len = 2.4; // manba stvoli uzunligi, cm
  lor.p = [2 + Math.cos(lor.th) * len, lor.ys + Math.sin(lor.th) * len];
  lor.v = [Math.cos(lor.th) * v, Math.sin(lor.th) * v];
  lor.t = 0; lor.trail = [lor.p.slice()]; lor.wait = 0; lor.turns = 0; lor.ang = 0;
  if (lor.view === "helix") { lor.hx = { t: 0 }; lor.trail = []; }
}
function drawLorPlane(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, s = Math.min((ch - 16) / (2 * LOR_H), cw / 44), W = cw / s;
  view.s = s; view.ox = 0; view.oy = (ch - 2 * LOR_H * s) / 2; view.x0 = 0; view.y1 = LOR_H;
  const pr = part(lor.part), out = lor.Bs > 0, B = lorB(), xB = clamp(lor.xB, 0, W - 2);
  geo.lor = { W };
  // maydon sohasi
  ctx.fillStyle = c.dark ? "rgba(124,58,237,0.10)" : "rgba(124,58,237,0.06)"; ctx.fillRect(SX(xB), 0, cw - SX(xB), ch);
  const step = 2.5;
  for (let x = Math.ceil(xB / step) * step + step / 2; x < W; x += step) for (let y = -LOR_H + step / 2; y < LOR_H; y += step) bSym(ctx, SX(x), SY(y), 4, out, c.dark ? "rgba(196,181,253,0.55)" : "rgba(124,58,237,0.45)");
  ctx.strokeStyle = c.special; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(SX(xB), 0); ctx.lineTo(SX(xB), ch); ctx.stroke(); ctx.setLineDash([]);
  // chegara dastagi
  const hy = ch - 22; ctx.fillStyle = c.special; ctx.beginPath(); ctx.roundRect(SX(xB) - 6, hy - 12, 12, 24, 4); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(SX(xB) - 2, hy - 6); ctx.lineTo(SX(xB) - 2, hy + 6); ctx.moveTo(SX(xB) + 2, hy - 6); ctx.lineTo(SX(xB) + 2, hy + 6); ctx.stroke();
  geo.lor.edge = { x0: SX(xB) - 10, x1: SX(xB) + 10, y0: 0, y1: ch };
  // B yo'nalishi tugmasi
  const nb = cw < 560;
  geo.lor.bbtn = chipBtn(ctx, c, cw - (nb ? 62 : 92), nb ? 46 : 18, out ? "⊙ B — bizga" : "⊗ B — ekranga", { color: c.special, w: nb ? 110 : 160 });
  tag(ctx, `B = ${fmtB(B)}`, cw - (nb ? 62 : 92), nb ? 72 : 44, { color: c.special, bg: c.bg, align: "center", font: BOLD });
  // iz
  if (lor.trail.length > 1) { ctx.strokeStyle = pr.q > 0 ? "rgba(220,38,38,0.75)" : "rgba(37,99,235,0.75)"; ctx.lineWidth = 2; ctx.beginPath(); lor.trail.forEach(([x, y], i) => (i ? ctx.lineTo(SX(x), SY(y)) : ctx.moveTo(SX(x), SY(y)))); ctx.stroke(); }
  // manba (stvol)
  const gx = SX(2), gy = SY(lor.ys), L = 2.4 * s;
  ctx.save(); ctx.translate(gx, gy); ctx.rotate(-lor.th);
  ctx.fillStyle = c.text2; ctx.beginPath(); ctx.roundRect(-10, -9, 14, 18, 3); ctx.fill(); ctx.fillStyle = c.text; ctx.fillRect(2, -4, L - 2, 8);
  ctx.restore();
  tagIn(ctx, pr.name.toLowerCase() + " manbai", gx, gy + 22, cw, { color: c.text3, bg: c.bg, align: "center", font: SMALL, pad: 3 });
  geo.lor.gun = { x: gx, y: gy, r: 13 };
  // otish vektori (sudraladi)
  const kv = 3.2 * s, lx = gx + Math.cos(lor.th) * (L + 4), ly = gy - Math.sin(lor.th) * (L + 4), tx = lx + Math.cos(lor.th) * lor.kv * kv, ty = ly - Math.sin(lor.th) * lor.kv * kv;
  ctx.save(); ctx.globalAlpha = 0.55; arrow(ctx, lx, ly, tx - lx, ty - ly, c.primary, { width: 2, head: 9, dash: [5, 3] }); ctx.restore();
  ctx.fillStyle = c.primary; circle(ctx, tx, ty, 4); ctx.fill();
  geo.lor.tip = { x: tx, y: ty, r: 12, ox: lx, oy: ly };
  // zarra
  if (lor.p) {
    const px = SX(lor.p[0]), py = SY(lor.p[1]), sp = Math.hypot(lor.v[0], lor.v[1]), ux = lor.v[0] / sp, uy = -lor.v[1] / sp;
    if (ui.show.vec) {
      arrow(ctx, px, py, ux * lor.kv * kv, uy * lor.kv * kv, c.primary, { width: 2.6, head: 10, label: "v", font: LBL });
      if (lor.inField) {
        // F = q v × B: B ⊙ (+z): v×z = (vy, −vx)
        const sg = Math.sign(pr.q) * lor.Bs, fx = sg * (lor.v[1] / sp), fy = sg * (-lor.v[0] / sp), Lf = (1.4 + 1.6 * lor.kv * lor.kb) * s;
        arrow(ctx, px, py, fx * Lf, -fy * Lf, c.danger, { width: 2.6, head: 10, label: "F", font: LBL });
      }
    }
    particle(ctx, px, py, pr.q);
  }
  tag(ctx, `${pr.name}: q = ${pr.q > 0 ? "+" : "−"}${fmt(Math.abs(pr.q) / P.E, 0)}e, m = ${sci(pr.m, 3)} kg`, 8, 14, { color: c.text2, bg: c.bg2, font: SMALL });
  tag(ctx, `harakat ~${sci(1 / lorK(), 2)} marta sekinlashtirilgan`, 8, ch - 14, { color: c.text3, bg: c.bg2, font: SMALL });
}
function stepLorPlane(dt) {
  if (!lor.p) launchLor();
  const pr = part(lor.part), W = (geo.lor && geo.lor.W) || 60;
  if (lor.wait > 0) { lor.wait -= dt; if (lor.wait <= 0) launchLor(); return; }
  const h = dt * lorK(), n = 24, hh = h / n, Bz = lor.Bs * lorB(), xB = lor.xB;
  for (let i = 0; i < n; i++) {
    const inF = lor.p[0] >= xB;
    if (inF) { const r = P.stepPlane([lor.p[0] / 100, lor.p[1] / 100], [lor.v[0] / 100, lor.v[1] / 100], hh, pr.q, pr.m, Bz); lor.p = [r.p[0] * 100, r.p[1] * 100]; lor.v = [r.v[0] * 100, r.v[1] * 100]; lor.ang += (Math.abs(pr.q * Bz) / pr.m) * hh; }
    else { lor.p = [lor.p[0] + lor.v[0] * hh, lor.p[1] + lor.v[1] * hh]; }
    lor.inField = lor.p[0] >= xB;
  }
  lor.t += h; lor.turns = lor.ang / TAU;
  const last = lor.trail[lor.trail.length - 1];
  if (Math.hypot(lor.p[0] - last[0], lor.p[1] - last[1]) > 0.15) { lor.trail.push(lor.p.slice()); if (lor.trail.length > 1500) lor.trail.shift(); }
  if (lor.p[0] < -1 || lor.p[0] > W + 1 || Math.abs(lor.p[1]) > LOR_H + 1) lor.wait = 0.6;
}

/* ------------------------------------------------------------------ Vint chiziq */

const HX = { k: 0.6 }; // qiya proyeksiya: z o'qi pastga-chapga
const PJ = (x, y, z) => [SX(x - HX.k * 0.7071 * z), SY(y - HX.k * 0.7071 * z)];
function drawLorHelix(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, s = Math.min((ch - 16) / (2 * LOR_H), cw / 44), W = cw / s;
  const pr = part(lor.part), B = lorB(), hl = P.helix(pr.m, lorV(), pr.q, B, lor.alpha), r = hl.r * 100, x0 = 4;
  view.s = s; view.ox = 0; view.oy = (ch - 2 * LOR_H * s) / 2; view.x0 = 0; view.y1 = LOR_H + HX.k * 0.7071 * Math.min(r, 12);
  geo.lor = { W };
  // maydon chiziqlari (B — o'ngga)
  ctx.strokeStyle = c.dark ? "rgba(196,181,253,0.5)" : "rgba(124,58,237,0.4)"; ctx.lineWidth = 1;
  for (const [y, z] of [[-8, 0], [0, 0], [8, 0], [-4, -10], [4, -10], [-4, 10], [4, 10]]) {
    const a = PJ(0, y, z), b = PJ(W, y, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    for (let x = 10; x < W; x += 16) { const p = PJ(x, y, z); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(p[0] + 6, p[1]); ctx.lineTo(p[0] - 2, p[1] - 4); ctx.lineTo(p[0] - 2, p[1] + 4); ctx.fill(); }
  }
  tag(ctx, `B = ${fmtB(B)} →`, cw - 70, cw < 560 ? 40 : 18, { color: c.special, bg: c.bg, align: "center", font: BOLD });
  // o'q (helix o'qi)
  const zc = -(Math.sign(pr.q) || 1) * r; // vint o'qi (y = 0, z = zc)
  ctx.save(); ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); const a0 = PJ(x0, 0, zc), a1 = PJ(W, 0, zc); ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke(); ctx.restore();
  // boshlang'ich kesim — proyeksiyadagi aylana (ellips)
  ctx.save(); ctx.strokeStyle = c.text3; ctx.globalAlpha = 0.6; ctx.beginPath(); for (let i = 0; i <= 60; i++) { const ph = (TAU * i) / 60, q = PJ(x0, r * Math.sin(ph), zc + r * Math.cos(ph)); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke(); ctx.restore();
  // to'liq vint (oldindan, xira) va izi
  const Om = (pr.q * B) / pr.m, vl = hl.vl * 100, vp = hl.vp * 100, k = lorK();
  const pos = (t) => { const ph = Om * t; return [x0 + vl * t, (vp / Om) * Math.sin(ph), (vp / Om) * (Math.cos(ph) - 1)]; };
  const tEnd = (W - x0 - 2) / Math.max(vl, 1e-9);
  ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = pr.q > 0 ? "#dc2626" : "#2563eb"; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = 0; i <= 600; i++) { const t = Math.min(tEnd, (6 * hl.T) * (i / 600)); const [x, y, z] = pos(t); const q = PJ(x, y, z); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
  ctx.stroke(); ctx.restore();
  const tt = lor.hx ? lor.hx.t : 0;
  // izi: o'qdan orqadagi qismi xira (chuqurlik)
  ctx.strokeStyle = pr.q > 0 ? "#dc2626" : "#2563eb"; ctx.lineWidth = 2.2;
  const nTr = 360; let prev = null;
  for (let i = 0; i <= nTr; i++) { const t = (tt * i) / nTr; const [x, y, z] = pos(t); const q = PJ(x, y, z); if (prev) { ctx.globalAlpha = z < zc ? 0.35 : 1; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); } prev = q; }
  ctx.globalAlpha = 1;
  // qadam o'lchovi
  if (vl > 1e-6 && x0 + vl * hl.T < W - 2) {
    const ya = -Math.min(LOR_H - 1.5, 2 * r + 1.5), p1 = PJ(x0, ya, 0), p2 = PJ(x0 + vl * hl.T, ya, 0);
    ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.moveTo(p1[0], p1[1] - 4); ctx.lineTo(p1[0], p1[1] + 4); ctx.moveTo(p2[0], p2[1] - 4); ctx.lineTo(p2[0], p2[1] + 4); ctx.stroke();
    tag(ctx, `qadam h = ${fmt(vl * hl.T, 1)} cm`, (p1[0] + p2[0]) / 2, p1[1] + 13, { color: c.text, bg: c.bg, align: "center", font: MID });
  }
  // boshlang'ich v (sudraladi)
  const o = PJ(x0, 0, 0), kv = 3.2 * s, tip = [o[0] + Math.cos(lor.alpha) * lor.kv * kv, o[1] - Math.sin(lor.alpha) * lor.kv * kv];
  ctx.save(); ctx.globalAlpha = 0.55; arrow(ctx, o[0], o[1], tip[0] - o[0], tip[1] - o[1], c.primary, { width: 2, head: 9, dash: [5, 3] }); ctx.restore();
  ctx.fillStyle = c.primary; circle(ctx, tip[0], tip[1], 4); ctx.fill();
  geo.lor.htip = { x: tip[0], y: tip[1], r: 12, ox: o[0], oy: o[1], kv };
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(o[0], o[1], 26, -lor.alpha, 0); ctx.stroke();
  tag(ctx, `α = ${fmt(lor.alpha / DEG, 0)}°`, o[0] + 36, o[1] - 12, { color: c.text2, bg: c.bg, font: MID, pad: 3 });
  // zarra va vektorlar
  const [x, y, z] = pos(tt), q = PJ(x, y, z), ph = Om * tt;
  if (ui.show.vec) {
    const vx = vl, vy = vp * Math.cos(ph), vz = -vp * Math.sin(ph), sp = Math.hypot(vx, vy, vz) || 1, L = lor.kv * kv;
    const e = PJ(x + (vx / sp) * L / s, y + (vy / sp) * L / s, z + (vz / sp) * L / s);
    arrow(ctx, q[0], q[1], e[0] - q[0], e[1] - q[1], c.primary, { width: 2.4, head: 9, label: "v", font: LBL });
    // F ⟂ B: markazga (o'qqa) qarab
    const fy = -Math.sin(ph), fz = -Math.cos(ph), Lf = 4;
    const f = PJ(x, y + fy * Lf * Math.sign(Om), z + fz * Lf * Math.sign(Om)); void f;
    const cy = 0, cz = -(vp / Om), dy = cy - y, dz = cz - z, dl = Math.hypot(dy, dz) || 1, fe = PJ(x, y + (dy / dl) * Lf, z + (dz / dl) * Lf);
    arrow(ctx, q[0], q[1], fe[0] - q[0], fe[1] - q[1], c.danger, { width: 2.4, head: 9, label: "F", font: LBL });
  }
  particle(ctx, q[0], q[1], pr.q);
  tag(ctx, `${pr.name}: vint chiziq — radius ${fmt(r, 1)} cm, davr T = ${sci(hl.T, 3)} s`, 8, 14, { color: c.text2, bg: c.bg2, font: SMALL });
  void W;
}
function stepLorHelix(dt) {
  if (!lor.hx) lor.hx = { t: 0 };
  const pr = part(lor.part), hl = P.helix(pr.m, lorV(), pr.q, lorB(), lor.alpha), W = (geo.lor && geo.lor.W) || 60;
  lor.hx.t += dt * lorK();
  if (4 + hl.vl * 100 * lor.hx.t > W - 2 || lor.hx.t > 8 * hl.T) lor.hx.t = 0;
}

/* ================================================================== 2) Mass-spektrometr */

function msIons() { return MS[ms.set].iso.map(([n, A], i) => { const m = A * P.AMU, v = P.speedFromU(m, P.E, ms.U), r = P.msRadius(m, P.E, ms.U, ms.B); let pass = true, xHit = null, sh = 0; if (ms.sel) { sh = P.selectorShift(m, P.E, v, ms.Ef, B1, SEL_L); if (Math.abs(sh) > SEL_HALF) { pass = false; xHit = Math.sqrt(SEL_HALF / Math.abs(sh)); } } return { n, A, m, v, r, pass, xHit, sh, col: ISO_COL[i] }; }); }
const MSW = { x0: -27, x1: 14, y0: -24, y1: 3 }; // cm; tirqish (0, 0), maydon x ≥ 0, plastinka x = 0, y < 0
function drawMS(ctx, st) {
  const { w: cw, h: ch, colors: c } = st;
  fit(cw, ch, MSW.x0, MSW.x1, MSW.y0 - 1, MSW.y1 + 1.5, 8);
  const s = view.s, ions = msIons();
  geo.ms = {};
  // maydon sohasi
  ctx.fillStyle = c.dark ? "rgba(124,58,237,0.10)" : "rgba(124,58,237,0.06)"; ctx.fillRect(SX(0), SY(MSW.y1), SX(MSW.x1) - SX(0), SY(MSW.y0) - SY(MSW.y1));
  for (let x = 1.25; x < MSW.x1; x += 2.5) for (let y = MSW.y1 - 1.25; y > MSW.y0; y -= 2.5) bSym(ctx, SX(x), SY(y), 3.5, true, c.dark ? "rgba(196,181,253,0.5)" : "rgba(124,58,237,0.4)");
  tag(ctx, `⊙ B = ${fmt(ms.B, 2)} T`, SX(MSW.x1) - 6, SY(MSW.y1) + 12, { color: c.special, bg: c.bg, align: "right", font: BOLD });
  // fotoplastinka va chizg'ich
  ctx.fillStyle = c.dark ? "#475569" : "#334155"; ctx.fillRect(SX(-0.7), SY(-0.35), 0.7 * s, (MSW.y0 + 0.35) * -s);
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let d = 0; d <= -MSW.y0 - 0.5; d += 1) { const y = SY(-d); ctx.beginPath(); ctx.moveTo(SX(-0.7), y); ctx.lineTo(SX(-0.7) - (d % 5 ? 4 : 8), y); ctx.stroke(); if (d % 5 === 0 && d) ctx.fillText(`${d}`, SX(-0.7) - 10, y); }
  ctx.textAlign = "center"; ctx.fillText("cm", SX(-0.7) - 14, SY(MSW.y0) + 2);
  // dog'lar (gistogramma)
  const bins = {}; ms.hits.forEach((h) => { const k = Math.round(h.d * 10); bins[k] = bins[k] || { n: 0, col: h.col }; bins[k].n++; });
  Object.entries(bins).forEach(([k, b]) => { const y = SY(-k / 10); ctx.fillStyle = b.col; ctx.fillRect(SX(0.05), y - 1.5, Math.min(40, 2 + b.n * 1.2), 3); });
  // o'lchagich (sudraladi)
  const ry = SY(-ms.ruler);
  ctx.strokeStyle = c.warning; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(SX(-3.2), ry); ctx.lineTo(SX(1.5), ry); ctx.stroke();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.moveTo(SX(-3.2), ry - 7); ctx.lineTo(SX(-3.2) + 9, ry); ctx.lineTo(SX(-3.2), ry + 7); ctx.fill();
  const mMeas = P.massFromR(ms.ruler / 200, P.E, ms.U, ms.B) / P.AMU;
  tagIn(ctx, cw < 560 ? `d = ${fmt(ms.ruler, 1)} cm → ${fmt(mMeas, 2)} u` : `d = ${fmt(ms.ruler, 1)} cm → m = qB²(d/2)²/2U = ${fmt(mMeas, 2)} u`, SX(-3.6), ry, cw, { color: c.text, bg: c.bg, align: "right", font: MID });
  geo.ms.ruler = { x0: SX(-4), x1: SX(2), y0: ry - 9, y1: ry + 9 };
  // manba, tezlatuvchi, selektor, tirqish
  const yb = SY(0);
  ctx.fillStyle = c.text2; ctx.beginPath(); ctx.roundRect(SX(-26.5), yb - 0.9 * s, 3 * s, 1.8 * s, 4); ctx.fill();
  tag(ctx, "ion manbai", SX(-25), yb + 1.6 * s + 8, { color: c.text3, bg: c.bg, align: "center", font: SMALL, pad: 3 });
  ctx.strokeStyle = c.text; ctx.lineWidth = 3; [-22.5, -19.5].forEach((x) => { ctx.beginPath(); ctx.moveTo(SX(x), yb - 2 * s); ctx.lineTo(SX(x), yb - 0.25 * s); ctx.moveTo(SX(x), yb + 0.25 * s); ctx.lineTo(SX(x), yb + 2 * s); ctx.stroke(); });
  ctx.fillStyle = c.danger; ctx.font = BOLD; ctx.textAlign = "center"; ctx.fillText("+", SX(-22.5), yb - 2.4 * s); ctx.fillStyle = c.primary; ctx.fillText("−", SX(-19.5), yb - 2.4 * s);
  const ku = { x: SX(-21), y: yb + 4.3 * s };
  knob(ctx, c, ku.x, ku.y, 13, (ms.U - 200) / 2800, "U", `${fmt(ms.U, 0)} V`);
  geo.ms.knobU = { x: ku.x, y: ku.y, r: 18 };
  if (ms.sel) {
    const xs0 = -SEL_L * 100 - 4, xs1 = -4;
    // B₁ ⊙ da qvB₁ pastga, shuning uchun E yuqoriga (pastki plastinka +, yuqorigi −)
    ctx.fillStyle = c.primary; ctx.fillRect(SX(xs0), yb - 1.1 * s, (xs1 - xs0) * s, 0.35 * s); ctx.fillStyle = c.danger; ctx.fillRect(SX(xs0), yb + 0.75 * s, (xs1 - xs0) * s, 0.35 * s);
    ctx.font = BOLD; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillStyle = c.primary; ctx.fillText("−", SX(xs0) - 4, yb - 0.9 * s); ctx.fillStyle = c.danger; ctx.fillText("+", SX(xs0) - 4, yb + 0.9 * s);
    for (let x = xs0 + 1; x < xs1; x += 2) { arrow(ctx, SX(x), yb + 0.7 * s, 0, -1.3 * s, c.dark ? "#fca5a5" : "#f87171", { width: 1.2, head: 5 }); bSym(ctx, SX(x + 1), yb + 0.35 * s, 3, true, c.special); }
    tag(ctx, `selektor: E = ${fmt(ms.Ef / 1000, 1)} kV/m, B₁ = ${fmt(B1, 2)} T`, SX((xs0 + xs1) / 2), yb - 2.3 * s, { color: c.text2, bg: c.bg, align: "center", font: SMALL, pad: 3 });
    const ke = { x: SX((xs0 + xs1) / 2), y: yb + 4.3 * s };
    knob(ctx, c, ke.x, ke.y, 13, (ms.Ef / 1000 - 1) / 59, "E", `${fmt(ms.Ef / 1000, 1)} kV/m`);
    geo.ms.knobE = { x: ke.x, y: ke.y, r: 18 };
  }
  ctx.fillStyle = c.text; ctx.fillRect(SX(-0.25), SY(MSW.y1), 0.25 * s, SY(0.25) - SY(MSW.y1)); ctx.fillRect(SX(-0.25), SY(-0.25), 0.25 * s, SY(-0.35) - SY(-0.25));
  // nazariy yo'llar (xira) va ionlar
  ions.forEach((io) => {
    if (!io.pass) return;
    const r = io.r * 100;
    ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = io.col; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(SX(0), SY(-r), r * s, -Math.PI / 2, Math.PI / 2); ctx.stroke(); ctx.restore();
  });
  ms.ions.forEach((ion) => { const [x, y] = ion.pos; ctx.fillStyle = ion.col; circle(ctx, SX(x), SY(y), 3.2); ctx.fill(); });
  // afsona
  ions.forEach((io, i) => tagIn(ctx, `${io.n}: ${io.pass ? `2r = ${fmt(2 * io.r * 100, 2)} cm` : "selektorda to‘xtadi"}`, 8, ch - 14 - (ions.length - 1 - i) * 22, cw, { color: io.col, bg: c.bg2, font: MID }));
}
function msPath(ion, io, tvis) {
  // tvis — ko'rinadigan vaqt; ionning traektoriyasi (cm)
  const vv = ion.vs; // cm/s ko'rinadigan
  const xA = -21, xs0 = -SEL_L * 100 - 4;
  const sAcc = 3, tAcc = (2 * sAcc) / vv; // tezlatish: v 0 → vv
  let t = tvis;
  if (t < 0.3) return { pos: [-26 + t * 3, 0] };
  t -= 0.3;
  if (t < tAcc) return { pos: [-22.5 + 0.5 * (vv / tAcc) * t * t, 0] };
  t -= tAcc; let x = -19.5 + vv * t;
  if (x < 0) {
    if (ms.sel && x > xs0) { const u = (x - xs0) / (SEL_L * 100); if (!io.pass && u >= io.xHit) return { done: "plate", pos: [xs0 + io.xHit * SEL_L * 100, Math.sign(io.sh) * 0.75] }; const dy = io.pass ? 0 : Math.sign(io.sh) * 0.75 * (u / io.xHit) ** 2; return { pos: [x, dy] }; }
    if (ms.sel && !io.pass && x >= -4) return { done: "plate", pos: [-4, 0] };
    return { pos: [x, 0] };
  }
  const r = io.r * 100, ang = (x / r); // yoy uzunligi / r
  if (ang >= Math.PI) return { done: "hit", pos: [0, -2 * r] };
  return { pos: [r * Math.sin(ang), -r + r * Math.cos(ang)] };
}
function stepMS(dt) {
  const ions = msIons(), vmean = ions.reduce((a, b) => a + b.v, 0) / ions.length, kv = 14 / vmean;
  ms.emit -= dt;
  if (ms.emit <= 0 && ms.ions.length < 60) { ms.emit = 0.12; const i = ms.seq++ % ions.length; ms.ions.push({ i, t: 0, vs: ions[i].v * kv, col: ions[i].col, pos: [-26, 0] }); }
  ms.ions = ms.ions.filter((ion) => {
    ion.t += dt; const io = ions[ion.i]; if (!io) return false;
    const r = msPath(ion, io, ion.t); ion.pos = r.pos;
    if (r.done === "hit") { const d = 2 * io.r * 100 + (Math.random() - 0.5) * 0.15; if (d < -MSW.y0) ms.hits.push({ d, col: io.col }); if (ms.hits.length > 600) ms.hits.shift(); return false; }
    if (r.done === "plate") return false;
    if (ion.pos[0] > MSW.x1 + 1 || ion.pos[1] < MSW.y0 - 1) return false;
    return true;
  });
}

/* ================================================================== 3) Siklotron */

function resetCyc() {
  const pr = part(cyc.part);
  Object.assign(cyc, { p: [0, 0], W: 0, t: 0, k: 0, out: false, trail: [[0, 0]], hist: [], wait: 0, done: false });
  // birinchi o'tish t = 0 da: W = qU₀
  cyc.W = Math.max(P.gapGain(pr.q, cyc.U0, cyc.fgen, 0, 0), 0.05 * Math.abs(pr.q) * cyc.U0);
  const v = Math.sqrt((2 * cyc.W) / pr.m); cyc.v = [v, 0]; cyc.k = 1;
  cyc.hist.push({ n: 0, W: cyc.W / MEV });
}
function drawCyc(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560, pr = part(cyc.part);
  const genW = narrow ? 0 : Math.min(250, cw * 0.32), Rpx = Math.min((cw - genW - 30) / 2, (ch - 24) / 2), cx = 14 + Rpx + (narrow ? (cw - 28 - 2 * Rpx) / 2 : 0), cy = ch / 2, s = Rpx / (CYC_R * 1.04);
  view.s = s; geo.cyc = {};
  const X = (x) => cx + x * s, Y = (y) => cy - y * s, gap = 0.012 * s;
  // magnit qutblari (fon) va duantlar
  ctx.fillStyle = c.dark ? "rgba(124,58,237,0.10)" : "rgba(124,58,237,0.06)"; circle(ctx, cx, cy, Rpx + 6); ctx.fill();
  const Vnow = Math.cos(TAU * cyc.fgen * cyc.t), plus = (side) => (side > 0 ? Vnow < 0 : Vnow > 0), dee = (side) => (plus(side) ? "rgba(239,68,68,0.16)" : "rgba(37,99,235,0.16)"); // V = φ_chap − φ_o'ng
  [-1, 1].forEach((sd) => {
    ctx.fillStyle = dee(sd); ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2; ctx.beginPath();
    ctx.arc(cx + sd * gap, cy, CYC_R * s, sd > 0 ? -Math.PI / 2 : Math.PI / 2, sd > 0 ? Math.PI / 2 : (3 * Math.PI) / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.text2; ctx.font = BOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(plus(sd) ? "+" : "−", cx + sd * CYC_R * s * 0.55, cy - CYC_R * s * 0.75);
  });
  for (let x = -0.2; x <= 0.21; x += 0.08) for (let y = -0.2; y <= 0.21; y += 0.08) if (Math.hypot(x, y) < CYC_R * 0.95) bSym(ctx, X(x + 0.02), Y(y + 0.02), 3, true, c.dark ? "rgba(196,181,253,0.45)" : "rgba(124,58,237,0.35)");
  // iz
  if (cyc.trail.length > 1) { ctx.strokeStyle = c.danger; ctx.lineWidth = 1.6; ctx.beginPath(); cyc.trail.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke(); }
  // zarra
  particle(ctx, X(cyc.p[0]), Y(cyc.p[1]), pr.q, 6);
  if (ui.show.vec && !cyc.out) {
    const sp = Math.hypot(cyc.v[0], cyc.v[1]) || 1, L = 30, ux = cyc.v[0] / sp, uy = cyc.v[1] / sp;
    arrow(ctx, X(cyc.p[0]), Y(cyc.p[1]), ux * L, -uy * L, c.primary, { width: 2.2, head: 8, label: "v", font: LBL });
    if (Math.abs(cyc.p[0]) > 0.012) arrow(ctx, X(cyc.p[0]), Y(cyc.p[1]), uy * 22, ux * 22, c.danger, { width: 2.2, head: 8, label: "F", font: LBL });
  }
  tag(ctx, `⊙ B = ${fmt(cyc.B, 2)} T, R = ${fmt(CYC_R * 100, 0)} cm`, 8, 14, { color: c.special, bg: c.bg2, font: SMALL });
  tag(ctx, `W = ${fmt(cyc.W / MEV, 2)} MeV`, 8, ch - 14, { color: c.text, bg: c.bg2, font: BOLD });
  // generator
  const fc = cycFc(), fr = cyc.fgen / fc;
  if (!narrow) {
    const gx0 = cw - genW - 6, gx1 = cw - 8, gy0 = 30, gy1 = ch - 70;
    ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(gx0, gy0 - 22, gx1 - gx0, 210, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.text2; ctx.font = BOLD; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("Generator", gx0 + 10, gy0 - 8);
    // U(t) ekran
    const sx0 = gx0 + 10, sx1 = gx1 - 10, sy0 = gy0 + 4, sy1 = gy0 + 70, mid = (sy0 + sy1) / 2;
    ctx.fillStyle = "#0f172a"; ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    const Tc = 1 / fc, span = 3 * Tc, t1 = cyc.t;
    ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i <= 120; i++) { const t = t1 - span + (span * i) / 120, x = sx0 + ((sx1 - sx0) * i) / 120, y = mid - Math.cos(TAU * cyc.fgen * t) * (sy1 - sy0) * 0.4; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    // o'tish lahzalari
    (cyc.cross || []).forEach((tc) => { if (tc < t1 - span) return; const x = sx0 + ((tc - (t1 - span)) / span) * (sx1 - sx0); ctx.fillStyle = "#fbbf24"; circle(ctx, x, mid - Math.cos(TAU * cyc.fgen * tc) * (sy1 - sy0) * 0.4, 3); ctx.fill(); });
    ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "left"; ctx.fillText("U(t); sariq — tirqishdan o‘tish lahzalari", sx0, sy1 + 10);
    const kf = { x: gx0 + 36, y: sy1 + 50 };
    knob(ctx, c, kf.x, kf.y, 16, (fr - 0.8) / 0.4, "f", `${fmt(cyc.fgen / 1e6, 2)} MHz`);
    geo.cyc.knobF = { x: kf.x, y: kf.y, r: 22 };
    ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "left"; ctx.fillText(`f_c = qB/2πm = ${fmt(fc / 1e6, 2)} MHz`, gx0 + 72, sy1 + 36);
    ctx.fillStyle = Math.abs(fr - 1) < 0.003 ? c.success : c.danger; ctx.font = BOLD; ctx.fillText(Math.abs(fr - 1) < 0.003 ? "Rezonans ✓" : `farq ${fr > 1 ? "+" : "−"}${fmt(Math.abs(fr - 1) * 100, 1)}%`, gx0 + 72, sy1 + 54);
    geo.cyc.res = chipBtn(ctx, c, gx0 + 72 + 65, sy1 + 82, "Rezonansga sozlash", { w: 130 });
  } else {
    const kf = { x: cw - 26, y: 30 };
    knob(ctx, c, kf.x, kf.y, 13, (fr - 0.8) / 0.4, "f", `${fmt(cyc.fgen / 1e6, 2)} MHz`);
    geo.cyc.knobF = { x: kf.x, y: kf.y, r: 20 };
    geo.cyc.res = chipBtn(ctx, c, cw - 46, ch - 18, Math.abs(fr - 1) < 0.003 ? "Rezonans ✓" : "Rezonans", { w: 84, color: Math.abs(fr - 1) < 0.003 ? c.success : c.primary });
  }
}
function stepCyc(dt) {
  if (cyc.done) { cyc.wait += dt; if (cyc.wait > 2.5) resetCyc(); return; }
  const pr = part(cyc.part), h = dt * cycK(), n = 60, hh = h / n;
  cyc.cross = cyc.cross || [];
  for (let i = 0; i < n; i++) {
    const x0 = cyc.p[0];
    if (cyc.out) { cyc.p = [cyc.p[0] + cyc.v[0] * hh, cyc.p[1] + cyc.v[1] * hh]; }
    else { const r = P.stepPlane(cyc.p, cyc.v, hh, pr.q, pr.m, cyc.B); cyc.p = r.p; cyc.v = r.v; }
    cyc.t += hh;
    if (!cyc.out && Math.sign(x0) !== Math.sign(cyc.p[0]) && x0 !== 0) {
      // V = φ_chap − φ_o'ng = U₀cos(2πft): o'ngga (+x) o'tishda qV, chapga o'tishda −qV
      const dir = cyc.v[0] > 0 ? 1 : -1, gain = Math.abs(pr.q) * cyc.U0 * Math.cos(TAU * cyc.fgen * cyc.t) * dir;
      let W = cyc.W + gain, sp = Math.hypot(cyc.v[0], cyc.v[1]);
      if (W <= 0.02 * Math.abs(pr.q) * cyc.U0) { W = Math.max(Math.abs(W), 0.02 * Math.abs(pr.q) * cyc.U0); cyc.v = [-cyc.v[0], cyc.v[1]]; sp = Math.hypot(cyc.v[0], cyc.v[1]); }
      const ns = Math.sqrt((2 * W) / pr.m); cyc.v = [(cyc.v[0] / sp) * ns, (cyc.v[1] / sp) * ns]; cyc.W = W; cyc.k++;
      cyc.cross.push(cyc.t); if (cyc.cross.length > 30) cyc.cross.shift();
      cyc.hist.push({ n: cyc.t * cycFc(), W: W / MEV }); if (cyc.hist.length > 4000) cyc.hist.shift();
    }
    if (!cyc.out && Math.hypot(cyc.p[0], cyc.p[1]) > CYC_R * 0.97) cyc.out = true;
  }
  const last = cyc.trail[cyc.trail.length - 1];
  if (Math.hypot(cyc.p[0] - last[0], cyc.p[1] - last[1]) > 0.002) { cyc.trail.push(cyc.p.slice()); if (cyc.trail.length > 5000) cyc.trail.shift(); }
  if (cyc.out && Math.hypot(cyc.p[0], cyc.p[1]) > CYC_R * 1.6) cyc.done = true;
  if (cyc.t * cycFc() > 120) cyc.done = true;
}
function drawCycGraph(ctx, gst) {
  const c = gst.colors, pr = part(cyc.part), Wm = P.cycEnergy(pr.m, pr.q, cyc.B, CYC_R) / MEV, h = cyc.hist;
  const nMax = Math.max(4, ...h.map((p) => p.n)) * 1.05, yTop = Math.max(Wm * 1.15, ...h.map((p) => p.W));
  const yt = ticks(0, yTop, 4), xt = ticks(0, nMax, 6);
  const f = frame(ctx, gst, { xMin: 0, xMax: nMax, yMin: 0, yMax: yTop, xTicks: xt.values, yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step >= 1 ? 0 : 1), xUnit: "ayl.", yLabel: "W, MeV" });
  ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  ctx.strokeStyle = c.danger; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(Wm)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(Wm)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = c.primary; ctx.lineWidth = 2.2; ctx.beginPath(); h.forEach((p, i) => { if (!i) ctx.moveTo(f.X(p.n), f.Y(p.W)); else { ctx.lineTo(f.X(p.n), f.Y(h[i - 1].W)); ctx.lineTo(f.X(p.n), f.Y(p.W)); } }); ctx.stroke();
  ctx.restore();
  legend(ctx, [{ color: c.primary, label: "zarra energiyasi W" }, { color: c.danger, label: `W_max = (qBR)²/2m = ${fmt(Wm, 2)} MeV`, dash: [5, 4] }], f.padL + 60, 9, c);
}

/* ------------------------------------------------------------------ Asosiy chizish */

function draw(ctx, st) {
  ctx.fillStyle = st.colors.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "lor") (lor.view === "helix" ? drawLorHelix : drawLorPlane)(ctx, st);
  else if (ui.mode === "ms") drawMS(ctx, st); else drawCyc(ctx, st);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.48, vh * 0.46), 280, 380)), graph: Math.round(clamp(vh * 0.24, 160, 220)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });
function drawGraphCanvas(ctx, gst) { if (ui.mode === "cyc") return drawCycGraph(ctx, gst); ctx.fillStyle = gst.colors.bg; ctx.fillRect(0, 0, gst.w, gst.h); }
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const val = (x, unit) => { const s = sci(x, 3); return `${s}<small>${unit}</small>`; };
function updateReadouts() {
  if (ui.mode === "lor") {
    const pr = part(lor.part), v = lorV(), B = lorB(), T = P.period(pr.m, pr.q, B);
    if (lor.view === "helix") {
      const hl = P.helix(pr.m, v, pr.q, B, lor.alpha);
      setRO("r1", "Tezlik <i>v</i>", val(v, "m/s"), `v∥ = ${sci(hl.vl, 3)}, v⊥ = ${sci(hl.vp, 3)} m/s`);
      setRO("r2", "Lorens kuchi <i>F</i>", val(P.force(pr.q, v, B, Math.sin(lor.alpha)), "N"), "F = |q|vB·sin α");
      setRO("r3", "Vint radiusi <i>r</i>", `${fmt(hl.r * 100, 2)}<small>cm</small>`, "r = mv·sin α/(|q|B)");
      setRO("r4", "Vint qadami <i>h</i>", `${fmt(hl.pitch * 100, 2)}<small>cm</small>`, "h = v·cos α·T");
      setRO("r5", "Aylanish davri <i>T</i>", val(T, "s"), "α va v ga bog‘liq emas");
      setRO("r6", "Burchak α", `${fmt(lor.alpha / DEG, 0)}°`, lor.alpha > 89.5 * DEG ? "v ⊥ B — tekis aylana" : "v ∥ B bo‘lsa kuch nol");
    } else {
      setRO("r1", "Zarra", pr.name, `q = ${sci(pr.q, 3)} C, m = ${sci(pr.m, 3)} kg`);
      setRO("r2", "Tezlik <i>v</i> va maydon <i>B</i>", val(v, "m/s"), `B = ${fmtB(B)}`);
      setRO("r3", "Lorens kuchi <i>F</i>", val(P.force(pr.q, v, B), "N"), "F = |q|vB, tezlikka tik");
      setRO("r4", "Aylana radiusi <i>r</i>", `${fmt(P.radius(pr.m, v, pr.q, B) * 100, 2)}<small>cm</small>`, "r = mv/(|q|B)");
      setRO("r5", "Aylanish davri <i>T</i>", val(T, "s"), `ν = ${sci(1 / T, 3)} Hz — v ga bog‘liq emas`);
      setRO("r6", "Maydonda burilish", `${fmt(lor.turns * 360, 0)}°`, lor.inField ? "zarra maydon ichida" : "maydondan tashqarida", lor.inField ? "" : "muted");
    }
  } else if (ui.mode === "ms") {
    const ions = msIons(), a = ions[0], b = ions[1], mMeas = P.massFromR(ms.ruler / 200, P.E, ms.U, ms.B) / P.AMU;
    setRO("r1", `${a.n} tezligi`, val(a.v, "m/s"), "qU = mv²/2");
    setRO("r2", "Radiuslar", ions.map((io) => fmt(io.r * 100, 2)).join(" / ") + "<small>cm</small>", "r = √(2mU/q)/B");
    setRO("r3", "Dog‘lar orasidagi masofa", `${fmt(2 * (b.r - a.r) * 100, 2)}<small>cm</small>`, `${a.n} va ${b.n}`);
    setRO("r4", "O‘lchagich", `${fmt(ms.ruler, 1)}<small>cm</small>`, "tirqishdan masofa d = 2r");
    setRO("r5", "O‘lchangan massa", `${fmt(mMeas, 2)}<small>u</small>`, "m = qB²d²/(8U)");
    setRO("r6", "Tezlik selektori", ms.sel ? val(ms.Ef / B1, "m/s") : "o‘chiq", ms.sel ? `o‘tadi: v = E/B₁; ${ions.filter((i) => i.pass).map((i) => i.n).join(", ") || "hech biri"}` : "barcha izotoplar o‘tadi", ms.sel ? "" : "muted");
  } else {
    const pr = part(cyc.part), fc = cycFc(), Wm = P.cycEnergy(pr.m, pr.q, cyc.B, CYC_R), turns = cyc.t * fc;
    setRO("r1", "Siklotron chastotasi <i>f_c</i>", `${fmt(fc / 1e6, 2)}<small>MHz</small>`, "f = qB/(2πm) — energiyaga bog‘liq emas");
    setRO("r2", "Generator chastotasi", `${fmt(cyc.fgen / 1e6, 2)}<small>MHz</small>`, Math.abs(cyc.fgen / fc - 1) < 0.003 ? "rezonans" : `farq ${fmt((cyc.fgen / fc - 1) * 100, 1)}%`, Math.abs(cyc.fgen / fc - 1) < 0.003 ? "" : "orange");
    setRO("r3", "Energiya <i>W</i>", `${fmt(cyc.W / MEV, 3)}<small>MeV</small>`, `har o‘tishda ≤ qU₀ = ${fmt((Math.abs(pr.q) * cyc.U0) / MEV, 3)} MeV`);
    setRO("r4", "Eng katta energiya", `${fmt(Wm / MEV, 2)}<small>MeV</small>`, `W_max = (qBR)²/2m, R = ${fmt(CYC_R * 100, 0)} cm`);
    setRO("r5", "Aylanishlar", fmt(turns, 1), `o‘tishlar: ${cyc.k}`);
    setRO("r6", "Tezlik", val(Math.sqrt((2 * cyc.W) / pr.m), "m/s"), `${fmt(Math.sqrt((2 * cyc.W) / pr.m) / 2.998e6, 1)}% c`);
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "lor") { if (lor.view === "helix") { t = "Vint chiziq"; tone = "purple"; } else { t = lor.inField ? "Lorens kuchi ta’sir qilmoqda" : "To‘g‘ri chiziqli"; tone = lor.inField ? "orange" : "blue"; } }
  else if (ui.mode === "ms") { const n = msIons().filter((i) => i.pass).length; t = ms.sel ? `${n} ta izotop o‘tadi` : "Izotoplar ajraldi"; tone = n ? "green" : "red"; }
  else { const fr = cyc.fgen / cycFc(); t = cyc.out ? "Dastadan chiqdi" : Math.abs(fr - 1) < 0.003 ? "Rezonans: tezlanmoqda" : "Faza siljimoqda"; tone = cyc.out ? "green" : Math.abs(fr - 1) < 0.003 ? "green" : "orange"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "lor") {
    p.push("<p>Magnit maydonda harakatlanayotgan zaryadli zarraga <b>Lorens kuchi</b> ta’sir qiladi: F = |q|vB·sin α. Kuch doim tezlikka tik — u tezlik modulini o‘zgartirmaydi (ish bajarmaydi), faqat yo‘nalishini burib, zarrani aylana bo‘ylab harakatlantiradi.</p>");
    p.push(lor.view === "helix" ? "<p>Tezlik B ga burchak ostida bo‘lsa, uni ikki tashkil etuvchiga ajratamiz: B ga parallel v·cos α o‘zgarmaydi (kuch yo‘q), tik v·sin α esa aylanma harakat beradi. Natijada zarra <b>vint chiziq</b> bo‘ylab harakatlanadi — qutb yog‘dusidagi zarralar ham Yer maydon chiziqlari bo‘ylab shunday o‘raladi.</p>" : "<p>Radius r = mv/(|q|B): tezlik ortsa katta, maydon kuchli bo‘lsa kichik. Davr T = 2πm/(|q|B) esa tezlikka bog‘liq emas — v vektorini uzaytirib ko‘ring: aylana kattalashadi, lekin aylanish vaqti o‘zgarmaydi. Kuch yo‘nalishi chap qo‘l qoidasi bilan topiladi; elektron (manfiy) teskari tomonga buriladi.</p>");
  } else if (ui.mode === "ms") {
    p.push("<p><b>Mass-spektrometr</b>da ionlar U kuchlanishda tezlatiladi (qU = mv²/2), so‘ng magnit maydonda yarim aylana chizib, fotoplastinkaga tushadi. Radius r = √(2mU/q)/B massaning kvadrat ildiziga proporsional, shuning uchun bir elementning <b>izotoplari</b> turli joyga tushadi.</p>");
    p.push(ms.sel ? "<p><b>Tezlik selektori</b>da elektr kuchi qE va Lorens kuchi qvB₁ qarama-qarshi: faqat v = E/B₁ tezlikdagi ionlar to‘g‘ri o‘tadi, qolganlari plastinkalarga uriladi. E dastagini burab, kerakli izotopni tanlang.</p>" : "<p>O‘lchagichni dog‘ ustiga qo‘ying: d = 2r bo‘lgani uchun m = qB²d²/(8U). Shu tarzda izotoplarning massalarini aniqlang.</p>");
  } else {
    p.push("<p><b>Siklotron</b>da zarra ikki duant ichida magnit maydon ta’sirida yarim aylanalar chizadi, duantlar orasidagi tirqishda esa o‘zgaruvchan kuchlanish uni har safar tezlatadi. Yarim aylanish vaqti tezlikka bog‘liq bo‘lmagani uchun generator chastotasi f = qB/(2πm) ga teng bo‘lsa (rezonans), zarra har o‘tishda energiya oladi va spiral bo‘ylab chetga chiqadi.</p>");
    p.push("<p>Chastota mos kelmasa, o‘tish lahzalari kuchlanish fazasidan siljiydi: zarra avval tezlanadi, keyin sekinlashadi. Eng katta energiya W = (qBR)²/2m faqat B va duant radiusiga bog‘liq, U₀ esa faqat aylanishlar sonini belgilaydi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "lor" ? (lor.view === "helix" ? "<small>Vint chiziq</small> h = v·cos α·T" : "<small>Lorens kuchi</small> F = |q|vB·sin α") : ui.mode === "ms" ? "<small>Mass-spektrometr</small> m = qB²r²/(2U)" : "<small>Siklotron</small> f = qB/(2πm)";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
const actBtn = $("[data-action]");
function updateAction() {
  const t = ui.mode === "lor" ? "Qayta otish" : ui.mode === "ms" ? "Plastinkani tozalash" : "Rezonansga sozlash";
  if (actBtn.textContent !== t) actBtn.textContent = t;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); updateAction(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "lor") (lor.view === "helix" ? stepLorHelix : stepLorPlane)(dt); else if (ui.mode === "ms") stepMS(dt); else stepCyc(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.12) { uiTimer = 0; updateReadouts(); updateStatus(); if (ui.mode === "cyc") graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => loop.toggle());
function resetMode() { if (ui.mode === "lor") launchLor(); else if (ui.mode === "ms") { ms.ions = []; ms.hits = []; } else resetCyc(); }
$("[data-reset]").addEventListener("click", () => { resetMode(); refresh(); if (!loop.running) loop.start(); });
function tuneRes() { cyc.fgen = cycFc(); cFC.set(1); resetCyc(); }
actBtn.addEventListener("click", () => { if (ui.mode === "lor") launchLor(); else if (ui.mode === "ms") ms.hits = []; else tuneRes(); customized(); refresh(); if (!loop.running) loop.start(); });

/* ------------------------------------------------------------------ Boshqaruv */

const lVC = bindRange($("#lV"), $("#lVOut"), (k) => fmtV(REF[lor.part].v * k), (k) => { lor.kv = k; launchLor(); customized(); refresh(); });
const lBC = bindRange($("#lB"), $("#lBOut"), (k) => fmtB(REF[lor.part].B * k), (k) => { lor.kb = k; launchLor(); customized(); refresh(); });
const lAC = bindRange($("#lA"), $("#lAOut"), (v) => `${fmt(v, 0)}°`, (v) => { lor.alpha = v * DEG; launchLor(); customized(); refresh(); });
document.querySelectorAll("[data-part-value]").forEach((b) => b.addEventListener("click", () => { lor.part = b.dataset.partValue; launchLor(); syncAll(); customized(); refresh(); }));
document.querySelectorAll("[data-view-value]").forEach((b) => b.addEventListener("click", () => { lor.view = b.dataset.viewValue; launchLor(); syncAll(); setModeUI(); customized(); refresh(); }));
const mUC = bindRange($("#mU"), $("#mUOut"), (v) => `${fmt(v, 0)} V`, (v) => { ms.U = v; ms.hits = []; customized(); refresh(); });
const mBC = bindRange($("#mB"), $("#mBOut"), (v) => `${fmt(v, 2)} T`, (v) => { ms.B = v; ms.hits = []; customized(); refresh(); });
const mEC = bindRange($("#mE"), $("#mEOut"), (v) => `${fmt(v, 1)} kV/m`, (v) => { ms.Ef = v * 1000; customized(); refresh(); });
$("[data-sel]").addEventListener("change", (e) => { ms.sel = e.target.checked; ms.hits = []; ms.ions = []; syncAll(); customized(); refresh(); });
document.querySelectorAll("[data-iso-value]").forEach((b) => b.addEventListener("click", () => { ms.set = b.dataset.isoValue; ms.hits = []; ms.ions = []; syncAll(); customized(); refresh(); }));
const cBC = bindRange($("#cB"), $("#cBOut"), (v) => `${fmt(v, 2)} T`, (v) => { cyc.B = v; const fr = clamp(cyc.fgen / cycFc(), 0.8, 1.2); cyc.fgen = fr * cycFc(); cFC.set(fr); resetCyc(); customized(); refresh(); });
const cUC = bindRange($("#cU"), $("#cUOut"), (v) => `${fmt(v, 0)} kV`, (v) => { cyc.U0 = v * 1000; resetCyc(); customized(); refresh(); });
const cFC = bindRange($("#cF"), $("#cFOut"), (v) => `${fmt((v * cycFc()) / 1e6, 2)} MHz`, (v) => { cyc.fgen = v * cycFc(); resetCyc(); customized(); refresh(); });
document.querySelectorAll("[data-cpart-value]").forEach((b) => b.addEventListener("click", () => { const fr = cyc.fgen / cycFc(); cyc.part = b.dataset.cpartValue; cyc.fgen = fr * cycFc(); resetCyc(); syncAll(); customized(); refresh(); }));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* Sahnadagi boshqaruv */
const canvas = stage.canvas;
let drag = null, dragY0 = 0, dragV0 = 0;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
const hitR = (p, b) => b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r;
function hitTest(p) {
  if (ui.mode === "lor") {
    const g = geo.lor || {};
    if (lor.view === "helix") return hitR(p, g.htip) ? "htip" : null;
    if (inBox(p, g.bbtn)) return "bflip";
    if (hitR(p, g.tip)) return "tip";
    if (hitR(p, g.gun)) return "gun";
    if (inBox(p, g.edge)) return "edge";
    return null;
  }
  if (ui.mode === "ms") { const g = geo.ms || {}; if (hitR(p, g.knobU)) return "kU"; if (hitR(p, g.knobE)) return "kE"; if (inBox(p, g.ruler)) return "ruler"; return null; }
  const g = geo.cyc || {}; if (hitR(p, g.knobF)) return "kF"; if (inBox(p, g.res)) return "res"; return null;
}
const CURSOR = { tip: "grab", htip: "grab", gun: "ns-resize", edge: "ew-resize", ruler: "ns-resize", kU: "ns-resize", kE: "ns-resize", kF: "ns-resize", bflip: "pointer", res: "pointer" };
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  if (h === "bflip") { lor.Bs = -lor.Bs; launchLor(); customized(); refresh(); return; }
  if (h === "res") { tuneRes(); customized(); refresh(); return; }
  drag = h; dragY0 = p.y; dragV0 = h === "kU" ? ms.U : h === "kE" ? ms.Ef : h === "kF" ? cyc.fgen / cycFc() : 0;
  canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  onDrag(p);
});
function onDrag(p) {
  const w = toWorld(p.x, p.y), dy = dragY0 - p.y;
  if (drag === "tip") { const g = geo.lor.tip, dx = p.x - g.ox, dyy = g.oy - p.y; lor.th = clamp(Math.atan2(dyy, dx), -80 * DEG, 80 * DEG); lor.kv = clamp(Math.round((Math.hypot(dx, dyy) / (3.2 * view.s)) * 20) / 20, 0.2, 2); lVC.set(lor.kv); launchLor(); }
  else if (drag === "htip") { const g = geo.lor.htip, dx = p.x - g.ox, dyy = g.oy - p.y; lor.alpha = clamp(Math.round(Math.atan2(dyy, dx) / DEG), 10, 90) * DEG; lor.kv = clamp(Math.round((Math.hypot(dx, dyy) / g.kv) * 20) / 20, 0.2, 2); lVC.set(lor.kv); lAC.set(lor.alpha / DEG); launchLor(); }
  else if (drag === "gun") { lor.ys = clamp(Math.round(w.y * 2) / 2, -LOR_H + 2, LOR_H - 2); launchLor(); }
  else if (drag === "edge") { lor.xB = clamp(Math.round(w.x * 2) / 2, 6, (geo.lor.W || 60) - 4); launchLor(); }
  else if (drag === "ruler") { ms.ruler = clamp(Math.round(-w.y * 20) / 20, 0.5, -MSW.y0 - 0.5); }
  else if (drag === "kU") { ms.U = clamp(Math.round((dragV0 + dy * 15) / 50) * 50, 200, 3000); mUC.set(ms.U); ms.hits = []; }
  else if (drag === "kE") { ms.Ef = clamp(Math.round(dragV0 + dy * 200), 1000, 60000); mEC.set(ms.Ef / 1000); }
  else if (drag === "kF") { const fr = clamp(Math.round((dragV0 + dy / 600) * 1000) / 1000, 0.8, 1.2); cyc.fgen = fr * cycFc(); cFC.set(fr); resetCyc(); }
  customized(); refresh();
}
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? CURSOR[h] : ""; return; } onDrag(p); });
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  proton: { mode: "lor", title: "Proton magnit maydonda", lesson: "Proton maydonga kirib aylana bo‘ylab buriladi: Lorens kuchi (qizil) doim tezlikka tik. v vektori uchini, manbani va maydon chegarasini surib ko‘ring; ⊙/⊗ tugmasi B yo‘nalishini almashtiradi.", set: () => Object.assign(lor, { part: "p", view: "plane", kv: 1, kb: 1, Bs: 1, th: 0, ys: 0, xB: 18 }) },
  period: { mode: "lor", title: "Davr tezlikka bog‘liq emas", lesson: "Proton maydon ichida tug‘iladi va to‘liq aylanalar chizadi. v vektorini uzaytiring: radius ortadi, lekin aylanish vaqti (T) o‘zgarmaydi — buni o‘lchov va «burilish» ko‘rsatkichida kuzating.", set: () => Object.assign(lor, { part: "p", view: "plane", kv: 0.8, kb: 1, Bs: 1, th: 80 * DEG, ys: -3, xB: 0 }) },
  electron: { mode: "lor", title: "Elektron va proton: ishora", lesson: "Elektron manfiy — xuddi shu maydonda protonga teskari tomonga buriladi. Massasi ancha kichik, shuning uchun 1 mT kabi kuchsiz maydonda ham kichik aylana chizadi.", set: () => Object.assign(lor, { part: "e", view: "plane", kv: 1, kb: 1, Bs: 1, th: 0, ys: 0, xB: 18 }) },
  helix: { mode: "lor", title: "Vint chiziq (α = 60°)", lesson: "Tezlik B ga 60° burchak ostida: zarra B bo‘ylab siljiydi va atrofida aylanadi — vint chiziq. v vektori uchini surib α ni o‘zgartiring: α = 90° da tekis aylana, kichik α da qadam uzun.", set: () => Object.assign(lor, { part: "p", view: "helix", kv: 1, kb: 1, alpha: 60 * DEG }) },
  msNe: { mode: "ms", title: "Neon izotoplari", lesson: "²⁰Ne va ²²Ne ionlari bir xil U da tezlatiladi, lekin og‘irrog‘i kattaroq yarim aylana chizadi. O‘lchagichni dog‘larga surib, massalarini aniqlang.", set: () => Object.assign(ms, { set: "Ne", U: 1000, B: 0.2, sel: false, ruler: 20.4 }) },
  msH: { mode: "ms", title: "Vodorod: H, D, T", lesson: "Protiy, deyteriy va tritiy massalari 1 : 2 : 3. Radiuslar √m ga proporsional: 1 : 1,41 : 1,73.", set: () => Object.assign(ms, { set: "H", U: 1000, B: 0.2, sel: false, ruler: 4.6 }) },
  msSel: { mode: "ms", title: "Tezlik selektori bilan", lesson: "Selektor E/B₁ = 9,8·10⁴ m/s tezlikni o‘tkazadi — faqat ²⁰Ne. E dastagini burab ²²Ne ni tanlang (≈ 9,35 kV/m).", set: () => Object.assign(ms, { set: "Ne", U: 1000, B: 0.2, sel: true, Ef: 9800, ruler: 20.4 }) },
  cycRes: { mode: "cyc", title: "Siklotron: rezonans", lesson: "Generator chastotasi f = qB/(2πm). Proton har o‘tishda 100 keV oladi va spiral bo‘ylab ~3 MeV gacha tezlanadi. Grafikda energiyaning «zinapoyasi».", set: () => { Object.assign(cyc, { part: "p", B: 1, U0: 100e3 }); cyc.fgen = cycFc(); } },
  cycOff: { mode: "cyc", title: "Chastota 3% farq qiladi", lesson: "Generator chastotasi 3% katta: o‘tish lahzalari kuchlanish fazasidan siljiydi, zarra avval tezlanib, keyin sekinlashadi — chetga yetolmaydi. Dastakni burab rezonansga keltiring.", set: () => { Object.assign(cyc, { part: "p", B: 1, U0: 100e3 }); cyc.fgen = 1.03 * cycFc(); } },
  cycAlpha: { mode: "cyc", title: "Alfa-zarra tezlatish", lesson: "Alfa-zarra uchun q/m protonnikidan 2 marta kichik: shu B da rezonans chastotasi 2 marta past. Energiyasi esa (2e)²/(4m) — protonniki bilan bir xil.", set: () => { Object.assign(cyc, { part: "a", B: 1, U0: 100e3 }); cyc.fgen = cycFc(); } },
};
const GROUPS = [["Lorens kuchi", ["proton", "period", "electron", "helix"]], ["Mass-spektrometr", ["msNe", "msH", "msSel"]], ["Siklotron", ["cycRes", "cycOff", "cycAlpha"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  lVC.set(lor.kv); lBC.set(lor.kb); lAC.set(Math.round(lor.alpha / DEG)); lVC.sync(); lBC.sync();
  document.querySelectorAll("[data-part-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.partValue === lor.part)));
  document.querySelectorAll("[data-view-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.viewValue === lor.view)));
  mUC.set(ms.U); mBC.set(ms.B); mEC.set(ms.Ef / 1000); $("[data-sel]").checked = ms.sel; $("[data-selctl]").hidden = !ms.sel;
  document.querySelectorAll("[data-iso-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.isoValue === ms.set)));
  cBC.set(cyc.B); cUC.set(cyc.U0 / 1000); cFC.set(cyc.fgen / cycFc()); cFC.sync();
  document.querySelectorAll("[data-cpart-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cpartValue === cyc.part)));
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { lor: "Manba, v vektori uchi va maydon chegarasi suriladi", ms: "U va E dastaklarini burang, o‘lchagichni suring", cyc: "Generator chastota dastagini burang" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-vctl]").forEach((el) => { el.hidden = el.dataset.vctl !== lor.view; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  const gc = $("[data-graph-card]"); gc.hidden = ui.mode !== "cyc";
  if (ui.mode === "cyc") { $("[data-graph-title]").textContent = "Zarra energiyasi"; $("[data-graph-sub]").textContent = "Har bir o‘tishda energiya qU₀·cos φ ga o‘zgaradi: rezonansda — «zinapoya» bo‘ylab W_max gacha; chastota farq qilsa, energiya avval ortib, keyin kamayadi."; $("[data-tabs]").innerHTML = ""; window.dispatchEvent(new Event("resize")); }
}
const MODE_DEFAULT = { lor: "proton", ms: "msNe", cyc: "cycRes" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode;
  p.set();
  if (p.mode === "ms") { ms.hits = []; ms.ions = []; }
  resetMode(); setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

setPlayUI(false);
cyc.fgen = cycFc();
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "proton");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
