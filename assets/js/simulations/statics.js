// ==========================================================================
// Muvozanat, kuch momenti va oddiy mexanizmlar — virtual laboratoriya (simulations/statics.html)
// 1) Massa markazi va muvozanat: shtativ shtiftiga osilgan fanera plastinka va shovun (chiziqlar kesishmasi),
//    qutining qirrasi atrofida ag'darilishi (α_kr), sharcha botiq / qavariq / tekis sirtda (muvozanat turlari).
// 2) Laboratoriya richagi: 100 g li yuklar, teshiklar, dinamometr (qiya tortish), tayanch nuqtasini siljitish.
// 3) Oddiy mexanizmlar: qo'zg'almas va qo'zg'aluvchan blok, polispast, chig'ir; oltin qoida va FIK.
// Dunyo koordinatalari 520×300 (shartli birlik). Fizika: statics-physics.js (Node'da tekshirilgan).
// ==========================================================================

import { icon } from "../ui/icons.js";
import { clamp, fmt, createStage, createLoop, tag, bindRange, arrow, prefersReducedMotion } from "./sim-kit.js";
import { springScale } from "./instruments.js";
import * as P from "./statics-physics.js";
import { drawTip, drawBall, drawLever, drawMechF, drawWork, lastFrame } from "./statics-plots.js";

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const SMALL = "600 10px Inter, system-ui, sans-serif";

/* ------------------------------------------------------------------ Holat */

const WORLD = [520, 300];
const ui = { mode: "cm", kind: { cm: "plate", mech: "fixed" }, view: { tip: "h", ball: "E", lever: "F", fixed: "F", movable: "F", tackle: "F", axle: "F" }, hover: null };
const pl = { shape: "L", hole: 0, th: 0, w: 0, lines: [], showCm: false, held: false };
const tp = { size: "tall", f: 0.5, a: 0, w: 0, rest: "up", held: true };
const bl = { kind: "bowl", x: 0, v: 0, held: false };
const lv = { A: { n: 2, h: -3 }, B: { n: 3, h: 2 }, dyn: false, dh: 5, phi: 0, po: 0, b: 0, w: 0, pts: [] };
const mc = { m: 1, n: 4, R: 0.3, ideal: false, s: 0, auto: 0, psi: 0 };
let presetId = null;
let CW = 800, anim = 0;
const hits = {};
const kind = () => (ui.mode === "lever" ? "lever" : ui.kind[ui.mode]);
const isMech = (k = kind()) => ["fixed", "movable", "tackle", "axle"].includes(k);

/* ------------------------------------------------------------------ Dunyo → ekran */

const view = { s: 1, ox: 0, oy: 0 };
function fit(w, h, pad = 4) {
  const [W, H] = WORLD, s = Math.min((w - 2 * pad) / W, (h - 2 * pad) / H);
  view.s = s; view.ox = (w - W * s) / 2; view.oy = (h - H * s) / 2;
}
const X = (x) => view.ox + x * view.s, Y = (y) => view.oy + y * view.s;
const toWorld = (px, py) => ({ x: (px - view.ox) / view.s, y: (py - view.oy) / view.s });
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(X(x), Y(y), w * view.s, h * view.s, r * view.s); };
const F = (w, px) => `${w} ${Math.max(6, px * view.s)}px Inter, system-ui, sans-serif`;
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
/** Xrom sterjen (a → b), eni w */
function rod(ctx, a, b, w) {
  const [ax, ay] = a, [bx, by] = b, L = Math.hypot(bx - ax, by - ay), s = view.s;
  ctx.save(); ctx.translate(X(ax), Y(ay)); ctx.rotate(Math.atan2(by - ay, bx - ax));
  const g = ctx.createLinearGradient(0, (-w / 2) * s, 0, (w / 2) * s); g.addColorStop(0, "#9ca3af"); g.addColorStop(0.35, "#f4f4f5"); g.addColorStop(1, "#6b7280");
  ctx.fillStyle = g; ctx.fillRect(0, (-w / 2) * s, L * s, w * s); ctx.restore();
}
/** Laboratoriya shtativi: cho'yan asos, sterjen */
function stand(ctx, c, x, yb, yt, bw = 110) {
  const s = view.s;
  const g = ctx.createLinearGradient(0, Y(yb - 12), 0, Y(yb)); g.addColorStop(0, "#4b5563"); g.addColorStop(1, "#1f2937");
  ctx.fillStyle = g; rr(ctx, x - 22, yb - 12, bw, 12, 3); ctx.fill();
  ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.ellipse(X(x), Y(yb - 12), 6 * s, 2 * s, 0, 0, TAU); ctx.fill();
  rod(ctx, [x, yb - 12], [x, yt], 6);
}
/** Mufta (qisqich): kubik + vint */
function clampBox(ctx, x, y) {
  const s = view.s; ctx.fillStyle = "#374151"; rr(ctx, x - 7, y - 7, 14, 14, 2); ctx.fill();
  ctx.fillStyle = "#9ca3af"; ctx.beginPath(); ctx.arc(X(x - 11), Y(y), 3 * s, 0, TAU); ctx.fill(); ctx.fillRect(X(x - 11), Y(y - 1), 4 * s, 2 * s);
}
function steel(ctx, cx, cy, r) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r); g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, "#cbd5e1"); g.addColorStop(1, "#475569");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
}
/** Massa markazi belgisi (to'rt bo'lakli doira) */
function cmMark(ctx, cx, cy, r, col = "#dc2626") {
  ctx.save(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, Math.PI / 2, Math.PI); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); ctx.restore();
}
/** Qo'l (musht) — ip yoki dinamometr halqasini ushlab turibdi */
function fist(ctx, x, y, r) {
  ctx.save(); ctx.fillStyle = "#f2c9a0"; ctx.strokeStyle = "#b07d56"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0, 0, TAU); ctx.fill(); ctx.stroke();
  for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x - r * 0.75, y + k * r * 0.3); ctx.lineTo(x + r * 0.2, y + k * r * 0.3); ctx.stroke(); }
  ctx.restore();
}

/* ------------------------------------------------------------------ 1a) Plastinka */

const PIN = [250, 44], PK = 6.4;
const ppCache = {};
const pp = () => (ppCache[pl.shape] ||= P.plateProps(P.SHAPES[pl.shape]));
const shape = () => P.SHAPES[pl.shape];
const plHole = () => shape().holes[pl.hole];
const HOLE_L = ["A", "B", "C"];
function plW([qx, qy]) { const h = plHole(), dx = qx - h[0], dy = qy - h[1], co = Math.cos(pl.th), si = Math.sin(pl.th); return [PIN[0] + PK * (co * dx - si * dy), PIN[1] + PK * (si * dx + co * dy)]; }
function plInv(x, y) { const h = plHole(), dx = (x - PIN[0]) / PK, dy = (y - PIN[1]) / PK, co = Math.cos(pl.th), si = Math.sin(pl.th); return [h[0] + co * dx + si * dy, h[1] - si * dx + co * dy]; }
const plEq = () => P.hangEq(pp(), plHole());
const plDev = () => P.wrapPi(pl.th - plEq());
const plRest = () => Math.abs(pl.w) < 0.01 && Math.abs(plDev()) < 0.005;
function resetPlate(off = 0.55) { pl.th = plEq() + off; pl.w = 0; pl.lines = []; pl.held = false; }
function hangFrom(i) { if (i === pl.hole) return; pl.hole = i; pl.w = 0; pl.held = false; syncPlate(); }
function stepPlate(dt) { if (!pl.held) P.plateStep(pl, pp(), plHole(), dt); }
function drawPlumbLine() {
  const d = [Math.sin(pl.th), Math.cos(pl.th)];
  pl.lines = pl.lines.filter((l) => l.i !== pl.hole); pl.lines.push({ i: pl.hole, p: plHole(), d, dev: plDev() });
}
function plEstimate() {
  if (pl.lines.length < 2) return null;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < pl.lines.length; i++) for (let j = i + 1; j < pl.lines.length; j++) { const q = P.lineX(pl.lines[i], pl.lines[j]); if (q) { sx += q[0]; sy += q[1]; n++; } }
  return n ? [sx / n, sy / n] : null;
}
function platePath(ctx) {
  ctx.beginPath();
  for (const [pts] of shape().parts) pts.forEach((q, k) => { const [x, y] = plW(q); if (k) ctx.lineTo(X(x), Y(y)); else ctx.moveTo(X(x), Y(y)); });
}
function drawPlate(ctx, c) {
  const s = view.s;
  table(ctx, c, 284);
  stand(ctx, c, 78, 284, 14);
  clampBox(ctx, 78, PIN[1]);
  rod(ctx, [78, PIN[1]], [PIN[0] + 4, PIN[1]], 4);
  // plastinka
  ctx.save(); platePath(ctx);
  const g = ctx.createLinearGradient(X(PIN[0] - 90), Y(PIN[1]), X(PIN[0] + 90), Y(PIN[1] + 200)); g.addColorStop(0, "#e9c99a"); g.addColorStop(0.5, "#d8ae74"); g.addColorStop(1, "#c4935a");
  ctx.fillStyle = g; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 6 * s; ctx.shadowOffsetY = 2 * s; ctx.fill("evenodd"); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.clip("evenodd");
  ctx.strokeStyle = "rgba(120,72,30,0.22)"; ctx.lineWidth = 1;
  for (let v = -2; v < 30; v += 1.6) { ctx.beginPath(); for (let u = -2; u <= 28; u += 1) { const [x, y] = plW([u, v + 0.35 * Math.sin(u * 0.5 + v)]); if (u > -2) ctx.lineTo(X(x), Y(y)); else ctx.moveTo(X(x), Y(y)); } ctx.stroke(); }
  // qalam chiziqlari
  ctx.strokeStyle = c.dark ? "#1e293b" : "#334155"; ctx.lineWidth = Math.max(1, 1.2 * s);
  for (const l of pl.lines) { const a = plW([l.p[0] - l.d[0] * 60, l.p[1] - l.d[1] * 60]), b = plW([l.p[0] + l.d[0] * 60, l.p[1] + l.d[1] * 60]); ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); ctx.stroke(); }
  ctx.restore();
  ctx.save(); platePath(ctx); ctx.strokeStyle = "#8a5a2b"; ctx.lineWidth = Math.max(1, 1.3 * s); ctx.stroke(); ctx.restore();
  // chiziqlar plastinkadan tashqarida (taqa uchun) — shtrix
  const est0 = plEstimate();
  if (est0 && !P.inside(shape(), est0[0], est0[1])) { // kesishish bo'shliqda — chiziqlarni shu nuqtagacha davom ettirish
    ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = c.text3; ctx.lineWidth = 1;
    for (const l of pl.lines) { const t = (est0[0] - l.p[0]) * l.d[0] + (est0[1] - l.p[1]) * l.d[1], a = plW(l.p), b = plW([l.p[0] + l.d[0] * (t + 3 * Math.sign(t)), l.p[1] + l.d[1] * (t + 3 * Math.sign(t))]); ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); ctx.stroke(); }
    ctx.restore();
  }
  // teshiklar
  const P0 = pp();
  shape().holes.forEach((h, i) => {
    const [x, y] = plW(h);
    ctx.fillStyle = c.dark ? "#0b1220" : "#3f3f46"; ctx.beginPath(); ctx.arc(X(x), Y(y), 3.4 * s, 0, TAU); ctx.fill();
    const dx = P0.cx - h[0], dy = P0.cy - h[1], L = Math.hypot(dx, dy) || 1, [lx, ly] = plW([h[0] + (dx / L) * 2.6, h[1] + (dy / L) * 2.6]);
    ctx.fillStyle = i === pl.hole ? "#7c2d12" : "#92400e"; ctx.font = F(800, 9); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(HOLE_L[i], X(lx), Y(ly));
    hits["hole" + i] = { x, y, r: 10 };
  });
  // massa markazi: topilgan va haqiqiy
  const est = plEstimate();
  if (est) { const [x, y] = plW(est); ctx.strokeStyle = c.primary; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(x), Y(y), 6 * s, 0, TAU); ctx.stroke(); label(ctx, c, "kesishish nuqtasi", X(x) + 9 * s, Y(y) - 12 * s, "left", c.primary); }
  if (pl.showCm) { const [x, y] = plW([P0.cx, P0.cy]); cmMark(ctx, X(x), Y(y), 5 * s); label(ctx, c, "massa markazi C", X(x) - 9 * s, Y(y) + 12 * s, "right", c.danger); }
  // shtift va shovun
  steel(ctx, X(PIN[0]), Y(PIN[1]), 4.2 * s);
  const bobY = 252;
  ctx.strokeStyle = c.dark ? "#e5e7eb" : "#1f2937"; ctx.lineWidth = Math.max(0.8, 0.9 * s); ctx.beginPath(); ctx.moveTo(X(PIN[0]), Y(PIN[1])); ctx.lineTo(X(PIN[0]), Y(bobY)); ctx.stroke();
  const gb = ctx.createLinearGradient(X(PIN[0] - 6), 0, X(PIN[0] + 6), 0); gb.addColorStop(0, "#92400e"); gb.addColorStop(0.4, "#fbbf24"); gb.addColorStop(1, "#78350f");
  ctx.fillStyle = gb; ctx.beginPath(); ctx.moveTo(X(PIN[0] - 2), Y(bobY)); ctx.lineTo(X(PIN[0] + 2), Y(bobY)); ctx.lineTo(X(PIN[0] + 6), Y(bobY + 8)); ctx.lineTo(X(PIN[0]), Y(bobY + 20)); ctx.lineTo(X(PIN[0] - 6), Y(bobY + 8)); ctx.closePath(); ctx.fill();
  if (CW > 430) { label(ctx, c, "shovun", X(PIN[0] + 10), Y(bobY + 10)); label(ctx, c, "shtift", X(PIN[0] + 8), Y(PIN[1] - 10)); label(ctx, c, "shtativ", X(86), Y(150)); }
  hits.plate = true;
}

/* ------------------------------------------------------------------ 1b) Quti */

const TIP_E = [300, 238], TK = 500; // px / m
const TSZ = { tall: [0.1, 0.3], mid: [0.16, 0.24], cube: [0.2, 0.2] };
const tBox = () => { const [b, h] = TSZ[tp.size]; return { m: 2, b, h, f: tp.f }; };
const tCrit = () => { const o = tBox(); return P.tipCrit(o.b, o.h, o.f); };
function tpW(u, v) { const ca = Math.cos(tp.a), sa = Math.sin(tp.a); return [TIP_E[0] + TK * (u * ca + v * sa), TIP_E[1] - TK * (-u * sa + v * ca)]; }
function stepTip(dt) { if (!tp.held && !tp.rest) P.tipStep(tp, tBox(), dt); }
function releaseTip() { tp.held = false; tp.rest = tp.a <= 0 ? "up" : tp.a >= Math.PI / 2 ? "side" : null; tp.w = 0; }
function drawTipStage(ctx, c) {
  const s = view.s, o = tBox(), { b, h } = o;
  table(ctx, c, TIP_E[1]);
  ctx.fillStyle = c.dark ? "#a8a29e" : "#78716c"; ctx.fillRect(X(0), Y(TIP_E[1]), WORLD[0] * s, 2 * s);
  const poly = (pts) => { ctx.beginPath(); pts.forEach(([u, v], k) => { const [x, y] = tpW(u, v); if (k) ctx.lineTo(X(x), Y(y)); else ctx.moveTo(X(x), Y(y)); }); ctx.closePath(); };
  // quti
  ctx.save(); poly([[-b, 0], [0, 0], [0, h], [-b, h]]);
  const [gx0, gy0] = tpW(-b, h), [gx1, gy1] = tpW(0, 0), g = ctx.createLinearGradient(X(gx0), Y(gy0), X(gx1), Y(gy1));
  g.addColorStop(0, "#e2b97f"); g.addColorStop(1, "#b07a43"); ctx.fillStyle = g; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 5 * s; ctx.fill(); ctx.shadowBlur = 0; ctx.clip();
  ctx.strokeStyle = "rgba(92,51,18,0.45)"; ctx.lineWidth = Math.max(1, 1.2 * s);
  for (let v = 0.05; v < h; v += 0.05) { const [x0, y0] = tpW(-b, v), [x1, y1] = tpW(0, v); ctx.beginPath(); ctx.moveTo(X(x0), Y(y0)); ctx.lineTo(X(x1), Y(y1)); ctx.stroke(); }
  // po'lat yuk
  if (Math.abs(o.f - 0.5) > 0.02) {
    const hb = h * Math.min(0.45, Math.abs(o.f - 0.5) * 1.3 + 0.1), v0 = o.f < 0.5 ? 0.012 : h - hb - 0.012;
    poly([[-b + 0.012, v0], [-0.012, v0], [-0.012, v0 + hb], [-b + 0.012, v0 + hb]]);
    const [sx0, sy0] = tpW(-b, v0), [sx1, sy1] = tpW(0, v0 + hb), gs = ctx.createLinearGradient(X(sx0), Y(sy0), X(sx1), Y(sy1)); gs.addColorStop(0, "#6b7280"); gs.addColorStop(0.5, "#d1d5db"); gs.addColorStop(1, "#374151");
    ctx.fillStyle = gs; ctx.fill();
    const [tx, ty] = tpW(-b / 2, v0 + hb / 2); ctx.save(); ctx.translate(X(tx), Y(ty)); ctx.rotate(tp.a); ctx.fillStyle = "#111827"; ctx.font = F(800, 8); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("po‘lat", 0, 0); ctx.restore();
  }
  ctx.restore();
  ctx.save(); poly([[-b, 0], [0, 0], [0, h], [-b, h]]); ctx.strokeStyle = "#6b4423"; ctx.lineWidth = Math.max(1.2, 2 * s); ctx.stroke(); ctx.restore();
  // tayanch
  const [ex, ey] = TIP_E, [cx, cy] = tpW(-b / 2, o.f * h), inside = cx <= ex + 0.5;
  if (tp.a < 1e-4) { ctx.strokeStyle = c.success; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(X(ex - b * TK), Y(ey + 1)); ctx.lineTo(X(ex), Y(ey + 1)); ctx.stroke(); }
  else if (tp.a < Math.PI / 2 - 1e-4) { ctx.fillStyle = c.warning; ctx.beginPath(); ctx.moveTo(X(ex), Y(ey)); ctx.lineTo(X(ex - 5), Y(ey + 8)); ctx.lineTo(X(ex + 5), Y(ey + 8)); ctx.closePath(); ctx.fill(); }
  // vertikal
  const col = inside ? c.success : c.danger;
  ctx.strokeStyle = col; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(X(cx), Y(cy)); ctx.lineTo(X(cx), Y(ey + 10)); ctx.stroke(); ctx.setLineDash([]);
  arrow(ctx, X(cx), Y(cy), 0, 36 * s, col, { width: 2.5, head: 8, label: "mg", font: F(700, 10) });
  cmMark(ctx, X(cx), Y(cy), 5 * s);
  // burchak
  if (tp.a > 0.01 && tp.a < Math.PI / 2 - 0.01) {
    ctx.strokeStyle = c.primary; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(ex), Y(ey)); ctx.lineTo(X(ex), Y(ey - 60)); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(X(ex), Y(ey), 40 * s, -Math.PI / 2, -Math.PI / 2 + tp.a); ctx.stroke();
    ctx.fillStyle = c.primary; ctx.font = F(700, 10); ctx.textAlign = "left"; ctx.fillText(`α = ${fmt(tp.a / DEG, 1)}°`, X(ex + 6), Y(ey - 46));
  }
  // qo'l
  if (tp.held && tp.a > 0.005 && tp.a < Math.PI / 2 - 0.01) { const [hx, hy] = tpW(-b, h * 0.92); fist(ctx, X(hx - 7), Y(hy), 7 * s); }
  if (CW > 430) {
    ctx.fillStyle = c.text2; ctx.font = F(700, 10); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    [`Quti ${fmt(b * 100, 0)} × ${fmt(h * 100, 0)} cm, m = 2 kg`, `massa markazi ${fmt(o.f * h * 100, 1)} cm balandlikda`, `αₖᵣ = ${fmt(tCrit() / DEG, 1)}°`].forEach((t, i) => ctx.fillText(t, X(16), Y(24 + i * 15)));
  }
  hits.box = true;
}

/* ------------------------------------------------------------------ 1c) Sharcha */

const BC = [260, 226], BK = 10, BR = 1.15, BALL_M = 0.05;
function stepBall(dt) { if (!bl.held) P.ballStep(bl, bl.kind, dt); }
const surfW = (x) => [BC[0] + BK * x, BC[1] - BK * P.surfY(bl.kind, x)];
function drawBallStage(ctx, c) {
  const s = view.s, k = bl.kind;
  table(ctx, c, BC[1] + 14);
  // asos
  const wood = (y0) => { const g = ctx.createLinearGradient(0, Y(y0 - 60), 0, Y(BC[1] + 14)); g.addColorStop(0, "#e2b97f"); g.addColorStop(1, "#a36d38"); return g; };
  ctx.beginPath();
  const x0 = k === "bowl" ? -17 : -26, x1 = -x0;
  ctx.moveTo(X(BC[0] + BK * x0), Y(BC[1] + 14));
  if (k === "bowl") { ctx.lineTo(X(BC[0] - BK * 17), Y(BC[1] - BK * P.surfY("bowl", 15) - 2)); ctx.lineTo(X(BC[0] - BK * 15), Y(BC[1] - BK * P.surfY("bowl", 15) - 2)); }
  for (let x = k === "bowl" ? -15 : -26; x <= (k === "bowl" ? 15 : 26) + 1e-9; x += 0.25) { const [wx, wy] = surfW(x); ctx.lineTo(X(wx), Y(wy)); }
  if (k === "bowl") { ctx.lineTo(X(BC[0] + BK * 17), Y(BC[1] - BK * P.surfY("bowl", 15) - 2)); }
  ctx.lineTo(X(BC[0] + BK * x1), Y(BC[1] + 14)); ctx.closePath();
  ctx.fillStyle = wood(BC[1]); ctx.fill(); ctx.strokeStyle = "#6b4423"; ctx.lineWidth = Math.max(1, 1.4 * s); ctx.stroke();
  if (k !== "bowl") { ctx.fillStyle = "#57534e"; for (const sx of [-25, 25]) { rr(ctx, BC[0] + BK * sx - 4, BC[1] - 10, 8, 10, 1.5); ctx.fill(); } }
  if (k === "flat") { // suv sathi (daraja)
    const lx = BC[0] + 120, ly = BC[1] + 4; ctx.fillStyle = "#facc15"; rr(ctx, lx - 30, ly - 4, 60, 8, 3); ctx.fill(); ctx.fillStyle = "#bbf7d0"; rr(ctx, lx - 10, ly - 2.5, 20, 5, 2.5); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(X(lx), Y(ly), 1.8 * s, 0, TAU); ctx.fill();
  }
  // muvozanat holati
  ctx.strokeStyle = c.text3; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; const [ex, ey] = surfW(0); ctx.beginPath(); ctx.moveTo(X(ex), Y(ey - 76)); ctx.lineTo(X(ex), Y(ey + 6)); ctx.stroke(); ctx.setLineDash([]);
  if (CW > 430) label(ctx, c, "muvozanat holati", X(ex), Y(ey - 84), "center", c.text3);
  // sharcha
  const sl = P.surfSlope(k, bl.x), nn = Math.hypot(1, sl), [px, py] = surfW(bl.x), cx = px + (BK * BR * sl) / nn, cy = py - (BK * BR) / nn;
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(X(px), Y(py + 1), BK * BR * s * 0.8, 2 * s, Math.atan(-sl), 0, TAU); ctx.fill();
  steel(ctx, X(cx), Y(cy), BK * BR * s);
  const rot = bl.x / BR; ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.arc(X(cx + Math.cos(rot) * BK * BR * 0.55), Y(cy + Math.sin(rot) * BK * BR * 0.55), 1.6 * s, 0, TAU); ctx.fill();
  // kuchlar
  // N = mg·cos θ (sirtga normal), F = mg + N = mg·sin θ (urinma bo'ylab pastga)
  const mgL = 42 * s, n2 = 1 + sl * sl;
  arrow(ctx, X(cx), Y(cy), 0, mgL, c.danger, { width: 2.2, head: 7, label: "mg", font: F(700, 9) });
  arrow(ctx, X(cx), Y(cy), (-sl / n2) * mgL, (-1 / n2) * mgL, c.primary, { width: 2, head: 7, label: "N", font: F(700, 9) });
  if (Math.abs(sl) > 0.02) arrow(ctx, X(cx), Y(cy), (-sl / n2) * mgL, ((sl * sl) / n2) * mgL, c.success, { width: 2.4, head: 7, label: "F", font: F(700, 9) });
  hits.ball = { x: cx, y: cy, r: 16 };
  if (CW > 430) { ctx.fillStyle = c.text2; ctx.font = F(700, 10); ctx.textAlign = "left"; ctx.fillText({ bowl: "Botiq sirt — turg‘un muvozanat", dome: "Qavariq sirt — turg‘unmas muvozanat", flat: "Tekis sirt — befarq muvozanat" }[k], X(16), Y(24)); }
}

/* ------------------------------------------------------------------ 2) Richag */

const PIV = [260, 112], LK = 700; // px / m
const lvLoads = () => [lv.A, lv.B].filter((g) => g.n > 0 && g.h !== 0).map((g) => ({ x: g.h * P.LEVER.step, m: g.n * P.LEVER.mW }));
const lvMom = () => P.leverMoments(lvLoads(), lv.po);
const lvF = () => (lv.dyn ? P.dynForce(lvMom().net, lv.dh * P.LEVER.step, lv.po, lv.phi * DEG) : 0);
function stepLever(dt) {
  if (lv.dyn) { lv.b *= Math.exp(-dt * 8); lv.w = 0; return; }
  P.leverStep(lv, lvLoads(), lv.po, dt);
}
/** Richag nuqtasi: u (m, tayanchdan), v (birlik, perpendikulyar) */
function lvW(u, v = 0) { const cb = Math.cos(lv.b), sb = Math.sin(lv.b); return [PIV[0] + LK * u * cb - v * sb, PIV[1] + LK * u * sb + v * cb]; }
function weightStack(ctx, c, x, y, n, hi) {
  const s = view.s;
  ctx.strokeStyle = c.dark ? "#e5e7eb" : "#374151"; ctx.lineWidth = Math.max(0.8, 1 * s); ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x), Y(y + 14)); ctx.stroke();
  ctx.lineWidth = Math.max(1, 1.3 * s); ctx.beginPath(); ctx.arc(X(x), Y(y + 3), 3 * s, Math.PI * 0.1, Math.PI * 1.1); ctx.stroke();
  rod(ctx, [x, y + 14], [x, y + 16 + n * 12], 2);
  for (let i = 0; i < n; i++) {
    const yy = y + 16 + i * 12, g = ctx.createLinearGradient(X(x - 14), 0, X(x + 14), 0);
    g.addColorStop(0, "#7c5a1e"); g.addColorStop(0.35, "#f5d27a"); g.addColorStop(1, "#6b4a12");
    ctx.fillStyle = g; rr(ctx, x - 14, yy, 28, 11, 2); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(X(x - 14), Y(yy + 4.5), 13 * s, 2 * s);
    if (s > 0.75 && !i) { ctx.fillStyle = "#3b2a08"; ctx.font = F(800, 5.5); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("100 g", X(x + 6), Y(yy + 8.3)); }
  }
  ctx.fillStyle = "#3f3f46"; rr(ctx, x - 9, y + 16 + n * 12, 18, 3, 1); ctx.fill();
  if (hi) { ctx.strokeStyle = c.primary; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); rr(ctx, x - 18, y - 2, 36, 24 + n * 12, 4); ctx.stroke(); ctx.setLineDash([]); }
}
function drawLeverStage(ctx, c) {
  const s = view.s, L = P.LEVER.L, po = lv.po, Fd = lvF(), m = lvMom();
  table(ctx, c, 286);
  // stend
  stand(ctx, c, PIV[0], 286, PIV[1] + 10, 120);
  ctx.fillStyle = "#374151"; rr(ctx, PIV[0] - 9, PIV[1] - 4, 18, 22, 3); ctx.fill();
  // richag
  const u0 = -L / 2 - po, u1 = L / 2 - po, hb = 11;
  ctx.save(); ctx.translate(X(PIV[0]), Y(PIV[1])); ctx.rotate(lv.b);
  const g = ctx.createLinearGradient(0, (-hb / 2) * s, 0, (hb / 2) * s); g.addColorStop(0, "#f1f5f9"); g.addColorStop(0.5, "#cbd5e1"); g.addColorStop(1, "#64748b");
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(u0 * LK * s, (-hb / 2) * s, (u1 - u0) * LK * s, hb * s, 3 * s); ctx.fill(); ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.stroke();
  for (let k = -6; k <= 6; k++) {
    const u = (k * P.LEVER.step - po) * LK * s;
    ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.arc(u, 0, 2.3 * s, 0, TAU); ctx.fill();
    if (k) { ctx.fillStyle = c.text2; ctx.font = F(700, 7); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(Math.abs(k)), u, -11 * s); }
  }
  ctx.restore();
  // o'q
  steel(ctx, X(PIV[0]), Y(PIV[1]), 4.5 * s);
  // ko'rsatkich strelka va shkala
  ctx.strokeStyle = c.text2; ctx.lineWidth = 1; for (let a = -12; a <= 12; a += 4) { const x = PIV[0] + Math.sin(a * DEG) * 34; ctx.beginPath(); ctx.moveTo(X(x), Y(PIV[1] + 34 - 4)); ctx.lineTo(X(x), Y(PIV[1] + 34 + (a ? 0 : 3))); ctx.stroke(); }
  const [tx, ty] = lvW(0, 30); ctx.strokeStyle = c.danger; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(X(PIV[0]), Y(PIV[1])); ctx.lineTo(X(tx), Y(ty)); ctx.stroke();
  // yuk guruhlari
  for (const [key, gr] of [["A", lv.A], ["B", lv.B]]) {
    if (!gr.n || !gr.h) { hits[key] = null; continue; }
    const [hx, hy] = lvW(gr.h * P.LEVER.step - po, 0);
    weightStack(ctx, c, hx, hy, gr.n, drag && drag.k === key);
    hits[key] = { x: hx - 16, y: hy - 4, w: 32, h: 28 + gr.n * 12 };
  }
  // yelkalar (o'lcham chiziqlari)
  const dimY = PIV[1] - 30;
  const dim = (u, text, col) => { const xa = PIV[0], xb = PIV[0] + u * LK * Math.cos(lv.b); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(xa), Y(dimY)); ctx.lineTo(X(xb), Y(dimY)); ctx.moveTo(X(xb), Y(dimY - 4)); ctx.lineTo(X(xb), Y(dimY + 4)); ctx.stroke(); label(ctx, c, text, X((xa + xb) / 2), Y(dimY - 9), "center", col); };
  if (lv.A.n && lv.A.h) dim(lv.A.h * P.LEVER.step - po, `l₁ = ${fmt(Math.abs(lv.A.h * 5 - po * 100), 0)} cm`, c.primary);
  if (lv.B.n && lv.B.h && Math.sign(lv.B.h * P.LEVER.step - po) !== Math.sign(lv.A.h * P.LEVER.step - po)) dim(lv.B.h * P.LEVER.step - po, `l₂ = ${fmt(Math.abs(lv.B.h * 5 - po * 100), 0)} cm`, c.warning);
  // richag og'irligi (tayanch siljigan bo'lsa)
  if (Math.abs(po) > 1e-6) { const [mx, my] = lvW(-po, 0); arrow(ctx, X(mx), Y(my + 6), 0, 26 * s, c.special, { width: 2, head: 7, label: "", font: F(700, 9) }); label(ctx, c, "mᵣ·g", X(mx), Y(my + 44), "center", c.special); cmMark(ctx, X(mx), Y(my), 3.6 * s); }
  // dinamometr
  hits.ring = null;
  if (lv.dyn) {
    const ud = lv.dh * P.LEVER.step - po, [dx, dy] = lvW(ud, 0), up = !(Fd < 0), side = Math.sign(ud) || 1, len = 92, phi = lv.phi * DEG;
    const rx = dx + side * Math.sin(phi) * len, ry = dy + (up ? -1 : 1) * Math.cos(phi) * len, Fa = Math.abs(Fd), Fmax = Fa > 5 ? 10 : 5;
    if (phi > 0.01) { ctx.strokeStyle = c.special; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(dx - (rx - dx) * 0.6), Y(dy - (ry - dy) * 0.6)); ctx.lineTo(X(rx), Y(ry)); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = c.text3; ctx.beginPath(); ctx.moveTo(X(dx), Y(dy)); ctx.lineTo(X(dx), Y(dy + (up ? -1 : 1) * 50)); ctx.stroke(); ctx.fillStyle = c.special; ctx.font = F(700, 9); ctx.fillText(`φ = ${fmt(lv.phi, 0)}°`, X(dx + side * 8), Y(dy + (up ? -1 : 1) * 56)); }
    if (Number.isFinite(Fd)) springScale(ctx, c, [X(rx), Y(ry)], [X(dx), Y(dy)], Fa, Fmax, { w: 15 * s });
    fist(ctx, X(rx), Y(ry), 8 * s);
    hits.ring = { x: rx, y: ry, r: 18 };
    label(ctx, c, Number.isFinite(Fd) ? `${fmt(Fa, 2)} N ${up ? "↑" : "↓"}` : "yelka nolga teng!", X(rx + side * 14), Y(ry), side > 0 ? "left" : "right", c.text);
  }
  // natija
  if (CW > 430) {
    const bal = Math.abs(m.net) < 1e-9 || lv.dyn, t = lv.dyn ? "dinamometr richagni gorizontal ushlab turibdi" : bal ? "momentlar teng: richag muvozanatda" : m.net > 0 ? "o‘ng tomon og‘ir: soat mili bo‘yicha buriladi" : "chap tomon og‘ir: soat miliga qarshi buriladi";
    ctx.fillStyle = bal ? c.success : c.danger; ctx.font = F(700, 10); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(t, X(14), Y(22));
    ctx.fillStyle = c.text2; ctx.fillText(`M₁ = ${fmt(m.ccw, 3)} N·m   M₂ = ${fmt(m.cw, 3)} N·m`, X(14), Y(38));
  }
}

/* ------------------------------------------------------------------ 3) Bloklar va chig'ir */

const FLOOR = 282, MK = 300; // px / m
const mOpt = () => ({ n: mc.n, R: mc.R, ideal: mc.ideal });
const mRes = (k = kind()) => P.mechForce(k, mc.m, mOpt());
const loadH = () => 24 + 10 * Math.cbrt(mc.m);
/** Ip yo'li (sahnaga sig'adigan): qo'zg'almas 30 cm, qo'zg'aluvchan 30 cm, polispast 40 cm; chig'irda yuk 33 cm gacha */
function hMax(k = kind()) { const r = mRes(k); if (k === "axle") return Math.min(0.33, (FLOOR - loadH() - 125) / MK); return (k === "tackle" ? 0.4 : 0.3) / r.k; }
const sMax = () => hMax() * mRes().k;
const mH = () => mc.s / mRes().k;
function stepMech(dt) {
  if (!mc.auto) return;
  mc.s = clamp(mc.s + mc.auto * dt * 0.08 * mRes().k, 0, sMax()); mc.psi = mc.s / mc.R;
  if (mc.s >= sMax() || mc.s <= 0) mc.auto = 0;
}
function pulley(ctx, c, x, y, r) {
  const s = view.s, g = ctx.createRadialGradient(X(x - r * 0.3), Y(y - r * 0.3), 1, X(x), Y(y), r * s);
  g.addColorStop(0, "#e5e7eb"); g.addColorStop(0.8, "#9ca3af"); g.addColorStop(1, "#4b5563");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(x), Y(y), r * s, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#374151"; ctx.lineWidth = Math.max(1, 1.6 * s); ctx.beginPath(); ctx.arc(X(x), Y(y), (r - 2.2) * s, 0, TAU); ctx.stroke();
  ctx.strokeStyle = "rgba(55,65,81,0.6)"; ctx.lineWidth = 1; const a0 = (mc.s / (r / MK)) % TAU;
  for (let k = 0; k < 4; k++) { const a = a0 + (k * TAU) / 4; ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x + Math.cos(a) * (r - 3)), Y(y + Math.sin(a) * (r - 3))); ctx.stroke(); }
  ctx.fillStyle = "#1f2937"; ctx.beginPath(); ctx.arc(X(x), Y(y), 2.4 * s, 0, TAU); ctx.fill();
}
function rope(ctx, pts) {
  const s = view.s; ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "#7c5a2e"; ctx.lineWidth = Math.max(1.4, 2.4 * s); ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke();
  ctx.strokeStyle = "#c9a36a"; ctx.lineWidth = Math.max(0.6, 1 * s); ctx.setLineDash([2 * s, 2 * s]); ctx.stroke(); ctx.restore();
}
function weightBlock(ctx, c, x, yTop) {
  const s = view.s, h = loadH(), w = 26 + 8 * Math.cbrt(mc.m);
  ctx.strokeStyle = "#374151"; ctx.lineWidth = Math.max(1.2, 1.8 * s); ctx.beginPath(); ctx.arc(X(x), Y(yTop - 3), 4 * s, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(x - 4), Y(yTop - 3)); ctx.lineTo(X(x - 4), Y(yTop + 2)); ctx.moveTo(X(x + 4), Y(yTop - 3)); ctx.lineTo(X(x + 4), Y(yTop + 2)); ctx.stroke();
  const g = ctx.createLinearGradient(X(x - w / 2), 0, X(x + w / 2), 0); g.addColorStop(0, "#27272a"); g.addColorStop(0.35, "#71717a"); g.addColorStop(1, "#18181b");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X(x - w * 0.3), Y(yTop + 2)); ctx.lineTo(X(x + w * 0.3), Y(yTop + 2)); ctx.lineTo(X(x + w / 2), Y(yTop + h * 0.35)); ctx.lineTo(X(x + w / 2), Y(yTop + h)); ctx.lineTo(X(x - w / 2), Y(yTop + h)); ctx.lineTo(X(x - w / 2), Y(yTop + h * 0.35)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f4f4f5"; ctx.font = F(800, 8); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${fmt(mc.m, mc.m < 1 ? 1 : mc.m % 1 ? 1 : 0)} kg`, X(x), Y(yTop + h * 0.66));
}
function bucket(ctx, c, x, yTop) {
  const s = view.s, h = loadH(), w = 30 + 6 * Math.cbrt(mc.m);
  ctx.strokeStyle = "#6b7280"; ctx.lineWidth = Math.max(1, 1.5 * s); ctx.beginPath(); ctx.arc(X(x), Y(yTop + 6), (w / 2) * s, Math.PI, 0); ctx.stroke();
  const g = ctx.createLinearGradient(X(x - w / 2), 0, X(x + w / 2), 0); g.addColorStop(0, "#64748b"); g.addColorStop(0.4, "#e2e8f0"); g.addColorStop(1, "#475569");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X(x - w / 2), Y(yTop + 6)); ctx.lineTo(X(x + w / 2), Y(yTop + 6)); ctx.lineTo(X(x + w * 0.38), Y(yTop + h)); ctx.lineTo(X(x - w * 0.38), Y(yTop + h)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.dark ? "#1d4ed8" : "#60a5fa"; ctx.beginPath(); ctx.ellipse(X(x), Y(yTop + 8), (w / 2 - 1) * s, 2.5 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#0f172a"; ctx.font = F(800, 8); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${fmt(mc.m, mc.m % 1 ? 1 : 0)} kg`, X(x), Y(yTop + h * 0.62));
}
function ruler(ctx, c, x, y0, hcur) {
  const s = view.s, top = y0 - 0.5 * MK;
  ctx.fillStyle = c.dark ? "#fde68a" : "#fef3c7"; rr(ctx, x - 7, top - 4, 14, y0 - top + 8, 2); ctx.fill(); ctx.strokeStyle = "#a16207"; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = "#78350f"; ctx.fillStyle = "#78350f"; ctx.font = F(700, 6.5); ctx.textAlign = "left"; ctx.textBaseline = "middle";
  for (let k = 0; k <= 50; k += 5) { const y = y0 - (k / 100) * MK; ctx.beginPath(); ctx.moveTo(X(x - 7), Y(y)); ctx.lineTo(X(x - 7 + (k % 10 ? 4 : 7)), Y(y)); ctx.stroke(); if (!(k % 10) && k) ctx.fillText(String(k), X(x + 1), Y(y)); }
  const yh = y0 - hcur * MK; ctx.fillStyle = c.danger; ctx.beginPath(); ctx.moveTo(X(x + 8), Y(yh)); ctx.lineTo(X(x + 15), Y(yh - 4)); ctx.lineTo(X(x + 15), Y(yh + 4)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.text2; ctx.font = F(700, 7); ctx.textAlign = "center"; ctx.fillText("cm", X(x), Y(top - 10));
}
function beam(ctx, c, x0, x1) {
  const s = view.s, g = ctx.createLinearGradient(0, Y(0), 0, Y(16)); g.addColorStop(0, "#b07a43"); g.addColorStop(1, "#7a4e25");
  ctx.fillStyle = g; ctx.fillRect(X(x0), Y(0), (x1 - x0) * s, 16 * s);
  ctx.fillStyle = "#4b2e14"; for (let x = x0 + 20; x < x1; x += 60) { ctx.beginPath(); ctx.arc(X(x), Y(8), 2 * s, 0, TAU); ctx.fill(); }
}
function bracket(ctx, x, y0, y1) { rod(ctx, [x, y0], [x, y1], 4); }
function drawMechStage(ctx, c) {
  const s = view.s, k = kind(), r = mRes(), h = mH(), F0 = r.F, lh = loadH(), Fmax = F0 > 40 ? 100 : F0 > 20 ? 50 : F0 > 10 ? 20 : F0 > 5 ? 10 : 5;
  table(ctx, c, FLOOR);
  if (k !== "axle") beam(ctx, c, 140, 420);
  hits.hand = null;
  if (k === "fixed") {
    const px = 270, py = 46, pr = 20, lx = px - pr, rx = px + pr, ytop = FLOOR - lh - h * MK, yh = 110 + mc.s * MK;
    bracket(ctx, px, 16, py); pulley(ctx, c, px, py, pr);
    rope(ctx, [[lx, ytop - 6], [lx, py]]); ctx.save(); ctx.strokeStyle = "#7c5a2e"; ctx.lineWidth = Math.max(1.4, 2.4 * s); ctx.beginPath(); ctx.arc(X(px), Y(py), pr * s, Math.PI, 0); ctx.stroke(); ctx.restore();
    rope(ctx, [[rx, py], [rx, yh]]);
    weightBlock(ctx, c, lx, ytop);
    springScale(ctx, c, [X(rx), Y(yh + 66)], [X(rx), Y(yh)], F0, Fmax, { w: 15 * s }); fist(ctx, X(rx), Y(yh + 70), 9 * s);
    hits.hand = { x: rx - 22, y: yh - 4, w: 44, h: 84, dir: 1 };
    ruler(ctx, c, 180, FLOOR, h);
    arrow(ctx, X(rx + 20), Y(yh + 20), 0, 34 * s, c.success, { width: 2.4, head: 8, label: "F", font: F(700, 10) });
  } else if (k === "movable") {
    const pr = 20, ytop = FLOOR - lh - h * MK, py = ytop - 30, ax = 250 - pr, bx = 250 + pr, yh = 168 - mc.s * MK;
    ctx.fillStyle = "#374151"; ctx.beginPath(); ctx.arc(X(ax), Y(18), 3 * s, 0, TAU); ctx.fill();
    rope(ctx, [[ax, 16], [ax, py]]); rope(ctx, [[bx, py], [bx, yh]]);
    ctx.save(); ctx.strokeStyle = "#7c5a2e"; ctx.lineWidth = Math.max(1.4, 2.4 * s); ctx.beginPath(); ctx.arc(X(250), Y(py), pr * s, 0, Math.PI); ctx.stroke(); ctx.restore();
    pulley(ctx, c, 250, py, pr);
    rod(ctx, [250, py], [250, ytop - 2], 3); ctx.fillStyle = "#4b5563"; rr(ctx, 236, py - 3, 28, 6, 2); ctx.fill();
    weightBlock(ctx, c, 250, ytop);
    springScale(ctx, c, [X(bx), Y(yh - 62)], [X(bx), Y(yh)], F0, Fmax, { w: 15 * s }); fist(ctx, X(bx), Y(yh - 66), 9 * s);
    hits.hand = { x: bx - 22, y: yh - 80, w: 44, h: 84, dir: -1 };
    ruler(ctx, c, 180, FLOOR, h);
    arrow(ctx, X(bx + 20), Y(yh - 20), 0, -34 * s, c.success, { width: 2.4, head: 8, label: "F", font: F(700, 10) });
  } else if (k === "tackle") {
    const q = mc.n / 2, pr = 9, sp = 22, cx = 262, fy = 44, ytop = FLOOR - lh - h * MK, my = ytop - 30, xs = Array.from({ length: q }, (_, i) => cx + (i - (q - 1) / 2) * sp), yh = 100 + mc.s * MK;
    bracket(ctx, cx, 16, fy - 12);
    ctx.fillStyle = "#4b5563"; rr(ctx, xs[0] - pr - 5, fy - 13, (q - 1) * sp + 2 * pr + 10, 26, 4); ctx.fill();
    ctx.fillStyle = "#4b5563"; rr(ctx, xs[0] - pr - 5, my - 13, (q - 1) * sp + 2 * pr + 10, 26, 4); ctx.fill();
    for (const x of xs) { rope(ctx, [[x - pr, fy], [x - pr, my]]); rope(ctx, [[x + pr, fy], [x + pr, my]]); }
    const fx = xs.at(-1) + pr; rope(ctx, [[fx, fy], [fx + 18, fy + 26], [fx + 18, yh]]);
    for (const x of xs) { pulley(ctx, c, x, fy, pr); pulley(ctx, c, x, my, pr); }
    rod(ctx, [cx, my + 12], [cx, ytop - 2], 3);
    weightBlock(ctx, c, cx, ytop);
    springScale(ctx, c, [X(fx + 18), Y(yh + 62)], [X(fx + 18), Y(yh)], F0, Fmax, { w: 15 * s }); fist(ctx, X(fx + 18), Y(yh + 66), 9 * s);
    hits.hand = { x: fx - 4, y: yh - 4, w: 44, h: 80, dir: 1 };
    ruler(ctx, c, 180, FLOOR, h);
    label(ctx, c, `${mc.n} ta ip yukni ushlab turibdi`, X(fx + 30), Y(my + 4), "left", c.text2);
  } else {
    const C = [250, 96], R = mc.R * 250, rd = 12.5, ytop = FLOOR - lh - h * MK, psi = mc.psi, gx = C[0] + Math.cos(psi) * R, gy = C[1] + Math.sin(psi) * R;
    // ustunlar
    ctx.fillStyle = "#8b5a2b"; for (const dx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(C[0] + dx * 8), Y(C[1])); ctx.lineTo(X(C[0] + dx * 70), Y(FLOOR)); ctx.lineTo(X(C[0] + dx * 58), Y(FLOOR)); ctx.lineTo(X(C[0] + dx * 2), Y(C[1] + 6)); ctx.closePath(); ctx.fill(); }
    rope(ctx, [[C[0] - rd, C[1]], [C[0] - rd, ytop + 4]]);
    // baraban
    const gd = ctx.createRadialGradient(X(C[0] - 4), Y(C[1] - 4), 1, X(C[0]), Y(C[1]), rd * s); gd.addColorStop(0, "#d6a76a"); gd.addColorStop(1, "#7a4e25");
    ctx.fillStyle = gd; ctx.beginPath(); ctx.arc(X(C[0]), Y(C[1]), rd * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#5c3a17"; ctx.lineWidth = 1; for (let k = 0; k < 6; k++) { const a = psi + (k * TAU) / 6; ctx.beginPath(); ctx.moveTo(X(C[0]), Y(C[1])); ctx.lineTo(X(C[0] + Math.cos(a) * rd), Y(C[1] + Math.sin(a) * rd)); ctx.stroke(); }
    // dasta yo'li
    ctx.strokeStyle = c.text3; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(X(C[0]), Y(C[1]), R * s, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    rod(ctx, C, [gx, gy], 5); ctx.fillStyle = "#7a4e25"; ctx.beginPath(); ctx.arc(X(gx), Y(gy), 5 * s, 0, TAU); ctx.fill();
    steel(ctx, X(C[0]), Y(C[1]), 3.5 * s);
    bucket(ctx, c, C[0] - rd, ytop);
    const tx = -Math.sin(psi), ty = Math.cos(psi), len = 70;
    springScale(ctx, c, [X(gx + tx * len), Y(gy + ty * len)], [X(gx), Y(gy)], F0, Fmax, { w: 14 * s }); fist(ctx, X(gx + tx * (len + 4)), Y(gy + ty * (len + 4)), 8 * s);
    hits.hand = { x: C[0], y: C[1], r: R + 30, axle: true };
    ruler(ctx, c, 420, FLOOR, h);
    label(ctx, c, `R = ${fmt(mc.R * 100, 0)} cm`, X(C[0] + 8), Y(C[1] - 14), "left", c.text2); label(ctx, c, "r = 5 cm", X(C[0] - 16), Y(C[1] + 22), "right", c.text2);
  }
  if (CW > 430) {
    ctx.fillStyle = c.text2; ctx.font = F(700, 10); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const x0 = k === "axle" ? 14 : 300 + 120;
    const lines = [`F = ${fmt(F0, 2)} N`, `mg = ${fmt(r.W, 2)} N`, `s = ${fmt(mc.s * 100, 1)} cm`, `h = ${fmt(h * 100, 1)} cm`];
    if (k !== "axle") lines.forEach((t, i) => ctx.fillText(t, X(x0), Y(40 + i * 15)));
    else lines.forEach((t, i) => ctx.fillText(t, X(x0), Y(24 + i * 15)));
  }
}

/* ------------------------------------------------------------------ Sahna */

function draw(ctx, stg) {
  CW = stg.w;
  const c = stg.colors;
  ctx.fillStyle = c.bg; ctx.fillRect(0, 0, stg.w, stg.h);
  fit(stg.w, stg.h);
  for (const k of Object.keys(hits)) delete hits[k];
  const k = kind();
  if (k === "plate") drawPlate(ctx, c);
  else if (k === "tip") drawTipStage(ctx, c);
  else if (k === "ball") drawBallStage(ctx, c);
  else if (k === "lever") drawLeverStage(ctx, c);
  else drawMechStage(ctx, c);
}
const heights = () => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return { graph: Math.round(clamp(vh * 0.28, 190, 250)) }; };
const stage = createStage($("#stage"), draw, { height: (cw) => { const vh = (typeof window !== "undefined" && window.innerHeight) || 800; return Math.round(clamp(Math.min(cw * 0.62, vh * 0.46), 240, 340)); } });

/* ------------------------------------------------------------------ Grafik */

function lvGraph() {
  const po = lv.po, A = lv.A, Mg = Math.abs(A.n * P.LEVER.mW * P.G * (A.h * P.LEVER.step - po) + P.LEVER.mBar * P.G * -po);
  let l = 0, Fv = NaN;
  if (lv.dyn) { l = Math.abs(lv.dh * P.LEVER.step - po) * 100; Fv = lvF(); }
  else if (lv.B.n && lv.B.h) { l = Math.abs(lv.B.h * P.LEVER.step - po) * 100; Fv = lv.B.n * P.LEVER.mW * P.G; }
  return { M: Mg, l, F: Fv };
}
function drawGraphCanvas(ctx, gs) {
  const k = kind(), v = ui.view[k];
  if (k === "tip") { const o = tBox(); return drawTip(ctx, gs, { b: o.b, h: o.h, f: o.f, a: tp.a, hover: ui.hover }); }
  if (k === "ball") return drawBall(ctx, gs, { kind: bl.kind, x: bl.x, v: bl.v, m: BALL_M, hover: ui.hover });
  if (k === "lever") { const g = lvGraph(); return drawLever(ctx, gs, { M: g.M, F: g.F, l: g.l, phi: lv.dyn ? lv.phi * DEG : 0, pts: lv.pts, hover: ui.hover }); }
  if (isMech(k)) { if (v === "A") { const r = mRes(), sw = mc.s > 1e-6 ? mc.s : sMax(); return drawWork(ctx, gs, { W: r.W, F: r.F, h: sw / r.k, s: sw }); } return drawMechF(ctx, gs, { kind: k, n: mc.n, R: mc.R, m: mc.m, hover: ui.hover }); }
}
const graph = createStage($("#graph"), drawGraphCanvas, { height: () => heights().graph });
const MECH_TABS = [["F", "F(m)", "Kerakli kuchning yuk massasiga bog‘liqligi", "Ko‘k — real mexanizm (ishqalanish, blok massasi), yashil shtrix — ideal, kulrang — yukni to‘g‘ridan-to‘g‘ri ko‘tarish (F = mg). Kursor bilan qiymat o‘qing."],
  ["A", "Ish", "Foydali va to‘liq ish", "Yukni h balandlikka ko‘targanda foydali ish mgh, qo‘l bajargan ish F·s (yuk hali ko‘tarilmagan bo‘lsa — eng yuqoriga ko‘tarish uchun). Mexanizm kuchdan yutuq bersa, yo‘ldan shuncha yutqazadi: ishdan yutuq yo‘q (oltin qoida). Ishqalanish tufayli F·s > mgh."]];
const TABS = {
  tip: [["h", "h(α)", "Massa markazi balandligining og‘ish burchagiga bog‘liqligi", "Quti og‘dirilganda massa markazi avval ko‘tariladi: αₖᵣ da eng yuqori, keyin pasayadi. Yashil sohada qo‘yib yuborilsa — qaytadi (turg‘un), qizil sohada — ag‘dariladi. Massa markazi past bo‘lsa, αₖᵣ katta."]],
  ball: [["E", "Eₚ(x)", "Sharchaning potensial energiyasi", "Turg‘un muvozanat — potensial energiya minimumi, turg‘unmas — maksimumi, befarq — o‘zgarmas. Yashil shtrix — to‘liq energiya: sharcha Eₚ = E bo‘lgan nuqtalar orasida tebranadi (ishqalanish uni asta-sekin kamaytiradi)."]],
  lever: [["F", "F₂(l₂)", "Richag muvozanati: muvozanatlovchi kuch va yelka", "Ko‘k chiziq — chap yuklar momentini muvozanatlovchi kuch F₂ = M₁/l₂ (giperbola). To‘q sariq doira — hozirgi o‘ng yuklar yoki dinamometr; yashil nuqtalar — siz yozgan o‘lchashlar. Nuqta chiziqda yotsa, richag muvozanatda."]],
  fixed: MECH_TABS, movable: MECH_TABS, tackle: MECH_TABS, axle: MECH_TABS,
};
function setTabs() {
  const k = kind(), tabs = TABS[k], card = $("[data-graph-card]");
  card.hidden = !tabs; if (!tabs) return;
  const box = $("[data-tabs]"), cur = ui.view[k], t = tabs.find((x) => x[0] === cur) || tabs[0];
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
const graphOn = () => !$("[data-graph-card]").hidden;

/* ------------------------------------------------------------------ Natijalar */

const RO = ["r1", "r2", "r3", "r4", "r5", "r6"];
$("[data-readouts]").innerHTML = RO.map((k) => `<div class="of-card sim-readout" data-readout="${k}"><span class="sim-readout__label"><span data-label></span></span><span class="sim-readout__value" data-value></span><span class="sim-readout__sub" data-sub></span></div>`).join("");
function setRO(key, lab, value, sub, tone) { const el = document.querySelector(`[data-readout="${key}"]`); el.querySelector("[data-label]").innerHTML = lab; el.querySelector("[data-value]").innerHTML = value; el.querySelector("[data-sub]").textContent = sub; el.dataset.tone = tone || ""; }
const u = (v, unit) => `${v}<small>${unit}</small>`;
const xy = (q) => `(${fmt(q[0], 1)}; ${fmt(q[1], 1)})`;
const tipM = () => { const o = tBox(); return P.tipTorque(o.m, o.b, o.h, o.f, tp.a); };
const ballEk = () => 0.5 * BALL_M * (bl.v / 100) ** 2 * (7 / 5);

function updateReadouts() {
  const k = kind();
  if (k === "plate") {
    const p0 = pp(), h = plHole(), d = Math.hypot(p0.cx - h[0], p0.cy - h[1]), est = plEstimate(), dev = plDev() / DEG;
    setRO("r1", "Plastinka", u(fmt(p0.mass, 0), "g"), `${shape().name}; yuzi S = ${fmt(p0.A, 0)} cm²`);
    setRO("r2", "Osish nuqtasi", u(HOLE_L[pl.hole], "teshik"), `shtiftdan massa markazigacha d = ${fmt(d, 1)} cm`, "blue");
    setRO("r3", "Vertikaldan og‘ish", u(fmt(dev, 1), "°"), plRest() ? "to‘xtadi — chiziq chizish mumkin" : `tebranmoqda; davr T = ${fmt(TAU / P.hangOmega(p0, h), 2)} s`, plRest() ? "green" : "orange");
    setRO("r4", "Chizilgan chiziqlar", u(String(pl.lines.length), "ta"), pl.lines.length ? pl.lines.map((l) => HOLE_L[l.i]).join(", ") + " teshikdan" : "shovun bo‘ylab chiziq chizing");
    setRO("r5", "Kesishish nuqtasi", est ? u(xy(est), "cm") : "—", est ? `hisoblangandan farqi ${fmt(Math.hypot(est[0] - p0.cx, est[1] - p0.cy) * 10, 1)} mm` : "kamida ikki chiziq kerak", est ? "green" : "");
    setRO("r6", "Massa markazi (hisob)", pl.showCm || pl.lines.length >= 2 ? u(xy([p0.cx, p0.cy]), "cm") : "?", P.inside(shape(), p0.cx, p0.cy) ? "koordinatalar plastinkaning chap yuqori burchagidan" : "jism tashqarisida — materialda emas!", P.inside(shape(), p0.cx, p0.cy) ? "" : "red");
  } else if (k === "tip") {
    const o = tBox(), ac = tCrit(), hc = P.tipHeight(o.b, o.h, o.f, tp.a), M = tipM(), dE = o.m * P.G * (P.tipHeight(o.b, o.h, o.f, ac) - o.f * o.h);
    setRO("r1", "Og‘ish burchagi α", u(fmt(tp.a / DEG, 1), "°"), tp.held ? "qo‘l bilan ushlab turilibdi" : tp.rest === "up" ? "tagida turibdi" : tp.rest === "side" ? "yonboshiga yiqildi" : "qo‘yib yuborildi", "blue");
    setRO("r2", "Kritik burchak α<sub>kr</sub>", u(fmt(ac / DEG, 1), "°"), `tg α = (b/2) : (massa markazi balandligi) = ${fmt(o.b * 50, 0)}/${fmt(o.f * o.h * 100, 1)}`, "orange");
    setRO("r3", "Massa markazi balandligi", u(fmt(hc * 100, 1), "cm"), `tik turganda ${fmt(o.f * o.h * 100, 1)} cm`);
    setRO("r4", "Tiklovchi moment", u(fmt(M, 3), "N·m"), M >= 0 ? "qutini tagiga qaytaradi" : "qutini ag‘daradi", M >= 0 ? "green" : "red");
    setRO("r5", "Ag‘darish uchun ish", u(fmt(dE * 1000, 0), "mJ"), "massa markazini αₖᵣ gacha ko‘tarish: mgΔh — turg‘unlik zaxirasi");
    setRO("r6", "Holat", tp.a < ac ? "turg‘un" : "ag‘dariladi", tp.a < ac ? "vertikal tayanch qirrasidan ichkarida" : "vertikal tayanchdan tashqariga chiqdi", tp.a < ac ? "green" : "red");
  } else if (k === "ball") {
    const y = P.surfY(bl.kind, bl.x), Ep = BALL_M * P.G * y / 100, sl = P.surfSlope(bl.kind, bl.x), Ft = BALL_M * P.G * Math.sin(Math.atan(Math.abs(sl)));
    setRO("r1", "Siljish <i>x</i>", u(fmt(bl.x, 1), "cm"), bl.held ? "qo‘l bilan ushlab turilibdi" : "muvozanat holatidan", "blue");
    setRO("r2", "Potensial energiya", u(fmt(Ep * 1000, 1), "mJ"), `Eₚ = mgy, y = ${fmt(y, 2)} cm`, "orange");
    setRO("r3", "Kinetik energiya", u(fmt(ballEk() * 1000, 1), "mJ"), "ilgarilanma + aylanma: (7/10)mv²", "green");
    setRO("r4", "Qaytaruvchi kuch", u(fmt(Ft * 1000, 0), "mN"), bl.kind === "dome" ? "muvozanatdan uzoqlashtiradi" : bl.kind === "bowl" ? "muvozanatga qaytaradi" : "nolga teng", bl.kind === "dome" && Ft > 1e-6 ? "red" : "");
    setRO("r5", "Muvozanat turi", { bowl: "turg‘un", dome: "turg‘unmas", flat: "befarq" }[bl.kind], { bowl: "Eₚ minimum: chetga chiqarilsa qaytadi", dome: "Eₚ maksimum: ozgina tursa ham dumalab ketadi", flat: "Eₚ o‘zgarmaydi: istalgan joyda turadi" }[bl.kind], { bowl: "green", dome: "red", flat: "" }[bl.kind]);
    setRO("r6", "Tebranish davri", bl.kind === "bowl" ? u(fmt(TAU * Math.sqrt((7 * P.SURF_R) / (5 * 980)), 2), "s") : "—", bl.kind === "bowl" ? "T = 2π√(7R/5g), R = 20 cm" : "tebranish yo‘q");
  } else if (k === "lever") {
    const m = lvMom(), Fd = lvF(), loads = lvLoads(), N = P.pivotN(loads, Number.isFinite(Fd) ? Fd : 0, lv.phi * DEG);
    setRO("r1", "Soat miliga qarshi moment M₁", u(fmt(m.ccw, 3), "N·m"), "chapga buruvchi kuchlar: F·l", "blue");
    setRO("r2", "Soat mili bo‘yicha moment M₂", u(fmt(m.cw, 3), "N·m"), "o‘ngga buruvchi kuchlar", "orange");
    setRO("r3", "Momentlar farqi", u(fmt(m.net, 3), "N·m"), lv.dyn ? "dinamometr momenti uni muvozanatlaydi" : Math.abs(m.net) < 1e-9 ? "M₁ = M₂ — muvozanat" : "muvozanat yo‘q", lv.dyn || Math.abs(m.net) < 1e-9 ? "green" : "red");
    setRO("r4", "Dinamometr", lv.dyn ? (Number.isFinite(Fd) ? u(fmt(Math.abs(Fd), 2), "N") : "∞") : "—", lv.dyn ? `${Fd >= 0 ? "yuqoriga" : "pastga"}; yelka ${fmt(Math.abs(lv.dh * 5 - lv.po * 100) * Math.cos(lv.phi * DEG), 1)} cm${lv.phi ? ` = d·cos ${fmt(lv.phi, 0)}°` : ""}` : "ulanmagan");
    setRO("r5", "Tayanch reaksiyasi <i>N</i>", u(fmt(N, 2), "N"), `yuklar ${fmt(loads.reduce((s, l) => s + l.m, 0) * P.G, 2)} N + richag ${fmt(P.LEVER.mBar * P.G, 2)} N${lv.dyn ? " − dinamometr" : ""}`);
    setRO("r6", "Richag og‘ishi", u(fmt(lv.b / DEG, 1), "°"), Math.abs(lv.b) >= P.LEVER_STOP - 1e-6 ? "tirgakka tiraldi" : "gorizontaldan", Math.abs(lv.b) > 0.01 ? "orange" : "");
  } else {
    const r = mRes(), h = mH(), Af = r.W * h, At = r.F * mc.s;
    setRO("r1", "Dinamometr (kerakli kuch)", u(fmt(r.F, 2), "N"), k === "axle" ? "dasta uchida, aylanishga urinma" : "ip uchida", "orange");
    setRO("r2", "Yuk og‘irligi mg", u(fmt(r.W, 2), "N"), `m = ${fmt(mc.m, 1)} kg, g = 9,8 m/s²`, "blue");
    setRO("r3", "Kuchdan yutuq", u(`×${fmt(r.W / r.F, 2)}`, ""), mc.ideal ? `ideal: ${k === "fixed" ? "1 (faqat yo‘nalish)" : k === "axle" ? "R/r" : k === "movable" ? "2" : "n"}` : "real: ishqalanish yutuqni kamaytiradi", "green");
    setRO("r4", "Yo‘ldan yutqazish s/h", u(`×${fmt(r.k, 0)}`, ""), `s = ${fmt(mc.s * 100, 1)} cm, h = ${fmt(h * 100, 1)} cm`);
    setRO("r5", "Ish", u(`${fmt(At, 2)} | ${fmt(Af, 2)}`, "J"), "to‘liq F·s | foydali mgh");
    setRO("r6", "FIK η", u(fmt(r.eta * 100, 0), "%"), mc.ideal ? "ideal mexanizm: F·s = mgh" : "η = mgh/(F·s)", r.eta > 0.99 ? "green" : "orange");
  }
}
let flashUntil = 0;
function flashStatus(t) { const el = $("[data-status]"); el.textContent = t; el.dataset.tone = "red"; flashUntil = Date.now() + 2400; }
function updateStatus() {
  if (flashUntil > Date.now()) return;
  const el = $("[data-status]"), k = kind(); let t, tone = "blue";
  if (k === "plate") { t = pl.held ? "Plastinka qo‘lda" : plRest() ? "Plastinka to‘xtadi: massa markazi shtift ostida" : "Plastinka tebranmoqda"; tone = plRest() ? "green" : "orange"; }
  else if (k === "tip") { const ac = tCrit(); t = tp.rest === "side" ? "Quti ag‘darildi" : tp.held ? (tp.a < ac ? "Qo‘yib yuborilsa — qaytadi" : "Qo‘yib yuborilsa — ag‘dariladi") : tp.rest === "up" ? "Quti tagida turibdi" : "Quti harakatlanmoqda"; tone = tp.rest === "side" || (tp.held && tp.a >= ac) ? "red" : "green"; }
  else if (k === "ball") { t = { bowl: "Turg‘un muvozanat", dome: "Turg‘unmas muvozanat", flat: "Befarq muvozanat" }[bl.kind]; tone = { bowl: "green", dome: "red", flat: "blue" }[bl.kind]; }
  else if (k === "lever") { const m = lvMom(); t = lv.dyn ? "Dinamometr richagni muvozanatda ushlab turibdi" : Math.abs(m.net) < 1e-9 ? "Richag muvozanatda: M₁ = M₂" : "Momentlar teng emas — richag buriladi"; tone = lv.dyn || Math.abs(m.net) < 1e-9 ? "green" : "red"; }
  else { t = mc.auto > 0 ? "Yuk ko‘tarilmoqda" : mc.s >= sMax() - 1e-6 ? "Yuk eng yuqorida" : mc.s > 0 ? "Yuk ko‘tarildi" : "Yuk polda"; tone = mc.s > 0 ? "orange" : ""; }
  if (el.textContent !== t) el.textContent = t; el.dataset.tone = tone;
}

let lastExplain = "";
function updateExplain() {
  const p = [], k = kind();
  if (k === "plate") {
    p.push("<p>Jismning <b>massa markazi</b> (og‘irlik markazi) — og‘irlik kuchining teng ta’sir etuvchisi qo‘yilgan nuqta. Bitta nuqtadan osilgan jism tinch holatda shunday turadiki, massa markazi osish nuqtasidan o‘tgan <b>vertikal</b> ustida (pastda) bo‘ladi: aks holda og‘irlik kuchi momenti jismni buradi.</p>");
    p.push("<p>Shuning uchun shovun ipi bo‘ylab chizilgan chiziq massa markazidan o‘tadi. Plastinkani boshqa teshikdan osib, ikkinchi chiziqni chizing — kesishish nuqtasi massa markazi. Uchinchi chiziq ham shu nuqtadan o‘tadi (tekshirish).</p>");
    if (pl.shape === "arch") p.push("<p><b>Taqa</b>da massa markazi jismning ichida emas, bo‘shliqda yotadi. Halqa, bumerang, stul — massa markazi jism tashqarisida bo‘lishi mumkin.</p>");
    if (pl.shape === "disk") p.push("<p>Teshik qirqib olingan disk: massa markazi doira markazidan teshikka qarama-qarshi tomonga siljigan. Uni «butun disk − kichik doira» deb hisoblash mumkin: xᴄ = (S₁x₁ − S₂x₂)/(S₁ − S₂).</p>");
    if (!plRest() && !pl.held) p.push("<p>Plastinka tebranmoqda — bu <b>fizik mayatnik</b>. Shtiftdagi ishqalanish tebranishni so‘ndiradi.</p>");
  } else if (k === "tip") {
    p.push("<p>Tayanchga ega jism massa markazidan tushirilgan vertikal <b>tayanch yuzasi</b> ichidan o‘tsa, muvozanatda turadi. Quti og‘dirilganda u faqat bitta qirraga tayanadi; og‘irlik kuchining shu qirraga nisbatan momenti qutini orqaga qaytaradi — vertikal qirradan chiqib ketmaguncha.</p>");
    p.push(`<p>Kritik burchak tg α<sub>kr</sub> = (b/2)/h<sub>C</sub>. Hozir α<sub>kr</sub> = ${fmt(tCrit() / DEG, 1)}°. Quti qanchalik keng va massa markazi qanchalik past bo‘lsa, u shuncha <b>turg‘un</b>: yuk mashinalariga og‘ir yukni pastga joylashadi, minoralar va kranlar keng va og‘ir asosga quriladi.</p>`);
  } else if (k === "ball") {
    p.push("<p><b>Turg‘un muvozanat</b>: jism muvozanat holatidan chiqarilsa, uni qaytaruvchi kuch paydo bo‘ladi (botiq sirt — potensial energiya minimumi). <b>Turg‘unmas</b>: chetga chiqarilsa, kuch uni yanada uzoqlashtiradi (qavariq sirt cho‘qqisi — maksimum). <b>Befarq</b>: istalgan holatda muvozanatda (tekis sirt).</p>");
    p.push("<p>Sharchaga og‘irlik kuchi mg va sirtning reaksiya kuchi N ta’sir qiladi; ularning teng ta’sir etuvchisi F sirtga urinma yo‘nalgan. Muvozanat nuqtasida F = 0.</p>");
  } else if (k === "lever") {
    p.push("<p><b>Richag</b> — qo‘zg‘almas o‘q atrofida aylana oladigan qattiq jism. Kuch momenti M = F·l, bu yerda yelka l — o‘qdan kuchning ta’sir chizig‘igacha bo‘lgan eng qisqa masofa. Richag muvozanatda bo‘lishi uchun uni soat mili bo‘yicha va unga qarshi buruvchi momentlar teng bo‘lishi kerak: <b>M₁ = M₂</b>, ya’ni F₁l₁ = F₂l₂ (moment qoidasi).</p>");
    if (lv.dyn && lv.phi > 0) p.push(`<p>Dinamometr ${fmt(lv.phi, 0)}° qiya tortilmoqda: yelka d·cos φ ga kamaydi, shuning uchun kerakli kuch ${fmt(1 / Math.cos(lv.phi * DEG), 2)} marta ortdi.</p>`);
    if (Math.abs(lv.po) > 1e-6) p.push(`<p>Tayanch richag o‘rtasidan ${fmt(lv.po * 100, 0)} cm siljigan: endi richagning o‘z og‘irligi (${fmt(P.LEVER.mBar * P.G, 2)} N, massa markazi o‘rtada) ham moment beradi: ${fmt(P.LEVER.mBar * P.G * lv.po, 3)} N·m.</p>`);
    p.push("<p>Hayotda: qaychi, omburlar, lom, tarozi (1-tur), yong‘oq chaqqich va tachka (2-tur), qo‘l bilagi va pinset (3-tur).</p>");
  } else {
    const r = mRes();
    if (k === "fixed") p.push("<p><b>Qo‘zg‘almas blok</b> — teng yelkali richag: o‘qdan ikki ip uchigacha yelkalar bir xil (r), shuning uchun F = mg. U kuchdan yutuq bermaydi, faqat kuch yo‘nalishini qulay tomonga o‘zgartiradi.</p>");
    if (k === "movable") p.push("<p><b>Qo‘zg‘aluvchan blok</b> — yelkalari 2r va r bo‘lgan richag (aylanish o‘qi — chap ip tegib turgan nuqta). Kuchdan 2 marta yutuq beradi: F = mg/2, lekin ipni 2 marta ko‘p tortish kerak: s = 2h.</p>");
    if (k === "tackle") p.push(`<p><b>Polispast</b> — qo‘zg‘almas va qo‘zg‘aluvchan bloklar to‘plami. Yukni ${mc.n} ta ip ushlab turadi, har biridagi taranglik ~F: kuchdan ${mc.n} marta yutuq, yo‘ldan ${mc.n} marta yutqazish. Har bir g‘ildirakda ishqalanish taranglikni biroz kamaytiradi — FIK g‘ildiraklar soni bilan kamayadi.</p>`);
    if (k === "axle") p.push(`<p><b>Chig‘ir</b> (darvoza, vorot) — o‘qqa mahkamlangan baraban va dasta: yelkalari r va R bo‘lgan richag. F = mg·r/R: R/r = ${fmt(mc.R / P.MECH.r, 0)} marta yutuq. Quduqdan suv chiqarish, mashina rul g‘ildiragi, eshik dastasi, otvyortka — shu tamoyil.</p>`);
    p.push(`<p><b>Mexanikaning oltin qoidasi</b>: hech bir mexanizm ishdan yutuq bermaydi — kuchdan necha marta yutilsa, yo‘ldan shuncha marta yutqaziladi. Hozir FIK η = ${fmt(r.eta * 100, 0)} %${mc.ideal ? " (ideal)" : ": qolgan ish ishqalanish va blokni ko‘tarishga ketadi"}.</p>`);
  }
  const html = p.join(""); if (html !== lastExplain) { $("[data-explain]").innerHTML = html; lastExplain = html; }
}
const FORMULA = { plate: "<small>Massa markazi</small> x<sub>C</sub> = Σmᵢxᵢ/Σmᵢ", tip: "<small>Ag‘darilish</small> tg α<sub>kr</sub> = (b/2)/h<sub>C</sub>", ball: "<small>Muvozanat</small> ΣF = 0", lever: "<small>Moment qoidasi</small> F₁l₁ = F₂l₂", fixed: "<small>Qo‘zg‘almas blok</small> F = mg", movable: "<small>Qo‘zg‘aluvchan blok</small> F = mg/2", tackle: "<small>Polispast</small> F = mg/n", axle: "<small>Chig‘ir</small> F = mg·r/R" };
function updateFormula() { const html = FORMULA[kind()]; const f = $("[data-formula]"); if (f.innerHTML !== html) f.innerHTML = html; }
function refresh() { updateReadouts(); updateStatus(); updateExplain(); updateFormula(); stage.render(); if (graphOn()) graph.render(); syncTools(); }

/* ------------------------------------------------------------------ Vaqt */

let uiTimer = 0;
const loop = createLoop((dt) => {
  if (!(dt > 0)) return;
  dt = Math.min(dt, 0.05); anim += dt;
  const k = kind();
  if (k === "plate") stepPlate(dt); else if (k === "tip") stepTip(dt); else if (k === "ball") stepBall(dt); else if (k === "lever") stepLever(dt); else stepMech(dt);
  stage.render();
  uiTimer += dt; if (uiTimer > 0.12) { uiTimer = 0; updateReadouts(); updateStatus(); if (graphOn() && k !== "lever" && !(isMech(k) && ui.view[k] === "F")) graph.render(); if (k === "plate") updateExplain(); }
}, { onStateChange: setPlayUI });
const playBtn = $("[data-play]");
function setPlayUI(on) {
  playBtn.setAttribute("aria-pressed", String(on));
  playBtn.querySelector("[data-play-icon]").innerHTML = icon(on ? "pause" : "play");
  playBtn.querySelector("[data-play-text]").textContent = on ? "Pauza" : "Davom ettirish";
  if (!on) refresh();
}
playBtn.addEventListener("click", () => loop.toggle());
const kick = () => { if (!prefersReducedMotion()) loop.start(); };
$("[data-reset]").addEventListener("click", () => loadPreset(presetId || defaultFor(), false));

/* ------------------------------------------------------------------ Boshqaruv */

// 1a) Plastinka
const shSel = $("#plShape");
shSel.innerHTML = Object.entries(P.SHAPES).map(([id, sh]) => `<option value="${id}">${sh.name}</option>`).join("");
shSel.addEventListener("change", () => { pl.shape = shSel.value; pl.hole = 0; resetPlate(); customized(); syncPlate(); refresh(); kick(); });
document.querySelectorAll("[data-hole-value]").forEach((b) => b.addEventListener("click", () => { hangFrom(Number(b.dataset.holeValue)); customized(); refresh(); kick(); }));
$("[data-line]").addEventListener("click", () => { if (!plRest()) flashStatus("Plastinka hali tebranmoqda — chiziq aniq chiqmaydi"); drawPlumbLine(); refresh(); });
$("[data-clearl]").addEventListener("click", () => { pl.lines = []; refresh(); });
$("[data-showcm]").addEventListener("click", () => { pl.showCm = !pl.showCm; refresh(); });
function syncPlate() { shSel.value = pl.shape; document.querySelectorAll("[data-hole-value]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.holeValue) === pl.hole))); }

// 1b) Quti
const szSel = $("#tpSize");
szSel.addEventListener("change", () => { tp.size = szSel.value; tp.a = 0; tp.rest = "up"; tp.held = true; customized(); syncTip(); refresh(); });
const TF = bindRange($("#tpF"), $("#tpFOut"), (v) => `${fmt(v * 100, 0)} % h`, (v) => { tp.f = v; if (tp.rest === "side") { tp.a = 0; tp.rest = "up"; } customized(); refresh(); });
const TA = bindRange($("#tpA"), $("#tpAOut"), (v) => `${fmt(v, 1)}°`, (v) => { tp.a = v * DEG; tp.held = true; tp.rest = null; tp.w = 0; customized(); refresh(); });
function syncTip() { szSel.value = tp.size; TF.set(tp.f); TA.set(Math.min(60, Math.round((tp.a / DEG) * 2) / 2)); }

// 1c) Sharcha
document.querySelectorAll("[data-surf-value]").forEach((b) => b.addEventListener("click", () => { bl.kind = b.dataset.surfValue; bl.x = bl.kind === "dome" ? 0 : 6; bl.v = 0; bl.held = bl.kind !== "dome"; customized(); syncBall(); refresh(); }));
function syncBall() { document.querySelectorAll("[data-surf-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.surfValue === bl.kind))); }
$("[data-release]").addEventListener("click", () => { if (kind() === "tip") releaseTip(); else { bl.held = false; bl.v = 0; } customized(); refresh(); kick(); });

// 2) Richag
const holeFmt = (v) => (v === 0 ? "—" : `${v < 0 ? "chapda" : "o‘ngda"} ${Math.abs(v)} (${Math.abs(v) * 5} cm)`);
const LAn = bindRange($("#lvAn"), $("#lvAnOut"), (v) => `${v} ta (${fmt(v * 0.98, 2)} N)`, (v) => { lv.A.n = v; leverChanged(); });
const LAh = bindRange($("#lvAh"), $("#lvAhOut"), holeFmt, (v) => { lv.A.h = v; leverChanged(); });
const LBn = bindRange($("#lvBn"), $("#lvBnOut"), (v) => `${v} ta (${fmt(v * 0.98, 2)} N)`, (v) => { lv.B.n = v; leverChanged(); });
const LBh = bindRange($("#lvBh"), $("#lvBhOut"), holeFmt, (v) => { lv.B.h = v; leverChanged(); });
const LDh = bindRange($("#lvDh"), $("#lvDhOut"), holeFmt, (v) => { lv.dh = v || 1; leverChanged(); });
const LPhi = bindRange($("#lvPhi"), $("#lvPhiOut"), (v) => `${fmt(v, 0)}°`, (v) => { lv.phi = v; leverChanged(); });
const poSel = $("#lvPo");
poSel.addEventListener("change", () => { lv.po = Number(poSel.value); leverChanged(); });
document.querySelectorAll("[data-dyn-value]").forEach((b) => b.addEventListener("click", () => { lv.dyn = b.dataset.dynValue === "1"; leverChanged(); syncLever(); }));
function leverChanged() { customized(); refresh(); kick(); }
function syncLever() {
  LAn.set(lv.A.n); LAh.set(lv.A.h); LBn.set(lv.B.n); LBh.set(lv.B.h); LDh.set(lv.dh); LPhi.set(lv.phi); poSel.value = String(lv.po);
  document.querySelectorAll("[data-dyn-value]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.dynValue === "1") === lv.dyn)));
  document.querySelectorAll("[data-dynctl]").forEach((el) => { el.hidden = !lv.dyn; });
}
$("[data-rec]").addEventListener("click", () => { const g = lvGraph(); if (!(g.l > 0) || !Number.isFinite(g.F)) { flashStatus("O‘ng yuklar yoki dinamometr ulanmagan"); return; } lv.pts.push({ l: g.l, F: Math.abs(g.F) }); refresh(); });
$("[data-clear]").addEventListener("click", () => { lv.pts = []; refresh(); });

// 3) Mexanizmlar
const MM = bindRange($("#mM"), $("#mMOut"), (v) => `${fmt(v, 1)} kg`, (v) => { mc.m = v; mc.s = Math.min(mc.s, sMax()); customized(); refresh(); });
const nSel = $("#mN"), rSel = $("#mR");
nSel.addEventListener("change", () => { mc.n = Number(nSel.value); mc.s = Math.min(mc.s, sMax()); customized(); refresh(); });
rSel.addEventListener("change", () => { mc.R = Number(rSel.value); mc.s = Math.min(mc.s, sMax()); mc.psi = mc.s / mc.R; customized(); refresh(); });
document.querySelectorAll("[data-ideal-value]").forEach((b) => b.addEventListener("click", () => { mc.ideal = b.dataset.idealValue === "1"; customized(); syncMech(); refresh(); }));
$("[data-lift]").addEventListener("click", () => { mc.auto = 1; if (mc.s >= sMax() - 1e-6) mc.s = 0; refresh(); kick(); });
$("[data-lower]").addEventListener("click", () => { mc.auto = 0; mc.s = 0; mc.psi = 0; refresh(); });
function syncMech() { MM.set(mc.m); nSel.value = String(mc.n); rSel.value = String(mc.R); document.querySelectorAll("[data-ideal-value]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.idealValue === "1") === mc.ideal))); }

function syncTools() {
  const k = kind();
  $("[data-showcm]").setAttribute("aria-pressed", String(pl.showCm)); $("[data-showcm]").textContent = pl.showCm ? "Massa markazini yashirish" : "Massa markazini ko‘rsatish";
  document.querySelectorAll("[data-tool]").forEach((el) => { el.hidden = !el.dataset.tool.split(" ").includes(k); });
}

/* ------------------------------------------------------------------ Sahnada boshqarish */

const canvas = stage.canvas;
let drag = null;
const ptr = (e) => { const r = canvas.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); };
const inBox = (p, b) => b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
const near = (p, h, extra = 0) => h && dist(p.x, p.y, h.x, h.y) <= h.r + extra;
const angAt = (p, c0) => Math.atan2(p.y - c0[1], p.x - c0[0]);
function hitTest(p) {
  const k = kind();
  if (k === "plate") {
    for (let i = 0; i < 3; i++) if (i !== pl.hole && near(p, hits["hole" + i])) return { k: "hole", i };
    const [qx, qy] = plInv(p.x, p.y); return P.inside(shape(), qx, qy) ? { k: "plate" } : null;
  }
  if (k === "tip") { const o = tBox(), ca = Math.cos(tp.a), sa = Math.sin(tp.a), dx = (p.x - TIP_E[0]) / TK, dy = -(p.y - TIP_E[1]) / TK, uu = dx * ca - dy * sa, vv = dx * sa + dy * ca; return uu >= -o.b - 0.01 && uu <= 0.01 && vv >= -0.01 && vv <= o.h + 0.01 ? { k: "box" } : null; }
  if (k === "ball") return near(p, hits.ball) ? { k: "ball" } : null;
  if (k === "lever") { if (near(p, hits.ring)) return { k: "ring" }; for (const key of ["A", "B"]) if (inBox(p, hits[key])) return { k: key }; return null; }
  if (isMech(k)) { const h = hits.hand; if (!h) return null; if (h.axle) return dist(p.x, p.y, h.x, h.y) <= h.r && dist(p.x, p.y, h.x, h.y) > 10 ? { k: "crank" } : null; return inBox(p, h) ? { k: "hand", dir: h.dir } : null; }
  return null;
}
canvas.addEventListener("pointerdown", (e) => {
  const p = ptr(e), h = hitTest(p); if (!h) return;
  e.preventDefault();
  if (h.k === "hole") { hangFrom(h.i); customized(); refresh(); kick(); return; }
  drag = { ...h, x0: p.x, y0: p.y, a0: h.k === "plate" ? angAt(p, PIN) : h.k === "box" ? angAt(p, TIP_E) : h.k === "crank" ? angAt(p, [250, 96]) : 0, th0: pl.th, ta0: tp.a, s0: mc.s };
  if (h.k === "plate") { pl.held = true; pl.w = 0; }
  if (h.k === "box") { tp.held = true; tp.rest = null; tp.w = 0; }
  if (h.k === "ball") { bl.held = true; bl.v = 0; }
  if (h.k === "hand" || h.k === "crank") mc.auto = 0;
  canvas.dataset.dragging = "true"; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ }
  kick(); refresh();
});
function onDrag(p) {
  const k = drag.k;
  if (k === "plate") { pl.th = drag.th0 + P.wrapPi(angAt(p, PIN) - drag.a0); pl.w = 0; }
  else if (k === "box") { tp.a = clamp(drag.ta0 + P.wrapPi(angAt(p, TIP_E) - drag.a0), 0, Math.PI / 2); TA.set(Math.min(60, Math.round((tp.a / DEG) * 2) / 2)); }
  else if (k === "ball") { const lim = bl.kind === "bowl" ? P.SURF_W - 0.3 : 23; bl.x = clamp((p.x - BC[0]) / BK, -lim, lim); bl.v = 0; }
  else if (k === "A" || k === "B") { const g = lv[k], hNew = clamp(Math.round(((p.x - PIV[0]) / LK + lv.po) / P.LEVER.step), -6, 6); if (hNew !== 0 && hNew !== g.h) { g.h = hNew; (k === "A" ? LAh : LBh).set(hNew); } }
  else if (k === "ring") { const ud = lv.dh * P.LEVER.step - lv.po, [dx, dy] = lvW(ud, 0), side = Math.sign(ud) || 1, ph = Math.atan2((p.x - dx) * side, Math.abs(p.y - dy)) / DEG; lv.phi = clamp(Math.round(ph), 0, 60); LPhi.set(lv.phi); }
  else if (k === "hand") { mc.s = clamp(drag.s0 + (drag.dir * (p.y - drag.y0)) / MK, 0, sMax()); mc.psi = mc.s / mc.R; }
  else if (k === "crank") { const a = angAt(p, [250, 96]), d = P.wrapPi(a - drag.a0); drag.a0 = a; mc.s = clamp(mc.s + d * mc.R, 0, sMax()); mc.psi = mc.s / mc.R; }
  customized(); refresh();
}
const CURSOR = { hole: "pointer", plate: "grab", box: "ew-resize", ball: "ew-resize", A: "ew-resize", B: "ew-resize", ring: "grab", hand: "ns-resize", crank: "grab" };
canvas.addEventListener("pointermove", (e) => { const p = ptr(e); if (!drag) { const h = hitTest(p); canvas.style.cursor = h ? CURSOR[h.k] : ""; return; } onDrag(p); });
function endDrag() {
  if (!drag) return;
  if (drag.k === "plate") { pl.held = false; pl.w = 0; }
  if (drag.k === "box") releaseTip();
  if (drag.k === "ball") { bl.held = false; bl.v = 0; }
  drag = null; canvas.dataset.dragging = "false"; kick(); refresh();
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------ Tayyor tajribalar */

const setPlate = (shapeId, showCm = false, lines = []) => () => { ui.kind.cm = "plate"; pl.shape = shapeId; pl.hole = 0; pl.showCm = showCm; resetPlate(); for (const i of lines) { pl.hole = i; pl.th = plEq(); drawPlumbLine(); } pl.hole = lines.length ? (lines.at(-1) + 1) % 3 : 0; if (lines.length) { pl.th = plEq() + 0.5; } };
const setTip = (size, f, aDeg, held = true) => () => { ui.kind.cm = "tip"; Object.assign(tp, { size, f, a: aDeg * DEG, w: 0, rest: aDeg ? null : "up", held }); };
const setBall = (k, x, held = false) => () => { ui.kind.cm = "ball"; Object.assign(bl, { kind: k, x, v: 0, held }); };
const setLever = (A, B, o = {}) => () => { lv.A = { n: A[0], h: A[1] }; lv.B = { n: B[0], h: B[1] }; Object.assign(lv, { dyn: false, dh: 5, phi: 0, po: 0, b: 0, w: 0, pts: [] }, o); };
const setMech = (k, m, o = {}) => () => { ui.kind.mech = k; Object.assign(mc, { m, n: 4, R: 0.3, ideal: false, s: 0, auto: 0, psi: 0 }, o); };
const PRESETS = {
  plateL: { mode: "cm", title: "Massa markazini topish (L shakl)", lesson: "Plastinka A teshikdan osilgan va tebranmoqda. To‘xtagach «Shovun bo‘ylab chiziq chizish» ni bosing. So‘ng B teshikni bosing (yoki sahnada B harfini), yana chiziq chizing. Kesishish nuqtasi — massa markazi. C teshik bilan tekshiring.", set: setPlate("L") },
  plateTri: { mode: "cm", title: "Uchburchak: medianalar", lesson: "Uchburchak plastinkaning massa markazi medianalar kesishgan nuqtada (har bir medianani 2 : 1 nisbatda bo‘ladi). Ikki teshikdan osib tekshiring.", set: setPlate("tri") },
  plateDisk: { mode: "cm", title: "Teshikli disk", lesson: "Diskdan doira kesib olingan: massa markazi geometrik markazdan siljigan. Ikki chiziq allaqachon chizilgan — kesishish nuqtasini va hisoblangan markazni solishtiring.", set: setPlate("disk", true, [0, 1]) },
  plateArch: { mode: "cm", title: "Taqa: markaz jismdan tashqarida", lesson: "Yarim halqa shaklidagi plastinka. Chiziqlar bo‘shliqda kesishadi: massa markazi jism materialida emas.", set: setPlate("arch", true, [1, 2]) },
  tipTall: { mode: "cm", title: "Baland quti: αₖᵣ ≈ 18°", lesson: "Quti 15° ga og‘dirilgan va qo‘lda ushlab turilibdi. «Qo‘yib yuborish» ni bosing — u qaytadi. So‘ng sahnada 20° dan oshiring va qo‘yib yuboring — ag‘dariladi.", set: setTip("tall", 0.5, 15) },
  tipHeavy: { mode: "cm", title: "Og‘ir asos: turg‘unroq", lesson: "Xuddi shu qutining tagida po‘lat yuk: massa markazi balandlikning 25 % ida. Kritik burchak 18° dan 34° ga oshdi — 25° da ham qaytadi.", set: setTip("tall", 0.25, 25) },
  ballBowl: { mode: "cm", title: "Turg‘un muvozanat", lesson: "Botiq sirtdagi sharcha chetga surib qo‘yib yuborilgan: u muvozanat holati atrofida tebranib, pastki nuqtada to‘xtaydi.", set: setBall("bowl", 8) },
  ballDome: { mode: "cm", title: "Turg‘unmas muvozanat", lesson: "Sharcha qavariq sirt cho‘qqisidan 2 mm siljigan holda qo‘yib yuborildi — dumalab tushib ketadi. Uni sahnada aynan cho‘qqiga qo‘yib ko‘ring.", set: setBall("dome", 0.2) },
  ballFlat: { mode: "cm", title: "Befarq muvozanat", lesson: "Tekis gorizontal taxta: sharchani istalgan joyga qo‘ying — u o‘sha yerda qoladi.", set: setBall("flat", 6) },
  balance: { mode: "lever", title: "Moment qoidasi: 2 × 15 = 3 × 10", lesson: "Chapda 2 ta yuk 15 cm da (M₁ = 1,96·0,15 = 0,294 N·m), o‘ngda 3 ta yuk 10 cm da (M₂ = 2,94·0,10 = 0,294 N·m): richag muvozanatda. Yuklarni boshqa teshikka surib ko‘ring va «Nuqtani yozish» bilan grafikni to‘ldiring.", set: setLever([2, -3], [3, 2]) },
  unbal: { mode: "lever", title: "Momentlar teng emas", lesson: "Kuchlar teng (3 ta va 3 ta yuk), lekin yelkalar har xil: o‘ng tomon og‘ir. Momentlar tenglashishi uchun o‘ng yuklarni qaysi teshikka surish kerak?", set: setLever([3, -2], [3, 4]) },
  dynUp: { mode: "lever", title: "Dinamometr bilan o‘lchash", lesson: "Chapda 4 ta yuk 10 cm da, o‘ngda dinamometr 25 cm da pastga tortadi: F = 3,92·10/25 = 1,57 N. Dinamometrni boshqa teshikka o‘tkazing — kuch yelkaga teskari proporsional.", set: setLever([4, -2], [0, 3], { dyn: true, dh: 5 }) },
  dynAngle: { mode: "lever", title: "Qiya tortish: yelka kamayadi", lesson: "Dinamometr vertikaldan 50° og‘gan: kuch yelkasi d·cos 50° = 0,64d. Ko‘rsatish vertikal tortgandagidan 1,56 marta katta. Dinamometr halqasini sahnada surib ko‘ring.", set: setLever([4, -2], [0, 3], { dyn: true, dh: 5, phi: 50 }) },
  offset: { mode: "lever", title: "Tayanch siljigan: richag og‘irligi", lesson: "Tayanch richag o‘rtasidan 10 cm o‘ngda. Yuklarsiz ham richag chapga og‘adi: uning og‘irligi (0,98 N, massa markazi o‘rtada, yelkasi 10 cm) moment beradi. O‘ngdagi 4-teshikka (tayanchdan 10 cm) bitta yuk osing — richag muvozanatlashadi.", set: setLever([0, -3], [0, 4], { po: 0.1 }) },
  fixed: { mode: "mech", title: "Qo‘zg‘almas blok", lesson: "1 kg yuk. Dinamometrni pastga torting: yuk xuddi shuncha masofaga ko‘tariladi, kuch ~mg (ishqalanish tufayli biroz ko‘p).", set: setMech("fixed", 1) },
  movable: { mode: "mech", title: "Qo‘zg‘aluvchan blok", lesson: "2 kg yuk qo‘zg‘aluvchan blokda: dinamometr ~10 N ko‘rsatadi — mg/2 dan biroz ko‘p (blok massasi, ishqalanish). Ipni yuqoriga torting: yuk ip yo‘lining yarmicha ko‘tariladi.", set: setMech("movable", 2) },
  tackle: { mode: "mech", title: "Polispast (4 ip)", lesson: "5 kg yukni 4 ta ip ushlab turibdi: dinamometr ~14,5 N (ideal holda 12,25 N). Ipni 40 cm tortsangiz, yuk 10 cm ko‘tariladi. «Ish» grafigini oching.", set: setMech("tackle", 5, { n: 4, auto: 1 }) },
  golden: { mode: "mech", title: "Oltin qoida (ideal)", lesson: "Ideal (ishqalanishsiz, yengil) qo‘zg‘aluvchan blok: F = mg/2 aniq, s = 2h, F·s = mgh — ishdan yutuq yo‘q. «Ish» grafigida ikkala ustun teng.", set: setMech("movable", 2, { ideal: true, auto: 1 }) },
  axle: { mode: "mech", title: "Chig‘ir: quduqdan suv", lesson: "10 kg suvli chelak. Dasta 30 cm, baraban 5 cm: kerakli kuch ~6 marta kichik (~18 N). Dastani sahnada aylantiring: bir aylanishda chelak 31 cm ko‘tariladi, qo‘l esa 1,9 m yo‘l bosadi.", set: setMech("axle", 10) },
};
const GROUPS = [["Massa markazi va muvozanat", ["plateL", "plateTri", "plateDisk", "plateArch", "tipTall", "tipHeavy", "ballBowl", "ballDome", "ballFlat"]], ["Richag", ["balance", "unbal", "dynUp", "dynAngle", "offset"]], ["Bloklar va chig‘ir", ["fixed", "movable", "tackle", "golden", "axle"]]];
const presetBox = $("[data-presets]");
presetBox.innerHTML = GROUPS.map(([gg, ids]) => `<span class="sim-presets__label">${gg}</span>${ids.map((id) => `<button class="sim-preset" type="button" data-preset="${id}" aria-pressed="false">${PRESETS[id].title}</button>`).join("")}`).join("");
presetBox.addEventListener("click", (ev) => { const b = ev.target.closest("[data-preset]"); if (b) loadPreset(b.dataset.preset); });
const setPresetPressed = (id) => document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === id)));
function customized() { if (presetId) { presetId = null; setPresetPressed(null); $("[data-lesson]").textContent = ""; } }

const MODE_HINT = { plate: "Plastinkani surib tebrating, teshikni bosing", tip: "Qutini o‘ngga suring va qo‘yib yuboring", ball: "Sharchani suring va qo‘yib yuboring", lever: "Yuklarni teshiklarga suring, dinamometr halqasini torting", fixed: "Dinamometrni pastga torting", movable: "Dinamometrni yuqoriga torting", tackle: "Dinamometrni pastga torting", axle: "Chig‘ir dastasini aylantiring" };
const KIND_DEFAULT = { plate: "plateL", tip: "tipTall", ball: "ballBowl", lever: "balance", fixed: "fixed", movable: "movable", tackle: "tackle", axle: "axle" };
const MODE_DEFAULT = { cm: "plateL", lever: "balance", mech: "fixed" };
const defaultFor = () => KIND_DEFAULT[kind()];
function setModeUI() {
  const k = kind();
  document.querySelectorAll("[data-mode-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modeValue === ui.mode)));
  document.querySelectorAll("[data-ctl]").forEach((el) => { el.hidden = el.dataset.ctl !== ui.mode; });
  document.querySelectorAll("[data-kind-value]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kindValue === k)));
  document.querySelectorAll("[data-kctl]").forEach((el) => { el.hidden = !el.dataset.kctl.split(" ").includes(k); });
  $("[data-mode-hint]").textContent = MODE_HINT[k];
  stage.canvas.setAttribute("aria-label", { plate: "Shtativga osilgan fanera plastinka va shovun", tip: "Stol ustidagi yog‘och quti", ball: "Sirtdagi po‘lat sharcha", lever: "Laboratoriya richagi, yuklar va dinamometr", fixed: "Qo‘zg‘almas blok, yuk va dinamometr", movable: "Qo‘zg‘aluvchan blok, yuk va dinamometr", tackle: "Polispast, yuk va dinamometr", axle: "Quduq chig‘iri va chelak" }[k]);
  setTabs();
}
document.querySelectorAll("[data-kind-value]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.kindValue !== kind()) loadPreset(KIND_DEFAULT[b.dataset.kindValue]); }));
document.querySelectorAll("[data-mode-value]").forEach((b) => b.addEventListener("click", () => { const m = b.dataset.modeValue; if (m !== ui.mode) loadPreset(m === "lever" ? MODE_DEFAULT.lever : KIND_DEFAULT[ui.kind[m]] || MODE_DEFAULT[m]); }));
function loadPreset(id, mark = true) {
  const p = PRESETS[id];
  drag = null; ui.mode = p.mode; ui.hover = null; flashUntil = 0;
  p.set();
  if (id === "tackle" || id === "golden") ui.view[ui.kind.mech] = id === "golden" ? "A" : ui.view[ui.kind.mech];
  setModeUI();
  presetId = id; setPresetPressed(id);
  $("[data-lesson]").textContent = p.lesson;
  syncPlate(); syncTip(); syncBall(); syncLever(); syncMech(); refresh();
  if (!prefersReducedMotion()) loop.start(); else loop.stop();
  if (mark) { try { history.replaceState(null, "", `?preset=${id}`); } catch { /* fayl:// */ } }
}

setPlayUI(false);
const q0 = new URLSearchParams(location.search).get("preset");
loadPreset(PRESETS[q0] ? q0 : "plateL");
document.fonts?.ready.then(() => { stage.render(); if (graphOn()) graph.render(); });

// Node/Playwright tekshiruvi uchun
window.__statics = { pl, tp, bl, lv, mc, ui, loadPreset, refresh, stepPlate, stepTip, stepBall, stepLever, stepMech, kind, pp, plEstimate, lvMom, lvF, mRes, get drag() { return drag; } };
