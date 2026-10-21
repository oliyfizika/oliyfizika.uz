// ==========================================================================
// Ish, quvvat va mexanik energiya — virtual laboratoriya (simulations/energy.html)
// 1) Ish va quvvat: qutini ip bilan tortish (kuch o'qi uchini va marra bayrog'ini sudrash, kuchlar ishlari ustunlari,
//    ΣA = ΔEk), ikki lebyodka musobaqasi (quvvat dastaklari, marra chizig'i, A = mgh, P = A/t = Fv).
// 2) Energiyaning saqlanishi: skeytpark — skeytchini va yo'l nuqtalarini sudrash, «Ep = 0» sathi, Ek/Ep/Q ustunlari,
//    Yer/Oy/Yupiter, ishqalanish; E(x) diagrammasi (to'xtash nuqtalari).
// 3) Prujina energiyasi: prujinali otgich (kattalashtirilgan ko'rinishda siqish), H = kx²/2mg, H(x²) o'lchovlari.
// Fizika: energy-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow, angleArc } from "./sim-kit.js";
import * as P from "./energy-physics.js";
import { frame, ticks, legend } from "./pendulum-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const LBL = "italic 700 13px Inter, system-ui, sans-serif";
const COL = { k: "#16a34a", p: "#2563eb", q: "#ea580c", e: "#64748b", s: "#9333ea" };

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "work", sub: "pull", show: { vec: true } };
const pull = { F: 60, alpha: 30 * DEG, M: 20, mu: 0.2, s: 4, x: 0, v: 0, t: 0, phase: "ready", AF: 0, Af: 0, tFin: null, AFfin: null };
const lift = { P1: 500, P2: 1000, m: 50, h: 10, y1: 0, y2: 0, t: 0, t1: null, t2: null, phase: "ready" };
const TRACKS = {
  pipe: [[0, 6], [2.5, 1.4], [6, 0.3], [9.5, 1.4], [12, 6]],
  hills: [[0, 6], [3, 0.5], [6, 3], [9, 0.5], [12, 4.5]],
  two: [[0, 6], [2.5, 0.8], [5, 3.5], [7.5, 0.3], [10, 2], [12, 6]],
};
const park = { track: "pipe", pts: TRACKS.pipe.map((p) => p.slice()), m: 50, mu: 0, g: 9.81, yref: 0, s: 0, v: 0, Q: 0, hold: false, tr: null, trail: [] };
const SP_L0 = 0.25, SP_R = 0.025;
const spr = { k: 200, m: 0.2, x: 0.08, y: -0.08, v: 0, phase: "ready", ymax: -1, pts: [], t: 0 };
let presetId = null;
const geo = {};

const g0 = P.G;
function rebuild() { park.tr = P.makeTrack(park.pts); park.s = clamp(park.s, 0, park.tr.L); }
rebuild();

/* ------------------------------------------------------------------ Dunyo → ekran */

const view = { s: 1, ox: 0, oy: 0, x0: 0, y1: 0 };
function fit(w, h, x0, x1, y0, y1, pad = 6, ox = 0) {
  const s = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0));
  view.s = s; view.ox = ox + (w - (x1 - x0) * s) / 2; view.oy = (h - (y1 - y0) * s) / 2; view.x0 = x0; view.y1 = y1;
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
function chip(ctx, c, x, y, r, text, on = true) {
  ctx.save(); ctx.globalAlpha = on ? 1 : 0.35; ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 1.6; circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.primary; ctx.font = `800 ${Math.round(r * 1.15)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y + 0.5); ctx.restore();
}
function knob(ctx, c, x, y, r, frac, label, val) {
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.border; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, 405 * DEG); ctx.stroke();
  ctx.strokeStyle = c.primary; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, (135 + 270 * clamp(frac, 0, 1)) * DEG); ctx.stroke();
  const a = (135 + 270 * clamp(frac, 0, 1)) * DEG; ctx.strokeStyle = c.text; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3)); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(label, x, y + r + 8);
  if (val) { ctx.fillStyle = c.text; ctx.font = MID; ctx.fillText(val, x, y + r + 20); }
}
/** Ustunli diagramma: items [{label, val, col}], nol chizig'i o'rtada (manfiy qiymatlar uchun). */
function bars(ctx, c, x0, y0, w, h, items, title, scale) {
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = BOLD; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(title, x0 + 10, y0 + 8);
  const neg = items.some((i) => i.val < -1e-9), top = y0 + 30, bot = y0 + h - 24, zero = neg ? top + (bot - top) * 0.62 : bot, n = items.length, bw = Math.min(30, (w - 20) / n - 10);
  const mx = Math.max(scale || 0, ...items.map((i) => Math.abs(i.val)), 1e-9), up = zero - top - 12, dn = bot - zero;
  ctx.strokeStyle = c.borderStrong; ctx.beginPath(); ctx.moveTo(x0 + 8, zero); ctx.lineTo(x0 + w - 8, zero); ctx.stroke();
  items.forEach((it, i) => {
    const cx = x0 + 10 + ((w - 20) * (i + 0.5)) / n, hh = it.val >= 0 ? (it.val / mx) * up : (-it.val / mx) * Math.max(dn, up * 0.6);
    ctx.fillStyle = it.col; if (it.val >= 0) ctx.fillRect(cx - bw / 2, zero - hh, bw, hh); else ctx.fillRect(cx - bw / 2, zero, bw, Math.min(hh, dn + 18));
    ctx.fillStyle = c.text; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(fmtJ(it.val), cx, it.val >= 0 ? zero - hh - 2 : zero - 2);
    ctx.fillStyle = c.text2; ctx.textBaseline = "top"; ctx.fillText(it.label, cx, bot + 6);
  });
}
const fmtJ = (v) => (Math.abs(v) >= 10000 ? `${fmt(v / 1000, 1)} kJ` : `${fmt(v, Math.abs(v) < 10 ? 2 : 0)} J`);

/* ================================================================== 1a) Qutini tortish */

const boxSide = () => 0.6 * Math.cbrt(pull.M / 20);
function pullState() { return P.pullForces({ M: pull.M, F: pull.phase === "run" ? pull.F : pull.phase === "coast" ? 0 : pull.F, alpha: pull.alpha, mu: pull.mu, v: pull.v }); }
function drawPull(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560;
  const XR = narrow ? 6.6 : 8.6;
  fit(cw, ch, -0.6, XR, -1.15, narrow ? 4.0 : 3.3, 6);
  const s = view.s, b = boxSide(), x = pull.x, fs = pullState();
  geo.pull = { wall: XR - 0.2 };
  // yer
  ctx.fillStyle = c.dark ? "#3f3a33" : "#e7e1d6"; ctx.fillRect(0, SY(0), cw, ch - SY(0));
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, SY(0)); ctx.lineTo(cw, SY(0)); ctx.stroke();
  // start va marra
  ctx.save(); ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(SX(0), SY(0)); ctx.lineTo(SX(0), SY(1.2)); ctx.stroke(); ctx.restore();
  tag(ctx, "start", SX(0), SY(1.2) - 10, { color: c.text3, bg: c.bg, align: "center", font: SMALL, pad: 3 });
  const fx = SX(pull.s + b);
  ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, SY(0)); ctx.lineTo(fx, SY(1.4)); ctx.stroke();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? c.text : c.bg; ctx.fillRect(fx + j * 7, SY(1.4) + i * 6, 7, 6); }
  ctx.strokeStyle = c.text; ctx.lineWidth = 1; ctx.strokeRect(fx, SY(1.4), 21, 24);
  geo.pull.flag = { x0: fx - 10, x1: fx + 28, y0: SY(1.4) - 6, y1: SY(0) };
  // ko'chish o'lchovi
  const my = SY(-0.3); ctx.strokeStyle = c.text2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(SX(b), my); ctx.lineTo(fx, my); ctx.moveTo(SX(b), my - 4); ctx.lineTo(SX(b), my + 4); ctx.moveTo(fx, my - 4); ctx.lineTo(fx, my + 4); ctx.stroke();
  tag(ctx, `s = ${fmt(pull.s, 1)} m`, (SX(b) + fx) / 2, my + 14, { color: c.text, bg: c.bg, align: "center", font: MID });
  // quti
  const bx = SX(x), by = SY(b), bs = b * s;
  ctx.fillStyle = c.dark ? "#a16207" : "#ca8a04"; ctx.strokeStyle = "#713f12"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx, by, bs, bs, 3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(113,63,18,0.6)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx + 3, by + 3); ctx.lineTo(bx + bs - 3, by + bs - 3); ctx.moveTo(bx + bs - 3, by + 3); ctx.lineTo(bx + 3, by + bs - 3); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = BOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${fmt(pull.M, 0)} kg`, bx + bs / 2, by + bs / 2);
  const can = pull.phase === "ready";
  geo.pull.mm = { x: bx + bs / 2 - 14, y: by - 14, r: 9 }; geo.pull.mp = { x: bx + bs / 2 + 14, y: by - 14, r: 9 };
  if (can) { chip(ctx, c, geo.pull.mm.x, geo.pull.mm.y, 9, "−", pull.M > 5); chip(ctx, c, geo.pull.mp.x, geo.pull.mp.y, 9, "+", pull.M < 40); }
  // ip va qo'l
  const ax = x + b, ay = b / 2, L = 1.25, hx = ax + L * Math.cos(pull.alpha), hy = ay + L * Math.sin(pull.alpha), pulling = pull.phase !== "coast" && pull.phase !== "done";
  if (pulling) {
    ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(SX(ax), SY(ay)); ctx.lineTo(SX(hx), SY(hy)); ctx.stroke();
    ctx.fillStyle = c.dark ? "#d6a77a" : "#f1c27d"; ctx.strokeStyle = "rgba(120,72,30,0.7)"; ctx.lineWidth = 1; circle(ctx, SX(hx), SY(hy), 9); ctx.fill(); ctx.stroke();
  }
  // kuchlar
  const kF = (1.2 * s) / Math.max(pull.M * g0, 150);
  if (ui.show.vec) {
    const cx = SX(x + b / 2), cy = SY(b / 2);
    arrow(ctx, cx, cy, 0, pull.M * g0 * kF, c.text2, { width: 2.4, head: 9, label: "mg", font: "italic 700 12px Inter, system-ui, sans-serif" });
    if (fs.N > 0.5) arrow(ctx, cx - 10, SY(0), 0, -fs.N * kF, c.success, { width: 2.4, head: 9, label: "N", font: LBL });
    if (fs.f > 0.05) arrow(ctx, cx, SY(0) - 3, -fs.f * kF, 0, c.danger, { width: 2.4, head: 9, label: "f", font: LBL });
  }
  if (pulling) {
    const L2 = Math.max(pull.F * kF, 0), ux = Math.cos(pull.alpha), uy = -Math.sin(pull.alpha);
    if (pull.F > 0.5) arrow(ctx, SX(ax), SY(ay), ux * L2, uy * L2, c.primary, { width: 3, head: 11, label: "F", font: LBL });
    const tx = SX(ax) + ux * L2, ty = SY(ay) + uy * L2;
    ctx.fillStyle = c.primary; circle(ctx, tx, ty, can ? 5 : 3); ctx.fill();
    geo.pull.tip = can ? { x: tx, y: ty, r: 14, ox: SX(ax), oy: SY(ay), kF } : null;
    if (pull.alpha > 1 * DEG) { ctx.save(); ctx.strokeStyle = c.text3; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(SX(ax), SY(ay)); ctx.lineTo(SX(ax) + 50, SY(ay)); ctx.stroke(); ctx.restore(); angleArc(ctx, SX(ax), SY(ay), 30, 0, -pull.alpha, c.text2, { label: "α", labelR: 42, font: "italic 600 12px Inter, system-ui, sans-serif" }); }
  }
  // ishlar diagrammasi
  const bw = narrow ? cw - 16 : Math.min(320, cw * 0.4), bh = narrow ? 120 : 150, Ek = 0.5 * pull.M * pull.v * pull.v;
  bars(ctx, c, cw - bw - 8, 8, bw, bh, [
    { label: "A_F", val: pull.AF, col: c.primary }, { label: "A_f", val: pull.Af, col: c.danger }, { label: "A_N", val: 0, col: c.success }, { label: "A_mg", val: 0, col: c.text2 },
    { label: "ΣA", val: pull.AF + pull.Af, col: COL.s }, { label: "ΔE_k", val: Ek, col: COL.k },
  ], "Kuchlarning ishi", Math.max(Math.abs(pull.F * Math.cos(pull.alpha) * pull.s), 1));
  if (!narrow) tag(ctx, `t = ${fmt(pull.t, 2)} s · v = ${fmt(pull.v, 2)} m/s`, 8, 14, { color: c.text2, bg: c.bg2, font: MID });
  if (pull.phase === "stuck") tagIn(ctx, `F·cos α = ${fmt(pull.F * Math.cos(pull.alpha), 1)} N ≤ μN = ${fmt(pull.mu * fs.N, 1)} N — quti qo‘zg‘almaydi, ish nol`, cw / 2, SY(2.0), cw, { color: c.danger, bg: c.bg, align: "center", font: MID });
}
function stepPull(dt) {
  if (pull.phase !== "run" && pull.phase !== "coast") return;
  const n = Math.max(1, Math.ceil(dt / 0.002)), h = dt / n, b = boxSide();
  for (let i = 0; i < n; i++) {
    const fs = pullState(); let v1 = pull.v + fs.a * h;
    if (v1 <= 0 && pull.phase === "coast") { pull.v = 0; pull.phase = "done"; break; }
    v1 = Math.max(0, v1);
    const ds = 0.5 * (pull.v + v1) * h;
    if (pull.phase === "run") pull.AF += fs.Fx * ds;
    pull.Af -= fs.f * ds; pull.x += ds; pull.v = v1; pull.t += h;
    if (pull.phase === "run" && pull.x >= pull.s) { pull.phase = "coast"; pull.tFin = pull.t; pull.AFfin = pull.AF; }
    if (pull.x + b >= ((geo.pull && geo.pull.wall) || 8.4)) { pull.phase = "done"; break; } // devorga yetdi: kadr shu yerda to'xtaydi, Eₖ ko'rsatiladi
  }
}
function startPull() {
  if (pull.phase !== "ready") return;
  const fs = P.pullForces({ M: pull.M, F: pull.F, alpha: pull.alpha, mu: pull.mu, v: 0 });
  pull.phase = fs.a > 0 ? "run" : "stuck"; if (!loop.running) loop.start();
}
function resetPull() { Object.assign(pull, { x: 0, v: 0, t: 0, phase: "ready", AF: 0, Af: 0, tFin: null, AFfin: null }); }

/* ================================================================== 1b) Ikki lebyodka */

function drawLift(ctx, st) {
  const { w: cw, h: ch, colors: c } = st;
  const s = (ch - 30) / 14.2, W = cw / s;
  view.s = s; view.ox = 0; view.oy = 14; view.x0 = 0; view.y1 = 13.6;
  geo.lift = {};
  ctx.fillStyle = c.dark ? "#3f3a33" : "#e7e1d6"; ctx.fillRect(0, SY(0), cw, ch - SY(0));
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, SY(0)); ctx.lineTo(cw, SY(0)); ctx.stroke();
  // balandlik shkalasi
  ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.strokeStyle = c.border; ctx.lineWidth = 1;
  for (let y = 0; y <= 13; y += 1) { ctx.beginPath(); ctx.moveTo(28, SY(y)); ctx.lineTo(y % 5 ? 33 : 37, SY(y)); ctx.stroke(); if (y % 2 === 0) ctx.fillText(`${y} m`, 26, SY(y)); }
  // marra chizig'i
  ctx.save(); ctx.strokeStyle = c.danger; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(40, SY(lift.h)); ctx.lineTo(cw - 8, SY(lift.h)); ctx.stroke(); ctx.restore();
  tag(ctx, `h = ${fmt(lift.h, 1)} m`, 46, SY(lift.h) - 12, { color: c.danger, bg: c.bg, font: BOLD });
  geo.lift.line = { x0: 40, x1: cw, y0: SY(lift.h) - 8, y1: SY(lift.h) + 8 };
  const xs = [W * 0.36, W * 0.72], A = lift.m * g0 * lift.h;
  [[lift.P1, lift.y1, lift.t1, "1"], [lift.P2, lift.y2, lift.t2, "2"]].forEach(([Pw, y, tt, k], i) => {
    const X = SX(xs[i]), top = SY(13.1), cs = 0.9 * s, v = P.liftSpeed(Pw, lift.m);
    // minora
    ctx.strokeStyle = c.text2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X - 1.3 * s, SY(0)); ctx.lineTo(X - 1.3 * s, top); ctx.lineTo(X + 0.4 * s, top); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); for (let yy = 0; yy < 13; yy += 1) { ctx.moveTo(X - 1.3 * s, SY(yy)); ctx.lineTo(X - 1.3 * s + 8, SY(yy + 1)); } ctx.stroke();
    // dvigatel va baraban
    ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.strokeStyle = c.text2; ctx.beginPath(); ctx.roundRect(X - 1.25 * s, top - 18, 0.9 * s, 18, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.text; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`M${k}`, X - 0.8 * s, top - 9);
    const dr = 7, ang = (-(y - 0) / 0.15) % TAU;
    ctx.fillStyle = c.bg2; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5; circle(ctx, X, top + 2, dr); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X, top + 2); ctx.lineTo(X + Math.cos(ang) * dr, top + 2 + Math.sin(ang) * dr); ctx.stroke();
    // arqon va yuk
    const yb = SY(y + 0.9);
    ctx.strokeStyle = c.text; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(X + dr, top + 2); ctx.lineTo(X + dr, yb); ctx.stroke();
    ctx.fillStyle = c.dark ? "#a16207" : "#ca8a04"; ctx.strokeStyle = "#713f12"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(X + dr - cs / 2, yb, cs, cs, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = SMALL; ctx.fillText(`${fmt(lift.m, 0)} kg`, X + dr, yb + cs / 2);
    if (ui.show.vec && lift.phase === "run" && tt === null) arrow(ctx, X + dr + cs / 2 + 10, yb + cs / 2, 0, -Math.min(60, v * 12), c.primary, { width: 2.4, head: 9, label: "v", font: LBL });
    // quvvat dastagi
    const kx = X - 1.8 * s - 18, ky = top + 46;
    const kxx = X - 1.3 * s - 34, kyy = SY(2.2);
    knob(ctx, c, kxx, kyy, 14, (Pw - 100) / 2900, `P${["₁", "₂"][i]}`, `${fmt(Pw, 0)} W`);
    geo.lift["k" + k] = { x: kxx, y: kyy, r: 22 }; void kx; void ky;
    // sekundomer
    const tv = tt ?? (lift.phase === "ready" ? 0 : lift.t);
    ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.roundRect(X + 0.7 * s, top - 4, 76, 24, 5); ctx.fill();
    ctx.fillStyle = tt !== null ? "#4ade80" : "#f87171"; ctx.font = "700 13px ui-monospace, Menlo, Consolas, monospace"; ctx.textAlign = "left"; ctx.fillText(`${tv.toFixed(2)} s`, X + 0.7 * s + 8, top + 8.5);
    if (tt !== null) tag(ctx, `P = A/t = ${fmt(A / tt, 0)} W`, X + 0.7 * s, top + 34, { color: c.success, bg: c.bg2, font: MID });
  });
  tagIn(ctx, `Ikkalasi ham bir xil ish bajaradi: A = mgh = ${fmtJ(A)}`, cw / 2, ch - 10, cw, { color: c.text, bg: c.bg2, align: "center", font: MID });
}
function stepLift(dt) {
  if (lift.phase !== "run") return;
  lift.t += dt;
  const v1 = P.liftSpeed(lift.P1, lift.m), v2 = P.liftSpeed(lift.P2, lift.m);
  if (lift.t1 === null) { lift.y1 = Math.min(lift.h, v1 * lift.t); if (lift.y1 >= lift.h - 1e-9) lift.t1 = lift.h / v1; }
  if (lift.t2 === null) { lift.y2 = Math.min(lift.h, v2 * lift.t); if (lift.y2 >= lift.h - 1e-9) lift.t2 = lift.h / v2; }
  if (lift.t1 !== null && lift.t2 !== null) lift.phase = "done";
}
function resetLift() { Object.assign(lift, { y1: 0, y2: 0, t: 0, t1: null, t2: null, phase: "ready" }); }

/* ================================================================== 2) Skeytpark */

function parkE() {
  const p = park.tr.at(park.s), Ek = 0.5 * park.m * park.v * park.v, Ep = park.m * park.g * (p.y - park.yref), Q = park.m * park.Q;
  return { Ek, Ep, Q, E: Ek + Ep + Q, h: p.y, p };
}
function drawPark(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560, bw = narrow ? 0 : 220;
  fit(cw - bw, ch, -1.0, 12.3, -0.7, 7.3, 8);
  const s = view.s, tr = park.tr, e = parkE();
  geo.park = { pts: [] };
  // osmon va yer
  ctx.fillStyle = c.dark ? "rgba(56,189,248,0.05)" : "rgba(56,189,248,0.08)"; ctx.fillRect(0, 0, cw - bw, SY(0));
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
  for (let y = 1; y <= 7; y++) { ctx.beginPath(); ctx.moveTo(SX(-0.3), SY(y)); ctx.lineTo(SX(12.3), SY(y)); ctx.stroke(); ctx.textAlign = "right"; ctx.fillText(`${y} m`, SX(-0.35), SY(y) + 4); }
  // yo'l (pastini to'ldirish)
  ctx.fillStyle = c.dark ? "#3f3a33" : "#e7e1d6"; ctx.beginPath(); ctx.moveTo(SX(tr.xs[0]), SY(-0.7));
  for (let i = 0; i < tr.xs.length; i += 3) ctx.lineTo(SX(tr.xs[i]), SY(tr.ys[i]));
  ctx.lineTo(SX(tr.xs[tr.xs.length - 1]), SY(tr.ys[tr.ys.length - 1])); ctx.lineTo(SX(tr.xs[tr.xs.length - 1]), SY(-0.7)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = park.mu > 0 ? (c.dark ? "#a8a29e" : "#78716c") : c.text2; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.beginPath();
  for (let i = 0; i < tr.xs.length; i += 2) i ? ctx.lineTo(SX(tr.xs[i]), SY(tr.ys[i])) : ctx.moveTo(SX(tr.xs[i]), SY(tr.ys[i]));
  ctx.stroke();
  if (park.mu > 0) { ctx.save(); ctx.strokeStyle = "rgba(120,113,108,0.6)"; ctx.lineWidth = 2; ctx.setLineDash([2, 4]); ctx.beginPath(); for (let i = 0; i < tr.xs.length; i += 2) i ? ctx.lineTo(SX(tr.xs[i]), SY(tr.ys[i]) + 4) : ctx.moveTo(SX(tr.xs[i]), SY(tr.ys[i]) + 4); ctx.stroke(); ctx.restore(); }
  // nuqtalar
  park.pts.forEach(([x, y], i) => { ctx.fillStyle = c.bg; ctx.strokeStyle = c.special; ctx.lineWidth = 2; circle(ctx, SX(x), SY(y), 6); ctx.fill(); ctx.stroke(); geo.park.pts.push({ x: SX(x), y: SY(y), r: 11, i }); });
  // Ep = 0 sathi
  const ry = SY(park.yref);
  ctx.save(); ctx.strokeStyle = COL.p; ctx.lineWidth = 1.5; ctx.setLineDash([8, 5]); ctx.beginPath(); ctx.moveTo(SX(-0.3), ry); ctx.lineTo(SX(12.3), ry); ctx.stroke(); ctx.restore();
  ctx.fillStyle = COL.p; ctx.beginPath(); ctx.roundRect(SX(12.3) - 52, ry - 9, 52, 18, 5); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Eₚ = 0", SX(12.3) - 26, ry + 0.5);
  geo.park.ref = { x0: SX(12.3) - 56, x1: SX(12.3) + 2, y0: ry - 11, y1: ry + 11 };
  // iz
  if (park.trail.length > 1) { ctx.fillStyle = "rgba(147,51,234,0.5)"; park.trail.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(SX(x), SY(y), 1.8, 0, TAU); ctx.fill(); }); }
  // skeytchi
  const p = e.p, nx = -p.ty, ny = p.tx, X = SX(p.x), Y = SY(p.y), u = s * 0.02;
  ctx.save(); ctx.translate(X, Y); ctx.rotate(-Math.atan2(p.ty, p.tx));
  const bl = Math.max(16, 0.7 * s), fh = Math.max(26, 1.5 * s);
  ctx.fillStyle = "#1f2937"; circle(ctx, -bl * 0.35, -3, 3); ctx.fill(); circle(ctx, bl * 0.35, -3, 3); ctx.fill();
  ctx.fillStyle = "#7c3aed"; ctx.beginPath(); ctx.roundRect(-bl / 2, -8, bl, 4, 2); ctx.fill();
  ctx.strokeStyle = c.dark ? "#cbd5e1" : "#334155"; ctx.lineWidth = Math.max(2.5, fh * 0.09); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-bl * 0.25, -8); ctx.lineTo(-bl * 0.05, -8 - fh * 0.42); ctx.lineTo(bl * 0.25, -8); ctx.moveTo(-bl * 0.05, -8 - fh * 0.42); ctx.lineTo(0, -8 - fh * 0.8); ctx.moveTo(-fh * 0.28, -8 - fh * 0.62); ctx.lineTo(fh * 0.28, -8 - fh * 0.68); ctx.stroke();
  ctx.fillStyle = c.dark ? "#d6a77a" : "#f1c27d"; circle(ctx, 0, -8 - fh * 0.92, fh * 0.12); ctx.fill();
  ctx.restore();
  geo.park.sk = { x: X + nx * 0.8 * s, y: Y - ny * 0.8 * s, r: Math.max(22, 0.8 * s) };
  if (ui.show.vec && Math.abs(park.v) > 0.05) arrow(ctx, X, Y, p.tx * park.v * 0.25 * s, -p.ty * park.v * 0.25 * s, c.primary, { width: 2.6, head: 10, label: "v", font: LBL });
  void u;
  // energiya ustunlari
  const bx0 = narrow ? (cw - 190) / 2 : cw - bw + 6, bwid = narrow ? 190 : bw - 14, bh = narrow ? 112 : ch - 16;
  bars(ctx, c, bx0, narrow ? 6 : 8, bwid, bh, [{ label: "Eₖ", val: e.Ek, col: COL.k }, { label: "Eₚ", val: e.Ep, col: COL.p }, { label: "Q", val: e.Q, col: COL.q }, { label: "E", val: e.E, col: COL.e }], "Energiya", park.Emax);
  if (!narrow) tag(ctx, `v = ${fmt(Math.abs(park.v), 2)} m/s · h = ${fmt(e.h, 2)} m · g = ${fmt(park.g, 2)} m/s²`, 8, 14, { color: c.text2, bg: c.bg2, font: MID });
}
function stepPark(dt) {
  if (park.hold) return;
  const n = 2; for (let i = 0; i < n; i++) { const r = P.skateStep(park.tr, park, dt / n, park.mu, park.g); park.s = r.s; park.v = r.v; park.Q = r.Q; }
  const p = park.tr.at(park.s), last = park.trail[park.trail.length - 1];
  if (!last || Math.hypot(p.x - last[0], p.y - last[1]) > 0.35) { park.trail.push([p.x, p.y]); if (park.trail.length > 60) park.trail.shift(); }
}
function placeSkater(s) { Object.assign(park, { s, v: 0, Q: 0, trail: [] }); park.Emax = Math.max(1, park.m * park.g * (Math.max(...park.pts.map((q) => q[1])) - Math.min(park.yref, 0)) ); }
function drawParkGraph(ctx, gst) {
  const c = gst.colors, tr = park.tr, e = parkE(), m = park.m, g = park.g;
  const Epx = (i) => m * g * (tr.ys[i] - park.yref), vals = tr.ys.map((_, i) => Epx(i)), lo = Math.min(0, ...vals), hi = Math.max(...vals, e.Ek + e.Ep) * 1.08;
  const yt = ticks(lo, hi, 5), f = frame(ctx, gst, { xMin: 0, xMax: 12, yMin: Math.min(lo, yt.values[0]), yMax: hi, xTicks: [0, 2, 4, 6, 8, 10, 12], yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => (Math.abs(yt.step) >= 1000 ? fmt(v / 1000, 1) + "k" : fmt(v, 0)), xUnit: "x, m", yLabel: "E, J" });
  const Em = e.Ek + e.Ep;
  ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  // taqiqlangan soha (Eₚ > E_mex)
  ctx.fillStyle = "rgba(239,68,68,0.12)"; ctx.beginPath(); ctx.moveTo(f.X(tr.xs[0]), f.Y(Em));
  for (let i = 0; i < tr.xs.length; i += 2) ctx.lineTo(f.X(tr.xs[i]), f.Y(Math.max(Em, vals[i]))); ctx.lineTo(f.X(tr.xs[tr.xs.length - 1]), f.Y(Em)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = COL.p; ctx.lineWidth = 2.4; ctx.beginPath(); for (let i = 0; i < tr.xs.length; i += 2) i ? ctx.lineTo(f.X(tr.xs[i]), f.Y(vals[i])) : ctx.moveTo(f.X(tr.xs[i]), f.Y(vals[i])); ctx.stroke();
  ctx.strokeStyle = COL.e; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(f.rect.x, f.Y(Em)); ctx.lineTo(f.rect.x + f.rect.w, f.Y(Em)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = COL.k; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.X(e.p.x), f.Y(e.Ep)); ctx.lineTo(f.X(e.p.x), f.Y(Em)); ctx.stroke();
  ctx.fillStyle = "#7c3aed"; ctx.beginPath(); ctx.arc(f.X(e.p.x), f.Y(e.Ep), 5, 0, TAU); ctx.fill();
  ctx.restore();
  legend(ctx, [{ color: COL.p, label: "Eₚ(x)" }, { color: COL.e, label: "Eₖ + Eₚ", dash: [6, 4] }, { color: COL.k, label: "Eₖ (yashil kesma)" }], f.padL + 60, 9, c);
}

/* ================================================================== 3) Prujinali otgich */

function drawSpring(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560;
  const iw = narrow ? Math.round(cw * 0.42) : Math.min(230, Math.round(cw * 0.3)), ix0 = 8, iy0 = 8, ih = ch - 16;
  geo.spr = {};
  // kattalashtirilgan ko'rinish
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(ix0, iy0, iw, ih, 8); ctx.fill(); ctx.stroke();
  tag(ctx, "Otgich (kattalashtirilgan)", ix0 + 6, iy0 + 13, { color: c.text2, bg: c.bg, font: SMALL, pad: 4 });
  const si = (ih - 40) / 0.62, base = iy0 + ih - 14, Y = (y) => base - (y + SP_L0) * si, cx = ix0 + iw / 2, tw = 0.09 * si;
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.15)" : "rgba(148,163,184,0.25)"; ctx.fillRect(cx - tw / 2 - 4, Y(0.33), tw + 8, base - Y(0.33));
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - tw / 2 - 4, Y(0.33)); ctx.lineTo(cx - tw / 2 - 4, base); ctx.lineTo(cx + tw / 2 + 4, base); ctx.lineTo(cx + tw / 2 + 4, Y(0.33)); ctx.stroke();
  const top = spr.phase === "ready" ? -spr.x : Math.min(0, spr.y), nz = 14;
  ctx.strokeStyle = c.text; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx, base);
  for (let i = 1; i < nz; i++) ctx.lineTo(cx + (i % 2 ? -tw / 2 : tw / 2), base + ((Y(top) - base) * i) / nz); ctx.lineTo(cx, Y(top)); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.fillRect(cx - tw / 2, Y(top) - 3, tw, 4);
  // erkin uzunlik belgisi va siqilish
  ctx.save(); ctx.strokeStyle = c.text3; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx - tw, Y(0)); ctx.lineTo(cx + tw + 30, Y(0)); ctx.stroke(); ctx.restore();
  ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("erkin holat", cx + tw / 2 + 8, Y(0) - 2);
  if (spr.x > 0.002 && spr.phase === "ready") { const xx = cx + tw / 2 + 14; ctx.strokeStyle = COL.s; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xx, Y(0)); ctx.lineTo(xx, Y(-spr.x)); ctx.stroke(); tag(ctx, `x = ${fmt(spr.x * 100, 1)} cm`, xx + 4, (Y(0) + Y(-spr.x)) / 2, { color: COL.s, bg: c.bg, font: MID, pad: 3 }); }
  // sharcha (kattalashtirilgan)
  const yb = spr.phase === "ready" ? -spr.x : spr.y;
  if (yb < 0.33) { ctx.fillStyle = "#ea580c"; circle(ctx, cx, Y(yb) - SP_R * si, SP_R * si); ctx.fill(); }
  geo.spr.ball = { x: cx, y: Y(yb) - SP_R * si, r: Math.max(16, SP_R * si + 6), Y0: Y(0), si };
  // to'liq balandlik ko'rinishi
  const vx0 = ix0 + iw + 12, vw = cw - vx0 - (narrow ? 8 : 150), H = 6.5, sv = (ch - 36) / (H + 0.3), gy = ch - 14, YV = (y) => gy - y * sv, X = vx0 + vw * 0.35;
  ctx.fillStyle = c.dark ? "#3f3a33" : "#e7e1d6"; ctx.fillRect(vx0, gy, vw, ch - gy);
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let y = 0; y <= 6; y += 0.5) { ctx.beginPath(); ctx.moveTo(vx0 + 30, YV(y)); ctx.lineTo(vx0 + vw, YV(y)); ctx.globalAlpha = y % 1 ? 0.35 : 1; ctx.stroke(); ctx.globalAlpha = 1; if (y % 1 === 0) ctx.fillText(`${y} m`, vx0 + 26, YV(y)); }
  ctx.fillStyle = c.text2; ctx.fillRect(X - 6, YV(0.3), 12, gy - YV(0.3));
  const Hp = P.launchHeight(spr.k, spr.x, spr.m, g0) - spr.x; // erkin uchdan
  ctx.save(); ctx.strokeStyle = COL.s; ctx.globalAlpha = 0.6; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(X - 30, YV(0.3 + Hp)); ctx.lineTo(X + 60, YV(0.3 + Hp)); ctx.stroke(); ctx.restore();
  tag(ctx, `kutilgan: ${fmt(Hp + spr.x, 2)} m`, X + 64, YV(0.3 + Hp), { color: COL.s, bg: c.bg, font: SMALL, pad: 3 });
  if (spr.ymax > -0.5) { ctx.strokeStyle = c.success; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X - 30, YV(0.3 + spr.ymax)); ctx.lineTo(X + 30, YV(0.3 + spr.ymax)); ctx.stroke(); tag(ctx, `H = ${fmt(spr.ymax + spr.x, 2)} m`, X - 34, YV(0.3 + spr.ymax), { color: c.success, bg: c.bg, align: "right", font: BOLD }); }
  const by = YV(0.3 + Math.max(yb, -spr.x)) - 5;
  ctx.fillStyle = "#ea580c"; circle(ctx, X, by, 5); ctx.fill();
  if (ui.show.vec && Math.abs(spr.v) > 0.05 && spr.phase === "run") arrow(ctx, X + 12, by, 0, -spr.v * 6, c.primary, { width: 2.4, head: 9, label: "v", font: LBL });
  // energiya ustunlari
  const Epr = yb < 0 ? 0.5 * spr.k * yb * yb : 0, Ek = 0.5 * spr.m * spr.v * spr.v, Ep = spr.m * g0 * (yb + spr.x), Etot = 0.5 * spr.k * spr.x * spr.x;
  const items = [{ label: "Eₚᵣ", val: spr.phase === "ready" ? Etot : Epr, col: COL.s }, { label: "Eₖ", val: spr.phase === "ready" ? 0 : Ek, col: COL.k }, { label: "Eₚ", val: spr.phase === "ready" ? 0 : Ep, col: COL.p }];
  if (!narrow) bars(ctx, c, cw - 142, 8, 134, ch - 16, items, "Energiya", Etot);
  else tagIn(ctx, `Eₚᵣ = kx²/2 = ${fmtJ(Etot)}`, cw - 8, 14, cw, { color: COL.s, bg: c.bg2, align: "right", font: MID });
}
function stepSpring(dt) {
  if (spr.phase === "done") { spr.wait -= dt; if (spr.wait <= 0) resetSpring(); return; }
  if (spr.phase !== "run") return;
  const r = P.springBallStep(spr, dt * 0.6, spr.k, spr.m, g0); spr.t += dt * 0.6;
  if (r.v < 0 && spr.v >= 0) { spr.ymax = r.y; spr.pts.push({ x: spr.x, H: r.y + spr.x, k: spr.k, m: spr.m }); if (spr.pts.length > 40) spr.pts.shift(); }
  spr.y = r.y; spr.v = r.v;
  if (spr.v < 0 && spr.y <= 0) { spr.y = 0; spr.v = 0; spr.phase = "done"; spr.wait = 1.2; }
}
function startSpring() { if (spr.phase !== "ready") return; Object.assign(spr, { y: -spr.x, v: 0, phase: "run", ymax: -1, t: 0 }); if (!loop.running) loop.start(); }
function resetSpring() { Object.assign(spr, { y: -spr.x, v: 0, phase: "ready", t: 0 }); }
function drawSpringGraph(ctx, gst) {
  const c = gst.colors, pts = spr.pts, x1 = 240, Hm = (spr.k * 0.0225) / (2 * spr.m * g0);
  const top = Math.max(1, Hm, ...pts.map((p) => p.H)) * 1.1, yt = ticks(0, top, 4);
  const f = frame(ctx, gst, { xMin: 0, xMax: x1, yMin: 0, yMax: top, xTicks: [0, 50, 100, 150, 200], yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, yt.step >= 1 ? 0 : 1), xUnit: "x², cm²", yLabel: "H, m" });
  ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  ctx.strokeStyle = COL.s; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(0)); ctx.lineTo(f.X(x1), f.Y((spr.k * (x1 / 1e4)) / (2 * spr.m * g0))); ctx.stroke(); ctx.setLineDash([]);
  pts.forEach((p) => { const same = p.k === spr.k && p.m === spr.m; ctx.globalAlpha = same ? 1 : 0.3; ctx.fillStyle = c.primary; ctx.beginPath(); ctx.arc(f.X(p.x * p.x * 1e4), f.Y(p.H), 5, 0, TAU); ctx.fill(); });
  ctx.globalAlpha = 1; ctx.restore();
  legend(ctx, [{ color: COL.s, label: `nazariya H = kx²/(2mg), k = ${fmt(spr.k, 0)} N/m, m = ${fmt(spr.m * 1000, 0)} g`, dash: [6, 4] }], f.padL + 50, 9, c);
}

/* ------------------------------------------------------------------ Asosiy chizish */

function draw(ctx, st) {
  ctx.fillStyle = st.colors.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "work") (ui.sub === "lift" ? drawLift : drawPull)(ctx, st); else if (ui.mode === "park") drawPark(ctx, st); else drawSpring(ctx, st);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.46, vh * 0.44), 280, 370)), graph: Math.round(clamp(vh * 0.24, 160, 220)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });
function drawGraphCanvas(ctx, gst) { if (ui.mode === "park") return drawParkGraph(ctx, gst); if (ui.mode === "spring") return drawSpringGraph(ctx, gst); ctx.fillStyle = gst.colors.bg; ctx.fillRect(0, 0, gst.w, gst.h); }
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const J = (v) => (Math.abs(v) >= 10000 ? `${fmt(v / 1000, 2)}<small>kJ</small>` : `${fmt(v, Math.abs(v) < 10 ? 2 : 1)}<small>J</small>`);
function updateReadouts() {
  if (ui.mode === "work" && ui.sub === "pull") {
    const fs = P.pullForces({ M: pull.M, F: pull.F, alpha: pull.alpha, mu: pull.mu, v: 1 }), Ek = 0.5 * pull.M * pull.v * pull.v;
    setRO("r1", "Tortish kuchi ishi <i>A_F</i>", J(pull.AF), `A = F·s·cos α = ${fmt(pull.F, 0)}·${fmt(pull.s, 1)}·cos ${fmt(pull.alpha / DEG, 0)}° = ${fmt(pull.F * pull.s * Math.cos(pull.alpha), 0)} J`);
    setRO("r2", "Ishqalanish ishi <i>A_f</i>", J(pull.Af), `f = μ(mg − F sin α) = ${fmt(fs.f, 1)} N`, pull.mu ? "" : "muted");
    setRO("r3", "Ishlar yig‘indisi <i>ΣA</i>", J(pull.AF + pull.Af), "og‘irlik va N ishi nol (s ga tik)");
    setRO("r4", "Kinetik energiya <i>E_k</i>", J(Ek), `v = ${fmt(pull.v, 2)} m/s; ΣA = ΔEₖ`);
    setRO("r5", "Vaqt <i>t</i>", pull.tFin !== null ? `${fmt(pull.tFin, 2)}<small>s</small>` : `${fmt(pull.t, 2)}<small>s</small>`, pull.tFin !== null ? "marragacha" : "harakat");
    setRO("r6", "O‘rtacha quvvat <i>P</i>", pull.tFin !== null ? `${fmt(pull.AFfin / pull.tFin, 1)}<small>W</small>` : "—", "P = A_F/t", pull.tFin !== null ? "" : "muted");
  } else if (ui.mode === "work") {
    const A = lift.m * g0 * lift.h, v1 = P.liftSpeed(lift.P1, lift.m), v2 = P.liftSpeed(lift.P2, lift.m);
    setRO("r1", "Bajarilgan ish <i>A</i>", J(A), "A = mgh — ikkalasida bir xil");
    setRO("r2", "1-yuk tezligi", `${fmt(v1, 2)}<small>m/s</small>`, `v = P/(mg); F = mg = ${fmt(lift.m * g0, 0)} N`);
    setRO("r3", "2-yuk tezligi", `${fmt(v2, 2)}<small>m/s</small>`, "P = F·v");
    setRO("r4", "1-dvigatel vaqti", lift.t1 !== null ? `${fmt(lift.t1, 2)}<small>s</small>` : "—", `P₁ = ${fmt(lift.P1, 0)} W`, lift.t1 !== null ? "" : "muted");
    setRO("r5", "2-dvigatel vaqti", lift.t2 !== null ? `${fmt(lift.t2, 2)}<small>s</small>` : "—", `P₂ = ${fmt(lift.P2, 0)} W`, lift.t2 !== null ? "" : "muted");
    setRO("r6", "Vaqtlar nisbati <i>t₁/t₂</i>", lift.t1 !== null && lift.t2 !== null ? fmt(lift.t1 / lift.t2, 2) : "—", `P₂/P₁ = ${fmt(lift.P2 / lift.P1, 2)}`);
  } else if (ui.mode === "park") {
    const e = parkE();
    setRO("r1", "Kinetik energiya <i>Eₖ</i>", J(e.Ek), `v = ${fmt(Math.abs(park.v), 2)} m/s`);
    setRO("r2", "Potensial energiya <i>Eₚ</i>", J(e.Ep), `h = ${fmt(e.h - park.yref, 2)} m (Eₚ = 0 sathidan)`);
    setRO("r3", "Issiqlik <i>Q</i>", J(e.Q), park.mu ? `μ = ${fmt(park.mu, 2)}` : "ishqalanish yo‘q", park.mu ? "orange" : "muted");
    setRO("r4", "To‘liq energiya", J(e.E), "Eₖ + Eₚ + Q = const");
    setRO("r5", "Mexanik energiya", J(e.Ek + e.Ep), park.mu ? "kamayib boradi" : "saqlanadi");
    setRO("r6", "Massa va g", `${fmt(park.m, 0)}<small>kg</small>`, `g = ${fmt(park.g, 2)} m/s²`);
  } else {
    const Etot = 0.5 * spr.k * spr.x * spr.x, Hth = P.launchHeight(spr.k, spr.x, spr.m, g0), last = spr.pts[spr.pts.length - 1];
    setRO("r1", "Prujina energiyasi", J(Etot), `kx²/2, x = ${fmt(spr.x * 100, 1)} cm`);
    setRO("r2", "Kutilgan balandlik", `${fmt(Hth, 2)}<small>m</small>`, "H = kx²/(2mg)");
    setRO("r3", "O‘lchangan balandlik", spr.ymax > -0.5 ? `${fmt(spr.ymax + spr.x, 2)}<small>m</small>` : "—", "eng past nuqtadan", spr.ymax > -0.5 ? "" : "muted");
    setRO("r4", "Uchib chiqish tezligi", `${fmt(Math.sqrt(Math.max(0, (spr.k / spr.m) * spr.x * spr.x - 2 * g0 * spr.x)), 2)}<small>m/s</small>`, "prujinadan ajralganda");
    setRO("r5", "Tezlik (hozir)", `${fmt(Math.abs(spr.v), 2)}<small>m/s</small>`, spr.phase === "run" ? (spr.v > 0 ? "yuqoriga" : "pastga") : "—");
    setRO("r6", "k (o‘lchovdan)", last ? `${fmt((2 * last.m * g0 * last.H) / (last.x * last.x), 0)}<small>N/m</small>` : "—", "k = 2mgH/x²", last ? "" : "muted");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "work" && ui.sub === "pull") { t = { ready: "Tayyor", run: "Tortilmoqda", coast: "Inersiya bilan", done: "To‘xtadi", stuck: "Qo‘zg‘almadi" }[pull.phase]; tone = { ready: "blue", run: "green", coast: "orange", done: "purple", stuck: "red" }[pull.phase]; }
  else if (ui.mode === "work") { t = lift.phase === "ready" ? "Tayyor" : lift.phase === "run" ? "Ko‘tarilmoqda" : "Marraga yetdi"; tone = lift.phase === "done" ? "green" : "blue"; }
  else if (ui.mode === "park") { t = park.hold ? "Qo‘yib yuboring" : park.mu ? "Mexanik energiya kamaymoqda" : "Energiya saqlanmoqda"; tone = park.mu ? "orange" : "green"; }
  else { t = { ready: "Siqilgan", run: "Uchmoqda", done: "Ushlab olindi" }[spr.phase]; tone = spr.phase === "run" ? "green" : "blue"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "work" && ui.sub === "pull") {
    p.push("<p><b>Mexanik ish</b> — kuch bilan jism ko‘chishi ko‘paytmasi: A = F·s·cos α. Faqat ko‘chish yo‘nalishidagi tashkil etuvchi F·cos α ish bajaradi; og‘irlik kuchi va tayanch reaksiyasi ko‘chishga tik — ularning ishi nol. Ishqalanish kuchi harakatga qarshi — uning ishi manfiy.</p>");
    p.push("<p>Barcha kuchlar ishlarining yig‘indisi kinetik energiya o‘zgarishiga teng (ustunlarda ΣA = ΔEₖ). Ipni yuqoriroq ko‘tarsangiz, F·cos α kamayadi, lekin tayanch reaksiyasi va ishqalanish ham kamayadi.</p>");
  } else if (ui.mode === "work") {
    p.push("<p><b>Quvvat</b> — ishning bajarilish tezligi: P = A/t. Ikkala lebyodka bir xil ish A = mgh bajaradi, ammo quvvati katta dvigatel uni tezroq bajaradi: vaqtlar quvvatlarga teskari proporsional.</p>");
    p.push("<p>Yuk tekis ko‘tarilganda dvigatel kuchi F = mg, demak P = F·v va v = P/(mg): quvvat 2 marta katta bo‘lsa, yuk 2 marta tez ko‘tariladi.</p>");
  } else if (ui.mode === "park") {
    p.push("<p>Ishqalanish bo‘lmasa <b>to‘liq mexanik energiya saqlanadi</b>: Eₖ + Eₚ = const. Pastga tushganda potensial energiya kinetikka aylanadi, ko‘tarilganda — aksincha; skeytchi boshlang‘ich balandlikdan yuqoriga chiqa olmaydi.</p>");
    p.push(park.mu ? "<p>Ishqalanish mexanik energiyaning bir qismini <b>issiqlikka</b> (Q) aylantiradi: Eₖ + Eₚ + Q = const. Skeytchi har safar pastroq ko‘tariladi va oxiri chuqurda to‘xtaydi.</p>" : "<p>«Eₚ = 0» sathini suring: potensial energiya qiymati (hatto ishorasi) o‘zgaradi, lekin harakat o‘zgarmaydi — fizik ma’noga faqat energiyalar farqi ega. Oy yoki Yupiterda energiyalar boshqacha, ammo burilish nuqtalari o‘sha balandlikda.</p>");
  } else {
    p.push("<p>Siqilgan prujina <b>potensial energiya</b> to‘playdi: Eₚᵣ = kx²/2. Qo‘yib yuborilganda u avval sharchaning kinetik energiyasiga, so‘ng balandlik potensial energiyasiga aylanadi: kx²/2 = mgH.</p>");
    p.push("<p>Siqilish 2 marta ortsa, balandlik 4 marta ortadi (H ~ x²). H(x²) grafigidagi nuqtalar to‘g‘ri chiziqda yotadi; qiyaligidan k = 2mg·H/x² ni toping.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "work" ? (ui.sub === "lift" ? "<small>Quvvat</small> P = A/t = F·v" : "<small>Ish</small> A = F·s·cos α") : ui.mode === "park" ? "<small>Saqlanish</small> Eₖ + Eₚ + Q = const" : "<small>Prujina</small> kx²/2 = mgH";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
const actBtn = $("[data-action]");
function updateAction() {
  let t = "", dis = false;
  if (ui.mode === "work" && ui.sub === "pull") { t = pull.phase === "ready" ? "Tortish" : "Qaytadan"; dis = pull.phase === "run"; }
  else if (ui.mode === "work") { t = lift.phase === "ready" ? "Ko‘tarish" : "Qaytadan"; dis = lift.phase === "run"; }
  else if (ui.mode === "park") t = "Yuqoridan qo‘yib yuborish";
  else { t = spr.phase === "ready" ? "Otish" : "Qaytadan siqish"; dis = spr.phase === "run"; }
  if (actBtn.textContent !== t) actBtn.textContent = t; actBtn.disabled = dis;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); updateAction(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "work") (ui.sub === "lift" ? stepLift : stepPull)(dt); else if (ui.mode === "park") stepPark(dt); else stepSpring(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); updateStatus(); updateAction(); graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => loop.toggle());
function topStart() { let best = 0, by = -1; for (let i = 0; i < park.tr.xs.length; i++) if (park.tr.ys[i] > by && i < park.tr.xs.length / 2) { by = park.tr.ys[i]; best = park.tr.S[i]; } return Math.min(best + 0.35, park.tr.L); }
function resetMode() {
  if (ui.mode === "work") (ui.sub === "lift" ? resetLift : resetPull)();
  else if (ui.mode === "park") placeSkater(topStart());
  else resetSpring();
}
$("[data-reset]").addEventListener("click", () => { resetMode(); refresh(); });
actBtn.addEventListener("click", () => {
  if (ui.mode === "work" && ui.sub === "pull") { if (pull.phase === "ready") startPull(); else resetPull(); }
  else if (ui.mode === "work") { if (lift.phase === "ready") { lift.phase = "run"; if (!loop.running) loop.start(); } else resetLift(); }
  else if (ui.mode === "park") { placeSkater(topStart()); if (!loop.running) loop.start(); }
  else if (spr.phase === "ready") startSpring(); else resetSpring();
  customized(); refresh();
});
$("[data-meas-clear]").addEventListener("click", () => { spr.pts = []; refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const pr2 = () => { if (pull.phase !== "ready") resetPull(); };
const wFC = bindRange($("#wF"), $("#wFOut"), (v) => `${fmt(v, 0)} N`, (v) => { pull.F = v; pr2(); customized(); refresh(); });
const wAC = bindRange($("#wA"), $("#wAOut"), (v) => `${fmt(v, 0)}°`, (v) => { pull.alpha = v * DEG; pr2(); customized(); refresh(); });
const wMC = bindRange($("#wM"), $("#wMOut"), (v) => `${fmt(v, 0)} kg`, (v) => { pull.M = v; pr2(); customized(); refresh(); });
const wMuC = bindRange($("#wMu"), $("#wMuOut"), (v) => fmt(v, 2), (v) => { pull.mu = v; pr2(); customized(); refresh(); });
const wSC = bindRange($("#wS"), $("#wSOut"), (v) => `${fmt(v, 1)} m`, (v) => { pull.s = v; pr2(); customized(); refresh(); });
const lr = () => { if (lift.phase !== "ready") resetLift(); };
const pP1C = bindRange($("#pP1"), $("#pP1Out"), (v) => `${fmt(v, 0)} W`, (v) => { lift.P1 = v; lr(); customized(); refresh(); });
const pP2C = bindRange($("#pP2"), $("#pP2Out"), (v) => `${fmt(v, 0)} W`, (v) => { lift.P2 = v; lr(); customized(); refresh(); });
const pMC = bindRange($("#pM"), $("#pMOut"), (v) => `${fmt(v, 0)} kg`, (v) => { lift.m = v; lr(); customized(); refresh(); });
const pHC = bindRange($("#pH"), $("#pHOut"), (v) => `${fmt(v, 1)} m`, (v) => { lift.h = v; lr(); customized(); refresh(); });
const kMC = bindRange($("#kM"), $("#kMOut"), (v) => `${fmt(v, 0)} kg`, (v) => { park.m = v; placeSkater(park.s); customized(); refresh(); });
const kMuC = bindRange($("#kMu"), $("#kMuOut"), (v) => fmt(v, 2), (v) => { park.mu = v; customized(); refresh(); });
document.querySelectorAll("[data-track-value]").forEach((b) => b.addEventListener("click", () => { park.track = b.dataset.trackValue; park.pts = TRACKS[park.track].map((p) => p.slice()); rebuild(); placeSkater(topStart()); syncAll(); customized(); refresh(); }));
document.querySelectorAll("[data-planet-value]").forEach((b) => b.addEventListener("click", () => { park.g = +b.dataset.planetValue; placeSkater(park.s); syncAll(); customized(); refresh(); }));
const sr = () => { if (spr.phase !== "ready") resetSpring(); };
const sKC = bindRange($("#sK"), $("#sKOut"), (v) => `${fmt(v, 0)} N/m`, (v) => { spr.k = v; sr(); customized(); refresh(); });
const sMC = bindRange($("#sM"), $("#sMOut"), (v) => `${fmt(v * 1000, 0)} g`, (v) => { spr.m = v; sr(); customized(); refresh(); });
const sXC = bindRange($("#sX"), $("#sXOut"), (v) => `${fmt(v, 1)} cm`, (v) => { spr.x = v / 100; sr(); resetSpring(); customized(); refresh(); });
document.querySelectorAll("[data-sub-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.subValue !== ui.sub) loadPreset(b.dataset.subValue === "lift" ? "power" : "pull"); }));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* Sahnadagi boshqaruv */
const canvas = stage.canvas;
let drag = null, dragY0 = 0, dragV0 = 0;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
const hitR = (p, b) => b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r;
function hitTest(p) {
  if (ui.mode === "work" && ui.sub === "pull") { const g = geo.pull || {}; if (pull.phase === "ready") { if (hitR(p, g.mm)) return "mm"; if (hitR(p, g.mp)) return "mp"; if (hitR(p, g.tip)) return "tip"; } if (inBox(p, g.flag)) return "flag"; return null; }
  if (ui.mode === "work") { const g = geo.lift || {}; if (hitR(p, g.k1)) return "k1"; if (hitR(p, g.k2)) return "k2"; if (inBox(p, g.line)) return "hline"; return null; }
  if (ui.mode === "park") { const g = geo.park || {}; if (inBox(p, g.ref)) return "ref"; for (const q of g.pts || []) if (hitR(p, q)) return "pt" + q.i; if (hitR(p, g.sk)) return "sk"; return null; }
  const g = geo.spr || {}; if (spr.phase !== "run" && hitR(p, g.ball)) return "ball"; return null;
}
const CURSOR = { tip: "grab", flag: "ew-resize", k1: "ns-resize", k2: "ns-resize", hline: "ns-resize", ref: "ns-resize", sk: "grab", ball: "ns-resize", mm: "pointer", mp: "pointer" };
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  if (h === "mm" || h === "mp") { pull.M = clamp(pull.M + (h === "mp" ? 5 : -5), 5, 40); wMC.set(pull.M); customized(); refresh(); return; }
  drag = h; dragY0 = p.y; dragV0 = h === "k1" ? lift.P1 : h === "k2" ? lift.P2 : 0;
  if (h === "sk") park.hold = true;
  if (h === "ball" && spr.phase === "done") resetSpring();
  canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  onDrag(p);
});
function onDrag(p) {
  const w = toWorld(p.x, p.y), dy = dragY0 - p.y;
  if (drag === "tip") { const g = geo.pull.tip; if (!g) return; const dx = p.x - g.ox, dyy = g.oy - p.y; pull.alpha = clamp(Math.round(Math.atan2(dyy, dx) / DEG), 0, 70) * DEG; pull.F = clamp(Math.round(Math.hypot(dx, dyy) / g.kF), 0, 150); wAC.set(Math.round(pull.alpha / DEG)); wFC.set(pull.F); }
  else if (drag === "flag") { pr2(); pull.s = clamp(Math.round((w.x - boxSide()) * 10) / 10, 1, Math.min(6, geo.pull.wall - 1.2)); wSC.set(pull.s); }
  else if (drag === "k1" || drag === "k2") { lr(); const v = clamp(Math.round((dragV0 + dy * 12) / 50) * 50, 100, 3000); if (drag === "k1") { lift.P1 = v; pP1C.set(v); } else { lift.P2 = v; pP2C.set(v); } }
  else if (drag === "hline") { lr(); lift.h = clamp(Math.round(w.y * 2) / 2, 2, 12); pHC.set(lift.h); }
  else if (drag === "ref") { park.yref = clamp(Math.round(w.y * 4) / 4, -0.5, 6.5); }
  else if (drag && drag.startsWith("pt")) {
    const i = +drag.slice(2), n = park.pts.length, x = i === 0 ? 0 : i === n - 1 ? 12 : clamp(w.x, park.pts[i - 1][0] + 0.8, park.pts[i + 1][0] - 0.8);
    park.pts[i] = [Math.round(x * 10) / 10, clamp(Math.round(w.y * 10) / 10, 0, 7)]; rebuild(); placeSkater(park.s);
  }
  else if (drag === "sk") { placeSkater(park.tr.nearest(w.x, w.y)); }
  else if (drag === "ball") { const g = geo.spr.ball; spr.x = clamp(Math.round(((p.y - g.Y0) / g.si) * 200) / 2, 1, 15) / 100; sXC.set(spr.x * 100); resetSpring(); }
  customized(); refresh();
}
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? CURSOR[h] || "grab" : ""; return; } onDrag(p); });
function endDrag() { if (drag === "sk") { park.hold = false; if (!loop.running) loop.start(); } drag = null; canvas.dataset.dragging = "false"; refresh(); }
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  pull: { mode: "work", sub: "pull", title: "Qutini tortish: A = Fs·cos α", lesson: "60 N kuch 30° burchak ostida qutini 4 m ga tortadi. «Tortish»ni bosing: ustunlarda har bir kuchning ishi. F o‘qi uchini surib kuch va burchakni, bayroqni surib ko‘chishni o‘zgartiring.", set: () => Object.assign(pull, { F: 60, alpha: 30 * DEG, M: 20, mu: 0.2, s: 4 }) },
  noFric: { mode: "work", sub: "pull", title: "Ishqalanishsiz: ΣA = ΔEₖ", lesson: "Ishqalanish yo‘q: tortish kuchining butun ishi kinetik energiyaga aylanadi. Marradan keyin quti o‘zgarmas tezlik bilan ketadi.", set: () => Object.assign(pull, { F: 50, alpha: 0, M: 20, mu: 0, s: 4 }) },
  angle: { mode: "work", sub: "pull", title: "Burchak 60°: ish kamayadi", lesson: "cos 60° = 0,5 — kuchning faqat yarmi ish bajaradi. Gorizontal tortish (α = 0) bilan solishtiring.", set: () => Object.assign(pull, { F: 80, alpha: 60 * DEG, M: 20, mu: 0.1, s: 4 }) },
  power: { mode: "work", sub: "lift", title: "Quvvat: ikki lebyodka", lesson: "Ikkala dvigatel 50 kg yukni 10 m ga ko‘taradi — ish bir xil (4,9 kJ). 1000 W li dvigatel 500 W lidan 2 marta tez. Dastaklarni burab quvvatni o‘zgartiring.", set: () => Object.assign(lift, { P1: 500, P2: 1000, m: 50, h: 10 }) },
  pipe: { mode: "park", title: "Yarim quvur: Eₖ ⇄ Eₚ", lesson: "Ishqalanish yo‘q: skeytchi har ikki tomonda bir xil balandlikka ko‘tariladi, to‘liq energiya ustuni o‘zgarmaydi. Skeytchini surib boshqa joydan qo‘yib yuboring.", set: () => Object.assign(park, { track: "pipe", pts: TRACKS.pipe.map((p) => p.slice()), m: 50, mu: 0, g: 9.81, yref: 0 }) },
  fric: { mode: "park", title: "Ishqalanish: issiqlik Q", lesson: "μ = 0,08: har tebranishda mexanik energiyaning bir qismi issiqlikka aylanadi, skeytchi asta pasayib, chuqurda to‘xtaydi. To‘liq energiya (E) baribir saqlanadi.", set: () => Object.assign(park, { track: "pipe", pts: TRACKS.pipe.map((p) => p.slice()), m: 50, mu: 0.08, g: 9.81, yref: 0 }) },
  hills: { mode: "park", title: "Tepalikdan oshib o‘tish", lesson: "O‘rtadagi tepalik 3 m: skeytchi 6 m dan tushsa oshib o‘tadi. Uni 3 m dan pastroq joydan qo‘yib yuboring — oshib o‘ta olmaydi (E(x) diagrammasida qizil soha).", set: () => Object.assign(park, { track: "hills", pts: TRACKS.hills.map((p) => p.slice()), m: 50, mu: 0, g: 9.81, yref: 0 }) },
  moon: { mode: "park", title: "Oyda skeytpark", lesson: "Oyda g 6 marta kichik: energiyalar ham 6 marta kichik, harakat sekin — lekin skeytchi baribir xuddi shu balandlikka ko‘tariladi.", set: () => Object.assign(park, { track: "pipe", pts: TRACKS.pipe.map((p) => p.slice()), m: 50, mu: 0, g: 1.62, yref: 0 }) },
  spring: { mode: "spring", title: "Prujinali otgich", lesson: "k = 200 N/m prujina 8 cm siqilgan: kx²/2 = 0,64 J. «Otish»ni bosing — 200 g sharcha ≈ 0,33 m ga ko‘tariladi. Sharchani surib siqilishni o‘zgartiring va o‘lchovlarni grafikka yig‘ing.", set: () => Object.assign(spr, { k: 200, m: 0.2, x: 0.08, pts: [] }) },
  springK: { mode: "spring", title: "Bikr prujina: k ni o‘lchash", lesson: "k = 450 N/m. Siqilishni 5, 10, 15 cm qilib otib ko‘ring: H(x²) nuqtalari to‘g‘ri chiziqda; qiyaligidan k ni hisoblang.", set: () => Object.assign(spr, { k: 450, m: 0.1, x: 0.1, pts: [] }) },
};
const GROUPS = [["Ish va quvvat", ["pull", "noFric", "angle", "power"]], ["Energiya saqlanishi", ["pipe", "fric", "hills", "moon"]], ["Prujina energiyasi", ["spring", "springK"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  wFC.set(pull.F); wAC.set(Math.round(pull.alpha / DEG)); wMC.set(pull.M); wMuC.set(pull.mu); wSC.set(pull.s);
  pP1C.set(lift.P1); pP2C.set(lift.P2); pMC.set(lift.m); pHC.set(lift.h);
  kMC.set(park.m); kMuC.set(park.mu);
  document.querySelectorAll("[data-track-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.trackValue === park.track)));
  document.querySelectorAll("[data-planet-value]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.planetValue === park.g)));
  sKC.set(spr.k); sMC.set(spr.m); sXC.set(spr.x * 100);
  document.querySelectorAll("[data-sub-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.subValue === ui.sub)));
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { pull: "F o‘qi uchi, marra bayrog‘i va yuk «+»/«−»", lift: "Quvvat dastaklarini burang, marra chizig‘ini suring", park: "Skeytchini, yo‘l nuqtalarini va Eₚ = 0 sathini suring", spring: "Sharchani pastga surib prujinani siqing" };
const DHINT = { pull: "Quti ustidagi «+»/«−» massani o‘zgartiradi; F o‘qining uchini surib kuch va burchakni o‘rnating.", lift: "Dvigatellar ustidagi dastaklarni yuqoriga-pastga surib quvvatni o‘zgartiring." };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-dctl]").forEach((el) => { el.hidden = el.dataset.dctl !== ui.sub; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode === "work" ? ui.sub : ui.mode];
  $("[data-dhint]").textContent = DHINT[ui.sub] || "";
  const gc = $("[data-graph-card]"); gc.hidden = ui.mode === "work"; $("[data-meas-clear]").hidden = ui.mode !== "spring";
  if (ui.mode === "park") { $("[data-graph-title]").textContent = "Energiya diagrammasi E(x)"; $("[data-graph-sub]").textContent = "Ko‘k egri — yo‘l bo‘ylab potensial energiya, punktir — mexanik energiya. Ularning farqi (yashil kesma) — kinetik energiya. Qizil sohaga skeytchi kira olmaydi: kesishish nuqtalari — burilish nuqtalari."; }
  if (ui.mode === "spring") { $("[data-graph-title]").textContent = "Ko‘tarilish balandligi H(x²) — o‘lchovlar"; $("[data-graph-sub]").textContent = "Har otishda eng yuqori nuqta nuqta bo‘lib tushadi. H siqilish kvadratiga proporsional: to‘g‘ri chiziq qiyaligi k/(2mg). Xira nuqtalar — boshqa k yoki m bilan o‘lchangan."; }
  window.dispatchEvent(new Event("resize"));
}
const MODE_DEFAULT = { work: "pull", park: "pipe", spring: "spring" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; if (p.sub) ui.sub = p.sub;
  p.set(); if (p.mode === "park") rebuild();
  resetMode(); setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "pull");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
