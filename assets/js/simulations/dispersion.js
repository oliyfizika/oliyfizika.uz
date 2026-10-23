// ==========================================================================
// Dispersiya, kamalak va qutblanish — virtual laboratoriya (simulations/dispersion.html)
// 1) Prizmada dispersiya: oq nur spektrga ajraladi (n(λ) haqiqiy shishalar), Nyutonning ikkinchi prizmasi, bitta rangni ajratish.
// 2) Kamalak: suv tomchisida nur yo'li (1 yoki 2 ichki qaytish), nurlar to'planishi, osmondagi kamalak.
// 3) Qutblanish: polyaroidlar (Malyus qonuni, lab), uchinchi polyaroid; qaytishda qutblanish va Bryuster burchagi.
// Fizika: dispersion-physics.js, reflection-physics.js (Node'da tekshirilgan). Grafiklar: dispersion-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./dispersion-physics.js";
import * as R from "./reflection-physics.js";
import { waveRGB } from "./diffraction-physics.js";
import * as G from "./dispersion-plots.js";
import { drawFresnel } from "./reflection-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = P.DEG;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const css = (c, a = 1) => `rgba(${Math.round(255 * c[0])},${Math.round(255 * c[1])},${Math.round(255 * c[2])},${a})`;
const LAMS = Array.from({ length: 31 }, (_, k) => 400 + k * 10);

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "prism", tab: "dev", t: 0, show: { newton: false, mono: false, fan: true } };
const pr = { g: "crown", A: 60, alpha: 50, lam: 580 };
const rb = { k: 1, b: 0.86 };
const pol = { sub: "malus", a1: 0, a2: 45, a3: 30, mid: false, alpha: 40, n: 1.5, phi: 90, pts: [] };
let presetId = null;
const subKey = () => (ui.mode === "pol" ? pol.sub : ui.mode);

/* ------------------------------------------------------------------ Dunyo → ekran */

const view = { s: 1, ox: 0, oy: 0, x0: 0, y1: 0 };
function fit(cw, ch, x0, x1, y0, y1, pad = 8) {
  const s = Math.min((cw - 2 * pad) / (x1 - x0), (ch - 2 * pad) / (y1 - y0));
  view.s = s; view.ox = (cw - (x1 - x0) * s) / 2; view.oy = (ch - (y1 - y0) * s) / 2; view.x0 = x0; view.y1 = y1;
}
const SX = (x) => view.ox + (x - view.x0) * view.s;
const SY = (y) => view.oy + (view.y1 - y) * view.s;
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s + view.x0, y: view.y1 - (py - view.oy) / view.s });

/* ================================================================== 1) Prizma */

const SCREEN_X = 33;
function prismGeom() {
  const base = R.prismShape(pr.A, 14, 1.5);
  const mid = { x: (base.apex.x + base.L.x) / 2, y: (base.apex.y + base.L.y) / 2 };
  const fx = base.L.x - base.apex.x, fy = base.L.y - base.apex.y, fl = Math.hypot(fx, fy);
  let nx = -fy / fl, ny = fx / fl; if (nx > 0) { nx = -nx; ny = -ny; }
  const cA = Math.cos(pr.alpha * DEG), sA = Math.sin(pr.alpha * DEG), inw = { x: -nx, y: -ny };
  const dir = { x: inw.x * cA - inw.y * sA, y: inw.x * sA + inw.y * cA };
  return { base, mid, dir, src: { x: mid.x - dir.x * 14, y: mid.y - dir.y * 14 } };
}
/** Nyutonning ikkinchi prizmasi: birinchisining 180° burilgan nusxasi, o'rtacha chiqish nuri bo'ylab siljitilgan. */
function secondPrism(n, geo) {
  const g = P.glass(pr.g), t0 = R.trace([R.prismShape(pr.A, 14, P.nOf(g, 550))], geo.src, geo.dir, { maxDepth: 4, minI: 0.5 });
  const segs = t0.segs.filter((s) => s.main), last = segs[segs.length - 1];
  const d = { x: last.b.x - last.a.x, y: last.b.y - last.a.y }, l = Math.hypot(d.x, d.y) || 1;
  const c = { x: last.a.x + (d.x / l) * 15, y: last.a.y + (d.y / l) * 15 };
  const b = geo.base, cen = { x: (b.apex.x + b.L.x + b.R.x) / 3, y: (b.apex.y + b.L.y + b.R.y) / 3 };
  // birinchi prizmaning 180° ga burilgan nusxasi (yoqlari parallel), markazi o'rtacha nur ustida
  const pts = [b.apex, b.L, b.R].map((p) => ({ x: c.x - (p.x - cen.x), y: c.y - (p.y - cen.y) }));
  return { n, edges: pts.map((p, i) => ({ a: p, b: pts[(i + 1) % 3] })), pts };
}
function drawPrism(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  fit(cw, ch, -17, 36, -15, 10);
  ctx.fillStyle = c.dark ? "#020617" : "#0f172a"; ctx.fillRect(0, 0, cw, ch);
  const geo = prismGeom(), g = P.glass(pr.g);
  const slitX = 16;
  const hits = [];
  // prizmalar
  const drawPoly = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(SX(p.x), SY(p.y)) : ctx.moveTo(SX(p.x), SY(p.y)))); ctx.closePath(); ctx.fillStyle = "rgba(186,230,253,0.12)"; ctx.fill(); ctx.strokeStyle = "rgba(186,230,253,0.7)"; ctx.lineWidth = 1.5; ctx.stroke(); };
  drawPoly([geo.base.apex, geo.base.L, geo.base.R]);
  let p2pts = null;
  if (ui.show.newton) { p2pts = secondPrism(1.5, geo).pts; drawPoly(p2pts); }
  // tushuvchi oq nur
  ctx.save(); ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 3; ctx.shadowColor = "#fff"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(SX(geo.src.x), SY(geo.src.y)); ctx.lineTo(SX(geo.mid.x), SY(geo.mid.y)); ctx.stroke(); ctx.restore();
  // har bir to'lqin uzunligi
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const lams = LAMS;
  lams.forEach((l) => {
    const n = P.nOf(g, l), shapes = [R.prismShape(pr.A, 14, n)];
    if (ui.show.newton) { const s2 = secondPrism(n, geo); shapes.push(s2); }
    const tr = R.trace(shapes, geo.src, geo.dir, { maxDepth: 8, minI: 0.3, maxLen: 80 });
    const segs = tr.segs.filter((s) => s.main).slice(1); // birinchi kesma — oq tushuvchi nur
    if (!segs.length) return;
    // boshlang'ich nuqta prizma yuzasida — birinchi kesma 0 uzunlikda bo'lishi mumkin
    const col = waveRGB(l), sel = ui.show.mono && Math.abs(l - pr.lam) < 5.01;
    const blocked = ui.show.mono && !sel;
    ctx.strokeStyle = css(col, 0.55); ctx.lineWidth = 2;
    ctx.beginPath(); let first = true, stop = false;
    for (const s of segs) {
      if (stop) break;
      let a = s.a, b = s.b;
      // ekran va tirqish bilan kesish
      const limitX = blocked ? slitX : SCREEN_X;
      if (b.x > limitX && a.x < limitX) { const t = (limitX - a.x) / (b.x - a.x); b = { x: limitX, y: a.y + (b.y - a.y) * t }; stop = true; if (!blocked) hits.push({ y: b.y, col, l }); }
      if (a.x >= limitX) break;
      if (first) { ctx.moveTo(SX(a.x), SY(a.y)); first = false; }
      ctx.lineTo(SX(b.x), SY(b.y));
    }
    ctx.stroke();
  });
  ctx.restore();
  // tirqishli to'siq
  if (ui.show.mono) {
    const lsel = R.trace([R.prismShape(pr.A, 14, P.nOf(g, pr.lam))], geo.src, geo.dir, { maxDepth: 4, minI: 0.3, maxLen: 80 }).segs.filter((s) => s.main);
    let ys = null; for (const s of lsel) if (s.a.x < slitX && s.b.x >= slitX) ys = s.a.y + ((s.b.y - s.a.y) * (slitX - s.a.x)) / (s.b.x - s.a.x);
    ctx.fillStyle = "#94a3b8"; if (ys !== null) { ctx.fillRect(SX(slitX) - 3, 0, 6, SY(ys + 0.35)); ctx.fillRect(SX(slitX) - 3, SY(ys - 0.35), 6, ch); } else ctx.fillRect(SX(slitX) - 3, 0, 6, ch);
    tag(ctx, "tirqish", SX(slitX), 14, { color: "#e2e8f0", bg: "rgba(15,23,42,0.85)", align: "center", font: SMALL });
  }
  // ekran
  ctx.fillStyle = "#e2e8f0"; ctx.fillRect(SX(SCREEN_X), 0, 4, ch);
  hits.forEach((h) => { ctx.fillStyle = css(h.col, 0.9); ctx.fillRect(SX(SCREEN_X) - 6, SY(h.y) - 3, 10, 6); });
  if (hits.length > 3) {
    const ys = hits.map((h) => h.y), top = Math.max(...ys), bot = Math.min(...ys);
    const red = hits.find((h) => h.l === 700), vio = hits.find((h) => h.l === 400);
    if (red) tag(ctx, "qizil", SX(SCREEN_X) - 10, SY(red.y), { color: "#fecaca", bg: "rgba(15,23,42,0.8)", align: "right", font: SMALL });
    if (vio && Math.abs(SY(vio.y) - SY(red ? red.y : 0)) > 16) tag(ctx, "binafsha", SX(SCREEN_X) - 10, SY(vio.y), { color: "#ddd6fe", bg: "rgba(15,23,42,0.8)", align: "right", font: SMALL });
    void top; void bot;
  }
  // manba
  ctx.save(); ctx.fillStyle = "#fde047"; ctx.shadowColor = "#fde047"; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(SX(geo.src.x), SY(geo.src.y), 9, 0, TAU); ctx.fill(); ctx.restore();
  tag(ctx, `${g.name} · A = ${fmt(pr.A, 0)}°`, 10, 14, { color: "#e2e8f0", bg: "rgba(15,23,42,0.85)", font: SMALL });
  if (!hits.length && !ui.show.mono) tag(ctx, "To‘liq ichki qaytish — nur prizmadan chiqmaydi", cw / 2, ch - 16, { color: "#fecaca", bg: "rgba(15,23,42,0.85)", align: "center", font: MID });
}

/* ================================================================== 2) Kamalak */

const drop = {};
function dropPath(b, n, k) {
  const i = Math.asin(b), r = Math.asin(b / n), pts = [];
  let phi = Math.PI - i;
  pts.push(phi);
  for (let j = 0; j <= k; j++) { phi -= Math.PI - 2 * r; pts.push(phi); }
  const D = P.dropDeviation(b, n, k) * DEG;
  return { pts, out: -D };
}
function drawRainbow(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const narrow = cw < 560, sky = narrow ? 0 : cw * 0.34;
  const aw = cw - sky, cx = aw * 0.56, cy = ch * 0.5, Rr = Math.min(ch * 0.36, aw * 0.3);
  Object.assign(drop, { cx, cy, R: Rr, aw });
  ctx.fillStyle = c.dark ? "#020617" : "#0f172a"; ctx.fillRect(0, 0, aw, ch);
  // tomchi
  const gr = ctx.createRadialGradient(cx - Rr * 0.3, cy - Rr * 0.3, Rr * 0.1, cx, cy, Rr);
  gr.addColorStop(0, "rgba(186,230,253,0.25)"); gr.addColorStop(1, "rgba(56,189,248,0.12)");
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(186,230,253,0.6)"; ctx.lineWidth = 1.5; ctx.stroke();
  const W = P.glass("water"), k = rb.k;
  const P2 = (phi) => [cx + Rr * Math.cos(phi), cy - Rr * Math.sin(phi)];
  const drawRay = (b, l, alpha, width, inside = true) => {
    const n = P.nOf(W, l), path = dropPath(b, n, k), col = waveRGB(l);
    ctx.strokeStyle = css(col, alpha); ctx.lineWidth = width; ctx.beginPath();
    const p0 = P2(path.pts[0]); if (inside) { ctx.moveTo(...p0); path.pts.slice(1).forEach((ph) => ctx.lineTo(...P2(ph))); }
    const pe = P2(path.pts[path.pts.length - 1]); ctx.moveTo(...pe); ctx.lineTo(pe[0] + Math.cos(path.out) * aw * 1.2, pe[1] - Math.sin(path.out) * aw * 1.2); ctx.stroke();
  };
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, aw, ch); ctx.clip(); ctx.globalCompositeOperation = "lighter";
  if (ui.show.fan) for (let bb = 0.04; bb < 1; bb += 0.04) { [700, 550, 420].forEach((l) => drawRay(bb, l, 0.16, 1.2)); }
  // tanlangan nur
  ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 2.5; ctx.beginPath(); const p0 = P2(Math.PI - Math.asin(rb.b)); ctx.moveTo(0, p0[1]); ctx.lineTo(...p0); ctx.stroke();
  [700, 640, 590, 550, 500, 460, 420].forEach((l) => drawRay(rb.b, l, 0.85, 2));
  ctx.restore();
  // quyosh nurlari (chapdan)
  ctx.fillStyle = "rgba(253,224,71,0.9)"; ctx.font = MID; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  tag(ctx, "Quyosh nurlari →", 8, 14, { color: "#0f172a", bg: "#fde68a", font: SMALL });
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(8, p0[1], 5, 0, TAU); ctx.fill();
  tag(ctx, "suring ↕", 16, p0[1] - 14, { color: "#fde68a", bg: "rgba(15,23,42,0.8)", font: SMALL });
  tag(ctx, k === 1 ? "1 marta ichki qaytish" : "2 marta ichki qaytish", aw - 8, ch - 14, { color: "#e2e8f0", bg: "rgba(15,23,42,0.85)", align: "right", font: SMALL });
  // osmon
  if (!narrow) {
    const x0 = aw + 6, w = cw - aw - 12, h = ch - 12, y0 = 6;
    const sk = ctx.createLinearGradient(0, y0, 0, y0 + h); sk.addColorStop(0, "#1e3a8a"); sk.addColorStop(1, "#60a5fa");
    ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 8); ctx.clip(); ctx.fillStyle = sk; ctx.fillRect(x0, y0, w, h);
    const gy = y0 + h * 0.78, ax = x0 + w / 2, ay = gy + h * 0.12, sc = (h * 0.62) / 55; // antisolyar nuqta ufqdan pastda
    const band = (kk) => {
      for (let l = 400; l <= 700; l += 5) {
        const a = P.rainbowAngle(P.nOf(W, l), kk).angle, col = waveRGB(l);
        ctx.strokeStyle = css(col, kk === 1 ? 0.55 : 0.28); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(ax, ay, a * sc, Math.PI, TAU); ctx.stroke();
      }
    };
    band(1); band(2);
    ctx.fillStyle = "#166534"; ctx.fillRect(x0, gy, w, h);
    ctx.restore();
    ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(ax, gy - 10, 4, 0, TAU); ctx.fill(); ctx.fillRect(ax - 2, gy - 6, 4, 8);
    tag(ctx, "kuzatuvchi (Quyosh orqada)", ax, gy + 14, { color: "#fff", bg: "rgba(15,23,42,0.6)", align: "center", font: SMALL });
    tag(ctx, `≈${fmt(P.rainbowAngle(P.nOf(W, 650), 1).angle, 0)}°`, ax + 42 * sc * 0.7, ay - 42 * sc * 0.72, { color: "#fff", bg: "rgba(15,23,42,0.5)", font: SMALL });
    tag(ctx, `≈${fmt(P.rainbowAngle(P.nOf(W, 650), 2).angle, 0)}°`, ax + 51 * sc * 0.72 + 6, ay - 51 * sc * 0.7 - 6, { color: "#fff", bg: "rgba(15,23,42,0.5)", font: SMALL });
    ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 8); ctx.stroke();
  }
}

/* ================================================================== 3) Qutblanish */

const discs = [];
function disc(ctx, c, x, y, ang, label, I) {
  const rx = 16, ry = 46;
  ctx.save(); ctx.fillStyle = "rgba(100,116,139,0.35)"; ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.clip();
  const ux = Math.sin(ang * DEG) * rx, uy = -Math.cos(ang * DEG) * ry, px = -uy / ry * rx, py = ux / rx * ry;
  ctx.strokeStyle = "rgba(226,232,240,0.35)"; ctx.lineWidth = 1;
  for (let k = -6; k <= 6; k++) { const ox = (px * k) / 6, oy = (py * k) / 6; ctx.beginPath(); ctx.moveTo(x + ox - ux, y + oy - uy); ctx.lineTo(x + ox + ux, y + oy + uy); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - ux * 1.15, y - uy * 1.15); ctx.lineTo(x + ux * 1.15, y + uy * 1.15); ctx.stroke();
  tag(ctx, `${label}: ${fmt(ang, 0)}°`, x, y + ry + 14, { color: c.text, bg: c.bg, align: "center", font: SMALL });
  void I;
}
function efield(ctx, x0, x1, y, ang, amp, unpol, col) {
  if (amp < 0.01) return;
  const n = 14, kx = TAU / 46;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.8;
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n, s = Math.sin(kx * x - ui.t * 6);
    const angs = unpol ? [0, 60, 120].map((a) => a + ((k * 37) % 180)) : [ang];
    angs.forEach((a) => { const dx = Math.sin(a * DEG) * 16 * 0.35 * amp * s, dy = -Math.cos(a * DEG) * 40 * amp * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke(); });
  }
  ctx.restore();
}
function meter(ctx, c, x, y, I) {
  ctx.save(); ctx.fillStyle = c.bg2; ctx.strokeStyle = c.text2; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - 26, y - 36, 52, 72, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#020617"; ctx.fillRect(x - 18, y - 28, 36, 40); ctx.fillStyle = "#fde047"; const hh = 36 * clamp(I / 0.5, 0, 1); ctx.fillRect(x - 14, y + 10 - hh, 28, hh); ctx.restore();
  tag(ctx, `${fmt(I * 100, 1)}%`, x, y + 24, { color: c.text, bg: c.bg2, align: "center", font: "700 11px Inter, system-ui, sans-serif" });
  tag(ctx, "fotometr", x, y - 46, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
}
function drawMalus(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const y = ch * 0.46, xs = cw * 0.07, x1 = cw * 0.3, x2 = cw * 0.5, x3 = cw * (pol.mid ? 0.7 : 0.62), xm = cw * 0.9;
  const angles = pol.mid ? [pol.a1, pol.a2, pol.a3] : [pol.a1, pol.a3], Is = P.malusChain(angles);
  discs.length = 0;
  // nur
  const segs = pol.mid ? [[xs, x1, 1, null], [x1, x2, Is[0], pol.a1], [x2, x3, Is[1], pol.a2], [x3, xm - 26, Is[2], pol.a3]] : [[xs, x1, 1, null], [x1, x3, Is[0], pol.a1], [x3, xm - 26, Is[1], pol.a3]];
  segs.forEach(([a, b, I, ang]) => {
    ctx.fillStyle = `rgba(253,224,71,${0.08 + 0.5 * I})`; ctx.fillRect(a, y - 7, b - a, 14);
    efield(ctx, a + 10, b - 10, y, ang ?? 0, Math.sqrt(I), ang === null, "rgba(234,88,12,0.85)");
  });
  // manba
  ctx.save(); ctx.fillStyle = "#fde047"; ctx.shadowColor = "#fde047"; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(xs, y, 12, 0, TAU); ctx.fill(); ctx.restore();
  tag(ctx, "qutblanmagan yorug‘lik", xs + 4, y - 58, { color: c.text2, bg: c.bg, font: SMALL });
  disc(ctx, c, x1, y, pol.a1, cw < 560 ? "P" : "polyarizator"); discs.push({ x: x1, key: "a1" });
  if (pol.mid) { disc(ctx, c, x2, y, pol.a2, cw < 560 ? "O‘" : "o‘rtadagi"); discs.push({ x: x2, key: "a2" }); }
  disc(ctx, c, x3, y, pol.a3, cw < 560 ? "A" : "analizator"); discs.push({ x: x3, key: "a3" });
  meter(ctx, c, xm, y, Is[Is.length - 1]);
  tag(ctx, `50%`, (x1 + (pol.mid ? x2 : x3)) / 2, y + 66, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  if (pol.mid) tag(ctx, `${fmt(Is[1] * 100, 1)}%`, (x2 + x3) / 2, y + 66, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
}
const brewG = {};
function drawBrew(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const ox = cw * 0.4, oy = ch * 0.6, L = Math.min(ch * 0.5, cw * 0.32), a = pol.alpha * DEG;
  const r = R.snell(1, pol.n, pol.alpha), res = P.reflectedThroughAnalyzer(1, pol.n, pol.alpha, pol.phi);
  ctx.fillStyle = "rgba(125,211,252,0.18)"; ctx.fillRect(0, oy, cw, ch - oy); ctx.strokeStyle = c.primary; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(cw, oy); ctx.stroke();
  tag(ctx, `shisha n = ${fmt(pol.n, 2)}`, 10, ch - 14, { color: c.text, bg: c.bg2, font: SMALL });
  ctx.strokeStyle = c.text3; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(ox, oy - L); ctx.lineTo(ox, ch); ctx.stroke(); ctx.setLineDash([]);
  const src = [ox - L * Math.sin(a), oy - L * Math.cos(a)], refl = [ox + L * Math.sin(a), oy - L * Math.cos(a)];
  brewG.src = src; brewG.o = [ox, oy]; brewG.L = L;
  const ray = (p, q, w, alpha) => { ctx.strokeStyle = `rgba(250,204,21,${alpha})`; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); };
  ray(src, [ox, oy], 4, 1);
  ray([ox, oy], refl, 1 + 6 * Math.sqrt(res.R), 0.35 + 0.65 * Math.sqrt(res.R * 5));
  if (!r.tir) { const b = r.beta, end = [ox + (ch - oy) * Math.tan(b), ch]; ray([ox, oy], end, 3, 0.8); }
  // s (nuqtalar) va p (strelkalar) tashkil etuvchilar
  const comps = (p, q, sAmp, pAmp) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    for (let t = 0.3; t < 0.9; t += 0.3) {
      const x = p[0] + dx * t, y = p[1] + dy * t;
      if (pAmp > 0.03) { ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - uy * 12 * pAmp, y + ux * 12 * pAmp); ctx.lineTo(x + uy * 12 * pAmp, y - ux * 12 * pAmp); ctx.stroke(); }
      if (sAmp > 0.03) { ctx.fillStyle = "#2563eb"; ctx.beginPath(); ctx.arc(x + ux * 9, y + uy * 9, 2 + 3 * sAmp, 0, TAU); ctx.fill(); }
    }
  };
  comps(src, [ox, oy], 1, 1);
  comps([ox, oy], refl, Math.sqrt(res.Rs) * 2.2, Math.sqrt(res.Rp) * 2.2);
  // analizator va fotometr
  const ax = refl[0] + 8, ay = refl[1];
  disc(ctx, c, ax, ay + 10, pol.phi, "analizator"); brewG.disc = { x: ax, y: ay + 10 };
  meter(ctx, c, Math.min(cw - 34, ax + 70), ay + 10, res.I * 10);
  tag(ctx, "fotometr ×10", Math.min(cw - 34, ax + 70), ay + 62, { color: c.text3, bg: c.bg, align: "center", font: SMALL });
  tag(ctx, `α = ${fmt(pol.alpha, 1)}°`, ox - 40, oy - L * 0.4, { color: c.text, bg: c.bg, align: "center", font: MID });
  tag(ctx, "● s — tekislikka tik,  ↕ p — tekislikda", 10, 14, { color: c.text2, bg: c.bg2, font: SMALL });
  if (Math.abs(pol.alpha - P.brewsterAngle(1, pol.n)) < 1) tag(ctx, "Bryuster burchagi: qaytgan nur to‘liq qutblangan!", cw / 2, 34, { color: "#fff", bg: c.success, align: "center", font: MID });
  ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(src[0], src[1], 9, 0, TAU); ctx.fill();
}

function draw(ctx, stage) {
  ctx.fillStyle = stage.colors.bg; ctx.fillRect(0, 0, stage.w, stage.h);
  if (ui.mode === "prism") drawPrism(ctx, stage); else if (ui.mode === "rainbow") drawRainbow(ctx, stage); else if (pol.sub === "malus") drawMalus(ctx, stage); else drawBrew(ctx, stage);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.46, vh * 0.44), 260, 360)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  prism: [["dev", "δ(λ)", "Og‘ish burchagi rangga bog‘liq", "Binafsha nur qizilga nisbatan kuchliroq og‘adi — oq yorug‘lik spektrga yoyiladi."], ["n", "n(λ)", "Sindirish ko‘rsatkichining dispersiyasi", "To‘lqin uzunligi kamaygan sari n ortadi (normal dispersiya). Flint shishada bu bog‘lanish kuchliroq."]],
  rainbow: [["drop", "θ(b)", "Tomchidan chiqish burchagi", "Ko‘p nurlar chiqish burchagining eng katta (birlamchi) yoki eng kichik (ikkilamchi) qiymati atrofida to‘planadi — shu yo‘nalishda kamalak ko‘rinadi."], ["n", "n(λ) suv", "Suvning dispersiyasi", "Suvda ham binafsha nur kuchliroq sinadi — shuning uchun kamalak ranglarga ajraladi."]],
  malus: [["malus", "I(θ)", "Malyus qonuni (lab)", "Analizatorni aylantirib, fotometr ko‘rsatkichini yozing. Nuqtalar I = (I₀/2)cos²θ egri chizig‘iga tushadi."]],
  brew: [["fres", "R(α)", "Qaytgan yorug‘lik: s va p tashkil etuvchilar", "Bryuster burchagida p-tashkil etuvchi (R∥) umuman qaytmaydi — qaytgan nur faqat s-qutblangan."]],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[subKey()].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const t = TABS[subKey()].find((x) => x[0] === tab) || TABS[subKey()][0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  $("[data-meas-tools]").hidden = ui.tab !== "malus";
  graph.render();
}
function drawGraphCanvas(ctx, gst) {
  if (ui.mode === "prism") return ui.tab === "n" ? G.drawN(ctx, gst, { gid: pr.g, nm: ui.show.mono ? pr.lam : null }) : G.drawDev(ctx, gst, { gid: pr.g, A: pr.A, alpha: pr.alpha });
  if (ui.mode === "rainbow") return ui.tab === "n" ? G.drawN(ctx, gst, { gid: "water", nm: null }) : G.drawDrop(ctx, gst, { b: rb.b, k: rb.k });
  if (pol.sub === "malus") return G.drawMalus(ctx, gst, { theta: pol.a3 - pol.a1, pts: pol.pts, three: pol.mid, mid: pol.a2 - pol.a1 });
  return drawFresnel(ctx, gst, { n1: 1, n2: pol.n, alpha: pol.alpha });
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
  if (ui.mode === "prism") {
    const g = P.glass(pr.g), nR = P.nOf(g, 700), nV = P.nOf(g, 400);
    const dR = R.prismDeviation(pr.A, nR, pr.alpha), dV = R.prismDeviation(pr.A, nV, pr.alpha);
    setRO("r1", "<i>n</i> (qizil, 700 nm)", fmt(nR, 4), g.name);
    setRO("r2", "<i>n</i> (binafsha, 400 nm)", fmt(nV, 4), `Farq Δn = ${fmt(nV - nR, 4)}`);
    setRO("r3", "Og‘ish (qizil)", dR.tir ? "—" : `${fmt(dR.delta, 2)}°`, dR.tir ? "To‘liq ichki qaytish" : "δ = α₁ + α₂ − A", dR.tir ? "orange" : "");
    setRO("r4", "Og‘ish (binafsha)", dV.tir ? "—" : `${fmt(dV.delta, 2)}°`, dV.tir ? "To‘liq ichki qaytish" : "Binafsha ko‘proq og‘adi", dV.tir ? "orange" : "");
    setRO("r5", "Spektr kengligi", dR.tir || dV.tir ? "—" : `${fmt(dV.delta - dR.delta, 2)}°`, "Burchakli dispersiya");
    if (ui.show.mono) { const n = P.nOf(g, pr.lam), d = R.prismDeviation(pr.A, n, pr.alpha); setRO("r6", "Ajratilgan rang", `${fmt(pr.lam, 0)}<small>nm</small>`, `n = ${fmt(n, 4)}, δ = ${d.tir ? "—" : fmt(d.delta, 2) + "°"}`); }
    else setRO("r6", "Abbe soni <i>V</i>", fmt(P.abbe(g), 1), "Kichik V — kuchli dispersiya");
  } else if (ui.mode === "rainbow") {
    const W = P.glass("water"), n = P.nOf(W, 589), i = Math.asin(rb.b) / DEG, r = Math.asin(rb.b / n) / DEG;
    const D = P.dropDeviation(rb.b, n, rb.k), ang = rb.k === 1 ? 180 - D : D - 180;
    const aR = P.rainbowAngle(P.nOf(W, 700), rb.k).angle, aV = P.rainbowAngle(P.nOf(W, 400), rb.k).angle;
    setRO("r1", "Tushish burchagi <i>i</i>", `${fmt(i, 1)}°`, `sin i = b/R = ${fmt(rb.b, 2)}`);
    setRO("r2", "Sinish burchagi <i>r</i>", `${fmt(r, 1)}°`, "n = 1,333 (sariq nur)");
    setRO("r3", "Og‘ish <i>D</i>", `${fmt(D, 1)}°`, rb.k === 1 ? "D = 180° + 2i − 4r" : "D = 360° + 2i − 6r");
    setRO("r4", "Chiqish burchagi", `${fmt(ang, 1)}°`, "Quyoshga qarama-qarshi nuqtadan");
    setRO("r5", "Kamalak burchagi", `${fmt(aV, 1)}°–${fmt(aR, 1)}°`, rb.k === 1 ? "qizil — tashqarida" : "qizil — ichkarida (ranglar teskari)");
    setRO("r6", "Kamalak kengligi", `${fmt(Math.abs(aR - aV), 1)}°`, "Quyosh diametri 0,5° ham qo‘shiladi");
  } else if (pol.sub === "malus") {
    const angles = pol.mid ? [pol.a1, pol.a2, pol.a3] : [pol.a1, pol.a3], Is = P.malusChain(angles), th = pol.a3 - pol.a1;
    setRO("r1", "Polyarizatordan keyin", `${fmt(Is[0] * 100, 1)}<small>%</small>`, "Qutblanmagan nurning yarmi o‘tadi");
    setRO("r2", "O‘qlar orasidagi burchak <i>θ</i>", `${fmt(((th % 180) + 180) % 180, 0)}°`, pol.mid ? `o‘rtadagi: ${fmt(pol.a2 - pol.a1, 0)}°` : "analizator − polyarizator");
    setRO("r3", "Analizatordan keyin", `${fmt(Is[Is.length - 1] * 100, 2)}<small>%</small>`, pol.mid ? "I = (I₀/2)cos²θ₁cos²θ₂" : "I = (I₀/2)cos²θ");
    setRO("r4", "cos²θ", fmt(Math.cos(th * DEG) ** 2, 3), Math.abs(Math.cos(th * DEG)) < 0.01 ? "Polyaroidlar kesishgan" : "");
    setRO("r5", "Uch polyaroid", pol.mid ? "bor" : "yo‘q", pol.mid ? "Kesishgan juftlik orasiga qo‘yilsa, yorug‘lik o‘tadi!" : "", pol.mid ? "" : "muted");
    setRO("r6", "O‘lchovlar", `${pol.pts.length}`, "«O‘lchovni yozish» — lab");
  } else {
    const res = P.reflectedThroughAnalyzer(1, pol.n, pol.alpha, pol.phi), B = P.brewsterAngle(1, pol.n), r = R.snell(1, pol.n, pol.alpha);
    setRO("r1", "Bryuster burchagi <i>α</i><sub>B</sub>", `${fmt(B, 1)}°`, "tg α_B = n");
    setRO("r2", "<i>R</i><sub>s</sub> / <i>R</i><sub>p</sub>", `${fmt(res.Rs * 100, 1)} / ${fmt(res.Rp * 100, 2)}<small>%</small>`, "s — tik, p — tekislikdagi tebranish");
    setRO("r3", "Qutblanish darajasi", `${fmt(res.P * 100, 0)}<small>%</small>`, "(R_s − R_p)/(R_s + R_p)", res.P > 0.99 ? "" : "");
    setRO("r4", "Analizatordan o‘tdi", `${fmt(res.I * 100, 2)}<small>%</small>`, "Tushuvchi nurga nisbatan");
    setRO("r5", "Singan nur burchagi", r.tir ? "—" : `${fmt(r.beta / DEG, 1)}°`, Math.abs(pol.alpha - B) < 1 ? "α + β = 90° — qaytgan va singan nurlar tik" : "");
    setRO("r6", "Jami qaytgan", `${fmt(res.R * 100, 1)}<small>%</small>`, "Qutblanmagan nur uchun");
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "prism") { t = ui.show.newton ? "Nyuton tajribasi" : ui.show.mono ? "Monoxromatik nur" : "Dispersiya"; }
  else if (ui.mode === "rainbow") t = rb.k === 1 ? "Birlamchi kamalak" : "Ikkilamchi kamalak";
  else if (pol.sub === "malus") { const Is = P.malusChain(pol.mid ? [pol.a1, pol.a2, pol.a3] : [pol.a1, pol.a3]); const I = Is[Is.length - 1]; t = I < 0.001 ? "Qorong‘i — polyaroidlar kesishgan" : `I = ${fmt(I * 100, 1)}%`; tone = I < 0.001 ? "orange" : "blue"; }
  else { const on = Math.abs(pol.alpha - P.brewsterAngle(1, pol.n)) < 1; t = on ? "Bryuster burchagi" : "Qisman qutblangan"; tone = on ? "green" : "blue"; }
  el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [], k = subKey();
  if (k === "prism") {
    p.push("<p>Oq yorug‘lik — turli to‘lqin uzunlikdagi nurlar aralashmasi. Shishaning sindirish ko‘rsatkichi to‘lqin uzunligiga bog‘liq (<b>dispersiya</b>): binafsha nur uchun n kattaroq, shuning uchun u kuchliroq sinadi va prizma oq nurni <b>spektrga</b> yoyadi.</p>");
    if (ui.show.newton) p.push("<p><b>Nyuton tajribasi:</b> teskari qo‘yilgan ikkinchi prizma ranglarni qayta yig‘adi — ranglar shishada «paydo bo‘lmaydi», ular oq nurda bor edi.</p>");
    if (ui.show.mono) p.push("<p>Tirqish bitta rangni ajratadi. Bu nur keyingi prizmada boshqa ranglarga ajralmaydi — u <b>monoxromatik</b>.</p>");
  } else if (k === "rainbow") {
    p.push("<p>Quyosh nuri suv tomchisiga kirganda sinadi, ichki sirtdan qaytadi va chiqishda yana sinadi. Har xil balandlikdan kirgan nurlar turli burchakda chiqadi, lekin ularning ko‘pchiligi <b>eng chetki burchak</b> atrofida to‘planadi — o‘sha yo‘nalishda yorug‘lik kuchli. Bu burchak rangga bog‘liq: qizil uchun ~42°, binafsha uchun ~40,6°.</p>");
    p.push(rb.k === 2 ? "<p><b>Ikkilamchi kamalak</b> tomchida ikki marta qaytgan nurlardan hosil bo‘ladi (~51°): u xiraroq va ranglari teskari tartibda.</p>" : "<p>Kamalakni ko‘rish uchun Quyosh orqada bo‘lishi kerak; kamalak — quyoshga qarama-qarshi nuqta atrofidagi ~42° radiusli aylana.</p>");
  } else if (k === "malus") {
    p.push("<p>Tabiiy yorug‘likda elektr maydon vektori barcha yo‘nalishlarda tebranadi. <b>Polyaroid</b> faqat o‘z o‘qi bo‘ylab tebranishni o‘tkazadi — yorug‘lik <b>qutblanadi</b> va intensivligi yarmiga tushadi. Ikkinchi polyaroid (analizator) o‘tkazadigan ulush — Malyus qonuni: cos²θ.</p>");
    if (pol.mid) p.push("<p>Kesishgan polyaroidlar yorug‘likni o‘tkazmaydi. Ammo ular orasiga 45° da uchinchisi qo‘yilsa, yorug‘lik o‘tadi (1/8 qismi): o‘rtadagi polyaroid tebranish yo‘nalishini «buradi».</p>");
  } else {
    p.push("<p>Shisha yoki suv sirtidan qaytgan yorug‘lik qisman qutblangan: tushish tekisligiga tik (s) tebranishlar yaxshiroq qaytadi. <b>Bryuster burchagida</b> (tg α_B = n) qaytgan va singan nurlar o‘zaro tik bo‘ladi va p-tebranishlar umuman qaytmaydi. Qutblovchi quyosh ko‘zoynaklari shu yaltirashni so‘ndiradi.</p>");
  }
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const k = subKey();
  const html = { prism: "<small>Dispersiya</small> n = n(λ)", rainbow: "<small>Kamalak</small> D = 180° + 2i − 4r", malus: "<small>Malyus qonuni</small> I = I₀·cos²θ", brew: "<small>Bryuster qonuni</small> tg α<sub>B</sub> = n" }[k];
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Animatsiya (qutblanishdagi tebranishlar) */

const loop = createLoop((dt) => { ui.t += dt; if (ui.mode === "pol") stage.render(); }, {
  onStateChange(on) {
    playBtn.setAttribute("aria-pressed", String(on));
    playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
    playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  },
});
const playBtn = $("[data-play]");
playBtn.addEventListener("click", () => loop.toggle());

/* ------------------------------------------------------------------ Boshqaruv */

const gSel = $("#pG");
gSel.innerHTML = P.GLASSES.map((g) => `<option value="${g.id}">${g.name}</option>`).join("");
gSel.addEventListener("change", () => { pr.g = gSel.value; customized(); refresh(); });
const pAC = bindRange($("#pA"), $("#pAOut"), (v) => `${fmt(v, 0)}°`, (v) => { pr.A = v; customized(); refresh(); });
const pIC = bindRange($("#pI"), $("#pIOut"), (v) => `${fmt(v, 1)}°`, (v) => { pr.alpha = v; customized(); refresh(); });
const pLC = bindRange($("#pL"), $("#pLOut"), (v) => `${fmt(v, 0)} nm`, (v) => { pr.lam = Math.round(v / 10) * 10; customized(); refresh(); });
const rBC = bindRange($("#rB"), $("#rBOut"), (v) => fmt(v, 2), (v) => { rb.b = v; customized(); refresh(); });
document.querySelectorAll("[data-bow-value]").forEach((b) => b.addEventListener("click", () => { rb.k = +b.dataset.bowValue; syncAll(); customized(); refresh(); }));
const q1C = bindRange($("#q1"), $("#q1Out"), (v) => `${fmt(v, 0)}°`, (v) => { pol.a1 = v; customized(); refresh(); });
const q2C = bindRange($("#q2"), $("#q2Out"), (v) => `${fmt(v, 0)}°`, (v) => { pol.a2 = v; customized(); refresh(); });
const q3C = bindRange($("#q3"), $("#q3Out"), (v) => `${fmt(v, 0)}°`, (v) => { pol.a3 = v; customized(); refresh(); });
const bAC = bindRange($("#bA"), $("#bAOut"), (v) => `${fmt(v, 1)}°`, (v) => { pol.alpha = v; customized(); refresh(); });
const bNC = bindRange($("#bN"), $("#bNOut"), (v) => fmt(v, 2), (v) => { pol.n = v; customized(); refresh(); });
const bFC = bindRange($("#bF"), $("#bFOut"), (v) => `${fmt(v, 0)}°`, (v) => { pol.phi = v; customized(); refresh(); });
$("[data-mid]").addEventListener("change", (e) => { pol.mid = e.target.checked; syncAll(); customized(); refresh(); });
document.querySelectorAll("[data-psub-value]").forEach((b) => b.addEventListener("click", () => { pol.sub = b.dataset.psubValue; syncAll(); setupTabs(); setTab(TABS[subKey()][0][0]); customized(); refresh(); }));
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; syncAll(); customized(); refresh(); }));
$("[data-meas-add]").addEventListener("click", () => { const Is = P.malusChain(pol.mid ? [pol.a1, pol.a2, pol.a3] : [pol.a1, pol.a3]); pol.pts.push({ t: ((((pol.a3 - pol.a1) % 180) + 180) % 180), I: Math.round(Is[Is.length - 1] * 1000) / 1000 }); refresh(); });
$("[data-meas-clear]").addEventListener("click", () => { pol.pts = []; refresh(); });

/* Sudrash */
const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
function hitTest(px, py) {
  if (ui.mode === "prism") { const gm = prismGeom(); if (Math.hypot(px - SX(gm.src.x), py - SY(gm.src.y)) < 26) return "src"; }
  else if (ui.mode === "rainbow") { if (px < drop.cx - drop.R * 0.9 && Math.abs(py - drop.cy) < drop.R * 1.05) return "ray"; }
  else if (pol.sub === "malus") { for (const d of discs) if (Math.abs(px - d.x) < 24 && Math.abs(py - stage.h * 0.46) < 52) return "disc:" + d.key; }
  else { if (brewG.disc && Math.hypot(px - brewG.disc.x, py - brewG.disc.y) < 40) return "bdisc"; if (brewG.src && Math.hypot(px - brewG.src[0], py - brewG.src[1]) < 30) return "bsrc"; }
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const { px, py } = ptr(e), h = hitTest(px, py);
  if (!h) return;
  drag = { h, px, a1: pol.a1, a2: pol.a2, a3: pol.a3, phi: pol.phi }; canvas.dataset.dragging = "true";
  try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
});
canvas.addEventListener("pointermove", (e) => {
  const { px, py } = ptr(e);
  if (!drag) { const h = hitTest(px, py); canvas.style.cursor = h ? (h.startsWith("disc") || h === "bdisc" ? "ew-resize" : "grab") : ""; return; }
  const h = drag.h;
  if (h === "src") {
    const gm = prismGeom(), w = toWorld(px, py);
    const fx = gm.base.L.x - gm.base.apex.x, fy = gm.base.L.y - gm.base.apex.y, fl = Math.hypot(fx, fy);
    let nx = -fy / fl, ny = fx / fl; if (nx > 0) { nx = -nx; ny = -ny; }
    const vx = w.x - gm.mid.x, vy = w.y - gm.mid.y, ang = Math.atan2(nx * vy - ny * vx, nx * vx + ny * vy) / DEG;
    pr.alpha = Math.round(clamp(-ang, 20, 85) * 2) / 2; pIC.set(pr.alpha);
  } else if (h === "ray") { rb.b = Math.round(clamp((drop.cy - py) / drop.R, 0, 0.99) * 100) / 100; rBC.set(rb.b); }
  else if (h.startsWith("disc")) { const key = h.split(":")[1]; pol[key] = Math.round((((drag[key] + (px - drag.px) * 0.8) % 180) + 180) % 180); ({ a1: q1C, a2: q2C, a3: q3C })[key].set(pol[key]); }
  else if (h === "bdisc") { pol.phi = Math.round((((drag.phi + (px - drag.px) * 0.8) % 180) + 180) % 180); bFC.set(pol.phi); }
  else if (h === "bsrc") { const [ox, oy] = brewG.o; pol.alpha = Math.round(clamp(Math.atan2(ox - px, oy - py) / DEG, 0, 89) * 2) / 2; bAC.set(pol.alpha); }
  customized(); refresh();
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const PRESETS = {
  white: { mode: "prism", title: "Oq yorug‘lik spektri", lesson: "Prizma oq nurni kamalak ranglariga ajratadi. Manbani surib, spektr qanday o‘zgarishini kuzating.", set: () => { Object.assign(pr, { g: "crown", A: 60, alpha: 50 }); Object.assign(ui.show, { newton: false, mono: false }); } },
  flint: { mode: "prism", title: "Og‘ir flint: keng spektr", lesson: "Og‘ir flint shishaning dispersiyasi kron shishadan ~3 marta kuchli — spektr kengroq.", set: () => { Object.assign(pr, { g: "dflint", A: 50, alpha: 55 }); Object.assign(ui.show, { newton: false, mono: false }); }, tab: "n" },
  newton: { mode: "prism", title: "Nyuton: ranglarni qayta qo‘shish", lesson: "Teskari qo‘yilgan ikkinchi prizma ranglarni qayta yig‘adi — yana oq yorug‘lik.", set: () => { Object.assign(pr, { g: "dflint", A: 45, alpha: 45 }); Object.assign(ui.show, { newton: true, mono: false }); } },
  mono: { mode: "prism", title: "Bitta rang qayta ajralmaydi", lesson: "Tirqish bitta rangni o‘tkazadi; ikkinchi prizmada u boshqa ranglarga ajralmaydi.", set: () => { Object.assign(pr, { g: "dflint", A: 45, alpha: 45, lam: 590 }); Object.assign(ui.show, { newton: true, mono: true }); } },
  diamond: { mode: "prism", title: "Olmos: kuchli sinish", lesson: "Olmosda n ≈ 2,42 — kichik burchakli prizma ham nurni kuchli og‘diradi va ranglarga ajratadi («o‘yin»).", set: () => { Object.assign(pr, { g: "diamond", A: 30, alpha: 40 }); Object.assign(ui.show, { newton: false, mono: false }); } },
  bow1: { mode: "rainbow", title: "Birlamchi kamalak", lesson: "Nurni yuqori-pastga surib chiqish burchagini kuzating: b ≈ 0,86 da burchak eng katta (~42°) va nurlar shu yerda to‘planadi.", set: () => { Object.assign(rb, { k: 1, b: 0.86 }); ui.show.fan = true; }, tab: "drop" },
  bow2: { mode: "rainbow", title: "Ikkilamchi kamalak", lesson: "Ikki marta ichki qaytish: ~51°, ranglar teskari. Kamalaklar orasidagi osmon qorong‘iroq (Aleksandr chizig‘i).", set: () => { Object.assign(rb, { k: 2, b: 0.95 }); ui.show.fan = true; }, tab: "drop" },
  ray: { mode: "rainbow", title: "Tomchidagi bitta nur yo‘li", lesson: "Bitta oq nur tomchida sinadi, qaytadi va ranglarga ajralib chiqadi.", set: () => { Object.assign(rb, { k: 1, b: 0.7 }); ui.show.fan = false; } },
  malus: { mode: "pol", title: "Malyus qonuni (lab)", lesson: "Analizatorni 0°, 15°, 30°, … 180° ga burab, har safar «O‘lchovni yozish» ni bosing.", set: () => Object.assign(pol, { sub: "malus", a1: 0, a3: 0, mid: false, pts: [] }), tab: "malus" },
  crossed: { mode: "pol", title: "Kesishgan polyaroidlar", lesson: "O‘qlar orasidagi burchak 90° — yorug‘lik umuman o‘tmaydi.", set: () => Object.assign(pol, { sub: "malus", a1: 0, a3: 90, mid: false }) },
  three: { mode: "pol", title: "Uchinchi polyaroid «mo‘jizasi»", lesson: "Kesishgan polyaroidlar orasiga 45° da uchinchisini qo‘ydik — yorug‘lik o‘tdi (I₀/8)! O‘rtadagisini aylantirib ko‘ring.", set: () => Object.assign(pol, { sub: "malus", a1: 0, a2: 45, a3: 90, mid: true }) },
  brewster: { mode: "pol", title: "Bryuster burchagi", lesson: "α ≈ 56,3° da qaytgan nur to‘liq qutblangan: analizatorni 90° ga qo‘ysangiz, u butunlay so‘nadi.", set: () => Object.assign(pol, { sub: "brew", alpha: 56.5, n: 1.5, phi: 90 }) },
};
const GROUPS = [["Prizmada dispersiya", ["white", "flint", "newton", "mono", "diamond"]], ["Kamalak", ["bow1", "bow2", "ray"]], ["Qutblanish", ["malus", "crossed", "three", "brewster"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  gSel.value = pr.g; pAC.set(pr.A); pIC.set(pr.alpha); pLC.set(pr.lam); rBC.set(rb.b);
  q1C.set(pol.a1); q2C.set(pol.a2); q3C.set(pol.a3); bAC.set(pol.alpha); bNC.set(pol.n); bFC.set(pol.phi);
  $("[data-mono-ctl]").hidden = !ui.show.mono;
  document.querySelectorAll("[data-bow-value]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.bowValue === rb.k)));
  document.querySelectorAll("[data-psub-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.psubValue === pol.sub)));
  document.querySelectorAll("[data-pctl]").forEach((el) => { el.hidden = !el.dataset.pctl.split(" ").includes(pol.sub) || (el.hasAttribute("data-mid-ctl") && !pol.mid); });
  $("[data-mid]").checked = pol.mid;
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { prism: "Nur manbasini suring", rainbow: "Oq nurni yuqori-pastga suring", pol: "Polyaroid disklarini aylantiring" };
function setMode(m) {
  ui.mode = m;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(m); });
  $("[data-mode-hint]").textContent = MODE_HINT[m];
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset({ prism: "white", rainbow: "bow1", pol: "malus" }[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  p.set(); setMode(p.mode);
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setupTabs(); setTab(p.tab || TABS[subKey()][0][0]);
  refresh();
  if (p.mode === "pol" && !prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "white");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
