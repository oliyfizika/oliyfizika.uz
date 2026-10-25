// ==========================================================================
// Gazlarda elektr toki va razryad turlari — virtual laboratoriya (simulations/discharge.html)
// 1) Ionlash kamerasi: yuqori kuchlanish manbai, yassi plastinkalar, ionlagich (alanga, ultrabinafsha, rentgen),
//    galvanometr; ionlar hosil bo'lishi, rekombinatsiyasi va dreyfi; Om sohasi, to'yinish, zarbli ionlanish, uchqun.
// 2) Razryad trubkasi: vakuum nasosi, vakuummetr, gaz kiritish klapani; Pashen qonuni bo'yicha teshilish,
//    shnur → tlejli razryad (katod qorong'i sohasi, manfiy shu'la, Faradey sohasi, musbat ustun, qatlamlar) → katod nurlari.
// 3) Razryad turlari: Uimshurst elektrofor mashinasida uchqun, ko'mir elektrodlar orasida elektr yoyi, liniya simida toj.
// Dunyo koordinatalari 520×300. Fizika: discharge-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, sci, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import { analogMeter, powerSupply, wire, terminal } from "./instruments.js";
import * as P from "./discharge-physics.js";
import { drawChamber, drawPaschen, drawSpark, drawArc, drawCorona, lastFrame, fI, unitFor } from "./discharge-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const WORLD = [520, 300];
const ION_S = 0.01, ION_UMAX = 40000, ION_RLIM = 5e7;
const TUBE_L = 40, TUBE_R = 1e6, TX0 = 92, TX1 = 468, TCY = 90, TR = 26;
const H_LINE = 1500, ARC_E = 110, SPARK_UMAX = 90000;
const ui = { mode: "ion", kind: "spark", view: { ion: "lin", tube: "pa", spark: "t", arc: "ui", corona: "e" }, hover: null };
const ion = { src: "xray", U: 1000, d: 1, parts: [], acc: 0, spark: 0, sparkT: 0, seed: 1, hit: [0, 0] };
const tube = { gas: "air", p: 760, U: 10000, pump: false, vent: false, burning: false };
const spark = { d: 1.5, w: 1.5, jars: true, U: 0, t: 0, hist: [], histT: 0, flash: 0, seed: 1, count: 0, rot: 0, lastT: null, period: null };
const arc = { R: 5, d: 3, on: false, out: false };
const cor = { U: 150, r: 0.5, m: 1 };
let presetId = null;
let running = false;
let CW = 800, anim = 0;
const hits = {};

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
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const COL = (c) => ({ red: c.dark ? "#f87171" : "#b91c1c", black: c.dark ? "#cbd5e1" : "#1f2937", blue: c.dark ? "#60a5fa" : "#1d4ed8" });
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
const SEED = (n) => { let a = n; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; };
/** Uchqun kanali (zigzag) ekranda */
function bolt(ctx, x0, y0, x1, y1, seed, { width = 2, color = "#fff", glow = "rgba(196,181,253,0.9)", n = 9, amp = 0.18 } = {}) {
  const r = SEED(seed), L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L, pts = [[x0, y0]];
  for (let k = 1; k < n; k++) { const t = k / n, o = (r() - 0.5) * L * amp; pts.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]); }
  pts.push([x1, y1]);
  ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.shadowColor = glow; ctx.shadowBlur = 14;
  for (const [w, col] of [[width * 3, glow], [width, color]]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
  ctx.restore();
}
const fU = (U) => (U >= 1000 ? `${fmt(U / 1000, U >= 1e4 ? 1 : 2)} kV` : `${fmt(U, U < 10 ? 2 : 0)} V`);
const fP = (p) => (p >= 1 ? fmt(p, p >= 100 ? 0 : 1) : p >= 0.01 ? fmt(p, p >= 0.1 ? 2 : 3) : sci(p, 2));
const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
/** Galvanometr/ampermetr: avtomatik chegara */
function autoMeter(I) {
  const [k, unit] = unitFor(I || 1e-12), v = I / k, R = NICE.find((r) => r >= v * 1.04) || 1000, m = R / 10 ** Math.floor(Math.log10(R) + 1e-9);
  return { value: v, max: R, sym: unit, ticks: m === 2 ? 2 : 5, digits: R === 1 ? 1 : 0, label: `0–${R} ${unit}` };
}

/* ------------------------------------------------------------------ 1) Ionlash kamerasi */

const uFromPos = (v) => (v <= 0 ? 0 : 10 ** (((v - 1) / 999) * Math.log10(ION_UMAX)));
const posFromU = (U) => (U < 1 ? 0 : clamp(1 + (999 * Math.log10(U)) / Math.log10(ION_UMAX), 1, 1000));
const ionQ = () => P.IONIZERS[ion.src].q;
const ionUb = () => P.chamberBreakdown(ion.d / 100);
function ionState() {
  const r = P.chamber(ion.U, ion.d / 100, ION_S, ionQ());
  if (r.regime === "spark") r.I = Math.max(r.I, (ion.U - 0.3 * ionUb()) / ION_RLIM);
  return r;
}
const GAP = () => ion.d * 40;
const plateX = () => [300 - GAP() / 2, 300 + GAP() / 2];
const SPAWN = { none: 0.4, uv: 20, xray: 50, flame: 90 };
function stepIon(dt) {
  const st = ionState(), [xl, xr] = plateX(), n = P.chamber(1, 0.01, ION_S, ionQ()), Usat = (ionQ() * (ion.d / 100) ** 2) / (n.n * P.MU);
  const v = 170 * (1 - Math.exp(-ion.U / Math.max(1, 3 * Usat)));
  ion.acc += dt * SPAWN[ion.src];
  const r = Math.random;
  while (ion.acc >= 1 && ion.parts.length < 420) {
    ion.acc -= 1;
    const flame = ion.src === "flame", x = xl + 3 + r() * (xr - xl - 6), y = flame ? 150 + r() * 30 : 76 + r() * 100;
    ion.parts.push({ x, y, s: 1, life: 1.2 + r() * 0.6, vy: flame ? -18 - r() * 10 : 0 }, { x: x + (r() - 0.5) * 3, y: y + (r() - 0.5) * 3, s: -1, life: 1.2 + r() * 0.6, vy: flame ? -18 - r() * 10 : 0 });
  }
  const M = st.M, ava = Number.isFinite(M) && M > 1.2 ? Math.log(M) * 1.6 : 0;
  const out = [];
  for (const p of ion.parts) {
    p.x += p.s * v * (p.s < 0 ? 1.3 : 1) * dt; p.y += p.vy * dt; p.life -= dt * (v > 40 ? 0.3 : 1);
    if (p.x <= xl + 1) { ion.hit[0] = 0.15; continue; }
    if (p.x >= xr - 1) { ion.hit[1] = 0.15; continue; }
    if (p.life <= 0 || p.y < 72 || p.y > 182) continue;
    if (ava && p.s < 0 && Math.random() < ava * dt && out.length < 600) { out.push({ x: p.x, y: p.y + (Math.random() - 0.5) * 4, s: -1, life: 1, vy: 0, a: 1 }, { x: p.x, y: p.y, s: 1, life: 1, vy: 0, a: 1 }); }
    out.push(p);
  }
  ion.parts = out;
  ion.hit = ion.hit.map((h) => Math.max(0, h - dt));
  if (st.regime === "spark") { ion.sparkT -= dt; if (ion.sparkT <= 0) { ion.spark = 0.12; ion.seed = 1 + Math.floor(Math.random() * 1e6); ion.sparkT = 0.25 + Math.random() * 0.5; } }
  ion.spark = Math.max(0, ion.spark - dt);
}

function ionizer(ctx, c) {
  const s = view.s;
  if (ion.src === "flame") {
    // spirt lampa
    ctx.fillStyle = c.dark ? "rgba(186,230,253,0.25)" : "rgba(186,230,253,0.55)"; ctx.strokeStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(X(300), Y(268), 26 * s, 18 * s, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.dark ? "rgba(56,189,248,0.35)" : "rgba(125,211,252,0.6)"; ctx.beginPath(); ctx.ellipse(X(300), Y(274), 22 * s, 10 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#a1a1aa"; ctx.fillRect(X(294), Y(244), 12 * s, 9 * s); ctx.fillStyle = "#f5f5f4"; ctx.fillRect(X(298.5), Y(236), 3 * s, 8 * s);
    const fl = 1 + Math.sin(anim * 13) * 0.05 + Math.sin(anim * 7.3) * 0.04;
    const g = ctx.createRadialGradient(X(300), Y(222), 2 * s, X(300), Y(222), 26 * s); g.addColorStop(0, "rgba(253,224,71,0.9)"); g.addColorStop(0.5, "rgba(251,146,60,0.55)"); g.addColorStop(1, "rgba(251,146,60,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(300), Y(222), 26 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(59,130,246,0.7)"; ctx.beginPath(); ctx.moveTo(X(300), Y(236 - 30 * fl)); ctx.bezierCurveTo(X(310), Y(222), X(308), Y(236), X(300), Y(237)); ctx.bezierCurveTo(X(292), Y(236), X(290), Y(222), X(300), Y(236 - 30 * fl)); ctx.fill();
    ctx.fillStyle = "rgba(253,186,116,0.85)"; ctx.beginPath(); ctx.moveTo(X(300), Y(236 - 24 * fl)); ctx.bezierCurveTo(X(306), Y(224), X(305), Y(234), X(300), Y(235)); ctx.bezierCurveTo(X(295), Y(234), X(294), Y(224), X(300), Y(236 - 24 * fl)); ctx.fill();
    // issiq gaz oqimi
    ctx.strokeStyle = c.dark ? "rgba(253,186,116,0.18)" : "rgba(234,88,12,0.15)"; ctx.lineWidth = 1.2;
    for (const dx of [-6, 0, 6]) { ctx.beginPath(); for (let y = 204; y > 120; y -= 3) { const x = 300 + dx + Math.sin(y * 0.2 - anim * 6 + dx) * 2; y === 204 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)); } ctx.stroke(); }
    label(ctx, c, "spirt lampa", X(300), Y(292), "center");
  } else if (ion.src === "uv" || ion.src === "xray") {
    const uv = ion.src === "uv", lx = uv ? 440 : 300, ly = uv ? 230 : 250;
    ctx.save(); ctx.globalAlpha = 0.5 + 0.1 * Math.sin(anim * 9);
    const g = ctx.createLinearGradient(X(lx), Y(ly), X(300), Y(125)); g.addColorStop(0, uv ? "rgba(167,139,250,0.55)" : "rgba(52,211,153,0.4)"); g.addColorStop(1, uv ? "rgba(167,139,250,0.05)" : "rgba(52,211,153,0.04)");
    ctx.fillStyle = g; ctx.beginPath();
    if (uv) { ctx.moveTo(X(lx - 8), Y(ly - 10)); ctx.lineTo(X(300 - GAP() / 2), Y(90)); ctx.lineTo(X(300 + GAP() / 2), Y(175)); ctx.lineTo(X(lx + 6), Y(ly + 4)); }
    else { ctx.moveTo(X(lx - 8), Y(ly - 10)); ctx.lineTo(X(300 - GAP() / 2 + 2), Y(80)); ctx.lineTo(X(300 + GAP() / 2 - 2), Y(80)); ctx.lineTo(X(lx + 8), Y(ly - 10)); }
    ctx.closePath(); ctx.fill(); ctx.restore();
    if (uv) {
      ctx.fillStyle = c.dark ? "#475569" : "#64748b"; rr(ctx, lx - 16, ly - 14, 48, 30, 5); ctx.fill();
      ctx.fillStyle = "#c4b5fd"; rr(ctx, lx - 18, ly - 8, 6, 18, 2); ctx.fill();
      ctx.fillStyle = c.dark ? "#334155" : "#475569"; ctx.fillRect(X(lx + 2), Y(ly + 16), 6 * view.s, (288 - ly - 16) * view.s);
      label(ctx, c, "ultrabinafsha lampa", X(lx + 8), Y(292), "center");
    } else {
      ctx.fillStyle = c.dark ? "#52525b" : "#71717a"; rr(ctx, lx - 34, ly - 8, 68, 38, 4); ctx.fill();
      ctx.fillStyle = c.dark ? "#a1a1aa" : "#3f3f46"; rr(ctx, lx - 10, ly - 12, 20, 6, 1); ctx.fill();
      ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(X(lx + 20), Y(ly + 11), 6 * view.s, 0, TAU); ctx.fill();
      ctx.fillStyle = "#1c1917"; for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k * TAU) / 3; ctx.beginPath(); ctx.moveTo(X(lx + 20), Y(ly + 11)); ctx.arc(X(lx + 20), Y(ly + 11), 5 * view.s, a - 0.5, a + 0.5); ctx.fill(); }
      ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(X(lx + 20), Y(ly + 11), 1.4 * view.s, 0, TAU); ctx.fill();
      label(ctx, c, "rentgen trubkasi (qo‘rg‘oshin g‘ilofda)", X(lx), Y(292), "center");
    }
  } else label(ctx, c, "ionlagich yo‘q — faqat kosmik nurlar va tabiiy radioaktivlik", X(300), Y(292), "center", c.text3);
}

function drawIon(ctx, c) {
  const s = view.s, col = COL(c), st = ionState(), [xl, xr] = plateX();
  table(ctx, c, 288);
  const pos = posFromU(ion.U);
  const ps = powerSupply(ctx, c, X(10), Y(160), 120 * s, 100 * s, { text: ion.U >= 1000 ? fmt(ion.U / 1000, 2) : fmt(ion.U, ion.U < 10 ? 1 : 0), unit: ion.U >= 1000 ? "kV" : "V", frac: pos / 1000, title: "Yuqori kuchlanish 0–40 kV", on: true });
  const kw = wd([ps.knob.x, ps.knob.y]); hits.knob = { x: kw[0], y: kw[1], r: ps.knob.r / s };
  ionizer(ctx, c);
  // izolyator tayanchlar va plastinkalar
  for (const x of [xl - 3, xr + 3]) {
    ctx.fillStyle = c.dark ? "#1e293b" : "#292524"; ctx.fillRect(X(x - 3), Y(180), 6 * s, 98 * s);
    ctx.fillStyle = c.dark ? "#334155" : "#44403c"; rr(ctx, x - 16, 276, 32, 12, 2); ctx.fill();
  }
  const metal = (x0, x1) => { const g = ctx.createLinearGradient(X(x0), 0, X(x1), 0); g.addColorStop(0, c.dark ? "#64748b" : "#94a3b8"); g.addColorStop(0.5, c.dark ? "#e2e8f0" : "#f8fafc"); g.addColorStop(1, c.dark ? "#475569" : "#64748b"); return g; };
  ctx.fillStyle = metal(xl - 6, xl); ctx.fillRect(X(xl - 6), Y(70), 6 * s, 110 * s);
  ctx.fillStyle = metal(xr, xr + 6); ctx.fillRect(X(xr), Y(70), 6 * s, 110 * s);
  ion.hit.forEach((h, i) => { if (h > 0) { ctx.fillStyle = `rgba(250,204,21,${h * 2})`; ctx.fillRect(X(i ? xr : xl - 6), Y(70), 6 * s, 110 * s); } });
  // ionlar
  for (const p of ion.parts) {
    ctx.globalAlpha = clamp(p.life * 1.5, 0.15, 1);
    ctx.fillStyle = p.s > 0 ? (c.dark ? "#f87171" : "#dc2626") : c.dark ? "#60a5fa" : "#2563eb";
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), (p.a ? 1.6 : 2.1) * s, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (ion.spark > 0) {
    ctx.fillStyle = `rgba(196,181,253,${ion.spark * 2})`; ctx.fillRect(X(xl), Y(70), (xr - xl) * s, 110 * s);
    bolt(ctx, X(xl), Y(100 + (ion.seed % 60)), X(xr), Y(95 + ((ion.seed * 7) % 70)), ion.seed, { width: 2.4 * s });
  }
  label(ctx, c, "+", X(xl - 3), Y(62), "center", c.danger); label(ctx, c, "−", X(xr + 3), Y(62), "center", c.primary);
  label(ctx, c, `d = ${fmt(ion.d, 1)} cm`, X(300), Y(192), "center", c.text);
  // galvanometr va simlar
  const gm = analogMeter(ctx, c, X(410), Y(10), 90 * s, { ...autoMeter(st.I), plusLeft: true });
  const gp = wd(gm.plus), gn = wd(gm.minus), pp = wd(ps.plus), pm = wd(ps.minus), on = st.I > 0;
  wire(ctx, c, S([pp, [150, pp[1]], [150, 40], [xl - 3, 40], [xl - 3, 70]]), { color: col.red, on });
  wire(ctx, c, S([[xr + 3, 70], [xr + 3, 55], [398, 55], [398, 100], [gp[0], 100], gp]), { color: col.black, on });
  wire(ctx, c, S([gn, [gn[0], 100], [508, 100], [508, 282], [pm[0], 282], pm]), { color: col.black, on });
  terminal(ctx, ps.plus[0], ps.plus[1], Math.max(4, 6 * s), "#dc2626"); terminal(ctx, ps.minus[0], ps.minus[1], Math.max(4, 6 * s), "#334155");
  terminal(ctx, gm.plus[0], gm.plus[1], 5 * s, "#dc2626"); terminal(ctx, gm.minus[0], gm.minus[1], 5 * s, "#334155");
  label(ctx, c, "galvanometr", X(455), Y(110), "center");
}

/* ------------------------------------------------------------------ 2) Razryad trubkasi */

const gas = () => P.GASES[tube.gas];
const pFromPos = (v) => 10 ** (-4 + (v / 1000) * (Math.log10(760) + 4));
const posFromP = (p) => clamp((1000 * (Math.log10(p) + 4)) / (Math.log10(760) + 4), 0, 1000);
const tubeUb = () => P.tubeBreakdown(gas(), tube.p, TUBE_L);
function updateBurning() {
  const Ub = tubeUb();
  if (!tube.burning && tube.U >= Ub) tube.burning = true;
  else if (tube.burning && tube.U < P.SUSTAIN * Ub) tube.burning = false;
}
const tubeI = () => (tube.burning ? P.tubeCurrent(tube.U, tubeUb(), TUBE_R) : 0);
function tubeRegime() {
  if (!tube.burning) return tube.p < 1e-3 ? "vacuum" : "none";
  const L = P.glowLayout(tube.p, TUBE_L);
  if (L.rays) return "rays";
  if (tube.p > 40) return "spark";
  if (tube.p > 3) return "cord";
  if (L.striae > 0.5) return "striae";
  return "glow";
}
const REGIME = { none: "razryad yo‘q", vacuum: "yuqori vakuum — tashuvchilar yo‘q", spark: "uchqunli kanal", cord: "shnur (ingichka kanal)", glow: "tlejli razryad", striae: "qatlamli tlejli razryad", rays: "katod nurlari (shisha shu’lalanadi)" };
function stepTube(dt) {
  if (tube.pump && !tube.vent) tube.p = P.pumpStep(tube.p, dt);
  if (tube.vent) { tube.p = P.ventStep(tube.p, dt); if (tube.p > 759) { tube.p = 760; tube.vent = false; } }
  if (tube.pump || tube.vent) { PC.set(posFromP(tube.p)); $("#tPOut").textContent = `${fP(tube.p)} mm`; }
  updateBurning();
}

function drawTubeGlow(ctx, c) {
  const s = view.s, g = gas(), reg = tubeRegime(), I = tubeI(), b = clamp(I / 6e-3, 0.25, 1.2), px = (TX1 - TX0) / TUBE_L;
  ctx.save(); rr(ctx, 74, TCY - TR, 412, 2 * TR, TR); ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  if (reg === "spark" || reg === "cord") {
    const w = reg === "spark" ? 1.6 : clamp(4 + 12 * (1 - (tube.p - 3) / 10), 4, 16);
    for (let k = 0; k < (reg === "spark" ? 2 : 1); k++) {
      const seed = 1 + Math.floor(anim * (reg === "spark" ? 14 : 3)) * 7 + k * 101, r = SEED(seed);
      ctx.strokeStyle = rgba(g.col, 0.35 * b); ctx.lineWidth = w * 3 * s; ctx.lineCap = "round"; ctx.beginPath();
      for (let x = TX0; x <= TX1; x += 12) { const y = TCY + (x === TX0 || x + 12 > TX1 ? 0 : (r() - 0.5) * (reg === "spark" ? 14 : 6)); x === TX0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)); }
      ctx.stroke(); ctx.strokeStyle = rgba([255, 255, 255], 0.7 * b); ctx.lineWidth = w * 0.6 * s; ctx.stroke();
    }
  } else if (reg === "glow" || reg === "striae") {
    const L = P.glowLayout(tube.p, TUBE_L), x0 = TX0, xd = x0 + L.dk * px, xn = xd + L.neg * px, xf = xn + L.far * px;
    // katod shu'lasi (yupqa)
    ctx.fillStyle = rgba(g.neg, 0.5 * b); ctx.fillRect(X(x0), Y(TCY - TR), Math.max(1.5, 1.5 * s), 2 * TR * s);
    // manfiy shu'la
    let gr = ctx.createLinearGradient(X(xd), 0, X(xn), 0); gr.addColorStop(0, rgba(g.neg, 0.85 * b)); gr.addColorStop(1, rgba(g.neg, 0.05));
    ctx.fillStyle = gr; ctx.fillRect(X(xd), Y(TCY - TR), (xn - xd) * s, 2 * TR * s);
    // musbat ustun (qatlamlar bilan)
    if (TX1 > xf) {
      const len = TX1 - xf, sp = Math.max(6, L.spacing * px), phase = (anim * 6) % sp, grd = ctx.createLinearGradient(X(xf), 0, X(TX1), 0), N = 160;
      for (let k = 0; k <= N; k++) {
        const u = k / N, x = xf + u * len, st = 0.5 + 0.5 * Math.cos(((x - xf + phase) / sp) * TAU), a = (0.25 + 0.6 * (L.striae ? st ** 2 * L.striae + (1 - L.striae) : 1)) * b * Math.min(1, u * 6 + 0.2);
        grd.addColorStop(u, rgba(g.col, Math.min(1, a)));
      }
      ctx.fillStyle = grd; ctx.fillRect(X(xf), Y(TCY - TR + 2), len * s, (2 * TR - 4) * s);
      ctx.fillStyle = rgba(g.col, 0.6 * b); ctx.fillRect(X(TX1 - 3), Y(TCY - TR), 3 * s, 2 * TR * s);
    }
  } else if (reg === "rays") {
    const k = clamp(tube.U / 12000, 0.3, 1);
    let gr = ctx.createRadialGradient(X(TX1 + 14), Y(TCY), 4 * s, X(TX1 + 14), Y(TCY), 140 * s); gr.addColorStop(0, `rgba(74,222,128,${0.8 * k})`); gr.addColorStop(1, "rgba(74,222,128,0)");
    ctx.fillStyle = gr; ctx.fillRect(X(TX1 - 140), Y(TCY - TR), 160 * s, 2 * TR * s);
    ctx.fillStyle = rgba(g.neg, 0.25 * k); ctx.fillRect(X(TX0), Y(TCY - TR), 6 * s, 2 * TR * s);
  }
  ctx.restore();
}

function drawTube(ctx, c) {
  const s = view.s, col = COL(c), I = tubeI(), on = I > 0;
  table(ctx, c, 288);
  // trubka (qorong'i xonada): shisha
  ctx.fillStyle = "rgba(15,23,42,0.88)"; rr(ctx, 74, TCY - TR, 412, 2 * TR, TR); ctx.fill();
  drawTubeGlow(ctx, c);
  const gl = ctx.createLinearGradient(0, Y(TCY - TR), 0, Y(TCY + TR));
  gl.addColorStop(0, "rgba(255,255,255,0.45)"); gl.addColorStop(0.18, "rgba(255,255,255,0.06)"); gl.addColorStop(0.85, "rgba(255,255,255,0.02)"); gl.addColorStop(1, "rgba(255,255,255,0.25)");
  ctx.fillStyle = gl; rr(ctx, 74, TCY - TR, 412, 2 * TR, TR); ctx.fill();
  ctx.strokeStyle = c.dark ? "rgba(203,213,225,0.7)" : "rgba(100,116,139,0.9)"; ctx.lineWidth = 1.2; ctx.stroke();
  // elektrodlar
  ctx.fillStyle = c.dark ? "#cbd5e1" : "#94a3b8";
  ctx.fillRect(X(TX0 - 3), Y(TCY - 18), 4 * s, 36 * s); ctx.fillRect(X(TX1 - 1), Y(TCY - 18), 4 * s, 36 * s);
  ctx.fillRect(X(66), Y(TCY - 1.2), (TX0 - 66) * s, 2.4 * s); ctx.fillRect(X(TX1 + 3), Y(TCY - 1.2), (494 - TX1 - 3) * s, 2.4 * s);
  label(ctx, c, "katod (−)", X(TX0 + 4), Y(TCY - TR - 12), "left"); label(ctx, c, "anod (+)", X(TX1 - 4), Y(TCY - TR - 12), "right");
  // yon naycha, klapan, shlang
  ctx.fillStyle = c.dark ? "rgba(203,213,225,0.35)" : "rgba(148,163,184,0.5)"; ctx.fillRect(X(274), Y(TCY + TR), 12 * s, 40 * s);
  ctx.fillStyle = c.dark ? "#a16207" : "#b45309"; rr(ctx, 268, 136, 24, 12, 3); ctx.fill();
  ctx.save(); ctx.translate(X(280), Y(142)); ctx.rotate(tube.vent ? 0 : Math.PI / 2); ctx.fillStyle = c.dark ? "#fde68a" : "#78350f"; ctx.fillRect(-10 * s, -2 * s, 20 * s, 4 * s); ctx.restore();
  hits.valve = { x: 280, y: 142, r: 14 };
  if (tube.vent) { ctx.strokeStyle = c.text3; ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { const ph = (anim * 2 + k / 3) % 1; ctx.beginPath(); ctx.arc(X(296 + ph * 20), Y(142), (3 + ph * 6) * s, -0.8, 0.8); ctx.stroke(); } }
  ctx.strokeStyle = c.dark ? "#334155" : "#1f2937"; ctx.lineWidth = 7 * s; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(X(280), Y(152)); ctx.bezierCurveTo(X(280), Y(185), X(330), Y(170), X(342), Y(204)); ctx.stroke();
  ctx.strokeStyle = c.dark ? "#475569" : "#374151"; ctx.lineWidth = 7 * s; ctx.beginPath(); ctx.moveTo(X(280), Y(168)); ctx.lineTo(X(246), Y(168)); ctx.stroke();
  // vakuummetr
  ctx.fillStyle = c.dark ? "#475569" : "#e5e7eb"; rr(ctx, 150, 150, 96, 46, 6); ctx.fill(); ctx.strokeStyle = c.dark ? "#64748b" : "#9ca3af"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#0b1220"; rr(ctx, 156, 156, 84, 22, 3); ctx.fill();
  ctx.fillStyle = "#4ade80"; ctx.font = `700 ${Math.round(11 * s)}px "SFMono-Regular", Menlo, Consolas, ui-monospace, monospace`; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillText(tube.p >= 0.01 ? fmt(tube.p, tube.p >= 100 ? 0 : tube.p >= 1 ? 1 : 3) : tube.p.toExponential(1).replace(".", ",").replace("e-", "E-"), X(224), Y(167.5));
  ctx.fillStyle = "#94a3b8"; ctx.font = `700 ${Math.max(6, 7 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "left"; ctx.fillText("mm", X(226), Y(167.5));
  ctx.fillStyle = c.dark ? "#e2e8f0" : "#374151"; ctx.textAlign = "center"; ctx.fillText("Vakuummetr", X(198), Y(188));
  // vakuum nasosi
  ctx.fillStyle = c.dark ? "#7f1d1d" : "#b91c1c"; rr(ctx, 318, 204, 72, 64, 8); ctx.fill();
  ctx.fillStyle = c.dark ? "#334155" : "#4b5563"; rr(ctx, 390, 218, 40, 44, 6); ctx.fill();
  ctx.fillStyle = c.dark ? "#1f2937" : "#111827"; rr(ctx, 314, 266, 120, 10, 2); ctx.fill();
  const fwx = 354, fwy = 236, rot = tube.pump ? anim * 18 : 0;
  ctx.fillStyle = c.dark ? "#cbd5e1" : "#e5e7eb"; ctx.beginPath(); ctx.arc(X(fwx), Y(fwy), 20 * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 2 * s; for (let k = 0; k < 4; k++) { const a = rot + (k * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(X(fwx), Y(fwy)); ctx.lineTo(X(fwx + Math.cos(a) * 18), Y(fwy + Math.sin(a) * 18)); ctx.stroke(); }
  ctx.fillStyle = "#475569"; ctx.beginPath(); ctx.arc(X(fwx), Y(fwy), 4 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = tube.pump ? "#22c55e" : "#6b7280"; ctx.beginPath(); ctx.arc(X(422), Y(226), 3 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `700 ${Math.max(6, 7 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText("NASOS", X(354), Y(212));
  hits.pump = { x: 314, y: 204, w: 120, h: 72 };
  // manba va mA metr
  const ps = powerSupply(ctx, c, X(10), Y(196), 120 * s, 84 * s, { text: fmt(tube.U / 1000, 2), unit: "kV", frac: tube.U / 15000, title: "Yuqori kuchlanish 0–15 kV", on: true });
  const kw = wd([ps.knob.x, ps.knob.y]); hits.knob = { x: kw[0], y: kw[1], r: ps.knob.r / s };
  const am = analogMeter(ctx, c, X(440), Y(170), 70 * s, { value: I * 1000, max: 20, sym: "mA", label: "0–20 mA", ticks: 4, digits: 0 });
  const pp = wd(ps.plus), pm = wd(ps.minus), ap = wd(am.plus), an = wd(am.minus);
  wire(ctx, c, S([[66, TCY], [4, TCY], [4, 292], [pm[0], 292], pm]), { color: col.black, on });
  wire(ctx, c, S([pp, [pp[0], 296], [ap[0], 296], ap]), { color: col.red, on });
  wire(ctx, c, S([an, [an[0], 240], [436, 240], [436, 150], [500, 150], [500, TCY], [494, TCY]]), { color: col.red, on });
  terminal(ctx, ps.plus[0], ps.plus[1], Math.max(4, 5 * s), "#dc2626"); terminal(ctx, ps.minus[0], ps.minus[1], Math.max(4, 5 * s), "#334155");
  terminal(ctx, am.plus[0], am.plus[1], 3.8 * s, "#dc2626"); terminal(ctx, am.minus[0], am.minus[1], 3.8 * s, "#334155");
  label(ctx, c, `${gas().name} · ${REGIME[tubeRegime()]}`, X(280), Y(TCY - TR - 12), "center", c.text);
}

/* ------------------------------------------------------------------ 3) Uchqun, yoy, toj */

const sparkC = () => (spark.jars ? 400e-12 : 20e-12);
const sparkVb = () => P.sparkVb(spark.d);
function stepSpark(dt) {
  const k = spark.w * (spark.jars ? 0.25 : 2.5);
  spark.U = SPARK_UMAX + (spark.U - SPARK_UMAX) * Math.exp(-k * dt);
  spark.rot += dt * spark.w * TAU; spark.t += dt; spark.flash = Math.max(0, spark.flash - dt);
  if (spark.U >= sparkVb()) {
    spark.hist.push({ t: spark.t, U: sparkVb() }); spark.U = 0.04 * sparkVb(); spark.hist.push({ t: spark.t + 1e-3, U: spark.U });
    spark.flash = spark.jars ? 0.16 : 0.08; spark.seed = 1 + Math.floor(Math.random() * 1e6); spark.count++;
    if (spark.lastT != null) spark.period = spark.t - spark.lastT; spark.lastT = spark.t;
  }
  if (spark.t - spark.histT >= 0.04) { spark.hist.push({ t: spark.t, U: spark.U }); spark.histT = spark.t; }
  if (spark.hist.length > 900) spark.hist = spark.hist.filter((p) => p.t >= spark.t - 12);
}
const GAP_PX = 20;
function drawSparkStage(ctx, c) {
  const s = view.s, cx = 150, cy = 150, R = 84, col = COL(c), gp = spark.d * GAP_PX, bL = cx - gp / 2, bR = cx + gp / 2;
  table(ctx, c, 288);
  ctx.fillStyle = c.dark ? "#7c5a3a" : "#c08a55"; rr(ctx, 14, 268, 272, 20, 3); ctx.fill();
  // disklar (organik shisha, folga sektorlari)
  ctx.fillStyle = c.dark ? "rgba(148,163,184,0.18)" : "rgba(186,230,253,0.35)"; ctx.strokeStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(X(cx + 4), Y(cy - 3), R * s, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(X(cx), Y(cy), R * s, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.dark ? "rgba(226,232,240,0.75)" : "rgba(120,113,108,0.75)";
  for (let k = 0; k < 24; k++) { const a = spark.rot + (k * TAU) / 24; ctx.save(); ctx.translate(X(cx), Y(cy)); ctx.rotate(a); ctx.fillRect(R * 0.6 * s, -2.2 * s, R * 0.32 * s, 4.4 * s); ctx.restore(); }
  ctx.strokeStyle = c.dark ? "#e2e8f0" : "#475569"; ctx.lineWidth = 2.2 * s;
  for (const a of [Math.PI / 4, -Math.PI / 4]) { ctx.beginPath(); ctx.moveTo(X(cx - Math.cos(a) * R * 0.95), Y(cy - Math.sin(a) * R * 0.95)); ctx.lineTo(X(cx + Math.cos(a) * R * 0.95), Y(cy + Math.sin(a) * R * 0.95)); ctx.stroke(); }
  ctx.fillStyle = c.dark ? "#475569" : "#57534e"; ctx.beginPath(); ctx.arc(X(cx), Y(cy), 7 * s, 0, TAU); ctx.fill();
  // tutqich (dasta)
  const ha = spark.rot * 0.5; ctx.strokeStyle = c.dark ? "#a8a29e" : "#44403c"; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(X(cx), Y(cy)); ctx.lineTo(X(cx + Math.cos(ha) * 26), Y(cy + Math.sin(ha) * 26)); ctx.stroke();
  ctx.fillStyle = "#b91c1c"; ctx.beginPath(); ctx.arc(X(cx + Math.cos(ha) * 26), Y(cy + Math.sin(ha) * 26), 4 * s, 0, TAU); ctx.fill();
  // tarozilar (taroq) va o'tkazgichlar
  const metal = c.dark ? "#e2e8f0" : "#71717a";
  for (const [x, sg] of [[cx - R - 8, -1], [cx + R + 8, 1]]) {
    ctx.strokeStyle = metal; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(X(x), Y(cy - 16)); ctx.lineTo(X(x), Y(cy + 16)); ctx.stroke();
    ctx.lineWidth = 1.2 * s; for (let k = -12; k <= 12; k += 4) { ctx.beginPath(); ctx.moveTo(X(x), Y(cy + k)); ctx.lineTo(X(x - sg * 6), Y(cy + k)); ctx.stroke(); }
    // Leyden bankasi
    const jx = cx + sg * 64;
    if (spark.jars) {
      ctx.fillStyle = c.dark ? "rgba(203,213,225,0.25)" : "rgba(226,232,240,0.7)"; rr(ctx, jx - 16, 196, 32, 72, 5); ctx.fill(); ctx.strokeStyle = c.dark ? "#94a3b8" : "#64748b"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = c.dark ? "#cbd5e1" : "#a1a1aa"; ctx.fillRect(X(jx - 16), Y(226), 32 * s, 42 * s);
      ctx.strokeStyle = metal; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(X(jx), Y(196)); ctx.lineTo(X(jx), Y(cy + 20)); ctx.lineTo(X(x), Y(cy + 16)); ctx.stroke();
    }
    // izolyator ustun va razryadlovchi
    ctx.fillStyle = c.dark ? "#1e293b" : "#292524"; ctx.fillRect(X(x - 2.5), Y(cy + 16), 5 * s, (268 - cy - 16) * s);
    ctx.strokeStyle = metal; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(X(x), Y(cy - 16)); ctx.lineTo(X(x), Y(36)); ctx.lineTo(X(sg < 0 ? bL - 9 : bR + 9), Y(36)); ctx.stroke();
    ctx.fillStyle = c.dark ? "#334155" : "#1c1917"; rr(ctx, x - 5, 44, 10, 24, 3); ctx.fill();
  }
  const ball = (x) => { const g = ctx.createRadialGradient(X(x - 3), Y(33), 1, X(x), Y(36), 9 * s); g.addColorStop(0, "#fef3c7"); g.addColorStop(0.5, "#d4a017"); g.addColorStop(1, "#854d0e"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(x), Y(36), 9 * s, 0, TAU); ctx.fill(); };
  ball(bL - 9); ball(bR + 9);
  hits.ball = { x: bR + 9, y: 36, r: 14 };
  if (spark.flash > 0) {
    const k = spark.flash / (spark.jars ? 0.16 : 0.08);
    ctx.fillStyle = `rgba(221,214,254,${0.35 * k})`; ctx.beginPath(); ctx.arc(X(cx), Y(36), (spark.jars ? 120 : 50) * s, 0, TAU); ctx.fill();
    bolt(ctx, X(bL), Y(36), X(bR), Y(36), spark.seed, { width: (spark.jars ? 3 : 1.4) * s, n: Math.max(3, Math.round(spark.d * 4)), amp: 0.3 });
  }
  // elektrostatik kilovoltmetr
  const vm = analogMeter(ctx, c, X(360), Y(70), 110 * s, { value: spark.U / 1000, max: 100, sym: "kV", label: "elektrostatik", ticks: 5, digits: 0, ac: true });
  const v1 = wd(vm.minus), v2 = wd(vm.plus);
  wire(ctx, c, S([[cx + R + 8, cy], [v1[0], cy], v1]), { color: col.black, width: 1.8 });
  wire(ctx, c, S([[cx - R - 8, cy + 10], [8, cy + 10], [8, 292], [v2[0], 292], v2]), { color: col.black, width: 1.8 });
  [vm.plus, vm.minus].forEach((p) => terminal(ctx, p[0], p[1], 5 * s, "#334155"));
  label(ctx, c, `d = ${fmt(spark.d, 1)} cm`, X(cx), Y(14), "center", c.text);
  label(ctx, c, `Uₜ = ${fmt(sparkVb() / 1000, 1)} kV`, X(415), Y(178), "center", c.danger);
}

const arcPt = () => (arc.d <= 0 ? null : arc.on ? P.arcPoint(ARC_E, arc.R, arc.d) : null);
function arcState() { if (arc.d <= 0) return { mode: "short", I: ARC_E / (arc.R + 0.05), U: (ARC_E / (arc.R + 0.05)) * 0.05 }; const p = arcPt(); return p ? { mode: "arc", ...p } : { mode: "off", I: 0, U: ARC_E }; }
function setArcGap(d) {
  const was = arc.d; arc.d = d;
  if (d <= 0) { arc.on = false; arc.out = false; return; }
  if (was <= 0) arc.on = !!P.arcPoint(ARC_E, arc.R, d);
  if (arc.on && !P.arcPoint(ARC_E, arc.R, d)) { arc.on = false; arc.out = true; flashStatus("Yoy so‘ndi — oraliq juda katta"); }
}
const tipsX = () => [340 - arc.d * 3, 340 + arc.d * 3];
function drawArcStage(ctx, c) {
  const s = view.s, col = COL(c), st = arcState(), [tl, tr] = tipsX(), rs = tr + 90, on = st.I > 0;
  table(ctx, c, 288);
  const ps = powerSupply(ctx, c, X(10), Y(150), 120 * s, 100 * s, { value: ARC_E, unit: "V", frac: 1, title: "Manba 110 V (o‘zgarmas)", on: true });
  // reostat
  ctx.fillStyle = c.dark ? "#d6d3d1" : "#f5f5f4"; rr(ctx, 150, 26, 120, 22, 10); ctx.fill(); ctx.strokeStyle = "#a8a29e"; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = c.dark ? "#a16207" : "#92400e"; ctx.lineWidth = 1; for (let x = 156; x < 266; x += 3) { ctx.beginPath(); ctx.moveTo(X(x), Y(27)); ctx.lineTo(X(x + 1.5), Y(47)); ctx.stroke(); }
  ctx.fillStyle = "#57534e"; ctx.fillRect(X(146), Y(16), 128 * s, 3 * s);
  const sx = 156 + (arc.R / 20) * 108; ctx.fillStyle = "#1f2937"; rr(ctx, sx - 5, 12, 10, 18, 2); ctx.fill();
  terminal(ctx, X(150), Y(52), 3.5 * s, "#a1a1aa"); terminal(ctx, X(274), Y(17.5), 3.5 * s, "#a1a1aa");
  label(ctx, c, `reostat R = ${fmt(arc.R, 1)} Ω`, X(210), Y(62), "center");
  // ampermetr, voltmetr
  const am = analogMeter(ctx, c, X(300), Y(10), 76 * s, { value: st.I, max: st.I > 19 ? 50 : 20, sym: "A", label: st.I > 19 ? "0–50 A" : "0–20 A", ticks: st.I > 19 ? 5 : 2, digits: 0, plusLeft: true });
  const vm = analogMeter(ctx, c, X(300), Y(222), 72 * s, { value: st.mode === "off" ? 0 : st.U, max: 150, sym: "V", label: "0–150 V", ticks: 3, digits: 0, plusLeft: true });
  // ko'mir elektrodlar
  const holder = (x) => { ctx.fillStyle = c.dark ? "#1e293b" : "#292524"; ctx.fillRect(X(x - 3), Y(206), 6 * s, 70 * s); ctx.fillStyle = c.dark ? "#334155" : "#44403c"; rr(ctx, x - 16, 276, 32, 12, 2); ctx.fill(); ctx.fillStyle = "#a1a1aa"; rr(ctx, x - 10, 192, 20, 16, 2); ctx.fill(); };
  holder(250); holder(rs);
  const rod = (x0, x1) => { const g = ctx.createLinearGradient(0, Y(195), 0, Y(205)); g.addColorStop(0, "#52525b"); g.addColorStop(0.4, "#27272a"); g.addColorStop(1, "#09090b"); ctx.fillStyle = g; ctx.fillRect(X(x0), Y(195.5), (x1 - x0) * s, 9 * s); };
  rod(240, tl); rod(tr, rs + 10);
  // uchlar qizishi va yoy
  const heat = st.mode === "arc" ? 1 : st.mode === "short" ? 0.7 : 0;
  if (heat) {
    for (const [x, dir, T] of [[tl, -1, 1], [tr, 1, 0.75]]) { const g = ctx.createLinearGradient(X(x), 0, X(x + dir * 26), 0); g.addColorStop(0, `rgba(255,${Math.round(230 * T)},${Math.round(160 * T)},${0.95 * heat})`); g.addColorStop(1, "rgba(234,88,12,0)"); ctx.fillStyle = g; ctx.fillRect(X(Math.min(x, x + dir * 26)), Y(195.5), 26 * s, 9 * s); }
  }
  if (st.mode === "arc") {
    const fl = 1 + 0.08 * Math.sin(anim * 40) + 0.05 * Math.sin(anim * 23), mid = (tl + tr) / 2, R0 = (20 + arc.d * 4) * fl;
    let g = ctx.createRadialGradient(X(mid), Y(200), 1, X(mid), Y(200), R0 * 4 * s); g.addColorStop(0, c.dark ? "rgba(255,251,235,0.6)" : "rgba(253,224,71,0.55)"); g.addColorStop(1, "rgba(255,251,235,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(mid), Y(200), R0 * 4 * s, 0, TAU); ctx.fill();
    ctx.save(); ctx.shadowColor = "rgba(196,181,253,0.9)"; ctx.shadowBlur = 16;
    ctx.fillStyle = "rgba(196,181,253,0.85)"; ctx.beginPath(); ctx.ellipse(X(mid), Y(199), ((tr - tl) / 2 + 3) * s, (6 + arc.d * 0.6) * fl * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fffbeb"; ctx.beginPath(); ctx.ellipse(X(mid), Y(200), ((tr - tl) / 2 + 1) * s, 2.6 * fl * s, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(X(tl), Y(200), 4.2 * s, 0, TAU); ctx.fill();
  }
  hits.rod = { x: tr + 30, y: 200, w: 90 };
  // simlar
  const pp = wd(ps.plus), pm = wd(ps.minus), ap = wd(am.plus), an = wd(am.minus), vp = wd(vm.plus), vn = wd(vm.minus);
  wire(ctx, c, S([pp, [140, pp[1]], [140, 52], [150, 52]]), { color: col.red, on });
  wire(ctx, c, S([[274, 17.5], [290, 17.5], [290, 84], [ap[0], 84], ap]), { color: col.red, on });
  wire(ctx, c, S([an, [an[0], 120], [250, 120], [250, 192]]), { color: col.red, on });
  wire(ctx, c, S([vp, [vp[0], 292], [244, 292], [244, 282]]), { color: col.blue, width: 1.8 });
  wire(ctx, c, S([vn, [vn[0], 292], [rs + 6, 292], [rs + 6, 282]]), { color: col.blue, width: 1.8 });
  wire(ctx, c, S([[rs, 192], [rs, 140], [508, 140], [508, 296], [pm[0], 296], pm]), { color: col.black, on });
  terminal(ctx, ps.plus[0], ps.plus[1], Math.max(4, 6 * s), "#dc2626"); terminal(ctx, ps.minus[0], ps.minus[1], Math.max(4, 6 * s), "#334155");
  [[am.plus, "#dc2626"], [am.minus, "#334155"], [vm.plus, "#dc2626"], [vm.minus, "#334155"]].forEach(([p, cc]) => terminal(ctx, p[0], p[1], 4 * s, cc));
  label(ctx, c, `d = ${fmt(arc.d, 1)} mm`, X(340), Y(180), "center", c.text);
  label(ctx, c, st.mode === "arc" ? "elektr yoyi" : st.mode === "short" ? "ko‘mirlar tutashgan — qizimoqda" : arc.out ? "yoy so‘ndi" : "tok yo‘q", X(340), Y(162), "center", st.mode === "arc" ? c.warning : st.mode === "short" ? c.danger : c.text3);
}

const corEs = () => P.wireField(cor.U, cor.r, H_LINE);
const corEc = () => P.peek(cor.r, cor.m);
const corUc = () => P.coronaOnset(cor.r, H_LINE, cor.m);
const sagY = (x) => 84 + 0.0007 * (x - 330) ** 2;
function drawCoronaStage(ctx, c) {
  const s = view.s, Es = corEs(), Ec = corEc(), f = Es > Ec ? clamp((Es - Ec) / Ec, 0, 1.5) : 0;
  // tungi osmon va yer
  const sky = ctx.createLinearGradient(0, Y(0), 0, Y(270)); sky.addColorStop(0, "#0b1026"); sky.addColorStop(1, "#1e293b");
  ctx.fillStyle = sky; ctx.fillRect(X(0), Y(0), WORLD[0] * s, 270 * s);
  ctx.fillStyle = c.dark ? "#14532d" : "#166534"; ctx.fillRect(X(0), Y(270), WORLD[0] * s, 30 * s);
  const r = SEED(5); ctx.fillStyle = "rgba(255,255,255,0.6)"; for (let k = 0; k < 40; k++) { ctx.fillRect(X(r() * 520), Y(r() * 60), 1, 1); }
  // tayanch (metall ferma) va traversa
  ctx.strokeStyle = "#64748b"; ctx.lineWidth = Math.max(1, 1.6 * s);
  const line = (a, b, cc, d) => { ctx.beginPath(); ctx.moveTo(X(a), Y(b)); ctx.lineTo(X(cc), Y(d)); ctx.stroke(); };
  line(452, 0, 430, 270); line(492, 0, 514, 270); for (let y = 10; y < 270; y += 26) { const k = y / 270; line(452 - 22 * k, y, 492 + 22 * (k + 0.096), y + 26); line(492 + 22 * k, y, 452 - 22 * (k + 0.096), y + 26); }
  line(300, 16, 520, 16); line(300, 26, 520, 26); for (let x = 300; x < 520; x += 14) line(x, 16, x + 14, 26);
  // izolyatorlar girlyandasi
  ctx.strokeStyle = "#94a3b8"; line(330, 26, 330, 80);
  for (let k = 0; k < 8; k++) { ctx.fillStyle = "rgba(134,239,172,0.75)"; ctx.beginPath(); ctx.ellipse(X(330), Y(32 + k * 6.4), 10 * s, 2.6 * s, 0, 0, TAU); ctx.fill(); }
  // yomg'ir
  if (cor.m < 0.7) { ctx.strokeStyle = "rgba(186,230,253,0.35)"; ctx.lineWidth = 1; const rr2 = SEED(11); for (let k = 0; k < 70; k++) { const x = rr2() * 540, y = (rr2() * 300 + anim * 260) % 300; line(x, y, x - 4, y + 12); } }
  // sim va toj
  const wW = Math.max(1.6, (1 + cor.r * 2) * s);
  if (f > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const [w, a] of [[18, 0.12], [9, 0.22], [4, 0.4]]) { ctx.strokeStyle = `rgba(167,139,250,${a * clamp(0.4 + f, 0, 1.2) * (0.85 + 0.15 * Math.sin(anim * 30 + w))})`; ctx.lineWidth = (w * (0.9 + f)) * s; ctx.beginPath(); for (let x = 0; x <= 520; x += 8) { x ? ctx.lineTo(X(x), Y(sagY(x))) : ctx.moveTo(X(x), Y(sagY(x))); } ctx.stroke(); }
    const rr3 = SEED(1 + Math.floor(anim * 20)); ctx.fillStyle = "rgba(237,233,254,0.9)";
    for (let k = 0; k < 10 + 30 * f; k++) { const x = rr3() * 520, y = sagY(x) + (rr3() - 0.5) * 6; ctx.beginPath(); ctx.arc(X(x), Y(y), (0.8 + rr3() * 1.2) * s, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = wW; ctx.beginPath(); for (let x = 0; x <= 520; x += 8) { x ? ctx.lineTo(X(x), Y(sagY(x))) : ctx.moveTo(X(x), Y(sagY(x))); } ctx.stroke();
  // kesim (inset)
  const ix = 110, iy = 196, IR = 58;
  ctx.fillStyle = "rgba(15,23,42,0.85)"; ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X(ix), Y(iy), IR * s, 0, TAU); ctx.fill(); ctx.stroke();
  const rpx = 8 + cor.r * 10, ri = Es > 30 * cor.m ? Math.min(IR - 4, rpx * (Es / (30 * cor.m))) : rpx;
  if (ri > rpx + 0.5) { const g = ctx.createRadialGradient(X(ix), Y(iy), rpx * s, X(ix), Y(iy), ri * s); g.addColorStop(0, "rgba(167,139,250,0.85)"); g.addColorStop(1, "rgba(167,139,250,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(ix), Y(iy), ri * s, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = "rgba(148,163,184,0.5)"; ctx.lineWidth = 1; for (let k = 0; k < 12; k++) { const a = (k * TAU) / 12; line(ix + Math.cos(a) * (rpx + 2), iy + Math.sin(a) * (rpx + 2), ix + Math.cos(a) * (IR - 4), iy + Math.sin(a) * (IR - 4)); }
  ctx.fillStyle = "#cbd5e1"; ctx.beginPath(); ctx.arc(X(ix), Y(iy), rpx * s, 0, TAU); ctx.fill();
  ctx.fillStyle = "#e2e8f0"; ctx.font = `600 ${Math.max(7, 8 * s)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("sim kesimi", X(ix), Y(iy - IR - 8));
  label(ctx, c, `${fmt(cor.U, 0)} kV · r = ${fmt(cor.r * 10, 1)} mm`, X(330), Y(120), "center", c.text);
  if (f > 0) label(ctx, c, "toj razryad — vizillash, ozon hidi", X(300), Y(248), "center", c.special);
}

/* ------------------------------------------------------------------ Sahna */

function draw(ctx, stg) {
  CW = stg.w;
  const c = stg.colors;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, stg.w, stg.h);
  fit(stg.w, stg.h);
  if (ui.mode === "ion") drawIon(ctx, c);
  else if (ui.mode === "tube") drawTube(ctx, c);
  else if (ui.kind === "spark") drawSparkStage(ctx, c);
  else if (ui.kind === "arc") drawArcStage(ctx, c);
  else drawCoronaStage(ctx, c);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { graph: Math.round(clamp(vh * 0.28, 190, 250)) }; };
const stage = createStage($("#stage"), draw, { height: (cw) => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return Math.round(clamp(Math.min(cw * 0.62, vh * 0.46), 240, 340)); } });

/* ------------------------------------------------------------------ Grafik */

const gkey = () => (ui.mode === "types" ? ui.kind : ui.mode);
function drawGraphCanvas(ctx, gs) {
  const k = gkey();
  if (k === "ion") return drawChamber(ctx, gs, { view: ui.view.ion, q: ionQ(), d: ion.d / 100, S: ION_S, U: ion.U, hover: ui.hover });
  if (k === "tube") return drawPaschen(ctx, gs, { gas: gas(), d: TUBE_L, p: tube.p, U: tube.U, burning: tube.burning, hover: ui.hover });
  if (k === "spark") return drawSpark(ctx, gs, { view: ui.view.spark, hist: spark.hist, Vb: sparkVb(), d: spark.d, Umax: SPARK_UMAX, win: 10, hover: ui.hover });
  if (k === "arc") return drawArc(ctx, gs, { d: Math.max(0.1, arc.d), E: ARC_E, R: arc.R, pt: arcPt(), hover: ui.hover });
  return drawCorona(ctx, gs, { r: cor.r, h: H_LINE, m: cor.m, U: cor.U, Umax: 300, hover: ui.hover });
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const TABS = {
  ion: [["lin", "I(U)", "Mustaqil bo‘lmagan razryad: I(U)", "Kichik kuchlanishda ionlarning bir qismi elektrodlarga yetmay rekombinatsiyalanadi — tok U ga proporsional (shtrix). Kuchlanish ortsa, hosil bo‘lgan barcha ionlar elektrodlarga yetadi: tok to‘yinadi (Iₛ = eqSd) va endi faqat ionlagichga bog‘liq."],
    ["log", "lg I(U)", "To‘yinishdan teshilishgacha (logarifmik shkala)", "To‘yinishdan keyin tok o‘zgarmaydi, so‘ng elektronlar molekulalarni urib ionlay boshlaydi — tok keskin ortadi (zarbli ionlanish). Qizil chiziqda ionlagichsiz ham tok mavjud bo‘ladi: mustaqil razryad (uchqun)."]],
  tube: [["pa", "Uₜ(p)", "Pashen egri chizig‘i: teshilish kuchlanishi", "Yashil soha — manba kuchlanishi teshilish uchun yetarli. Bosim kamaysa, elektronning erkin yugurish yo‘li uzayadi va u kamroq kuchlanishda ionlash energiyasini to‘playdi; juda past bosimda esa urilish uchun molekulalar yetmaydi — kuchlanish yana ortadi. Chap tarmoq taxminiy."]],
  spark: [["t", "U(t)", "Leyden bankalaridagi kuchlanish U(t)", "Mashina bankalarni zaryadlaydi, kuchlanish teshilish qiymatiga yetganda havo ionlashib, uchqun sakraydi va bankalar razryadlanadi — arra tishli grafik. Bankalar ulangan bo‘lsa, sig‘im katta: uchqun kamdan-kam, lekin kuchli."],
    ["d", "Uₜ(d)", "Uchqun oralig‘i va teshilish kuchlanishi", "Atmosfera bosimida havo taxminan 30 kV/cm da teshiladi (shtrix). Kichik oraliqlarda kerakli maydon kattaroq — Pashen qonuni. Oraliq mashina chegarasidan katta bo‘lsa, uchqun chiqmaydi."]],
  arc: [["ui", "U(I)", "Elektr yoyining volt-amper xarakteristikasi", "Yoyda tok ortsa, kuchlanish kamayadi: kuchliroq tok ko‘mirlarni qattiqroq qizdiradi, termoelektron emissiya va ionlanish ortadi. Shuning uchun yoy ballast qarshiliksiz ishlay olmaydi. Yashil — barqaror ish nuqtasi, ichi bo‘sh — beqaror."]],
  corona: [["e", "E(U)", "Sim sirtidagi maydon va toj chegarasi", "Sim sirtidagi maydon kuchlanishga proporsional va ingichka simda kattaroq. U Pik chegarasidan oshsa, sim atrofidagi yupqa qatlamda havo ionlashadi — toj razryad. Liniyalarda bu energiya isrofi va radioto‘siq, shuning uchun yo‘g‘on yoki ajratilgan (bir nechta) simlar ishlatiladi."]],
};
function setTabs() {
  const box = $("[data-tabs]"), k = gkey(), tabs = TABS[k], cur = ui.view[k], t = tabs.find((x) => x[0] === cur) || tabs[0];
  box.innerHTML = tabs.map(([v, name]) => `<button type="button" data-tab-value="${v}" aria-pressed="${v === t[0]}">${name}</button>`).join("");
  box.hidden = tabs.length < 2;
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.canvas.setAttribute("aria-label", t[2]); ui.hover = null; graph.render();
}
$("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab-value]"); if (!b) return; ui.view[gkey()] = b.dataset.tabValue; setTabs(); });
const gcv = graph.canvas;
const ptrIn = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
gcv.addEventListener("pointermove", (e) => { const f = lastFrame(); if (!f) return; const p = ptrIn(gcv, e), r = f.rect, inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; ui.hover = inside ? f.xMin + ((p.x - r.x) / r.w) * (f.xMax - f.xMin) : null; gcv.style.cursor = inside ? "crosshair" : ""; graph.render(); });
gcv.addEventListener("pointerleave", () => { ui.hover = null; graph.render(); });

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const uI = (I) => { const [v, un] = fI(I); return u(v, un); };
const uU = (U) => (U >= 1000 ? u(fmt(U / 1000, U >= 1e4 ? 1 : 2), "kV") : u(fmt(U, U < 10 ? 2 : 0), "V"));
const ION_REG = { ohm: ["Om qonuni sohasi", "blue"], sat: ["to‘yinish toki", "green"], town: ["zarbli ionlanish", "orange"], spark: ["mustaqil razryad — uchqun", "red"] };

function updateReadouts() {
  const k = gkey();
  if (k === "ion") {
    const st = ionState(), [rt, tone] = ION_REG[st.regime], Ub = ionUb(), a = P.alpha(P.GASES.air, 760, st.E / 100);
    setRO("r1", "Kuchlanish <i>U</i>", uU(ion.U), `E = U/d = ${fmt(st.E / 1e5, st.E < 1e5 ? 3 : 1)} kV/cm`);
    setRO("r2", "Tok <i>I</i> (galvanometr)", uI(st.I), rt, tone);
    setRO("r3", "To‘yinish toki <i>I</i>ₛ = <i>eqSd</i>", uI(st.Is), `${P.IONIZERS[ion.src].name}: q = ${sci(ionQ(), 2)} juft/(m³·s)`);
    setRO("r4", "Elektronlar ko‘payishi <i>M</i>", Number.isFinite(st.M) ? u(st.M < 100 ? fmt(st.M, 2) : sci(st.M, 2), "marta") : "∞", `α = ${a < 1e-3 ? sci(a, 2) : fmt(a, 2)} 1/cm (Taunsend)`, st.M > 1.2 ? "orange" : "");
    setRO("r5", "Teshilish kuchlanishi <i>U</i>ₜ", uU(Ub), `Pashen: pd = ${fmt(760 * ion.d, 0)} mm·cm; ${fmt(Ub / 1000 / ion.d, 1)} kV/cm`, "red");
    setRO("r6", "Ionlar konsentratsiyasi <i>n</i>", u(sci(st.n * 1e-6, 2), "1/cm³"), "n = √(q/β): hosil bo‘lish = rekombinatsiya");
  } else if (k === "tube") {
    const Ub = tubeUb(), I = tubeI(), reg = tubeRegime(), L = P.glowLayout(tube.p, TUBE_L);
    setRO("r1", "Bosim <i>p</i>", u(fP(tube.p), "mm sim. ust."), `${sci(tube.p * P.TORR, 2)} Pa${tube.pump ? " · nasos ishlamoqda" : tube.vent ? " · gaz kirmoqda" : ""}`, tube.pump ? "purple" : "");
    setRO("r2", "Teshilish kuchlanishi <i>U</i>ₜ", Number.isFinite(Ub) ? uU(Ub) : "∞", `${gas().name}, d = ${TUBE_L} cm; so‘nish ~${fU(P.SUSTAIN * Ub)}`, "red");
    setRO("r3", "Manba kuchlanishi <i>U</i>", uU(tube.U), tube.U >= Ub ? "teshilish uchun yetarli" : tube.burning ? "razryad hali yonib turibdi" : "teshilish uchun yetmaydi", tube.U >= Ub || tube.burning ? "green" : "");
    setRO("r4", "Trubka toki <i>I</i>", uI(I), tube.burning ? `cheklovchi qarshilik 1 MΩ` : "tok yo‘q", tube.burning ? "blue" : "");
    setRO("r5", "Razryad turi", REGIME[reg], tube.burning && !L.rays && tube.p < 3 ? `katod qorong‘i sohasi d_k ≈ ${fmt(L.dk, L.dk < 1 ? 2 : 1)} cm` : reg === "rays" ? "qorong‘i soha butun trubkani egalladi" : "", reg === "rays" ? "green" : tube.burning ? "purple" : "");
    setRO("r6", "Molekulaning erkin yugurish yo‘li <i>λ</i>", (() => { const l = 0.005 / tube.p; return l >= 1 ? u(fmt(l, l >= 10 ? 0 : 1), "cm") : l >= 1e-3 ? u(fmt(l * 10, l >= 0.1 ? 1 : 3), "mm") : u(fmt(l * 1e4, 2), "μm"); })(), "havoda λ ≈ 5·10⁻³ cm / p; elektronniki ~6 marta uzun");
  } else if (k === "spark") {
    const Vb = sparkVb(), W = 0.5 * sparkC() * Vb * Vb;
    setRO("r1", "Bankalardagi kuchlanish <i>U</i>", uU(spark.U), `mashina chegarasi ${fmt(SPARK_UMAX / 1000, 0)} kV (sizib ketish)`);
    setRO("r2", "Teshilish kuchlanishi <i>U</i>ₜ", uU(Vb), `o‘rtacha maydon ${fmt(Vb / 1000 / spark.d, 1)} kV/cm`, Vb < SPARK_UMAX ? "red" : "");
    setRO("r3", "Sharlar oralig‘i <i>d</i>", u(fmt(spark.d, 1), "cm"), Vb >= SPARK_UMAX ? "uchqun chiqmaydi — oraliq juda katta" : "havo 760 mm sim. ust.");
    setRO("r4", "Uchqunlar", u(String(spark.count), "ta"), spark.period && Vb < SPARK_UMAX ? `har ${fmt(spark.period, 2)} s da bittadan` : "—", "purple");
    setRO("r5", "Uchqun energiyasi <i>W</i> = <i>CU</i>ₜ²/2", W >= 0.1 ? u(fmt(W, 2), "J") : u(fmt(W * 1000, 0), "mJ"), `C = ${fmt(sparkC() * 1e12, 0)} pF`, "orange");
    setRO("r6", "Disklar tezligi", u(fmt(spark.w, 1), "ayl/s"), spark.w > 0 ? "zaryadlash tezligi ∝ aylanish" : "mashina to‘xtagan");
  } else if (k === "arc") {
    const st = arcState(), p = arcPt();
    setRO("r1", "Tok <i>I</i>", u(fmt(st.I, 1), "A"), st.mode === "short" ? "qisqa tutashuv: I = E/R" : st.mode === "arc" ? "ampermetr" : "zanjir uzilgan", st.mode === "short" ? "red" : "blue");
    setRO("r2", "Yoydagi kuchlanish <i>U</i>", st.mode === "off" ? "—" : u(fmt(st.U, 1), "V"), st.mode === "arc" ? `U = ${fmt(38.9 + 2.07 * arc.d, 1)} + ${fmt(11.7 + 10.5 * arc.d, 1)}/I` : "");
    setRO("r3", "Yoy quvvati <i>P</i> = <i>UI</i>", st.mode === "arc" ? u(fmt(st.U * st.I, 0), "W") : "—", st.mode === "arc" ? `reostatda ${fmt(st.I * st.I * arc.R, 0)} W` : "", "orange");
    setRO("r4", "Ko‘mirlar oralig‘i <i>d</i>", u(fmt(arc.d, 1), "mm"), `so‘nish chegarasi ≈ ${fmt(P.arcMaxGap(ARC_E, arc.R), 1)} mm`);
    setRO("r5", "Differensial qarshilik d<i>U</i>/d<i>I</i>", p ? u(fmt(-(11.7 + 10.5 * arc.d) / (p.I * p.I), 2), "Ω") : "—", p ? "manfiy: tok ortsa, kuchlanish kamayadi" : "", p ? "purple" : "");
    setRO("r6", "Anod krateri temperaturasi", st.mode === "arc" ? u("~3900", "K") : "—", st.mode === "arc" ? "katod ~3200 K; ko‘mir 4000 K atrofida bug‘lanadi" : "yoy yonmagan", st.mode === "arc" ? "red" : "");
  } else {
    const Es = corEs(), Ec = corEc(), Uc = corUc(), on = Es > Ec;
    setRO("r1", "Sim kuchlanishi <i>U</i>", u(fmt(cor.U, 0), "kV"), `liniya ${fmt(cor.U * Math.sqrt(3), 0)} kV (fazalararo)`);
    setRO("r2", "Sim sirtidagi maydon <i>E</i>", u(fmt(Es, 1), "kV/cm"), `E = U/(r·ln(2h/r)), h = ${H_LINE / 100} m`, on ? "purple" : "");
    setRO("r3", "Toj chegarasi <i>E</i>ₖ (Pik)", u(fmt(Ec, 1), "kV/cm"), `m = ${fmt(cor.m, 2)}; ingichka simda katta, lekin maydon undan tez ortadi`);
    setRO("r4", "Toj boshlanish kuchlanishi <i>U</i>ₖ", u(fmt(Uc, 0), "kV"), on ? "toj yonmoqda" : `${fmt(Uc - cor.U, 0)} kV zaxira`, on ? "red" : "green");
    setRO("r5", "Toj razryad", on ? "bor" : "yo‘q", on ? `toj toki ∝ U(U − Uₖ) = ${fmt(P.coronaI(cor.U, Uc) / 1000, 1)}·10³ (nisbiy)` : "isrof yo‘q", on ? "purple" : "green");
    setRO("r6", "Sim radiusi <i>r</i>", u(fmt(cor.r * 10, 1), "mm"), `diametri ${fmt(cor.r * 20, 0)} mm`);
  }
}
let flashUntil = 0;
function flashStatus(t) { const el = $("[data-status]"); el.textContent = t; el.dataset.tone = "red"; flashUntil = Date.now() + 2200; }
function updateStatus() {
  if (flashUntil > Date.now()) return;
  const el = $("[data-status]"), k = gkey(); let t, tone = "blue";
  if (k === "ion") { const st = ionState(); [t, tone] = ION_REG[st.regime]; t = `${t[0].toUpperCase()}${t.slice(1)}`; if (ion.src === "none" && st.regime !== "spark") { t = "Havo deyarli izolyator — tok sezilmaydi"; tone = ""; } }
  else if (k === "tube") { const reg = tubeRegime(); t = `${REGIME[reg][0].toUpperCase()}${REGIME[reg].slice(1)}`; tone = tube.burning ? (reg === "rays" ? "green" : "purple") : ""; }
  else if (k === "spark") { const ok = sparkVb() < SPARK_UMAX; t = !ok ? "Oraliq juda katta — uchqun chiqmaydi" : spark.w <= 0 ? "Mashina to‘xtagan" : spark.flash > 0 ? "Uchqun!" : "Bankalar zaryadlanmoqda"; tone = spark.flash > 0 ? "red" : ok ? "orange" : ""; }
  else if (k === "arc") { const st = arcState(); t = st.mode === "arc" ? "Elektr yoyi yonmoqda" : st.mode === "short" ? "Ko‘mirlar tutashgan — endi sekin uzoqlashtiring" : arc.out ? "Yoy so‘ndi — qayta tutashtiring" : "Tok yo‘q — ko‘mirlarni tutashtiring"; tone = st.mode === "arc" ? "orange" : st.mode === "short" ? "red" : ""; }
  else { const on = corEs() > corEc(); t = on ? "Toj razryad: sim atrofida havo ionlashmoqda" : "Toj yo‘q"; tone = on ? "purple" : "green"; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [], k = gkey();
  if (k === "ion") {
    const st = ionState();
    p.push("<p>Odatdagi havoda erkin zaryadlar juda kam — u yaxshi izolyator. <b>Ionlagich</b> (alanga, ultrabinafsha yoki rentgen nurlari) molekulalardan elektron urib chiqaradi: musbat ion va elektron (u tezda neytral molekulaga yopishib, manfiy ion hosil qiladi) juftlari paydo bo‘ladi. Ular bir-biri bilan uchrashsa, yana neytral molekulaga birlashadi — <b>rekombinatsiya</b>.</p>");
    if (st.regime === "ohm") p.push("<p>Kuchlanish kichik: ionlarning ko‘pchiligi plastinkalarga yetguncha rekombinatsiyalanadi. Tok kuchlanishga proporsional — gaz Om qonuniga bo‘ysunadi. Kuchlanishni oshiring.</p>");
    else if (st.regime === "sat") p.push(`<p><b>To‘yinish</b>: 1 sekundda hosil bo‘lgan barcha ionlar plastinkalarga yetib bormoqda, shuning uchun kuchlanishni oshirish tokni oshirmaydi: Iₛ = eqSd. Ionlagichni o‘chirsangiz, tok yo‘qoladi — bu <b>mustaqil bo‘lmagan razryad</b>.</p>`);
    else if (st.regime === "town") p.push(`<p>Maydon kuchli (${fmt(st.E / 1e5, 1)} kV/cm): elektron erkin yugurish yo‘lida ionlash energiyasini to‘playdi va molekulalarni urib ionlaydi — <b>elektron ko‘chkisi</b>. Tok ${Number.isFinite(st.M) ? fmt(st.M, 1) : "∞"} marta ortdi, lekin ionlagich o‘chsa, hali ham to‘xtaydi.</p>`);
    else p.push(`<p><b>Mustaqil razryad</b>: musbat ionlar katoddan yangi elektronlar urib chiqara boshladi (γ-jarayon) va razryad tashqi ionlagichsiz o‘zini o‘zi ta’minlaydi. Atmosfera bosimida bu — <b>uchqun</b>. Havo ${fmt(ionUb() / 1000 / ion.d, 0)} kV/cm atrofida teshiladi.</p>`);
  } else if (k === "tube") {
    const reg = tubeRegime(), L = P.glowLayout(tube.p, TUBE_L);
    p.push(`<p>Trubkadagi gaz bosimi kamaygan sari elektronlarning erkin yugurish yo‘li uzayadi va teshilish kuchlanishi kamayadi (<b>Pashen qonuni</b>: U<sub>t</sub> faqat p·d ga bog‘liq). Atmosfera bosimida 40 cm oraliqni yuzlab kilovolt ham teshmaydi, ${fmt(tube.p >= 1 ? tube.p : 1, 0)} mm sim. ust. atrofida esa ${fU(P.tubeBreakdown(gas(), Math.max(1, tube.p), TUBE_L))} yetadi.</p>`);
    if (reg === "cord" || reg === "spark") p.push("<p>Bosim hali katta: razryad ingichka, tebranib turuvchi kanal (shnur) ko‘rinishida. Havoni so‘rishda davom eting — kanal kengayib, trubkani to‘ldiradi.</p>");
    if (reg === "glow" || reg === "striae") p.push(`<p><b>Tlejli razryad</b>: katod yonida qorong‘i soha (${fmt(L.dk, 2)} cm) — bu yerda ionlar katodga urilib elektron urib chiqaradi va elektronlar tezlanadi; so‘ng yorqin manfiy shu’la, Faradey qorong‘i sohasi va trubkaning qolgan qismini to‘ldiruvchi <b>musbat ustun</b>. Ustun rangi gazga bog‘liq: ${gas().name.toLowerCase()} — reklama trubkalari shunga asoslangan.${reg === "striae" ? " Ustun qatlamlarga (strata) bo‘lingan: elektronlar energiya to‘plab, ma’lum masofada molekulalarni uyg‘otadi." : ""}</p>`);
    if (reg === "rays") p.push("<p>Bosim juda past: katod qorong‘i sohasi butun trubkani egalladi. Katoddan uchib chiqqan tez elektronlar — <b>katod nurlari</b> — gazga deyarli urilmay anod tomondagi shishaga uriladi va uni yashil shu’lalantiradi. Kineskop va rentgen trubkalari shu hodisadan boshlangan (J. Tomson elektronni shunday kashf etgan).</p>");
    if (reg === "vacuum") p.push("<p>Yuqori vakuum: ionlanadigan molekulalar deyarli qolmadi, razryad o‘chdi. Vakuumda tok faqat elektrodning o‘zi elektron chiqarganda (qizdirilgan katod — termoelektron emissiya) o‘tadi.</p>");
    if (reg === "none" && tube.p > 1) p.push("<p>Manba kuchlanishi teshilish uchun yetmaydi. Nasosni yoqing yoki kuchlanishni oshiring. Diqqat: razryad boshlangandan keyin uni ushlab turish uchun kamroq kuchlanish yetadi (so‘nish kuchlanishi ~0,4·Uₜ).</p>");
  } else if (k === "spark") {
    p.push("<p><b>Uchqun razryad</b> — atmosfera bosimida havoning qisqa muddatli teshilishi. Elektrofor mashinasining disklari aylanganda induksiya orqali zaryadlar ajraladi va Leyden bankalariga (kondensatorlarga) yig‘iladi. Kuchlanish teshilish qiymatiga yetganda sharlar orasida tor, yorqin, egri-bugri ionlashgan kanal hosil bo‘ladi va bankalar bir zumda razryadlanadi — chirsillagan ovoz eshitiladi (havo keskin qizib kengayadi).</p>");
    p.push("<p><b>Chaqmoq</b> — bulut va yer orasidagi ulkan uchqun: kuchlanish yuz millionlab volt, tok o‘n minglab amper. Momaqaldiroq — kanal havosining portlashsimon kengayishi.</p>");
  } else if (k === "arc") {
    p.push("<p><b>Elektr yoyi</b>ni 1802-yilda V. V. Petrov kashf etgan. Ko‘mirlar tutashtirilganda katta tok ularning uchini qizdiradi; ajratilganda qizigan katoddan <b>termoelektron emissiya</b> boshlanadi va oraliqdagi gaz ionlashadi. Kuchlanish atigi 40–60 V, tok esa o‘nlab amper; anod krateri ~3900 K gacha qiziydi — juda yorqin nur.</p>");
    p.push(`<p>Yoyning xarakteristikasi tushuvchi: tok ortsa, kuchlanish kamayadi. Ballast qarshilik bo‘lmasa, tok cheksiz ortib ketardi. Oraliqni kattalashtiring: ~${fmt(P.arcMaxGap(ARC_E, arc.R), 1)} mm dan keyin yuklama chizig‘i yoy egri chizig‘iga tegmay qoladi va yoy so‘nadi. Yoy payvandlashda, metall eritishda va projektorlarda ishlatiladi.</p>`);
  } else {
    p.push("<p><b>Toj razryad</b> keskin bir jinsli bo‘lmagan maydonda — ingichka sim, o‘tkir uch atrofida — paydo bo‘ladi. Faqat sirtga yaqin yupqa qatlamda maydon havoni ionlashga yetadi: binafsha shu’la, vizillash va ozon hidi. Kanal elektrodlarni tutashtirmaydi, shuning uchun bu uchqun emas.</p>");
    p.push("<p>Yuqori kuchlanishli liniyalarda toj energiya isrofi va radioto‘siq beradi, ayniqsa yomg‘ir va tumanda. Shuning uchun 330 kV dan yuqori liniyalarda har faza 2–4 ta simga ajratiladi. Chaqmoq qaytargich va «Avliyo Elm olovi» (kema machtalaridagi shu’la) ham toj razryadning ko‘rinishi.</p>");
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
const FORMULA = { ion: "<small>To‘yinish toki</small> Iₛ = eqSd", tube: "<small>Pashen qonuni</small> Uₜ = f(pd)", spark: "<small>Havo teshilishi</small> E ≈ 30 kV/cm", arc: "<small>Elektr yoyi</small> U = a + bd + (c + ed)/I", corona: "<small>Pik qonuni</small> Eₖ = 30m(1 + 0,301/√r)" };
function updateFormula() { const f = $("[data-formula]"), html = FORMULA[gkey()]; if (f.innerHTML !== html) f.innerHTML = html; }
function syncTools() {
  $("[data-pump]").textContent = tube.pump ? "Nasosni o‘chirish" : "Nasosni yoqish"; $("[data-pump]").setAttribute("aria-pressed", String(tube.pump));
  $("[data-vent]").setAttribute("aria-pressed", String(tube.vent));
  const tb = $("[data-touch]"); tb.hidden = !(ui.mode === "types" && ui.kind === "arc"); tb.textContent = arc.d > 0 ? "Ko‘mirlarni tutashtirish" : "Ko‘mirlarni ajratish (2 mm)";
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); syncTools(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  dt = Math.min(dt, 0.05); anim += dt;
  if (ui.mode === "ion") stepIon(dt);
  else if (ui.mode === "tube") stepTube(dt);
  else if (ui.kind === "spark") stepSpark(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.12) { uiTimer = 0; updateReadouts(); updateStatus(); updateExplain(); syncTools(); if (ui.mode === "tube" || ui.kind === "spark") graph.render(); }
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
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || modeDefault(), false));

/* ------------------------------------------------------------------ Boshqaruv */

const srcSel = $("#iSrc");
srcSel.innerHTML = Object.entries(P.IONIZERS).map(([id, z]) => `<option value="${id}">${z.name}</option>`).join("");
srcSel.addEventListener("change", () => { ion.src = srcSel.value; ion.parts = []; customized(); refresh(); });
const IUC = bindRange($("#iU"), $("#iUOut"), (v) => fU(uFromPos(v)), (v) => { ion.U = uFromPos(v); customized(); refresh(); });
const IDC = bindRange($("#iD"), $("#iDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { ion.d = v; ion.parts = []; customized(); refresh(); });
function syncIon() { srcSel.value = ion.src; IUC.set(posFromU(ion.U)); $("#iUOut").textContent = fU(ion.U); IDC.set(ion.d); }

const gasSel = $("#tGas");
gasSel.innerHTML = Object.entries(P.GASES).map(([id, g]) => `<option value="${id}">${g.name}</option>`).join("");
gasSel.addEventListener("change", () => { tube.gas = gasSel.value; tube.burning = false; updateBurning(); customized(); refresh(); });
const PC = bindRange($("#tP"), $("#tPOut"), (v) => `${fP(pFromPos(v))} mm`, (v) => { tube.p = pFromPos(v); tube.vent = false; updateBurning(); customized(); refresh(); });
const TUC = bindRange($("#tU"), $("#tUOut"), (v) => `${fmt(v, 1)} kV`, (v) => { tube.U = v * 1000; updateBurning(); customized(); refresh(); });
function syncTube() { gasSel.value = tube.gas; PC.set(posFromP(tube.p)); $("#tPOut").textContent = `${fP(tube.p)} mm`; TUC.set(tube.U / 1000); }
$("[data-pump]").addEventListener("click", () => { tube.pump = !tube.pump; if (tube.pump) tube.vent = false; customized(); refresh(); if (!prefersReducedMotion()) loop.start(); });
$("[data-vent]").addEventListener("click", () => { tube.vent = !tube.vent; if (tube.vent) tube.pump = false; customized(); refresh(); if (!prefersReducedMotion()) loop.start(); });

const SDC = bindRange($("#sD"), $("#sDOut"), (v) => `${fmt(v, 1)} cm`, (v) => { spark.d = v; customized(); refresh(); });
const SWC = bindRange($("#sW"), $("#sWOut"), (v) => `${fmt(v, 1)} ayl/s`, (v) => { spark.w = v; customized(); refresh(); });
const jarSel = $("#sC");
jarSel.addEventListener("change", () => { spark.jars = jarSel.value === "on"; customized(); refresh(); });
const ARC = bindRange($("#aR"), $("#aROut"), (v) => `${fmt(v, 1)} Ω`, (v) => { arc.R = v; setArcGap(arc.d); customized(); refresh(); });
const ADC = bindRange($("#aD"), $("#aDOut"), (v) => `${fmt(v, 1)} mm`, (v) => { setArcGap(v); customized(); refresh(); });
$("[data-touch]").addEventListener("click", () => { setArcGap(arc.d > 0 ? 0 : 2); ADC.set(arc.d); customized(); refresh(); });
const CUC = bindRange($("#cU"), $("#cUOut"), (v) => `${fmt(v, 0)} kV`, (v) => { cor.U = v; customized(); refresh(); });
const CRC = bindRange($("#cR"), $("#cROut"), (v) => `${fmt(v * 10, 1)} mm`, (v) => { cor.r = v; customized(); refresh(); });
const mSel = $("#cM");
mSel.addEventListener("change", () => { cor.m = Number(mSel.value); customized(); refresh(); });
function syncTypes() {
  SDC.set(spark.d); SWC.set(spark.w); jarSel.value = spark.jars ? "on" : "off"; ARC.set(arc.R); ADC.set(arc.d); CUC.set(cor.U); CRC.set(cor.r); mSel.value = String(cor.m);
  document.querySelectorAll("[data-kind-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kindValue === ui.kind)));
  document.querySelectorAll("[data-kctl]").forEach((el) => { el.hidden = el.dataset.kctl !== ui.kind; });
}
const KIND_DEFAULT = { spark: "spark1", arc: "arc1", corona: "corona1" };
document.querySelectorAll("[data-kind-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.kindValue !== ui.kind) loadPreset(KIND_DEFAULT[b.dataset.kindValue]); }));

/* ------------------------------------------------------------------ Sahnada boshqarish */

const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); };
function hitTest(p) {
  if (ui.mode !== "types" && hits.knob && dist(p.x, p.y, hits.knob.x, hits.knob.y) <= hits.knob.r + 4) return { k: "knob" };
  if (ui.mode === "tube") {
    if (dist(p.x, p.y, hits.valve.x, hits.valve.y) <= hits.valve.r) return { k: "valve" };
    const b = hits.pump; if (b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return { k: "pump" };
  }
  if (ui.mode === "types" && ui.kind === "spark" && hits.ball && dist(p.x, p.y, hits.ball.x, hits.ball.y) <= hits.ball.r) return { k: "ball" };
  if (ui.mode === "types" && ui.kind === "arc" && hits.rod && Math.abs(p.y - hits.rod.y) <= 16 && Math.abs(p.x - hits.rod.x) <= hits.rod.w / 2) return { k: "rod" };
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  e.preventDefault();
  if (h.k === "valve") return $("[data-vent]").click();
  if (h.k === "pump") return $("[data-pump]").click();
  drag = { ...h, x0: p.x, y0: p.y, v0: ui.mode === "ion" ? posFromU(ion.U) : ui.mode === "tube" ? tube.U : 0, d0: ui.kind === "spark" ? spark.d : arc.d };
  canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
});
function onDrag(p) {
  if (drag.k === "knob" && ui.mode === "ion") { ion.U = uFromPos(clamp(drag.v0 + (drag.y0 - p.y) * 6, 0, 1000)); if (drag.v0 + (drag.y0 - p.y) * 6 <= 0) ion.U = 0; syncIon(); }
  else if (drag.k === "knob") { tube.U = clamp(Math.round(drag.v0 + (drag.y0 - p.y) * 120), 0, 15000); updateBurning(); TUC.set(tube.U / 1000); }
  else if (drag.k === "ball") { spark.d = clamp(Math.round((drag.d0 + ((p.x - drag.x0) * 2) / GAP_PX) * 10) / 10, 0.2, 4); SDC.set(spark.d); }
  else if (drag.k === "rod") { setArcGap(clamp(Math.round((drag.d0 + (p.x - drag.x0) / 6) * 10) / 10, 0, 12)); ADC.set(arc.d); }
  customized(); refresh();
}
const CURSOR = { knob: "ns-resize", valve: "pointer", pump: "pointer", ball: "ew-resize", rod: "ew-resize" };
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? CURSOR[h.k] : ""; return; } onDrag(p); });
function endDrag() { if (!drag) return; drag = null; canvas.dataset.dragging = "false"; refresh(); }
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const setIon = (src, U, d = 1, view = "lin") => () => { Object.assign(ion, { src, U, d, parts: [], spark: 0 }); ui.view.ion = view; };
const setTube = (g, p, U, pump = false) => () => { Object.assign(tube, { gas: g, p, U, pump, vent: false, burning: false }); updateBurning(); };
const setSpark = (d, w, jars, view = "t") => () => { Object.assign(spark, { d, w, jars, U: 0, t: 0, hist: [], histT: 0, flash: 0, count: 0, lastT: null, period: null }); ui.kind = "spark"; ui.view.spark = view; };
const setArc = (R, d) => () => { Object.assign(arc, { R, d: 0, on: false, out: false }); setArcGap(d); ui.kind = "arc"; };
const setCor = (U, r, m) => () => { Object.assign(cor, { U, r, m }); ui.kind = "corona"; };
const PRESETS = {
  none: { mode: "ion", title: "Havo — izolyator", lesson: "Ionlagich yo‘q: kosmik nurlar havoda 1 cm³ da sekundiga atigi ~10 juft ion hosil qiladi. Galvanometr hech narsa sezmaydi. Ionlagichni tanlang.", set: setIon("none", 1000) },
  flame: { mode: "ion", title: "Alanga: Om sohasi", lesson: "Spirt lampa alangasi plastinkalar orasidagi havoni ionlaydi. U = 10 V da tok kuchlanishga proporsional. Kuchlanishni 100–200 V gacha oshirib, tok to‘yinishini kuzating.", set: setIon("flame", 10) },
  sat: { mode: "ion", title: "To‘yinish toki", lesson: "Rentgen nurlari, U = 1 kV: barcha ionlar plastinkalarga yetadi, tok to‘yingan. Kuchlanishni ikki marta oshiring — tok deyarli o‘zgarmaydi. Endi ionlagichni almashtiring.", set: setIon("xray", 1000) },
  uv: { mode: "ion", title: "Ultrabinafsha nurlar", lesson: "Ultrabinafsha nurlar kuchsizroq ionlaydi: to‘yinish toki pikoamperlarda. Ionlagich quvvati tokni belgilaydi — dozimetrlar shu tamoyilda ishlaydi.", set: setIon("uv", 100) },
  town: { mode: "ion", title: "Zarbli ionlanish", lesson: "U = 33 kV, E = 33 kV/cm: elektronlar molekulalarni urib ionlaydi, ko‘chkilar paydo bo‘ldi — tok to‘yinish tokidan o‘nlab marta katta. «lg I(U)» grafigini oching.", set: setIon("xray", 33000, 1, "log") },
  spark: { mode: "ion", title: "Teshilish — uchqun", lesson: "U teshilish kuchlanishidan katta: razryad mustaqil bo‘ldi — plastinkalar orasida uchqunlar sakraydi. Ionlagichni o‘chirib ko‘ring: uchqun davom etadi.", set: setIon("xray", 37000, 1, "log") },
  atm: { mode: "tube", title: "Atmosfera bosimida", lesson: "Trubkada havo, 760 mm sim. ust., U = 12 kV: razryad yo‘q — 40 cm havo oralig‘ini teshish uchun ~1 MV kerak. Nasosni yoqing.", set: setTube("air", 760, 12000) },
  pumpdown: { mode: "tube", title: "Havoni so‘rib olish", lesson: "Nasos ishlamoqda. Bosim kamaygan sari: avval ingichka shnur, keyin trubkani to‘ldiruvchi tlejli razryad, qatlamlar va nihoyat katod nurlari (yashil shisha). Pashen grafigida nuqtani kuzating.", set: setTube("air", 760, 12000, true) },
  glow: { mode: "tube", title: "Tlejli razryad", lesson: "p = 1 mm sim. ust.: trubka pushti musbat ustun bilan to‘lgan, katod yonida qorong‘i soha va ko‘kish manfiy shu’la. Bosimni kamaytirib, qorong‘i sohaning kengayishini kuzating.", set: setTube("air", 1, 6000) },
  striae: { mode: "tube", title: "Qatlamli ustun", lesson: "p = 0,3 mm sim. ust.: musbat ustun yorug‘ va qorong‘i qatlamlarga bo‘lingan. Qatlamlar oralig‘i bosim kamaysa kattalashadi.", set: setTube("air", 0.3, 5000) },
  rays: { mode: "tube", title: "Katod nurlari", lesson: "p = 0,005 mm sim. ust.: gaz shu’lasi deyarli yo‘q, anod tomondagi shisha yashil yonadi — unga katoddan uchgan elektronlar uriladi.", set: setTube("air", 0.005, 12000) },
  neon: { mode: "tube", title: "Neon (reklama)", lesson: "Neon to‘ldirilgan trubka 2,5 mm sim. ust. da: to‘q sariq-qizil ustun, havoga qaraganda ancha kichik kuchlanishda yonadi. Argon va geliyni ham tanlab ko‘ring.", set: setTube("ne", 2.5, 6000) },
  spark1: { mode: "types", title: "Uchqun (elektrofor mashinasi)", lesson: "Disklar aylanmoqda, Leyden bankalari zaryadlanmoqda: ~50 kV da 1,5 cm havo teshiladi. O‘ng sharni suring — oraliq kattalashsa, uchqunlar kamayadi.", set: setSpark(1.5, 1.5, true) },
  sparkThin: { mode: "types", title: "Bankalarsiz — mayda uchqunlar", lesson: "Leyden bankalari ajratilgan: sig‘im 20 marta kichik — uchqunlar tez-tez, lekin ingichka va kuchsiz (energiya CU²/2).", set: setSpark(0.8, 1.5, false) },
  arc1: { mode: "types", title: "Elektr yoyi", lesson: "Ko‘mirlar 3 mm oraliqda, yoy yonmoqda: I ≈ 12 A, U ≈ 49 V. O‘ng ko‘mirni sekin uzoqlashtiring — tok kamayadi, kuchlanish ortadi va ~6,5 mm da yoy so‘nadi.", set: setArc(5, 3) },
  arcR: { mode: "types", title: "Ballast qarshilik", lesson: "R = 2 Ω: tok katta (~30 A), yoyni ancha uzoqqa cho‘zish mumkin. Reostatni oshirib boring — so‘nish chegarasi qisqaradi. U(I) grafigida yuklama chizig‘i qiyaligi o‘zgaradi.", set: setArc(2, 5) },
  corona1: { mode: "types", title: "Toj razryad (ingichka sim)", lesson: "150 kV ostidagi 3 mm radiusli simda sirt maydoni Pik chegarasidan katta — sim atrofida binafsha toj. Radiusni oshiring: maydon kamayadi va toj yo‘qoladi.", set: setCor(150, 0.3, 1) },
  line: { mode: "types", title: "220 kV liniya simi", lesson: "Haqiqiy 220 kV liniya: fazada 127 kV, sim radiusi 14 mm. Sirt maydoni chegaradan ancha kichik — toj yo‘q. Shuning uchun liniyalar yo‘g‘on sim bilan quriladi.", set: setCor(127, 1.4, 0.85) },
  rain: { mode: "types", title: "Yomg‘irda toj", lesson: "Quruq havoda 200 kV dagi 8 mm simda toj yo‘q. «Yomg‘ir»ni tanlang: tomchilar sirtni g‘adir-budur qiladi (m kamayadi) va toj boshlanadi.", set: setCor(200, 0.8, 0.85) },
};
const GROUPS = [["Ionlash kamerasi", ["none", "flame", "sat", "uv", "town", "spark"]], ["Razryad trubkasi", ["atm", "pumpdown", "glow", "striae", "rays", "neon"]], ["Razryad turlari", ["spark1", "sparkThin", "arc1", "arcR", "corona1", "line", "rain"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { ion: "Manba dastasini yuqoriga-pastga suring", tube: "Nasosni yoki klapanni bosing", spark: "O‘ng sharni suring", arc: "O‘ng ko‘mirni suring", corona: "Kuchlanish va sim radiusini o‘zgartiring" };
function setModeUI() {
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = el.dataset.tool !== ui.mode; });
  $("[data-mode-hint]").textContent = MODE_HINT[gkey()];
  setTabs();
}
const MODE_DEFAULT = { ion: "sat", tube: "pumpdown" };
const modeDefault = () => (ui.mode === "types" ? KIND_DEFAULT[ui.kind] : MODE_DEFAULT[ui.mode]);
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset(b.dataset.modeValue === "types" ? KIND_DEFAULT[ui.kind] : MODE_DEFAULT[b.dataset.modeValue]); }));
function loadPreset(id, mark = true) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; ui.hover = null; flashUntil = 0;
  p.set();
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncIon(); syncTube(); syncTypes(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  if (mark) { try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ } }
}

setPlayUI(false);
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "sat");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });

// Node/Playwright tekshiruvi uchun
window.__discharge = { ion, tube, spark, arc, cor, ui, loadPreset, refresh, ionState, tubeRegime, arcState };
