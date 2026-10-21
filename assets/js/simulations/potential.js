// ==========================================================================
// Potensial, ish va kondensatorlar — virtual laboratoriya (simulations/potential.html)
// 1) Potensial va ish: zaryadlarni qo'shish/surish, potensial xaritasi, ekvipotensiallar, kuch chiziqlari,
//    sinov zaryadini sudrash — A nuqtadan bajarilgan ish (yo'lga bog'liq emas).
// 2) Yassi kondensator: d (plastinkani surish), S, dielektrik, batareyaga ulangan/uzilgan holatlar, energiya.
// 3) Ulash va zaryadlash: parallel/ketma-ket/aralash, RC zanjirda zaryadlanish va razryad (kalit).
// Fizika: potential-physics.js (Node'da tekshirilgan). Grafiklar: potential-plots.js.
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, prefersReducedMotion } from "./sim-kit.js";
import * as P from "./potential-physics.js";
import * as G from "./potential-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const SMALL = "600 10px Inter, system-ui, sans-serif";
const MID = "600 11px Inter, system-ui, sans-serif";
const RED = "#ef4444", BLUE = "#2563eb";

/* ------------------------------------------------------------------ Holat */

const ui = { mode: "field", tab: "phi", show: { map: true, eq: true, lines: false } };
const fld = { charges: [{ x: -6, y: 0, q: 2 }, { x: 6, y: 0, q: -2 }], sel: 0, test: { x: 0, y: 7 }, A: { x: -12, y: 7 }, path: [], hist: [] };
const cap = { S: 200, d: 3, eps: 1, U0: 100, conn: true, q0: 0 };
const net = { kind: "par", C: [10, 20, 30], R: 50, E: 12, sw: 1, Q: 0, Q0: 0, t: 0, ts: 0, heat: 0, hist: [], dots: 0 };
let presetId = null;
const QT = 1e-9; // sinov zaryadi, C
const W_X = 20, W_Y = 12; // dunyo yarim o'lchamlari, cm

const SI = (c) => c.map((z) => ({ x: z.x / 100, y: z.y / 100, q: z.q * 1e-9 }));
const phiAt = (x, y) => P.potential(SI(fld.charges), x / 100, y / 100);
const EAt = (x, y) => P.field(SI(fld.charges), x / 100, y / 100);

/* ------------------------------------------------------------------ Dunyo → ekran */

const view = { s: 1, ox: 0, oy: 0, x0: 0, y1: 0 };
function fit(cw, ch, x0, x1, y0, y1, pad = 6) {
  const s = Math.min((cw - 2 * pad) / (x1 - x0), (ch - 2 * pad) / (y1 - y0));
  view.s = s; view.ox = (cw - (x1 - x0) * s) / 2; view.oy = (ch - (y1 - y0) * s) / 2; view.x0 = x0; view.y1 = y1;
}
const SX = (x) => view.ox + (x - view.x0) * view.s;
const SY = (y) => view.oy + (view.y1 - y) * view.s;
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s + view.x0, y: view.y1 - (py - view.oy) / view.s });

/* ================================================================== 1) Potensial va ish */

const LEVELS = [25, 50, 100, 200, 400, 800, 1600, 3200];
let cache = { key: "", map: null, segs: null, lines: null };
function fieldKey() { return JSON.stringify(fld.charges) + (ui.show.lines ? "L" : ""); }
function buildCache(c) {
  const key = fieldKey() + (c.dark ? "d" : "l");
  if (cache.key === key) return cache;
  // xarita
  const gw = 200, gh = 120, img = document.createElement("canvas"); img.width = gw; img.height = gh;
  const ictx = img.getContext("2d"), id = ictx.createImageData(gw, gh);
  const grid = new Float64Array((gw + 1) * (gh + 1));
  for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) grid[j * (gw + 1) + i] = phiAt(-W_X + (2 * W_X * i) / gw, W_Y - (2 * W_Y * j) / gh);
  const bg = c.dark ? [15, 23, 42] : [248, 250, 252];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const p = phiAt(-W_X + (2 * W_X * (i + 0.5)) / gw, W_Y - (2 * W_Y * (j + 0.5)) / gh);
    const t = clamp(Math.log10(1 + Math.abs(p) / 20) / Math.log10(1 + 4000 / 20), 0, 1) * 0.62, col = p >= 0 ? [239, 68, 68] : [37, 99, 235];
    const k = (j * gw + i) * 4; for (let m = 0; m < 3; m++) id.data[k + m] = bg[m] + (col[m] - bg[m]) * t; id.data[k + 3] = 255;
  }
  ictx.putImageData(id, 0, 0);
  // ekvipotensiallar (marching squares)
  const segs = [], lv = [0, ...LEVELS, ...LEVELS.map((v) => -v)];
  const X = (i) => -W_X + (2 * W_X * i) / gw, Y = (j) => W_Y - (2 * W_Y * j) / gh;
  for (const L of lv) {
    const arr = [];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const v = [grid[j * (gw + 1) + i], grid[j * (gw + 1) + i + 1], grid[(j + 1) * (gw + 1) + i + 1], grid[(j + 1) * (gw + 1) + i]];
      const pts = [], P4 = [[X(i), Y(j)], [X(i + 1), Y(j)], [X(i + 1), Y(j + 1)], [X(i), Y(j + 1)]];
      for (let e = 0; e < 4; e++) { const a = v[e] - L, b = v[(e + 1) % 4] - L; if ((a < 0) !== (b < 0)) { const t = a / (a - b), p = P4[e], q = P4[(e + 1) % 4]; pts.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } }
      if (pts.length === 2) arr.push(pts); else if (pts.length === 4) { arr.push([pts[0], pts[1]]); arr.push([pts[2], pts[3]]); }
    }
    segs.push({ L, arr });
  }
  // kuch chiziqlari
  let lines = null;
  if (ui.show.lines) {
    lines = [];
    const pos = fld.charges.filter((z) => z.q > 0), neg = fld.charges.filter((z) => z.q < 0);
    const seeds = pos.length ? pos.map((z) => [z, 1]) : neg.map((z) => [z, -1]);
    for (const [z, sgn] of seeds) {
      const n = Math.max(8, Math.round(Math.abs(z.q) * 6));
      for (let k = 0; k < n; k++) {
        const a = (TAU * (k + 0.5)) / n; let x = z.x + 0.7 * Math.cos(a), y = z.y + 0.7 * Math.sin(a); const pts = [[x, y]];
        for (let s = 0; s < 700; s++) {
          const E = EAt(x, y); if (E.e < 1e-6) break;
          x += (sgn * 0.22 * E.ex) / E.e; y += (sgn * 0.22 * E.ey) / E.e; pts.push([x, y]);
          if (Math.abs(x) > W_X + 1 || Math.abs(y) > W_Y + 1) break;
          if (fld.charges.some((o) => o !== z && Math.hypot(o.x - x, o.y - y) < 0.6)) break;
        }
        lines.push(pts);
      }
    }
  }
  cache = { key, map: img, segs, lines };
  return cache;
}
function drawField(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  fit(cw, ch, -W_X, W_X, -W_Y, W_Y);
  const cc = buildCache(c);
  if (ui.show.map) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(cc.map, SX(-W_X), SY(W_Y), 2 * W_X * view.s, 2 * W_Y * view.s); ctx.restore(); }
  else { ctx.fillStyle = c.bg; ctx.fillRect(SX(-W_X), SY(W_Y), 2 * W_X * view.s, 2 * W_Y * view.s); }
  if (ui.show.eq) {
    cc.segs.forEach(({ L, arr }) => {
      ctx.strokeStyle = L === 0 ? c.text3 : L > 0 ? "rgba(185,28,28,0.75)" : "rgba(29,78,216,0.75)"; ctx.lineWidth = L === 0 ? 1.2 : 1; ctx.setLineDash(L === 0 ? [4, 4] : []);
      ctx.beginPath(); arr.forEach(([p, q]) => { ctx.moveTo(SX(p[0]), SY(p[1])); ctx.lineTo(SX(q[0]), SY(q[1])); }); ctx.stroke();
    });
    ctx.setLineDash([]);
  }
  if (cc.lines) {
    ctx.strokeStyle = c.dark ? "rgba(226,232,240,0.55)" : "rgba(15,23,42,0.45)"; ctx.lineWidth = 1.1;
    cc.lines.forEach((pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(SX(x), SY(y)) : ctx.moveTo(SX(x), SY(y)))); ctx.stroke(); });
  }
  // yo'l va A nuqta
  if (fld.path.length > 1) { ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.beginPath(); fld.path.forEach((p, i) => (i ? ctx.lineTo(SX(p.x), SY(p.y)) : ctx.moveTo(SX(p.x), SY(p.y)))); ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle = c.text; ctx.beginPath(); ctx.arc(SX(fld.A.x), SY(fld.A.y), 4, 0, TAU); ctx.fill();
  tag(ctx, "A", SX(fld.A.x) - 12, SY(fld.A.y) - 12, { color: c.text, bg: c.bg, align: "center", font: "700 11px Inter, system-ui, sans-serif", pad: 4 });
  // zaryadlar
  fld.charges.forEach((z, i) => {
    const px = SX(z.x), py = SY(z.y), r = 9 + Math.min(6, Math.abs(z.q) * 1.2);
    ctx.fillStyle = z.q >= 0 ? RED : BLUE; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
    if (i === fld.sel) { ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, py, r + 4, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = "#fff"; ctx.font = "800 13px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(z.q >= 0 ? "+" : "−", px, py + 0.5);
    if (fld.charges.length <= 8 || i === fld.sel) tag(ctx, `${z.q > 0 ? "+" : ""}${fmt(z.q, 1)} nC`, px, py + r + 12, { color: c.text, bg: c.bg, align: "center", font: SMALL, pad: 4 });
  });
  // sinov zaryadi va E vektori
  const T = fld.test, E = EAt(T.x, T.y);
  if (E.e > 0) { const L = clamp(Math.log10(1 + E.e / 200) * 18, 6, 60); ctx.strokeStyle = "#f59e0b"; ctx.fillStyle = "#f59e0b"; ctx.lineWidth = 2.2; const ux = E.ex / E.e, uy = -E.ey / E.e, x1 = SX(T.x) + ux * L, y1 = SY(T.y) + uy * L; ctx.beginPath(); ctx.moveTo(SX(T.x), SY(T.y)); ctx.lineTo(x1, y1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ux * 8 - uy * 4, y1 - uy * 8 + ux * 4); ctx.lineTo(x1 - ux * 8 + uy * 4, y1 - uy * 8 - ux * 4); ctx.fill(); }
  ctx.fillStyle = "#facc15"; ctx.strokeStyle = "#92400e"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(SX(T.x), SY(T.y), 7, 0, TAU); ctx.fill(); ctx.stroke();
  tag(ctx, `φ = ${fmt(phiAt(T.x, T.y), 0)} V`, SX(T.x) + 12, SY(T.y) - 14, { color: c.text, bg: c.bg2, font: MID });
  tag(ctx, "Ekvipotensiallar: ±25, 50, 100, 200, 400, 800 … V", 8, 12, { color: c.text2, bg: c.bg2, font: SMALL });
}

/* ================================================================== 2) Yassi kondensator */

const cg = {};
const capNow = () => P.capState({ S: cap.S * 1e-4, d: cap.d * 1e-3, eps: cap.eps, connected: cap.conn, U0: cap.U0, q0: cap.q0 });
function drawCap(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const st = capNow(), side = Math.sqrt(cap.S), hp = clamp(side * 9.5, 70, ch * 0.72);
  const cx = cw * 0.55, gap = 12 + cap.d * 20, xL = cx - gap / 2, xR = cx + gap / 2, yc = ch * 0.5;
  Object.assign(cg, { xR, yc, hp, cx });
  // dielektrik
  if (cap.eps > 1) { ctx.fillStyle = cap.eps > 5 ? "rgba(148,163,184,0.35)" : "rgba(253,230,138,0.45)"; ctx.fillRect(xL + 3, yc - hp / 2, gap - 6, hp); }
  // maydon chiziqlari
  const nLines = clamp(Math.round((st.E * cap.eps) / 4000), 0, 22), shown = Math.round(nLines / cap.eps);
  ctx.strokeStyle = "rgba(245,158,11,0.85)"; ctx.lineWidth = 1.3;
  for (let k = 0; k < Math.max(nLines, 0); k++) {
    const y = yc - hp / 2 + ((k + 0.5) * hp) / Math.max(nLines, 1), full = cap.eps === 1 || k % Math.max(1, Math.round(cap.eps)) === 0;
    ctx.globalAlpha = full ? 1 : 0.22; ctx.beginPath(); ctx.moveTo(xL + 4, y); ctx.lineTo(xR - 4, y); ctx.stroke();
    if (gap > 26) { ctx.beginPath(); ctx.moveTo(cx + 4, y); ctx.lineTo(cx - 1, y - 3); ctx.lineTo(cx - 1, y + 3); ctx.fillStyle = "rgba(245,158,11,0.85)"; ctx.fill(); }
  }
  ctx.globalAlpha = 1; void shown;
  // plastinkalar
  ctx.fillStyle = c.text2; ctx.fillRect(xL - 6, yc - hp / 2, 6, hp); ctx.fillRect(xR, yc - hp / 2, 6, hp);
  const nq = clamp(Math.round(st.sigma * 1e7 * 1.2), 0, 18);
  ctx.font = "800 11px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let k = 0; k < nq; k++) { const y = yc - hp / 2 + ((k + 0.5) * hp) / nq; ctx.fillStyle = RED; ctx.fillText("+", xL - 12, y); ctx.fillStyle = BLUE; ctx.fillText("−", xR + 13, y); }
  ctx.fillStyle = c.warning; ctx.fillRect(xR + 6, yc - 14, 8, 28);
  tag(ctx, "↔", xR + 22, yc, { color: c.warning, bg: c.bg, align: "center", font: MID, pad: 3 });
  // zanjir: batareya, kalit
  const bx = cw * 0.12, top = yc - hp / 2 - 22, bot = yc + hp / 2 + 22;
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2.2; ctx.beginPath();
  ctx.moveTo(xL - 3, yc - hp / 2); ctx.lineTo(xL - 3, top); ctx.lineTo(bx + 60, top);
  ctx.moveTo(bx + 20, top); ctx.lineTo(bx, top); ctx.lineTo(bx, yc - 10);
  ctx.moveTo(bx, yc + 10); ctx.lineTo(bx, bot); ctx.lineTo(xR + 3, bot); ctx.lineTo(xR + 3, yc + hp / 2); ctx.stroke();
  // kalit
  ctx.strokeStyle = c.warning; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx + 60, top); ctx.lineTo(bx + 22, cap.conn ? top : top - 16); ctx.stroke();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(bx + 60, top, 4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(bx + 20, top, 3, 0, TAU); ctx.fill();
  tag(ctx, cap.conn ? "ulangan" : "uzilgan", bx + 40, top - 22, { color: c.warning, bg: c.bg, align: "center", font: SMALL });
  ctx.strokeStyle = c.text; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx - 14, yc - 5); ctx.lineTo(bx + 14, yc - 5); ctx.stroke(); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bx - 7, yc + 5); ctx.lineTo(bx + 7, yc + 5); ctx.stroke();
  tag(ctx, `${fmt(cap.U0, 0)} V`, bx + 20, yc, { color: c.text2, bg: c.bg, font: SMALL });
  // voltmetr
  const vx = cw * 0.86, vy = yc;
  ctx.strokeStyle = c.text3; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xL - 3, yc - hp / 2 + 6); ctx.lineTo(vx, yc - hp / 2 + 6); ctx.lineTo(vx, vy - 24); ctx.moveTo(vx, vy + 24); ctx.lineTo(vx, yc + hp / 2 - 6); ctx.lineTo(xR + 6, yc + hp / 2 - 6); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = c.bg; ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(vx, vy, 22, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.text; ctx.font = "700 12px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("V", vx, vy - 6);
  ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.fillText(`${fmt(st.U, 0)} V`, vx, vy + 8);
  tag(ctx, `d = ${fmt(cap.d, 1)} mm`, cx, bot + 14, { color: c.text, bg: c.bg2, align: "center", font: MID });
  if (cap.eps > 1) tag(ctx, `ε = ${fmt(cap.eps, 1)}`, cx, yc - hp / 2 - 10, { color: c.text, bg: c.bg2, align: "center", font: SMALL });
  tag(ctx, `E = ${fmt(st.E / 1000, 1)} kV/m`, 10, 14, { color: c.text2, bg: c.bg2, font: SMALL });
}

/* ================================================================== 3) Ulash va zaryadlash */

const Cs = () => net.C.map((v) => v * 1e-6);
const nw = () => P.network(net.kind, Cs(), 1);
const Ceq = () => nw().Ceq;
const tau = () => net.R * 1e3 * Ceq();
function netCharges() { const n = P.network(net.kind, Cs(), net.Q / Ceq()); return n.items; }
const ng = {};
function cap2(ctx, c, x, y, vertical, it, k, left = false) {
  ctx.fillStyle = c.bg; if (vertical) ctx.fillRect(x - 18, y - 8, 36, 16); else ctx.fillRect(x - 8, y - 18, 16, 36);
  ctx.strokeStyle = c.text; ctx.lineWidth = 3.5; ctx.beginPath();
  if (vertical) { ctx.moveTo(x - 16, y - 5); ctx.lineTo(x + 16, y - 5); ctx.moveTo(x - 16, y + 5); ctx.lineTo(x + 16, y + 5); }
  else { ctx.moveTo(x - 5, y - 16); ctx.lineTo(x - 5, y + 16); ctx.moveTo(x + 5, y - 16); ctx.lineTo(x + 5, y + 16); }
  ctx.stroke();
  const fill = clamp(it.U / net.E, 0, 1);
  ctx.fillStyle = `rgba(245,158,11,${0.15 + 0.6 * fill})`; if (vertical) ctx.fillRect(x - 15, y - 3, 30, 6); else ctx.fillRect(x - 3, y - 15, 6, 30);
  const lx = left ? x - 24 : x + 26, al = left ? "right" : "left";
  tag(ctx, `C${k + 1} = ${fmt(net.C[k], 0)} mkF`, lx, y - 9, { color: c.text, bg: c.bg, font: SMALL, align: al, pad: 4 });
  tag(ctx, `q = ${fmt(it.q * 1e6, 0)} mkC · U = ${fmt(it.U, 1)} V`, lx, y + 9, { color: c.text2, bg: c.bg, font: SMALL, align: al, pad: 4 });
}
function dotsAlong(ctx, pts, offset, color, spacing = 20) {
  const segs = []; let L = 0;
  for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); segs.push([pts[k - 1], pts[k], L, l]); L += l; }
  ctx.fillStyle = color;
  for (let s = ((offset % spacing) + spacing) % spacing; s < L; s += spacing) { const sg = segs.find((q) => s >= q[2] && s <= q[2] + q[3]); if (!sg) continue; const t = (s - sg[2]) / sg[3]; ctx.beginPath(); ctx.arc(sg[0][0] + (sg[1][0] - sg[0][0]) * t, sg[0][1] + (sg[1][1] - sg[0][1]) * t, 2.5, 0, TAU); ctx.fill(); }
}
function drawNet(ctx, stage) {
  const { w: cw, h: ch, colors: c } = stage;
  const items = netCharges(), x0 = cw * 0.08, x1 = cw * 0.52, yT = ch * 0.16, yB = ch * 0.86, yM = (yT + yB) / 2;
  const sx = x0 + (x1 - x0) * 0.35; ng.sw = { x: sx, y: yT };
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2.4;
  // batareya va kalit (1 — zaryadlash, 2 — razryad: batareyasiz qisqa yo'l)
  ctx.beginPath(); ctx.moveTo(x0, yM - 10); ctx.lineTo(x0, yT); ctx.lineTo(sx - 30, yT); ctx.moveTo(sx, yT); ctx.lineTo(x1, yT); ctx.moveTo(x0, yM + 10); ctx.lineTo(x0, yB); ctx.lineTo(x1, yB);
  ctx.moveTo(sx - 30, yT + 34); ctx.lineTo(sx - 30, yB); ctx.stroke();
  ctx.strokeStyle = c.text; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 - 14, yM - 5); ctx.lineTo(x0 + 14, yM - 5); ctx.stroke(); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0 - 7, yM + 5); ctx.lineTo(x0 + 7, yM + 5); ctx.stroke();
  tag(ctx, `ε = ${fmt(net.E, 0)} V`, x0 + 18, yM, { color: c.text2, bg: c.bg, font: SMALL });
  ctx.strokeStyle = c.warning; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(sx, yT); ctx.lineTo(net.sw === 1 ? sx - 30 : sx - 30, net.sw === 1 ? yT : yT + 34); ctx.stroke();
  ctx.fillStyle = c.warning; ctx.beginPath(); ctx.arc(sx, yT, 5, 0, TAU); ctx.fill(); [[sx - 30, yT, "1"], [sx - 30, yT + 34, "2"]].forEach(([x, y, l]) => { ctx.fillStyle = c.bg; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill(); ctx.stroke(); tag(ctx, l, x - 12, y, { color: c.text2, bg: c.bg, align: "center", font: SMALL, pad: 3 }); });
  tag(ctx, net.sw === 1 ? "zaryadlash" : "razryad", sx, yT - 18, { color: c.warning, bg: c.bg, align: "center", font: SMALL });
  // rezistor
  const rx = (sx + x1) / 2; ctx.fillStyle = c.bg; ctx.fillRect(rx - 24, yT - 9, 48, 18); ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx - 24, yT); for (let k = 1; k <= 6; k++) ctx.lineTo(rx - 24 + k * 8, yT + (k === 6 ? 0 : k % 2 ? -7 : 7)); ctx.stroke();
  tag(ctx, `R = ${fmt(net.R, 0)} kOm`, rx, yT + 20, { color: c.text2, bg: c.bg, align: "center", font: SMALL });
  // tok zaryadlari
  const i = net.sw === 1 ? (net.E - net.Q / Ceq()) / (net.R * 1e3) : -(net.Q / Ceq()) / (net.R * 1e3);
  const loop = net.sw === 1 ? [[x0, yB], [x0, yT], [x1, yT]] : [[sx - 30, yB], [sx - 30, yT + 34], [sx, yT], [x1, yT]];
  dotsAlong(ctx, loop, net.dots, c.warning);
  // tarmoq
  const nx0 = x1, nx1 = cw * 0.96;
  ctx.strokeStyle = c.text2; ctx.lineWidth = 2.4; ctx.beginPath();
  if (net.kind === "par") {
    const xs = [0.2, 0.5, 0.8].map((k) => nx0 + (nx1 - nx0) * k);
    ctx.moveTo(nx0, yT); ctx.lineTo(xs[2], yT); ctx.moveTo(nx0, yB); ctx.lineTo(xs[2], yB); xs.forEach((x) => { ctx.moveTo(x, yT); ctx.lineTo(x, yB); }); ctx.stroke();
    xs.forEach((x, k) => cap2(ctx, c, x, yM + (k - 1) * 34, true, items[k], k));
  } else if (net.kind === "ser") {
    const x = nx0 + (nx1 - nx0) * 0.3, ys = [0.25, 0.5, 0.75].map((k) => yT + (yB - yT) * k);
    ctx.moveTo(nx0, yT); ctx.lineTo(x, yT); ctx.lineTo(x, yB); ctx.lineTo(nx0, yB); ctx.stroke();
    ys.forEach((y, k) => cap2(ctx, c, x, y, true, items[k], k));
  } else {
    const xa = nx0 + (nx1 - nx0) * 0.18, xb = nx0 + (nx1 - nx0) * 0.45, xc = nx0 + (nx1 - nx0) * 0.75;
    ctx.moveTo(nx0, yT); ctx.lineTo(xa, yT); ctx.lineTo(xa, yM - 30); ctx.lineTo(xb, yM - 30); ctx.lineTo(xc, yM - 30); ctx.moveTo(xb, yM - 30); ctx.lineTo(xb, yB); ctx.moveTo(xc, yM - 30); ctx.lineTo(xc, yB); ctx.lineTo(nx0, yB); ctx.stroke();
    cap2(ctx, c, xa, yT + (yM - 30 - yT) / 2 + 6, true, items[0], 0);
    cap2(ctx, c, xb, yM + 30, true, items[1], 1, true); cap2(ctx, c, xc, yM + 30, true, items[2], 2);
  }
  tag(ctx, `C_um = ${fmt(Ceq() * 1e6, 2)} mkF · τ = RC = ${fmt(tau(), 2)} s · i = ${fmt(i * 1000, 3)} mA`, 10, 14, { color: c.text, bg: c.bg2, font: SMALL });
}

function draw(ctx, stage) {
  ctx.fillStyle = stage.colors.bg; ctx.fillRect(0, 0, stage.w, stage.h);
  if (ui.mode === "field") drawField(ctx, stage); else if (ui.mode === "cap") drawCap(ctx, stage); else drawNet(ctx, stage);
}
const heights = (cw) => {
  const vh = (typeof window !== "undefined" && window.innerHeight) || 800;
  return { stage: Math.round(clamp(Math.min(cw * 0.5, vh * 0.46), 270, 380)), graph: Math.round(clamp(vh * 0.26, 170, 240)) };
};
const stage = createStage($("#stage"), draw, { height: (cw) => heights(cw).stage });

/* ------------------------------------------------------------------ Grafiklar */

const TABS = {
  field: [["phi", "φ(x)", "Potensial gorizontal chiziq bo‘ylab", "Musbat zaryad yaqinida potensial katta va musbat, manfiy zaryad yaqinida — manfiy. Maydon kuchlanganligi φ(x) egri chizig‘ining qiyaligiga teng (teskari ishora bilan)."], ["work", "A(yo‘l)", "Sinov zaryadini ko‘chirishda ish", "Sinov zaryadini istalgan yo‘l bilan suring: ish faqat boshlang‘ich va oxirgi nuqtalar potensiallari farqiga bog‘liq. Berk yo‘lda ish nolga teng."]],
  cap: [["C", "C(d)", "Sig‘im plastinkalar orasidagi masofaga bog‘liq", "C = ε₀εS/d — masofa 2 marta ortsa, sig‘im 2 marta kamayadi."], ["W", "W(d)", "Kondensator energiyasi", "Batareyaga ulangan kondensatorda plastinkalar uzoqlashganda energiya kamayadi, uzilganda — ortadi (tashqi kuch ish bajaradi)."]],
  net: [["qi", "q(t), i(t)", "Zaryadlanish va razryad", "Kalit ulanganda tok eng katta, kondensator zaryadlangan sari tok kamayadi; τ = RC vaqtda zaryad 63% ga yetadi."], ["en", "Energiya", "Energiya almashinuvi", "Zaryadlashda batareya bajargan ishning yarmi kondensatorda to‘planadi, yarmi rezistorda issiqlikka aylanadi."]],
};
function setupTabs() {
  const box = $("[data-tabs]");
  box.innerHTML = TABS[ui.mode].map(([id, l]) => `<button type="button" data-tab-value="${id}">${l}</button>`).join("");
  box.querySelectorAll("[data-tab-value]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tabValue)));
}
function setTab(tab) {
  const t = TABS[ui.mode].find((x) => x[0] === tab) || TABS[ui.mode][0];
  ui.tab = t[0];
  document.querySelectorAll("[data-tab-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tabValue === ui.tab)));
  $("[data-graph-title]").textContent = t[2]; $("[data-graph-sub]").textContent = t[3];
  graph.render();
}
function drawGraphCanvas(ctx, gst) {
  if (ui.mode === "field") {
    if (ui.tab === "work") return G.drawWork(ctx, gst, { hist: fld.hist, Wexact: P.workBetween(QT, phiAt(fld.A.x, fld.A.y), phiAt(fld.test.x, fld.test.y)) });
    return G.drawPhi(ctx, gst, { fn: (x) => phiAt(x, fld.test.y), x0: -W_X, x1: W_X, xp: fld.test.x, yLine: fld.test.y });
  }
  if (ui.mode === "cap") {
    const st = capNow();
    if (ui.tab === "W") return G.drawWd(ctx, gst, { S: cap.S * 1e-4, eps: cap.eps, d: cap.d * 1e-3, U0: cap.U0, q0: cap.conn ? st.q : cap.q0, connected: cap.conn });
    return G.drawCd(ctx, gst, { S: cap.S * 1e-4, eps: cap.eps, d: cap.d * 1e-3 });
  }
  const qm = Ceq() * net.E, im = net.E / (net.R * 1e3), span = Math.max(5 * tau(), 2);
  if (ui.tab === "en") return drawEnergyNet(ctx, gst, span);
  return G.drawRC(ctx, gst, { hist: net.hist, qm, im, tau: tau(), span });
}
function drawEnergyNet(ctx, gst, span) {
  const c = gst.colors, h = net.hist, t1 = h.length ? h[h.length - 1].t : 0, t0 = Math.max(0, t1 - span), Wm = 0.5 * Ceq() * net.E * net.E * 1000;
  const pts = h.filter((p) => p.t >= t0);
  const max = Math.max(Wm, ...pts.map((p) => p.heat * 1000), 1e-6) * 1.1;
  const f = { X: (t) => 60 + ((t - t0) / span) * (gst.w - 80), Y: (v) => gst.h - 32 - (v / max) * (gst.h - 56) };
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, gst.w, gst.h);
  ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.strokeRect(60, 24, gst.w - 80, gst.h - 56);
  ctx.fillStyle = c.text3; ctx.font = "500 10px Inter, system-ui, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  [0, 0.5, 1].forEach((k) => ctx.fillText(fmt(max * k, 1), 54, f.Y(max * k)));
  ctx.textAlign = "center"; ctx.textBaseline = "top"; [0, 0.5, 1].forEach((k) => ctx.fillText(`${fmt(t0 + span * k, 1)} s`, f.X(t0 + span * k), gst.h - 26));
  const line = (key, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.setLineDash(dash || []); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(f.X(p.t), f.Y(p[key] * 1000)) : ctx.moveTo(f.X(p.t), f.Y(p[key] * 1000)))); ctx.stroke(); ctx.setLineDash([]); };
  line("W", c.primary); line("heat", c.danger, [6, 4]);
  ctx.textAlign = "left"; ctx.fillStyle = c.primary; ctx.fillText("— kondensator energiyasi, mJ", 70, 6); ctx.fillStyle = c.danger; ctx.fillText("- - rezistorda ajralgan issiqlik, mJ", 300, 6);
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
  if (ui.mode === "field") {
    const T = fld.test, pB = phiAt(T.x, T.y), pA = phiAt(fld.A.x, fld.A.y), E = EAt(T.x, T.y), W = P.workBetween(QT, pA, pB);
    setRO("r1", "Potensial <i>φ</i> (sinov zaryadida)", `${fmt(pB, 0)}<small>V</small>`, `x = ${fmt(T.x, 1)}, y = ${fmt(T.y, 1)} cm`);
    setRO("r2", "Kuchlanganlik <i>E</i>", `${fmt(E.e / 1000, 2)}<small>kV/m</small>`, `Kuch F = qE = ${fmt(E.e * QT * 1e6, 2)} mkN`);
    setRO("r3", "A nuqta potensiali", `${fmt(pA, 0)}<small>V</small>`, "Boshlang‘ich nuqta");
    setRO("r4", "Kuchlanish <i>U</i> = φ_A − φ", `${fmt(pA - pB, 0)}<small>V</small>`, "Potensiallar farqi");
    setRO("r5", "Maydon ishi <i>A</i>", `${fmt(W * 1e9, 1)}<small>nJ</small>`, `A = q(φ_A − φ), q = +1 nC`, W < 0 ? "orange" : "");
    const s = fld.hist.length ? fld.hist[fld.hist.length - 1].s : 0;
    setRO("r6", "Bosib o‘tilgan yo‘l", `${fmt(s, 1)}<small>cm</small>`, "Ish yo‘l uzunligiga bog‘liq emas");
  } else if (ui.mode === "cap") {
    const st = capNow();
    setRO("r1", "Sig‘im <i>C</i>", `${fmt(st.C * 1e12, 1)}<small>pF</small>`, "C = ε₀εS/d");
    setRO("r2", "Zaryad <i>q</i>", `${fmt(st.q * 1e9, 2)}<small>nC</small>`, cap.conn ? "q = CU (U = const)" : "Uzilgan — zaryad saqlanadi", cap.conn ? "" : "orange");
    setRO("r3", "Kuchlanish <i>U</i>", `${fmt(st.U, 1)}<small>V</small>`, cap.conn ? "Batareya kuchlanishi" : "U = q/C — o‘zgaradi");
    setRO("r4", "Maydon <i>E</i>", `${fmt(st.E / 1000, 2)}<small>kV/m</small>`, "E = U/d");
    setRO("r5", "Energiya <i>W</i>", `${fmt(st.W * 1e9, 2)}<small>nJ</small>`, "W = CU²/2");
    setRO("r6", "Plastinkalar tortishishi", `${fmt(st.F * 1e6, 2)}<small>mkN</small>`, "F = qE/2");
  } else {
    const items = netCharges(), U = net.Q / Ceq(), i = net.sw === 1 ? (net.E - U) / (net.R * 1e3) : -U / (net.R * 1e3);
    setRO("r1", "Umumiy sig‘im", `${fmt(Ceq() * 1e6, 2)}<small>mkF</small>`, { par: "C = C₁ + C₂ + C₃", ser: "1/C = 1/C₁ + 1/C₂ + 1/C₃", mix: "C₁ ketma-ket (C₂ + C₃)" }[net.kind]);
    setRO("r2", "Vaqt doimiysi <i>τ</i>", `${fmt(tau(), 2)}<small>s</small>`, "τ = RC");
    setRO("r3", "Umumiy zaryad", `${fmt(net.Q * 1e6, 1)}<small>mkC</small>`, `Oxirida ${fmt(Ceq() * net.E * 1e6, 1)} mkC`);
    setRO("r4", "Kuchlanish (tarmoqda)", `${fmt(U, 2)}<small>V</small>`, net.kind === "ser" ? `U₁ : U₂ : U₃ = ${items.map((it) => fmt(it.U, 1)).join(" : ")}` : net.kind === "par" ? "Hammasida bir xil" : `U₁ = ${fmt(items[0].U, 1)}, U₂₃ = ${fmt(items[1].U, 1)} V`);
    setRO("r5", "Tok <i>i</i>", `${fmt(i * 1000, 3)}<small>mA</small>`, net.sw === 1 ? "Zaryadlanish" : "Razryad");
    setRO("r6", "Energiya", `${fmt(0.5 * net.Q * U * 1000, 2)}<small>mJ</small>`, `issiqlik: ${fmt(net.heat * 1000, 2)} mJ`);
  }
}
function updateStatus() {
  const el = $("[data-status]"); let t = "", tone = "blue";
  if (ui.mode === "field") { const W = P.workBetween(QT, phiAt(fld.A.x, fld.A.y), phiAt(fld.test.x, fld.test.y)); t = W >= 0 ? "Maydon musbat ish bajardi" : "Tashqi kuch ish bajardi"; tone = W >= 0 ? "green" : "orange"; }
  else if (ui.mode === "cap") { t = cap.conn ? "U = const" : "q = const"; }
  else { t = net.sw === 1 ? "Zaryadlanmoqda" : "Razryad"; tone = net.sw === 1 ? "green" : "orange"; }
  el.textContent = t; el.dataset.tone = tone;
}
let lastExplain = "";
function updateExplain() {
  const p = [];
  if (ui.mode === "field") {
    p.push("<p><b>Potensial</b> — maydonning energetik tavsifi: birlik musbat zaryadning shu nuqtadagi potensial energiyasi. Bir xil potensialli nuqtalar <b>ekvipotensial</b> sirtni hosil qiladi; kuch chiziqlari ularga doim tik.</p>");
    p.push("<p>Sinov zaryadini istalgan yo‘l bilan suring: maydon bajargan ish faqat A va oxirgi nuqta potensiallari farqiga bog‘liq — A = q(φ_A − φ). Ekvipotensial chiziq bo‘ylab ko‘chirishda ish nolga teng.</p>");
  } else if (ui.mode === "cap") {
    p.push("<p><b>Kondensator</b> — dielektrik bilan ajratilgan ikki o‘tkazgich (plastinka). Sig‘im plastinkalar yuziga to‘g‘ri, oralig‘iga teskari proporsional va dielektrik bilan ε marta ortadi.</p>");
    p.push(cap.conn ? "<p>Batareyaga ulangan holda kuchlanish o‘zgarmaydi: plastinkalar uzoqlashsa, sig‘im va zaryad kamayadi (zaryad batareyaga qaytadi), energiya ham kamayadi.</p>" : "<p>Batareyadan uzilgan kondensatorda zaryad saqlanadi: plastinkalar uzoqlashsa, kuchlanish ortadi, maydon E esa o‘zgarmaydi; energiya ortadi — plastinkalarni tortishishga qarshi ajratish uchun ish bajariladi.</p>");
    if (cap.eps > 1) p.push("<p>Dielektrik qutblanadi va ichidagi maydonni ε marta kamaytiradi (xira chiziqlar), shuning uchun bir xil kuchlanishda ko‘proq zaryad sig‘adi.</p>");
  } else {
    p.push({ par: "<p><b>Parallel</b> ulashda barcha kondensatorlarda kuchlanish bir xil, zaryadlar sig‘imga proporsional; umumiy sig‘im yig‘indiga teng.</p>", ser: "<p><b>Ketma-ket</b> ulashda barcha kondensatorlarda zaryad bir xil, kuchlanish sig‘imga teskari proporsional taqsimlanadi; umumiy sig‘im eng kichigidan ham kichik.</p>", mix: "<p><b>Aralash</b> ulash: C₂ va C₃ parallel, ular C₁ bilan ketma-ket. C₁ dagi zaryad C₂ va C₃ zaryadlari yig‘indisiga teng.</p>" }[net.kind]);
    p.push("<p>Kondensator rezistor orqali bir zumda emas, eksponensial qonun bo‘yicha zaryadlanadi: τ = RC vaqtda 63%, 5τ da deyarli to‘liq.</p>");
  }
  const html = p.join("");
  if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
function updateFormula() {
  const html = ui.mode === "field" ? "<small>Ish</small> A = q(φ₁ − φ₂)" : ui.mode === "cap" ? "<small>Sig‘im</small> C = ε₀εS / d" : "<small>Zaryadlanish</small> q = Cε(1 − e<sup>−t/RC</sup>)";
  const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html;
}
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); graph.render(); }

/* ------------------------------------------------------------------ Vaqt (RC) */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (ui.mode !== "net" || !(dt > 0)) return;
  const Qf = net.sw === 1 ? Ceq() * net.E : 0, ta = tau(), n = Math.max(1, Math.ceil(dt / (ta / 50))), h = dt / n;
  for (let k = 0; k < n; k++) {
    const Qn = Qf + (net.Q - Qf) * Math.exp(-h / ta), i = (Qn - net.Q) / h, U = (net.Q + Qn) / 2 / Ceq();
    const Ures = net.sw === 1 ? net.E - U : -U; net.heat += Math.abs(Ures * i) * h;
    net.Q = Qn; net.t += h;
  }
  const i = net.sw === 1 ? (net.E - net.Q / Ceq()) / (net.R * 1e3) : -(net.Q / Ceq()) / (net.R * 1e3);
  net.dots += i / (net.E / (net.R * 1e3)) * dt * 120;
  net.hist.push({ t: net.t, q: net.Q, i, W: (0.5 * net.Q * net.Q) / Ceq(), heat: net.heat }); while (net.hist.length && net.hist[0].t < net.t - Math.max(5 * ta, 2) * 1.05) net.hist.shift();
  stage.render();
  uiTimer += dt; if (uiTimer > 0.1) { uiTimer = 0; updateReadouts(); graph.render(); }
}, {
  onStateChange(on) {
    playBtn.setAttribute("aria-pressed", String(on));
    playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
    playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  },
});
const playBtn = $("[data-play]");
playBtn.addEventListener("click", () => loop.toggle());

/* ------------------------------------------------------------------ Boshqaruv */

const fQC = bindRange($("#fQ"), $("#fQOut"), (v) => `${v > 0 ? "+" : ""}${fmt(v, 1)} nC`, (v) => { const z = fld.charges[fld.sel]; if (z) { z.q = v === 0 ? 0.5 : v; } customized(); refresh(); });
document.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => { if (fld.charges.length >= 8) return; const s = +b.dataset.add; fld.charges.push({ x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 12, q: 2 * s }); fld.sel = fld.charges.length - 1; fQC.set(fld.charges[fld.sel].q); customized(); refresh(); }));
$("[data-clear-q]").addEventListener("click", () => { fld.charges = []; fld.sel = -1; customized(); refresh(); });
$("[data-setA]").addEventListener("click", () => { fld.A = { ...fld.test }; fld.path = [{ ...fld.test }]; fld.hist = [{ s: 0, W: 0 }]; refresh(); });

const cUC = bindRange($("#cU"), $("#cUOut"), (v) => `${fmt(v, 0)} V`, (v) => { cap.U0 = v; if (!cap.conn) cap.q0 = P.capState({ S: cap.S * 1e-4, d: cap.d * 1e-3, eps: cap.eps, connected: true, U0: v }).q; customized(); refresh(); });
const cDC = bindRange($("#cD"), $("#cDOut"), (v) => `${fmt(v, 1)} mm`, (v) => { cap.d = v; customized(); refresh(); });
const cSC = bindRange($("#cS"), $("#cSOut"), (v) => `${fmt(v, 0)} cm²`, (v) => { cap.S = v; customized(); refresh(); });
$("[data-conn]").addEventListener("change", (e) => { if (!e.target.checked) cap.q0 = capNow().q; cap.conn = e.target.checked; customized(); refresh(); });
document.querySelectorAll("[data-diel-value]").forEach((b) => b.addEventListener("click", () => { cap.eps = +b.dataset.dielValue; syncAll(); customized(); refresh(); }));

const nCs = ["#n1", "#n2", "#n3"].map((id, k) => bindRange($(id), $(`${id}Out`), (v) => `${fmt(v, 0)} mkF`, (v) => { net.C[k] = v; customized(); refresh(); }));
const nRC = bindRange($("#nR"), $("#nROut"), (v) => `${fmt(v, 0)} kOm`, (v) => { net.R = v; customized(); refresh(); });
const nEC = bindRange($("#nE"), $("#nEOut"), (v) => `${fmt(v, 0)} V`, (v) => { net.E = v; customized(); refresh(); });
document.querySelectorAll("[data-kind-value]").forEach((b) => b.addEventListener("click", () => { net.kind = b.dataset.kindValue; net.Q = 0; net.heat = 0; net.hist = []; syncAll(); customized(); refresh(); }));
function toggleSwitch() { net.sw = net.sw === 1 ? 2 : 1; customized(); if (!loop.running) loop.start(); refresh(); }
$("[data-switch]").addEventListener("click", toggleSwitch);
document.querySelectorAll("[data-toggle]").forEach((cb) => cb.addEventListener("change", () => { ui.show[cb.dataset.toggle] = cb.checked; refresh(); }));

/* Sudrash */
const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
function hitTest(px, py) {
  if (ui.mode === "field") {
    if (Math.hypot(px - SX(fld.test.x), py - SY(fld.test.y)) < 16) return "test";
    for (let i = fld.charges.length - 1; i >= 0; i--) if (Math.hypot(px - SX(fld.charges[i].x), py - SY(fld.charges[i].y)) < 18) return "q" + i;
  } else if (ui.mode === "cap") { if (Math.abs(px - cg.xR - 6) < 18 && Math.abs(py - cg.yc) < cg.hp / 2 + 6) return "plate"; }
  else if (ng.sw && Math.hypot(px - ng.sw.x + 15, py - ng.sw.y - 15) < 34) return "sw";
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const { px, py } = ptr(e), h = hitTest(px, py);
  if (!h) return;
  if (h === "sw") { toggleSwitch(); return; }
  drag = h; canvas.dataset.dragging = "true";
  if (h.startsWith("q")) { fld.sel = +h.slice(1); fQC.set(fld.charges[fld.sel].q); }
  if (h === "test" && !fld.path.length) { fld.path = [{ ...fld.test }]; fld.hist = [{ s: 0, W: P.workBetween(QT, phiAt(fld.A.x, fld.A.y), phiAt(fld.test.x, fld.test.y)) }]; }
  try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  refresh();
});
canvas.addEventListener("pointermove", (e) => {
  const { px, py } = ptr(e);
  if (!drag) { const h = hitTest(px, py); canvas.style.cursor = h ? (h === "plate" ? "ew-resize" : h === "sw" ? "pointer" : "grab") : ""; return; }
  if (drag === "test") {
    const w = toWorld(px, py), np = { x: clamp(w.x, -W_X, W_X), y: clamp(w.y, -W_Y, W_Y) }, last = fld.path[fld.path.length - 1] || fld.test;
    const ds = Math.hypot(np.x - last.x, np.y - last.y);
    if (ds > 0.15) { fld.path.push(np); const s = (fld.hist.length ? fld.hist[fld.hist.length - 1].s : 0) + ds; fld.hist.push({ s, W: P.workBetween(QT, phiAt(fld.A.x, fld.A.y), phiAt(np.x, np.y)) }); if (fld.path.length > 1500) { fld.path.shift(); } }
    fld.test = np;
  } else if (drag.startsWith("q")) { const w = toWorld(px, py), z = fld.charges[+drag.slice(1)]; z.x = Math.round(clamp(w.x, -W_X + 1, W_X - 1) * 2) / 2; z.y = Math.round(clamp(w.y, -W_Y + 1, W_Y - 1) * 2) / 2; }
  else if (drag === "plate") { cap.d = Math.round(clamp((px - cg.cx - 6) / 10, 1, 10) * 10) / 10; cDC.set(cap.d); }
  customized(); refresh();
});
const endDrag = () => { drag = null; canvas.dataset.dragging = "false"; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const resetPath = () => { fld.path = []; fld.hist = []; };
const PRESETS = {
  single: { mode: "field", title: "Nuqtaviy zaryad potensiali", lesson: "Ekvipotensiallar — konsentrik aylanalar; potensial φ = kq/r masofa bilan kamayadi. Sinov zaryadini suring.", set: () => { Object.assign(fld, { charges: [{ x: 0, y: 0, q: 3 }], sel: 0, test: { x: 8, y: 4 }, A: { x: 8, y: 4 } }); resetPath(); } },
  dipole: { mode: "field", title: "Dipol: ekvipotensiallar", lesson: "Musbat va manfiy zaryad. Ular orasidagi o‘rta chiziqda potensial nol (punktir).", set: () => { Object.assign(fld, { charges: [{ x: -6, y: 0, q: 2 }, { x: 6, y: 0, q: -2 }], sel: 0, test: { x: 0, y: 7 }, A: { x: -12, y: 7 } }); resetPath(); ui.show.lines = true; } },
  twoPos: { mode: "field", title: "Ikki musbat zaryad", lesson: "O‘rtada potensial «egar» nuqtasi bor: maydon nol, potensial esa nol emas.", set: () => { Object.assign(fld, { charges: [{ x: -6, y: 0, q: 2 }, { x: 6, y: 0, q: 2 }], sel: 0, test: { x: 0, y: 0 }, A: { x: 0, y: 10 } }); resetPath(); ui.show.lines = true; } },
  work: { mode: "field", title: "Ish yo‘lga bog‘liq emas", lesson: "Sariq sinov zaryadini A dan istalgan egri yo‘l bilan boshqa nuqtaga suring. Ish grafigi oxirida doim q(φ_A − φ) ga teng; A ga qaytsangiz ish nol bo‘ladi.", set: () => { Object.assign(fld, { charges: [{ x: -5, y: -2, q: 3 }, { x: 7, y: 1, q: -2 }], sel: 0, test: { x: -14, y: 8 }, A: { x: -14, y: 8 } }); resetPath(); ui.show.lines = false; }, tab: "work" },
  plates: { mode: "field", title: "Bir jinsli maydon (plastinkalar)", lesson: "Zaryadlangan ikki qator — plastinkalar modeli. Ular orasida ekvipotensiallar parallel, maydon bir jinsli: E = U/d.", set: () => { const ch = []; for (let k = -5; k <= 5; k++) { ch.push({ x: -6, y: k * 1.6, q: 1 }); ch.push({ x: 6, y: k * 1.6, q: -1 }); } Object.assign(fld, { charges: ch.slice(0, 8).concat(ch.slice(8)), sel: 0, test: { x: 0, y: 0 }, A: { x: -4, y: 0 } }); resetPath(); ui.show.lines = false; } },
  capConn: { mode: "cap", title: "Ulangan kondensator: d ni oshirish", lesson: "O‘ng plastinkani uzoqlashtiring: U o‘zgarmaydi, C, q va W kamayadi.", set: () => Object.assign(cap, { S: 200, d: 2, eps: 1, U0: 100, conn: true }), tab: "W" },
  capIso: { mode: "cap", title: "Uzilgan kondensator: U ortadi", lesson: "Kondensator zaryadlanib, batareyadan uzildi. Plastinkani uzoqlashtiring: q va E o‘zgarmaydi, U va W ortadi.", set: () => { Object.assign(cap, { S: 200, d: 2, eps: 1, U0: 100, conn: false }); cap.q0 = P.capState({ S: 0.02, d: 0.002, eps: 1, connected: true, U0: 100 }).q; }, tab: "W" },
  diel: { mode: "cap", title: "Dielektrik kiritish", lesson: "Shisha (ε = 7) sig‘imni 7 marta oshiradi. Batareyaga ulangan holda zaryad ham 7 marta ortadi.", set: () => Object.assign(cap, { S: 200, d: 3, eps: 7, U0: 100, conn: true }), tab: "C" },
  par: { mode: "net", title: "Parallel ulash", lesson: "Barcha kondensatorlarda kuchlanish bir xil — ε. Zaryadlar sig‘imlarga proporsional.", set: () => Object.assign(net, { kind: "par", C: [10, 20, 30], R: 50, E: 12, sw: 1, Q: 0, heat: 0, hist: [], t: 0 }) },
  ser: { mode: "net", title: "Ketma-ket ulash", lesson: "Zaryad hammasida bir xil, kuchlanish kichik sig‘imli kondensatorda kattaroq.", set: () => Object.assign(net, { kind: "ser", C: [10, 20, 30], R: 200, E: 12, sw: 1, Q: 0, heat: 0, hist: [], t: 0 }) },
  mix: { mode: "net", title: "Aralash ulash", lesson: "C₂ va C₃ parallel, ular C₁ bilan ketma-ket: q₁ = q₂ + q₃.", set: () => Object.assign(net, { kind: "mix", C: [30, 10, 20], R: 100, E: 12, sw: 1, Q: 0, heat: 0, hist: [], t: 0 }) },
  rc: { mode: "net", title: "RC: zaryadlanish va razryad", lesson: "Zaryadlangach kalitni bosing — kondensator rezistor orqali zaryadsizlanadi. Energiya grafigida issiqlikni kuzating.", set: () => Object.assign(net, { kind: "par", C: [20, 10, 10], R: 50, E: 12, sw: 1, Q: 0, heat: 0, hist: [], t: 0 }), tab: "en" },
};
const GROUPS = [["Potensial va ish", ["single", "dipole", "twoPos", "work", "plates"]], ["Yassi kondensator", ["capConn", "capIso", "diel"]], ["Ulash va zaryadlash", ["par", "ser", "mix", "rc"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

function syncAll() {
  if (fld.charges[fld.sel]) fQC.set(fld.charges[fld.sel].q);
  cUC.set(cap.U0); cDC.set(cap.d); cSC.set(cap.S); $("[data-conn]").checked = cap.conn;
  document.querySelectorAll("[data-diel-value]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.dielValue === cap.eps)));
  nCs.forEach((c, k) => c.set(net.C[k])); nRC.set(net.R); nEC.set(net.E);
  document.querySelectorAll("[data-kind-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kindValue === net.kind)));
  document.querySelectorAll("[data-toggle]").forEach((cb) => { cb.checked = ui.show[cb.dataset.toggle]; });
}
const MODE_HINT = { field: "Zaryadlarni va sariq sinov zaryadini suring", cap: "O‘ng plastinkani suring", net: "Kalitni bosing" };
function setMode(m) {
  ui.mode = m;
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === m)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = !el.dataset.ctl.split(" ").includes(m); });
  $("[data-mode-hint]").textContent = MODE_HINT[m];
  setupTabs();
}
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.modeValue !== ui.mode) loadPreset({ field: "dipole", cap: "capConn", net: "par" }[b.dataset.modeValue]); }));
function loadPreset(id) {
  const p = PRESETS[id];
  p.set(); setMode(p.mode);
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncAll(); setTab(p.tab || TABS[ui.mode][0][0]);
  refresh();
  if (p.mode === "net" && !prefersReducedMotion()) loop.start(); else loop.stop();
  try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ }
}

const q = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q] ? q : "dipole");
document.fonts?.ready.then(() => { stage.render(); graph.render(); });
