// ==========================================================================
// Aylana bo'ylab harakat — virtual laboratoriya (simulations/circular-motion.html)
// 1) Kinematika: v, R, a_τ — tezlik va tezlanish vektorlari, proyeksiyalar (garmonik tebranish), tezlik godografi;
//    jismni va v vektori uchini sudrash.
// 2) Markazga intilma kuch: ipdagi sharcha (taranglik shkalasi, uzilish, ipni kesish → urinma bo'ylab),
//    burilishdagi avtomobil (spidometr mili va yo'l qiyaligini sudrash, ishqalanish, sirpanish),
//    vertikal halqa (sharchani tepalikda sudrash, h ≥ 2,5R, ajralish, parabola, energiya).
// 3) Uzatmalar: tasmali, tishli, velosiped (g'ildirak chetini sudrash).
// Fizika: circular-physics.js (Node'da tekshirilgan). Grafiklar: circular-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow, angleArc } from "./sim-kit.js";
import * as P from "./circular-physics.js";
import * as G from "./circular-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180, GRAV = P.G;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const LBL = "italic 700 13px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "kin", sub: "string", tab: "xy", show: { vec: true } };
const KMAX = 4, KVS = 20, SPIN = 0.3, MOD = 1, LOOP_RATE = 0.5, RW = 35;
const kin = { v0: 1.5, v: 1.5, R: 0.6, at: 0, th: 0, th0: 0, t: 0, hist: [], hold: false };
const str = { v0: 3, v: 3, m: 0.2, R: 0.6, Fmax: 5, th: 0, t: 0, on: true, why: "", fly: null, spin: false, hist: [], wait: 0, hold: false, rate: 1 };
const car = { v: 60 / 3.6, R: 60, mu: 0.7, alpha: 0, th: -Math.PI / 2, M: 1200, skid: null, trail: [], off: "", wait: 0 };
const TR = P.makeTrack();
const lp = { k: 3, R: 0.5, s: 0, w: 0, phase: "run", fly: null, det: null, t: 0, hist: [], wait: 0, top: 0, done: "" };
const blt = { type: "belt", n1: 0.5, R1: 12, R2: 6, th1: 0, th2: 0, s: 0, xb: 0, N1: 0, N2: 0, t: 0, hist: [] };
const ROADS = {
  0.7: { name: "quruq asfalt", col: "#4b5563", line: "#f8fafc", edge: "rgba(255,255,255,0.7)" },
  0.4: { name: "ho‘l asfalt", col: "#334155", line: "#cbd5e1", edge: "rgba(186,230,253,0.75)" },
  0.2: { name: "qor", col: "#e2e8f0", line: "#94a3b8", edge: "rgba(100,116,139,0.7)" },
  0.08: { name: "muz", col: "#bae6fd", line: "#f0f9ff", edge: "rgba(14,116,144,0.6)" },
};
let presetId = null;
const geo = { k: null, s: null, c: null, l: null, b: null };
const trim = (h, t) => { while (h.length && h[0].t < t) h.shift(); };
const wrapPi = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

const kinPeriod = () => (kin.v > 1e-6 ? (TAU * kin.R) / kin.v : Infinity);
function effAt() { if (kin.at > 0 && kin.v >= KMAX - 1e-9) return 0; if (kin.at < 0 && kin.v <= 1e-9) return 0; return kin.at; }
const rateKin = () => Math.min(1, kinPeriod() / 0.8);
const strF = () => (str.on ? P.tension(str.m, str.v, str.R) : 0);
function carState() {
  const a = (car.v * car.v) / car.R, b = P.carBounds(car.mu, car.alpha);
  return { a, b, vmax: Math.sqrt(car.R * b.hi), vmin: Math.sqrt(car.R * b.lo), ok: a <= b.hi * 1.0001 && a >= b.lo * 0.9999 };
}
const carTS = () => clamp((TAU * car.R) / car.v / 7, 1, 30);
const zOf = (R) => Math.max(6, Math.round((2 * R) / MOD));
const ratio = () => blt.R1 / blt.R2;
const n2 = () => blt.n1 * ratio();
const gearPhase = () => Math.PI + Math.PI / zOf(blt.R2) - ratio() * blt.th1;

/* ------------------------------------------------------------------ Dunyo → ekran */

const view = { s: 1, ox: 0, oy: 0, x0: 0, y1: 0 };
function fit(cw, ch, x0, x1, y0, y1, pad = 6) {
  const s = Math.min((cw - 2 * pad) / (x1 - x0), (ch - 2 * pad) / (y1 - y0));
  view.s = s; view.ox = (cw - (x1 - x0) * s) / 2; view.oy = (ch - (y1 - y0) * s) / 2; view.x0 = x0; view.y1 = y1;
}
const SX = (x) => view.ox + (x - view.x0) * view.s;
const SY = (y) => view.oy + (view.y1 - y) * view.s;
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s + view.x0, y: view.y1 - (py - view.oy) / view.s });

/* ------------------------------------------------------------------ Chizish yordamchilari */

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); }
function ball(ctx, x, y, r) {
  const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, "#fed7aa"); gr.addColorStop(1, "#ea580c");
  ctx.fillStyle = gr; circle(ctx, x, y, r); ctx.fill();
  ctx.strokeStyle = "rgba(124,45,18,0.6)"; ctx.lineWidth = 1; ctx.stroke();
}
/** Yorliq ekran chetidan chiqib ketmasin. */
function tagIn(ctx, text, x, y, cw, o) {
  ctx.save(); ctx.font = o.font || MID; const w = ctx.measureText(text).width + 2 * (o.pad ?? 6); ctx.restore();
  let x0 = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  x0 = clamp(x0, 4, cw - 4 - w);
  tag(ctx, text, x0, y, { ...o, align: "left" });
}
function head(ctx, x, y, ux, uy, color, size = 7) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x + ux * size, y + uy * size);
  ctx.lineTo(x - uy * size * 0.6, y + ux * size * 0.6); ctx.lineTo(x + uy * size * 0.6, y - ux * size * 0.6); ctx.closePath(); ctx.fill();
}
const rateTag = (ctx, c, r, x, y) => { if (r < 0.98) tag(ctx, `Sekinlashtirilgan: ×${fmt(r, 2)}`, x, y, { color: c.text3, bg: c.bg2, font: SMALL }); };

/* ================================================================== 1) Kinematika */

function drawKin(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, wide = cw >= 560, RM = 1.0;
  const s = Math.min((ch / 2 - 30) / RM, wide ? (cw * 0.3) / RM : (cw / 2 - 40) / RM), kv = wide ? 30 : 22;
  const cx = wide ? Math.round(cw * 0.34) : Math.round(cw / 2 - 12), cy = Math.round(ch / 2 - 6);
  const R = kin.R * s, th = kin.th, cs = Math.cos(th), sn = Math.sin(th), bx = cx + R * cs, by = cy - R * sn;
  const tx = -sn, ty = -cs, an = (kin.v * kin.v) / kin.R, at = effAt(), a = Math.hypot(an, at);
  geo.k = { cx, cy, s, bx, by, kv, tip: null };

  // o'qlar
  ctx.save(); ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath();
  ctx.moveTo(cx - RM * s - 6, cy); ctx.lineTo(cx + RM * s + 6, cy); ctx.moveTo(cx, cy - RM * s - 6); ctx.lineTo(cx, cy + RM * s + 6); ctx.stroke(); ctx.restore();
  // proyeksiyalar (soyalar)
  const axY = cy + RM * s + 16, axX = cx + RM * s + 22;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - R, axY); ctx.lineTo(cx + R, axY); ctx.moveTo(axX, cy - R); ctx.lineTo(axX, cy + R); ctx.stroke();
  ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, axY); ctx.moveTo(bx, by); ctx.lineTo(axX, by); ctx.stroke(); ctx.restore();
  ctx.fillStyle = c.primary; circle(ctx, bx, axY, 4.5); ctx.fill();
  ctx.fillStyle = c.danger; circle(ctx, axX, by, 4.5); ctx.fill();
  ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillText("x", cx + R + 6, axY); ctx.textAlign = "center"; ctx.fillText("y", axX, cy - R - 9);
  // trayektoriya va iz
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.5; circle(ctx, cx, cy, R); ctx.stroke();
  const span = Math.min(th - kin.th0, 1.5 * Math.PI);
  if (span > 0.02) {
    ctx.save(); ctx.strokeStyle = c.primary; ctx.lineWidth = 4; ctx.lineCap = "round"; const n = 20;
    for (let i = 0; i < n; i++) { const a0 = th - span * (1 - i / n), a1 = th - span * (1 - (i + 1) / n); ctx.globalAlpha = 0.04 + 0.4 * ((i + 1) / n); ctx.beginPath(); ctx.arc(cx, cy, R, -a0, -a1, true); ctx.stroke(); }
    ctx.restore();
  }
  // radius va burilish burchagi
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.stroke();
  const phi = ((th % TAU) + TAU) % TAU;
  if (phi > 0.5 && phi < TAU - 0.3 && R > 34) angleArc(ctx, cx, cy, 15, 0, -phi, c.text3, { label: "φ", labelR: 25, font: "italic 600 12px Inter, system-ui, sans-serif" });
  ctx.fillStyle = c.text; circle(ctx, cx, cy, 3); ctx.fill();
  // vektorlar
  if (ui.show.vec) {
    const ux = (cx - bx) / (R || 1), uy = (cy - by) / (R || 1), KA = (0.62 * R) / Math.max(a, 1.5);
    if (Math.abs(at) > 1e-3) {
      const tl = Math.abs(at) * KA, skew = Math.atan2(Math.abs(at), an);
      arrow(ctx, bx, by, tx * at * KA, ty * at * KA, c.warning, { width: 2.4, head: 9, label: tl > 16 ? "a_τ" : "", font: LBL });
      arrow(ctx, bx, by, (ux * an + tx * at) * KA, (uy * an + ty * at) * KA, c.special, { width: 2.2, head: 9, label: skew > 0.22 ? "a" : "", font: LBL, dash: [5, 3] });
    }
    arrow(ctx, bx, by, ux * an * KA, uy * an * KA, c.danger, { width: 2.6, head: 10, label: "aₙ", font: LBL });
    if (kin.v > 0.01) { arrow(ctx, bx, by, tx * kin.v * kv, ty * kin.v * kv, c.primary, { width: 2.8, head: 11, label: "v", font: LBL }); geo.k.tip = { x: bx + tx * kin.v * kv, y: by + ty * kin.v * kv, tx, ty }; }
  }
  ball(ctx, bx, by, 9);

  // tezlik godografi (masshtabsiz): tezlik vektorlari bir nuqtadan
  if (wide) {
    const hx = Math.round(cw * 0.79), hy = cy, HR = clamp(ch * 0.27, 60, 100), dphi = 0.5;
    tag(ctx, "Tezlik godografi", hx, 14, { color: c.text2, bg: c.bg2, align: "center", font: SMALL });
    ctx.save(); ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); circle(ctx, hx, hy, HR); ctx.stroke(); ctx.restore();
    if (kin.v > 0.02) {
      const vp = clamp(kin.v - at * ((dphi * kin.R) / Math.max(kin.v, 0.05)), 0, KMAX), L1 = (HR * vp) / kin.v;
      const p0x = -Math.sin(th - dphi), p0y = -Math.cos(th - dphi), ax0 = hx + p0x * L1, ay0 = hy + p0y * L1, ax1 = hx + tx * HR, ay1 = hy + ty * HR;
      ctx.save(); ctx.globalAlpha = 0.5; arrow(ctx, hx, hy, ax0 - hx, ay0 - hy, c.primary, { width: 2.2, head: 9, label: "v₁", font: MID }); ctx.restore();
      arrow(ctx, hx, hy, ax1 - hx, ay1 - hy, c.primary, { width: 2.6, head: 10, label: "v₂", font: MID });
      arrow(ctx, ax0, ay0, ax1 - ax0, ay1 - ay0, c.danger, { width: 2.4, head: 9 });
      const a0 = Math.atan2(p0y, p0x);
      angleArc(ctx, hx, hy, 22, a0, a0 - dphi, c.text3, { label: "Δφ", labelR: 38, font: "italic 600 11px Inter, system-ui, sans-serif" });
      const mx = (ax0 + ax1) / 2, my = (ay0 + ay1) / 2, ml = Math.hypot(mx - hx, my - hy) || 1;
      tag(ctx, "Δv", mx + ((mx - hx) / ml) * 16, my + ((my - hy) / ml) * 16, { color: c.danger, bg: c.bg, align: "center", font: "700 11px Inter, system-ui, sans-serif", pad: 4 });
    }
    ctx.fillStyle = c.text; circle(ctx, hx, hy, 2.5); ctx.fill();
    tag(ctx, "Δv markazga qaragan → tezlanish ham", hx, ch - 14, { color: c.text3, bg: c.bg2, align: "center", font: SMALL });
  }
  tag(ctx, `R = ${fmt(kin.R * 100, 0)} cm · t = ${fmt(kin.t, 1)} s · N = ${fmt(kin.th / TAU, 2)} ayl.`, 8, 14, { color: c.text2, bg: c.bg2, font: SMALL });
  rateTag(ctx, c, rateKin(), 8, 38);
}

function stepKin(dt) {
  if (kin.hold) return;
  const h = dt * rateKin(), v1 = clamp(kin.v + kin.at * h, 0, KMAX), vm = (kin.v + v1) / 2;
  kin.th += (vm / kin.R) * h; kin.v = v1; kin.t += h;
  const an = (kin.v * kin.v) / kin.R;
  kin.hist.push({ t: kin.t, x: kin.R * Math.cos(kin.th), y: kin.R * Math.sin(kin.th), v: kin.v, an, a: Math.hypot(an, effAt()) });
  trim(kin.hist, kin.t - 14);
}

/* ================================================================== 2a) Ipdagi sharcha */

function drawString(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, wide = cw >= 560, RM = 1.0;
  const s = Math.min((ch / 2 - 24) / RM, wide ? (cw * 0.32) / RM : (cw / 2 - 52) / RM);
  const half = RM * s + 16, cx = wide ? Math.round((cw - (2 * half + 100)) / 2 + half) : Math.round(cw / 2 - 24), cy = Math.round(ch / 2);
  geo.s = { cx, cy, s, lim: { x: Math.max(cx, cw - cx) / s + 0.15, y: ch / 2 / s + 0.15 }, ball: null, tip: null };
  const R = str.R * s, F = strF(), q = F / str.Fmax;
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(cx - half, cy - half, 2 * half, 2 * half, 14); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2; circle(ctx, cx, cy, R); ctx.stroke(); ctx.restore();
  let bx, by;
  if (str.fly) { bx = cx + str.fly.x * s; by = cy - str.fly.y * s; } else { bx = cx + R * Math.cos(str.th); by = cy - R * Math.sin(str.th); }
  if (str.fly) {
    const f = str.fly, x0 = cx + f.x0 * s, y0 = cy - f.y0 * s, sp = Math.hypot(f.vx, f.vy) || 1, ux = f.vx / sp, uy = -f.vy / sp;
    ctx.save(); ctx.beginPath(); ctx.rect(cx - half, cy - half, 2 * half, 2 * half); ctx.clip();
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(x0 - ux * 2000, y0 - uy * 2000); ctx.lineTo(x0 + ux * 2000, y0 + uy * 2000); ctx.stroke(); ctx.restore(); ctx.save();
    ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
    // ip qoldiqlari
    const ex = Math.cos(f.th), ey = -Math.sin(f.th), L1 = R * 0.38;
    ctx.strokeStyle = c.text2; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + ex * L1 * 0.6 - ey * 10, cy + ey * L1 * 0.6 + ex * 10, cx + ex * L1, cy + ey * L1 + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx - ex * L1 * 0.5 + ey * 8, by - ey * L1 * 0.5 - ex * 8, bx - ex * L1 * 0.8, by - ey * L1 * 0.8 + 5); ctx.stroke();
    ctx.strokeStyle = c.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 - 5, y0 - 5); ctx.lineTo(x0 + 5, y0 + 5); ctx.moveTo(x0 + 5, y0 - 5); ctx.lineTo(x0 - 5, y0 + 5); ctx.stroke();
    tagIn(ctx, str.why === "cut" ? "ip kesildi — urinma bo‘ylab" : "ip uzildi — urinma bo‘ylab", x0 + ex * 18, y0 + ey * 18 - 4, cw, { color: c.danger, bg: c.bg, align: ex >= 0 ? "left" : "right", font: SMALL });
  } else {
    ctx.strokeStyle = q > 0.8 ? c.danger : c.text2; ctx.lineWidth = 1.5 + 1.5 * clamp(q, 0, 1); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.stroke();
  }
  ctx.fillStyle = c.text; circle(ctx, cx, cy, 5); ctx.fill(); ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; circle(ctx, cx, cy, 8.5); ctx.stroke();
  if (ui.show.vec) {
    if (str.on) {
      const tx = -Math.sin(str.th), ty = -Math.cos(str.th), ux = (cx - bx) / (R || 1), uy = (cy - by) / (R || 1), KF = (0.85 * R) / Math.max(str.Fmax, F);
      arrow(ctx, bx, by, ux * F * KF, uy * F * KF, c.danger, { width: 2.6, head: 10, label: "F", font: LBL });
      arrow(ctx, bx, by, tx * str.v * KVS, ty * str.v * KVS, c.primary, { width: 2.8, head: 11, label: "v", font: LBL });
      geo.s.tip = { x: bx + tx * str.v * KVS, y: by + ty * str.v * KVS, tx, ty };
    } else if (str.fly) {
      const sp = Math.hypot(str.fly.vx, str.fly.vy) || 1;
      arrow(ctx, bx, by, (str.fly.vx / sp) * str.v * KVS, (-str.fly.vy / sp) * str.v * KVS, c.primary, { width: 2.8, head: 11, label: "v", font: LBL });
    }
  }
  ball(ctx, bx, by, 9); geo.s.ball = { x: bx, y: by };
  // taranglik shkalasi (dinamometr)
  const gx = wide ? Math.round(cx + half + 84) : cw - 26, gy0 = 36, gy1 = ch - 36, gh = gy1 - gy0, full = str.Fmax * 1.25, yM = gy1 - gh / 1.25;
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(gx - 8, gy0, 16, gh, 6); ctx.fill(); ctx.stroke();
  const fh = gh * clamp(F / full, 0, 1);
  if (fh > 0.5) { ctx.fillStyle = q > 0.8 ? c.danger : q > 0.65 ? c.warning : c.success; ctx.beginPath(); ctx.roundRect(gx - 6, gy1 - fh, 12, fh, 4); ctx.fill(); }
  ctx.save(); ctx.strokeStyle = c.danger; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(gx - 14, yM); ctx.lineTo(gx + 14, yM); ctx.stroke(); ctx.restore();
  ctx.fillStyle = c.danger; ctx.font = SMALL; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText("F_max", gx - 16, yM);
  tagIn(ctx, `F = ${fmt(F, 1)} N`, gx, gy0 - 15, cw, { color: q > 0.8 ? c.danger : c.text, bg: c.bg, align: "center", font: MID, pad: 5 });
  tag(ctx, "Silliq stol — ustdan ko‘rinish", cx - half + 8, cy - half + 14, { color: c.text3, bg: c.bg, font: SMALL });
  if (wide) tag(ctx, `F = mv²/R = ${fmt(str.m, 2)}·${fmt(str.v, 1)}²/${fmt(str.R, 2)} = ${fmt(P.tension(str.m, str.v, str.R), 2)} N`, cw - 8, ch - 14, { color: c.text2, bg: c.bg2, align: "right", font: SMALL });
  rateTag(ctx, c, str.rate, 8, ch - 14);
}

function stepString(dt) {
  if (str.on) {
    if (str.hold) return;
    str.rate = Math.min(1, (TAU * str.R) / str.v / 0.8);
    const h = dt * str.rate;
    if (str.spin) str.v = Math.min(str.v + SPIN * h, 8);
    str.th += (str.v / str.R) * h; str.t += h;
    const F = P.tension(str.m, str.v, str.R);
    str.hist.push({ t: str.t, F });
    if (F > str.Fmax) breakString("break");
  } else {
    const h = dt * str.rate; str.t += h;
    if (str.fly) { str.fly.x += str.fly.vx * h; str.fly.y += str.fly.vy * h; }
    str.hist.push({ t: str.t, F: 0 });
    const L = geo.s && geo.s.lim;
    if (!str.fly || !L || Math.abs(str.fly.x) > L.x || Math.abs(str.fly.y) > L.y) { str.wait += dt; if (str.wait > 0.9) reattach(); }
  }
  trim(str.hist, str.t - 14);
}
function breakString(why) {
  const th = str.th, x = str.R * Math.cos(th), y = str.R * Math.sin(th);
  str.on = false; str.why = why; str.wait = 0; str.hold = false;
  str.fly = { x, y, x0: x, y0: y, vx: -str.v * Math.sin(th), vy: str.v * Math.cos(th), th };
  if (drag === "sball" || drag === "stip") endDrag();
}
function reattach() { Object.assign(str, { on: true, fly: null, wait: 0, why: "", v: str.v0 }); }

/* ================================================================== 2b) Burilishdagi avtomobil */

function carTop(ctx, x, y, ang, L, W) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = "#111827";
  [[-L * 0.34, -W / 2 - 1.6], [L * 0.16, -W / 2 - 1.6], [-L * 0.34, W / 2 - 1.4], [L * 0.16, W / 2 - 1.4]].forEach(([a, b]) => ctx.fillRect(a, b, L * 0.2, 3));
  ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, 3.5); ctx.fill();
  ctx.fillStyle = "rgba(15,23,42,0.78)"; ctx.fillRect(L * 0.06, -W / 2 + 2, L * 0.17, W - 4); ctx.fillRect(-L * 0.38, -W / 2 + 2.2, L * 0.1, W - 4.4);
  ctx.restore();
}
function speedo(ctx, c, x, y, r, v, vmax, vmin, vid) {
  const A0 = 150 * DEG, SW = 240 * DEG, ang = (u) => A0 + SW * clamp(u / 160, 0, 1);
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.border; ctx.lineWidth = 1; circle(ctx, x, y, r + 6); ctx.fill(); ctx.stroke();
  ctx.lineWidth = Math.max(4, r * 0.09); ctx.lineCap = "butt";
  const arc = (u0, u1, col) => { if (u1 <= u0) return; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, y, r - 2, ang(u0), ang(u1)); ctx.stroke(); };
  arc(0, 160, c.bg2);
  arc(vmin, Math.min(vmax, 160), "rgba(34,197,94,0.55)");
  arc(Math.min(vmax, 160), 160, "rgba(239,68,68,0.7)");
  arc(0, Math.min(vmin, 160), "rgba(245,158,11,0.7)");
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let u = 0; u <= 160; u += 20) { const a = ang(u), L = u % 40 === 0 ? 9 : 5; ctx.moveTo(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6)); ctx.lineTo(x + Math.cos(a) * (r - 6 - L), y + Math.sin(a) * (r - 6 - L)); }
  ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = `600 ${r >= 55 ? 9 : 8}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  (r >= 50 ? [0, 40, 80, 120, 160] : [0, 80, 160]).forEach((u) => { const a = ang(u); ctx.fillText(String(u), x + Math.cos(a) * (r - 22), y + Math.sin(a) * (r - 22)); });
  if (vid) { const a = ang(vid); head(ctx, x + Math.cos(a) * (r + 1), y + Math.sin(a) * (r + 1), -Math.cos(a), -Math.sin(a), "#16a34a", 7); }
  const a = ang(v);
  ctx.strokeStyle = c.danger; ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6); ctx.lineTo(x + Math.cos(a) * (r - 8), y + Math.sin(a) * (r - 8)); ctx.stroke();
  ctx.fillStyle = c.text; circle(ctx, x, y, 4); ctx.fill();
  ctx.font = `700 ${r >= 60 ? 15 : 12}px Inter, system-ui, sans-serif`; ctx.fillText(fmt(v, 0), x, y + r * 0.42);
  ctx.fillStyle = c.text3; ctx.font = "600 8px Inter, system-ui, sans-serif"; ctx.fillText("km/soat", x, y + r * 0.42 + (r >= 60 ? 13 : 11));
}
/** Qiya yo'l kesimidagi kuchlar (mg birligida): N, ishqalanish (ichkariga-pastga musbat), kerakli ishqalanish. */
function bankForces() {
  const ca = Math.cos(car.alpha), sa = Math.sin(car.alpha), F = P.carForces(1, car.v, car.R, car.alpha), need = F.f / GRAV;
  if (!car.skid) return { n: F.N / GRAV, fa: need, need, slip: false };
  const mk = 0.75 * car.mu;
  if (car.skid.dir === "out") { const n = 1 / (ca - mk * sa); return { n, fa: mk * n, need, slip: true }; }
  const n = 1 / (ca + mk * sa); return { n, fa: -mk * n, need, slip: true };
}
function drawBank(ctx, c, x0, x1, ch) {
  const W = x1 - x0, al = car.alpha, ca = Math.cos(al), sa = Math.sin(al), road = ROADS[car.mu] || ROADS[0.7];
  const icx = x0 + W * 0.56, icy = Math.round(ch * 0.68), L = W * 0.4, k = clamp(W / 240, 0.6, 1.35);
  const Pt = (u) => [icx + u * ca, icy - u * sa];
  const [ax, ay] = Pt(-L), [bx2, by2] = Pt(L);
  ctx.fillStyle = c.dark ? "#3b2a1c" : "#eadbc6"; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.lineTo(bx2, ch); ctx.lineTo(ax, ch); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = road.col; ctx.lineWidth = 7; ctx.lineCap = "butt"; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.stroke();
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay - 3.5); ctx.lineTo(bx2, by2 - 3.5); ctx.stroke();
  if (al > 0.005) {
    ctx.save(); ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + L * 1.1, ay); ctx.stroke(); ctx.restore();
    angleArc(ctx, ax, ay, 38 * k, 0, -al, c.text2, { label: "α", labelR: 38 * k + 11, font: "italic 600 12px Inter, system-ui, sans-serif" });
  }
  // avtomobil (orqadan)
  const cwid = 58 * k, chh = 30 * k, wh = 6 * k, nx = -sa, ny = -ca, off = wh + chh / 2 + 3.5;
  const bc = [icx + nx * off, icy + ny * off];
  ctx.save(); ctx.translate(bc[0], bc[1]); ctx.rotate(-al);
  ctx.fillStyle = "#111827"; ctx.fillRect(-cwid / 2 + 3 * k, chh / 2 - 2, 12 * k, wh + 2); ctx.fillRect(cwid / 2 - 15 * k, chh / 2 - 2, 12 * k, wh + 2);
  ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.roundRect(-cwid / 2, -chh * 0.05, cwid, chh * 0.55, 4 * k); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-cwid * 0.36, -chh * 0.05); ctx.lineTo(-cwid * 0.26, -chh / 2); ctx.lineTo(cwid * 0.26, -chh / 2); ctx.lineTo(cwid * 0.36, -chh * 0.05); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(15,23,42,0.78)"; ctx.beginPath(); ctx.moveTo(-cwid * 0.29, -chh * 0.1); ctx.lineTo(-cwid * 0.22, -chh * 0.42); ctx.lineTo(cwid * 0.22, -chh * 0.42); ctx.lineTo(cwid * 0.29, -chh * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fde047"; ctx.fillRect(-cwid / 2 + 3, chh * 0.08, 7 * k, 4 * k); ctx.fillRect(cwid / 2 - 3 - 7 * k, chh * 0.08, 7 * k, 4 * k);
  ctx.restore();
  ctx.fillStyle = c.text; circle(ctx, bc[0], bc[1], 3); ctx.fill();
  if (ui.show.vec) {
    const Lg = clamp(ch * 0.15, 28, 46), bf = bankForces(), o = { x: bc[0], y: bc[1] }, cp = { x: icx - sa * 3.5, y: icy - ca * 3.5 };
    arrow(ctx, o.x, o.y, 0, Lg, c.text2, { width: 2.4, head: 9, label: "mg", font: "italic 700 12px Inter, system-ui, sans-serif" });
    arrow(ctx, cp.x, cp.y, nx * bf.n * Lg * 1.3, ny * bf.n * Lg * 1.3, c.success, { width: 2.4, head: 9, label: "N", font: LBL });
    if (Math.abs(bf.fa) > 0.01) arrow(ctx, cp.x, cp.y, -ca * bf.fa * Lg * 1.3, sa * bf.fa * Lg * 1.3, c.warning, { width: 2.4, head: 9, label: "f", font: LBL });
    if (bf.slip) { ctx.save(); ctx.globalAlpha = 0.6; arrow(ctx, cp.x, cp.y, -ca * bf.need * Lg * 1.3, sa * bf.need * Lg * 1.3, c.danger, { width: 1.6, head: 7, dash: [3, 3] }); ctx.restore(); }
    const rx = -sa * bf.n - ca * bf.fa, ry = 1 - ca * bf.n + sa * bf.fa;
    if (Math.hypot(rx, ry) > 0.02) arrow(ctx, o.x, o.y, rx * Lg * 1.3, ry * Lg * 1.3, c.special, { width: 2, head: 8, dash: [5, 3], label: "ma", font: "italic 700 12px Inter, system-ui, sans-serif" });
  }
  tag(ctx, "Yo‘l kesimi (orqadan)", x0 + 8, 14, { color: c.text2, bg: c.bg2, font: SMALL });
  tag(ctx, "← burilish markazi", x0 + 6, ch - 13, { color: c.text3, bg: c.bg, font: SMALL });
  if (car.skid) tag(ctx, "Sirpanish!", x1 - 8, 38, { color: "#fff", bg: c.danger, align: "right", font: "700 11px Inter, system-ui, sans-serif" });
  geo.c.bank = { icx, icy, L, ca, sa };
}
function drawCar(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, wide = cw >= 560, split = Math.round(cw * (wide ? 0.6 : 0.56));
  const rx = Math.round(split / 2), ry = Math.round(ch / 2), rr = Math.round(Math.min(split / 2 - 22, ch / 2 - 22)), rw = Math.round(clamp(rr * 0.24, 18, 30));
  const k = rr / car.R, road = ROADS[car.mu] || ROADS[0.7], cs = carState();
  ctx.fillStyle = c.dark ? "#13291b" : "#e3f5e6"; ctx.fillRect(0, 0, split, ch);
  ctx.strokeStyle = road.col; ctx.lineWidth = rw; circle(ctx, rx, ry, rr); ctx.stroke();
  ctx.strokeStyle = road.edge; ctx.lineWidth = 1.4; circle(ctx, rx, ry, rr + rw / 2 - 2.5); ctx.stroke(); circle(ctx, rx, ry, rr - rw / 2 + 2.5); ctx.stroke();
  ctx.save(); ctx.strokeStyle = road.line; ctx.lineWidth = 1.5; ctx.setLineDash([8, 8]); circle(ctx, rx, ry, rr); ctx.stroke(); ctx.restore();
  if (car.trail.length > 1) {
    ctx.save(); ctx.strokeStyle = "rgba(17,24,39,0.55)"; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]); ctx.beginPath();
    car.trail.forEach(([x, y], i) => (i ? ctx.lineTo(rx + x * k, ry - y * k) : ctx.moveTo(rx + x * k, ry - y * k))); ctx.stroke(); ctx.restore();
  }
  geo.c = { rx, ry, rr, rw, k, dx: rx, dy: ry, dr: 0, bank: null };
  const dr = Math.round((rr - rw / 2) * 0.64);
  geo.c.dr = dr;
  const vid = car.alpha > 0 ? P.carIdeal(car.R, car.alpha) * 3.6 : null;
  speedo(ctx, c, rx, ry, dr, car.v * 3.6, Number.isFinite(cs.vmax) ? cs.vmax * 3.6 : 999, cs.vmin * 3.6, vid);
  let px, py, ang;
  if (car.skid) { px = rx + car.skid.x * k; py = ry - car.skid.y * k; ang = Math.atan2(-car.skid.vy, car.skid.vx); }
  else { px = rx + rr * Math.cos(car.th); py = ry - rr * Math.sin(car.th); ang = Math.atan2(-Math.cos(car.th), -Math.sin(car.th)); }
  if (ui.show.vec && !car.skid) {
    const ux = (rx - px) / rr, uy = (ry - py) / rr;
    arrow(ctx, px, py, ux * rr * 0.3, uy * rr * 0.3, c.danger, { width: 2.4, head: 9, label: "F", font: LBL });
    arrow(ctx, px, py, Math.cos(ang) * rr * 0.32, Math.sin(ang) * rr * 0.32, c.primary, { width: 2.4, head: 9, label: "v", font: LBL });
  }
  carTop(ctx, px, py, ang, clamp(rr * 0.19, 18, 28), clamp(rr * 0.095, 9, 13));
  tag(ctx, `R = ${fmt(car.R, 0)} m · ${road.name}`, 8, 14, { color: c.text2, bg: c.bg2, font: SMALL });
  const ts = carTS();
  tag(ctx, ts > 1.05 ? `masshtabsiz · vaqt ×${fmt(ts, 1)}` : "masshtabsiz", 8, ch - 14, { color: c.text3, bg: c.bg2, font: SMALL });
  if (car.off) tagIn(ctx, car.off === "out" ? "Yo‘ldan chiqib ketdi!" : "Ichkariga sirpanib tushdi!", rx, ry + dr + 14, split, { color: "#fff", bg: c.danger, align: "center", font: "700 11px Inter, system-ui, sans-serif" });
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(split + 0.5, 0); ctx.lineTo(split + 0.5, ch); ctx.stroke();
  drawBank(ctx, c, split, cw, ch);
}

function stepCar(dt) {
  if (car.off) { car.wait += dt; if (car.wait > 2.2) resetCar(); return; }
  const h = dt * carTS(), cs = carState();
  if (!car.skid) {
    if (cs.ok) { car.th += (car.v / car.R) * h; return; }
    const th = car.th;
    car.skid = { dir: cs.a > cs.b.hi ? "out" : "in", th0: th, x: car.R * Math.cos(th), y: car.R * Math.sin(th), vx: -car.v * Math.sin(th), vy: car.v * Math.cos(th), vr: 0 };
    car.trail = [[car.skid.x, car.skid.y]];
  }
  const sk = car.skid, n = Math.max(1, Math.ceil(h / 0.02)), dtt = h / n;
  for (let i = 0; i < n; i++) {
    if (sk.dir === "out") {
      const kb = P.carBounds(car.mu * 0.75, car.alpha), sp = Math.hypot(sk.vx, sk.vy), w = (Number.isFinite(kb.hi) ? kb.hi : 0) / sp * dtt, cw = Math.cos(w), sw = Math.sin(w);
      const vx = sk.vx * cw - sk.vy * sw, vy = sk.vx * sw + sk.vy * cw; sk.vx = vx; sk.vy = vy;
      sk.x += sk.vx * dtt; sk.y += sk.vy * dtt;
    } else {
      const ca = Math.cos(car.alpha), sa = Math.sin(car.alpha), aDown = Math.max(0.3, GRAV * (sa - 0.75 * car.mu * ca) * ca);
      sk.vr -= aDown * dtt;
      const r = Math.hypot(sk.x, sk.y), an = Math.atan2(sk.y, sk.x) + (car.v / Math.max(r, 1)) * dtt, r2 = Math.max(0.5, r + sk.vr * dtt);
      sk.x = r2 * Math.cos(an); sk.y = r2 * Math.sin(an);
      sk.vx = -car.v * Math.sin(an) + sk.vr * Math.cos(an); sk.vy = car.v * Math.cos(an) + sk.vr * Math.sin(an);
    }
    const last = car.trail[car.trail.length - 1];
    if (Math.hypot(sk.x - last[0], sk.y - last[1]) > car.R * 0.01) car.trail.push([sk.x, sk.y]);
    const g0 = geo.c;
    if (g0) { const r = Math.hypot(sk.x, sk.y) * g0.k; if (r > g0.rr + g0.rw / 2 + 12 || r < g0.rr - g0.rw / 2 - 12) { car.off = sk.dir; car.wait = 0; break; } }
  }
}
function resetCar() { const th = car.skid ? car.skid.th0 : car.th; Object.assign(car, { skid: null, trail: [], off: "", wait: 0, th }); }

/* ================================================================== 2c) Vertikal halqa */

function drawLoopStage(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, H = TR.Hr, L = TR.Lr, EX = TR.exit;
  fit(cw, ch, -L - 0.35, EX + 0.1, -0.32, H + 0.42, 6);
  const s = view.s, rb = clamp(s * 0.1, 6, 9), gy = SY(0);
  ctx.fillStyle = c.bg2; ctx.fillRect(0, gy, cw, ch - gy);
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); for (let x = -10; x < cw; x += 12) { ctx.moveTo(x, gy + 10); ctx.lineTo(x + 8, gy + 2); } ctx.stroke();
  // tepalik tanasi
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.2)"; ctx.beginPath(); ctx.moveTo(SX(-L), gy);
  for (let i = 0; i <= 120; i++) { const x = -L * (1 - i / 120); ctx.lineTo(SX(x), SY(TR.rampY(x))); }
  ctx.closePath(); ctx.fill();
  // yo'l
  ctx.strokeStyle = c.text2; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath();
  for (let i = 0; i <= 120; i++) { const x = -L * (1 - i / 120), X = SX(x), Y = SY(TR.rampY(x)); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.lineTo(SX(EX + 0.1), gy); ctx.stroke();
  circle(ctx, SX(0), SY(1), s); ctx.stroke();
  ctx.fillStyle = c.text3; circle(ctx, SX(0), SY(1), 2.5); ctx.fill();
  ctx.save(); ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(SX(0), SY(1)); ctx.lineTo(SX(1), SY(1)); ctx.stroke(); ctx.restore();
  ctx.fillStyle = c.text3; ctx.font = "italic 600 11px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("R", SX(0.5), SY(1) - 2);
  // h_min va h
  ctx.save(); ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]);
  ctx.strokeStyle = c.danger; ctx.beginPath(); ctx.moveTo(SX(-L - 0.2), SY(2.5)); ctx.lineTo(SX(1.25), SY(2.5)); ctx.stroke();
  const xs = -L * Math.sqrt(lp.k / H);
  ctx.strokeStyle = c.warning; ctx.beginPath(); ctx.moveTo(SX(xs), SY(lp.k)); ctx.lineTo(SX(1.25), SY(lp.k)); ctx.moveTo(SX(xs), SY(lp.k)); ctx.lineTo(SX(xs), gy); ctx.stroke();
  ctx.restore();
  const close = Math.abs(lp.k - 2.5) < 0.3;
  tag(ctx, "h_min = 2,5R", SX(1.3), SY(2.5) - (close && lp.k < 2.5 ? 11 : 0), { color: c.danger, bg: c.bg, font: SMALL, pad: 4 });
  tag(ctx, `h = ${fmt(lp.k, 2)}R`, SX(1.3), SY(lp.k) + (close ? (lp.k < 2.5 ? 11 : -11) : 0), { color: c.warning, bg: c.bg, font: SMALL, pad: 4 });
  // uchish izi, ajralish
  if (lp.fly && lp.fly.path.length > 1) { ctx.save(); ctx.strokeStyle = c.danger; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); lp.fly.path.forEach(([x, y], i) => (i ? ctx.lineTo(SX(x), SY(y)) : ctx.moveTo(SX(x), SY(y)))); ctx.stroke(); ctx.restore(); }
  if (lp.det) {
    const dx = SX(lp.det.x), dy = SY(lp.det.y);
    ctx.strokeStyle = c.danger; ctx.lineWidth = 2; circle(ctx, dx, dy, 6); ctx.stroke();
  }
  // sharcha
  let px, py, nxs = 0, nys = -1, p = null;
  if (lp.fly) { px = SX(lp.fly.x); py = SY(lp.fly.y); nxs = lp.fly.nx; nys = -lp.fly.ny; }
  else { p = TR.at(lp.s); px = SX(p.x); py = SY(p.y); nxs = -p.ty; nys = -p.tx; }
  const bx = px + nxs * rb, by = py + nys * rb;
  if (ui.show.vec && (lp.phase === "run" || lp.phase === "fly")) {
    const vb = Math.sqrt(2 * GRAV * lp.R * lp.k), Lg = s * 0.28;
    if (p) {
      const vR = Math.abs(lp.w) * lp.R, Lv = (vR / vb) * 0.8 * s, sg = Math.sign(lp.w) || 1;
      if (Lv > 4) arrow(ctx, bx, by, p.tx * sg * Lv, -p.ty * sg * Lv, c.primary, { width: 2.6, head: 10, label: "v", font: LBL });
      const n = TR.normal(lp.s, lp.w, lp.R);
      if (n > 0.02) arrow(ctx, bx, by, nxs * Math.min(n * Lg, 1.5 * s), nys * Math.min(n * Lg, 1.5 * s), c.success, { width: 2.4, head: 9, label: "N", font: LBL });
    } else {
      const f = lp.fly, vx = f.vx0, vy = f.vy0 - (GRAV / lp.R) * f.tau, sp = Math.hypot(vx, vy) * lp.R, Lv = (sp / vb) * 0.8 * s, u = Math.hypot(vx, vy) || 1;
      if (Lv > 4) arrow(ctx, bx, by, (vx / u) * Lv, (-vy / u) * Lv, c.primary, { width: 2.6, head: 10, label: "v", font: LBL });
    }
    arrow(ctx, bx, by, 0, Lg, c.text2, { width: 2.2, head: 8, label: "mg", font: "italic 700 12px Inter, system-ui, sans-serif" });
  }
  ball(ctx, bx, by, rb);
  if (lp.phase === "hit") { ctx.strokeStyle = c.danger; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bx - 8, by - 8); ctx.lineTo(bx + 8, by + 8); ctx.moveTo(bx + 8, by - 8); ctx.lineTo(bx - 8, by + 8); ctx.stroke(); }
  geo.l = { bx, by };
  // ma'lumot
  let info;
  if (lp.phase === "fly") info = `θ = ${fmt(lp.det.th / DEG, 0)}° da ajraldi · erkin uchish (parabola), N = 0`;
  else if (lp.phase === "hit") info = `θ = ${fmt(lp.det.th / DEG, 0)}° da ajralib, halqaga urildi`;
  else if (lp.phase === "hold") info = "Qo‘yib yuboring";
  else { const n = TR.normal(lp.s, lp.w, lp.R), seg = TR.at(lp.s).seg; info = `${seg === "loop" ? `θ = ${fmt(lp.s / DEG, 0)}° · ` : ""}v = ${fmt(Math.abs(lp.w) * lp.R, 2)} m/s · N = ${fmt(n, 2)}mg`; }
  tagIn(ctx, info, cw - 8, 14, cw, { color: c.text2, bg: c.bg2, align: "right", font: SMALL });
  tagIn(ctx, `R = ${fmt(lp.R, 2)} m · ishqalanishsiz · ×${fmt(LOOP_RATE, 1)} sekin`, cw - 8, 38, cw, { color: c.text3, bg: c.bg2, align: "right", font: SMALL });
}

function stepLoop(dt) {
  if (lp.phase === "hold") return;
  if (lp.phase === "hit" || lp.phase === "gone") { lp.wait += dt; if (lp.wait > (lp.phase === "hit" ? 2.4 : 0.5)) restartLoop(); return; }
  const Hd = dt * LOOP_RATE, n = Math.max(1, Math.ceil(Hd / (1 / 400))), h = Hd / n;
  for (let i = 0; i < n && (lp.phase === "run" || lp.phase === "fly"); i++) {
    lp.t += h;
    if (lp.phase === "run") {
      const nx = P.trackStep(TR, lp, h, lp.R); lp.s = nx.s; lp.w = nx.w;
      const y = TR.at(lp.s).y, e = 2 * (GRAV / lp.R) * (lp.k - y);
      if (e > 1e-3 && Math.abs(lp.w) > 0.05) lp.w = Math.sign(lp.w) * Math.sqrt(e);
      if (lp.s > 0 && lp.s < TAU) { lp.top = Math.max(lp.top, lp.s); if (TR.normal(lp.s, lp.w, lp.R) < -1e-3) detach(); }
      if (lp.s >= TAU) lp.done = "full";
      if (lp.s > TAU + TR.exit + 0.6) { lp.phase = "gone"; lp.wait = 0; }
    } else {
      const f = lp.fly; f.tau += h;
      f.x = f.x0 + f.vx0 * f.tau; f.y = f.y0 + f.vy0 * f.tau - 0.5 * (GRAV / lp.R) * f.tau * f.tau;
      const d = Math.hypot(f.x, f.y - 1); if (d < 0.985) f.inside = true;
      const last = f.path[f.path.length - 1]; if (Math.hypot(f.x - last[0], f.y - last[1]) > 0.03) f.path.push([f.x, f.y]);
      if ((f.inside && d >= 1) || f.y <= 0) {
        if (f.y > 0) { f.x /= d; f.y = 1 + (f.y - 1) / d; } else f.y = 0;
        f.path.push([f.x, f.y]); lp.phase = "hit"; lp.wait = 0;
      }
    }
  }
  const y = lp.fly ? lp.fly.y : TR.at(lp.s).y;
  lp.hist.push({ t: lp.t, U: y / lp.k, K: Math.max(0, 1 - y / lp.k) });
  trim(lp.hist, lp.t - 12);
}
function detach() {
  const p = TR.at(lp.s), v = lp.w;
  lp.det = { x: p.x, y: p.y, th: lp.s };
  lp.fly = { x0: p.x, y0: p.y, vx0: v * p.tx, vy0: v * p.ty, tau: 0, x: p.x, y: p.y, inside: false, path: [[p.x, p.y]], nx: -p.ty, ny: p.tx };
  lp.phase = "fly";
}
function restartLoop() { Object.assign(lp, { s: TR.sOfH(lp.k), w: 0, phase: "run", fly: null, det: null, t: 0, hist: [], wait: 0, top: 0, done: "" }); }

/* ================================================================== 3) Uzatmalar */

function beltPath(ctx, C1, r1, C2, r2) {
  const d = C2.x - C1.x, ph = Math.acos(clamp((r1 - r2) / d, -1, 1));
  ctx.beginPath();
  ctx.moveTo(C1.x + r1 * Math.cos(ph), C1.y - r1 * Math.sin(ph));
  ctx.lineTo(C2.x + r2 * Math.cos(ph), C2.y - r2 * Math.sin(ph));
  ctx.arc(C2.x, C2.y, r2, -ph, ph, false);
  ctx.lineTo(C1.x + r1 * Math.cos(ph), C1.y + r1 * Math.sin(ph));
  ctx.arc(C1.x, C1.y, r1, ph, TAU - ph, false);
  ctx.closePath();
}
function pulley(ctx, c, x, y, r, th, col, label) {
  ctx.fillStyle = c.bg2; ctx.strokeStyle = col; ctx.lineWidth = 3; circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.border; ctx.lineWidth = 1; circle(ctx, x, y, Math.max(2, r - 5)); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
  for (let k = 0; k < 4; k++) { const a = th + (k * Math.PI) / 2; ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2); ctx.lineTo(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6)); }
  ctx.stroke();
  hub(ctx, x, y, r, th, col, label);
}
function hub(ctx, x, y, r, th, col, label) {
  const mr = Math.max(r * 0.6, r - 10);
  ctx.fillStyle = "#ef4444"; circle(ctx, x + Math.cos(th) * mr, y + Math.sin(th) * mr, 3.5); ctx.fill();
  ctx.fillStyle = col; circle(ctx, x, y, Math.max(6, r * 0.17)); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "800 10px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, x, y + 0.5);
}
function gearShape(ctx, c, x, y, rp, z, th, m, col, label) {
  const ra = rp + m, rf = rp - 1.2 * m, p = TAU / z;
  ctx.beginPath();
  for (let k = 0; k < z; k++) {
    const a = th + k * p;
    [[rf, a - 0.5 * p], [rf, a - 0.3 * p], [ra, a - 0.15 * p], [ra, a + 0.15 * p], [rf, a + 0.3 * p]].forEach(([r, an], i) => { const X = x + r * Math.cos(an), Y = y + r * Math.sin(an); if (k === 0 && i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
  }
  ctx.closePath();
  ctx.fillStyle = c.bg2; ctx.fill();
  ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = col; ctx.fill(); ctx.restore();
  ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 1; circle(ctx, x, y, rf * 0.72); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = th + (k * Math.PI) / 2; ctx.moveTo(x + Math.cos(a) * rp * 0.2, y + Math.sin(a) * rp * 0.2); ctx.lineTo(x + Math.cos(a) * rf * 0.72, y + Math.sin(a) * rf * 0.72); } ctx.stroke();
  if (label) hub(ctx, x, y, rf, th, col, label);
}
function rotArrow(ctx, x, y, r, cwise, col) {
  const a0 = -Math.PI * 0.72, a1 = -Math.PI * 0.32, R = r + 10;
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, R, a0, a1, false); ctx.stroke();
  const ae = cwise ? a1 : a0, d = cwise ? 1 : -1;
  head(ctx, x + R * Math.cos(ae), y + R * Math.sin(ae), -Math.sin(ae) * d, Math.cos(ae) * d, col, 7);
}
function drawBeltStage(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, type = blt.type, bike = type === "bike", gear = type === "gear", narrow = cw < 560;
  if (bike) fit(cw, ch, -38, 66, -40, 38, 8); else fit(cw, ch, -21, 61, -23, 23, 8);
  const s = view.s, x1 = bike ? 42 : gear ? 4 : 0, w1 = { x: x1, y: 0 }, w2 = { x: bike ? 0 : gear ? x1 + blt.R1 + blt.R2 : 40, y: 0 };
  const C1 = { x: SX(w1.x), y: SY(0) }, C2 = { x: SX(w2.x), y: SY(0) }, r1 = blt.R1 * s, r2 = blt.R2 * s;
  const th1 = blt.th1, th2 = gear ? gearPhase() : blt.th2, col1 = c.primary, col2 = c.warning, n2v = n2();
  geo.b = { c1: C1, c2: C2, r1, r2, w1, w2 };
  if (bike) {
    const gy = SY(-RW), Rw = RW * s, S = { x: SX(30), y: SY(32) }, frame = c.primary;
    ctx.strokeStyle = c.text3; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cw, gy); ctx.stroke();
    ctx.save(); ctx.strokeStyle = c.border; ctx.lineWidth = 3; ctx.setLineDash([10, 12]); ctx.lineDashOffset = (blt.xb * 100 * s) % 22; ctx.beginPath(); ctx.moveTo(0, gy + 7); ctx.lineTo(cw, gy + 7); ctx.stroke(); ctx.restore();
    // orqa g'ildirak
    ctx.strokeStyle = c.dark ? "#cbd5e1" : "#1f2937"; ctx.lineWidth = Math.max(3, 3.2 * s); circle(ctx, C2.x, C2.y, Rw - 1.6 * s); ctx.stroke();
    ctx.strokeStyle = c.text3; ctx.lineWidth = 1.5; circle(ctx, C2.x, C2.y, Rw - 4 * s); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = th2 + (k * TAU) / 16; ctx.moveTo(C2.x + Math.cos(a) * 2.5 * s, C2.y + Math.sin(a) * 2.5 * s); ctx.lineTo(C2.x + Math.cos(a) * (Rw - 4 * s), C2.y + Math.sin(a) * (Rw - 4 * s)); } ctx.stroke();
    // rama
    ctx.strokeStyle = frame; ctx.lineWidth = Math.max(3, 2.4 * s); ctx.lineCap = "round"; ctx.beginPath();
    ctx.moveTo(C2.x, C2.y); ctx.lineTo(C1.x, C1.y); ctx.lineTo(S.x, S.y); ctx.lineTo(C2.x, C2.y);
    ctx.moveTo(S.x, S.y); ctx.lineTo(SX(70), SY(35)); ctx.moveTo(C1.x, C1.y); ctx.lineTo(SX(70), SY(24)); ctx.moveTo(S.x, S.y); ctx.lineTo(SX(29), SY(36)); ctx.stroke();
    ctx.fillStyle = c.text; ctx.beginPath(); ctx.roundRect(SX(29) - 10 * s, SY(36) - 3.2 * s, 19 * s, 3.2 * s, 2); ctx.fill();
    // yulduzchalar va zanjir
    gearShape(ctx, c, C1.x, C1.y, r1, Math.max(8, Math.round((2 * blt.R1) / 0.6)), th1, 0.5 * s, c.text2, "");
    gearShape(ctx, c, C2.x, C2.y, r2, Math.max(8, Math.round((2 * blt.R2) / 0.6)), th2, 0.5 * s, c.text2, "");
    ctx.save(); beltPath(ctx, C2, r2, C1, r1); ctx.strokeStyle = c.dark ? "#e2e8f0" : "#111827"; ctx.lineWidth = Math.max(2.5, 0.9 * s); ctx.stroke();
    ctx.strokeStyle = c.dark ? "#475569" : "#9ca3af"; ctx.lineWidth = Math.max(1.2, 0.4 * s); ctx.setLineDash([2.5, 2.5]); ctx.lineDashOffset = -blt.s * s; ctx.stroke(); ctx.restore();
    // pedallar
    const cr = 17 * s, ex = C1.x + Math.cos(th1) * cr, ey = C1.y + Math.sin(th1) * cr, ox = C1.x - Math.cos(th1) * cr, oy = C1.y - Math.sin(th1) * cr;
    ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = c.text; ctx.lineWidth = Math.max(3, 2.2 * s); ctx.beginPath(); ctx.moveTo(C1.x, C1.y); ctx.lineTo(ox, oy); ctx.stroke(); ctx.fillStyle = c.text2; ctx.fillRect(ox - 5 * s, oy - 1.5 * s, 10 * s, 3 * s); ctx.restore();
    ctx.strokeStyle = c.text; ctx.lineWidth = Math.max(3, 2.2 * s); ctx.beginPath(); ctx.moveTo(C1.x, C1.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = c.text2; ctx.fillRect(ex - 5 * s, ey - 1.5 * s, 10 * s, 3 * s);
    hub(ctx, C1.x, C1.y, r1, th1, c.text2, "1"); hub(ctx, C2.x, C2.y, Math.max(r2, 10), th2, c.text2, "2");
    rotArrow(ctx, C1.x, C1.y, r1 + 2, true, col1);
    const vb = TAU * n2v * (RW / 100);
    tagIn(ctx, `Orqa g‘ildirak: n₂ = ${fmt(n2v, 2)} ayl/s`, 8, 14, cw, { color: c.text, bg: c.bg2, font: MID });
    tagIn(ctx, `Pedal: n₁ = ${fmt(blt.n1, 2)} ayl/s`, cw - 8, narrow ? 38 : 14, cw, { color: c.text, bg: c.bg2, align: "right", font: MID });
    tagIn(ctx, `Velosiped tezligi v = ω₂·R = ${fmt(vb, 2)} m/s = ${fmt(vb * 3.6, 1)} km/soat →`, cw / 2, gy + 20 > ch - 12 ? ch - 14 : gy + 20, cw, { color: c.text, bg: c.bg2, align: "center", font: MID });
    return;
  }
  if (gear) {
    gearShape(ctx, c, C1.x, C1.y, r1, zOf(blt.R1), th1, MOD * s, col1, "1");
    gearShape(ctx, c, C2.x, C2.y, r2, zOf(blt.R2), th2, MOD * s, col2, "2");
    rotArrow(ctx, C1.x, C1.y, r1 + MOD * s, true, col1); rotArrow(ctx, C2.x, C2.y, r2 + MOD * s, false, col2);
  } else {
    pulley(ctx, c, C1.x, C1.y, r1, th1, col1, "1"); pulley(ctx, c, C2.x, C2.y, r2, th2, col2, "2");
    ctx.save(); beltPath(ctx, C1, r1 + 1.5, C2, r2 + 1.5); ctx.strokeStyle = c.dark ? "#94a3b8" : "#334155"; ctx.lineWidth = Math.max(3, 0.9 * s); ctx.stroke();
    ctx.strokeStyle = c.dark ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.7)"; ctx.lineWidth = Math.max(1.2, 0.35 * s); ctx.setLineDash([6, 10]); ctx.lineDashOffset = -blt.s * s; ctx.stroke(); ctx.restore();
    rotArrow(ctx, C1.x, C1.y, r1 + 2, true, col1); rotArrow(ctx, C2.x, C2.y, r2 + 2, true, col2);
  }
  const v = TAU * blt.n1 * blt.R1;
  tagIn(ctx, gear ? `1: z₁ = ${zOf(blt.R1)} tish · n₁ = ${fmt(blt.n1, 2)} ayl/s` : `1: R₁ = ${fmt(blt.R1, 1)} cm · n₁ = ${fmt(blt.n1, 2)} ayl/s`, 8, 14, cw, { color: c.text, bg: c.bg2, font: MID });
  tagIn(ctx, gear ? `2: z₂ = ${zOf(blt.R2)} tish · n₂ = ${fmt(n2v, 2)} ayl/s` : `2: R₂ = ${fmt(blt.R2, 1)} cm · n₂ = ${fmt(n2v, 2)} ayl/s`, cw - 8, narrow ? 38 : 14, cw, { color: c.text, bg: c.bg2, align: "right", font: MID });
  tagIn(ctx, `${gear ? "Tishlar" : "Tasma"}: v = ω₁R₁ = ω₂R₂ = ${fmt(v / 100, 2)} m/s`, cw / 2, ch - 14, cw, { color: c.text2, bg: c.bg2, align: "center", font: SMALL });
}

function stepBelt(dt) {
  const w1 = TAU * blt.n1, r = ratio();
  blt.th1 += w1 * dt;
  if (blt.type === "gear") blt.th2 = gearPhase(); else blt.th2 += w1 * r * dt;
  blt.s += w1 * blt.R1 * dt; blt.t += dt; blt.N1 += blt.n1 * dt; blt.N2 += blt.n1 * r * dt;
  if (blt.type === "bike") blt.xb += w1 * r * (RW / 100) * dt;
  blt.hist.push({ t: blt.t, a1: blt.N1, a2: blt.N2 }); trim(blt.hist, blt.t - 12);
}

/* ------------------------------------------------------------------ Asosiy chizish */

function draw(ctx, st) {
  ctx.fillStyle = st.colors.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "kin") drawKin(ctx, st);
  else if (ui.mode === "belt") drawBeltStage(ctx, st);
  else if (ui.sub === "string") drawString(ctx, st);
  else if (ui.sub === "car") drawCar(ctx, st);
  else drawLoopStage(ctx, st);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.46, vh * 0.44), 260, 360)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  kin: [["xy", "x(t), y(t)", "Jism proyeksiyalari vaqt bo‘yicha", "Aylana bo‘ylab tekis harakatda har bir proyeksiya garmonik tebranadi: x = R·cos φ, y = R·sin φ, φ = ωt; tebranish davri aylanish davriga teng."]],
  string: [["fv", "F(v)", "Ip tarangligi tezlikka bog‘liq", "F = mv²/R — parabola: tezlik 2 marta ortsa, kerakli kuch 4 marta ortadi. Qizil soha — ip uziladigan tezliklar."], ["ft", "F(t)", "Ip tarangligi vaqt bo‘yicha", "Sharcha tezlashtirilganda taranglik ortib boradi; F_max ga yetganda ip uziladi va kuch birdan nolga tushadi."]],
  car: [["vmax", "v_max(R)", "Xavfsiz burilish tezligi", "v_max = √(μgR) — radius 4 marta katta burilishda 2 marta tezroq yurish mumkin. Yashil soha — xavfsiz tezliklar, nuqta — hozirgi avtomobil."], ["fric", "f(v)", "Kerakli va mavjud ishqalanish kuchi", "Ko‘k chiziq — burilish uchun kerakli ishqalanish kuchi (m = 1200 kg), qizil punktir — tinchlikdagi ishqalanishning eng katta qiymati μN. Ko‘k chiziq yashil yo‘lakdan chiqsa, avtomobil sirpanadi."]],
  loop: [["n", "N(θ)", "Tayanch reaksiyasi halqa bo‘ylab", "θ = 0° — halqaning pastki, 180° — yuqori nuqtasi. Pastda N eng katta (ortiqcha yuklama), tepada eng kichik. N < 0 bo‘ladigan joyda sharcha yo‘ldan ajraladi."], ["en", "Energiya", "Energiyaning aylanishi", "Ishqalanish yo‘q: kinetik va potensial energiyalar yig‘indisi o‘zgarmaydi — yo‘ldan ajralgandan keyin ham."]],
  belt: [["n2", "n₂(R₂)", "Yetaklanuvchi g‘ildirak chastotasi", "n₂ = n₁R₁/R₂ — giperbola: kichik g‘ildirak tezroq aylanadi. Sariq nuqta — hozirgi g‘ildirak."], ["turn", "N(t)", "Aylanishlar soni vaqt bo‘yicha", "To‘g‘ri chiziqlar qiyaligi aylanish chastotasiga teng, ularning nisbati — uzatish nisbati."]],
};
const tabKey = () => (ui.mode === "dyn" ? ui.sub : ui.mode);
function setupTabs() {
  const box = $("[data-tabs]");
  box.hidden = TABS[tabKey()].length < 2;  // bitta grafik bo'lsa tugmalar kerak emas
  box.innerHTML = TABS[tabKey()].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const list = TABS[tabKey()], t = list.find((x) => x[0] === tab) || list[0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.render();
}
function drawGraphCanvas(ctx, gst) {
  const k = tabKey();
  if (k === "kin") {
    return G.drawXY(ctx, gst, { hist: kin.hist, R: kin.R, span: clamp(2.2 * kinPeriod(), 3, 10) });
  }
  if (k === "string") return ui.tab === "ft" ? G.drawFT(ctx, gst, { hist: str.hist, Fmax: str.Fmax, span: 8 }) : G.drawFV(ctx, gst, { m: str.m, R: str.R, Fmax: str.Fmax, v: str.v });
  if (k === "car") return ui.tab === "fric" ? G.drawFric(ctx, gst, { m: car.M, R: car.R, mu: car.mu, alpha: car.alpha, v: car.v }) : G.drawVmax(ctx, gst, { mu: car.mu, alpha: car.alpha, R: car.R, v: car.v });
  if (k === "loop") return ui.tab === "en" ? G.drawEnergy(ctx, gst, { hist: lp.hist, span: 6 }) : G.drawLoop(ctx, gst, { h: lp.k * lp.R, R: lp.R, th: lp.phase === "run" && lp.s > 0 && lp.s < TAU ? lp.s : null });
  return ui.tab === "turn" ? G.drawTurns(ctx, gst, { hist: blt.hist, span: 8, n1: blt.n1, n2: n2() }) : G.drawBelt(ctx, gst, { R1: blt.R1, R2: blt.R2, n1: blt.n1 });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
function updateReadouts() {
  const k = tabKey();
  if (k === "kin") {
    const T = kinPeriod(), w = kin.v / kin.R, an = (kin.v * kin.v) / kin.R, at = effAt();
    setRO("r1", "Chiziqli tezlik <i>v</i>", `${fmt(kin.v, 2)}<small>m/s</small>`, kin.at ? `boshida v₀ = ${fmt(kin.v0, 2)} m/s` : "v = 2πR/T");
    setRO("r2", "Burchak tezlik <i>ω</i>", `${fmt(w, 2)}<small>rad/s</small>`, "ω = v/R = 2πν");
    setRO("r3", "Aylanish davri <i>T</i>", Number.isFinite(T) ? `${fmt(T, 2)}<small>s</small>` : "—", `Chastota ν = ${fmt(Number.isFinite(T) ? 1 / T : 0, 2)} ayl/s`);
    setRO("r4", "Markazga intilma tezlanish <i>aₙ</i>", `${fmt(an, 2)}<small>m/s²</small>`, "aₙ = v²/R = ω²R");
    setRO("r5", "Tangensial tezlanish <i>a<sub>τ</sub></i>", `${fmt(at, 2)}<small>m/s²</small>`, `to‘liq a = ${fmt(Math.hypot(an, at), 2)} m/s²`, at ? "orange" : "muted");
    setRO("r6", "Aylanishlar soni <i>N</i>", fmt(kin.th / TAU, 2), `φ = ${fmt(kin.th, 1)} rad · t = ${fmt(kin.t, 1)} s`);
  } else if (k === "string") {
    const F = strF(), vb = P.breakSpeed(str.m, str.R, str.Fmax), q = F / str.Fmax;
    setRO("r1", "Tezlik <i>v</i>", `${fmt(str.v, 2)}<small>m/s</small>`, `ω = ${fmt(str.v / str.R, 2)} rad/s`);
    setRO("r2", "Markazga intilma tezlanish", `${fmt((str.v * str.v) / str.R, 1)}<small>m/s²</small>`, "a = v²/R");
    setRO("r3", "Ip taranglik kuchi <i>F</i>", `${fmt(F, 2)}<small>N</small>`, str.on ? "F = ma = mv²/R" : "Ip uzilgan — kuch yo‘q", str.on && q > 0.8 ? "orange" : "");
    setRO("r4", "Ip chidaydigan kuch", `${fmt(str.Fmax, 1)}<small>N</small>`, `uzilish tezligi ${fmt(vb, 2)} m/s`);
    setRO("r5", "Aylanish davri <i>T</i>", `${fmt((TAU * str.R) / str.v, 2)}<small>s</small>`, "T = 2πR/v");
    setRO("r6", "Holat", str.on ? "Ip butun" : str.why === "cut" ? "Kesildi" : "Uzildi", str.on ? `m = ${fmt(str.m * 1000, 0)} g, R = ${fmt(str.R * 100, 0)} cm` : "sharcha urinma bo‘ylab ketdi", str.on ? "" : "orange");
  } else if (k === "car") {
    const cs = carState(), F = P.carForces(car.M, car.v, car.R, car.alpha), fmax = car.mu * F.N;
    setRO("r1", "Tezlik <i>v</i>", `${fmt(car.v * 3.6, 0)}<small>km/soat</small>`, `${fmt(car.v, 1)} m/s`);
    setRO("r2", "Eng katta xavfsiz tezlik", Number.isFinite(cs.vmax) ? `${fmt(cs.vmax * 3.6, 0)}<small>km/soat</small>` : "∞", car.alpha > 0 ? (cs.vmin > 0.1 ? `eng kichigi ${fmt(cs.vmin * 3.6, 0)} km/soat` : "qiyalik hisobga olingan") : "v_max = √(μgR)", cs.ok ? "" : "orange");
    setRO("r3", "Markazga intilma tezlanish", `${fmt(cs.a, 2)}<small>m/s²</small>`, `= ${fmt(cs.a / GRAV, 2)} g`);
    setRO("r4", "Kerakli ishqalanish kuchi", `${fmt(Math.abs(F.f) / 1000, 2)}<small>kN</small>`, `eng ko‘pi μN = ${fmt(fmax / 1000, 2)} kN`, Math.abs(F.f) > fmax ? "orange" : "");
    setRO("r5", "Ideal tezlik (f = 0)", car.alpha > 0 ? `${fmt(P.carIdeal(car.R, car.alpha) * 3.6, 0)}<small>km/soat</small>` : "—", car.alpha > 0 ? "v = √(gR·tg α)" : "yo‘l qiyaligi yo‘q", car.alpha > 0 ? "" : "muted");
    setRO("r6", "Holat", cs.ok ? "Barqaror" : "Sirpanadi", `${(ROADS[car.mu] || ROADS[0.7]).name}, μ = ${fmt(car.mu, 2)}`, cs.ok ? "" : "orange");
  } else if (k === "loop") {
    const R = lp.R, kk = lp.k, vb = Math.sqrt(2 * GRAV * kk * R);
    let v = 0, n = NaN;
    if (lp.fly) { v = Math.sqrt(Math.max(0, 2 * GRAV * R * (kk - lp.fly.y))); n = 0; } else { v = Math.abs(lp.w) * R; n = TR.normal(lp.s, lp.w, R); }
    const vt2 = 2 * GRAV * R * (kk - 2), det = P.detachAngle(kk * R, R);
    setRO("r1", "Boshlang‘ich balandlik <i>h</i>", `${fmt(kk, 2)}<small>R</small>`, `${fmt(kk * R, 2)} m; kerak ≥ 2,5R = ${fmt(2.5 * R, 2)} m`, kk < 2.5 ? "orange" : "");
    setRO("r2", "Tezlik (hozir)", `${fmt(v, 2)}<small>m/s</small>`, `pastda √(2gh) = ${fmt(vb, 2)} m/s`);
    setRO("r3", "Tayanch reaksiyasi <i>N</i>", Number.isFinite(n) ? `${fmt(n, 2)}<small>mg</small>` : "—", lp.fly ? "yo‘ldan ajralgan: N = 0" : "hozirgi nuqtada");
    setRO("r4", "Tepada tezlik", vt2 >= 0 ? `${fmt(Math.sqrt(vt2), 2)}<small>m/s</small>` : "—", `kerak: v ≥ √(gR) = ${fmt(Math.sqrt(GRAV * R), 2)} m/s`, kk >= 2.5 ? "" : "orange");
    setRO("r5", "Pastda tayanch reaksiyasi", `${fmt(1 + 2 * kk, 2)}<small>mg</small>`, "N = mg(1 + 2h/R)");
    setRO("r6", "Natija", kk >= 2.5 ? "Aylanadi" : det ? `θ = ${fmt(det / DEG, 0)}°` : "Tebranadi", kk >= 2.5 ? "butun halqada N ≥ 0" : det ? "shu burchakda ajraladi" : `θ = ${fmt(Math.acos(1 - Math.min(kk, 1)) / DEG, 0)}° gacha ko‘tariladi`, kk >= 2.5 ? "" : "orange");
  } else {
    const r = ratio(), n2v = n2(), w1 = TAU * blt.n1, w2 = TAU * n2v, v = (w1 * blt.R1) / 100, gear = blt.type === "gear", bike = blt.type === "bike";
    setRO("r1", bike ? "Pedal (yulduzcha 1) <i>n₁</i>" : "Yetaklovchi g‘ildirak <i>n₁</i>", `${fmt(blt.n1, 2)}<small>ayl/s</small>`, `ω₁ = ${fmt(w1, 2)} rad/s · T₁ = ${fmt(1 / blt.n1, 2)} s`);
    setRO("r2", bike ? "Orqa g‘ildirak <i>n₂</i>" : "Yetaklanuvchi g‘ildirak <i>n₂</i>", `${fmt(n2v, 2)}<small>ayl/s</small>`, `ω₂ = ${fmt(w2, 2)} rad/s · T₂ = ${fmt(1 / n2v, 2)} s`);
    setRO("r3", "Uzatish nisbati <i>n₂/n₁</i>", fmt(r, 2), gear ? `z₁/z₂ = ${zOf(blt.R1)}/${zOf(blt.R2)}` : `R₁/R₂ = ${fmt(blt.R1, 1)}/${fmt(blt.R2, 1)}`);
    setRO("r4", bike ? "Zanjir tezligi" : gear ? "Tishlar tezligi" : "Tasma tezligi", `${fmt(v, 2)}<small>m/s</small>`, "v = ω₁R₁ = ω₂R₂");
    setRO("r5", "Radiuslar <i>R₁ : R₂</i>", `${fmt(blt.R1, 1)} : ${fmt(blt.R2, 1)}<small>cm</small>`, gear ? `tishlar: ${zOf(blt.R1)} va ${zOf(blt.R2)}` : r > 1 ? "tezlatuvchi uzatma" : r < 1 ? "sekinlatuvchi uzatma" : "1 : 1");
    setRO("r6", bike ? "Velosiped tezligi" : "Aylanish yo‘nalishi", bike ? `${fmt(w2 * (RW / 100) * 3.6, 1)}<small>km/soat</small>` : gear ? "Qarama-qarshi" : "Bir xil", bike ? `v = ω₂·R_g = ${fmt(w2 * (RW / 100), 2)} m/s (R_g = 35 cm)` : gear ? "tishli uzatma" : "ochiq tasma");
  }
}
function updateStatus() {
  const el = $("[data-status]"), k = tabKey(); let t = "", tone = "blue";
  if (k === "kin") { const at = effAt(); if (kin.v <= 1e-9) { t = "To‘xtadi"; tone = "orange"; } else if (kin.at > 0 && at === 0) { t = "Tezlik chegarasi"; tone = "purple"; } else if (at > 0) { t = "Tezlanuvchan"; tone = "orange"; } else if (at < 0) { t = "Sekinlanuvchan"; tone = "orange"; } else { t = "Tekis harakat"; tone = "green"; } }
  else if (k === "string") { const q = strF() / str.Fmax; if (!str.on) { t = str.why === "cut" ? "Ip kesildi" : "Ip uzildi!"; tone = "red"; } else if (q > 0.8) { t = "Uzilish arafasida"; tone = "orange"; } else { t = "Ip butun"; tone = "green"; } }
  else if (k === "car") { if (car.off) { t = car.off === "out" ? "Yo‘ldan chiqdi" : "Ichkariga sirpandi"; tone = "red"; } else if (car.skid) { t = "Sirpanmoqda!"; tone = "red"; } else { t = "Barqaror burilish"; tone = "green"; } }
  else if (k === "loop") { if (lp.phase === "hold") t = "Qo‘yib yuboring"; else if (lp.phase === "fly") { t = "Yo‘ldan ajraldi!"; tone = "red"; } else if (lp.phase === "hit") { t = "Halqaga urildi"; tone = "red"; } else if (lp.done) { t = "Halqadan o‘tdi"; tone = "green"; } else t = lp.k <= 1 ? "Tebranmoqda" : "Sirpanmoqda"; }
  else { const r = ratio(); t = blt.type === "gear" ? "Qarama-qarshi aylanadi" : r > 1 ? "Tezlatuvchi" : r < 1 ? "Sekinlatuvchi" : "1 : 1"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const k = tabKey(), p = [];
  if (k === "kin") {
    p.push("<p>Jism aylana bo‘ylab harakatlanganda tezlik vektori doim aylanaga <b>urinma</b> bo‘ylab yo‘nalgan. Tekis harakatda tezlik moduli o‘zgarmaydi, lekin yo‘nalishi uzluksiz o‘zgaradi — demak, jism <b>tezlanish</b> bilan harakatlanadi. Bu tezlanish markazga yo‘nalgan: aₙ = v²/R = ω²R.</p>");
    p.push("<p><b>Tezlik godografi</b>da tezlik vektorlari bir nuqtaga keltirilgan: kichik Δφ burilishdagi Δv vektori trayektoriya markaziga qaragan, shuning uchun tezlanish ham markazga yo‘nalgan. Jismning x va y proyeksiyalari (soyalari) garmonik tebranadi.</p>");
    if (kin.at !== 0) p.push("<p><b>Notekis</b> harakatda tangensial tezlanish a<sub>τ</sub> tezlik modulini, normal tezlanish aₙ esa yo‘nalishini o‘zgartiradi. To‘liq tezlanish a = √(aₙ² + a<sub>τ</sub>²) markazga emas, burchak ostida yo‘nalgan.</p>");
  } else if (k === "string") {
    p.push("<p>Silliq stolda sharchani aylana bo‘ylab ushlab turuvchi yagona gorizontal kuch — <b>ip taranglik kuchi</b>. Nyutonning ikkinchi qonuniga ko‘ra u markazga yo‘nalgan va F = ma = mv²/R. Tezlik 2 marta ortsa, kerakli kuch 4 marta ortadi; ip qisqartirilsa ham kuch ortadi.</p>");
    p.push(str.on ? `<p>Ip chidaydigan eng katta kuch ${fmt(str.Fmax, 1)} N: bu sharcha uchun ip v = √(F<sub>max</sub>·R/m) = ${fmt(P.breakSpeed(str.m, str.R, str.Fmax), 2)} m/s dan katta tezlikda uziladi.</p>` : "<p>Ip uzilgach sharchaga gorizontal kuch ta’sir etmaydi va u <b>inersiya</b> bo‘yicha ip uzilgan paytdagi tezlik yo‘nalishida — aylanaga <b>urinma</b> bo‘ylab to‘g‘ri chiziqli tekis harakatlanadi. U markazdan radius bo‘ylab «qochmaydi»!</p>");
  } else if (k === "car") {
    const cs = carState();
    p.push("<p>Gorizontal burilishda avtomobilni aylana bo‘ylab yuritadigan markazga intilma kuch — shinalar bilan yo‘l orasidagi <b>tinchlikdagi ishqalanish kuchi</b>. U μN dan oshmaydi: mv²/R ≤ μmg, ya’ni v<sub>max</sub> = √(μgR) — massaga bog‘liq emas. Ho‘l yo‘l, qor va muzda μ kichik.</p>");
    if (car.alpha > 0) p.push("<p>Ichkariga qiya burilishda tayanch reaksiya kuchi N ham markazga og‘adi va uning gorizontal tashkil etuvchisi markazga intilma kuchning bir qismini beradi. <b>Ideal tezlik</b>da v = √(gR·tg α) ishqalanish umuman kerak emas — hatto muzda ham.</p>");
    if (!cs.ok) p.push(cs.a > cs.b.hi ? "<p>Kerakli markazga intilma kuch ishqalanishning eng katta qiymatidan katta — shinalar sirpanadi va avtomobil kattaroq radiusli yoy bo‘ylab tashqariga chiqib ketadi (sirpanishda ishqalanish yana ham kamayadi).</p>" : "<p>Tezlik juda kichik: qiya yo‘lda ishqalanish avtomobilni ushlab tura olmaydi va u qiyalik bo‘ylab ichkariga — pastga sirpanadi.</p>");
  } else if (k === "loop") {
    p.push("<p>Sharcha ishqalanishsiz sirpanadi — to‘liq mexanik energiya saqlanadi: v² = 2g(h − y). Halqada markazga intilma kuchni tayanch reaksiyasi N va og‘irlik kuchining radial tashkil etuvchisi birgalikda beradi: N − mg·cos θ = mv²/R.</p>");
    p.push("<p>Halqa tepasida mg + N = mv²/R. Sharcha yo‘ldan ajralmasligi uchun N ≥ 0, ya’ni v ≥ √(gR); energiya saqlanishidan h ≥ 2,5R kelib chiqadi.</p>");
    const det = P.detachAngle(lp.k * lp.R, lp.R);
    if (det) p.push(`<p>h = ${fmt(lp.k, 2)}R < 2,5R: θ ≈ ${fmt(det / DEG, 0)}° da N = 0 bo‘ladi — sharcha yo‘ldan ajralib, gorizontga burchak ostida otilgan jism kabi parabola bo‘ylab uchadi.</p>`);
    else if (lp.k <= 1) p.push("<p>h ≤ R: sharcha halqaning gorizontal diametridan yuqoriga chiqmaydi, N doim musbat — sharcha oldinga-orqaga tebranadi.</p>");
  } else {
    const t = blt.type;
    p.push(t === "gear" ? "<p>Tishli uzatmada g‘ildiraklar <b>qarama-qarshi</b> tomonga aylanadi. Tishlar bir-biriga mos kelishi uchun ularning qadami bir xil, shuning uchun tishlar soni radiusga proporsional: n₂/n₁ = z₁/z₂ = R₁/R₂.</p>" : t === "bike" ? "<p>Velosipedda pedal yulduzchasi (R₁) zanjir orqali orqa yulduzchani (R₂) aylantiradi. Orqa g‘ildirak yulduzcha bilan bitta o‘qda — bir xil burchak tezlik bilan aylanadi, velosiped tezligi v = ω₂·R<sub>g</sub> (R<sub>g</sub> = 35 cm).</p>" : "<p>Tasma sirpanmasa, ikkala g‘ildirak gardishidagi nuqtalarning <b>chiziqli tezligi bir xil</b>: v = ω₁R₁ = ω₂R₂. Shuning uchun kichik g‘ildirak tezroq aylanadi: n₂/n₁ = R₁/R₂.</p>");
    p.push("<p>Uzatma <b>tezlatuvchi</b> (R₂ < R₁) yoki <b>sekinlatuvchi</b> (R₂ > R₁) bo‘ladi. Sekinlatuvchi uzatma aylantiruvchi kuch momentini oshiradi — shuning uchun velosipedda tepalikka chiqishda kattaroq orqa yulduzcha tanlanadi.</p>");
  }
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const k = tabKey();
  const html = k === "kin" ? "<small>Markazga intilma tezlanish</small> a = v²/R = ω²R" : k === "string" ? "<small>Markazga intilma kuch</small> F = mv²/R" : k === "car" ? (car.alpha > 0 ? "<small>Ideal tezlik</small> v = √(gR·tg α)" : "<small>Xavfsiz burilish</small> v ≤ √(μgR)") : k === "loop" ? "<small>Halqa tepasida</small> mg + N = mv²/R" : "<small>Uzatma</small> ω₁R₁ = ω₂R₂";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
const actBtn = $("[data-action]");
function updateAction() {
  const show = ui.mode === "dyn" && ui.sub === "string";
  actBtn.hidden = !show;
  if (show) { const t = str.on ? "Ipni kesish" : "Ipni bog‘lash"; if (actBtn.textContent !== t) actBtn.textContent = t; }
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); updateAction(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "kin") stepKin(dt);
  else if (ui.mode === "belt") stepBelt(dt);
  else if (ui.sub === "string") stepString(dt);
  else if (ui.sub === "car") stepCar(dt);
  else stepLoop(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); updateAction(); graph.render(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => loop.toggle());

function resetMode() {
  if (ui.mode === "kin") Object.assign(kin, { v: kin.v0, th: 0, th0: 0, t: 0, hist: [], hold: false });
  else if (ui.mode === "belt") Object.assign(blt, { th1: 0, th2: 0, s: 0, xb: 0, N1: 0, N2: 0, t: 0, hist: [] });
  else if (ui.sub === "string") Object.assign(str, { on: true, fly: null, why: "", wait: 0, v: str.v0, th: 0, t: 0, hist: [], hold: false, rate: 1 });
  else if (ui.sub === "car") Object.assign(car, { th: -Math.PI / 2, skid: null, trail: [], off: "", wait: 0 });
  else restartLoop();
}
$("[data-reset]").addEventListener("click", () => { resetMode(); refresh(); if (!loop.running) loop.start(); });
actBtn.addEventListener("click", () => { if (str.on) breakString("cut"); else reattach(); if (!loop.running) loop.start(); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const kVC = bindRange($("#kV"), $("#kVOut"), (v) => `${fmt(v, 2)} m/s`, (v) => { kin.v0 = v; kin.v = v; customized(); refresh(); });
const kRC = bindRange($("#kR"), $("#kROut"), (v) => `${fmt(v, 0)} cm`, (v) => { kin.R = v / 100; customized(); refresh(); });
const kAC = bindRange($("#kA"), $("#kAOut"), (v) => `${v > 0 ? "+" : ""}${fmt(v, 2)} m/s²`, (v) => { kin.at = v; customized(); refresh(); });
const sVC = bindRange($("#sV"), $("#sVOut"), (v) => `${fmt(v, 1)} m/s`, (v) => { str.v0 = v; str.v = v; str.spin = false; customized(); refresh(); });
const sMC = bindRange($("#sM"), $("#sMOut"), (v) => `${fmt(v * 1000, 0)} g`, (v) => { str.m = v; customized(); refresh(); });
const sRC = bindRange($("#sR"), $("#sROut"), (v) => `${fmt(v, 0)} cm`, (v) => { str.R = v / 100; customized(); refresh(); });
const sTC = bindRange($("#sT"), $("#sTOut"), (v) => `${fmt(v, 1)} N`, (v) => { str.Fmax = v; customized(); refresh(); });
const cVC = bindRange($("#cV"), $("#cVOut"), (v) => `${fmt(v, 0)} km/soat`, (v) => { car.v = v / 3.6; customized(); refresh(); });
const cRC = bindRange($("#cR"), $("#cROut"), (v) => `${fmt(v, 0)} m`, (v) => { car.R = v; customized(); refresh(); });
const cAC = bindRange($("#cA"), $("#cAOut"), (v) => `${fmt(v, 0)}°`, (v) => { car.alpha = v * DEG; customized(); refresh(); });
document.querySelectorAll("[data-road-value]").forEach((b) => b.addEventListener("click", () => { car.mu = +b.dataset.roadValue; syncAll(); customized(); refresh(); }));
const lHC = bindRange($("#lH"), $("#lHOut"), (v) => `${fmt(v, 2)}R = ${fmt(v * lp.R, 2)} m`, (v) => { lp.k = v; restartLoop(); customized(); refresh(); });
const lRC = bindRange($("#lR"), $("#lROut"), (v) => `${fmt(v, 2)} m`, (v) => { lp.R = v; lHC.sync(); restartLoop(); customized(); refresh(); });
const bNC = bindRange($("#bN"), $("#bNOut"), (v) => `${fmt(v, 2)} ayl/s`, (v) => { blt.n1 = v; customized(); refresh(); });
const b1C = bindRange($("#b1"), $("#b1Out"), (v) => `${fmt(v, 1)} cm`, (v) => { blt.R1 = v; customized(); refresh(); });
const b2C = bindRange($("#b2"), $("#b2Out"), (v) => `${fmt(v, 1)} cm`, (v) => { blt.R2 = v; customized(); refresh(); });
document.querySelectorAll("[data-btype-value]").forEach((b) => b.addEventListener("click", () => { blt.type = b.dataset.btypeValue; syncAll(); customized(); refresh(); }));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* Sudrash */
const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
function distSeg(px, py, x0, y0, x1, y1) { const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, t = clamp(((px - x0) * dx + (py - y0) * dy) / L2, 0, 1); return Math.hypot(px - x0 - t * dx, py - y0 - t * dy); }
function hitTest(px, py) {
  if (ui.mode === "kin") { const k = geo.k; if (!k) return null; if (Math.hypot(px - k.bx, py - k.by) < 15) return "kbody"; if (k.tip && Math.hypot(px - k.tip.x, py - k.tip.y) < 14) return "ktip"; return null; }
  if (ui.mode === "belt") { const b = geo.b; if (!b) return null; const d1 = Math.hypot(px - b.c1.x, py - b.c1.y), d2 = Math.hypot(px - b.c2.x, py - b.c2.y); if (Math.abs(d2 - b.r2) < 10) return "r2"; if (Math.abs(d1 - b.r1) < 10) return "r1"; return null; }
  if (ui.sub === "string") {
    const s = geo.s; if (!s || !str.on || !s.ball) return null;
    if (Math.hypot(px - s.ball.x, py - s.ball.y) < 15) return "sball";
    if (s.tip && Math.hypot(px - s.tip.x, py - s.tip.y) < 14) return "stip";
    if (distSeg(px, py, s.cx, s.cy, s.ball.x, s.ball.y) < 8 && Math.hypot(px - s.cx, py - s.cy) > 12) return "scut";
    return null;
  }
  if (ui.sub === "car") {
    const c = geo.c; if (!c) return null;
    if (Math.hypot(px - c.dx, py - c.dy) < c.dr + 6) return "needle";
    const bk = c.bank; if (bk) { const u = (px - bk.icx) * bk.ca - (py - bk.icy) * bk.sa, d = Math.abs((px - bk.icx) * bk.sa + (py - bk.icy) * bk.ca); if (u > bk.L * 0.3 && u < bk.L + 14 && d < 18) return "bank"; }
    return null;
  }
  const l = geo.l; if (l && Math.hypot(px - l.bx, py - l.by) < 16) return "lball";
  return null;
}
const CURSOR = { kbody: "grab", ktip: "grab", sball: "grab", stip: "grab", scut: "pointer", needle: "grab", bank: "ns-resize", lball: "grab", r1: "grab", r2: "grab" };
canvas.addEventListener("pointerdown", (e) => {
  const { px, py } = ptr(e), h = hitTest(px, py);
  if (!h) return;
  if (h === "scut") { breakString("cut"); if (!loop.running) loop.start(); refresh(); return; }
  drag = h; canvas.dataset.dragging = "true";
  if (h === "kbody" || h === "ktip") kin.hold = true;
  if (h === "sball" || h === "stip") str.hold = true;
  if (h === "lball") lp.phase = "hold";
  try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  onDrag(px, py);
});
function onDrag(px, py) {
  if (drag === "kbody") {
    const k = geo.k, dx = px - k.cx, dy = k.cy - py;
    kin.R = clamp(Math.round((Math.hypot(dx, dy) / k.s) * 100), 20, 100) / 100; kin.th += wrapPi(Math.atan2(dy, dx) - kin.th); kin.th0 = kin.th; kRC.set(kin.R * 100);
  } else if (drag === "ktip") {
    const t = geo.k.tip; if (!t) return;
    const v = clamp(Math.round((((px - geo.k.bx) * t.tx + (py - geo.k.by) * t.ty) / geo.k.kv) * 20) / 20, 0.2, KMAX); kin.v0 = kin.v = v; kVC.set(v);
  } else if (drag === "sball") {
    const s = geo.s, dx = px - s.cx, dy = s.cy - py;
    str.R = clamp(Math.round((Math.hypot(dx, dy) / s.s) * 100), 20, 100) / 100; str.th += wrapPi(Math.atan2(dy, dx) - str.th); sRC.set(str.R * 100);
    if (P.tension(str.m, str.v, str.R) > str.Fmax) breakString("break");
  } else if (drag === "stip") {
    const s = geo.s, t = s.tip; if (!t) return;
    const v = clamp(Math.round((((px - s.ball.x) * t.tx + (py - s.ball.y) * t.ty) / KVS) * 10) / 10, 0.5, 8); str.v0 = str.v = v; str.spin = false; sVC.set(v);
    if (P.tension(str.m, str.v, str.R) > str.Fmax) breakString("break");
  } else if (drag === "needle") {
    const c = geo.c; let a = Math.atan2(py - c.dy, px - c.dx) / DEG; if (a < 90) a += 360;
    const v = clamp(Math.round(((a - 150) / 240) * 160), 10, 160); car.v = v / 3.6; cVC.set(v);
  } else if (drag === "bank") {
    const bk = geo.c.bank; car.alpha = clamp(Math.round(Math.atan2(bk.icy - py, px - bk.icx) / DEG), 0, 30) * DEG; cAC.set(Math.round(car.alpha / DEG));
  } else if (drag === "lball") {
    let best = lp.k, bd = Infinity;
    for (let k = 0.5; k <= 3.5001; k += 0.05) { const x = -TR.Lr * Math.sqrt(k / TR.Hr), d = Math.hypot(SX(x) - px, SY(k) - py); if (d < bd) { bd = d; best = k; } }
    lp.k = Math.round(best * 20) / 20; lHC.set(lp.k);
    Object.assign(lp, { s: TR.sOfH(lp.k), w: 0, fly: null, det: null, t: 0, hist: [], top: 0, done: "" });
  } else if (drag === "r1" || drag === "r2") {
    const b = geo.b, w = toWorld(px, py);
    if (drag === "r1") { blt.R1 = clamp(Math.round(Math.hypot(w.x - b.w1.x, w.y - b.w1.y) * 2) / 2, 3, 18); b1C.set(blt.R1); }
    else {
      let R;
      if (blt.type === "gear") { const xp = w.x - (b.w1.x + blt.R1); R = xp > 0.5 ? (xp * xp + w.y * w.y) / (2 * xp) : 18; } else R = Math.hypot(w.x - b.w2.x, w.y - b.w2.y);
      blt.R2 = clamp(Math.round(R * 2) / 2, 3, 18); b2C.set(blt.R2);
    }
  }
  customized(); refresh();
}
canvas.addEventListener("pointermove", (e) => {
  const { px, py } = ptr(e);
  if (!drag) { const h = hitTest(px, py); canvas.style.cursor = h ? CURSOR[h] : ""; return; }
  onDrag(px, py);
});
function endDrag() {
  if (!drag) return;
  if (drag === "lball" && lp.phase === "hold") { lp.phase = "run"; if (!loop.running) loop.start(); }
  kin.hold = false; str.hold = false; drag = null; canvas.dataset.dragging = "false";
  refresh();
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  uniform: { mode: "kin", title: "Tekis aylanma harakat", lesson: "Tezlik moduli o‘zgarmaydi, yo‘nalishi esa uzluksiz o‘zgaradi: ko‘k v vektori aylanaga urinma, qizil aₙ — markazga yo‘nalgan. Jismni yoki v vektori uchini surib ko‘ring.", set: () => Object.assign(kin, { v0: 1.5, R: 0.6, at: 0 }), tab: "xy" },
  radius: { mode: "kin", title: "Tezlanish radiusga bog‘liq", lesson: "v = 2 m/s o‘zgarmas. Jismni markazga yaqinlashtiring: radius 2 marta kamaysa, a = v²/R 2 marta ortadi.", set: () => Object.assign(kin, { v0: 2, R: 0.8, at: 0 }), tab: "xy" },
  accel: { mode: "kin", title: "Notekis harakat (a_τ ≠ 0)", lesson: "Tezlik har soniyada 0,5 m/s ga ortadi: sariq a_τ tezlik modulini, qizil aₙ yo‘nalishini o‘zgartiradi. To‘liq tezlanish a (binafsha) markazdan og‘gan; tezlik ortgan sari aₙ ustun keladi.", set: () => Object.assign(kin, { v0: 0.4, R: 0.6, at: 0.5 }), tab: "xy" },
  string: { mode: "dyn", sub: "string", title: "Ipdagi sharcha", lesson: "Silliq stolda ipga bog‘langan sharcha aylanmoqda. Ipni bosing yoki «Ipni kesish» tugmasini bosing — sharcha urinma bo‘ylab ketadi. Sharchani surib, ipni qisqartirib ko‘ring.", set: () => Object.assign(str, { v0: 3, m: 0.2, R: 0.6, Fmax: 5, spin: false }), tab: "fv" },
  snap: { mode: "dyn", sub: "string", title: "Ip uziladi", lesson: "Sharcha asta tezlashtiriladi: taranglik F = mv²/R ortib, 4 N ga yetganda ip uziladi. Sharcha markazdan emas, urinma bo‘ylab uchib ketadi.", set: () => Object.assign(str, { v0: 2.4, m: 0.2, R: 0.5, Fmax: 4, spin: true }), tab: "ft" },
  carDry: { mode: "dyn", sub: "car", title: "Quruq yo‘lda burilish", lesson: "Quruq asfaltda (μ = 0,7) R = 60 m burilishni 73 km/soatgacha xavfsiz o‘tish mumkin. Spidometr milini surib tezlikni oshiring — qizil sohada avtomobil sirpanadi.", set: () => Object.assign(car, { v: 60 / 3.6, R: 60, mu: 0.7, alpha: 0 }), tab: "vmax" },
  carIce: { mode: "dyn", sub: "car", title: "Muzda sirpanish", lesson: "Muzda μ = 0,08: xuddi shu burilishda xavfsiz tezlik atigi 25 km/soat. 60 km/soatda ishqalanish yetmaydi — avtomobil sirpanib, yo‘ldan chiqib ketadi.", set: () => Object.assign(car, { v: 60 / 3.6, R: 60, mu: 0.08, alpha: 0 }), tab: "fric" },
  carBank: { mode: "dyn", sub: "car", title: "Qiya burilish (muzda ham)", lesson: "Yo‘l ichkariga 20° qiya. Muzda ham 46–59 km/soat oralig‘ida burilish mumkin: ideal 53 km/soatda ishqalanish deyarli kerak emas — N ning gorizontal tashkil etuvchisi yetarli. O‘ngdagi yo‘l kesimini surib qiyalikni o‘zgartiring.", set: () => Object.assign(car, { v: 53 / 3.6, R: 60, mu: 0.08, alpha: 20 * DEG }), tab: "fric" },
  loopOk: { mode: "dyn", sub: "loop", title: "Halqa: h = 3R", lesson: "h = 3R: sharcha halqani to‘liq aylanib chiqadi. Tepada N = mg, pastda N = 7mg (ortiqcha yuklama). Sharchani tepalikda surib boshqa balandlikdan qo‘yib yuboring.", set: () => Object.assign(lp, { k: 3, R: 0.5 }), tab: "n" },
  loopMin: { mode: "dyn", sub: "loop", title: "Eng kichik balandlik 2,5R", lesson: "h = 2,5R — eng kichik balandlik: tepada N = 0, markazga intilma kuchni faqat og‘irlik kuchi beradi va v = √(gR).", set: () => Object.assign(lp, { k: 2.5, R: 0.5 }), tab: "n" },
  loopFall: { mode: "dyn", sub: "loop", title: "Halqadan ajralish (h = 2R)", lesson: "h = 2R: sharcha tepaga yetmasdan (θ ≈ 132°) N = 0 bo‘ladi va yo‘ldan ajralib, parabola bo‘ylab tushadi.", set: () => Object.assign(lp, { k: 2, R: 0.5 }), tab: "n" },
  loopSwing: { mode: "dyn", sub: "loop", title: "Tebranish (h < R)", lesson: "h = 0,8R < R: sharcha halqaning chorak qismidan yuqoriga chiqmaydi va oldinga-orqaga tebranadi. Energiya grafigida kinetik va potensial energiya almashinuvini kuzating.", set: () => Object.assign(lp, { k: 0.8, R: 0.5 }), tab: "en" },
  belt: { mode: "belt", title: "Tasmali uzatma", lesson: "Tasma ikkala g‘ildirak gardishini bir xil v tezlik bilan harakatlantiradi, shuning uchun kichik g‘ildirak 2 marta tezroq aylanadi. G‘ildirak chetini surib radiusni o‘zgartiring.", set: () => Object.assign(blt, { type: "belt", n1: 0.5, R1: 12, R2: 6 }), tab: "n2" },
  gear: { mode: "belt", title: "Tishli uzatma (sekinlatish)", lesson: "Kichik tishli g‘ildirak (12 tish) kattasini (30 tish) aylantiradi: g‘ildiraklar qarama-qarshi aylanadi, katta g‘ildirak 2,5 marta sekinroq.", set: () => Object.assign(blt, { type: "gear", n1: 1.2, R1: 6, R2: 15 }), tab: "turn" },
  bike: { mode: "belt", title: "Velosiped", lesson: "Pedal 1 ayl/s (60 ayl/min) aylantiriladi. Yulduzchalar nisbati 10 : 4 — orqa g‘ildirak 2,5 ayl/s aylanadi va velosiped ≈ 20 km/soat tezlikda yuradi. Orqa yulduzchani kattalashtirib ko‘ring.", set: () => Object.assign(blt, { type: "bike", n1: 1, R1: 10, R2: 4 }), tab: "n2" },
};
const GROUPS = [["Kinematika", ["uniform", "radius", "accel"]], ["Ip va sharcha", ["string", "snap"]], ["Burilish", ["carDry", "carIce", "carBank"]], ["Vertikal halqa", ["loopOk", "loopMin", "loopFall", "loopSwing"]], ["Uzatmalar", ["belt", "gear", "bike"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  kVC.set(kin.v0); kRC.set(kin.R * 100); kAC.set(kin.at);
  sVC.set(str.v0); sMC.set(str.m); sRC.set(str.R * 100); sTC.set(str.Fmax);
  cVC.set(Math.round(car.v * 3.6)); cRC.set(car.R); cAC.set(Math.round(car.alpha / DEG));
  document.querySelectorAll("[data-road-value]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.roadValue === car.mu)));
  lRC.set(lp.R); lHC.set(lp.k);
  bNC.set(blt.n1); b1C.set(blt.R1); b2C.set(blt.R2);
  document.querySelectorAll("[data-btype-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.btypeValue === blt.type)));
  document.querySelectorAll("[data-sub-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.subValue === ui.sub)));
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { kin: "Jismni yoki v vektori uchini suring", string: "Sharchani suring, ipni bosib kesing", car: "Spidometr milini va yo‘l kesimini suring", loop: "Sharchani tepalikda suring va qo‘yib yuboring", belt: "G‘ildiraklar chetini suring" };
const DHINT = { string: "Ipni bosing yoki «Ipni kesish» tugmasini bosing — sharcha urinma bo‘ylab ketadi.", car: "Avtomobil massasi 1200 kg. Spidometr milini va o‘ngdagi yo‘l kesimini sichqoncha bilan suring.", loop: "Balandlik halqa radiusi R birligida. Sharchani tepalik bo‘ylab surib qo‘yib yuboring." };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-dctl]").forEach((el) => { el.hidden = el.dataset.dctl !== ui.sub; });
  $("[data-mode-hint]").textContent = MODE_HINT[tabKey()];
  $("[data-dhint]").textContent = DHINT[ui.sub] || "";
  updateAction(); setupTabs();
}
const MODE_DEFAULT = { kin: "uniform", dyn: "string", belt: "belt" }, SUB_DEFAULT = { string: "string", car: "carDry", loop: "loopOk" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
document.querySelectorAll("[data-sub-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.subValue !== ui.sub || ui.mode !== "dyn") loadPreset(SUB_DEFAULT[b.dataset.subValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  if (drag) endDrag();
  p.set();
  if (p.sub) ui.sub = p.sub;
  ui.mode = p.mode;
  resetMode(); setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || TABS[tabKey()][0][0]);
  refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "uniform");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
