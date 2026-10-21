// ==========================================================================
// Suyuqlik va gaz harakati — virtual laboratoriya (simulations/fluid.html)
// 1) Oqim uzluksizligi: uch kesimli quvur (devor tutqichlari bilan diametrlar), jo'mrak dastagi (Q), zarralar
//    v = Q/S tezlik bilan oqadi, rangli «bo'lak» — uzunligi o'zgaradi, hajmi saqlanadi.
// 2) Bernulli qonuni: tor joyli va ko'tariluvchi quvur, to'rtta manometr (ustun balandligi p/ρg), energiya chizig'i,
//    Venturi trubkasi; yagona grafik — napor hadlari quvur bo'ylab.
// 3) Qo'llanishlar: Torichelli (sath va teshikni surish, uchish masofasi), qanot (Jukovskiy profili atrofidagi
//    potensial oqim, bosim xaritasi, chiqish qirrasini surib hujum burchagi), purkagich (naychani surish).
// Fizika: fluid-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion, arrow, angleArc } from "./sim-kit.js";
import * as P from "./fluid-physics.js";
import { frame, ticks, legend } from "./pendulum-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const BOLD = "700 12px Inter, system-ui, sans-serif";
const LBL = "italic 700 13px Inter, system-ui, sans-serif";
const COL = { y: "#64748b", p: "#2563eb", v: "#16a34a", e: "#9333ea", slab: "#ea580c" };
const WATER = (c) => (c.dark ? "rgba(56,189,248,0.30)" : "rgba(59,130,246,0.22)");
const WATER_S = (c) => (c.dark ? "rgba(125,211,252,0.9)" : "rgba(37,99,235,0.8)");
const g0 = P.G;

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "flow", sub: "tor", show: { vec: true }, t: 0 };
const flow = { Q: 1, d: [10, 5, 8], pipe: null, slab: null };
const D1B = 10, BX = [12, 50, 85, 122], TOPB = 66;
const bern = { Q: 2.5, dt: 5, p1: 45, dy: 0, pipe: null };
const tor = { H: 1.3, holes: 1, yh: 0.45 };
const wing = { V: 40, alpha: 5 * DEG, foil: null, key: "", lines: null, pmap: null, pkey: "", top: null, bot: null, CHORD: 1.5 };
const spray = { v: 25, hs: 3 };
let presetId = null;
const geo = {};
let CW = 800;

/* ------------------------------------------------------------------ Dunyo → ekran */

const view = { s: 1, ox: 0, oy: 0, x0: 0, y1: 0 };
function fit(w, h, x0, x1, y0, y1, pad = 6) {
  const s = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0));
  view.s = s; view.ox = (w - (x1 - x0) * s) / 2; view.oy = (h - (y1 - y0) * s) / 2; view.x0 = x0; view.y1 = y1;
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
function knob(ctx, c, x, y, r, frac, label, val) {
  ctx.fillStyle = c.bg2; ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 1.5; circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = c.border; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, 405 * DEG); ctx.stroke();
  ctx.strokeStyle = c.primary; ctx.beginPath(); ctx.arc(x, y, r + 5, 135 * DEG, (135 + 270 * clamp(frac, 0, 1)) * DEG); ctx.stroke();
  const a = (135 + 270 * clamp(frac, 0, 1)) * DEG; ctx.strokeStyle = c.text; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3)); ctx.stroke();
  ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(label, x, y + r + 8);
  if (val) { ctx.fillStyle = c.text; ctx.font = MID; ctx.fillText(val, x, y + r + 20); }
}
/** Sudraladigan tutqich (↕). */
function handle(ctx, c, x, y, r = 7, horiz = false) {
  ctx.save(); ctx.fillStyle = c.bg; ctx.strokeStyle = c.primary; ctx.lineWidth = 2; circle(ctx, x, y, r); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.primary; ctx.translate(x, y); if (horiz) ctx.rotate(Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(0, -r + 1.8); ctx.lineTo(-3, -1.3); ctx.lineTo(3, -1.3); ctx.closePath(); ctx.moveTo(0, r - 1.8); ctx.lineTo(-3, 1.3); ctx.lineTo(3, 1.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}
/** Vertikal o'lcham qavsi. */
function vbracket(ctx, c, x, y0, y1, text, col, side = 1) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.moveTo(x - 4, y0); ctx.lineTo(x + 4, y0); ctx.moveTo(x - 4, y1); ctx.lineTo(x + 4, y1); ctx.stroke(); ctx.restore();
  if (text) tagIn(ctx, text, x + side * 6, (y0 + y1) / 2, CW, { color: col, bg: c.bg, align: side > 0 ? "left" : "right", font: SMALL, pad: 4 });
}
const hash = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ------------------------------------------------------------------ Quvur (umumiy) */

/** secs: [{x0, x1, d, y}] — o'zgarmas bo'laklar, oralarida silliq o'tish. Uzunlik — cm. */
function makePipe(secs) {
  const x0 = secs[0].x0, x1 = secs[secs.length - 1].x1, sm = (u) => u * u * (3 - 2 * u);
  function at(x) {
    for (let i = 0; i < secs.length; i++) {
      const s = secs[i];
      if (x <= s.x1) {
        if (i === 0 || x >= s.x0) return { d: s.d, y: s.y };
        const p = secs[i - 1], u = sm((x - p.x1) / (s.x0 - p.x1));
        return { d: p.d + (s.d - p.d) * u, y: p.y + (s.y - p.y) * u };
      }
    }
    const s = secs[secs.length - 1]; return { d: s.d, y: s.y };
  }
  const S = (x) => { const d = at(x).d; return (Math.PI * d * d) / 4; };
  const slope = (x) => (at(x + 0.25).y - at(x - 0.25).y) / 0.5;
  return { x0, x1, at, S, slope, dmax: Math.max(...secs.map((s) => s.d)) };
}
/** Quvur o'qi bo'ylab gorizontal tezlik, cm/s (Qc — cm³/s). */
const vx = (pipe, Qc, x) => { const s = pipe.slope(x); return Qc / pipe.S(x) / Math.sqrt(1 + s * s); };
function makeParts(n) { return { n, x: new Float64Array(n), e: new Float64Array(n) }; }
/** Zarralar hajm bo'yicha tekis: chiziqli zichlik ~ S. */
function seedParts(pt, pipe) {
  const L = pipe.x1 - pipe.x0, dm2 = pipe.dmax ** 2;
  for (let i = 0; i < pt.n; i++) { let x; do { x = pipe.x0 + Math.random() * L; } while (Math.random() * dm2 > pipe.at(x).d ** 2); pt.x[i] = x; pt.e[i] = (Math.random() * 2 - 1) * 0.86; }
}
function advect(pt, pipe, Qc, dt) {
  const L = pipe.x1 - pipe.x0;
  for (let i = 0; i < pt.n; i++) {
    let x = pt.x[i]; for (let k = 0; k < 3; k++) x += (vx(pipe, Qc, x) * dt) / 3;
    if (x > pipe.x1) { x -= L; pt.e[i] = (Math.random() * 2 - 1) * 0.86; }
    pt.x[i] = x;
  }
}
function pipeWalls(pipe) {
  const top = [], bot = [];
  for (let x = pipe.x0; x <= pipe.x1 + 1e-9; x += 0.5) { const a = pipe.at(x); top.push([SX(x), SY(a.y + a.d / 2)]); bot.push([SX(x), SY(a.y - a.d / 2)]); }
  return { top, bot };
}
function pipePath(ctx, w) { ctx.beginPath(); w.top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); for (let i = w.bot.length - 1; i >= 0; i--) ctx.lineTo(w.bot[i][0], w.bot[i][1]); ctx.closePath(); }
function strokeWalls(ctx, c, w) {
  ctx.save(); ctx.strokeStyle = c.text2; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round";
  for (const arr of [w.top, w.bot]) { ctx.beginPath(); arr.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
  ctx.restore();
}
function drawParts(ctx, c, pt, pipe) {
  ctx.fillStyle = c.dark ? "rgba(186,230,253,0.9)" : "rgba(29,78,216,0.75)";
  for (let i = 0; i < pt.n; i++) { const a = pipe.at(pt.x[i]); circle(ctx, SX(pt.x[i]), SY(a.y + (pt.e[i] * a.d) / 2), 1.7); ctx.fill(); }
}

/* ================================================================== 1) Oqim uzluksizligi */

const FX = [12, 46, 80];
const flowParts = makeParts(280);
function rebuildFlow(reseed = true) {
  const d = flow.d;
  flow.pipe = makePipe([{ x0: 0, x1: 24, d: d[0], y: 0 }, { x0: 36, x1: 56, d: d[1], y: 0 }, { x0: 68, x1: 92, d: d[2], y: 0 }]);
  if (reseed) seedParts(flowParts, flow.pipe);
  newSlab();
}
/** a..b oralig'idagi hajm (cm³); quvur tashqarisida oxirgi kesim davom etadi. */
function volBetween(pipe, a, b) { let V = 0; for (let x = a; x < b; x += 0.25) V += pipe.S(Math.min(x + 0.125, pipe.x1)) * Math.min(0.25, b - x); return V; }
function newSlab() {
  const pipe = flow.pipe, V = pipe.S(0) * 10; let b = 0, acc = 0;
  while (acc < V && b < 400) { acc += pipe.S(Math.min(b + 0.125, pipe.x1)) * 0.25; b += 0.25; }
  flow.slab = { a: 0, b, V: volBetween(pipe, 0, b) };
}
function stepFlow(dt) {
  const Qc = flow.Q * 1000, pipe = flow.pipe; advect(flowParts, pipe, Qc, dt);
  const sl = flow.slab;
  for (let k = 0; k < 3; k++) { sl.a += (vx(pipe, Qc, Math.min(sl.a, pipe.x1)) * dt) / 3; sl.b += (vx(pipe, Qc, Math.min(sl.b, pipe.x1)) * dt) / 3; }
  if (sl.a > pipe.x1 + 2) newSlab();
}
const flowV = (i) => P.speed(flow.Q / 1000, flow.d[i] / 100) * 100; // cm/s
function drawFlow(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560, pipe = flow.pipe;
  fit(cw, ch, -16, 95, -13, 12, 6);
  const wl = pipeWalls(pipe);
  ctx.fillStyle = WATER(c); pipePath(ctx, wl); ctx.fill();
  // belgilangan hajm
  const sl = flow.slab, xa = SX(Math.max(0, sl.a)), xb = SX(Math.min(pipe.x1, sl.b));
  if (xb > xa + 1) {
    ctx.save(); pipePath(ctx, wl); ctx.clip(); ctx.fillStyle = c.dark ? "rgba(251,146,60,0.42)" : "rgba(234,88,12,0.26)"; ctx.fillRect(xa, 0, xb - xa, ch);
    ctx.strokeStyle = COL.slab; ctx.lineWidth = 1.6; ctx.beginPath(); if (sl.a >= 0) { ctx.moveTo(xa, 0); ctx.lineTo(xa, ch); } if (sl.b <= pipe.x1) { ctx.moveTo(xb, 0); ctx.lineTo(xb, ch); } ctx.stroke(); ctx.restore();
  }
  drawParts(ctx, c, flowParts, pipe);
  strokeWalls(ctx, c, wl);
  if (xb > xa + 1) {
    const xm = (Math.max(0, sl.a) + Math.min(pipe.x1, sl.b)) / 2;
    tagIn(ctx, `V = ${fmt(sl.V, 0)} cm³`, SX(xm), SY(pipe.dmax / 2) - (narrow ? 12 : 16), cw, { color: COL.slab, bg: c.bg, align: "center", font: SMALL, pad: 4 });
  }
  // jo'mrak dastagi va kirish
  const kr = narrow ? 11 : 14, kx = SX(-9), ky = SY(0);
  geo.flow = { knob: { x: kx, y: ky, r: kr + 8 }, h: [] };
  knob(ctx, c, kx, ky, kr, (flow.Q - 0.2) / 1.8, "Q", `${fmt(flow.Q, 2)} L/s`);
  arrow(ctx, kx + kr + 6, ky, SX(0) - kx - kr - 4, 0, c.text3, { width: 2, head: 7 });
  // kesimlar
  const vs = [0, 1, 2].map(flowV), vmax = Math.max(...vs), below = SY(-pipe.dmax / 2);
  FX.forEach((xm, i) => {
    const d = flow.d[i], yTop = SY(d / 2);
    if (ui.show.vec) { const L = ((14 * vs[i]) / vmax) * view.s; arrow(ctx, SX(xm) - L / 2, SY(0), L, 0, c.danger, { width: 2.6, head: 9 }); }
    handle(ctx, c, SX(xm), yTop, narrow ? 6 : 7); geo.flow.h.push({ x: SX(xm), y: yTop, r: 14, i });
    tagIn(ctx, `d${"₁₂₃"[i]} = ${fmt(d, 1)} cm`, SX(xm), below + 16, cw, { color: c.text2, bg: c.bg, align: "center", font: SMALL, pad: 4 });
    tagIn(ctx, `v${"₁₂₃"[i]} = ${fmt(vs[i], vs[i] < 10 ? 1 : 0)} cm/s`, SX(xm), below + 38, cw, { color: c.danger, bg: c.bg, align: "center", font: narrow ? SMALL : MID, pad: 4 });
  });
}

/* ================================================================== 2) Bernulli qonuni */

const bernParts = makeParts(260);
function rebuildBern(reseed = true) {
  bern.pipe = makePipe([{ x0: 0, x1: 25, d: D1B, y: 0 }, { x0: 40, x1: 60, d: bern.dt, y: 0 }, { x0: 75, x1: 95, d: D1B, y: 0 }, { x0: 112, x1: 136, d: D1B, y: bern.dy }]);
  if (reseed) seedParts(bernParts, bern.pipe);
}
/** x nuqtada: tezlik (m/s), manometrdagi ortiqcha bosim ustuni hp (cm), pyezometrik sath lvl (cm), to'liq napor E (cm). */
function bernAt(x) {
  const a = bern.pipe.at(x), v = P.speed(bern.Q / 1000, a.d / 100), v1 = P.speed(bern.Q / 1000, D1B / 100);
  const p1 = (P.RHO_W * g0 * bern.p1) / 100, p = P.bernoulliP(p1, v1, 0, v, a.y / 100), hp = (p / (P.RHO_W * g0)) * 100;
  return { ...a, v, v1, p, hp, lvl: a.y + hp, E: bern.p1 + ((v1 * v1) / (2 * g0)) * 100 };
}
function stepBern(dt) { advect(bernParts, bern.pipe, bern.Q * 1000, dt); }
rebuildFlow(); rebuildBern();
function drawBern(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560, pipe = bern.pipe;
  fit(cw, ch, -18, 140, -9, 70, 6);
  const wl = pipeWalls(pipe);
  ctx.fillStyle = WATER(c); pipePath(ctx, wl); ctx.fill();
  drawParts(ctx, c, bernParts, pipe);
  strokeWalls(ctx, c, wl);
  const E = bernAt(0).E;
  // energiya chizig'i
  ctx.save(); ctx.strokeStyle = COL.e; ctx.lineWidth = 1.4; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(SX(0), SY(E)); ctx.lineTo(SX(136), SY(E)); ctx.stroke(); ctx.restore();
  tagIn(ctx, narrow ? "to‘liq napor" : "to‘liq napor (energiya chizig‘i)", SX(31), SY(E) - 26, cw, { color: COL.e, bg: c.bg, align: "center", font: SMALL, pad: 4 });
  geo.bern = {};
  const hw = 1.2;
  BX.forEach((x, i) => {
    const b = bernAt(x), yw = b.y + b.d / 2, xl = SX(x - hw), xr = SX(x + hw), yT = SY(TOPB), yW = SY(yw);
    ctx.fillStyle = c.bg; ctx.fillRect(xl, yT, xr - xl, yW + 1.6 - yT);
    const full = b.lvl > yw, ytop = full ? SY(Math.min(b.lvl, TOPB)) : yW - 1.6;
    ctx.fillStyle = WATER(c); ctx.fillRect(xl, ytop, xr - xl, yW + 1.6 - ytop);
    ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xl, yT); ctx.lineTo(xl, yW); ctx.moveTo(xr, yT); ctx.lineTo(xr, yW); ctx.stroke();
    if (full) { ctx.strokeStyle = WATER_S(c); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xl, ytop); ctx.lineTo(xr, ytop); ctx.stroke(); }
    const lab = narrow ? fmt(b.hp, 1) : `h${"₁₂₃₄"[i]} = ${fmt(b.hp, 1)} cm`;
    if (full) tagIn(ctx, lab, xr + 5, ytop, cw, { color: c.text, bg: c.bg, align: "left", font: SMALL, pad: 3 });
    else { tagIn(ctx, "p < pₐₜₘ", (xl + xr) / 2, yW - 16, cw, { color: "#fff", bg: c.danger, align: "center", font: SMALL, pad: 4 }); tagIn(ctx, lab, xr + 5, yW - 38, cw, { color: c.danger, bg: c.bg, align: "left", font: SMALL, pad: 3 }); }
    if (i === 1 && full && E - b.lvl > 1.2) vbracket(ctx, c, xl - 6, SY(E), ytop, narrow ? "" : "v²/2g", COL.v, -1);
    if (i === 0) { handle(ctx, c, (xl + xr) / 2, ytop, narrow ? 6 : 7); geo.bern.lv = { x: (xl + xr) / 2, y: ytop, r: 14 }; }
    tag(ctx, "₁₂₃₄"[i], (xl + xr) / 2, yT - 9, { color: c.text3, bg: c.bg, align: "center", font: SMALL, pad: 2 });
  });
  // tutqichlar: tor joy, ko'tarilgan quvur
  const yth = SY(-bern.dt / 2); handle(ctx, c, SX(50), yth, narrow ? 6 : 7); geo.bern.th = { x: SX(50), y: yth, r: 14 };
  const yry = SY(bern.dy - D1B / 2); handle(ctx, c, SX(129), yry, narrow ? 6 : 7); geo.bern.ry = { x: SX(129), y: yry, r: 14 };
  if (bern.dy > 0.5) vbracket(ctx, c, SX(138), SY(0), SY(bern.dy), `Δy = ${fmt(bern.dy, 0)} cm`, c.text2, -1);
  if (ui.show.vec) {
    const vmax = bernAt(50).v;
    [12, 50, 85, 125].forEach((x) => { const b = bernAt(x), L = Math.max(4, (14 * b.v) / Math.max(vmax, 1e-9)) * view.s; arrow(ctx, SX(x) - L / 2, SY(b.y), L, 0, c.danger, { width: 2.4, head: 8 }); });
  }
  const kr = narrow ? 11 : 14, kx = SX(-9), ky = SY(0);
  geo.bern.knob = { x: kx, y: ky, r: kr + 8 };
  knob(ctx, c, kx, ky, kr, (bern.Q - 0.5) / 3.5, "Q", `${fmt(bern.Q, 1)} L/s`);
}
function drawBernGraph(ctx, gst) {
  const c = gst.colors, xs = []; for (let x = 0; x <= 136; x += 1) xs.push(x);
  const pts = xs.map((x) => bernAt(x)), E = pts[0].E, lo = Math.min(0, ...pts.map((p) => p.lvl)), hi = E * 1.12;
  const yt = ticks(lo, hi, 4);
  const f = frame(ctx, gst, { xMin: 0, xMax: 136, yMin: lo, yMax: hi, xTicks: [0, 20, 40, 60, 80, 100, 120], yTicks: yt.values, fmtX: (v) => fmt(v, 0), fmtY: (v) => fmt(v, 0), xUnit: "x, cm", yLabel: "napor, cm" });
  ctx.save(); ctx.beginPath(); ctx.rect(f.rect.x, f.rect.y, f.rect.w, f.rect.h); ctx.clip();
  const band = (ya, yb, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => { const X = f.X(xs[i]), Y = f.Y(ya(p)); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(f.X(xs[i]), f.Y(yb(pts[i]))); ctx.closePath(); ctx.fill(); };
  band(() => 0, (p) => p.y, "rgba(100,116,139,0.35)");
  band((p) => p.y, (p) => p.lvl, "rgba(37,99,235,0.35)");
  band((p) => p.lvl, () => E, "rgba(22,163,74,0.40)");
  ctx.strokeStyle = COL.e; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(f.X(0), f.Y(E)); ctx.lineTo(f.X(136), f.Y(E)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = COL.p; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(f.X(xs[i]), f.Y(p.lvl)) : ctx.moveTo(f.X(xs[i]), f.Y(p.lvl)))); ctx.stroke();
  BX.forEach((x) => { ctx.strokeStyle = c.text3; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(f.X(x), f.rect.y); ctx.lineTo(f.X(x), f.rect.y + f.rect.h); ctx.stroke(); ctx.setLineDash([]); });
  ctx.restore();
  legend(ctx, [{ color: COL.y, label: "y" }, { color: COL.p, label: "p/ρg" }, { color: COL.v, label: "v²/2g" }, { color: COL.e, label: "yig‘indi", dash: [6, 4] }], f.padL + 80, 9, c);
}

/* ================================================================== 3a) Torichelli */

const TANK = 0.5, TANK_H = 1.6;
const torHoles = () => (tor.holes === 1 ? [tor.yh] : [0.25, 0.5, 0.75].map((f) => f * tor.H));
function drawTor(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560;
  fit(cw, ch, narrow ? -0.5 : -0.32, 2.3, -0.16, 1.82, 6);
  const s = view.s;
  // pol
  ctx.fillStyle = c.dark ? "#3f3a33" : "#e7e1d6"; ctx.fillRect(0, SY(0), cw, ch - SY(0));
  ctx.strokeStyle = c.borderStrong; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, SY(0)); ctx.lineTo(cw, SY(0)); ctx.stroke();
  // suv va idish
  ctx.fillStyle = WATER(c); ctx.fillRect(SX(0), SY(tor.H), TANK * s, tor.H * s);
  ctx.strokeStyle = WATER_S(c); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(SX(0), SY(tor.H)); ctx.lineTo(SX(TANK), SY(tor.H)); ctx.stroke();
  ctx.strokeStyle = c.text2; ctx.lineWidth = 3.5; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(SX(0), SY(TANK_H)); ctx.lineTo(SX(0), SY(0)); ctx.lineTo(SX(TANK), SY(0)); ctx.lineTo(SX(TANK), SY(TANK_H)); ctx.stroke();
  // jo'mrak: sath o'zgarmas
  ctx.strokeStyle = c.text2; ctx.lineWidth = 5; ctx.lineCap = "butt"; ctx.beginPath(); ctx.moveTo(SX(-0.3), SY(1.74)); ctx.lineTo(SX(0.12), SY(1.74)); ctx.lineTo(SX(0.12), SY(1.67)); ctx.stroke();
  ctx.fillStyle = WATER_S(c); ctx.globalAlpha = 0.6; ctx.fillRect(SX(0.12) - 2, SY(1.66), 4, SY(tor.H) - SY(1.66)); ctx.globalAlpha = 1;
  // H va H/2
  vbracket(ctx, c, SX(-0.1), SY(0), SY(tor.H), `H = ${fmt(tor.H, 2)} m`, c.text, -1);
  ctx.save(); ctx.strokeStyle = c.text3; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(SX(0), SY(tor.H / 2)); ctx.lineTo(SX(TANK), SY(tor.H / 2)); ctx.stroke(); ctx.restore();
  tag(ctx, "H/2", SX(0.04), SY(tor.H / 2) - 10, { color: c.text3, bg: c.bg, font: SMALL, pad: 3 });
  geo.tor = { lvl: { x: SX(TANK / 2), y: SY(tor.H), r: 14 } };
  // oqimchalar
  const holes = torHoles(), ls = holes.map((y) => P.jetRange(tor.H, y));
  holes.forEach((y, i) => {
    const v = P.torricelliV(tor.H - y), T = Math.sqrt((2 * y) / g0), x0 = TANK;
    ctx.save(); ctx.strokeStyle = WATER_S(c); ctx.globalAlpha = 0.45; ctx.lineWidth = Math.max(3, 0.018 * s); ctx.lineCap = "round"; ctx.beginPath();
    for (let k = 0; k <= 40; k++) { const t = (T * k) / 40, X = SX(x0 + v * t), Y = SY(y - 0.5 * g0 * t * t); k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = WATER_S(c); const n = Math.max(4, Math.floor(T / 0.03));
    for (let k = 0; k < n; k++) { const t = (ui.t * 0.7 + (k * T) / n) % T; circle(ctx, SX(x0 + v * t), SY(y - 0.5 * g0 * t * t), 2.4); ctx.fill(); }
    // tushish nuqtasi
    const lx = SX(x0 + ls[i]); ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, SY(0) - 6); ctx.lineTo(lx, SY(0) + 6); ctx.stroke();
    if (holes.length === 1) tagIn(ctx, `l = ${fmt(ls[i], 2)} m`, lx, SY(0) + 16, cw, { color: c.text, bg: c.bg, align: "center", font: SMALL, pad: 4 });
    else if (i === 0) tagIn(ctx, `l₁ = l₃ = ${fmt(ls[0], 2)} m`, lx, SY(0) + 16, cw, { color: c.text, bg: c.bg, align: "right", font: SMALL, pad: 4 });
    else if (i === 1) tagIn(ctx, `l₂ = ${fmt(ls[1], 2)} m`, lx + 4, SY(0) + 16, cw, { color: c.success, bg: c.bg, align: "left", font: SMALL, pad: 4 });
    ctx.fillStyle = c.bg; ctx.strokeStyle = c.text2; ctx.lineWidth = 1.5; circle(ctx, SX(TANK), SY(y), 3.5); ctx.fill(); ctx.stroke();
    if (ui.show.vec) arrow(ctx, SX(TANK) + 4, SY(y), v * 0.05 * s, 0, c.danger, { width: 2.4, head: 8, label: holes.length === 1 ? "v" : "", font: LBL });
  });
  if (tor.holes === 1) {
    const y = tor.yh;
    vbracket(ctx, c, SX(TANK - 0.07), SY(tor.H), SY(y), `h = ${fmt(tor.H - y, 2)} m`, c.danger, -1);
    handle(ctx, c, SX(TANK), SY(y), narrow ? 6 : 7); geo.tor.hole = { x: SX(TANK), y: SY(y), r: 14 };
    const mx = SX(TANK + tor.H); ctx.save(); ctx.strokeStyle = COL.e; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx, SY(0)); ctx.lineTo(mx, SY(0.18)); ctx.stroke(); ctx.restore();
    if (Math.abs(ls[0] - tor.H) > 0.03) tag(ctx, "l_max = H", mx, SY(0.18) - 10, { color: COL.e, bg: c.bg, align: "center", font: SMALL, pad: 3 });
  }
  handle(ctx, c, SX(TANK / 2), SY(tor.H), narrow ? 6 : 7);
}

/* ================================================================== 3b) Samolyot qanoti */

function foilUpdate() {
  const key = wing.alpha.toFixed(5); if (wing.key === key) return;
  wing.key = key; wing.foil = P.airfoil({ alpha: wing.alpha, V: 1 }); wing.lines = null; wing.pkey = "";
  const o = wing.foil.outline; let ti = 0, bi = 0, ty = -1e9, by = 1e9;
  o.forEach(([x, y], i) => { if (Math.abs(x) < 0.35) { if (y > ty) { ty = y; ti = i; } if (y < by) { by = y; bi = i; } } });
  const sp = (x, y) => { const v = wing.foil.vel(x, y); return v ? Math.hypot(v[0], v[1]) : NaN; };
  wing.top = { q: sp(o[ti][0], o[ti][1] + 0.05), x: o[ti][0], y: o[ti][1] + 0.05 }; wing.bot = { q: sp(o[bi][0], o[bi][1] - 0.05), x: o[bi][0], y: o[bi][1] - 0.05 };
}
const rotD = (x, y) => { const ca = Math.cos(wing.alpha), sa = Math.sin(wing.alpha); return [x * ca + y * sa, -x * sa + y * ca]; }; // fizik → ekran
function dvel(X, Y) {
  const ca = Math.cos(wing.alpha), sa = Math.sin(wing.alpha), v = wing.foil.vel(X * ca - Y * sa, X * sa + Y * ca);
  return v ? [v[0] * ca + v[1] * sa, -v[0] * sa + v[1] * ca] : null;
}
function streamlines() {
  if (wing.lines) return wing.lines;
  const out = [];
  for (let Y0 = -2.3; Y0 <= 2.31; Y0 += 0.26) {
    const pts = [[-4.8, Y0]]; let X = -4.8, Y = Y0;
    for (let k = 0; k < 900; k++) {
      const a = dvel(X, Y); if (!a) break; const q = Math.hypot(a[0], a[1]); if (q < 0.02) break;
      const h = 0.03, mX = X + (a[0] / q) * h * 0.5, mY = Y + (a[1] / q) * h * 0.5, b = dvel(mX, mY); if (!b) break; const qb = Math.hypot(b[0], b[1]); if (qb < 0.02) break;
      X += (b[0] / qb) * h; Y += (b[1] / qb) * h; pts.push([X, Y]); if (X > 5.2 || Math.abs(Y) > 2.8) break;
    }
    out.push(pts);
  }
  wing.lines = out; return out;
}
function pressureMap(cw, ch, c) {
  const key = `${wing.key}|${cw}|${ch}|${c.dark}|${view.s.toFixed(3)}`; if (wing.pkey === key) return wing.pmap;
  const cell = 4, cols = Math.ceil(cw / cell), rows = Math.ceil(ch / cell), cv = document.createElement("canvas"); cv.width = cols; cv.height = rows;
  const g = cv.getContext("2d"), img = g.createImageData(cols, rows), d = img.data;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const w = toWorld((i + 0.5) * cell, (j + 0.5) * cell), v = dvel(w.x, w.y), o = 4 * (j * cols + i); if (!v) continue;
    const cp = 1 - (v[0] * v[0] + v[1] * v[1]);
    if (cp < 0) { const t = Math.min(1, -cp / 1.4); d[o] = 37; d[o + 1] = 99; d[o + 2] = 235; d[o + 3] = Math.round(t * (c.dark ? 170 : 140)); }
    else { const t = Math.min(1, cp); d[o] = 220; d[o + 1] = 38; d[o + 2] = 38; d[o + 3] = Math.round(t * (c.dark ? 170 : 140)); }
  }
  g.putImageData(img, 0, 0); wing.pmap = cv; wing.pkey = key; wing.pcell = cell; return cv;
}
const WN = 150, wingP = { X: new Float64Array(WN), Y: new Float64Array(WN), age: new Float64Array(WN) };
function seedWing(all = true) { for (let i = 0; i < WN; i++) { wingP.X[i] = all ? -4.8 + Math.random() * 10 : -4.8; wingP.Y[i] = -2.4 + Math.random() * 4.8; wingP.age[i] = 0; } }
function stepWing(dt) {
  if (!wing.foil) return; const k = (wing.V / 40) * 1.5;
  for (let i = 0; i < WN; i++) {
    const a = dvel(wingP.X[i], wingP.Y[i]); wingP.age[i] += dt;
    if (!a || wingP.X[i] > 5.1 || Math.abs(wingP.Y[i]) > 2.7 || wingP.age[i] > 14) { wingP.X[i] = -4.8; wingP.Y[i] = -2.4 + Math.random() * 4.8; wingP.age[i] = 0; continue; }
    const mX = wingP.X[i] + a[0] * k * dt * 0.5, mY = wingP.Y[i] + a[1] * k * dt * 0.5, b = dvel(mX, mY) || a;
    wingP.X[i] += b[0] * k * dt; wingP.Y[i] += b[1] * k * dt;
  }
}
function drawWing(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560;
  foilUpdate(); fit(cw, ch, -4.6, 5.0, -2.45, 2.45, 4);
  const f = wing.foil, pm = pressureMap(cw, ch, c);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(pm, 0, 0, pm.width * wing.pcell, pm.height * wing.pcell); ctx.restore();
  ctx.save(); ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.45)" : "rgba(30,41,59,0.35)"; ctx.lineWidth = 1;
  for (const L of streamlines()) { ctx.beginPath(); L.forEach(([X, Y], i) => (i ? ctx.lineTo(SX(X), SY(Y)) : ctx.moveTo(SX(X), SY(Y)))); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = c.dark ? "#f8fafc" : "#0f172a";
  for (let i = 0; i < WN; i++) { circle(ctx, SX(wingP.X[i]), SY(wingP.Y[i]), 1.6); ctx.fill(); }
  // qanot
  ctx.fillStyle = c.dark ? "#94a3b8" : "#cbd5e1"; ctx.strokeStyle = c.text; ctx.lineWidth = 1.6; ctx.beginPath();
  f.outline.forEach(([x, y], i) => { const [X, Y] = rotD(x, y); i ? ctx.lineTo(SX(X), SY(Y)) : ctx.moveTo(SX(X), SY(Y)); }); ctx.closePath(); ctx.fill(); ctx.stroke();
  // hujum burchagi (chiqish qirrasida)
  const [tX, tY] = rotD(2, 0), [lX, lY] = rotD(-2, 0), te = { x: SX(tX), y: SY(tY) }, ext = 0.9 * view.s;
  ctx.save(); ctx.strokeStyle = c.text2; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(SX(lX), SY(lY)); ctx.lineTo(te.x + Math.cos(wing.alpha) * ext, te.y + Math.sin(wing.alpha) * ext); ctx.moveTo(te.x, te.y); ctx.lineTo(te.x + ext, te.y); ctx.stroke(); ctx.restore();
  if (Math.abs(wing.alpha) > 0.3 * DEG) angleArc(ctx, te.x, te.y, ext * 0.75, 0, wing.alpha, c.warning, { label: "α", labelR: ext * 0.75 + 14, font: LBL });
  handle(ctx, c, te.x, te.y, narrow ? 6 : 7); geo.wing = { te: { x: te.x, y: te.y, r: 16 } };
  // ko'tarish kuchi
  const [qX, qY] = rotD(-0.9, 0.12), L = clamp(f.CL * 62, -70, 130) * (narrow ? 0.75 : 1);
  if (Math.abs(L) > 2) arrow(ctx, SX(qX), SY(qY), 0, -L, c.success, { width: 3.2, head: 11, label: "F", font: LBL });
  if (ui.show.vec) {
    const vt = rotD(wing.top.x, wing.top.y + 0.25), vb = rotD(wing.bot.x, wing.bot.y - 0.25), k = 0.55 * view.s;
    arrow(ctx, SX(vt[0]) - (wing.top.q * k) / 2, SY(vt[1]), wing.top.q * k, 0, c.danger, { width: 2.4, head: 8 });
    arrow(ctx, SX(vb[0]) - (wing.bot.q * k) / 2, SY(vb[1]), wing.bot.q * k, 0, c.danger, { width: 2.4, head: 8 });
  }
  // V dastagi va oqim yo'nalishi
  const kr = narrow ? 11 : 13, kx = 14 + kr + 4, ky = 14 + kr + 4;
  ctx.fillStyle = c.bg; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.roundRect(kx - kr - 12, ky - kr - 10, 2 * kr + 24, 2 * kr + 46, 8); ctx.fill(); ctx.globalAlpha = 1;
  knob(ctx, c, kx, ky, kr, (wing.V - 10) / 70, "V", `${fmt(wing.V, 0)} m/s`); geo.wing.knob = { x: kx, y: ky, r: kr + 8 };
  arrow(ctx, kx + kr + 18, ky, narrow ? 34 : 46, 0, c.text2, { width: 2.4, head: 9 });
  // bosim shkalasi
  if (!narrow) {
    const x0 = cw - 150, y0 = ch - 26, gr = ctx.createLinearGradient(x0, 0, x0 + 120, 0);
    gr.addColorStop(0, "rgba(37,99,235,0.6)"); gr.addColorStop(0.5, "rgba(148,163,184,0.05)"); gr.addColorStop(1, "rgba(220,38,38,0.6)");
    ctx.fillStyle = c.bg; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.roundRect(x0 - 8, y0 - 18, 136, 38, 6); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = gr; ctx.fillRect(x0, y0, 120, 8); ctx.fillStyle = c.text2; ctx.font = SMALL; ctx.textBaseline = "bottom"; ctx.textAlign = "left"; ctx.fillText("p < p₀", x0, y0 - 3); ctx.textAlign = "right"; ctx.fillText("p > p₀", x0 + 120, y0 - 3);
  }
  if (wing.alpha > 10 * DEG) tagIn(ctx, "Real qanotda bu burchakda oqim uzila boshlaydi", cw / 2, ch - 14, cw, { color: "#fff", bg: c.warning, align: "center", font: SMALL, pad: 5 });
}

/* ================================================================== 3c) Purkagich */

function drawSpray(ctx, st) {
  const { w: cw, h: ch, colors: c } = st, narrow = cw < 560;
  if (narrow) fit(cw, ch, 15, 72, -11, 12, 6); else fit(cw, ch, -7, 80, -11, 12, 6);
  const s = view.s, h = P.sprayRise(spray.v) * 100, hs = spray.hs, jy = hs + 1.3, on = h >= hs - 1e-9;
  // idish va suyuqlik
  ctx.fillStyle = WATER(c); ctx.fillRect(SX(28), SY(0), 24 * s, 10 * s);
  ctx.strokeStyle = WATER_S(c); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(SX(28), SY(0)); ctx.lineTo(SX(39.3), SY(0)); ctx.moveTo(SX(40.7), SY(0)); ctx.lineTo(SX(52), SY(0)); ctx.stroke();
  ctx.strokeStyle = c.text2; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(SX(28), SY(0.8)); ctx.lineTo(SX(28), SY(-10)); ctx.lineTo(SX(52), SY(-10)); ctx.lineTo(SX(52), SY(0.8)); ctx.stroke();
  // atmosfera bosimi
  const ya = Math.min(3.2, hs + 0.4);
  [31, 49].forEach((x) => arrow(ctx, SX(x), SY(ya), 0, (ya - 0.3) * s, c.text3, { width: 1.8, head: 7 }));
  tag(ctx, "pₐₜₘ", SX(31), SY(-1.7), { color: c.text3, bg: c.bg, align: "center", font: SMALL, pad: 3 });
  // naycha
  const lvl = on ? hs : h;
  ctx.fillStyle = c.bg; ctx.fillRect(SX(39.4), SY(hs), 1.2 * s, (hs + 9.3) * s);
  ctx.fillStyle = WATER(c); ctx.fillRect(SX(39.4), SY(lvl), 1.2 * s, (lvl + 9.3) * s);
  ctx.fillStyle = WATER(c); ctx.fillRect(SX(39.4), SY(0), 1.2 * s, 9.3 * s);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(SX(39.3), SY(hs)); ctx.lineTo(SX(39.3), SY(-9.3)); ctx.moveTo(SX(40.7), SY(hs)); ctx.lineTo(SX(40.7), SY(-9.3)); ctx.stroke();
  if (lvl > 0.05) { ctx.strokeStyle = WATER_S(c); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(SX(39.4), SY(lvl)); ctx.lineTo(SX(40.6), SY(lvl)); ctx.stroke(); }
  if (h > 0.08) vbracket(ctx, c, SX(43.5), SY(0), SY(Math.min(h, hs)), `h = ${fmt(h, 1)} cm`, c.primary, 1);
  vbracket(ctx, c, SX(36.5), SY(0), SY(hs), narrow ? `hₛ = ${fmt(hs, 1)}` : `hₛ = ${fmt(hs, 1)} cm`, c.text2, -1);
  if (!on && h > 0.3 && h < hs) { ctx.save(); ctx.strokeStyle = c.primary; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(SX(38.4), SY(h)); ctx.lineTo(SX(41.6), SY(h)); ctx.stroke(); ctx.restore(); }
  // havo trubkasi va noksimon puflagich
  const r = 0.7;
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.16)"; ctx.fillRect(SX(6), SY(jy + r), 33 * s, 2 * r * s);
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(SX(6), SY(jy + r)); ctx.lineTo(SX(39), SY(jy + r)); ctx.moveTo(SX(6), SY(jy - r)); ctx.lineTo(SX(39), SY(jy - r)); ctx.stroke();
  ctx.fillStyle = c.dark ? "#9f1239" : "#be123c"; ctx.beginPath(); ctx.ellipse(SX(1), SY(jy), 5.5 * s, 3.6 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.beginPath(); ctx.ellipse(SX(-0.5), SY(jy + 1.4), 2.2 * s, 1 * s, -0.3, 0, TAU); ctx.fill();
  // havo oqimi (sekinlashtirilgan)
  const va = 6 + spray.v * 0.9;
  if (spray.v > 0.2) {
    ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.6)" : "rgba(71,85,105,0.55)"; ctx.lineWidth = 1.3;
    for (let k = 0; k < 46; k++) {
      const L = 72, xk = 7 + ((ui.t * va + k * (L / 46) * 7.3) % L), off = (hash(k) - 0.5) * 2, wdt = xk < 39 ? r * 0.8 : r + 0.09 * (xk - 39);
      const yk = jy + off * wdt; if (xk > 78) continue; ctx.beginPath(); ctx.moveTo(SX(xk), SY(yk)); ctx.lineTo(SX(xk) + Math.min(10, 2 + spray.v * 0.25), SY(yk)); ctx.stroke();
    }
  }
  // tomchilar
  if (on && spray.v > 0.2) {
    ctx.fillStyle = WATER_S(c);
    for (let k = 0; k < 44; k++) {
      const T = 1.5, a = (ui.t + (k * T) / 44) % T, vxk = (8 + spray.v * 0.9) * (0.6 + 0.7 * hash(k + 9)), vyk = (hash(k + 31) - 0.4) * 4;
      const x = 40.4 + vxk * a, y = hs + 0.5 + vyk * a - 0.5 * 9 * a * a; if (x > 79 || y < -10.5) continue;
      circle(ctx, SX(x), SY(y), 1.2 + 1.3 * hash(k + 3)); ctx.fill();
    }
  }
  if (ui.show.vec && spray.v > 0.2) arrow(ctx, SX(47), SY(jy + 2.6), Math.min(26, 4 + spray.v * 0.45) * s * 0.4, 0, c.danger, { width: 2.4, head: 8, label: "v", font: LBL });
  tagIn(ctx, "p = pₐₜₘ − ρv²/2", SX(40), SY(jy + 4.2), cw, { color: c.primary, bg: c.bg, align: "center", font: SMALL, pad: 4 });
  handle(ctx, c, SX(40), SY(hs - 1.8), narrow ? 6 : 7); geo.spray = { tip: { x: SX(40), y: SY(hs - 1.8), r: 14 } };
  const kr = narrow ? 11 : 13, kx = narrow ? kr + 14 : SX(1), ky = narrow ? kr + 16 : Math.min(ch - 50, SY(jy - 3.6) + kr + 14);
  knob(ctx, c, kx, ky, kr, spray.v / 50, "v", `${fmt(spray.v, 1)} m/s`); geo.spray.knob = { x: kx, y: ky, r: kr + 8 };
}

/* ------------------------------------------------------------------ Asosiy chizish */

function draw(ctx, st) {
  CW = st.w;
  ctx.fillStyle = st.colors.bg; ctx.fillRect(0, 0, st.w, st.h);
  if (ui.mode === "flow") drawFlow(ctx, st); else if (ui.mode === "bern") drawBern(ctx, st);
  else if (ui.sub === "tor") drawTor(ctx, st); else if (ui.sub === "wing") drawWing(ctx, st); else drawSpray(ctx, st);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.46, vh * 0.44), 280, 370)), graph: Math.round(clamp(vh * 0.24, 160, 220)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });
function drawGraphCanvas(ctx, gst) { if (ui.mode === "bern") return drawBernGraph(ctx, gst); ctx.fillStyle = gst.colors.bg; ctx.fillRect(0, 0, gst.w, gst.h); }
const graph = createStage($("#graph"), drawGraphCanvas, { height: (cw) => heights(cw).graph });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, label, value, sub, tone) {
  const el = document.querySelector(`[data-readout="${key}"]`);
  el.querySelector("[data-label]").innerHTML = label; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || "";
}
const u = (v, d, unit) => `${fmt(v, d)}<small>${unit}</small>`;
const S_cm2 = (d) => (Math.PI * d * d) / 4;
function updateReadouts() {
  if (ui.mode === "flow") {
    const vs = [0, 1, 2].map(flowV);
    setRO("r1", "Suv sarfi <i>Q</i>", u(flow.Q, 2, "L/s"), `= ${fmt(flow.Q * 1000, 0)} cm³/s — har kesimda bir xil`);
    [0, 1, 2].forEach((i) => setRO(`r${i + 2}`, `${i + 1}-kesimda tezlik <i>v${"₁₂₃"[i]}</i>`, u(vs[i], vs[i] < 10 ? 2 : 1, "cm/s"), `S${"₁₂₃"[i]} = ${fmt(S_cm2(flow.d[i]), 1)} cm²; S·v = ${fmt(S_cm2(flow.d[i]) * vs[i], 0)} cm³/s`));
    setRO("r5", "Nisbat <i>v₂/v₁</i>", fmt(vs[1] / vs[0], 2), `= S₁/S₂ = (d₁/d₂)² = (${fmt(flow.d[0], 1)}/${fmt(flow.d[1], 1)})²`);
    setRO("r6", "Belgilangan hajm <i>V</i>", u(flow.slab.V, 0, "cm³"), "uzunligi o‘zgaradi, hajmi — yo‘q", "orange");
  } else if (ui.mode === "bern") {
    const b = BX.map(bernAt), S1 = S_cm2(D1B), S2 = S_cm2(bern.dt), dh = b[0].hp - b[1].hp, dp = P.RHO_W * g0 * (dh / 100);
    setRO("r1", "Suv sarfi <i>Q</i>", u(bern.Q, 1, "L/s"), `v₁ = ${fmt(b[0].v, 2)} m/s (d₁ = ${fmt(D1B, 0)} cm)`);
    setRO("r2", "Tor joyda tezlik <i>v₂</i>", u(b[1].v, 2, "m/s"), `S₁/S₂ = ${fmt(S1 / S2, 2)} marta tez`);
    setRO("r3", "Manometrlar farqi <i>h₁ − h₂</i>", u(dh, 1, "cm"), `Δp = ρgΔh = ${fmt(dp, 0)} Pa`);
    setRO("r4", "Venturi: <i>v₁</i> o‘lchovdan", u(dh > 0 ? P.venturiV1(dp, S1, S2) : 0, 2, "m/s"), "v₁ = √(2Δp / ρ((S₁/S₂)² − 1))");
    setRO("r5", "Ko‘tarilgan joyda <i>h₄</i>", u(b[3].hp, 1, "cm"), bern.dy > 0 ? `h₁ − h₄ = Δy = ${fmt(bern.dy, 0)} cm` : "h₄ = h₃ = h₁ (tezlik bir xil)");
    setRO("r6", "Tor joyda bosim <i>h₂</i>", u(b[1].hp, 1, "cm"), b[1].hp < 0 ? "atmosfera bosimidan past!" : "atmosferaga nisbatan ortiqcha", b[1].hp < bern.dt / 2 ? "red" : "");
  } else if (ui.sub === "tor") {
    const holes = torHoles();
    if (tor.holes === 1) {
      const y = tor.yh, v = P.torricelliV(tor.H - y), l = P.jetRange(tor.H, y);
      setRO("r1", "Suv sathi <i>H</i>", u(tor.H, 2, "m"), "jo‘mrak sathni o‘zgarmas saqlaydi");
      setRO("r2", "Teshik chuqurligi <i>h</i>", u(tor.H - y, 2, "m"), `teshik poldan y = ${fmt(y, 2)} m`);
      setRO("r3", "Oqib chiqish tezligi <i>v</i>", u(v, 2, "m/s"), "v = √(2gh) — erkin tushgandek");
      setRO("r4", "Uchish vaqti <i>t</i>", u(Math.sqrt((2 * y) / g0), 2, "s"), "t = √(2y/g)");
      setRO("r5", "Uchish masofasi <i>l</i>", u(l, 2, "m"), "l = v·t = 2√(h·y)");
      setRO("r6", "Eng uzoq masofa", u(tor.H, 2, "m"), "y = H/2 bo‘lganda l = H", Math.abs(y - tor.H / 2) < 0.02 ? "green" : "");
    } else {
      setRO("r1", "Suv sathi <i>H</i>", u(tor.H, 2, "m"), "teshiklar: H/4, H/2, 3H/4");
      holes.forEach((y, i) => setRO(`r${i + 2}`, `${["Yuqori", "O‘rta", "Pastki"][2 - i]} teshik <i>l${"₁₂₃"[i]}</i>`, u(P.jetRange(tor.H, y), 2, "m"), `v = ${fmt(P.torricelliV(tor.H - y), 2)} m/s, y = ${fmt(y, 2)} m`, i === 1 ? "green" : ""));
      setRO("r5", "Tezliklar nisbati", fmt(P.torricelliV(tor.H - holes[0]) / P.torricelliV(tor.H - holes[2]), 2), "pastki/yuqori: √3 ≈ 1,73");
      setRO("r6", "l₁ = l₃", "✓", "chuqurroq — tezroq, lekin pastroq: vaqt kam");
    }
  } else if (ui.sub === "wing") {
    foilUpdate(); const f = wing.foil, Lp = P.liftPerSpan(P.RHO_AIR, wing.V, wing.CHORD, f.CL), dp = 0.5 * P.RHO_AIR * wing.V ** 2 * (wing.top.q ** 2 - wing.bot.q ** 2);
    setRO("r1", "Oqim tezligi <i>V</i>", u(wing.V, 0, "m/s"), `= ${fmt(wing.V * 3.6, 0)} km/soat`);
    setRO("r2", "Hujum burchagi <i>α</i>", u(wing.alpha / DEG, 1, "°"), `nol ko‘tarish: α₀ = −${fmt(f.beta / DEG, 1)}° (egilgan profil)`);
    setRO("r3", "Ko‘tarish koeffitsiyenti <i>C<sub>y</sub></i>", fmt(f.CL, 2), "Kutta–Jukovskiy: Γ sirkulyatsiya");
    setRO("r4", "Ko‘tarish kuchi (1 m qanotga)", Lp >= 1000 ? u(Lp / 1000, 2, "kN") : u(Lp, 0, "N"), `F = ½ρV²·b·C_y, b = ${fmt(wing.CHORD, 1)} m`, Lp < 0 ? "red" : "green");
    setRO("r5", "Tezlik: ustida / ostida", `${fmt(wing.top.q, 2)} / ${fmt(wing.bot.q, 2)}<small>·V</small>`, "o‘rta qismda, sirt yonida");
    setRO("r6", "Bosimlar farqi <i>Δp</i>", u(dp, 0, "Pa"), "Δp = ½ρ(v_ust² − v_ost²)");
  } else {
    const h = P.sprayRise(spray.v) * 100, on = h >= spray.hs, dp = 0.5 * P.RHO_AIR * spray.v ** 2, vmin = Math.sqrt((2 * P.RHO_W * g0 * spray.hs) / 100 / P.RHO_AIR);
    setRO("r1", "Havo tezligi <i>v</i>", u(spray.v, 1, "m/s"), "naycha uchi ustida");
    setRO("r2", "Bosim pasayishi <i>Δp</i>", u(dp, 0, "Pa"), "Δp = ρₕv²/2 (ρₕ — havo zichligi)");
    setRO("r3", "Suyuqlik ko‘tariladi <i>h</i>", u(h, 1, "cm"), "h = ρₕv²/(2ρg)");
    setRO("r4", "Naycha balandligi <i>hₛ</i>", u(spray.hs, 1, "cm"), "suyuqlik sirtidan");
    setRO("r5", "Kerakli tezlik <i>v<sub>min</sub></i>", u(vmin, 1, "m/s"), "v_min = √(2ρghₛ/ρₕ)");
    setRO("r6", "Holat", on ? "purkaydi" : "yetmaydi", on ? "h ≥ hₛ: suyuqlik uchiga chiqdi" : `yana ${fmt(spray.hs - h, 1)} cm kerak`, on ? "green" : "orange");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "flow") { t = "Oqim barqaror: Q = const"; tone = "green"; }
  else if (ui.mode === "bern") { const neg = bernAt(50).lvl < bern.dt / 2; t = neg ? "Tor joyda bosim atmosferadan past" : "Bernulli: p + ρv²/2 + ρgh = const"; tone = neg ? "red" : "green"; }
  else if (ui.sub === "tor") { t = "Sath o‘zgarmas"; tone = "blue"; }
  else if (ui.sub === "wing") { const L = wing.foil ? wing.foil.CL : 0; t = L > 0.02 ? "Ko‘tarish kuchi yuqoriga" : L < -0.02 ? "Ko‘tarish kuchi pastga" : "Ko‘tarish kuchi ≈ 0"; tone = L > 0.02 ? "green" : "orange"; }
  else { const on = P.sprayRise(spray.v) * 100 >= spray.hs; t = on ? "Purkamoqda (sekinlashtirilgan)" : "Suyuqlik naychada ko‘tarildi"; tone = on ? "green" : "orange"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "flow") {
    p.push("<p>Suyuqlik siqilmaydi, shuning uchun quvurning istalgan kesimidan 1 sekundda bir xil hajm o‘tadi: <b>Q = S·v = const</b> (oqim uzluksizligi). Kesim yuzasi kichik joyda suyuqlik tezroq oqadi: v₂/v₁ = S₁/S₂ = (d₁/d₂)².</p>");
    p.push("<p>To‘q sariq bo‘lak — bir xil suyuqlik hajmi. Tor joyga kirganda u cho‘ziladi, keng joyda qisqaradi, ammo hajmi (V) o‘zgarmaydi. Shlang uchini barmoq bilan qisganda suv uzoqqa otilishi ham shu sababli.</p>");
  } else if (ui.mode === "bern") {
    p.push("<p><b>Bernulli qonuni</b> — oqimdagi energiyaning saqlanishi: p + ρv²/2 + ρgh = const. Tor joyda tezlik ortadi (uzluksizlik), demak statik bosim p kamayadi — manometrdagi suv ustuni pasayadi. Keng joyda tezlik avvalgidek bo‘lsa, bosim ham tiklanadi (h₃ = h₁).</p>");
    p.push(bern.dy > 0 ? "<p>Quvur Δy ga ko‘tarilgan joyda tezlik o‘zgarmagan, lekin ρgh hadi ortgan — bosim ρgΔy ga kamayadi: manometr ustunining ustki sathi pastda turadi va sathlar yig‘indisi baribir energiya chizig‘iga yetadi.</p>" : "<p><b>Venturi trubkasi</b>: ikki manometr farqi Δh dan oqim tezligi va sarfini hisoblash mumkin. Sarfni ko‘paytiring yoki tor joyni toraytiring — bosim atmosferadan ham pasayishi mumkin: shunda trubka havoni (yoki suyuqlikni) so‘rib oladi.</p>");
  } else if (ui.sub === "tor") {
    p.push("<p><b>Torichelli formulasi</b>: chuqurligi h bo‘lgan teshikdan suv v = √(2gh) tezlik bilan otiladi — xuddi h balandlikdan erkin tushgan jism tezligidek. Bu Bernulli qonunining natijasi (sirtda va teshikda bosim atmosferaga teng).</p>");
    p.push(tor.holes === 1 ? "<p>Oqim gorizontal otilgan jism kabi parabola bo‘ylab uchadi: l = v·t = 2√(h·y). Teshikni surib ko‘ring: eng uzoq masofa teshik H/2 balandlikda bo‘lganda (l = H).</p>" : "<p>Pastki teshikdan suv eng tez otiladi, lekin polga yaqin — uchish vaqti kam. H/4 va 3H/4 teshiklar bir xil masofaga otadi, H/2 dagi teshik — eng uzoqqa.</p>");
  } else if (ui.sub === "wing") {
    p.push("<p>Qanot profili egilgan va oqimga α burchak ostida turadi. Qanot ustidagi oqim chiziqlari zichlashadi — u yerda havo tezroq oqadi, Bernulli qonuniga ko‘ra bosim kamayadi (ko‘k). Qanot ostida havo sekinroq va bosim kattaroq (qizil). Bosimlar farqi <b>ko‘tarish kuchini</b> hosil qiladi.</p>");
    p.push("<p>Ko‘tarish kuchi F = ½ρV²·S·C<sub>y</sub>: tezlik 2 marta ortsa, kuch 4 marta ortadi. Kichik burchaklarda C<sub>y</sub> burchakka deyarli proporsional; chiqish qirrasini surib α ni o‘zgartiring. Egilgan profil α = 0 da ham ko‘taradi.</p>");
  } else {
    p.push("<p><b>Purkagich (atomayzer)</b>: noksimon puflagich naycha uchi ustidan tez havo oqimini o‘tkazadi. Bernulli qonuniga ko‘ra oqimda bosim ρv²/2 ga kamayadi, idishdagi suyuqlik sirtiga esa atmosfera bosimi ta’sir qiladi — farq suyuqlikni naychada h = ρₕv²/(2ρg) balandlikka ko‘taradi (ρₕ — havo, ρ — suyuqlik zichligi).</p>");
    p.push("<p>Agar h naycha uchigacha yetsa, suyuqlik havo oqimiga chiqadi va mayda tomchilarga ajralib sochiladi. Naychani pastroq qo‘ying yoki tezroq puflang. Atir purkagichi, bo‘yoq purkagich va karburator shu tamoyilda ishlaydi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "flow" ? "<small>Uzluksizlik</small> S₁v₁ = S₂v₂" : ui.mode === "bern" ? "<small>Bernulli</small> p + ρv²/2 + ρgh = const" : ui.sub === "tor" ? "<small>Torichelli</small> v = √(2gh)" : ui.sub === "wing" ? "<small>Ko‘tarish kuchi</small> F = ½·C·ρV²S" : "<small>Purkagich</small> pₐₜₘ − p = ρv²/2";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  ui.t += dt;
  if (ui.mode === "flow") stepFlow(dt); else if (ui.mode === "bern") stepBern(dt); else if (ui.sub === "wing") stepWing(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.15) { uiTimer = 0; if (ui.mode === "flow") updateReadouts(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
}
playBtn.addEventListener("click", () => loop.toggle());
function resetMode() {
  ui.t = 0;
  if (ui.mode === "flow") rebuildFlow(); else if (ui.mode === "bern") rebuildBern(); else if (ui.sub === "wing") { foilUpdate(); seedWing(); }
}
$("[data-reset]").addEventListener("click", () => { resetMode(); refresh(); });

/* ------------------------------------------------------------------ Boshqaruv */

const fQC = bindRange($("#fQ"), $("#fQOut"), (v) => `${fmt(v, 2)} L/s`, (v) => { flow.Q = v; customized(); refresh(); });
const fDC = ["#fD1", "#fD2", "#fD3"].map((id, i) => bindRange($(id), $(`${id}Out`), (v) => `${fmt(v, 1)} cm`, (v) => { flow.d[i] = v; rebuildFlow(); customized(); refresh(); }));
const bQC = bindRange($("#bQ"), $("#bQOut"), (v) => `${fmt(v, 1)} L/s`, (v) => { bern.Q = v; customized(); refresh(); });
const bDC = bindRange($("#bD"), $("#bDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { bern.dt = v; rebuildBern(); customized(); refresh(); });
const bPC = bindRange($("#bP"), $("#bPOut"), (v) => `${fmt(v, 0)} cm`, (v) => { bern.p1 = v; customized(); refresh(); });
const bYC = bindRange($("#bY"), $("#bYOut"), (v) => `${fmt(v, 0)} cm`, (v) => { bern.dy = v; rebuildBern(); customized(); refresh(); });
const tHC = bindRange($("#tH"), $("#tHOut"), (v) => `${fmt(v, 2)} m`, (v) => { tor.H = v; tor.yh = clamp(tor.yh, 0.05, tor.H - 0.05); customized(); refresh(); });
const wVC = bindRange($("#wV"), $("#wVOut"), (v) => `${fmt(v, 0)} m/s`, (v) => { wing.V = v; customized(); refresh(); });
const wAC = bindRange($("#wA"), $("#wAOut"), (v) => `${fmt(v, 1)}°`, (v) => { wing.alpha = v * DEG; customized(); refresh(); });
const sVC = bindRange($("#sV"), $("#sVOut"), (v) => `${fmt(v, 1)} m/s`, (v) => { spray.v = v; customized(); refresh(); });
const sHC = bindRange($("#sH"), $("#sHOut"), (v) => `${fmt(v, 1)} cm`, (v) => { spray.hs = v; customized(); refresh(); });
document.querySelectorAll("[data-holes-value]").forEach((b) => b.addEventListener("click", () => { if (+b.dataset.holesValue !== tor.holes) loadPreset(+b.dataset.holesValue === 3 ? "tor3" : "tor"); }));
document.querySelectorAll("[data-sub-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.subValue !== ui.sub) loadPreset(b.dataset.subValue); }));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* Sahnadagi boshqaruv */
const canvas = stage.canvas;
let drag = null, dragY0 = 0, dragV0 = 0;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const hitR = (p, b) => b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r;
function hitTest(p) {
  if (ui.mode === "flow") { const g = geo.flow || {}; for (const h of g.h || []) if (hitR(p, h)) return "d" + h.i; if (hitR(p, g.knob)) return "knobF"; return null; }
  if (ui.mode === "bern") { const g = geo.bern || {}; if (hitR(p, g.lv)) return "lv"; if (hitR(p, g.th)) return "th"; if (hitR(p, g.ry)) return "ry"; if (hitR(p, g.knob)) return "knobB"; return null; }
  if (ui.sub === "tor") { const g = geo.tor || {}; if (hitR(p, g.hole)) return "hole"; if (hitR(p, g.lvl)) return "lvl"; return null; }
  if (ui.sub === "wing") { const g = geo.wing || {}; if (hitR(p, g.te)) return "te"; if (hitR(p, g.knob)) return "knobW"; return null; }
  const g = geo.spray || {}; if (hitR(p, g.tip)) return "tip"; if (hitR(p, g.knob)) return "knobS"; return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  drag = h; dragY0 = p.y; dragV0 = { knobF: flow.Q, knobB: bern.Q, knobW: wing.V, knobS: spray.v }[h] ?? 0;
  canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  e.preventDefault(); onDrag(p);
});
function onDrag(p) {
  const w = toWorld(p.x, p.y), dy = dragY0 - p.y;
  if (drag[0] === "d" && drag.length === 2) { const i = +drag[1]; flow.d[i] = clamp(Math.round(Math.abs(w.y) * 4) / 2, 3, 14); fDC[i].set(flow.d[i]); rebuildFlow(); }
  else if (drag === "knobF") { flow.Q = clamp(Math.round((dragV0 + dy * 0.01) * 20) / 20, 0.2, 2); fQC.set(flow.Q); }
  else if (drag === "knobB") { bern.Q = clamp(Math.round((dragV0 + dy * 0.02) * 10) / 10, 0.5, 4); bQC.set(bern.Q); }
  else if (drag === "lv") { bern.p1 = clamp(Math.round(w.y), 25, 60); bPC.set(bern.p1); }
  else if (drag === "th") { bern.dt = clamp(Math.round(Math.abs(w.y) * 20) / 10, 3.5, 9); bDC.set(bern.dt); rebuildBern(false); }
  else if (drag === "ry") { bern.dy = clamp(Math.round(w.y + D1B / 2), 0, 20); bYC.set(bern.dy); rebuildBern(false); }
  else if (drag === "lvl") { tor.H = clamp(Math.round(w.y * 100) / 100, 0.7, 1.5); tor.yh = clamp(tor.yh, 0.05, tor.H - 0.05); tHC.set(tor.H); }
  else if (drag === "hole") { tor.yh = clamp(Math.round(w.y * 100) / 100, 0.05, tor.H - 0.05); }
  else if (drag === "te") { const a = Math.atan2(-w.y, w.x) / DEG; wing.alpha = clamp(Math.round(a * 2) / 2, -4, 12) * DEG; wAC.set(wing.alpha / DEG); }
  else if (drag === "knobW") { wing.V = clamp(Math.round(dragV0 + dy * 0.3), 10, 80); wVC.set(wing.V); }
  else if (drag === "tip") { spray.hs = clamp(Math.round((w.y + 1.8) * 10) / 10, 1, 10); sHC.set(spray.hs); }
  else if (drag === "knobS") { spray.v = clamp(Math.round((dragV0 + dy * 0.25) * 2) / 2, 0, 50); sVC.set(spray.v); }
  customized(); refresh();
}
const CURSOR = { te: "grab" };
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? CURSOR[h] || "ns-resize" : ""; return; } onDrag(p); });
function endDrag() { if (drag === "th" || drag === "ry") rebuildBern(true); drag = null; canvas.dataset.dragging = "false"; refresh(); }
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  flow: { mode: "flow", title: "Uch kesimli quvur: Q = Sv", lesson: "Har bir kesimdan 1 sekundda 1 litr suv o‘tadi. Tor (5 cm) joyda tezlik keng (10 cm) joydagidan 4 marta katta. Devordagi tutqichlarni surib kesimlarni o‘zgartiring.", set: () => Object.assign(flow, { Q: 1, d: [10, 5, 8] }) },
  hose: { mode: "flow", title: "Shlang uchini qisish", lesson: "Shlang uchi 12 cm dan 4 cm gacha toraytirilgan: kesim 9 marta kichik — suv 9 marta tez otiladi. To‘q sariq bo‘lak uchiga kirib qanday cho‘zilishini kuzating.", set: () => Object.assign(flow, { Q: 1.5, d: [12, 12, 4] }) },
  venturi: { mode: "bern", title: "Venturi trubkasi", lesson: "Tor joyda (d₂ = 5 cm) suv 4 marta tez oqadi va 2-manometr ustuni pastroq. Keng joyda (3-manometr) bosim tiklanadi. Tor joy devorini surib ko‘ring.", set: () => Object.assign(bern, { Q: 2.5, dt: 5, p1: 45, dy: 0 }) },
  suction: { mode: "bern", title: "Bosim atmosferadan past", lesson: "Sarf katta, tor joy esa ingichka: v₂²/2g kirishdagi bosim ustunidan katta — tor joyda bosim atmosferadan past. Suv nasosi (so‘rg‘ich) va purkagich shu hodisaga asoslangan.", set: () => Object.assign(bern, { Q: 4, dt: 4, p1: 35, dy: 0 }) },
  rise: { mode: "bern", title: "Ko‘tariluvchi quvur", lesson: "Quvur 20 cm ga ko‘tariladi, kesim o‘zgarmaydi: tezlik bir xil, ammo yuqorida bosim 20 cm suv ustuniga kam. Barcha manometr sathlari + v²/2g energiya chizig‘iga yetadi.", set: () => Object.assign(bern, { Q: 2, dt: 9, p1: 50, dy: 20 }) },
  tor: { mode: "app", sub: "tor", title: "Torichelli: teshikdan oqim", lesson: "Suv sathi 1,3 m. Teshik chuqurligi h bo‘lsa, oqim tezligi v = √(2gh). Teshikni surib eng uzoq otiladigan joyni toping; suv sathini ham suring.", set: () => Object.assign(tor, { H: 1.3, holes: 1, yh: 0.45 }) },
  tor3: { mode: "app", sub: "tor", title: "Uch teshik: qaysi biri uzoqroq?", lesson: "Teshiklar H/4, H/2 va 3H/4 balandlikda. Pastki teshikdan suv tezroq otiladi, lekin o‘rtadagisi eng uzoqqa yetadi; yuqori va pastki — bir xil masofaga.", set: () => Object.assign(tor, { H: 1.3, holes: 3 }) },
  wing: { mode: "app", sub: "wing", title: "Qanot: ko‘tarish kuchi", lesson: "40 m/s havo oqimi qanotni α = 5° burchak ostida aylanib o‘tadi. Qanot ustida oqim tezroq va bosim pastroq. Chiqish qirrasini surib burchakni, dastak bilan tezlikni o‘zgartiring.", set: () => Object.assign(wing, { V: 40, alpha: 5 * DEG }) },
  wingZero: { mode: "app", sub: "wing", title: "Nol ko‘tarish burchagi", lesson: "α ≈ −4°: egilgan profilda ham ko‘tarish kuchi deyarli nol — ustidagi va ostidagi tezliklar tenglashadi. Burchakni asta oshiring.", set: () => Object.assign(wing, { V: 40, alpha: -4 * DEG }) },
  spray: { mode: "app", sub: "spray", title: "Purkagich (atomayzer)", lesson: "25 m/s havo oqimi naycha uchida bosimni 375 Pa ga pasaytiradi — suyuqlik 3,8 cm ko‘tariladi va naycha uchidan (3 cm) oshib sochiladi. Naychani yuqoriroq suring yoki puflashni sekinlating.", set: () => Object.assign(spray, { v: 25, hs: 3 }) },
};
const GROUPS = [["Oqim uzluksizligi", ["flow", "hose"]], ["Bernulli qonuni", ["venturi", "suction", "rise"]], ["Qo‘llanishlar", ["tor", "tor3", "wing", "wingZero", "spray"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  fQC.set(flow.Q); fDC.forEach((cc, i) => cc.set(flow.d[i]));
  bQC.set(bern.Q); bDC.set(bern.dt); bPC.set(bern.p1); bYC.set(bern.dy);
  tHC.set(tor.H); wVC.set(wing.V); wAC.set(wing.alpha / DEG); sVC.set(spray.v); sHC.set(spray.hs);
  document.querySelectorAll("[data-holes-value]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.holesValue === tor.holes)));
  document.querySelectorAll("[data-sub-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.subValue === ui.sub)));
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { flow: "Devor tutqichlarini va Q dastagini suring", bern: "Tor joy, ko‘tarilgan quvur, 1-manometr sathi va Q dastagi", tor: "Suv sathini va teshikni suring", wing: "Qanot chiqish qirrasini va V dastagini suring", spray: "Naychani va puflagich dastagini suring" };
const DHINT = { tor: "Uchta teshik rejimida teshiklar H/4, H/2, 3H/4 da turadi.", wing: "Qanot vatari 1,5 m, havo zichligi 1,2 kg/m³. Rang — bosim: ko‘k past, qizil yuqori.", spray: "Suyuqlik zichligi 1000 kg/m³ (suv), havo 1,2 kg/m³." };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-dctl]").forEach((el) => { el.hidden = el.dataset.dctl !== ui.sub; });
  $("[data-mode-hint]").textContent = MODE_HINT[ui.mode === "app" ? ui.sub : ui.mode];
  $("[data-dhint]").textContent = DHINT[ui.sub] || "";
  $("[data-graph-card]").hidden = ui.mode !== "bern";
  window.dispatchEvent(new Event("resize"));
}
const MODE_DEFAULT = { flow: "flow", bern: "venturi", app: "tor" };
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; if (p.sub) ui.sub = p.sub;
  p.set(); resetMode(); setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

setPlayUI(false);
const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "flow");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
