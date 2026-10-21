// ==========================================================================
// Nyuton qonunlari — virtual laboratoriya (simulations/newton-second-law.html)
// 1) Ikkinchi qonun: stol ustidagi aravacha — dinamometr (doimiy kuch) yoki blok orqali osilgan yuk; ishqalanish;
//    aravacha/osma yukka yuk qo'shish («+»/«−»), kuch o'qini va fotodarvozani sudrash; a = 2s/t² o'lchovi, a(F), a(1/m).
// 2) Uchinchi qonun: ip bilan siqib bog'langan prujinali ikki aravacha — ipni kesish, F₁₂ = −F₂₁, m₁v₁ = m₂v₂,
//    stroboskopik belgilar.
// 3) Liftda vazn: bino kesimi va kabina ichi (tarozidagi odam, dinamometrdagi yuk), qavat pulti, erkin tushish va tormoz.
// Fizika: newton-physics.js (Node'da tekshirilgan). Grafiklar: newton-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow } from "./sim-kit.js";
import * as P from "./newton-physics.js";
import * as G from "./newton-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, GRAV = P.G;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const LBL = "italic 700 13px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "law2", tab: "aF", show: { vec: true } };
// 1) aravacha (dunyo: metr; stol usti y = 0, rels usti 0,01; aravacha uzunligi 0,2)
const CL = 0.2, XMAX = 1.0, HANG_Y0 = -0.1, HANG_H = 0.09, FLOOR = -0.6, DROP = HANG_Y0 - HANG_H - FLOOR; // yuk polga tekkuncha yo'l (0,41 m)
const crt = { drive: "force", M: 0.5, m: 0.1, F: 1, mu: 0, s: 0.6, x: 0, v: 0, t: 0, phase: "ready", tGate: null, aMeas: null, landed: false, pts: [], wait: 0, Fd0: 0 };
// 2) ikki aravacha
const L0 = 0.06, KS = 600;
const rc = { m1: 0.5, m2: 1, dx: 0.03, x1: 0, x2: 0, v1: 0, v2: 0, F: 0, Fmax: 0, t: 0, phase: "bound", strobe: [], st: 0, start: null, contact: false };
// 3) lift
const FLOORH = 3, NFL = 9, VMAX = 3;
const lift = { m: 60, a0: 2, y: 0, v: 0, a: 0, mode: "idle", t: 0, tr: 0, ride: null, target: 1, cable: true, tf: 0, hist: [], auto: null };
let presetId = null;
const geo = {};
const trim = (h, t) => { while (h.length && h[0].t < t) h.shift(); };

const gateMax = () => (crt.drive === "hang" ? 0.4 : 0.9);
function cartState() { return P.cartForces({ M: crt.M, m: crt.m, F: crt.F, mu: crt.mu, mode: crt.drive, v: crt.v, attached: !(crt.drive === "hang" && crt.landed) }); }
const floorY = (n) => (n - 1) * FLOORH;
const curFloor = () => clamp(Math.round(lift.y / FLOORH) + 1, 1, NFL);
const canFall = () => lift.cable && lift.mode === "idle" && lift.y >= 8.5 - 1e-6;
const liftP = () => (lift.cable || lift.mode !== "idle" ? P.weight(lift.m, lift.a) : P.weight(lift.m, 0));

/* ------------------------------------------------------------------ Dunyo → ekran */

const view = { s: 1, ox: 0, oy: 0, x0: 0, y1: 0 };
function fit(cw, ch, x0, x1, y0, y1, pad = 6) {
  const s = Math.min((cw - 2 * pad) / (x1 - x0), (ch - 2 * pad) / (y1 - y0));
  view.s = s; view.ox = (cw - (x1 - x0) * s) / 2; view.oy = (ch - (y1 - y0) * s) / 2; view.x0 = x0; view.y1 = y1;
}
const SX = (x) => view.ox + (x - view.x0) * view.s;
const SY = (y) => view.oy + (view.y1 - y) * view.s;
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s + view.x0, y: view.y1 - (py - view.oy) / view.s });

/* ------------------------------------------------------------------ Yordamchilar */

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); }
function tagIn(ctx, text, x, y, cw, o) {
  ctx.save(); ctx.font = o.font || MID; const w = ctx.measureText(text).width + 2 * (o.pad ?? 6); ctx.restore();
  let x0 = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
  x0 = clamp(x0, 4, cw - 4 - w); tag(ctx, text, x0, y, { ...o, align: "left" });
}
/** Ekrandagi dumaloq tugma («+», «−», qavat raqami). */
function chip(ctx, c, x, y, r, text, { on = true, fill, color } = {}) {
  ctx.save(); ctx.globalAlpha = on ? 1 : 0.35;
  ctx.fillStyle = fill || c.bg; ctx.strokeStyle = color || c.primary; ctx.lineWidth = 1.6; circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color || c.primary; ctx.font = `800 ${Math.round(r * 1.15)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}
const hitR = (p, b) => b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 4;
/** Yon ko'rinishdagi aravacha: orqa uchi xb (m), rang, aylanish burchagi. */
function cartSide(ctx, c, xb, col, rot, { len = CL, h = 0.06 } = {}) {
  const s = view.s, y0 = 0.03;
  ctx.fillStyle = col; ctx.strokeStyle = "rgba(15,23,42,0.45)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(SX(xb), SY(y0 + h), len * s, h * s, Math.max(2, 0.01 * s)); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(SX(xb) + 3, SY(y0 + h) + 3, len * s - 6, Math.max(2, h * s * 0.22));
  [xb + 0.045, xb + len - 0.045].forEach((wx) => {
    const X = SX(wx), Y = SY(0.03), r = 0.02 * s;
    ctx.fillStyle = "#1f2937"; circle(ctx, X, Y, r); ctx.fill();
    ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let k = 0; k < 3; k++) { const a = -rot + (k * TAU) / 3; ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(a) * r * 0.8, Y + Math.sin(a) * r * 0.8); }
    ctx.stroke(); ctx.fillStyle = "#d1d5db"; circle(ctx, X, Y, r * 0.25); ctx.fill();
  });
}
function blocks(ctx, n, xc, ybase, w, h, col) {
  const s = view.s;
  for (let i = 0; i < n; i++) {
    const y = ybase + i * h;
    ctx.fillStyle = col; ctx.strokeStyle = "rgba(15,23,42,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(SX(xc - w / 2), SY(y + h), w * s, h * s - 1, 2); ctx.fill(); ctx.stroke();
  }
}
const FK = 0.06; // kuch masshtabi, m/N (dunyoda)

/* ================================================================== 1) Ikkinchi qonun */

function drawLaw2(ctx, st) {
  const { w: cw, h: ch, colors: c } = st;
  const hang = crt.drive === "hang";
  fit(cw, ch, -0.12, 1.56, hang ? FLOOR - 0.02 : -0.2, 0.36, 8);
  const s = view.s, cs = cartState(), x = crt.x, xf = x + CL;
  geo.l2 = {};
  // pol va stol
  ctx.fillStyle = c.bg2; ctx.fillRect(0, SY(FLOOR), cw, ch - SY(FLOOR));
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, SY(FLOOR)); ctx.lineTo(cw, SY(FLOOR)); ctx.stroke();
  const tx0 = -0.1, tx1 = 1.27;
  ctx.fillStyle = c.dark ? "#5b4636" : "#c8a27a"; ctx.fillRect(SX(tx0), SY(0), (tx1 - tx0) * s, 0.035 * s);
  ctx.fillStyle = c.dark ? "#4a3a2d" : "#b08a63"; [0.0, 1.17].forEach((lx) => ctx.fillRect(SX(lx), SY(-0.035), 0.035 * s, (-0.035 - FLOOR) * s));
  // rels va to'xtatgichlar
  ctx.fillStyle = c.dark ? "#94a3b8" : "#9ca3af"; ctx.fillRect(SX(-0.06), SY(0.01), 1.29 * s, 0.01 * s);
  ctx.fillStyle = c.text2; ctx.fillRect(SX(-0.06), SY(0.06), 0.03 * s, 0.05 * s); ctx.fillRect(SX(1.2), SY(0.05), 0.02 * s, 0.04 * s);
  tag(ctx, "start", SX(-0.045), SY(0.06) - 12, { color: c.text3, bg: c.bg, align: "center", font: SMALL, pad: 3 });
  // fotodarvoza
  const gx = CL + crt.s, gl = SX(gx);
  ctx.strokeStyle = c.text; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
  ctx.moveTo(gl - 0.025 * s, SY(0.01)); ctx.lineTo(gl - 0.025 * s, SY(0.17)); ctx.lineTo(gl + 0.025 * s, SY(0.17)); ctx.lineTo(gl + 0.025 * s, SY(0.01)); ctx.stroke();
  ctx.save(); ctx.strokeStyle = crt.tGate !== null ? c.success : c.danger; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(gl, SY(0.17)); ctx.lineTo(gl, SY(0.02)); ctx.stroke(); ctx.restore();
  ctx.fillStyle = crt.tGate !== null ? c.success : c.danger; circle(ctx, gl, SY(0.17), 3.5); ctx.fill();
  geo.l2.gate = { x: gl, y: SY(0.17), r: 12 };
  // masofa o'lchovi stol old yuzida
  const my = SY(-0.017);
  ctx.strokeStyle = c.dark ? "#fde68a" : "#7c2d12"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(SX(CL), my); ctx.lineTo(gl, my); ctx.moveTo(SX(CL), my - 4); ctx.lineTo(SX(CL), my + 4); ctx.moveTo(gl, my - 4); ctx.lineTo(gl, my + 4); ctx.stroke();
  tag(ctx, `s = ${fmt(crt.s, 2)} m`, (SX(CL) + gl) / 2, SY(-0.08), { color: c.text, bg: c.bg, align: "center", font: MID });
  // blok, ip va osma yuk
  const hookY = 0.065, pc = { x: 1.29, y: 0.035 }, pr = 0.03;
  let hy = 0;
  if (hang) {
    ctx.fillStyle = c.text2; ctx.fillRect(SX(1.24), SY(0.0), 0.06 * s, 0.025 * s); ctx.beginPath(); ctx.moveTo(SX(1.265), SY(0)); ctx.lineTo(SX(pc.x), SY(pc.y)); ctx.lineWidth = 3; ctx.strokeStyle = c.text2; ctx.stroke();
    hy = crt.landed ? FLOOR + HANG_H : HANG_Y0 - x;
    ctx.strokeStyle = c.text; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(SX(xf), SY(hookY)); ctx.lineTo(SX(pc.x), SY(pc.y + pr));
    ctx.arc(SX(pc.x), SY(pc.y), pr * s, -Math.PI / 2, 0); ctx.lineTo(SX(pc.x + pr), SY(hy));
    if (crt.landed) { ctx.moveTo(SX(pc.x + pr), SY(hy)); }
    ctx.stroke();
    ctx.fillStyle = c.bg2; ctx.strokeStyle = c.text; ctx.lineWidth = 2; circle(ctx, SX(pc.x), SY(pc.y), pr * s); ctx.fill(); ctx.stroke(); ctx.fillStyle = c.text; circle(ctx, SX(pc.x), SY(pc.y), 2.5); ctx.fill();
    // osma yuk: ilgak, tayoqcha, disklar
    const hx = pc.x + pr, nd = Math.round((crt.m - 0.05) / 0.05);
    ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(SX(hx), SY(hy)); ctx.lineTo(SX(hx), SY(hy - HANG_H + 0.012)); ctx.stroke();
    ctx.fillStyle = "#475569"; ctx.fillRect(SX(hx - 0.03), SY(hy - HANG_H + 0.012), 0.06 * s, 0.012 * s);
    for (let i = 0; i < nd; i++) { ctx.fillStyle = i % 2 ? "#b45309" : "#d97706"; ctx.fillRect(SX(hx - 0.025), SY(hy - HANG_H + 0.012 + (i + 1) * 0.011), 0.05 * s, 0.011 * s - 1); }
    if (!crt.landed) tag(ctx, `m = ${fmt(crt.m * 1000, 0)} g`, SX(hx + 0.05), SY(hy - 0.04), { color: c.text, bg: c.bg, font: MID });
    const can = crt.phase === "ready";
    geo.l2.hm = { x: SX(hx + 0.07) + 22, y: SY(hy - 0.075) + 6, r: 9 }; geo.l2.hp = { x: SX(hx + 0.07) + 46, y: SY(hy - 0.075) + 6, r: 9 };
    if (can) { chip(ctx, c, geo.l2.hm.x, geo.l2.hm.y, 9, "−", { on: crt.m > 0.051 }); chip(ctx, c, geo.l2.hp.x, geo.l2.hp.y, 9, "+", { on: crt.m < 0.299 }); }
    ctx.save(); ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(SX(CL + DROP), SY(0.02)); ctx.lineTo(SX(CL + DROP), SY(0.25)); ctx.stroke(); ctx.restore();
    tag(ctx, "yuk polga tegadigan joy", SX(CL + DROP), SY(0.25) - 9, { color: c.text3, bg: c.bg, align: "center", font: SMALL, pad: 3 });
  } else {
    // dinamometr va qo'l
    const ext = 0.012 * crt.F, d0 = SX(xf), d1 = SX(xf + 0.03 + ext), d2 = SX(xf + 0.03 + ext + 0.11), Y = SY(hookY);
    ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(d0, Y);
    const nz = 9; for (let i = 1; i <= nz; i++) ctx.lineTo(d0 + ((d1 - d0) * i) / nz, Y + (i % 2 ? -4 : 4)); ctx.lineTo(d1, Y); ctx.stroke();
    ctx.fillStyle = c.dark ? "#334155" : "#e2e8f0"; ctx.strokeStyle = c.text2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(d1, Y - 7, d2 - d1, 14, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.text; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${fmt(crt.F, 1)} N`, (d1 + d2) / 2, Y + 0.5);
    // qo'l (kaft)
    ctx.fillStyle = c.dark ? "#d6a77a" : "#f1c27d"; ctx.strokeStyle = "rgba(120,72,30,0.7)"; ctx.beginPath(); ctx.roundRect(d2, Y - 9, 16, 18, 7); ctx.fill(); ctx.stroke();
    ctx.fillRect(d2 + 12, Y - 4, 18, 8);
    // F o'qi (sudraladi)
    const ay = SY(0.09 + Math.round((crt.M - 0.5) / 0.1) * 0.022) - 52, L = crt.F * FK * s;
    if (crt.F > 0.001) arrow(ctx, d0, ay, L, 0, c.primary, { width: 3, head: 11 });
    ctx.save(); ctx.strokeStyle = c.primary; ctx.globalAlpha = 0.45; ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(d0, ay); ctx.lineTo(d0, Y); ctx.stroke(); ctx.restore();
    tag(ctx, `F = ${fmt(crt.F, 1)} N`, d0 + L + 8, ay, { color: c.primary, bg: c.bg, font: BOLD });
    geo.l2.ftip = { x: d0 + L, y: ay, r: 12, x0: d0 };
  }
  // aravacha + yuklar
  const nb = Math.round((crt.M - 0.5) / 0.1);
  blocks(ctx, nb, x + CL / 2, 0.09, 0.07, 0.022, c.dark ? "#94a3b8" : "#64748b");
  cartSide(ctx, c, x, c.dark ? "#3b82f6" : "#2563eb", x / 0.02);
  ctx.fillStyle = c.text; circle(ctx, SX(xf) + 2, SY(hookY), 3); ctx.fill();
  const topY = SY(0.09 + nb * 0.022);
  tag(ctx, `M = ${fmt(crt.M, 1)} kg`, SX(x + CL / 2), topY - 34, { color: c.text, bg: c.bg, align: "center", font: MID });
  const can = crt.phase === "ready";
  geo.l2.cm = { x: SX(x + CL / 2) - 14, y: topY - 12, r: 9 }; geo.l2.cp = { x: SX(x + CL / 2) + 14, y: topY - 12, r: 9 };
  chip(ctx, c, geo.l2.cm.x, geo.l2.cm.y, 9, "−", { on: can && crt.M > 0.51 }); chip(ctx, c, geo.l2.cp.x, geo.l2.cp.y, 9, "+", { on: can && crt.M < 0.99 });
  // kuchlar (gorizontal)
  if (ui.show.vec) {
    if (hang && !crt.landed && cs.T > 0.001) {
      arrow(ctx, SX(xf) + 4, SY(hookY) - 7, cs.T * FK * s, 0, c.warning, { width: 2.6, head: 10, label: "T", font: LBL });
      const hx = SX(pc.x + pr) + 18, top = SY(hy), bot = SY(hy - HANG_H);
      arrow(ctx, hx, top, 0, -cs.T * FK * s, c.warning, { width: 2.4, head: 9, label: "T", font: LBL });
      arrow(ctx, hx, bot, 0, crt.m * GRAV * FK * s, c.text2, { width: 2.4, head: 9, label: "mg", font: "italic 700 12px Inter, system-ui, sans-serif" });
    }
    if (cs.f > 0.001) arrow(ctx, SX(x + CL / 2), SY(0.012), -cs.f * FK * s, 0, c.danger, { width: 2.6, head: 10, label: "f", font: LBL });
    if (crt.phase === "run" && Math.abs(cs.a) > 0.001) arrow(ctx, SX(x + CL / 2), topY - (hang ? 52 : 74), cs.a * 0.05 * s, 0, c.special, { width: 2.4, head: 9, label: "a", font: LBL, dash: [5, 3] });
  }
  // sekundomer
  const tt = crt.tGate ?? crt.t;
  const narrow = cw < 560, swx = narrow ? cw - 104 : 10, sww = narrow ? 96 : 118;
  ctx.fillStyle = c.dark ? "#020617" : "#0f172a"; ctx.beginPath(); ctx.roundRect(swx, 8, sww, narrow ? 26 : 34, 6); ctx.fill();
  ctx.fillStyle = crt.tGate !== null ? "#4ade80" : "#f87171"; ctx.font = `700 ${narrow ? 14 : 18}px ui-monospace, Menlo, Consolas, monospace`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(`${tt.toFixed(3)} s`, swx + 8, narrow ? 21.5 : 25.5);
  if (!narrow) { ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.fillText("sekundomer", 14, 52); }
  if (crt.aMeas !== null) tagIn(ctx, `a = 2s/t² = ${fmt(crt.aMeas, 2)} m/s²`, narrow ? cw - 8 : 136, narrow ? 46 : 26, cw, { color: c.success, bg: c.bg2, align: narrow ? "right" : "left", font: BOLD });
  if (crt.phase === "stuck") tagIn(ctx, `Tinchlikdagi ishqalanish (≤ ${fmt(crt.mu * crt.M * GRAV, 2)} N) tortish kuchini muvozanatlaydi`, cw / 2, SY(0.33), cw, { color: c.danger, bg: c.bg, align: "center", font: MID });
}

function stepLaw2(dt) {
  if (crt.phase !== "run") return;
  const n = Math.max(1, Math.ceil(dt / 0.002)), h = dt / n;
  for (let i = 0; i < n; i++) {
    const cs = cartState();
    let v1 = crt.v + cs.a * h;
    if (crt.v > 0 && v1 <= 0) { crt.v = 0; crt.phase = "done"; break; }
    const x0 = crt.x; crt.x += 0.5 * (crt.v + v1) * h; crt.v = v1; crt.t += h;
    if (crt.tGate === null && crt.x >= crt.s) {
      const tg = crt.t - h + ((crt.s - x0) / Math.max(crt.x - x0, 1e-9)) * h;
      crt.tGate = Math.round(tg * 1000) / 1000; crt.aMeas = P.accelFrom(crt.s, crt.tGate);
      crt.pts.push({ F: crt.Fd0, a: crt.aMeas, M: crt.M, mass: crt.drive === "hang" ? crt.M + crt.m : crt.M, mode: crt.drive });
      if (crt.pts.length > 40) crt.pts.shift();
    }
    if (crt.drive === "hang" && !crt.landed && crt.x >= DROP) crt.landed = true;
    if (crt.x >= XMAX) { crt.x = XMAX; crt.v = 0; crt.phase = "done"; break; }
  }
}
function startLaw2() {
  if (crt.phase !== "ready") return;
  const cs = P.cartForces({ M: crt.M, m: crt.m, F: crt.F, mu: crt.mu, mode: crt.drive, v: 0 });
  crt.Fd0 = cs.Fd; crt.t = 0; crt.tGate = null; crt.aMeas = null;
  crt.phase = cs.a > 0 ? "run" : "stuck";
  if (!loop.running) loop.start();
}
function resetLaw2() { Object.assign(crt, { x: 0, v: 0, t: 0, phase: "ready", tGate: null, aMeas: null, landed: false }); }

/* ================================================================== 2) Uchinchi qonun */

function placeRecoil() { const gap = L0 - rc.dx; rc.x1 = -gap / 2; rc.x2 = gap / 2; rc.v1 = rc.v2 = 0; rc.F = KS * rc.dx; rc.Fmax = 0; rc.t = 0; rc.st = 0; rc.strobe = []; rc.phase = "bound"; rc.start = null; rc.contact = true; }
function drawLaw3(ctx, st) {
  const { w: cw, h: ch, colors: c } = st;
  const narrow = cw < 560, W3 = narrow ? 0.66 : 1.06, B3 = W3 - 0.04;
  fit(cw, ch, -W3, W3, -0.16, 0.44, 8);
  const s = view.s; geo.l3 = { lim: B3 - 0.005 };
  ctx.fillStyle = c.dark ? "#5b4636" : "#c8a27a"; ctx.fillRect(SX(-W3), SY(0), 2 * W3 * s, 0.04 * s);
  ctx.fillStyle = c.dark ? "#94a3b8" : "#9ca3af"; ctx.fillRect(SX(-B3), SY(0.01), 2 * B3 * s, 0.01 * s);
  ctx.fillStyle = c.text2; ctx.fillRect(SX(-B3 - 0.02), SY(0.07), 0.025 * s, 0.06 * s); ctx.fillRect(SX(B3 - 0.005), SY(0.07), 0.025 * s, 0.06 * s);
  // stroboskop belgilari (har 0,1 s)
  const c1 = c.dark ? "#3b82f6" : "#2563eb", c2 = c.dark ? "#f59e0b" : "#d97706";
  rc.strobe.forEach((p) => { ctx.fillStyle = c1; ctx.fillRect(SX(p.a) - 1, SY(-0.04), 2, 7); ctx.fillStyle = c2; ctx.fillRect(SX(p.b) - 1, SY(-0.04), 2, 7); });
  if (rc.strobe.length) tag(ctx, "belgilar har 0,1 s da", SX(0), SY(-0.12), { color: c.text3, bg: c.bg, align: "center", font: SMALL });
  // prujina (1-aravacha o'ng yuzida)
  const yS = SY(0.06), comp = Math.max(0, L0 - (rc.x2 - rc.x1)), sEnd = comp > 0 ? rc.x2 : rc.x1 + L0;
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(SX(rc.x1), yS);
  const nz = 10; for (let i = 1; i < nz; i++) ctx.lineTo(SX(rc.x1 + ((sEnd - rc.x1) * i) / nz), yS + (i % 2 ? -6 : 6)); ctx.lineTo(SX(sEnd), yS); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.fillRect(SX(sEnd) - 2, yS - 8, 3, 16);
  // aravachalar
  const n1 = Math.round((rc.m1 - 0.5) / 0.5), n2 = Math.round((rc.m2 - 0.5) / 0.5);
  blocks(ctx, n1, rc.x1 - CL / 2, 0.09, 0.1, 0.032, c.dark ? "#94a3b8" : "#64748b");
  blocks(ctx, n2, rc.x2 + CL / 2, 0.09, 0.1, 0.032, c.dark ? "#94a3b8" : "#64748b");
  cartSide(ctx, c, rc.x1 - CL, c1, (rc.x1 + 0.03) / 0.02); cartSide(ctx, c, rc.x2, c2, (rc.x2 - 0.03) / 0.02);
  // ip (bog'langan holatda)
  if (rc.phase === "bound") {
    const a = SX(rc.x1 - 0.03), b = SX(rc.x2 + 0.03), y = SY(0.083);
    ctx.strokeStyle = c.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a, y); ctx.quadraticCurveTo((a + b) / 2, y - 6, b, y); ctx.stroke();
    tag(ctx, "↑ ip — bosib kesing", (a + b) / 2, SY(-0.09), { color: c.danger, bg: c.bg, align: "center", font: SMALL, pad: 4 });
    geo.l3.thread = { x: (a + b) / 2, y: y - 3, r: Math.max(16, (b - a) / 2) };
  }
  // massa tugmalari va yorliqlar
  [[rc.x1 - CL / 2, n1, rc.m1, "m₁", "1"], [rc.x2 + CL / 2, n2, rc.m2, "m₂", "2"]].forEach(([xc, n, m, lab, k]) => {
    const top = SY(0.09 + n * 0.032), can = rc.phase === "bound";
    if (!narrow) tag(ctx, `${lab} = ${fmt(m, 1)} kg`, SX(xc), top - 34, { color: c.text, bg: c.bg, align: "center", font: MID });
    geo.l3["m" + k] = { x: SX(xc) - 14, y: top - 12, r: 9 }; geo.l3["p" + k] = { x: SX(xc) + 14, y: top - 12, r: 9 };
    chip(ctx, c, geo.l3["m" + k].x, top - 12, 9, "−", { on: can && m > 0.51 }); chip(ctx, c, geo.l3["p" + k].x, top - 12, 9, "+", { on: can && m < 2.49 });
  });
  geo.l3.cart2 = { x0: SX(rc.x2), x1: SX(rc.x2 + CL), y0: SY(0.09), y1: SY(0.01) };
  geo.l3.cart1 = { x0: SX(rc.x1 - CL), x1: SX(rc.x1), y0: SY(0.09), y1: SY(0.01) };
  // kuchlar va tezliklar
  if (ui.show.vec) {
    const yF = SY(0.36), kF = 0.012 * s;
    if (rc.F > 0.01) {
      arrow(ctx, SX(rc.x1), yF, -rc.F * kF, 0, c.danger, { width: 3, head: 11 });
      arrow(ctx, SX(rc.x2), yF, rc.F * kF, 0, c.danger, { width: 3, head: 11 });
      tag(ctx, `F₂₁ = ${fmt(rc.F, 1)} N`, SX(rc.x1) - rc.F * kF - 6, yF - 16, { color: c.danger, bg: c.bg, align: "right", font: BOLD });
      tag(ctx, `F₁₂ = ${fmt(rc.F, 1)} N`, SX(rc.x2) + rc.F * kF + 6, yF - 16, { color: c.danger, bg: c.bg, align: "left", font: BOLD });
    }
    const kv = 0.3 * s, yv = SY(0.27);
    if (rc.phase !== "done" && Math.abs(rc.v1) > 0.005) arrow(ctx, SX(rc.x1 - CL / 2), yv, rc.v1 * kv, 0, c1, { width: 2.6, head: 10, label: "v₁", font: LBL });
    if (rc.phase !== "done" && Math.abs(rc.v2) > 0.005) arrow(ctx, SX(rc.x2 + CL / 2), yv, rc.v2 * kv, 0, c2, { width: 2.6, head: 10, label: "v₂", font: LBL });
  }
  if (rc.contact && rc.phase === "push") tagIn(ctx, "Ta’sir paytida 25 marta sekinlashtirilgan", cw / 2, 14, cw, { color: c.text2, bg: c.bg2, align: "center", font: SMALL });
  if (rc.phase === "done" && rc.start) {
    const s1 = Math.abs(rc.x1 - rc.start.x1), s2 = Math.abs(rc.x2 - rc.start.x2);
    tagIn(ctx, `bir xil vaqtda: s₁ = ${fmt(s1 * 100, 1)} cm, s₂ = ${fmt(s2 * 100, 1)} cm, s₁/s₂ = ${fmt(s1 / s2, 2)} = m₂/m₁ = ${fmt(rc.m2 / rc.m1, 2)}`, cw / 2, 14, cw, { color: c.text, bg: c.bg2, align: "center", font: MID });
  }
}
function stepLaw3(dt) {
  if (rc.phase !== "push" && rc.phase !== "fly") return;
  const rate = rc.contact ? 0.04 : 1, h = dt * rate;
  const nx = P.recoilStep(rc, h, { m1: rc.m1, m2: rc.m2, k: KS, L0 });
  Object.assign(rc, { x1: nx.x1, x2: nx.x2, v1: nx.v1, v2: nx.v2, F: nx.F }); rc.Fmax = Math.max(rc.Fmax, nx.F);
  rc.contact = rc.x2 - rc.x1 < L0; if (!rc.contact) rc.phase = "fly";
  rc.t += h; rc.st += h;
  if (rc.st >= 0.1 || !rc.strobe.length) { rc.st = 0; rc.strobe.push({ a: rc.x1 - CL / 2, b: rc.x2 + CL / 2 }); }
  const lim = (geo.l3 && geo.l3.lim) || 1.015;
  if (rc.x1 - CL <= -lim || rc.x2 + CL >= lim) { rc.phase = "done"; rc.strobe.push({ a: rc.x1 - CL / 2, b: rc.x2 + CL / 2 }); }
}
function releaseLaw3() { if (rc.phase !== "bound") return; rc.phase = "push"; rc.start = { x1: rc.x1, x2: rc.x2 }; rc.strobe = [{ a: rc.x1 - CL / 2, b: rc.x2 + CL / 2 }]; if (!loop.running) loop.start(); }

/* ================================================================== 3) Liftda vazn */

function person(ctx, c, xc, yFeet, si, mass) {
  const k = clamp(Math.sqrt(mass / 65), 0.7, 1.35), H = (mass < 40 ? 1.3 + (mass - 20) * 0.02 : 1.72) * si;
  const skin = c.dark ? "#d6a77a" : "#f1c27d", shirt = "#0d9488", pants = c.dark ? "#64748b" : "#334155";
  const hip = yFeet - H * 0.48, sh = yFeet - H * 0.81, sw = 0.2 * si * k, hw = 0.15 * si * k;
  ctx.lineCap = "round";
  // oyoqlar
  ctx.strokeStyle = pants; ctx.lineWidth = 0.12 * si * k; ctx.beginPath();
  ctx.moveTo(xc - hw * 0.5, hip); ctx.lineTo(xc - hw * 0.55, yFeet - 0.05 * si); ctx.moveTo(xc + hw * 0.5, hip); ctx.lineTo(xc + hw * 0.55, yFeet - 0.05 * si); ctx.stroke();
  ctx.fillStyle = "#1f2937"; ctx.beginPath(); ctx.roundRect(xc - hw * 0.55 - 0.08 * si, yFeet - 0.045 * si, 0.13 * si, 0.045 * si, 3); ctx.roundRect(xc + hw * 0.55 - 0.05 * si, yFeet - 0.045 * si, 0.13 * si, 0.045 * si, 3); ctx.fill();
  // qo'llar
  ctx.strokeStyle = skin; ctx.lineWidth = 0.075 * si * k; ctx.beginPath(); ctx.moveTo(xc - sw + 0.03 * si, sh + 0.05 * si); ctx.lineTo(xc - sw - 0.01 * si, hip + 0.03 * si); ctx.moveTo(xc + sw - 0.03 * si, sh + 0.05 * si); ctx.lineTo(xc + sw + 0.01 * si, hip + 0.03 * si); ctx.stroke();
  // tana
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.moveTo(xc - sw, sh + 0.04 * si); ctx.quadraticCurveTo(xc - sw, sh, xc - sw + 0.05 * si, sh); ctx.lineTo(xc + sw - 0.05 * si, sh); ctx.quadraticCurveTo(xc + sw, sh, xc + sw, sh + 0.04 * si);
  ctx.lineTo(xc + hw, hip + 0.03 * si); ctx.lineTo(xc - hw, hip + 0.03 * si); ctx.closePath(); ctx.fill();
  // bosh
  ctx.fillStyle = skin; ctx.fillRect(xc - 0.03 * si, sh - 0.06 * si, 0.06 * si, 0.07 * si); circle(ctx, xc, sh - 0.15 * si, 0.11 * si); ctx.fill();
  ctx.fillStyle = "#3f2a1d"; ctx.beginPath(); ctx.arc(xc, sh - 0.165 * si, 0.11 * si, Math.PI * 1.02, TAU * 0.99); ctx.fill();
  return { top: sh - 0.26 * si, mid: (sh + hip) / 2, hw: sw };
}
function drawLift(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560;
  geo.lift = { btn: [], floors: [] };
  // --- bino kesimi
  const bw = Math.round(clamp(cw * 0.2, 74, 150)), sb = (ch - 30) / (NFL * FLOORH), gy = ch - 12, bx0 = 10, bx1 = bx0 + bw;
  ctx.fillStyle = c.bg2; ctx.fillRect(bx0, gy - NFL * FLOORH * sb, bw, NFL * FLOORH * sb);
  ctx.strokeStyle = c.border; ctx.lineWidth = 1;
  for (let n = 1; n <= NFL; n++) {
    const y = gy - floorY(n) * sb; ctx.beginPath(); ctx.moveTo(bx0, y); ctx.lineTo(bx1, y); ctx.stroke();
    ctx.fillStyle = curFloor() === n && lift.mode === "idle" ? c.primary : c.text3; ctx.font = SMALL; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(String(n), bx0 + 4, y - 2);
    geo.lift.floors.push({ n, y0: y - FLOORH * sb, y1: y, x0: bx0, x1: bx1 });
  }
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(bx1 + 6, gy); ctx.stroke();
  const shx = bx0 + bw * 0.62, cwid = Math.max(18, bw * 0.3), cabTop = gy - (lift.y + 2.5) * sb;
  ctx.strokeStyle = c.border; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(shx - cwid / 2 - 3, gy - NFL * FLOORH * sb); ctx.lineTo(shx - cwid / 2 - 3, gy); ctx.moveTo(shx + cwid / 2 + 3, gy - NFL * FLOORH * sb); ctx.lineTo(shx + cwid / 2 + 3, gy); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = c.text; ctx.lineWidth = 1.2; ctx.beginPath();
  if (lift.cable) { ctx.moveTo(shx, gy - NFL * FLOORH * sb - 4); ctx.lineTo(shx, cabTop); }
  else { ctx.moveTo(shx, gy - NFL * FLOORH * sb - 4); ctx.lineTo(shx + 3, gy - NFL * FLOORH * sb + 18); ctx.moveTo(shx, cabTop); ctx.lineTo(shx - 4, cabTop - 14); }
  ctx.stroke();
  ctx.fillStyle = c.primary; ctx.fillRect(shx - cwid / 2, cabTop, cwid, 2.5 * sb);
  ctx.fillStyle = c.bg; ctx.fillRect(shx - cwid / 2 + 3, cabTop + 3, cwid - 6, 2.5 * sb - 6);
  // --- kabina ichi
  const ix0 = bx1 + 16, ix1 = cw - 8, iy0 = 8, iy1 = ch - 10, si = (iy1 - iy0) / 2.65, fy = iy1 - 0.08 * si;
  ctx.fillStyle = c.dark ? "#1e293b" : "#f1f5f9"; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(ix0, iy0, ix1 - ix0, iy1 - iy0, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.dark ? "#334155" : "#cbd5e1"; ctx.fillRect(ix0, fy, ix1 - ix0, iy1 - fy);
  const IW = ix1 - ix0, P_ = liftP(), mg = lift.m * GRAV, ratio = P_ / mg;
  // dinamometr (1 kg yuk)
  const dxp = ix0 + IW * (narrow ? 0.14 : 0.12), mw = 1, Pw = (lift.cable || lift.mode !== "idle" ? P.weight(mw, lift.a) : mw * GRAV), Lsp = (0.22 + Pw / 100) * si;
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(dxp - 10, iy0 + 2); ctx.lineTo(dxp + 10, iy0 + 2); ctx.moveTo(dxp, iy0 + 2); ctx.lineTo(dxp, iy0 + 10); ctx.stroke();
  ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(dxp, iy0 + 10); const nz = 12; for (let i = 1; i <= nz; i++) ctx.lineTo(dxp + (i % 2 ? -6 : 6), iy0 + 10 + (Lsp * i) / nz); ctx.lineTo(dxp, iy0 + 10 + Lsp); ctx.stroke();
  const wy = iy0 + 10 + Lsp; ctx.fillStyle = "#475569"; ctx.beginPath(); ctx.roundRect(dxp - 0.07 * si, wy, 0.14 * si, 0.11 * si, 3); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("1 kg", dxp, wy + 0.055 * si);
  tag(ctx, `${fmt(Pw, 1)} N`, dxp + 0.1 * si, iy0 + 10 + Lsp * 0.45, { color: c.text, bg: c.bg, font: MID });
  // tarozi va odam
  const pxc = ix0 + IW * (narrow ? 0.45 : 0.4), sw = 0.4 * si, sh = 0.06 * si;
  ctx.fillStyle = c.dark ? "#e2e8f0" : "#f8fafc"; ctx.strokeStyle = c.text2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(pxc - sw / 2, fy - sh, sw, sh, 4); ctx.fill(); ctx.stroke();
  const body = person(ctx, c, pxc, fy - sh, si, lift.m);
  const kg = P_ / GRAV;
  ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.roundRect(pxc - 0.5 * si - 54, fy - sh - 4, 62, 22, 4); ctx.fill();
  ctx.fillStyle = "#4ade80"; ctx.font = "700 13px ui-monospace, Menlo, Consolas, monospace"; ctx.textAlign = "center"; ctx.fillText(`${kg.toFixed(1)} kg`, pxc - 0.5 * si - 23, fy - sh + 7);
  ctx.fillStyle = c.text3; ctx.font = SMALL; ctx.fillText("tarozi", pxc - 0.5 * si - 23, fy - sh - 12);
  if (ui.show.vec) {
    const L = 0.55 * si, fx = pxc + body.hw + 0.18 * si;
    arrow(ctx, fx, body.mid, 0, L, c.text2, { width: 2.6, head: 10, label: "mg", font: "italic 700 12px Inter, system-ui, sans-serif" });
    if (ratio > 0.01) arrow(ctx, fx + 16, fy - sh, 0, -L * ratio, c.success, { width: 2.6, head: 10, label: "N", font: LBL });
    else tag(ctx, "N = 0", fx + 16, fy - sh - 14, { color: c.success, bg: c.bg, align: "center", font: BOLD });
    // kabina tezlanishi va tezligi
    const ax = ix0 + IW * (narrow ? 0.3 : 0.24), ay = iy0 + (iy1 - iy0) * 0.45;
    if (Math.abs(lift.a) > 0.01) arrow(ctx, ax, ay, 0, -lift.a * 0.075 * si, c.special, { width: 2.6, head: 10, label: "a", font: LBL, dash: [5, 3] });
    if (Math.abs(lift.v) > 0.01) arrow(ctx, ax + 22, ay, 0, -lift.v * 0.09 * si, c.primary, { width: 2.6, head: 10, label: "v", font: LBL });
  }
  // pult
  const pw = narrow ? 64 : 84, px0 = ix1 - pw - 10, py0 = iy0 + 14, bsz = narrow ? 17 : 22, gap = narrow ? 3 : 5;
  ctx.fillStyle = c.dark ? "#0f172a" : "#e2e8f0"; ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(px0, py0, pw, (bsz + gap) * 3 + 70, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.roundRect(px0 + 6, py0 + 6, pw - 12, 20, 4); ctx.fill();
  ctx.fillStyle = "#fbbf24"; ctx.font = "700 12px ui-monospace, Menlo, Consolas, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(`${curFloor()} ${lift.v > 0.05 ? "▲" : lift.v < -0.05 ? "▼" : ""}`, px0 + pw / 2, py0 + 16.5);
  for (let n = 1; n <= NFL; n++) {
    const r = Math.floor((NFL - n) / 3), col = (n - 1) % 3, bxp = px0 + 8 + col * (bsz + gap) + bsz / 2 + (pw - 16 - 3 * bsz - 2 * gap) / 2, byp = py0 + 34 + r * (bsz + gap) + bsz / 2;
    const lit = lift.mode === "ride" && lift.target === n, on = lift.cable && lift.mode === "idle";
    chip(ctx, c, bxp, byp, bsz / 2, String(n), { on, fill: lit ? "#fbbf24" : c.bg, color: lit ? "#78350f" : c.text2 });
    geo.lift.btn.push({ n, x: bxp, y: byp, r: bsz / 2 });
  }
  const fby = py0 + 34 + 3 * (bsz + gap) + 14, fbx = px0 + pw / 2;
  ctx.save(); ctx.globalAlpha = lift.cable ? (canFall() ? 1 : 0.4) : lift.mode === "idle" ? 1 : 0.4; ctx.fillStyle = lift.cable ? c.danger : c.success; ctx.beginPath(); ctx.roundRect(px0 + 6, fby - 11, pw - 12, 22, 6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `700 ${narrow ? 9 : 10}px Inter, system-ui, sans-serif`; ctx.fillText(lift.cable ? "Arqon uzildi!" : "Tiklash", fbx, fby + 0.5); ctx.restore();
  geo.lift.fall = { x0: px0 + 6, x1: px0 + pw - 6, y0: fby - 11, y1: fby + 11 };
  // holat yozuvi
  let msg = "";
  if (lift.mode === "fall") msg = "Erkin tushish: vaznsizlik, P = 0"; else if (lift.mode === "brake") msg = `Tormoz: ortiqcha yuklama P = ${fmt(ratio, 1)}mg`;
  else if (lift.mode === "ride") msg = Math.abs(lift.a) < 0.01 ? "Tekis harakat: P = mg" : lift.a > 0 ? "Yuqoriga tezlanish: P > mg" : "Pastga tezlanish: P < mg";
  else msg = lift.cable ? "Lift turibdi: P = mg" : "Arqon uzilgan — tormoz ushlab turibdi";
  if (!narrow) tagIn(ctx, msg, ix0 + IW * 0.42, iy0 + 16, cw, { color: lift.mode === "fall" || lift.mode === "brake" ? "#fff" : c.text, bg: lift.mode === "fall" || lift.mode === "brake" ? c.danger : c.bg2, align: "center", font: MID });
}
function startRide(n) {
  if (!lift.cable || lift.mode !== "idle") return;
  const D = floorY(n) - lift.y; if (Math.abs(D) < 0.01) return;
  lift.ride = P.rideProfile(D, lift.a0, VMAX); lift.tr = 0; lift.mode = "ride"; lift.target = n;
  if (!loop.running) loop.start();
}
function cutCable() { if (!canFall()) return; lift.cable = false; lift.mode = "fall"; lift.tf = 0; if (!loop.running) loop.start(); }
function stepLift(dt) {
  const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
  if (lift.auto) { lift.auto.t -= dt; if (lift.auto.t <= 0) { const f = lift.auto.fn; lift.auto = null; f(); } }
  for (let i = 0; i < n; i++) {
    if (lift.mode === "ride") {
      lift.tr += h; lift.a = lift.ride.acc(lift.tr);
      if (lift.tr >= lift.ride.T) { lift.y = floorY(lift.target); lift.v = 0; lift.a = 0; lift.mode = "idle"; break; }
    } else if (lift.mode === "fall") { lift.a = -GRAV; lift.tf += h; if (lift.tf >= 0.9) lift.mode = "brake"; }
    else if (lift.mode === "brake") { lift.a = GRAV; if (lift.v + lift.a * h >= 0) { lift.v = 0; lift.a = 0; lift.mode = "idle"; break; } }
    else lift.a = 0;
    lift.v += lift.a * h; lift.y = Math.max(0, lift.y + lift.v * h);
  }
  lift.t += dt;
  lift.hist.push({ t: lift.t, a: lift.a, v: lift.v, P: liftP() }); trim(lift.hist, lift.t - 20);
}

/* ------------------------------------------------------------------ Asosiy chizish */

function draw(ctx, st) {
  ctx.fillStyle = st.colors.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "law2") drawLaw2(ctx, st); else if (ui.mode === "law3") drawLaw3(ctx, st); else drawLift(ctx, st);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.46, vh * 0.44), 260, 360)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => (ui.mode === "law3" ? Math.round(clamp(cw * 0.36, 230, 300)) : heights(cw).stage) });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  law2: [["aF", "a(F)", "Tezlanish kuchga bog‘liq (o‘lchovlar)", "Massa o‘zgarmas bo‘lsa, tezlanish kuchga to‘g‘ri proporsional: nuqtalar koordinata boshidan o‘tuvchi to‘g‘ri chiziqqa tushadi (ishqalanish bo‘lsa, chiziq μMg dan boshlanadi). Nuqta rangi — aravacha massasi."], ["am", "a(1/m)", "Tezlanish massaga bog‘liq (o‘lchovlar)", "Kuch o‘zgarmas bo‘lsa, a = F/m: tezlanish massaga teskari proporsional, 1/m ga nisbatan to‘g‘ri chiziq. Xira nuqtalar — boshqa kuch bilan o‘lchangan."]],
  law3: [],
  lift: [["P", "P(t)", "Tarozi ko‘rsatgan vazn", "Lift yuqoriga tezlansa yoki pastga tormozlansa (tezlanish yuqoriga), vazn mg dan katta; pastga tezlansa — kichik; tekis harakatda P = mg; erkin tushishda P = 0."], ["av", "a(t), v(t)", "Kabina tezlanishi va tezligi", "Vazn tezlikka emas, tezlanishga bog‘liq: tekis harakatda (v ≠ 0, a = 0) tarozi mg ni ko‘rsatadi."]],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[ui.mode].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
  $("[data-graph-card]").hidden = !TABS[ui.mode].length;
  $("[data-meas-clear]").hidden = ui.mode !== "law2";
}
function setTab(tab) {
  const list = TABS[ui.mode]; if (!list.length) return;
  const t = list.find((x) => x[0] === tab) || list[0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.render();
}
function drawGraphCanvas(ctx, gst) {
  if (ui.mode === "law2") {
    const Fd = crt.drive === "hang" ? crt.m * GRAV : crt.F;
    if (ui.tab === "am") return G.drawAM(ctx, gst, { pts: crt.pts.filter((p) => p.mode === crt.drive), M: crt.M, m: crt.m, F: crt.F, mu: crt.mu, mode: crt.drive });
    return G.drawAF(ctx, gst, { pts: crt.pts.filter((p) => p.mode === crt.drive), M: crt.M, mu: crt.mu, mode: crt.drive, Fd });
  }
  if (ui.mode === "lift") return ui.tab === "av" ? G.drawLiftAV(ctx, gst, { hist: lift.hist, span: 16 }) : G.drawLiftP(ctx, gst, { hist: lift.hist, span: 16, mass: lift.m });
  ctx.fillStyle = gst.colors.bg; ctx.fillRect(0, 0, gst.w, gst.h);
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
  if (ui.mode === "law2") {
    const hang = crt.drive === "hang", cs0 = P.cartForces({ M: crt.M, m: crt.m, F: crt.F, mu: crt.mu, mode: crt.drive, v: 0 }), cs = crt.phase === "run" ? cartState() : cs0;
    setRO("r1", "Tezlanuvchi massa", `${fmt(cs0.mass, 2)}<small>kg</small>`, hang ? `M + m = ${fmt(crt.M, 1)} + ${fmt(crt.m, 2)}` : "aravacha M");
    setRO("r2", hang ? "Tortuvchi kuch <i>mg</i>" : "Tortish kuchi <i>F</i>", `${fmt(cs0.Fd, 2)}<small>N</small>`, hang ? `ip tarangligi T = ${fmt(cs.T, 2)} N` : "dinamometr ko‘rsatishi");
    setRO("r3", "Ishqalanish kuchi <i>f</i>", `${fmt(cs.f, 2)}<small>N</small>`, crt.mu ? `eng ko‘pi μMg = ${fmt(crt.mu * crt.M * GRAV, 2)} N` : "ishqalanishsiz", crt.mu ? "" : "muted");
    setRO("r4", "Tezlanish (nazariya)", `${fmt(cs0.a, 2)}<small>m/s²</small>`, `a = (${hang ? "mg" : "F"} − f)/${hang ? "(M + m)" : "M"}`);
    setRO("r5", "O‘lchangan vaqt <i>t</i>", crt.tGate !== null ? `${fmt(crt.tGate, 3)}<small>s</small>` : "—", `s = ${fmt(crt.s, 2)} m masofada`);
    setRO("r6", "O‘lchangan tezlanish", crt.aMeas !== null ? `${fmt(crt.aMeas, 2)}<small>m/s²</small>` : "—", crt.aMeas !== null ? `a = 2s/t²; xato ${fmt(Math.abs(crt.aMeas - cs0.a) / Math.max(cs0.a, 1e-9) * 100, 1)}%` : "aravachani qo‘yib yuboring", crt.aMeas !== null ? "" : "muted");
  } else if (ui.mode === "law3") {
    const fin = P.recoilFinal(rc.m1, rc.m2, KS, rc.dx), F = rc.phase === "bound" ? KS * rc.dx : rc.F;
    setRO("r1", "Massalar <i>m₁ : m₂</i>", `${fmt(rc.m1, 1)} : ${fmt(rc.m2, 1)}<small>kg</small>`, `prujina k = ${KS} N/m, Δx = ${fmt(rc.dx * 100, 1)} cm`);
    setRO("r2", "O‘zaro ta’sir kuchi", `${fmt(F, 1)}<small>N</small>`, `|F₁₂| = |F₂₁|; eng katta ${fmt(KS * rc.dx, 1)} N`);
    setRO("r3", "Tezlanishlar <i>a₁, a₂</i>", `${fmt(F / rc.m1, 1)} ; ${fmt(F / rc.m2, 1)}<small>m/s²</small>`, `a₁/a₂ = m₂/m₁ = ${fmt(rc.m2 / rc.m1, 2)}`);
    setRO("r4", "Tezliklar <i>v₁, v₂</i>", `${fmt(rc.v1, 2)} ; ${fmt(rc.v2, 2)}<small>m/s</small>`, `oxirida ${fmt(fin.v1, 2)} va ${fmt(fin.v2, 2)} m/s`);
    setRO("r5", "Impulslar yig‘indisi", `${fmt(rc.m1 * rc.v1 + rc.m2 * rc.v2, 3)}<small>kg·m/s</small>`, `p₁ = ${fmt(rc.m1 * rc.v1, 2)}, p₂ = ${fmt(rc.m2 * rc.v2, 2)}`);
    const s1 = rc.start ? Math.abs(rc.x1 - rc.start.x1) : 0, s2 = rc.start ? Math.abs(rc.x2 - rc.start.x2) : 0;
    setRO("r6", "Yo‘llar nisbati <i>s₁/s₂</i>", s2 > 0.002 ? fmt(s1 / s2, 2) : "—", `m₂/m₁ = ${fmt(rc.m2 / rc.m1, 2)}`, s2 > 0.002 ? "" : "muted");
  } else {
    const P_ = liftP(), mg = lift.m * GRAV;
    setRO("r1", "Kabina tezlanishi <i>a</i>", `${fmt(lift.a, 2)}<small>m/s²</small>`, lift.a > 0.01 ? "yuqoriga" : lift.a < -0.01 ? "pastga" : "a = 0");
    setRO("r2", "Kabina tezligi <i>v</i>", `${fmt(lift.v, 2)}<small>m/s</small>`, lift.v > 0.01 ? "yuqoriga" : lift.v < -0.01 ? "pastga" : "turibdi");
    setRO("r3", "Vazn <i>P</i>", `${fmt(P_, 0)}<small>N</small>`, `og‘irlik kuchi mg = ${fmt(mg, 0)} N`, Math.abs(P_ - mg) > 1 ? "orange" : "");
    setRO("r4", "Tarozi ko‘rsatishi", `${fmt(P_ / GRAV, 1)}<small>kg</small>`, `haqiqiy massa ${fmt(lift.m, 0)} kg`);
    setRO("r5", "Yuklama <i>P/mg</i>", fmt(P_ / mg, 2), P_ < 1 ? "vaznsizlik" : P_ > mg * 1.01 ? "ortiqcha yuklama" : P_ < mg * 0.99 ? "vazn kamaygan" : "odatdagi");
    setRO("r6", "Qavat", `${curFloor()}`, `balandlik ${fmt(lift.y, 1)} m`);
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "law2") { t = { ready: "Tayyor", run: "Harakatlanmoqda", done: "To‘xtadi", stuck: "Qo‘zg‘almadi" }[crt.phase]; tone = { ready: "blue", run: "green", done: "purple", stuck: "red" }[crt.phase]; }
  else if (ui.mode === "law3") { t = { bound: "Ip bilan bog‘langan", push: "O‘zaro ta’sir", fly: "Ajralib ketdi", done: "To‘xtatgichga yetdi" }[rc.phase]; tone = rc.phase === "push" ? "orange" : rc.phase === "bound" ? "blue" : "green"; }
  else { const r = liftP() / (lift.m * GRAV); t = r < 0.02 ? "Vaznsizlik" : r > 1.01 ? "Ortiqcha yuklama" : r < 0.99 ? "Vazn kamaygan" : "P = mg"; tone = r < 0.02 ? "red" : r > 1.01 ? "orange" : r < 0.99 ? "purple" : "green"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "law2") {
    p.push("<p><b>Nyutonning ikkinchi qonuni:</b> jism olgan tezlanish unga ta’sir etayotgan natijaviy kuchga to‘g‘ri, massasiga teskari proporsional: a = F/m. Kuch 2 marta ortsa tezlanish 2 marta ortadi; massa 2 marta ortsa — 2 marta kamayadi.</p>");
    p.push(crt.drive === "hang" ? "<p>Osilgan yuk og‘irligi mg <b>ikki jismni</b> — aravacha va yukning o‘zini — tezlantiradi: a = mg/(M + m). Shuning uchun ip tarangligi T = m(g − a) yukning og‘irligidan kichik. Yuk polga tekkach ip bo‘shaydi va aravacha inersiya bilan harakatlanadi.</p>" : "<p>Aravacha tinch holatdan boshlab s masofani t vaqtda o‘tsa, s = at²/2, demak a = 2s/t². Fotodarvoza vaqtni o‘lchaydi — natija grafikka nuqta bo‘lib tushadi. Kuch va massani o‘zgartirib, bir nechta o‘lchov qiling.</p>");
    if (crt.mu > 0) p.push(`<p>Ishqalanish natijaviy kuchni kamaytiradi: F<sub>nat</sub> = F − μMg. Tortish kuchi μMg = ${fmt(crt.mu * crt.M * GRAV, 2)} N dan oshmaguncha aravacha qo‘zg‘almaydi — tinchlikdagi ishqalanish uni muvozanatlaydi.</p>`);
  } else if (ui.mode === "law3") {
    p.push("<p><b>Nyutonning uchinchi qonuni:</b> ikki jism bir-biriga moduli teng, yo‘nalishi qarama-qarshi kuchlar bilan ta’sir qiladi: F₁₂ = −F₂₁. Kuchlar <b>har xil jismlarga</b> qo‘yilgan, shuning uchun bir-birini muvozanatlamaydi.</p>");
    p.push("<p>Kuchlar teng, massalar har xil — tezlanishlar massaga teskari proporsional: a₁/a₂ = m₂/m₁. Ta’sir vaqti bir xil bo‘lgani uchun tezliklar va bir xil vaqtda o‘tilgan yo‘llar ham shu nisbatda: yengil aravacha uzoqroqqa ketadi. Impulslar yig‘indisi nolligicha qoladi.</p>");
  } else {
    p.push("<p><b>Vazn</b> — jismning tayanchga (tarozi) bosish kuchi. Kabina bilan birga a tezlanish bilan harakatlanayotgan odamga mg va N ta’sir qiladi: N − mg = ma, tarozi esa uchinchi qonunga ko‘ra P = N = m(g + a) ni ko‘rsatadi (a — yuqoriga musbat).</p>");
    p.push("<p>Tezlanish yuqoriga yo‘nalganda (yuqoriga tezlanish yoki pastga tushishda tormozlanish) — <b>ortiqcha yuklama</b>, pastga yo‘nalganda — vazn kamayadi. Erkin tushishda a = −g va P = 0 — <b>vaznsizlik</b>: odam va yuk tarozi va prujinaga bosmaydi, ammo og‘irlik kuchi mg o‘zgarmaydi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "law2" ? "<small>Ikkinchi qonun</small> a = F/m" : ui.mode === "law3" ? "<small>Uchinchi qonun</small> F₁₂ = −F₂₁" : "<small>Vazn</small> P = m(g + a)";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
const actBtn = $("[data-action]");
function updateAction() {
  let t = "", dis = false;
  if (ui.mode === "law2") { t = crt.phase === "ready" ? "Qo‘yib yuborish" : "Qaytadan tayyorlash"; dis = crt.phase === "run"; }
  else if (ui.mode === "law3") { t = rc.phase === "bound" ? "Ipni kesish" : "Qaytadan bog‘lash"; dis = rc.phase === "push" || rc.phase === "fly"; }
  else { t = lift.cable ? "Arqon uzildi!" : "Arqonni tiklash"; dis = lift.cable ? !canFall() : lift.mode !== "idle"; }
  if (actBtn.textContent !== t) actBtn.textContent = t; actBtn.disabled = dis;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); updateAction(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  if (ui.mode === "law2") stepLaw2(dt); else if (ui.mode === "law3") stepLaw3(dt); else stepLift(dt);
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
function resetMode() {
  if (ui.mode === "law2") resetLaw2();
  else if (ui.mode === "law3") placeRecoil();
  else Object.assign(lift, { v: 0, a: 0, mode: "idle", cable: true, ride: null, auto: null, y: floorY(curFloor()), hist: [], t: 0 });
}
$("[data-reset]").addEventListener("click", () => { resetMode(); refresh(); });
actBtn.addEventListener("click", () => {
  if (ui.mode === "law2") { if (crt.phase === "ready") startLaw2(); else resetLaw2(); }
  else if (ui.mode === "law3") { if (rc.phase === "bound") releaseLaw3(); else placeRecoil(); }
  else if (lift.cable) cutCable(); else Object.assign(lift, { cable: true, mode: "idle" });
  customized(); refresh();
});
$("[data-meas-clear]").addEventListener("click", () => { crt.pts = []; refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const ready2 = () => { if (crt.phase !== "ready") resetLaw2(); };
const aFC = bindRange($("#aF"), $("#aFOut"), (v) => `${fmt(v, 1)} N`, (v) => { crt.F = v; ready2(); customized(); refresh(); });
const aMhC = bindRange($("#aMh"), $("#aMhOut"), (v) => `${fmt(v * 1000, 0)} g`, (v) => { crt.m = v; ready2(); customized(); refresh(); });
const aMC = bindRange($("#aM"), $("#aMOut"), (v) => `${fmt(v, 1)} kg`, (v) => { crt.M = v; ready2(); customized(); refresh(); });
const aMuC = bindRange($("#aMu"), $("#aMuOut"), (v) => fmt(v, 2), (v) => { crt.mu = v; ready2(); customized(); refresh(); });
const aSC = bindRange($("#aS"), $("#aSOut"), (v) => `${fmt(v, 2)} m`, (v) => { crt.s = Math.min(v, gateMax()); if (crt.s !== v) aSC.set(crt.s); ready2(); customized(); refresh(); });
document.querySelectorAll("[data-drive-value]").forEach((b) => b.addEventListener("click", () => { crt.drive = b.dataset.driveValue; crt.s = Math.min(crt.s, gateMax()); resetLaw2(); syncAll(); setModeUI(); customized(); refresh(); }));
const rM1C = bindRange($("#rM1"), $("#rM1Out"), (v) => `${fmt(v, 1)} kg`, (v) => { rc.m1 = v; placeRecoil(); customized(); refresh(); });
const rM2C = bindRange($("#rM2"), $("#rM2Out"), (v) => `${fmt(v, 1)} kg`, (v) => { rc.m2 = v; placeRecoil(); customized(); refresh(); });
const rXC = bindRange($("#rX"), $("#rXOut"), (v) => `${fmt(v, 1)} cm`, (v) => { rc.dx = v / 100; placeRecoil(); customized(); refresh(); });
const lMC = bindRange($("#lM"), $("#lMOut"), (v) => `${fmt(v, 0)} kg`, (v) => { lift.m = v; customized(); refresh(); });
const lAC = bindRange($("#lA"), $("#lAOut"), (v) => `${fmt(v, 1)} m/s²`, (v) => { lift.a0 = v; customized(); refresh(); });
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* Sahnadagi boshqaruv */
const canvas = stage.canvas;
let drag = null, grab = 0;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const inBox = (p, b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
function hitTest(p) {
  if (ui.mode === "law2") {
    const g = geo.l2 || {}, can = crt.phase === "ready";
    for (const k of ["cm", "cp", "hm", "hp"]) if (can && hitR(p, g[k])) return k;
    if (hitR(p, g.ftip) && can) return "ftip";
    if (hitR(p, g.gate) || (g.gate && Math.abs(p.x - g.gate.x) < 10 && p.y > g.gate.y - 6 && p.y < g.gate.y + 0.17 * view.s)) return "gate";
    return null;
  }
  if (ui.mode === "law3") {
    const g = geo.l3 || {}, can = rc.phase === "bound";
    for (const k of ["m1", "p1", "m2", "p2"]) if (can && hitR(p, g[k])) return k;
    if (can && g.thread && Math.abs(p.x - g.thread.x) < g.thread.r && Math.abs(p.y - g.thread.y) < 12) return "thread";
    if (can && (inBox(p, g.cart2) || inBox(p, g.cart1))) return inBox(p, g.cart2) ? "c2" : "c1";
    return null;
  }
  const g = geo.lift || {};
  for (const b of g.btn || []) if (hitR(p, b)) return "f" + b.n;
  if (inBox(p, g.fall)) return "fall";
  for (const f of g.floors || []) if (inBox(p, f)) return "f" + f.n;
  return null;
}
const CURSOR = { ftip: "ew-resize", gate: "ew-resize", c1: "ew-resize", c2: "ew-resize" };
function click(h) {
  if (h === "cm") crt.M = Math.round((crt.M - 0.1) * 10) / 10; else if (h === "cp") crt.M = Math.round((crt.M + 0.1) * 10) / 10;
  else if (h === "hm") crt.m = Math.round((crt.m - 0.05) * 100) / 100; else if (h === "hp") crt.m = Math.round((crt.m + 0.05) * 100) / 100;
  else if (/^[mp][12]$/.test(h)) { const k = h[1] === "1" ? "m1" : "m2"; rc[k] = clamp(rc[k] + (h[0] === "p" ? 0.5 : -0.5), 0.5, 2.5); placeRecoil(); }
  else if (h === "thread") releaseLaw3();
  else if (h === "fall") { if (lift.cable) cutCable(); else if (lift.mode === "idle") lift.cable = true; }
  else if (h[0] === "f") startRide(+h.slice(1));
  crt.M = clamp(crt.M, 0.5, 1); crt.m = clamp(crt.m, 0.05, 0.3);
  syncAll(); customized(); refresh();
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  if (!["ftip", "gate", "c1", "c2"].includes(h)) { click(h); return; }
  drag = h; canvas.dataset.dragging = "true";
  const w0 = toWorld(p.x, p.y); grab = h === "c2" ? w0.x - rc.x2 : h === "c1" ? w0.x - rc.x1 : 0;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  onDrag(p);
});
function onDrag(p) {
  const w = toWorld(p.x, p.y);
  if (drag === "ftip") { crt.F = clamp(Math.round(((p.x - geo.l2.ftip.x0) / (FK * view.s)) * 10) / 10, 0, 4); aFC.set(crt.F); }
  else if (drag === "gate") { if (crt.phase !== "ready") resetLaw2(); crt.s = clamp(Math.round((w.x - CL) * 20) / 20, 0.1, gateMax()); aSC.set(crt.s); }
  else if (drag === "c2") { rc.dx = clamp(Math.round((L0 - (w.x - grab - rc.x1)) * 200) / 200, 0.005, 0.04); placeRecoil(); rXC.set(rc.dx * 100); }
  else if (drag === "c1") { rc.dx = clamp(Math.round((L0 - (rc.x2 - (w.x - grab))) * 200) / 200, 0.005, 0.04); placeRecoil(); rXC.set(rc.dx * 100); }
  customized(); refresh();
}
canvas.addEventListener("pointermove", (e) => {
  const p = ptr(e);
  if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? CURSOR[h] || "pointer" : ""; return; }
  onDrag(p);
});
function endDrag() { drag = null; canvas.dataset.dragging = "false"; }
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  force: { mode: "law2", title: "Doimiy kuch: F = ma", lesson: "Dinamometr aravachani 1 N kuch bilan tortadi. «Qo‘yib yuborish»ni bosing: fotodarvoza vaqtni o‘lchaydi va a = 2s/t² grafikka tushadi. Kuch o‘qini surib 2 N, 3 N bilan takrorlang — nuqtalar to‘g‘ri chiziqda yotadi.", set: () => Object.assign(crt, { drive: "force", M: 0.5, F: 1, mu: 0, s: 0.6, pts: [] }), tab: "aF" },
  mass: { mode: "law2", title: "Massani oshirish", lesson: "F = 2 N o‘zgarmas. Aravachaga «+» bilan yuk qo‘shib (0,5 → 1 kg) o‘lchang: massa 2 marta ortsa, tezlanish 2 marta kamayadi. a(1/m) grafigida nuqtalar to‘g‘ri chiziqda.", set: () => Object.assign(crt, { drive: "force", M: 0.5, F: 2, mu: 0, s: 0.6, pts: [] }), tab: "am" },
  hang: { mode: "law2", title: "Blok orqali osilgan yuk", lesson: "100 g yukning og‘irligi (0,98 N) aravacha bilan yukning o‘zini tezlantiradi: a = mg/(M + m) = 1,63 m/s². Ip tarangligi T yukning og‘irligidan kichik. Yuk polga tekkach aravacha inersiya bilan ketadi.", set: () => Object.assign(crt, { drive: "hang", M: 0.5, m: 0.1, mu: 0, s: 0.35, pts: [] }), tab: "aF" },
  fric: { mode: "law2", title: "Ishqalanish bilan", lesson: "μ = 0,2: ishqalanish kuchi μMg = 0,98 N. F = 0,8 N da aravacha qo‘zg‘almaydi; kuch o‘qini surib 1,5 N, 2,5 N bilan o‘lchang — to‘g‘ri chiziq koordinata boshidan emas, μMg nuqtadan boshlanadi.", set: () => Object.assign(crt, { drive: "force", M: 0.5, F: 0.8, mu: 0.2, s: 0.6, pts: [] }), tab: "aF" },
  eq: { mode: "law3", title: "Teng massalar", lesson: "Ikki aravacha massasi teng: ipni kesing — ular bir xil tezlik bilan qarama-qarshi tomonlarga ketadi. Ta’sir paytidagi kuchlar teng va qarama-qarshi.", set: () => Object.assign(rc, { m1: 1, m2: 1, dx: 0.03 }) },
  uneq: { mode: "law3", title: "Massalar 1 : 2", lesson: "m₂ = 2m₁. Kuchlar baribir teng, lekin og‘ir aravacha 2 marta sekin ketadi: belgilar orasidagi masofa 2 marta kichik, s₁/s₂ = 2.", set: () => Object.assign(rc, { m1: 0.5, m2: 1, dx: 0.03 }) },
  big: { mode: "law3", title: "Yengil va og‘ir (1 : 5)", lesson: "m₂ = 5m₁: og‘ir aravacha deyarli joyida qoladi — miltiq va o‘q, qayiqdan sakrash kabi. Impulslar yig‘indisi baribir nol.", set: () => Object.assign(rc, { m1: 0.5, m2: 2.5, dx: 0.04 }) },
  up: { mode: "lift", title: "Yuqoriga: 1 → 9 qavat", lesson: "Lift yuqoriga tezlanganda tarozi ko‘proq, tekis harakatda — aniq massani, to‘xtashda (tezlanish pastga) — kamroq ko‘rsatadi. Pultda boshqa qavatni tanlang.", set: () => { Object.assign(lift, { m: 60, a0: 2, y: 0 }); lift.auto = { t: 0.6, fn: () => startRide(9) }; }, tab: "P" },
  down: { mode: "lift", title: "Pastga: 9 → 1 qavat", lesson: "Pastga tezlanishda vazn kamayadi, pastga tushib to‘xtashda (tormoz — tezlanish yuqoriga) ortiqcha yuklama.", set: () => { Object.assign(lift, { m: 60, a0: 2, y: floorY(9) }); lift.auto = { t: 0.6, fn: () => startRide(1) }; }, tab: "P" },
  fall: { mode: "lift", title: "Arqon uzildi: vaznsizlik", lesson: "9-qavatda arqon uziladi: kabina erkin tushadi (a = −g) — tarozi ham, dinamometr ham nolni ko‘rsatadi. So‘ng xavfsizlik tormozi kabinani a = g bilan to‘xtatadi — vazn 2 marta ortadi.", set: () => { Object.assign(lift, { m: 60, a0: 2, y: floorY(9) }); lift.auto = { t: 1.2, fn: cutCable }; }, tab: "P" },
};
const GROUPS = [["Ikkinchi qonun", ["force", "mass", "hang", "fric"]], ["Uchinchi qonun", ["eq", "uneq", "big"]], ["Liftda vazn", ["up", "down", "fall"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  aFC.set(crt.F); aMhC.set(crt.m); aMC.set(crt.M); aMuC.set(crt.mu); aSC.set(crt.s);
  document.querySelectorAll("[data-drive-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.driveValue === crt.drive)));
  rM1C.set(rc.m1); rM2C.set(rc.m2); rXC.set(rc.dx * 100);
  lMC.set(lift.m); lAC.set(lift.a0);
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { law2: "Yuk «+»/«−», kuch o‘qi va fotodarvoza suriladi", law3: "Aravachani surib prujinani siqing, ipni bosib kesing", lift: "Kabina pultidagi qavat tugmasini bosing" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(ui.mode); });
  document.querySelectorAll("[data-dctl]").forEach((el) => { el.hidden = el.dataset.dctl !== crt.drive; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode];
  setupTabs(); window.dispatchEvent(new Event("resize"));
}
const MODE_DEFAULT = { law2: "force", law3: "uneq", lift: "up" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; lift.auto = null;
  ui.mode = p.mode;
  if (p.mode === "lift") Object.assign(lift, { v: 0, a: 0, mode: "idle", cable: true, ride: null, hist: [], t: 0 });
  p.set();
  if (p.mode === "law2") resetLaw2(); else if (p.mode === "law3") placeRecoil();
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || (TABS[ui.mode][0] || [""])[0]);
  refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "force");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
